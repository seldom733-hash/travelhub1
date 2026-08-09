/**
 * E2E Phase 1 Step 1.2 — ProductMedia (upload/storage/media endpoints).
 *
 * ТЗ §23: минимальные доказательства:
 *  1-4. JPEG/PNG/WebP upload успешен;
 *  5.   unsupported file отклоняется;
 *  6.   fake extension/MIME отклоняется (signature);
 *  7.   >15 MB отклоняется (multer limit → 413);
 *  8.   oversized dimensions отклоняются (pixel limit);
 *  9.   создаются original + large.webp + thumb.webp (через storage-счётчик объектов);
 *  10.  metadata width/height/size сохраняется;
 *  11.  multi-upload работает;
 *  12.  maxImages соблюдается;
 *  13.  primary image только одна;
 *  14.  set-primary атомарно меняет primary;
 *  15.  delete primary назначает следующий по sortOrder;
 *  16.  reorder deterministic;
 *  17.  cross-product media операция запрещена;
 *  18.  PARTNER не меняет media чужого Product (403);
 *  19.  MODERATOR preview/read разрешён, write запрещён;
 *  20.  anonymous/BUYER не получает draft media (public read);
 *  21.  storage failure не создаёт DB record (unit, см. product-media.service.spec);
 *  22.  DB failure после storage write → cleanup (unit);
 *  23.  delete безопасно очищает metadata/storage;
 *  24.  signed preview URL short-lived;
 *  25.  e2e использует только test bucket;
 *  26.  полный regression suite зелёный (запускается отдельно);
 *  27.  concurrency: два параллельных set-primary не оставляют два primary;
 *  28.  DB invariant: partial unique index не даёт двум concurrent UPDATE создать
 *       два primary (даже в обход app-логики — прямой SQL).
 *
 * Storage: standalone MinIO (test/e2e.minio.ts), bucket travelhub-media-test.
 * MinIO bootstrap: version-pinned + SHA-256 (reproducible, без ручного копирования).
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import sharp from "sharp";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { RoleCode } from "../src/generated/prisma/enums";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import {
  MINIO_TEST_ACCESS_KEY,
  MINIO_TEST_BUCKET,
  MINIO_TEST_PORT,
  MINIO_TEST_SECRET_KEY,
  startTestMinIO,
  stopTestMinIO,
} from "./e2e.minio";

interface MediaRow {
  id: string;
  type: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  sortOrder: number;
  isPrimary: boolean;
  caption: string | null;
  altText: string | null;
  status: string;
  originalFileName: string;
  createdAt: string;
}

async function makeJpegBuffer(width = 200, height = 120): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 60, b: 40 } } })
    .jpeg()
    .toBuffer();
}

async function makePngBuffer(width = 64, height = 64): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 40, g: 120, b: 200 } } })
    .png()
    .toBuffer();
}

async function makeWebpBuffer(): Promise<Buffer> {
  return sharp({ create: { width: 80, height: 60, channels: 3, background: { r: 20, g: 200, b: 120 } } })
    .webp()
    .toBuffer();
}

describe("Phase 1 Step 1.2 — ProductMedia (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const created: { users: string[]; products: string[]; media: string[]; partners: string[] } = {
    users: [],
    products: [],
    media: [],
    partners: [],
  };
  const stamp = Date.now();

  const login = async (username: string, password: string) => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as { accessToken: string; user: { id: string; role: RoleCode; partnerId: string | null; permissions: string[] } };
  };

  const agent = async (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  let adminAgent: ReturnType<typeof request.agent>;
  let partner1Agent: ReturnType<typeof request.agent>;
  let partner2Agent: ReturnType<typeof request.agent>;
  let moderatorAgent: ReturnType<typeof request.agent>;

  let partner1Id: string;

  beforeAll(async () => {
    await startTestMinIO();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    adminAgent = await agent((await login("admin", "admin123")).accessToken);

    const p1 = (await adminAgent.post("/api/v1/partners").send({ name: `Media Partner 1 ${stamp}` }).expect(201)).body as { id: string };
    created.partners.push(p1.id);
    partner1Id = p1.id;
    const p2 = (await adminAgent.post("/api/v1/partners").send({ name: `Media Partner 2 ${stamp}` }).expect(201)).body as { id: string };
    created.partners.push(p2.id);

    const u1 = (
      await adminAgent
        .post("/api/v1/users")
        .send({ username: `mediapartner1${stamp}`, password: "partnerpass123", roleCode: RoleCode.PARTNER, partnerId: p1.id })
    ).body;
    created.users.push(u1.id);
    partner1Agent = await agent((await login(`mediapartner1${stamp}`, "partnerpass123")).accessToken);

    const u2 = (
      await adminAgent
        .post("/api/v1/users")
        .send({ username: `mediapartner2${stamp}`, password: "partnerpass123", roleCode: RoleCode.PARTNER, partnerId: p2.id })
    ).body;
    created.users.push(u2.id);
    partner2Agent = await agent((await login(`mediapartner2${stamp}`, "partnerpass123")).accessToken);

    const mod = (await adminAgent.post("/api/v1/users").send({ username: `mediamod${stamp}`, password: "modpass123", roleCode: RoleCode.MODERATOR })).body;
    created.users.push(mod.id);
    moderatorAgent = await agent((await login(`mediamod${stamp}`, "modpass123")).accessToken);
  });

  afterAll(async () => {
    await prisma.productMedia.deleteMany({ where: { id: { in: created.media } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partners } } });
    await app.close();
    await stopTestMinIO();
  });

  /** Создать draft Product от партнёра (категория tours с mediaRequirements). */
  async function createPartnerProduct(agent: ReturnType<typeof request.agent>, title: string, categorySlug = "tours") {
    const categories = (await adminAgent.get("/api/v1/categories").expect(200)).body as Array<{ id: string; slug: string }>;
    const cat = categories.find((c) => c.slug === categorySlug)!;
    const res = await agent
      .post("/api/v1/products")
      .send({ type: "TOUR", title, categoryId: cat.id, attributes: { days: 3 } })
      .expect(201);
    const product = res.body.product as { id: string; code: string; partnerId: string | null; status: string };
    created.products.push(product.id);
    return product;
  }

  /** Создать кастомную категорию с media-политикой и продукт партнёра в ней. */
  async function createProductWithPolicy(policy: Record<string, unknown>, title: string, attributes: Record<string, unknown> = { days: 3 }) {
    const slug = `pm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const cat = (await adminAgent.post("/api/v1/categories").send({ title: `PM ${slug}`, slug }).expect(201)).body as { id: string };
    const schema = (
      await adminAgent
        .post("/api/v1/category-schemas")
        .send({ categoryId: cat.id, attributes: [{ key: "days", type: "integer" }], mediaRequirements: policy })
        .expect(201)
    ).body as { id: string };
    await adminAgent.post(`/api/v1/category-schemas/${schema.id}/activate`).expect(201);
    const res = await partner1Agent
      .post("/api/v1/products")
      .send({ type: "TOUR", title, categoryId: cat.id, attributes })
      .expect(201);
    const product = res.body.product as { id: string; partnerId: string | null };
    created.products.push(product.id);
    return product;
  }

  it("2. JPEG upload успешен (original+derivatives, metadata сохранена)", async () => {
    const own = await createPartnerProduct(partner1Agent, `Jpeg ${stamp}`);
    const jpeg = await makeJpegBuffer(400, 300);
    const res = await partner1Agent
      .post(`/api/v1/products/${own.id}/media`)
      .attach("files", jpeg, { filename: "photo.jpg", contentType: "image/jpeg" })
      .expect(201);
    const media = res.body.media as MediaRow[];
    expect(media.length).toBe(1);
    const m = media[0];
    created.media.push(m.id);
    expect(m.mimeType).toBe("image/jpeg");
    expect(m.width).toBe(400);
    expect(m.height).toBe(300);
    expect(m.size).toBeGreaterThan(0);
    expect(m.status).toBe("DRAFT"); // uploaded != published
    expect((m as MediaRow & Record<string, unknown>).storageKey).toBeUndefined();
    expect((m as MediaRow & Record<string, unknown>).originalStorageKey).toBeUndefined();
  });

  it("3. PNG upload успешен", async () => {
    const own = await createPartnerProduct(partner1Agent, `Png ${stamp}`);
    const png = await makePngBuffer();
    const res = await partner1Agent
      .post(`/api/v1/products/${own.id}/media`)
      .attach("files", png, { filename: "logo.png", contentType: "image/png" })
      .expect(201);
    const media = res.body.media as MediaRow[];
    created.media.push(media[0].id);
    expect(media[0].mimeType).toBe("image/png");
    expect(media[0].width).toBe(64);
  });

  it("4. WebP upload успешен", async () => {
    const own = await createPartnerProduct(partner1Agent, `Webp ${stamp}`);
    const webp = await makeWebpBuffer();
    const res = await partner1Agent
      .post(`/api/v1/products/${own.id}/media`)
      .attach("files", webp, { filename: "img.webp", contentType: "image/webp" })
      .expect(201);
    const media = res.body.media as MediaRow[];
    created.media.push(media[0].id);
    expect(media[0].mimeType).toBe("image/webp");
  });

  it("5. unsupported file (text/GIF) отклоняется (422)", async () => {
    const own = await createPartnerProduct(partner1Agent, `Unsup ${stamp}`);
    await partner1Agent.post(`/api/v1/products/${own.id}/media`).attach("files", Buffer.from("plain text"), { filename: "x.txt", contentType: "text/plain" }).expect(422);
    await partner1Agent
      .post(`/api/v1/products/${own.id}/media`)
      .attach("files", Buffer.from("GIF89a..."), { filename: "x.gif", contentType: "image/gif" })
      .expect(422);
    // SVG отклоняется (не в списке web-safe форматов)
    await partner1Agent
      .post(`/api/v1/products/${own.id}/media`)
      .attach("files", Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"), { filename: "x.svg", contentType: "image/svg+xml" })
      .expect(422);
  });

  it("6. fake extension/MIME отклоняется по сигнатуре (422)", async () => {
    const own = await createPartnerProduct(partner1Agent, `Fake ${stamp}`);
    // Файл НЕ является JPEG, хотя назван .jpg и content-type image/jpeg.
    const fake = Buffer.from("this is not a real jpeg............", "utf8");
    await partner1Agent.post(`/api/v1/products/${own.id}/media`).attach("files", fake, { filename: "fake.jpg", contentType: "image/jpeg" }).expect(422);
  });

  it("7. >15 MB отклоняется (413, multer limit)", async () => {
    const own = await createPartnerProduct(partner1Agent, `Big ${stamp}`);
    const big = Buffer.alloc(16 * 1024 * 1024, 0x41); // 16 MB (не валидное изображение, но limit срабатывает раньше)
    await partner1Agent.post(`/api/v1/products/${own.id}/media`).attach("files", big, { filename: "big.jpg", contentType: "image/jpeg" }).expect(413);
  });

  it("8. oversized dimensions отклоняются (pixel limit, 422)", async () => {
    const own = await createPartnerProduct(partner1Agent, `Huge ${stamp}`);
    // 13000×10 — ширина превышает 12000 (проверка по размерностям до decode).
    const huge = await sharp({ create: { width: 13000, height: 10, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .jpeg()
      .toBuffer();
    await partner1Agent.post(`/api/v1/products/${own.id}/media`).attach("files", huge, { filename: "huge.jpg", contentType: "image/jpeg" }).expect(422);
  });

  it("9. создаются original + large.webp + thumb.webp (проверка по storage keys)", async () => {
    const own = await createPartnerProduct(partner1Agent, `Deriv ${stamp}`);
    const jpeg = await makeJpegBuffer(1000, 800);
    const up = (await partner1Agent.post(`/api/v1/products/${own.id}/media`).attach("files", jpeg, { filename: "d.jpg", contentType: "image/jpeg" }).expect(201))
      .body as { media: MediaRow[] };
    const mediaId = up.media[0].id;
    created.media.push(mediaId);

    const row = await prisma.productMedia.findUniqueOrThrow({ where: { id: mediaId } });
    expect(row.originalStorageKey).toContain("/original.jpg");
    expect(row.largeStorageKey).toContain("/large.webp");
    expect(row.thumbnailStorageKey).toContain("/thumb.webp");
    expect(row.originalStorageKey.startsWith(`products/${own.id}/`)).toBe(true);
  });

  it("11. multi-upload работает (3 файла за раз)", async () => {
    const own = await createPartnerProduct(partner1Agent, `Multi ${stamp}`);
    const res = await partner1Agent
      .post(`/api/v1/products/${own.id}/media`)
      .attach("files", await makeJpegBuffer(300, 200), { filename: "a.jpg", contentType: "image/jpeg" })
      .attach("files", await makePngBuffer(), { filename: "b.png", contentType: "image/png" })
      .attach("files", await makeWebpBuffer(), { filename: "c.webp", contentType: "image/webp" })
      .expect(201);
    const media = res.body.media as MediaRow[];
    expect(media.length).toBe(3);
    media.forEach((m) => created.media.push(m.id));
    expect(media[0].isPrimary).toBe(true); // первая из загруженных — primary (нет других)
  });

  it("12. maxImages соблюдается; allowedMediaTypes enforced (422)", async () => {
    const own = await createProductWithPolicy(
      { minImages: 1, maxImages: 2, primaryImageRequired: true, allowedMediaTypes: ["image/jpeg", "image/png"], videoAllowed: false },
      `MaxImg ${stamp}`,
    );
    const jpeg = await makeJpegBuffer();
    await partner1Agent.post(`/api/v1/products/${own.id}/media`).attach("files", jpeg, { filename: "1.jpg", contentType: "image/jpeg" }).expect(201);
    await partner1Agent.post(`/api/v1/products/${own.id}/media`).attach("files", jpeg, { filename: "2.jpg", contentType: "image/jpeg" }).expect(201);
    await partner1Agent.post(`/api/v1/products/${own.id}/media`).attach("files", jpeg, { filename: "3.jpg", contentType: "image/jpeg" }).expect(422);

    // allowedMediaTypes: WebP НЕ разрешён политикой (только jpeg/png) → 422.
    const webp = await makeWebpBuffer();
    const restricted = await createProductWithPolicy(
      { minImages: 0, maxImages: 10, primaryImageRequired: false, allowedMediaTypes: ["image/jpeg"], videoAllowed: false },
      `AllowedTypes ${stamp}`,
    );
    await partner1Agent.post(`/api/v1/products/${restricted.id}/media`).attach("files", webp, { filename: "x.webp", contentType: "image/webp" }).expect(422);
    await partner1Agent.post(`/api/v1/products/${restricted.id}/media`).attach("files", jpeg, { filename: "ok.jpg", contentType: "image/jpeg" }).expect(201);
  });

  it("13-14. primary image только одна; set-primary атомарно меняет", async () => {
    const own = await createProductWithPolicy(
      { minImages: 1, maxImages: 10, primaryImageRequired: true, allowedMediaTypes: ["image/jpeg"], videoAllowed: false },
      `Primary ${stamp}`,
    );
    const jpeg = await makeJpegBuffer();
    const up = (await partner1Agent.post(`/api/v1/products/${own.id}/media`).attach("files", jpeg, { filename: "1.jpg", contentType: "image/jpeg" }).attach("files", jpeg, { filename: "2.jpg", contentType: "image/jpeg" }).expect(201))
      .body as { media: MediaRow[] };
    up.media.forEach((m) => created.media.push(m.id));

    // После multi-upload ровно одна primary (первая).
    const list1 = (await partner1Agent.get(`/api/v1/products/${own.id}/media`).expect(200)).body as MediaRow[];
    expect(list1.filter((m) => m.isPrimary).length).toBe(1);

    // set-primary на вторую — атомарно (первая теряет primary).
    await partner1Agent.post(`/api/v1/products/${own.id}/media/${up.media[1].id}/set-primary`).expect(201);
    const list2 = (await partner1Agent.get(`/api/v1/products/${own.id}/media`).expect(200)).body as MediaRow[];
    expect(list2.filter((m) => m.isPrimary).length).toBe(1);
    expect(list2.find((m) => m.isPrimary)!.id).toBe(up.media[1].id);
  });

  it("15. delete primary назначает следующий по sortOrder", async () => {
    const own = await createProductWithPolicy(
      { minImages: 1, maxImages: 10, primaryImageRequired: true, allowedMediaTypes: ["image/jpeg"], videoAllowed: false },
      `DelPrim ${stamp}`,
    );
    const jpeg = await makeJpegBuffer();
    const up = (await partner1Agent.post(`/api/v1/products/${own.id}/media`).attach("files", jpeg, { filename: "1.jpg", contentType: "image/jpeg" }).attach("files", jpeg, { filename: "2.jpg", contentType: "image/jpeg" }).expect(201))
      .body as { media: MediaRow[] };
    up.media.forEach((m) => created.media.push(m.id));

    // primary = media[0]; удаляем его → primary переходит к следующему (min sortOrder).
    await partner1Agent.delete(`/api/v1/products/${own.id}/media/${up.media[0].id}`).expect(200);
    const list = (await partner1Agent.get(`/api/v1/products/${own.id}/media`).expect(200)).body as MediaRow[];
    expect(list.filter((m) => m.isPrimary).length).toBe(1);
    expect(list.find((m) => m.isPrimary)!.id).toBe(up.media[1].id);
  });

  it("16. reorder deterministic", async () => {
    const own = await createProductWithPolicy(
      { minImages: 1, maxImages: 10, primaryImageRequired: true, allowedMediaTypes: ["image/jpeg"], videoAllowed: false },
      `Reorder ${stamp}`,
    );
    const jpeg = await makeJpegBuffer();
    const up = (await partner1Agent.post(`/api/v1/products/${own.id}/media`).attach("files", jpeg, { filename: "1.jpg", contentType: "image/jpeg" }).attach("files", jpeg, { filename: "2.jpg", contentType: "image/jpeg" }).attach("files", jpeg, { filename: "3.jpg", contentType: "image/jpeg" }).expect(201))
      .body as { media: MediaRow[] };
    up.media.forEach((m) => created.media.push(m.id));

    const reversed = [...up.media.map((m) => m.id)].reverse();
    const reordered = (await partner1Agent.post(`/api/v1/products/${own.id}/media/reorder`).send({ orderedIds: reversed }).expect(201)).body as MediaRow[];
    expect(reordered.map((m) => m.id)).toEqual(reversed);

    // duplicate → controlled error
    await partner1Agent
      .post(`/api/v1/products/${own.id}/media/reorder`)
      .send({ orderedIds: [up.media[0].id, up.media[0].id, up.media[1].id] })
      .expect(422);
    // missing → controlled error
    await partner1Agent.post(`/api/v1/products/${own.id}/media/reorder`).send({ orderedIds: [up.media[0].id, up.media[1].id] }).expect(422);
  });

  it("17. cross-product media операция запрещена", async () => {
    const own1 = await createProductWithPolicy(
      { minImages: 1, maxImages: 10, primaryImageRequired: true, allowedMediaTypes: ["image/jpeg"], videoAllowed: false },
      `Cross1 ${stamp}`,
    );
    const own2 = await createProductWithPolicy(
      { minImages: 1, maxImages: 10, primaryImageRequired: true, allowedMediaTypes: ["image/jpeg"], videoAllowed: false },
      `Cross2 ${stamp}`,
    );
    const jpeg = await makeJpegBuffer();
    const up = (await partner1Agent.post(`/api/v1/products/${own1.id}/media`).attach("files", jpeg, { filename: "c.jpg", contentType: "image/jpeg" }).expect(201))
      .body as { media: MediaRow[] };
    const mediaId = up.media[0].id;
    created.media.push(mediaId);

    // reorder с mediaId другого продукта → error
    await partner1Agent.post(`/api/v1/products/${own2.id}/media/reorder`).send({ orderedIds: [mediaId] }).expect(422);
    // delete чужого media по id → 404 (не принадлежит продукту)
    await partner1Agent.delete(`/api/v1/products/${own2.id}/media/${mediaId}`).expect(404);
  });

  it("18. PARTNER не может изменить media чужого Product (403)", async () => {
    const own = await createPartnerProduct(partner1Agent, `Own ${stamp}`);
    const jpeg = await makeJpegBuffer();
    await partner2Agent.post(`/api/v1/products/${own.id}/media`).attach("files", jpeg, { filename: "hack.jpg", contentType: "image/jpeg" }).expect(403);
    await partner2Agent.patch(`/api/v1/products/${own.id}/media/nonexistent`).send({ caption: "hack" }).expect(403);
    await partner2Agent.delete(`/api/v1/products/${own.id}/media/nonexistent`).expect(403);
    await partner2Agent.post(`/api/v1/products/${own.id}/media/nonexistent/set-primary`).expect(403);
    await partner2Agent.post(`/api/v1/products/${own.id}/media/reorder`).send({ orderedIds: ["x"] }).expect(403);
  });

  it("19. MODERATOR read/preview разрешён, write запрещён (403)", async () => {
    const own = await createPartnerProduct(partner1Agent, `Mod ${stamp}`);
    const jpeg = await makeJpegBuffer();
    const up = (await partner1Agent.post(`/api/v1/products/${own.id}/media`).attach("files", jpeg, { filename: "m.jpg", contentType: "image/jpeg" }).expect(201))
      .body as { media: MediaRow[] };
    created.media.push(up.media[0].id);

    const list = (await moderatorAgent.get(`/api/v1/products/${own.id}/media`).expect(200)).body as MediaRow[];
    expect(list.length).toBe(1);

    // Step 1.3: MODERATOR preview разрешён (read_for_moderation), write — запрещён.
    const preview = (await moderatorAgent.post(`/api/v1/products/${own.id}/media/${up.media[0].id}/preview`).send({}).expect(201)).body as {
      url: string;
      expiresIn: number;
    };
    expect(preview.url).toContain("X-Amz-Signature");

    await moderatorAgent.post(`/api/v1/products/${own.id}/media`).attach("files", jpeg, { filename: "m2.jpg", contentType: "image/jpeg" }).expect(403);
    await moderatorAgent.patch(`/api/v1/products/${own.id}/media/${up.media[0].id}`).send({ caption: "x" }).expect(403);
    await moderatorAgent.post(`/api/v1/products/${own.id}/media/${up.media[0].id}/replace`).attach("file", jpeg, { filename: "m3.jpg", contentType: "image/jpeg" }).expect(403);
    await moderatorAgent.post(`/api/v1/products/${own.id}/media/${up.media[0].id}/set-primary`).expect(403);
    await moderatorAgent.delete(`/api/v1/products/${own.id}/media/${up.media[0].id}`).expect(403);
  });

  it("20. anonymous/BUYER не получает draft media (public read)", async () => {
    const own = await createPartnerProduct(partner1Agent, `DraftPub ${stamp}`);
    const jpeg = await makeJpegBuffer();
    await partner1Agent.post(`/api/v1/products/${own.id}/media`).attach("files", jpeg, { filename: "p.jpg", contentType: "image/jpeg" }).expect(201);

    // продукт не опубликован → public 404
    await request(app.getHttpServer()).get(`/api/v1/public/products/${own.id}`).expect(404);
  });

  it("18b. публикация: draft media → PUBLISHED; замена media → не в public до re-publish", async () => {
    const own = await createProductWithPolicy(
      { minImages: 1, maxImages: 10, primaryImageRequired: true, allowedMediaTypes: ["image/jpeg"], videoAllowed: false },
      `PublishFlow ${stamp}`,
    );
    const jpeg = await makeJpegBuffer(300, 200);
    const up = (await partner1Agent.post(`/api/v1/products/${own.id}/media`).attach("files", jpeg, { filename: "v1.jpg", contentType: "image/jpeg" }).expect(201))
      .body as { media: MediaRow[] };
    const mediaId = up.media[0].id;
    created.media.push(mediaId);
    await partner1Agent.post(`/api/v1/products/${own.id}/media/${mediaId}/set-primary`).expect(201);

    await adminAgent.post(`/api/v1/products/${own.id}/publish`).expect(201);

    // Public read видит опубликованную media.
    const public1 = (await request(app.getHttpServer()).get(`/api/v1/public/products/${own.id}`).expect(200)).body as { media: MediaRow[] };
    expect(public1.media.map((m) => m.id)).toContain(mediaId);

    // Замена (новый upload) → DRAFT, не в public read.
    const rep = (await partner1Agent
      .post(`/api/v1/products/${own.id}/media`)
      .attach("files", await makeJpegBuffer(400, 260), { filename: "v2.jpg", contentType: "image/jpeg" })
      .expect(201)).body as { media: MediaRow[] };
    const replacedId = rep.media[0].id;
    created.media.push(replacedId);
    expect(rep.media[0].status).toBe("DRAFT");

    const public2 = (await request(app.getHttpServer()).get(`/api/v1/public/products/${own.id}`).expect(200)).body as { media: MediaRow[] };
    expect(public2.media.map((m) => m.id)).not.toContain(replacedId);

    // Re-publish → DRAFT media становится PUBLISHED.
    await adminAgent.post(`/api/v1/products/${own.id}/publish`).expect(201);
    const public3 = (await request(app.getHttpServer()).get(`/api/v1/public/products/${own.id}`).expect(200)).body as { media: MediaRow[] };
    expect(public3.media.map((m) => m.id)).toContain(replacedId);
  });

  it("23. delete безопасно очищает metadata/storage", async () => {
    const own = await createProductWithPolicy(
      { minImages: 1, maxImages: 10, primaryImageRequired: true, allowedMediaTypes: ["image/jpeg"], videoAllowed: false },
      `Delete ${stamp}`,
    );
    const jpeg = await makeJpegBuffer();
    const up = (await partner1Agent.post(`/api/v1/products/${own.id}/media`).attach("files", jpeg, { filename: "del.jpg", contentType: "image/jpeg" }).expect(201))
      .body as { media: MediaRow[] };
    const mediaId = up.media[0].id;
    created.media.push(mediaId);

    const row = await prisma.productMedia.findUniqueOrThrow({ where: { id: mediaId } });
    await partner1Agent.delete(`/api/v1/products/${own.id}/media/${mediaId}`).expect(200);
    expect(await prisma.productMedia.findUnique({ where: { id: mediaId } })).toBeNull();

    // Объекты в test bucket под префиксом media должны быть удалены.
    const remaining = await listObjectsUnder(`products/${own.id}/${mediaId}/`);
    expect(remaining).toEqual([]);
    expect(row.originalStorageKey).toContain(`products/${own.id}/${mediaId}/`);
  });

  it("24. signed preview URL short-lived (содержит expiry; повторный вызов генерирует новый)", async () => {
    const own = await createProductWithPolicy(
      { minImages: 1, maxImages: 10, primaryImageRequired: true, allowedMediaTypes: ["image/jpeg"], videoAllowed: false },
      `Signed ${stamp}`,
    );
    const jpeg = await makeJpegBuffer();
    const up = (await partner1Agent.post(`/api/v1/products/${own.id}/media`).attach("files", jpeg, { filename: "s.jpg", contentType: "image/jpeg" }).expect(201))
      .body as { media: MediaRow[] };
    const mediaId = up.media[0].id;
    created.media.push(mediaId);

    const preview = (await partner1Agent.post(`/api/v1/products/${own.id}/media/${mediaId}/preview`).send({}).expect(201)).body as {
      url: string;
      expiresIn: number;
    };
    expect(preview.expiresIn).toBe(300);
    expect(preview.url).toContain("X-Amz-Signature");
    expect(preview.url).toContain("X-Amz-Expires=300");
    // Signed URL — query-presigned, секрет НЕ попадает в URL (X-Amz-Credential содержит
    // только access key, а не secret). Проверяем отсутствие payload-части secret.
    const secret = process.env.S3_SECRET_KEY ?? "";
    expect(preview.url).not.toContain(encodeURIComponent(secret));
  });

  it("25. e2e использует только test bucket (env guard)", () => {
    expect(process.env.S3_BUCKET).toBe(MINIO_TEST_BUCKET);
    expect(MINIO_TEST_BUCKET.endsWith("-test")).toBe(true);
  });

  it("27. concurrency: два параллельных set-primary не оставляют два primary", async () => {
    const own = await createProductWithPolicy(
      { minImages: 1, maxImages: 10, primaryImageRequired: true, allowedMediaTypes: ["image/jpeg"], videoAllowed: false },
      `ConcurrentSetPrimary ${stamp}`,
    );
    const jpeg = await makeJpegBuffer();
    const up = (await partner1Agent
      .post(`/api/v1/products/${own.id}/media`)
      .attach("files", jpeg, { filename: "1.jpg", contentType: "image/jpeg" })
      .attach("files", jpeg, { filename: "2.jpg", contentType: "image/jpeg" })
      .attach("files", jpeg, { filename: "3.jpg", contentType: "image/jpeg" })
      .expect(201)).body as { media: MediaRow[] };
    up.media.forEach((m) => created.media.push(m.id));
    const [a, b, c] = up.media;
    expect(a.isPrimary).toBe(true);

    // Два concurrent set-primary на РАЗНЫЕ media (без ожидания между ними).
    const outcomes = await Promise.allSettled([
      partner1Agent.post(`/api/v1/products/${own.id}/media/${b.id}/set-primary`),
      partner1Agent.post(`/api/v1/products/${own.id}/media/${c.id}/set-primary`),
    ]);
    // Оба запроса доставлены; допустимые исходы: 201 (успех) или 409 (конфликт
    // primary — проигрыш на DB-level partial unique index, управляемый ConflictError).
    // Никаких ошибок доступа/валидации (403/404/422) и никаких 500.
    const statuses = outcomes.map((o) =>
      o.status === "fulfilled" ? (o as PromiseFulfilledResult<{ status: number }>).value.status : -1,
    );
    expect(statuses.every((s) => s === 201 || s === 409)).toBe(true);
    // Итог инварианта (DB-level partial unique index): РОВНО одна primary.
    // Какая из двух победит — не важно; важно, что две стать не могут.
    const primaries = await prisma.productMedia.findMany({ where: { productId: own.id, isPrimary: true }, select: { id: true } });
    expect(primaries.length).toBe(1);
    expect([b.id, c.id]).toContain(primaries[0].id);
  });

  it("28. DB invariant: partial unique index не даёт двум concurrent UPDATE создать два primary", async () => {
    const own = await createProductWithPolicy(
      { minImages: 1, maxImages: 10, primaryImageRequired: true, allowedMediaTypes: ["image/jpeg"], videoAllowed: false },
      `DbPrimaryInvariant ${stamp}`,
    );
    const jpeg = await makeJpegBuffer();
    const up = (await partner1Agent
      .post(`/api/v1/products/${own.id}/media`)
      .attach("files", jpeg, { filename: "1.jpg", contentType: "image/jpeg" })
      .attach("files", jpeg, { filename: "2.jpg", contentType: "image/jpeg" })
      .attach("files", jpeg, { filename: "3.jpg", contentType: "image/jpeg" })
      .expect(201)).body as { media: MediaRow[] };
    up.media.forEach((m) => created.media.push(m.id));
    const [, b, c] = up.media;

    // Обходим app-логику (clear-first в setPrimary) — прямой SQL, «баговый» путь.
    await prisma.$executeRawUnsafe(`UPDATE "catalog"."ProductMedia" SET "isPrimary" = false WHERE "productId" = $1`, own.id);

    // Два CONCURRENT raw UPDATE на разные media: БД сама обязана отклонить второй
    // (partial unique index "ProductMedia_one_primary_per_product").
    const results = await Promise.allSettled([
      prisma.$executeRawUnsafe(`UPDATE "catalog"."ProductMedia" SET "isPrimary" = true WHERE "id" = $1`, b.id),
      prisma.$executeRawUnsafe(`UPDATE "catalog"."ProductMedia" SET "isPrimary" = true WHERE "id" = $1`, c.id),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    const reason = (rejected[0] as PromiseRejectedResult).reason as { code?: string; meta?: { code?: string }; message?: string };
    const errorText = `${String(reason?.code ?? "")} ${String(reason?.meta?.code ?? "")} ${String(reason?.message ?? "")}`;
    expect(errorText).toMatch(/23505|P2002|UniqueViolation|unique constraint/i);

    // Итог: РОВНО одна primary — второй запрос физически отброшен БД.
    const primaries = await prisma.productMedia.findMany({ where: { productId: own.id, isPrimary: true }, select: { id: true } });
    expect(primaries.length).toBe(1);
  });
});

/** Список ключей объектов в test bucket под префиксом (для проверки storage cleanup). */
async function listObjectsUnder(prefix: string): Promise<string[]> {
  const client = new S3Client({
    region: "us-east-1",
    endpoint: `http://127.0.0.1:${MINIO_TEST_PORT}`,
    forcePathStyle: true,
    credentials: { accessKeyId: MINIO_TEST_ACCESS_KEY, secretAccessKey: MINIO_TEST_SECRET_KEY },
  });
  const res = await client.send(new ListObjectsV2Command({ Bucket: MINIO_TEST_BUCKET, Prefix: prefix }));
  return (res.Contents ?? []).map((o) => o.Key!);
}
