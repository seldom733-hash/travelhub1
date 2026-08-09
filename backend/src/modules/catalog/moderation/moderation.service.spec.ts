import { ForbiddenException } from "@nestjs/common";
import { RoleCode, ModerationSubmissionStatus } from "../../../generated/prisma/enums";
import { ModerationService } from "./moderation.service";
import { CatalogAccessPolicy } from "../catalog-access.policy";
import type { CatalogService } from "../catalog.service";
import type { SecurityService } from "../../../security/security.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../../shared/errors";
import type { AuthUser } from "../../../security/auth/auth.service";
import type { PrismaService } from "../../../prisma/prisma.service";
import { AntiDisintermediationService } from "../anti-disintermediation/anti-disintermediation.service";

const MODERATOR: AuthUser = {
  id: "u-mod",
  code: "USR-00000011",
  username: "moderator1",
  email: null,
  fullName: null,
  status: "ACTIVE",
  role: RoleCode.MODERATOR,
  roleTitle: "Модератор",
  partnerId: null,
  customerId: null,
  permissions: [
    "catalog.product.read_for_moderation",
    "catalog.media.read_for_moderation",
    "moderation.review",
    "moderation.approve",
    "moderation.reject",
    "moderation.request_changes",
  ],
};

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
  permissions: ["catalog.product.submit_moderation", "catalog.product.update_own_draft", "catalog.product.read_own"],
};

// Партнёр, которому (много-ролевая атака) выдали права модератора: actor.partnerId == product.partnerId.
const PARTNER_WITH_MODERATION: AuthUser = { ...PARTNER, permissions: [...PARTNER.permissions, ...MODERATOR.permissions] };

const PRODUCT_ROW = {
  id: "prod-1",
  code: "PRD-00000001",
  type: "TOUR",
  title: "Tour",
  slug: "tour-1",
  description: null,
  version: 3,
  status: "DRAFT",
  categoryId: "cat-1",
  categorySchemaId: "sch-1",
  attributes: { days: 3 },
  partnerId: "par-1",
};

const PRODUCT_FULL = {
  ...PRODUCT_ROW,
  category: { slug: "tours" },
  tariffs: [{ id: "t1", name: "S", price: "100", currency: "USD", validFrom: null, validTo: null }],
  availability: [],
  media: [
    {
      id: "m1",
      type: "IMAGE",
      mimeType: "image/jpeg",
      size: 1024,
      width: 400,
      height: 300,
      sortOrder: 0,
      isPrimary: true,
      caption: null,
      altText: null,
      status: "DRAFT",
      originalFileName: "a.jpg",
    },
  ],
};

const SUBMISSION_ROW = {
  id: "sub-1",
  productId: "prod-1",
  productVersion: 3,
  draftVersion: null,
  submittedById: "u-partner",
  submittedByUsername: "partner1",
  submittedAt: new Date(),
  status: "SUBMITTED" as ModerationSubmissionStatus,
  assignedModeratorId: null,
  assignedModeratorUsername: null,
  reviewStartedAt: null,
  decidedAt: null,
  reasonCode: null,
  comment: null,
  previousSubmissionId: null,
  snapshot: {},
  product: { code: "PRD-00000001", title: "Tour" },
};

type AnyFn = (...args: never[]) => unknown;

interface PrismaStub {
  product: { findUnique: jest.Mock };
  moderationSubmission: {
    count: jest.Mock;
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
    updateMany: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
}

function makePrismaStub(overrides?: Record<string, unknown>): PrismaStub {
  const prisma: PrismaStub = {
    product: { findUnique: jest.fn().mockResolvedValue(PRODUCT_ROW) },
    moderationSubmission: {
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(SUBMISSION_ROW),
      findUniqueOrThrow: jest.fn().mockResolvedValue(SUBMISSION_ROW),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(SUBMISSION_ROW),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue(SUBMISSION_ROW),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  Object.assign(prisma, overrides);
  return prisma;
}

function makeCatalogStub() {
  return {
    lockProductForModeration: jest.fn().mockResolvedValue({ product: { id: "prod-1", status: "COMPLETE", version: 3 }, skipped: false }),
    releaseProductForModeration: jest.fn().mockResolvedValue(undefined),
    publishAfterModerationApproval: jest.fn().mockResolvedValue({ product: { id: "prod-1", code: "PRD-00000001", title: "Tour", slug: "tour-1", status: "PUBLISHED", version: 4 } }),
    publishPendingEvents: jest.fn().mockResolvedValue(undefined),
  } as unknown as CatalogService;
}

function makeSecurityStub() {
  return { audit: jest.fn().mockResolvedValue(undefined) } as unknown as SecurityService;
}

function makeService(prisma: PrismaStub, catalog: CatalogService, security: SecurityService) {
  return new ModerationService(prisma as never, catalog, new CatalogAccessPolicy(), security, new AntiDisintermediationService());
}

describe("ModerationService (Phase 1 Step 1.4) — unit", () => {
  it("submit: PARTNER создаёт submission со snapshot (immutable, без storage keys)", async () => {
    const prisma = makePrismaStub();
    const catalog = makeCatalogStub();
    const security = makeSecurityStub();
    // findUnique вызывается в tx трижды: contentToScan (Step 1.11 scan), затем
    // lockProductForModeration, затем buildSnapshot (category/tariffs/availability/media).
    prisma.product.findUnique
      .mockResolvedValueOnce(PRODUCT_ROW)
      .mockResolvedValueOnce(PRODUCT_FULL)
      .mockResolvedValueOnce(PRODUCT_FULL);
    const service = makeService(prisma, catalog, security);

    const view = await service.submit("prod-1", PARTNER);

    expect(view.status).toBe("SUBMITTED");
    expect(view.productVersion).toBe(3);
    expect(catalog.lockProductForModeration).toHaveBeenCalled();
    // Snapshot содержит проверяемые поля + media metadata, БЕЗ storage secrets.
    const snapshot = view.snapshot as unknown as Record<string, unknown>;
    expect((snapshot.product as Record<string, unknown>).version).toBe(3);
    expect((snapshot.media as Array<Record<string, unknown>>)[0].id).toBe("m1");
    expect((snapshot.media as Array<Record<string, unknown>>)[0].status).toBe("DRAFT");
    expect(JSON.stringify(snapshot)).not.toContain("originalStorageKey");
    expect(JSON.stringify(snapshot)).not.toContain("storageKey");
    expect(security.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "moderation.submitted" }));
  });

  it("submit: чужой Product → Forbidden (object scope)", async () => {
    const prisma = makePrismaStub();
    prisma.product.findUnique.mockResolvedValue({ ...PRODUCT_ROW, partnerId: "par-2" });
    const service = makeService(prisma, makeCatalogStub(), makeSecurityStub());

    await expect(service.submit("prod-9", PARTNER)).rejects.toThrow(ForbiddenException);
    expect(prisma.moderationSubmission.create).not.toHaveBeenCalled();
  });

  it("submit: повторный submit при активной submission → Conflict (409)", async () => {
    const prisma = makePrismaStub();
    prisma.moderationSubmission.count.mockResolvedValue(1);
    const service = makeService(prisma, makeCatalogStub(), makeSecurityStub());

    await expect(service.submit("prod-1", PARTNER)).rejects.toThrow(ConflictError);
  });

  it("submit: ARCHIVED Product нельзя submit (409)", async () => {
    const prisma = makePrismaStub();
    prisma.product.findUnique.mockResolvedValue({ ...PRODUCT_ROW, status: "ARCHIVED" });
    const service = makeService(prisma, makeCatalogStub(), makeSecurityStub());

    await expect(service.submit("prod-1", PARTNER)).rejects.toThrow(ConflictError);
  });

  it("reject: невалидный reasonCode → ValidationDomainError; OTHER требует comment", async () => {
    const prisma = makePrismaStub();
    const service = makeService(prisma, makeCatalogStub(), makeSecurityStub());

    await expect(service.reject("sub-1", MODERATOR, "NOT_A_CODE")).rejects.toThrow(ValidationDomainError);
    await expect(service.reject("sub-1", MODERATOR, "OTHER")).rejects.toThrow(ValidationDomainError);
    await expect(service.reject("sub-1", MODERATOR, "OTHER", "  ")).rejects.toThrow(ValidationDomainError);
  });

  it("reject: валидный reasonCode фиксирует решение + release product (history)", async () => {
    const prisma = makePrismaStub();
    const rejectedRow = {
      ...SUBMISSION_ROW,
      status: "REJECTED" as ModerationSubmissionStatus,
      decidedAt: new Date(),
      reasonCode: "INCOMPLETE_CONTENT",
      comment: "нет фото",
    };
    prisma.moderationSubmission.updateMany.mockResolvedValue({ count: 1 });
    prisma.moderationSubmission.findUniqueOrThrow.mockResolvedValue(rejectedRow);
    const catalog = makeCatalogStub();
    const security = makeSecurityStub();
    const service = makeService(prisma, catalog, security);

    const view = await service.reject("sub-1", MODERATOR, "INCOMPLETE_CONTENT", "нет фото");

    expect(view.status).toBe("REJECTED");
    expect(view.reasonCode).toBe("INCOMPLETE_CONTENT");
    expect(catalog.releaseProductForModeration).toHaveBeenCalledWith(
      expect.anything(),
      "prod-1",
      MODERATOR,
      "sub-1",
      "moderation.rejected",
      "нет фото",
    );
    expect(security.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "moderation.rejected" }));
  });

  it("approve: self-moderation запрещена (actor.partnerId == product.partnerId) → Forbidden", async () => {
    const prisma = makePrismaStub();
    prisma.moderationSubmission.updateMany.mockResolvedValue({ count: 1 });
    // Актор = партнёр с правами модератора (много-ролевая атака), продукт его собственный.
    const service = makeService(prisma, makeCatalogStub(), makeSecurityStub());

    await expect(service.approve("sub-1", PARTNER_WITH_MODERATION)).rejects.toThrow(ForbiddenException);
    // publish НЕ вызван — решение заблокировано до эффекта.
    const catalog = (service as unknown as { catalog: ReturnType<typeof makeCatalogStub> }).catalog;
    expect(catalog.publishAfterModerationApproval).not.toHaveBeenCalled();
  });

  it("approve: stale submission/version → Conflict (проверяемая версия изменилась)", async () => {
    const prisma = makePrismaStub();
    prisma.moderationSubmission.updateMany.mockResolvedValue({ count: 1 });
    // Live-версия продукта 5 != проверяемая версия 3 → нельзя опубликовать чужую версию.
    prisma.product.findUnique.mockResolvedValue({ id: "prod-1", partnerId: "par-1", version: 5, draft: null });
    const catalog = makeCatalogStub();
    const service = makeService(prisma, catalog, makeSecurityStub());

    await expect(service.approve("sub-1", MODERATOR)).rejects.toThrow(ConflictError);
    expect(catalog.publishAfterModerationApproval).not.toHaveBeenCalled();
  });

  it("approve: change proposal — draft revision изменилась после submit → Conflict (нельзя silent-edit)", async () => {
    const prisma = makePrismaStub();
    prisma.moderationSubmission.updateMany.mockResolvedValue({ count: 1 });
    // Change proposal: submission проверяла draft v2, live v3 сейчас — draft v5 (PARTNER правил после submit).
    prisma.moderationSubmission.findUnique.mockResolvedValue({ ...SUBMISSION_ROW, productVersion: 3, draftVersion: 2 });
    prisma.product.findUnique.mockResolvedValue({ id: "prod-1", partnerId: "par-1", version: 3, draft: { version: 5 } });
    const catalog = makeCatalogStub();
    const service = makeService(prisma, catalog, makeSecurityStub());

    await expect(service.approve("sub-1", MODERATOR)).rejects.toThrow(ConflictError);
    expect(catalog.publishAfterModerationApproval).not.toHaveBeenCalled();
  });

  it("approve: change proposal — draft revision совпадает → approve вызывает controlled publish", async () => {
    const prisma = makePrismaStub();
    prisma.moderationSubmission.updateMany.mockResolvedValue({ count: 1 });
    prisma.moderationSubmission.findUnique.mockResolvedValue({ ...SUBMISSION_ROW, productVersion: 3, draftVersion: 4 });
    prisma.product.findUnique.mockResolvedValue({ id: "prod-1", partnerId: "par-1", version: 3, draft: { version: 4 } });
    const approvedRow = { ...SUBMISSION_ROW, status: "APPROVED" as ModerationSubmissionStatus };
    prisma.moderationSubmission.findUniqueOrThrow.mockResolvedValue(approvedRow);
    const catalog = makeCatalogStub();
    const service = makeService(prisma, catalog, makeSecurityStub());

    const view = await service.approve("sub-1", MODERATOR);
    expect(view.status).toBe("APPROVED");
    expect(catalog.publishAfterModerationApproval).toHaveBeenCalled();
  });

  it("approve: idempotent retry (уже APPROVED) не создаёт второй publish", async () => {
    const prisma = makePrismaStub();
    prisma.moderationSubmission.findUnique.mockResolvedValue({
      ...SUBMISSION_ROW,
      status: "APPROVED" as ModerationSubmissionStatus,
      decidedAt: new Date(),
      assignedModeratorId: "u-mod",
      assignedModeratorUsername: "moderator1",
    });
    const catalog = makeCatalogStub();
    const service = makeService(prisma, catalog, makeSecurityStub());

    const view = await service.approve("sub-1", MODERATOR);
    expect(view.status).toBe("APPROVED");
    // Без повторного publish / повторного эффекта.
    expect(catalog.publishAfterModerationApproval).not.toHaveBeenCalled();
    expect(prisma.moderationSubmission.updateMany).not.toHaveBeenCalled();
  });

  it("concurrency: проигравший CAS (approve vs reject) получает Conflict, эффект один", async () => {
    const prisma = makePrismaStub();
    // Проигравший: updateMany не обновил строку (0), строка уже REJECTED.
    prisma.moderationSubmission.updateMany.mockResolvedValue({ count: 0 });
    prisma.moderationSubmission.findUnique
      .mockResolvedValueOnce(SUBMISSION_ROW) // первое чтение
      .mockResolvedValueOnce({ ...SUBMISSION_ROW, status: "REJECTED" as ModerationSubmissionStatus }); // re-read после CAS-проигрыша
    const catalog = makeCatalogStub();
    const service = makeService(prisma, catalog, makeSecurityStub());

    await expect(service.approve("sub-1", MODERATOR)).rejects.toThrow(ConflictError);
    // Бизнес-эффект (publish/release) НЕ выполнялся проигравшим.
    expect(catalog.publishAfterModerationApproval).not.toHaveBeenCalled();
    expect(catalog.releaseProductForModeration).not.toHaveBeenCalled();
  });

  it("concurrency: double-approve — второй CAS-победитель видит APPROVED и возвращает результат без второго publish", async () => {
    const prisma = makePrismaStub();
    // Второй конкурент: updateMany вернул 0 (первый уже закоммитил APPROVED),
    // повторное чтение показывает APPROVED → idempotent результат.
    const approvedRow = { ...SUBMISSION_ROW, status: "APPROVED" as ModerationSubmissionStatus };
    prisma.moderationSubmission.updateMany.mockResolvedValue({ count: 0 });
    prisma.moderationSubmission.findUnique.mockResolvedValueOnce(SUBMISSION_ROW).mockResolvedValueOnce(approvedRow);
    prisma.moderationSubmission.findUniqueOrThrow.mockResolvedValue(approvedRow);
    const catalog = makeCatalogStub();
    const service = makeService(prisma, catalog, makeSecurityStub());

    const view = await service.approve("sub-1", MODERATOR);
    expect(view.status).toBe("APPROVED");
    expect(catalog.publishAfterModerationApproval).not.toHaveBeenCalled();
  });

  it("approve: NOT_FOUND submission → NotFound", async () => {
    const prisma = makePrismaStub();
    prisma.moderationSubmission.findUnique.mockResolvedValue(null);
    const service = makeService(prisma, makeCatalogStub(), makeSecurityStub());

    await expect(service.approve("missing", MODERATOR)).rejects.toThrow(NotFoundError);
  });

  it("startReview: второй модератор не перехватывает активный review (Conflict)", async () => {
    const prisma = makePrismaStub();
    prisma.moderationSubmission.findUnique.mockResolvedValue({
      ...SUBMISSION_ROW,
      status: "IN_REVIEW" as ModerationSubmissionStatus,
      assignedModeratorId: "u-mod-2",
      assignedModeratorUsername: "moderator2",
    });
    const service = makeService(prisma, makeCatalogStub(), makeSecurityStub());

    await expect(service.startReview("sub-1", MODERATOR)).rejects.toThrow(ConflictError);
  });

  it("queue: PARTNER не видит очередь (guard'ы), list фильтрует по статусу/партнёру/категории", async () => {
    const prisma = makePrismaStub();
    const service = makeService(prisma, makeCatalogStub(), makeSecurityStub());

    await service.list({ status: "SUBMITTED", partnerId: "par-1", categoryId: "cat-1", page: 1, pageSize: 20 });
    expect(prisma.moderationSubmission.findMany).toHaveBeenCalled();
    const where = (prisma.moderationSubmission.findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where;
    expect(where.status).toBe("SUBMITTED");
    expect((where.product as Record<string, unknown>).partnerId).toBe("par-1");
    expect((where.product as Record<string, unknown>).categoryId).toBe("cat-1");
    // PARTNER не имеет moderation.review — доступ закрыт на уровне guard (unit: assertCanRead не даёт queue).
    expect(PARTNER.permissions).not.toContain("moderation.review");
  });
});
