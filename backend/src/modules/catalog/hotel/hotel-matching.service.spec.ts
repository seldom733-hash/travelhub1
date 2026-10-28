import { HotelMatchingService } from "./hotel-matching.service";
import type { PrismaService } from "../../../prisma/prisma.service";

/**
 * Регрессия §HOTEL-OFFERS: ранняя версия выбирала ПЕРВЫЙ продукт поставщика
 * (`findFirst attributes.supplierCode`), поэтому цена бралась у другого отеля.
 * Тест фиксирует: предложение ищется по supplierRef конкретного hotelKey
 * (включая границу `-`, чтобы ключ 123 не совпал с 1234), а при нескольких
 * продуктах одного отеля выбирается самый дешёвый.
 */
function serviceWith(products: Array<Record<string, unknown>>, refs: Array<{ supplierCode: string; externalKey: string }>) {
  const prisma = {
    hotelSupplierRef: { findMany: jest.fn().mockResolvedValue(refs) },
    product: { findMany: jest.fn().mockResolvedValue(products) },
  } as unknown as PrismaService;
  return new HotelMatchingService(prisma);
}

function product(over: Record<string, unknown>) {
  return {
    id: "p",
    code: "PRD-1",
    title: "Hotel",
    partnerId: "partner-1",
    supplierRef: "KOMPASHTL-123-1",
    attributes: { startingPrice: 100, currency: "AZN", supplierCode: "KOMPAS", hotelKey: "123" },
    ...over,
  };
}

describe("HotelMatchingService.getOffersForHotel", () => {
  it("не берёт продукт другого отеля с префиксным ключом (123 vs 1234)", async () => {
    const svc = serviceWith(
      [
        product({ id: "p-1234", code: "PRD-1234", supplierRef: "KOMPASHTL-1234-1", attributes: { startingPrice: 10, currency: "AZN" } }),
        product({ id: "p-123", code: "PRD-123", supplierRef: "KOMPASHTL-123-1", attributes: { startingPrice: 900, currency: "AZN" } }),
      ],
      [{ supplierCode: "KOMPAS", externalKey: "123" }],
    );

    const offers = await svc.getOffersForHotel("hotel-1");

    expect(offers).toHaveLength(1);
    expect(offers[0].productId).toBe("p-123");
    expect(offers[0].price).toBe(900);
    expect(offers[0].supplierCode).toBe("KOMPAS");
    expect(offers[0].externalKey).toBe("123");
  });

  it("несколько продуктов одного отеля → самый дешёвый как одно предложение", async () => {
    const svc = serviceWith(
      [
        product({ id: "expensive", code: "PRD-A", supplierRef: "KOMPASHTL-77-1", attributes: { startingPrice: 1200, currency: "AZN" } }),
        product({ id: "cheap", code: "PRD-B", supplierRef: "KOMPASHTL-77-2", attributes: { startingPrice: 800, currency: "AZN" } }),
      ],
      [{ supplierCode: "KOMPAS", externalKey: "77" }],
    );

    const offers = await svc.getOffersForHotel("hotel-1");

    expect(offers).toHaveLength(1);
    expect(offers[0].productId).toBe("cheap");
    expect(offers[0].price).toBe(800);
  });

  it("отель без привязок → пустой список без запроса продуктов", async () => {
    const prisma = {
      hotelSupplierRef: { findMany: jest.fn().mockResolvedValue([]) },
      product: { findMany: jest.fn() },
    } as unknown as PrismaService;
    const svc = new HotelMatchingService(prisma);

    await expect(svc.getOffersForHotel("hotel-x")).resolves.toEqual([]);
    expect((prisma.product.findMany as jest.Mock)).not.toHaveBeenCalled();
  });

  it("публичный visibility-фильтр прокидывается в запрос продуктов", async () => {
    const prisma = {
      hotelSupplierRef: { findMany: jest.fn().mockResolvedValue([{ supplierCode: "KOMPAS", externalKey: "1" }]) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const svc = new HotelMatchingService(prisma);

    await svc.getOffersForHotel("hotel-1", { publicationChannels: { some: { channel: "MARKETPLACE" } } });

    const where = (prisma.product.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.publicationChannels).toEqual({ some: { channel: "MARKETPLACE" } });
    expect(where.OR).toEqual([{ supplierRef: { startsWith: "KOMPASHTL-1-" } }]);
  });
});
