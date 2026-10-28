import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { SupplierCatalogSource } from "../src/modules/supplier/catalog/supplier-catalog.source";
import type { CatalogRecord, CatalogSourceResult } from "../src/modules/supplier/catalog/supplier-catalog.types";

const RECORD: CatalogRecord = {
  supplierCode: "ANEX",
  serviceType: "tours",
  externalKey: "ANEX-E2E-CATALOG-1",
  productType: "TOUR",
  categorySlug: "tours",
  title: "E2E Catalog Hotel (Türkiye)",
  countryCode: "TR",
  stateCode: "TR",
  hotelKey: "E2E-CATALOG-1",
  hotelName: "E2E Catalog Hotel",
  attributes: { hotelName: "E2E Catalog Hotel", hotelKey: "E2E-CATALOG-1", countryCode: "TR", country: "Türkiye", supplierCode: "ANEX" },
  startingPrice: 100,
  currency: "AZN",
  tariffs: [{ name: "Base", amount: 100, currency: "AZN" }],
};

describe("Supplier catalog update (e2e, isolated DB)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken = "";
  let categoryId = "";
  let partnerId = "";

  const source = {
    capabilities: jest.fn().mockResolvedValue([{
      supplierCode: "ANEX",
      name: "ANEX",
      serviceTypes: ["tours"],
      countries: [{ key: "TR", label: "Türkiye" }],
    }]),
    fetch: jest.fn(),
  };

  const auth = () => ({ Authorization: `Bearer ${adminToken}` });

  async function pollRun(id: string): Promise<any> {
    for (let i = 0; i < 80; i++) {
      const res = await request(app.getHttpServer()).get(`/api/v1/supplier/catalog/runs/${id}`).set(auth()).expect(200);
      if (!["PREVIEWING", "APPLYING"].includes(res.body.status)) return res.body;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`run ${id} did not finish`);
  }

  async function preview(record: CatalogRecord | null, complete = false) {
    source.fetch.mockResolvedValueOnce({
      records: record ? [record] : [],
      complete,
      errors: [],
      scope: { supplierCode: "ANEX", serviceType: "tours", countryKey: "TR" },
    } satisfies CatalogSourceResult);
    const res = await request(app.getHttpServer())
      .post("/api/v1/supplier/catalog/runs/preview")
      .set(auth())
      .send({ supplierCode: "ANEX", serviceType: "tours", countryKey: "TR" })
      .expect(201);
    return pollRun(res.body.id);
  }

  async function confirm(id: string) {
    await request(app.getHttpServer()).post(`/api/v1/supplier/catalog/runs/${id}/confirm`).set(auth()).expect(201);
    const run = await pollRun(id);
    // The production once-per-day guard is covered by unit tests; make this
    // isolated suite repeatable on the same day.
    await prisma.supplierCatalogRun.update({
      where: { id },
      data: { finishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    return run;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupplierCatalogSource)
      .useValue(source)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const login = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username: "admin", password: "admin123" }).expect(200);
    adminToken = login.body.accessToken;

    const category = await prisma.category.findFirst({ where: { slug: "tours" } });
    if (category) categoryId = category.id;
    else categoryId = (await prisma.category.create({ data: { code: "CAT-E2E", slug: "tours", title: "Tours" } })).id;

    const existingPartner = await prisma.partner.findFirst({ where: { name: "Anextour" } });
    partnerId = existingPartner?.id ?? (await prisma.partner.create({ data: { code: `PRN-E2E-${Date.now()}`, name: "Anextour", status: "ACTIVE" } })).id;

    await prisma.supplierCatalogRun.deleteMany({ where: { supplierCode: "ANEX", countryCode: "TR" } });
    await prisma.supplierCatalogIdentity.deleteMany({ where: { externalKey: RECORD.externalKey } });
    await prisma.product.deleteMany({ where: { supplierRef: RECORD.externalKey } });
  });

  afterAll(async () => {
    await prisma.supplierCatalogRun.deleteMany({ where: { supplierCode: "ANEX", countryCode: "TR" } });
    await prisma.supplierCatalogIdentity.deleteMany({ where: { externalKey: RECORD.externalKey } });
    await prisma.product.deleteMany({ where: { supplierRef: RECORD.externalKey } });
    await app.close();
  });

  it("preview does not change the catalog; confirm creates once and re-run updates the same card", async () => {
    const previewRun = await preview(RECORD, false);
    expect(previewRun.status).toBe("PREVIEW_READY");
    expect(await prisma.product.count({ where: { supplierRef: RECORD.externalKey } })).toBe(0);
    expect(previewRun.items.some((item: any) => item.action === "CREATE")).toBe(true);

    const applied = await confirm(previewRun.id);
    expect(applied.status).toBe("COMPLETED");
    const product = await prisma.product.findUnique({ where: { supplierRef: RECORD.externalKey } });
    expect(product?.status).toBe("PUBLISHED");
    expect(await prisma.productPublicationChannel.count({ where: { productId: product!.id, channel: "MARKETPLACE" } })).toBe(1);

    const updated = { ...RECORD, title: "E2E Catalog Hotel Updated", startingPrice: 120, tariffs: [{ name: "Base", amount: 120, currency: "AZN" }] };
    const second = await preview(updated, false);
    expect(second.items.some((item: any) => item.action === "UPDATE" && item.productId === product!.id)).toBe(true);
    await confirm(second.id);
    const same = await prisma.product.findUnique({ where: { supplierRef: RECORD.externalKey } });
    expect(same?.id).toBe(product!.id);
    expect(same?.title).toBe("E2E Catalog Hotel Updated");
    expect(await prisma.product.count({ where: { supplierRef: RECORD.externalKey } })).toBe(1);
  });

  it("blocked archive on PARTIAL and archives/restores the same id on COMPLETE", async () => {
    const partial = await preview(null, false);
    expect(partial.status).toBe("PREVIEW_READY");
    expect(partial.coverage).toBe("PARTIAL");
    expect(partial.items.some((item: any) => item.action === "ARCHIVE")).toBe(false);
    await confirm(partial.id);
    expect((await prisma.product.findUnique({ where: { supplierRef: RECORD.externalKey } }))?.status).toBe("PUBLISHED");

    const complete = await preview(null, true);
    expect(complete.coverage).toBe("COMPLETE");
    expect(complete.items.some((item: any) => item.action === "ARCHIVE")).toBe(true);
    await confirm(complete.id);
    const archived = await prisma.product.findUnique({ where: { supplierRef: RECORD.externalKey } });
    expect(archived?.status).toBe("ARCHIVED");
    expect(await prisma.supplierCatalogIdentity.findUnique({
      where: { supplierCode_serviceType_externalKey: { supplierCode: "ANEX", serviceType: "tours", externalKey: RECORD.externalKey } },
    })).toMatchObject({ status: "ARCHIVED" });

    const restore = await preview(RECORD, true);
    expect(restore.items.some((item: any) => item.action === "RESTORE" && item.productId === archived!.id)).toBe(true);
    await confirm(restore.id);
    const restored = await prisma.product.findUnique({ where: { supplierRef: RECORD.externalKey } });
    expect(restored?.id).toBe(archived!.id);
    expect(restored?.status).toBe("PUBLISHED");
  });

  it("requires explicit manual approval for legacy archived cards", async () => {
    await prisma.supplierCatalogIdentity.deleteMany({ where: { externalKey: RECORD.externalKey } });
    await prisma.product.update({ where: { supplierRef: RECORD.externalKey }, data: { status: "ARCHIVED" } });
    const run = await preview(RECORD, false);
    const legacy = run.items.find((item: any) => item.action === "LEGACY_ARCHIVED");
    expect(legacy).toBeTruthy();
    await request(app.getHttpServer())
      .post(`/api/v1/supplier/catalog/runs/${run.id}/items/${legacy.id}/restore`)
      .set(auth())
      .expect(201);
    const product = await prisma.product.findUnique({ where: { supplierRef: RECORD.externalKey } });
    expect(product?.status).toBe("PUBLISHED");
  });

  it("marks source errors as FAILED and leaves catalog untouched", async () => {
    source.fetch.mockRejectedValueOnce(new Error("simulated supplier error"));
    const res = await request(app.getHttpServer())
      .post("/api/v1/supplier/catalog/runs/preview")
      .set(auth())
      .send({ supplierCode: "ANEX", serviceType: "tours", countryKey: "TR" })
      .expect(201);
    const run = await pollRun(res.body.id);
    expect(run.status).toBe("FAILED");
    expect(await prisma.product.count({ where: { supplierRef: RECORD.externalKey } })).toBe(1);
  });
});
