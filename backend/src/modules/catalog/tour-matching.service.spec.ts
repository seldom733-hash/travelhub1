import { TourMatchingService } from "./tour-matching.service";
import type { PrismaService } from "../../prisma/prisma.service";

/**
 * Сценарии сопоставимости туров по ТЗ: дата / длительность / питание /
 * маршрут / авиакомпания. Идентификаторы поставщиков НЕ пересекаются,
 * поэтому физический отель определяется через HotelSupplierRef → Hotel.id.
 */
function tour(over: Record<string, unknown> = {}) {
  return {
    attributes: {
      supplierCode: "KOMPAS",
      hotelKey: "100",
      countryCode: "TR",
      priceDate: "2026-11-25",
      priceNights: 3,
      priceAdults: 2,
      mealKey: "4",
      mealText: "BB",
      roomKey: "10",
      tourIncValue: "256",
      startingPrice: 1000,
      currency: "AZN",
      ...over,
    },
  };
}

describe("TourMatchingService.areComparable", () => {
  const svc = new TourMatchingService({} as PrismaService);

  it("один отель у разных поставщиков + совпавшие дата/ночи/взрослые/питание → сопоставимы", () => {
    const a = tour();
    const b = tour({ supplierCode: "VOYAGER", hotelKey: "999", mealKey: "77" });
    expect(svc.areComparable(a, b, "hotel-1", "hotel-1").comparable).toBe(true);
  });

  it("разные физические отели → не сопоставимы", () => {
    const { comparable, reasons } = svc.areComparable(tour(), tour({ hotelKey: "200" }), "hotel-1", "hotel-2");
    expect(comparable).toBe(false);
    expect(reasons[0]).toContain("гостиниц");
  });

  it("без реестра: только тот же hotelKey внутри одного поставщика", () => {
    expect(svc.areComparable(tour(), tour({ hotelKey: "100" })).comparable).toBe(true);
    expect(svc.areComparable(tour(), tour({ supplierCode: "VOYAGER", hotelKey: "100" })).comparable).toBe(false);
  });

  it("разные даты → не сопоставимы", () => {
    const { comparable, reasons } = svc.areComparable(tour(), tour({ priceDate: "2026-12-01" }), "h", "h");
    expect(comparable).toBe(false);
    expect(reasons[0]).toContain("дата");
  });

  it("разная длительность / число взрослых → не сопоставимы", () => {
    expect(svc.areComparable(tour(), tour({ priceNights: 7 }), "h", "h").comparable).toBe(false);
    expect(svc.areComparable(tour(), tour({ priceAdults: 1 }), "h", "h").comparable).toBe(false);
  });

  it("разное питание у разных поставщиков → не сопоставимы (сравниваем mealText)", () => {
    const a = tour({ supplierCode: "KOMPAS", mealText: "BB" });
    const b = tour({ supplierCode: "VOYAGER", mealText: "ALL INCLUSIVE" });
    expect(svc.areComparable(a, b, "h", "h").comparable).toBe(false);
  });

  it("совпадение vendor-ключа питания у разных поставщиков — не доказательство", () => {
    const a = tour({ supplierCode: "KOMPAS", mealKey: "4", mealText: "BB" });
    const b = tour({ supplierCode: "ANEX", mealKey: "4", mealText: "ALL INCLUSIVE" });
    expect(svc.areComparable(a, b, "h", "h").comparable).toBe(false);
  });

  it("один поставщик: разные mealKey/roomKey/tourIncValue → не сопоставимы", () => {
    expect(svc.areComparable(tour(), tour({ mealKey: "9" }), "h", "h").comparable).toBe(false);
    expect(svc.areComparable(tour(), tour({ roomKey: "11" }), "h", "h").comparable).toBe(false);
    expect(svc.areComparable(tour(), tour({ tourIncValue: "999" }), "h", "h").comparable).toBe(false);
  });

  it("ANEX tourIncValue='0' — заглушка, не маршрут: не должна блокировать", () => {
    const a = tour({ supplierCode: "ANEX", tourIncValue: "0" });
    const b = tour({ supplierCode: "ANEX", tourIncValue: "256" });
    expect(svc.areComparable(a, b, "h", "h").comparable).toBe(true);
  });

  it("разные города вылета и авиакомпании → не сопоставимы", () => {
    expect(svc.areComparable(tour({ townFrom: "baku" }), tour({ townFrom: "tbilisi" }), "h", "h").comparable).toBe(false);
    expect(svc.areComparable(
      tour({ flightAddon: { source: "AZAL" } }),
      tour({ flightAddon: { source: "TK" } }),
      "h",
      "h",
    ).comparable).toBe(false);
  });

  it("поле вылета заполнено только у одного тура — не опровергает сопоставимость", () => {
    expect(svc.areComparable(tour(), tour({ townFrom: "baku" }), "h", "h").comparable).toBe(true);
  });

  it("разные страны (ISO и название) → не сопоставимы", () => {
    expect(svc.areComparable(tour(), tour({ countryCode: "GE" }), "h", "h").comparable).toBe(false);
    expect(svc.areComparable(
      tour({ countryCode: "", country: "Турция" }),
      tour({ countryCode: "", country: "Грузия" }),
      "h",
      "h",
    ).comparable).toBe(false);
  });

  it("пустые поля не создают ложное совпадение: отель+дата совпали → сопоставимы", () => {
    const a = tour({ mealText: "", priceNights: null, tourIncValue: "" });
    const b = tour({ mealText: "", priceNights: null, tourIncValue: "" });
    expect(svc.areComparable(a, b, "h", "h").comparable).toBe(true);
  });
});

describe("TourMatchingService.findComparableTours", () => {
  it("не включает черновики и продукты вне видимости; цена и валюта берутся из attributes", async () => {
    const base = tour();
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({ id: "base", type: "TOUR", attributes: base.attributes }),
        // БД уже применила visibility — черновик в выборку не попадает
        findMany: jest.fn().mockResolvedValue([
          { id: "ok", code: "PRD-OK", title: "OK", partnerId: "p2", attributes: tour({ startingPrice: 700 }).attributes },
        ]),
      },
      hotelSupplierRef: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const svc = new TourMatchingService(prisma);

    const result = await svc.findComparableTours("base", { status: "PUBLISHED" });

    expect(result.map((r) => r.id)).toEqual(["ok"]);
    expect(result[0].price).toBe(700);
    expect(result[0].currency).toBe("AZN");
    // Фильтр видимости передан в БД, а не применён после выборки
    expect((prisma.product.findMany as jest.Mock).mock.calls[0][0].where.status).toBe("PUBLISHED");
  });

  it("не-тур возвращает пустой список и не делает выборку кандидатов", async () => {
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({ id: "x", type: "HOTEL", attributes: {} }),
        findMany: jest.fn(),
      },
    } as unknown as PrismaService;
    const svc = new TourMatchingService(prisma);
    expect(await svc.findComparableTours("x")).toEqual([]);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });
});
