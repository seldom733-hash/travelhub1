import {
  applyCanonicalName,
  cleanHotelName,
  groupHotelRefs,
  hotelGroupKey,
  normalizeName,
  parseStars,
  type HotelRef,
} from "./hotel/hotel-identity";
import { HotelMatchingService } from "./hotel/hotel-matching.service";
import { TourMatchingService } from "./tour-matching.service";
import { PublicCatalogService } from "./public/public-catalog.service";
import { HotelMatchReviewService } from "./hotel/hotel-match-review.service";
import { ProductHistoryRecorder } from "../supplier/product-history-recorder.service";
import type { PrismaService } from "../../prisma/prisma.service";

/**
 * Приёмочный набор единого каталога отелей/туров: 26 сценариев.
 * Тесты чистые (без live-поставщиков): проверяют контракты, по которым
 * строятся общая карточка, «Другие предложения», реестр и аудит.
 */

const ref = (over: Partial<HotelRef> = {}): HotelRef => ({
  supplierCode: "KOMPAS",
  externalKey: "100",
  name: "RADISSON BLU HOTEL",
  normalizedName: "radisson blu hotel",
  stars: 5,
  countryCode: "TR",
  countryName: "Турция",
  cityName: "Стамбул",
  cityKey: "стамбул",
  resortName: "",
  hotelHref: "",
  source: "product",
  ...over,
});

const productRow = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  code: "PRD-00000001",
  title: "HOTEL 5* (Стамбул)",
  partnerId: "par-1",
  type: "TOUR",
  version: 1,
  status: "PUBLISHED",
  publishedAt: new Date("2026-01-01T00:00:00Z"),
  attributes: { supplierCode: "KOMPAS", hotelKey: "100", startingPrice: 1000, currency: "AZN" },
  media: [],
  tariffs: [],
  availability: [],
  category: null,
  ...over,
});

const storage = () => ({ getSignedReadUrl: jest.fn(async () => "https://signed/x") }) as never;

describe("Единый каталог — 26 приёмочных сценариев", () => {
  // ── A. Идентичность физической гостиницы (1–6) ──────────────────────
  describe("A. Идентичность", () => {
    it("1. cleanHotelName убирает хвост «(Город)» и звёздность", () => {
      expect(cleanHotelName("RADISSON BLU ISTANBUL PERA 5* (Пера)")).toBe("RADISSON BLU ISTANBUL PERA");
    });

    it("2. cleanHotelName не вырезает скобки и звёзды из середины имени", () => {
      expect(cleanHotelName("HOTEL (EX) 5*  —  Baku")).toBe("HOTEL (EX) 5* — Baku");
    });

    it("3. parseStars возвращает звёзды из имени или null", () => {
      expect(parseStars("HURAWALHI ISLAND RESORT. 5*")).toBe(5);
      expect(parseStars("HOTEL without stars")).toBeNull();
    });

    it("4. normalizeName схлопывает регистр и пунктуацию", () => {
      expect(normalizeName("Zenseana Resort & Spa")).toBe("zenseana resort spa");
    });

    it("5. hotelGroupKey различает города и страны при одном имени", () => {
      const a = hotelGroupKey({ normalizedName: "hotel", countryCode: "TR", cityKey: "стамбул" });
      const b = hotelGroupKey({ normalizedName: "hotel", countryCode: "TR", cityKey: "анталья" });
      const c = hotelGroupKey({ normalizedName: "hotel", countryCode: "AE", cityKey: "стамбул" });
      expect(new Set([a, b, c]).size).toBe(3);
    });

    it("6. groupHotelRefs не сливает одинаковые имена в разных городах", () => {
      const groups = groupHotelRefs([
        ref({ cityKey: "стамбул", externalKey: "1" }),
        ref({ cityKey: "анталья", externalKey: "2" }),
      ]);
      expect(groups).toHaveLength(2);
    });
  });

  // ── B. Единый реестр и предложения отеля (7–12) ─────────────────────
  describe("B. Реестр отелей", () => {
    const matchingWith = (products: unknown[]) => {
      const prisma = { product: { findMany: jest.fn().mockResolvedValue(products) } } as unknown as PrismaService;
      return new HotelMatchingService(prisma);
    };

    it("7. buildRefs строит ref из PRODUCT(type=HOTEL)", async () => {
      const rows = await matchingWith([
        productRow({ type: "HOTEL", title: "HOTEL 5* (Стамбул)", attributes: { supplierCode: "KOMPAS", hotelKey: "100", hotelName: "HOTEL 5*" } }),
      ]).buildRefs("KOMPAS", "HOTEL");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ supplierCode: "KOMPAS", externalKey: "100", name: "HOTEL" });
    });

    it("8. buildRefs строит ref из отеля внутри тура", async () => {
      const rows = await matchingWith([
        productRow({ type: "TOUR", title: "HOTEL — Baku (Turkey)", attributes: { supplierCode: "VOYAGER", hotelKey: "23280", hotelName: "HURAWALHI ISLAND RESORT. 5*" } }),
      ]).buildRefs("VOYAGER", "TOUR");
      expect(rows[0].externalKey).toBe("23280");
      expect(rows[0].name).toBe("HURAWALHI ISLAND RESORT.");
    });

    it("9. тур и услуга «Отели» с одним hotelKey дают один supplier-native ref", () => {
      const groups = groupHotelRefs([
        ref({ source: "product" }),
        ref({ source: "product", name: "RADISSON BLU HOTEL 5*" }),
      ]);
      expect(groups).toHaveLength(1);
      expect(groups[0].refs).toHaveLength(2);
    });

    it("10. getOffersForHotel не берёт продукт с префиксным ключом 1234 вместо 123", async () => {
      const prisma = {
        hotelSupplierRef: { findMany: jest.fn().mockResolvedValue([{ supplierCode: "KOMPAS", externalKey: "123" }]) },
        product: { findMany: jest.fn().mockResolvedValue([
          productRow({ id: "wrong", code: "PRD-2", supplierRef: "KOMPASHTL-1234-1", attributes: { startingPrice: 1, currency: "AZN" } }),
          productRow({ id: "right", code: "PRD-1", supplierRef: "KOMPASHTL-123-1", attributes: { startingPrice: 900, currency: "AZN" } }),
        ]) },
      } as unknown as PrismaService;
      const offers = await new HotelMatchingService(prisma).getOffersForHotel("hotel-1");
      expect(offers.map((o) => o.productId)).toEqual(["right"]);
    });

    it("11. getOffersForHotel оставляет самый дешёвый продукт одного отеля", async () => {
      const prisma = {
        hotelSupplierRef: { findMany: jest.fn().mockResolvedValue([{ supplierCode: "KOMPAS", externalKey: "77" }]) },
        product: { findMany: jest.fn().mockResolvedValue([
          productRow({ id: "cheap", supplierRef: "KOMPASHTL-77-1", attributes: { startingPrice: 800, currency: "AZN" } }),
          productRow({ id: "expensive", supplierRef: "KOMPASHTL-77-2", attributes: { startingPrice: 1200, currency: "AZN" } }),
        ]) },
      } as unknown as PrismaService;
      const offers = await new HotelMatchingService(prisma).getOffersForHotel("hotel-1");
      expect(offers).toHaveLength(1);
      expect(offers[0].price).toBe(800);
    });

    it("12. минимальная цена отеля отдаёт публичный код партнёра", async () => {
      const prisma = {
        partner: { findMany: jest.fn().mockResolvedValue([
          { id: "par-1", code: "PAR-1" }, { id: "par-2", code: "PAR-2" },
        ]) },
        supplierFxRate: { findMany: jest.fn().mockResolvedValue([]) },
      } as unknown as PrismaService;
      const hotelMatching = {
        getOffersForHotel: jest.fn().mockResolvedValue([
          { supplierCode: "KOMPAS", externalKey: "1", productId: "a", productCode: "PRD-1", productName: "A", partnerId: "par-1", price: 1200, currency: "AZN" },
          { supplierCode: "VOYAGER", externalKey: "2", productId: "b", productCode: "PRD-2", productName: "B", partnerId: "par-2", price: 800, currency: "AZN" },
        ]),
      };
      const service = new PublicCatalogService(prisma, storage(), hotelMatching as never);
      const result = await service.getHotelOffers("hotel-1");
      expect(result.minPrice).toBe(800);
      expect(result.minPartnerCode).toBe("PAR-2");
    });
  });

  // ── C. Сопоставимость туров (13–18) ─────────────────────────────────
  describe("C. Сопоставимость туров", () => {
    const svc = new TourMatchingService({} as PrismaService);
    const tour = (over: Record<string, unknown> = {}) => ({
      attributes: {
        supplierCode: "VOYAGER", hotelKey: "23280", countryCode: "MV",
        priceDate: "2026-12-15", priceNights: 7, priceAdults: 2,
        mealText: "BB", tourIncValue: "2676", spoKey: "1", ...over,
      },
    });

    it("13. один отель у разных поставщиков + дата/ночи → сопоставимы", () => {
      const a = tour({ supplierCode: "VOYAGER" });
      const b = tour({ supplierCode: "KAZUNION", hotelKey: "15327" });
      expect(svc.areComparable(a, b, "hotel-1", "hotel-1").comparable).toBe(true);
    });

    it("14. разные физические отели → не сопоставимы", () => {
      expect(svc.areComparable(tour(), tour(), "hotel-1", "hotel-2").comparable).toBe(false);
    });

    it("15. разные даты заезда → не сопоставимы", () => {
      expect(svc.areComparable(tour(), tour({ priceDate: "2026-12-16" }), "h", "h").comparable).toBe(false);
    });

    it("16. разные ночи или число взрослых → не сопоставимы", () => {
      expect(svc.areComparable(tour(), tour({ priceNights: 3 }), "h", "h").comparable).toBe(false);
      expect(svc.areComparable(tour(), tour({ priceAdults: 1 }), "h", "h").comparable).toBe(false);
    });

    it("17. разное питание у разных поставщиков → не сопоставимы", () => {
      expect(svc.areComparable(tour(), tour({ mealText: "ALL INCLUSIVE", supplierCode: "ANEX" }), "h", "h").comparable).toBe(false);
    });

    it("18. заглушка tourIncValue='0' не блокирует сопоставление", () => {
      const a = tour({ supplierCode: "ANEX", tourIncValue: "0" });
      const b = tour({ supplierCode: "ANEX", tourIncValue: "2676" });
      expect(svc.areComparable(a, b, "h", "h").comparable).toBe(true);
    });
  });

  // ── D. Карточка и витрина (19–23) ───────────────────────────────────
  describe("D. Карточка и витрина", () => {
    it("19. applyCanonicalName сохраняет хвост программы тура", () => {
      expect(applyCanonicalName("OLD HOTEL — Baku–Dubai (GDS)", "NEW HOTEL"))
        .toBe("NEW HOTEL — Baku–Dubai (GDS)");
    });

    it("20. applyCanonicalName сохраняет гео-хвост карточки отеля", () => {
      expect(applyCanonicalName("OLD HOTEL (Baku, Azerbaijan)", "NEW HOTEL"))
        .toBe("NEW HOTEL (Baku, Azerbaijan)");
    });

    it("21. PDP карточка: минимальная цена и код партнёра", async () => {
      const prisma = {
        product: { findFirst: jest.fn().mockResolvedValue(productRow()) },
        partner: { findMany: jest.fn().mockResolvedValue([{ id: "par-1", code: "PAR-1" }, { id: "par-2", code: "PAR-2" }]) },
        supplierFxRate: { findMany: jest.fn().mockResolvedValue([]) },
        hotelSupplierRef: { findUnique: jest.fn().mockResolvedValue(null) },
        hotelPhotoRef: { findUnique: jest.fn().mockResolvedValue(null) },
        publicSellerProfile: { findMany: jest.fn().mockResolvedValue([]) },
        geoCountry: { findUnique: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaService;
      const tourMatching = {
        findComparableTours: jest.fn().mockResolvedValue([
          { id: "alt", code: "PRD-2", title: "Alt", price: 800, currency: "AZN", partnerId: "par-2" },
        ]),
      };
      const detail = await new PublicCatalogService(prisma, storage(), undefined, tourMatching as never)
        .getProductDetail("PRD-00000001");
      expect(detail.product.bestOffer).toMatchObject({
        minPrice: "800", minPartnerCode: "PAR-2", offersCount: 2, hasAlternatives: true,
      });
    });

    it("22. смешанные валюты не дают выдуманный минимум", async () => {
      const prisma = {
        partner: { findMany: jest.fn().mockResolvedValue([{ id: "par-1", code: "PAR-1" }, { id: "par-2", code: "PAR-2" }]) },
        supplierFxRate: { findMany: jest.fn().mockResolvedValue([]) },
      } as unknown as PrismaService;
      const hotelMatching = {
        getOffersForHotel: jest.fn().mockResolvedValue([
          { supplierCode: "KOMPAS", externalKey: "1", productId: "a", productCode: "PRD-1", productName: "A", partnerId: "par-1", price: 900, currency: "AZN" },
          { supplierCode: "VOYAGER", externalKey: "2", productId: "b", productCode: "PRD-2", productName: "B", partnerId: "par-2", price: 500, currency: "USD" },
        ]),
      };
      const result = await new PublicCatalogService(prisma, storage(), hotelMatching as never).getHotelOffers("h");
      expect(result.minPrice).toBeNull();
      expect(result.minPartnerCode).toBeNull();
    });

    it("23. PRD-код и внутренний id ведут к одной группе сопоставимых туров", async () => {
      const prisma = {
        product: { findFirst: jest.fn().mockResolvedValue(productRow({ id: "internal-id" })) },
        partner: { findMany: jest.fn().mockResolvedValue([
          { id: "par-1", code: "PAR-1" }, { id: "par-2", code: "PAR-2" },
        ]) },
        supplierFxRate: { findMany: jest.fn().mockResolvedValue([]) },
      } as unknown as PrismaService;
      const tourMatching = {
        findComparableTours: jest.fn().mockResolvedValue([
          { id: "alt", code: "PRD-2", title: "Alt", price: 800, currency: "AZN", partnerId: "par-2" },
        ]),
      };
      const service = new PublicCatalogService(prisma, storage(), undefined, tourMatching as never);
      const byCode = await service.getComparableTours("PRD-00000001");
      const byId = await service.getComparableTours("internal-id");
      expect(byCode.count).toBe(2);
      expect(byId.count).toBe(2);
      expect(tourMatching.findComparableTours).toHaveBeenCalledWith("internal-id", expect.anything());
    });
  });

  // ── E. Безопасность и аудит (24–26) ─────────────────────────────────
  describe("E. Безопасность и аудит", () => {
    it("24. публичный контур не отдаёт внутренний partnerId", async () => {
      const prisma = {
        product: { findFirst: jest.fn().mockResolvedValue(productRow({ id: "internal-id" })) },
        partner: { findMany: jest.fn().mockResolvedValue([{ id: "par-1", code: "PAR-1" }, { id: "par-2", code: "PAR-2" }]) },
        supplierFxRate: { findMany: jest.fn().mockResolvedValue([]) },
      } as unknown as PrismaService;
      const tourMatching = {
        findComparableTours: jest.fn().mockResolvedValue([
          { id: "alt", code: "PRD-2", title: "Alt", price: 800, currency: "AZN", partnerId: "par-2" },
        ]),
      };
      const result = await new PublicCatalogService(prisma, storage(), undefined, tourMatching as never)
        .getComparableTours("PRD-00000001");
      expect(JSON.stringify(result)).not.toContain("partnerId");
      expect(result.comparable[0].partnerCode).toBe("PAR-2");
    });

    it("25. ручное слияние отелей пишет ProductHistory продуктов дубликата", async () => {
      const productHistoryCreate = jest.fn().mockResolvedValue({});
      const tx = {
        hotel: {
          findUnique: jest.fn((args: { where: { id: string } }) =>
            Promise.resolve({ id: args.where.id, name: args.where.id === "canonical" ? "CANONICAL" : "DUP", countryCode: "TR", cityName: "Стамбул" }),
          ),
          update: jest.fn().mockResolvedValue({}),
          delete: jest.fn().mockResolvedValue({}),
        },
        hotelSupplierRef: {
          findMany: jest.fn().mockResolvedValue([{ supplierCode: "KOMPAS", externalKey: "100" }]),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        product: {
          findMany: jest.fn().mockResolvedValue([
            { id: "p1", version: 3, attributes: { supplierCode: "KOMPAS", hotelKey: "100" } },
          ]),
          update: jest.fn().mockResolvedValue({}),
        },
        productHistory: { create: productHistoryCreate },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      const prisma = { $transaction: jest.fn((fn: (t: unknown) => unknown) => Promise.resolve(fn(tx))) } as unknown as PrismaService;
      const result = await new HotelMatchReviewService(prisma).mergeHotels("canonical", "dup", { id: "u1", username: "admin" });
      expect(result.ok).toBe(true);
      expect(productHistoryCreate).toHaveBeenCalledTimes(1);
      expect(productHistoryCreate.mock.calls[0][0].data).toMatchObject({
        action: "hotel.matching.merge", version: 3, productId: "p1", actorId: "u1",
      });
    });

    it("26. история sync не пишется для пустого набора изменений", async () => {
      const create = jest.fn().mockResolvedValue({});
      const tx = { productHistory: { create } } as never;
      const recorder = new ProductHistoryRecorder();
      await recorder.record(tx, "p1", 1, {});
      await recorder.record(tx, "p1", 1, { title: undefined });
      expect(create).not.toHaveBeenCalled();
    });
  });
});
