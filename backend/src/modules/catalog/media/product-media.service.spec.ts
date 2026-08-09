import { ForbiddenException } from "@nestjs/common";
import { RoleCode } from "../../../generated/prisma/enums";
import { ProductMediaService } from "./product-media.service";
import { CatalogAccessPolicy } from "../catalog-access.policy";
import { ConflictError } from "../../../shared/errors";
import type { ObjectStorageService } from "./storage/storage.interface";
import type { MediaProcessor } from "./media-processor.service";
import type { AuthUser } from "../../../security/auth/auth.service";

// Полный набор media-прав PARTNER (как в реальной матрице) — policy проверяет
// explicit permission + object scope.
const PARTNER: AuthUser = {
  id: "u-partner",
  code: "USR-00000009",
  username: "partner1",
  email: null,
  fullName: null,
  status: "ACTIVE",
  role: RoleCode.PARTNER,
  roleTitle: "Партнёр",
  partnerId: "par-1",
  customerId: null,
  permissions: [
    "catalog.media.upload_own",
    "catalog.media.update_own",
    "catalog.media.delete_own",
    "catalog.media.reorder_own",
    "catalog.media.set_primary_own",
  ],
};

const ADMIN: AuthUser = { ...PARTNER, id: "u-admin", username: "admin", role: RoleCode.ADMIN, partnerId: null };

function makeProcessorStub() {
  return {
    processImage: jest.fn().mockResolvedValue({
      original: Buffer.from("orig"),
      large: Buffer.from("large"),
      thumb: Buffer.from("thumb"),
      format: "jpeg",
      mimeType: "image/jpeg",
      width: 100,
      height: 80,
      size: 4,
    }),
  } as unknown as MediaProcessor;
}

function makeStorageStub(overrides?: Partial<ObjectStorageService>) {
  return {
    putObject: jest.fn().mockResolvedValue({ key: "k", size: 1 }),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    objectExists: jest.fn().mockResolvedValue(true),
    getSignedReadUrl: jest.fn().mockResolvedValue("https://signed/url?X-Amz-Signature=abc"),
    ...overrides,
  } as unknown as ObjectStorageService & { putObject: jest.Mock; deleteObject: jest.Mock };
}

type AnyFn = (...args: never[]) => unknown;

interface PrismaStub {
  product: { findUnique: jest.Mock };
  productMedia: { count: jest.Mock; aggregate: jest.Mock; findFirst: jest.Mock; create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; delete: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  moderationSubmission: { count: jest.Mock };
  categorySchema: { findUnique: jest.Mock; findFirst: jest.Mock };
  productHistory: { create: jest.Mock };
  $transaction: jest.Mock;
}

function makePrismaStub(overrides?: Record<string, unknown>): PrismaStub {
  const prisma: PrismaStub = {
    product: {
      findUnique: jest.fn().mockResolvedValue({
        id: "prod-1",
        code: "PRD-00000001",
        partnerId: "par-1",
        categoryId: null,
        categorySchemaId: null,
        status: "DRAFT",
      }),
    },
    productMedia: {
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: null } }),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: "m1",
        type: "IMAGE",
        mimeType: "image/jpeg",
        size: 4,
        width: 100,
        height: 80,
        sortOrder: 0,
        isPrimary: true,
        caption: null,
        altText: null,
        status: "DRAFT",
        originalFileName: "a.jpg",
        createdAt: new Date(),
      }),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    moderationSubmission: { count: jest.fn().mockResolvedValue(0) },
    categorySchema: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null) },
    productHistory: { create: jest.fn().mockResolvedValue(undefined) },
    $transaction: jest.fn(),
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  Object.assign(prisma, overrides);
  return prisma;
}

describe("ProductMediaService — atomicity & RBAC (unit)", () => {
  it("21. storage failure не создаёт DB record (cleanup best-effort вызывается)", async () => {
    const storage = makeStorageStub();
    storage.putObject.mockRejectedValueOnce(new Error("storage down"));
    const prisma = makePrismaStub();
    const service = new ProductMediaService(prisma as never, storage, makeProcessorStub(), new CatalogAccessPolicy());

    await expect(
      service.uploadMedia("prod-1", [{ originalname: "a.jpg", mimetype: "image/jpeg", size: 4, buffer: Buffer.from("x") }], PARTNER),
    ).rejects.toThrow("Storage unavailable");
    // DB record НЕ создаётся при storage failure.
    expect(prisma.productMedia.create).not.toHaveBeenCalled();
    // Cleanup вызывается для зарегистрированных ключей (best-effort, idempotent):
    // deleteObject на несуществующем объекте — no-op, но ни один ключ не осиротеет,
    // если часть записи успела пройти до падения.
    expect(storage.deleteObject).toHaveBeenCalledTimes(3);
  });

  it("22b. concurrent primary-conflict (P2002 от partial unique index) → управляемый 409 + cleanup", async () => {
    const storage = makeStorageStub();
    const prisma = makePrismaStub();
    // Два concurrent first-upload'а на пустой продукт: второй проигрывает на
    // DB-level partial unique index (Prisma P2002 / Postgres 23505).
    const p2002 = Object.assign(new Error("Unique constraint failed on the constraint: `ProductMedia_one_primary_per_product`"), {
      code: "P2002",
    });
    prisma.productMedia.create.mockRejectedValueOnce(p2002);
    const service = new ProductMediaService(prisma as never, storage, makeProcessorStub(), new CatalogAccessPolicy());

    await expect(
      service.uploadMedia("prod-1", [{ originalname: "a.jpg", mimetype: "image/jpeg", size: 4, buffer: Buffer.from("x") }], PARTNER),
    ).rejects.toThrow("Primary media conflict");
    // Проигравший upload: записанные объекты очищаются, DB-записи нет.
    expect(storage.deleteObject).toHaveBeenCalledTimes(3);
    expect(prisma.productMedia.create).toHaveBeenCalledTimes(1);
  });

  it("22. DB failure после storage write → compensating cleanup объектов", async () => {
    const storage = makeStorageStub();
    const prisma = makePrismaStub();
    // productMedia.create падает после того, как объекты записаны в storage.
    prisma.productMedia.create.mockRejectedValueOnce(new Error("db constraint"));
    const service = new ProductMediaService(prisma as never, storage, makeProcessorStub(), new CatalogAccessPolicy());

    await expect(
      service.uploadMedia("prod-1", [{ originalname: "a.jpg", mimetype: "image/jpeg", size: 4, buffer: Buffer.from("x") }], PARTNER),
    ).rejects.toThrow("db constraint");

    // 3 объекта записаны и затем удалены (cleanup).
    expect(storage.putObject).toHaveBeenCalledTimes(3);
    expect(storage.deleteObject).toHaveBeenCalledTimes(3);
    // Удаляются именно записанные ключи.
    const putKeys = storage.putObject.mock.calls.map((c) => c[0].key);
    const delKeys = storage.deleteObject.mock.calls.map((c) => c[0]);
    expect(new Set(delKeys)).toEqual(new Set(putKeys));
  });

  it("18. PARTNER не управляет media чужого Product (403)", async () => {
    const storage = makeStorageStub();
    const prisma = makePrismaStub();
    // Чужой продукт: partnerId = "par-2".
    prisma.product.findUnique.mockResolvedValue({ id: "prod-9", code: "PRD-00000009", partnerId: "par-2", categoryId: null, categorySchemaId: null });
    const service = new ProductMediaService(prisma as never, storage, makeProcessorStub(), new CatalogAccessPolicy());

    await expect(
      service.uploadMedia("prod-9", [{ originalname: "a.jpg", mimetype: "image/jpeg", size: 4, buffer: Buffer.from("x") }], PARTNER),
    ).rejects.toThrow(ForbiddenException);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("ADMIN может управлять media любого Product", async () => {
    const storage = makeStorageStub();
    const prisma = makePrismaStub();
    prisma.product.findUnique.mockResolvedValue({ id: "prod-9", code: "PRD-00000009", partnerId: "par-2", categoryId: null, categorySchemaId: null });
    const service = new ProductMediaService(prisma as never, storage, makeProcessorStub(), new CatalogAccessPolicy());

    await service.uploadMedia("prod-9", [{ originalname: "a.jpg", mimetype: "image/jpeg", size: 4, buffer: Buffer.from("x") }], ADMIN);
    expect(storage.putObject).toHaveBeenCalledTimes(3);
  });

  it("FIX1d-unit. PARTNER не может прямо мутировать PUBLISHED media живого продукта (409)", async () => {
    const storage = makeStorageStub();
    const prisma = makePrismaStub();
    // Живой продукт (PUBLISHED) с PUBLISHED media.
    prisma.product.findUnique.mockResolvedValue({
      id: "prod-1",
      code: "PRD-00000001",
      partnerId: "par-1",
      categoryId: null,
      categorySchemaId: null,
      status: "PUBLISHED",
    });
    prisma.productMedia.findFirst.mockResolvedValue({
      id: "m1",
      isPrimary: true,
      originalStorageKey: "k1",
      largeStorageKey: "k2",
      thumbnailStorageKey: "k3",
      status: "PUBLISHED",
    });
    const service = new ProductMediaService(prisma as never, storage, makeProcessorStub(), new CatalogAccessPolicy());

    // delete PUBLISHED media → 409 (re-moderation required), объекты НЕ удаляются.
    await expect(service.deleteMedia("prod-1", "m1", PARTNER)).rejects.toThrow(ConflictError);
    expect(storage.deleteObject).not.toHaveBeenCalled();
    // set-primary PUBLISHED media → 409.
    await expect(service.setPrimary("prod-1", "m1", PARTNER)).rejects.toThrow(ConflictError);
    // reorder с PUBLISHED media → 409.
    prisma.productMedia.findMany.mockResolvedValue([{ id: "m1", status: "PUBLISHED" }]);
    await expect(service.reorder("prod-1", ["m1"], PARTNER)).rejects.toThrow(ConflictError);
    // updateMedia caption PUBLISHED media → 409.
    await expect(service.updateMedia("prod-1", "m1", { caption: "x" }, PARTNER)).rejects.toThrow(ConflictError);

    // ADMIN сохраняет полный lifecycle (не блокируется guard'ом).
    prisma.productMedia.update.mockResolvedValue({
      id: "m1",
      type: "IMAGE",
      mimeType: "image/jpeg",
      size: 4,
      width: 100,
      height: 80,
      sortOrder: 0,
      isPrimary: true,
      caption: null,
      altText: null,
      status: "PUBLISHED",
      originalFileName: "a.jpg",
      createdAt: new Date(),
    });
    await expect(service.updateMedia("prod-1", "m1", { caption: "x" }, ADMIN)).resolves.toBeTruthy();
  });

  it("14b-step1.4. media write заморожен при активной moderation submission (409); ADMIN — разрешён", async () => {
    const storage = makeStorageStub();
    const prisma = makePrismaStub();
    prisma.product.findUnique.mockResolvedValue({
      id: "prod-1",
      code: "PRD-00000001",
      partnerId: "par-1",
      categoryId: null,
      categorySchemaId: null,
      status: "COMPLETE", // submitted — media заморожена до решения
    });
    prisma.moderationSubmission.count.mockResolvedValue(1); // активная submission
    const service = new ProductMediaService(prisma as never, storage, makeProcessorStub(), new CatalogAccessPolicy());

    // PARTNER не может менять media проверяемой версии (upload тоже).
    await expect(
      service.uploadMedia("prod-1", [{ originalname: "a.jpg", mimetype: "image/jpeg", size: 4, buffer: Buffer.from("x") }], PARTNER),
    ).rejects.toThrow(ConflictError);
    expect(storage.putObject).not.toHaveBeenCalled();

    // ADMIN — полный lifecycle (freeze только для PARTNER).
    await expect(
      service.uploadMedia("prod-1", [{ originalname: "a.jpg", mimetype: "image/jpeg", size: 4, buffer: Buffer.from("x") }], ADMIN),
    ).resolves.toBeTruthy();
  });

  it("15. delete primary назначает следующий по sortOrder (правило в транзакции)", async () => {
    const storage = makeStorageStub();
    const prisma = makePrismaStub();
    prisma.product.findUnique.mockResolvedValue({ id: "prod-1", code: "PRD-00000001", partnerId: "par-1", categoryId: null, categorySchemaId: null });
    prisma.productMedia.findFirst
      .mockResolvedValueOnce({ id: "m1", isPrimary: true, originalStorageKey: "k1", largeStorageKey: "k2", thumbnailStorageKey: "k3" }) // delete target
      .mockResolvedValueOnce({ id: "m2" }); // следующий по sortOrder
    const service = new ProductMediaService(prisma as never, storage, makeProcessorStub(), new CatalogAccessPolicy());

    await service.deleteMedia("prod-1", "m1", PARTNER);
    // В транзакции после delete назначается primary на m2 (findFirst с orderBy sortOrder).
    expect(storage.deleteObject).toHaveBeenCalledWith("k1");
    expect(storage.deleteObject).toHaveBeenCalledWith("k2");
    expect(storage.deleteObject).toHaveBeenCalledWith("k3");
  });
});
