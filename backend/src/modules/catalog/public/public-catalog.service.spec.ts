import { Prisma } from "../../../generated/prisma/client";
import { PublicCatalogService } from "./public-catalog.service";
import { NotFoundError, ValidationDomainError } from "../../../shared/errors";

/** PUBLISHED продукт N (live approved). */
const PUBLISHED_PRODUCT = {
  id: "prod-1",
  code: "PRD-00000001",
  slug: "tour-1",
  title: "Tour N",
  description: "A very long description that should be truncated in the card ".repeat(5),
  type: "TOUR",
  status: "PUBLISHED",
  version: 4,
  publishedAt: new Date("2026-08-01T10:00:00Z"),
  partnerId: "par-1",
  categoryId: "cat-1",
  attributes: { days: 7, language: "en" },
  category: { id: "cat-1", slug: "tours", title: "Tours" },
  tariffs: [
    // Step 1.8B: legacy tariffs (как создаёт createProduct) — pricingMode FIXED.
    { id: "t1", name: "S", price: new Prisma.Decimal("150.00"), currency: "USD", validFrom: null, validTo: null, pricingMode: "FIXED" },
    { id: "t2", name: "M", price: new Prisma.Decimal("100.00"), currency: "USD", validFrom: null, validTo: null, pricingMode: "FIXED" },
  ],
  media: [
    {
      id: "m1",
      type: "IMAGE",
      mimeType: "image/jpeg",
      width: 400,
      height: 300,
      sortOrder: 0,
      isPrimary: true,
      caption: null,
      altText: null,
      thumbnailStorageKey: "products/prod-1/m1/thumb.webp",
      largeStorageKey: "products/prod-1/m1/large.webp",
    },
    {
      id: "m2",
      type: "IMAGE",
      mimeType: "image/jpeg",
      width: 200,
      height: 150,
      sortOrder: 1,
      isPrimary: false,
      caption: null,
      altText: null,
      thumbnailStorageKey: "products/prod-1/m2/thumb.webp",
      largeStorageKey: "products/prod-1/m2/large.webp",
    },
  ],
  availability: [{ date: new Date("2026-09-01T00:00:00Z"), slotsTotal: 10, slotsBooked: 2, slotsReserved: 0 }],
};

/** Консервативный ANONYMOUS PublicSellerProfile (Step 1.11). */
const SELLER_PROFILE = {
  id: "sprof-1",
  publicId: "SELL-00000001",
  partnerId: "par-1",
  status: "APPROVED",
  visibilityMode: "ANONYMOUS",
  publicDisplayName: null,
  publicDescription: null,
  publicLogoMediaId: null,
  countryCode: null,
  cityCode: null,
  verified: true,
  memberSince: new Date("2026-07-01T00:00:00Z"),
};

const SCHEMA_WITH_FILTERS = {
  id: "sch-1",
  attributes: [
    { key: "days", label: "Days", type: "integer", filterable: true, min: 1 },
    { key: "language", label: "Language", type: "enum", filterable: true, options: ["en", "ru"] },
    { key: "itinerary", label: "Itinerary", type: "text" }, // не filterable
  ],
  availability: { enabled: true, dateRequired: true },
};

interface PrismaStub {
  $queryRaw: jest.Mock;
  product: { findMany: jest.Mock; count: jest.Mock; findFirst: jest.Mock };
  productMedia: { findUnique: jest.Mock };
  category: { findMany: jest.Mock; findFirst: jest.Mock };
  categorySchema: { findFirst: jest.Mock };
  availability: { groupBy: jest.Mock };
  publicSellerProfile: { findMany: jest.Mock };
}

function makePrismaStub(overrides?: Record<string, unknown>): PrismaStub {
  const prisma: PrismaStub = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    product: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
    productMedia: { findUnique: jest.fn().mockResolvedValue(null) },
    category: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    categorySchema: { findFirst: jest.fn().mockResolvedValue(null) },
    availability: { groupBy: jest.fn().mockResolvedValue([]) },
    publicSellerProfile: { findMany: jest.fn().mockResolvedValue([]) },
  };
  Object.assign(prisma, overrides);
  return prisma;
}

/** Свежий storage-мок на каждый вызов — без межтестовой зависимости порядка. */
const makeStorageStub = () => ({ getSignedReadUrl: jest.fn().mockResolvedValue("https://signed.example/asset") });
type StorageStub = ReturnType<typeof makeStorageStub>;

function makeService(prisma: PrismaStub, storage: StorageStub = makeStorageStub()): PublicCatalogService {
  return new PublicCatalogService(prisma as never, storage as never);
}

/**
 * FIX 2 (review): серверный matching — $queryRaw вызывается дважды:
 *  1) страница (id в SQL-порядке, LIMIT/OFFSET);
 *  2) count всего совпадения БЕЗ LIMIT/OFFSET (total не обнуляется за концом набора).
 */
function mockMatch(prisma: PrismaStub, ids: string[], total: number): void {
  prisma.$queryRaw
    .mockResolvedValueOnce(ids.map((id) => ({ id })))
    .mockResolvedValueOnce([{ total }]);
}

/** Первый аргумент вызова $queryRaw как Prisma.Sql (strings/values). */
function rawSqlCall(prisma: PrismaStub, callIndex = 0): { strings: string[]; values: unknown[] } {
  return prisma.$queryRaw.mock.calls[callIndex][0] as { strings: string[]; values: unknown[] };
}

/** Рекурсивно «сплющивает» Prisma.Sql (включая вложенные фрагменты) в текст SQL. */
function flattenSql(sql: { strings: string[]; values: unknown[] }): string {
  let out = "";
  sql.strings.forEach((s, i) => {
    out += s;
    if (i < sql.values.length) {
      const v = sql.values[i];
      if (v && typeof v === "object" && Array.isArray((v as { strings?: string[] }).strings)) {
        out += flattenSql(v as { strings: string[]; values: unknown[] });
      } else {
        out += String(v);
      }
    }
  });
  return out;
}

describe("PublicCatalogService (Phase 1 Step 1.5 + review fixes) — unit", () => {
  describe("visibility predicate (§3/§16/§17)", () => {
    it("виден только status=PUBLISHED с publishedAt", () => {
      expect(PublicCatalogService.isPubliclyVisible("PUBLISHED", new Date())).toBe(true);
      expect(PublicCatalogService.isPubliclyVisible("PUBLISHED", null)).toBe(false);
      expect(PublicCatalogService.isPubliclyVisible("DRAFT", new Date())).toBe(false);
      expect(PublicCatalogService.isPubliclyVisible("COMPLETE", new Date())).toBe(false);
      expect(PublicCatalogService.isPubliclyVisible("REVIEWED", new Date())).toBe(false);
      expect(PublicCatalogService.isPubliclyVisible("CHANGED", new Date())).toBe(false);
      expect(PublicCatalogService.isPubliclyVisible("ARCHIVED", new Date())).toBe(false);
      expect(PublicCatalogService.isPubliclyVisible(null, null)).toBe(false);
    });
  });

  describe("listProducts (§8/§9/§10, FIX 2 server-side SQL matching)", () => {
    it("matching в PostgreSQL по всему published-набору; total = полное совпадение (count без LIMIT)", async () => {
      const prisma = makePrismaStub();
      mockMatch(prisma, ["prod-1"], 7);
      prisma.product.findMany.mockResolvedValue([PUBLISHED_PRODUCT]);
      const service = makeService(prisma);

      const result = await service.listProducts({ page: 1, pageSize: 10 });

      expect(result.total).toBe(7);
      expect(result.items).toHaveLength(1);
      // Страница: только PUBLISHED + LIMIT/OFFSET (parameterized SQL, без injection).
      const pageSql = flattenSql(rawSqlCall(prisma, 0));
      expect(pageSql).toContain("PUBLISHED");
      expect(pageSql).toContain("LIMIT");
      expect(pageSql).toContain("OFFSET");
      expect(rawSqlCall(prisma, 0).values).toContain(10);
      expect(rawSqlCall(prisma, 0).values).toContain(0);
      // Count — отдельный запрос БЕЗ LIMIT/OFFSET (total полного набора).
      const countSql = flattenSql(rawSqlCall(prisma, 1));
      expect(countSql).toContain("count(*)");
      expect(countSql).not.toContain("LIMIT");
    });

    it("card mapper: без internal полей, priceFrom=min tariff, primary image со СТАБИЛЬНЫМ public URL (FIX 1)", async () => {
      const prisma = makePrismaStub();
      mockMatch(prisma, ["prod-1"], 1);
      prisma.product.findMany.mockResolvedValue([PUBLISHED_PRODUCT]);
      prisma.availability.groupBy.mockResolvedValue([
        {
          productId: "prod-1",
          _min: { date: new Date("2026-09-01T00:00:00Z") },
          _count: { _all: 1 },
          _sum: { slotsTotal: 10, slotsBooked: 2, slotsReserved: 0 },
        },
      ]);
      prisma.publicSellerProfile.findMany.mockResolvedValue([SELLER_PROFILE]);
      const service = makeService(prisma);

      const result = await service.listProducts({ page: 1, pageSize: 10 });
      const card = result.items[0];

      expect(card.title).toBe("Tour N");
      expect(card.priceFrom).toBe("100.00");
      expect(card.currency).toBe("USD");
      expect(card.pricingUnit).toBe("unit");
      expect(card.primaryImage?.id).toBe("m1");
      expect(card.primaryImage?.thumbUrl).toBe("/api/v1/public/media/m1/thumb");
      expect(card.primaryImage?.largeUrl).toBe("/api/v1/public/media/m1/large");
      // Step 1.11: seller-safe projection (ANONYMOUS → displayName=null, generic label).
      expect(card.seller).toEqual({
        publicId: "SELL-00000001",
        displayName: null,
        visibilityMode: "ANONYMOUS",
        verified: true,
        memberSince: "2026-07-01T00:00:00.000Z",
        countryCode: null,
        cityCode: null,
      });
      expect(card.availabilitySummary).toEqual({
        availableFrom: "2026-09-01T00:00:00.000Z",
        datesCount: 1,
        totalSlots: 10,
        totalBooked: 2,
        totalReserved: 0,
      });
      expect(card.publishedAt).toBe("2026-08-01T10:00:00.000Z");
      expect(card.shortDescription!.length).toBeLessThan(PUBLISHED_PRODUCT.description.length);

      const raw = JSON.stringify(card);
      expect(raw).not.toContain("storageKey");
      expect(raw).not.toContain("thumbnailStorageKey");
      expect(raw).not.toContain("partnerId");
      expect(raw).not.toContain("categoryId");
      expect(raw).not.toContain("createdBy");
      expect(raw).not.toContain("status");
      // FIX 1: signed S3 URL / секреты не входят в контракт.
      expect(raw).not.toContain("https://");
      expect(raw).not.toContain("X-Amz");
    });

    it("ProductDraft N+1 не участвует: карточка отражает live N (draft не включён)", async () => {
      const prisma = makePrismaStub();
      mockMatch(prisma, ["prod-1"], 1);
      prisma.product.findMany.mockResolvedValue([PUBLISHED_PRODUCT]);
      const service = makeService(prisma);

      const result = await service.listProducts({ page: 1, pageSize: 10 });
      const include = (prisma.product.findMany.mock.calls[0][0] as { include: Record<string, unknown> }).include;
      expect(include.draft).toBeUndefined();
      expect(result.items[0].title).toBe("Tour N");
    });

    it("sort: поддерживаемые режимы; unsupported → ValidationDomainError", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);

      await service.listProducts({ page: 1, pageSize: 10, sort: "newest" });
      await service.listProducts({ page: 1, pageSize: 10, sort: "price_asc" });
      await service.listProducts({ page: 1, pageSize: 10, sort: "price_desc" });
      await expect(service.listProducts({ page: 1, pageSize: 10, sort: "relevance" })).rejects.toThrow(ValidationDomainError);
      await expect(service.listProducts({ page: 1, pageSize: 10, sort: "bogus" })).rejects.toThrow(ValidationDomainError);
    });

    it("price sort: порядок страницы = server-side SQL порядок (min-тариф, NULLS LAST); total полного набора", async () => {
      const prisma = makePrismaStub();
      mockMatch(prisma, ["p-low", "p-high"], 3);
      prisma.product.findMany.mockResolvedValueOnce([
        { ...PUBLISHED_PRODUCT, id: "p-low", title: "Low" },
        { ...PUBLISHED_PRODUCT, id: "p-high", title: "High" },
      ]);
      const service = makeService(prisma);

      const result = await service.listProducts({ page: 1, pageSize: 10, sort: "price_asc" });

      expect(result.total).toBe(3);
      expect(result.items.map((i) => i.id)).toEqual(["p-low", "p-high"]);

      // Страница за концом набора НЕ обнуляет total (FIX 2: count отдельным запросом).
      const prisma2 = makePrismaStub();
      mockMatch(prisma2, [], 3);
      const empty = await makeService(prisma2).listProducts({ page: 999, pageSize: 10, sort: "price_asc" });
      expect(empty.total).toBe(3);
      expect(empty.items).toHaveLength(0);
    });

    it("filter: f[days]=7 + f[language]=en — валидация по Schema + параметры в SQL (AND), категория обязательна", async () => {
      const prisma = makePrismaStub();
      prisma.categorySchema.findFirst.mockResolvedValue(SCHEMA_WITH_FILTERS);
      mockMatch(prisma, ["p7"], 1);
      prisma.product.findMany.mockResolvedValueOnce([{ ...PUBLISHED_PRODUCT, id: "p7", title: "Seven" }]);
      const service = makeService(prisma);

      const result = await service.listProducts({ page: 1, pageSize: 10, category: "tours", f: { days: "7", language: "en" } });

      expect(result.total).toBe(1);
      expect(result.items.map((i) => i.id)).toEqual(["p7"]);
      // SQL содержит валидированные значения фильтров + slug категории
      // (parameterized; bind params подставляются рантаймом, инъекция невозможна).
      const sql = flattenSql(rawSqlCall(prisma, 0));
      expect(sql).toContain('c."slug" = tours');
      expect(sql).toContain('(p."attributes" ->> days)::numeric = 7');
      expect(sql).toContain('(p."attributes" ->> language) = en');
    });

    it("filter: ошибки — без category, неизвестный ключ, не-filterable, невалидное число", async () => {
      const prisma = makePrismaStub();
      prisma.categorySchema.findFirst.mockResolvedValue(SCHEMA_WITH_FILTERS);
      const service = makeService(prisma);

      await expect(service.listProducts({ page: 1, pageSize: 10, f: { days: "7" } })).rejects.toThrow(ValidationDomainError);
      await expect(service.listProducts({ page: 1, pageSize: 10, category: "tours", f: { nope: "1" } })).rejects.toThrow(ValidationDomainError);
      await expect(service.listProducts({ page: 1, pageSize: 10, category: "tours", f: { itinerary: "x" } })).rejects.toThrow(ValidationDomainError);
      await expect(service.listProducts({ page: 1, pageSize: 10, category: "tours", f: { days: "abc" } })).rejects.toThrow(ValidationDomainError);
    });

    it("sort=newest + attribute filters → порядок от серверного matching (publishedAt desc), не по цене", async () => {
      const prisma = makePrismaStub();
      prisma.categorySchema.findFirst.mockResolvedValue(SCHEMA_WITH_FILTERS);
      // SQL (newest) вернул b раньше a (b опубликован позже, цена ниже — цена не влияет).
      mockMatch(prisma, ["b", "a"], 2);
      prisma.product.findMany.mockResolvedValueOnce([
        { ...PUBLISHED_PRODUCT, id: "a", title: "A" },
        { ...PUBLISHED_PRODUCT, id: "b", title: "B" },
      ]);
      const service = makeService(prisma);

      const result = await service.listProducts({ page: 1, pageSize: 10, category: "tours", f: { days: "7" }, sort: "newest" });
      expect(result.items.map((i) => i.id)).toEqual(["b", "a"]);
    });

    it("filter: значение вне def.min/max или пустая строка → ValidationDomainError", async () => {
      const prisma = makePrismaStub();
      prisma.categorySchema.findFirst.mockResolvedValue(SCHEMA_WITH_FILTERS); // days: min 1
      const service = makeService(prisma);

      await expect(service.listProducts({ page: 1, pageSize: 10, category: "tours", f: { days: "0" } })).rejects.toThrow(ValidationDomainError);
      await expect(service.listProducts({ page: 1, pageSize: 10, category: "tours", f: { days: "" } })).rejects.toThrow(ValidationDomainError);
    });

    it("filter: f[days]=3 → только продукт с days=3 (числовое сравнение в SQL)", async () => {
      const prisma = makePrismaStub();
      prisma.categorySchema.findFirst.mockResolvedValue(SCHEMA_WITH_FILTERS);
      mockMatch(prisma, ["p3"], 1);
      prisma.product.findMany.mockResolvedValueOnce([{ ...PUBLISHED_PRODUCT, id: "p3", title: "Three" }]);
      const service = makeService(prisma);

      const result = await service.listProducts({ page: 1, pageSize: 10, category: "tours", f: { days: "3" } });
      expect(result.total).toBe(1);
      expect(result.items.map((i) => i.id)).toEqual(["p3"]);
    });

    it("available_from: невалидная дата → контролируемая ошибка", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      await expect(service.listProducts({ page: 1, pageSize: 10, available_from: "not-a-date" })).rejects.toThrow(ValidationDomainError);
    });
  });

  describe("getProductDetail (§5/§17)", () => {
    it("DRAFT/SUBMITTED/ARCHIVED/отсутствующий → единый нейтральный 404", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);

      prisma.product.findFirst.mockResolvedValue({ ...PUBLISHED_PRODUCT, status: "DRAFT", publishedAt: null });
      await expect(service.getProductDetail("prod-1")).rejects.toThrow(NotFoundError);
      await expect(service.getProductDetail("prod-1")).rejects.toThrow("Product not found");

      prisma.product.findFirst.mockResolvedValue(null);
      await expect(service.getProductDetail("missing")).rejects.toThrow(NotFoundError);
    });

    it("PDP mapper: без internal полей, media со СТАБИЛЬНЫМ delivery URL (FIX 1), tariffs/availability/provider", async () => {
      const prisma = makePrismaStub();
      prisma.product.findFirst.mockResolvedValue(PUBLISHED_PRODUCT);
      prisma.publicSellerProfile.findMany.mockResolvedValue([SELLER_PROFILE]);
      const storage = makeStorageStub();
      const service = makeService(prisma, storage);

      const detail = await service.getProductDetail("tour-1");

      expect(detail.product.title).toBe("Tour N");
      expect(detail.product.version).toBe(4);
      expect(detail.product.priceFrom).toBe("100.00");
      expect(detail.product.currency).toBe("USD");
      expect(detail.product.tariffs).toHaveLength(2);
      expect(detail.product.tariffs[1].price).toBe("100.00");
      expect(detail.product.attributes).toEqual({ days: 7, language: "en" });
      expect(detail.product.availability).toEqual({
        availableFrom: "2026-09-01T00:00:00.000Z",
        datesCount: 1,
        totalSlots: 10,
        totalBooked: 2,
        totalReserved: 0,
      });
      // Step 1.11: seller-safe projection вместо raw CRM provider.
      expect(detail.product.seller).toEqual({
        publicId: "SELL-00000001",
        displayName: null,
        visibilityMode: "ANONYMOUS",
        verified: true,
        memberSince: "2026-07-01T00:00:00.000Z",
        countryCode: null,
        cityCode: null,
      });
      expect(detail.media).toHaveLength(2);
      expect(detail.media[0].url).toEqual({
        thumb: "/api/v1/public/media/m1/thumb",
        large: "/api/v1/public/media/m1/large",
      });
      // Delivery НЕ происходит на этапе маппинга — подпись только при запросе файла.
      expect(storage.getSignedReadUrl).not.toHaveBeenCalledWith("products/prod-1/m1/thumb.webp", 300);

      const raw = JSON.stringify(detail);
      expect(raw).not.toContain("storageKey");
      expect(raw).not.toContain("partnerId");
      expect(raw).not.toContain("categoryId");
      expect(raw).not.toContain("createdBy");
      expect(raw).not.toContain("status");
      expect(raw).not.toContain("draft");
      expect(raw).not.toContain("moderation");
      expect(raw).not.toContain("https://");
    });

    it("Step 1.8B §22: POR-план видим как inquiry-only (price null, pricingMode POR), не входит в priceFrom; FIXED участвует", async () => {
      const prisma = makePrismaStub();
      prisma.product.findFirst.mockResolvedValue({
        ...PUBLISHED_PRODUCT,
        tariffs: [
          { id: "t-fixed", name: "FIXED Plan", price: new Prisma.Decimal("100.00"), currency: "USD", validFrom: null, validTo: null, pricingMode: "FIXED" },
          { id: "t-por", name: "Inquiry Only", price: new Prisma.Decimal("40.00"), currency: "USD", validFrom: null, validTo: null, pricingMode: "PRICE_ON_REQUEST" },
        ],
      });
      const service = makeService(prisma);

      const detail = await service.getProductDetail("tour-1");

      const tariffs = detail.product.tariffs;
      expect(tariffs).toHaveLength(2); // POR ВИДИМ (visibility ≠ bindability) — §22 fix
      const por = tariffs.find((t) => t.id === "t-por")!;
      expect(por.price).toBeNull(); // inquiry-only: bindable цена не выводится
      expect(por.currency).toBeNull();
      expect(por.pricingMode).toBe("PRICE_ON_REQUEST");
      const fixed = tariffs.find((t) => t.id === "t-fixed")!;
      expect(fixed.price).toBe("100.00");
      // priceFrom — только FIXED: 40.00 POR не участвует (нет null→0 и нет POR-leakage).
      expect(detail.product.priceFrom).toBe("100.00");
      expect(detail.product.currency).toBe("USD");
    });

    it("Step 1.8B §43: только POR-планы → priceFrom null (не 0, не fallback на POR-цену)", async () => {
      const prisma = makePrismaStub();
      prisma.product.findFirst.mockResolvedValue({
        ...PUBLISHED_PRODUCT,
        tariffs: [
          { id: "t-por", name: "Inquiry Only", price: new Prisma.Decimal("40.00"), currency: "USD", validFrom: null, validTo: null, pricingMode: "PRICE_ON_REQUEST" },
        ],
      });
      const service = makeService(prisma);

      const detail = await service.getProductDetail("tour-1");
      expect(detail.product.tariffs).toHaveLength(1); // видим
      expect(detail.product.priceFrom).toBeNull();
      expect(detail.product.currency).toBeNull();
    });
  });

  describe("getPublicMediaUrl (FIX 1 — stable public media delivery)", () => {
    it("PUBLISHED media видимого продукта → signed redirect URL + mimeType (large/thumb)", async () => {
      const prisma = makePrismaStub();
      prisma.productMedia.findUnique.mockResolvedValue({
        id: "m1",
        status: "PUBLISHED",
        mimeType: "image/webp",
        thumbnailStorageKey: "products/prod-1/m1/thumb.webp",
        largeStorageKey: "products/prod-1/m1/large.webp",
        product: { status: "PUBLISHED", publishedAt: new Date("2026-08-01T00:00:00Z") },
      });
      const storage = makeStorageStub();
      const service = makeService(prisma, storage);

      const large = await service.getPublicMediaUrl("m1", "large");
      expect(large.url).toBe("https://signed.example/asset");
      expect(large.mimeType).toBe("image/webp");
      expect(storage.getSignedReadUrl).toHaveBeenLastCalledWith("products/prod-1/m1/large.webp", 300);

      await service.getPublicMediaUrl("m1", "thumb");
      expect(storage.getSignedReadUrl).toHaveBeenLastCalledWith("products/prod-1/m1/thumb.webp", 300);
    });

    it("DRAFT media / ARCHIVED или DRAFT продукт / отсутствующий → единый нейтральный 404 (без подписи)", async () => {
      const prisma = makePrismaStub();
      const storage = makeStorageStub();
      const service = makeService(prisma, storage);

      // DRAFT (staged) media даже на публично видимом продукте.
      prisma.productMedia.findUnique.mockResolvedValue({
        id: "m-draft",
        status: "DRAFT",
        mimeType: "image/webp",
        thumbnailStorageKey: "k-t",
        largeStorageKey: "k-l",
        product: { status: "PUBLISHED", publishedAt: new Date() },
      });
      await expect(service.getPublicMediaUrl("m-draft", "large")).rejects.toThrow(NotFoundError);

      // PUBLISHED media, но продукт не публично видим (ARCHIVED).
      prisma.productMedia.findUnique.mockResolvedValue({
        id: "m-prod",
        status: "PUBLISHED",
        mimeType: "image/webp",
        thumbnailStorageKey: "k-t",
        largeStorageKey: "k-l",
        product: { status: "ARCHIVED", publishedAt: new Date() },
      });
      await expect(service.getPublicMediaUrl("m-prod", "thumb")).rejects.toThrow(NotFoundError);

      // Нет такой media.
      prisma.productMedia.findUnique.mockResolvedValue(null);
      await expect(service.getPublicMediaUrl("nope", "thumb")).rejects.toThrow(NotFoundError);

      expect(storage.getSignedReadUrl).not.toHaveBeenCalledWith("k-t", 300);
      expect(storage.getSignedReadUrl).not.toHaveBeenCalledWith("k-l", 300);
    });
  });

  describe("categories / filters (§7)", () => {
    it("listCategories возвращает только ACTIVE с public-полями", async () => {
      const prisma = makePrismaStub();
      prisma.category.findMany.mockResolvedValue([
        { id: "cat-1", slug: "tours", title: "Tours" },
        { id: "cat-2", slug: "hidden", title: "Hidden" },
      ]);
      const service = makeService(prisma);

      const cats = await service.listCategories();
      const where = (prisma.category.findMany.mock.calls[0][0] as { where: { status: string } }).where;
      expect(where.status).toBe("ACTIVE");
      expect(cats[0]).toEqual({ id: "cat-1", slug: "tours", title: "Tours" });
      const raw = JSON.stringify(cats);
      expect(raw).not.toContain("code");
      expect(raw).not.toContain("status");
      expect(raw).not.toContain("attributes");
    });

    it("getCategory: неизвестная/неактивная категория → 404", async () => {
      const prisma = makePrismaStub();
      const service = makeService(prisma);
      await expect(service.getCategory("nope")).rejects.toThrow(NotFoundError);
    });

    it("getCategoryFilters: фильтры из ACTIVE schema (только filterable), availability, sort modes", async () => {
      const prisma = makePrismaStub();
      prisma.category.findFirst.mockResolvedValue({ id: "cat-1", slug: "tours", title: "Tours" });
      prisma.categorySchema.findFirst.mockResolvedValue(SCHEMA_WITH_FILTERS);
      const service = makeService(prisma);

      const meta = await service.getCategoryFilters("tours");

      expect(meta.category).toEqual({ id: "cat-1", slug: "tours", title: "Tours" });
      expect(meta.filters).toEqual([
        { key: "days", label: "Days", type: "integer", min: 1 },
        { key: "language", label: "Language", type: "enum", options: ["en", "ru"] },
      ]);
      expect(meta.availability).toEqual({ enabled: true, dateRequired: true });
      expect(meta.sort).toEqual(["newest", "price_asc", "price_desc"]);
    });
  });
});
