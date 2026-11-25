import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export interface ComparableTour {
  id: string;
  code: string;
  title: string;
  price: number | null;
  currency: string;
  partnerId: string | null;
}

/**
 * Параметры сопоставимости тура. Ключи взяты из реальных attributes синка:
 * ANEX использует mealInc/mealName/roomInc/roomName/townInc/townFrom,
 * остальные — mealKey/mealText/roomKey/roomText/tourIncValue/townFromInc.
 */
interface TourParams {
  hotelKey: string;
  supplierCode: string;
  countryCode: string;
  country: string;
  city: string;
  priceDate: string;
  priceNights: number | null;
  priceAdults: number | null;
  mealKey: string;
  mealText: string;
  roomKey: string;
  tourIncValue: string;
  tourIncName: string;
  townFrom: string;
  airline: string;
}

/** Нормализация текста: "\"BB..\"", "\" BB \"" → "bb". */
function norm(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().toLocaleLowerCase("ru-RU")
    : "";
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Сопоставимость туров для «Другие предложения».
 *
 * Источник истины по отелю — HotelSupplierRef → Hotel.id (поставщические
 * hotelKey не пересекаются). Дополнительно сравниваются дата, число ночей и
 * взрослых, питание, маршрут и авиакомпания — но только там, где поле реально
 * заполнено у ОБОИХ туров. Vendor-specific идентификаторы (mealKey, roomKey,
 * tourIncValue) сравниваются только внутри одного поставщика: "4" у ANEX и
 * "4" у KOMPAS — разные справочники, и их совпадение не доказывает то же самое.
 *
 * Пустые поля НЕ означают «совпало» как сильный признак — они просто не
 * опровергают сопоставимость. Решение остаётся консервативным: при расхождении
 * известных признаков туры в одну группу не попадают.
 */
@Injectable()
export class TourMatchingService {
  private readonly logger = new Logger(TourMatchingService.name);

  constructor(private readonly prisma: PrismaService) {}

  private static extract(params: { attributes: unknown }): TourParams {
    const a = (params.attributes ?? {}) as Record<string, unknown>;
    const flight = a.flightAddon as { source?: unknown } | null | undefined;
    return {
      hotelKey: typeof a.hotelKey === "string" || typeof a.hotelKey === "number" ? String(a.hotelKey) : "",
      supplierCode: typeof a.supplierCode === "string" ? a.supplierCode.trim().toUpperCase() : "",
      countryCode: typeof a.countryCode === "string" ? a.countryCode.trim().toUpperCase() : "",
      country: norm(a.country) || norm(a.countryName),
      city: norm(a.city) || norm(a.hotelCity) || norm(a.townInc),
      priceDate: typeof a.priceDate === "string" ? a.priceDate.trim() : "",
      priceNights: num(a.priceNights ?? a.nights),
      priceAdults: num(a.priceAdults),
      mealKey: typeof a.mealKey === "string" || typeof a.mealKey === "number" ? String(a.mealKey) : "",
      mealText: norm(a.mealText) || norm(a.mealName),
      roomKey: typeof a.roomKey === "string" || typeof a.roomKey === "number" ? String(a.roomKey) : "",
      tourIncValue: typeof a.tourIncValue === "string" || typeof a.tourIncValue === "number" ? String(a.tourIncValue) : "",
      tourIncName: norm(a.tourIncName),
      townFrom: norm(a.townFrom) || norm(a.townFromInc) || norm(a.townFromKey),
      airline: norm(flight?.source) || norm(a.airline) || norm(a.airlineCode),
    };
  }

  /** (supplierCode, hotelKey) → Hotel.id. Один запрос на пачку туров. */
  private async hotelIdsByTourKeys(tours: Array<{ attributes: unknown }>): Promise<Map<string, string>> {
    const pairs = new Map<string, { supplierCode: string; externalKey: string }>();
    for (const tour of tours) {
      const p = TourMatchingService.extract(tour);
      if (!p.supplierCode || !p.hotelKey) continue;
      pairs.set(`${p.supplierCode}\u0000${p.hotelKey}`, { supplierCode: p.supplierCode, externalKey: p.hotelKey });
    }
    const map = new Map<string, string>();
    if (pairs.size === 0) return map;
    const refs = await this.prisma.hotelSupplierRef.findMany({
      where: { OR: [...pairs.values()].map((p) => ({ supplierCode: p.supplierCode, externalKey: p.externalKey })) },
      select: { supplierCode: true, externalKey: true, hotelId: true },
    });
    for (const ref of refs) map.set(`${ref.supplierCode}\u0000${ref.externalKey}`, ref.hotelId);
    return map;
  }

  /**
   * Сравнить два тура. `hotelIdA/B` — заранее разрешённые физические отели,
   * чтобы не делать запрос на каждую пару.
   */
  areComparable(
    tourA: { attributes: unknown },
    tourB: { attributes: unknown },
    hotelIdA?: string | null,
    hotelIdB?: string | null,
  ): { comparable: boolean; reasons: string[] } {
    const a = TourMatchingService.extract(tourA);
    const b = TourMatchingService.extract(tourB);
    const sameSupplier = a.supplierCode === b.supplierCode && !!a.supplierCode;
    const fail = (reason: string) => ({ comparable: false, reasons: [reason] });

    // 1. Один и тот же физический отель. Без реестра — только совпадение
    //    supplier-native ключа внутри одного поставщика.
    if (hotelIdA && hotelIdB) {
      if (hotelIdA !== hotelIdB) return fail("разные гостиницы");
    } else if (!(sameSupplier && a.hotelKey && a.hotelKey === b.hotelKey)) {
      return fail("разные отели");
    }

    // 2. География: ISO-код надёжнее названия (названия даются на разных языках).
    if (a.countryCode && b.countryCode && a.countryCode !== b.countryCode) return fail("разная страна");
    if (!a.countryCode && !b.countryCode && a.country && b.country && a.country !== b.country) return fail("разная страна");
    if (a.city && b.city && a.city !== b.city) return fail("разный город");

    // 3. Дата и параметры бронирования должны совпадать.
    if (a.priceDate && b.priceDate && a.priceDate !== b.priceDate) return fail("разная дата");
    if (a.priceNights != null && b.priceNights != null && a.priceNights !== b.priceNights) return fail("разная длительность");
    if (a.priceAdults != null && b.priceAdults != null && a.priceAdults !== b.priceAdults) return fail("разное число взрослых");

    // 4. Питание: vendor-ключи только внутри поставщика; между поставщиками
    //    сравниваем человекочитаемое название ("BB", "LUXURY ALL INCLUSIVE").
    if (sameSupplier && a.mealKey && b.mealKey && a.mealKey !== b.mealKey) return fail("разное питание");
    if (!sameSupplier && a.mealText && b.mealText && a.mealText !== b.mealText) return fail("разное питание");

    // 5. Маршрут и номер: supplier-specific коды, сравниваем только внутри one supplier.
    //    "0" у ANEX — заглушка, а не реальный маршрут.
    if (sameSupplier && a.tourIncValue && b.tourIncValue && a.tourIncValue !== b.tourIncValue && a.tourIncValue !== "0" && b.tourIncValue !== "0") {
      return fail("разный маршрут");
    }
    if (a.townFrom && b.townFrom && a.townFrom !== b.townFrom) return fail("разный город вылета");
    if (a.airline && b.airline && a.airline !== b.airline) return fail("разная авиакомпания");
    if (sameSupplier && a.roomKey && b.roomKey && a.roomKey !== b.roomKey) return fail("разный тип номера");

    return { comparable: true, reasons: [] };
  }

  /**
   * Все сопоставимые туры. `visibility` — публичный фильтр (marketplaceWhere),
   * чтобы не отдавать черновики/чужие каналы.
   */
  async findComparableTours(
    productId: string,
    visibility: Prisma.ProductWhereInput = {},
  ): Promise<ComparableTour[]> {
    const base = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, type: true, attributes: true },
    });
    if (!base || base.type !== "TOUR") return [];

    // Без всякого философического "city" фильтра: в реальных attributes туров
    // такого поля нет, и выборка получалась пустой. Кандидатов отбираем по
    // дате/стране, но NULL-значения тоже включаем (areComparable решит точно).
    const a = TourMatchingService.extract(base);
    const prefilter: Prisma.ProductWhereInput[] = [];
    if (a.priceDate) {
      prefilter.push({ OR: [
        { attributes: { path: ["priceDate"], equals: a.priceDate } },
        { attributes: { path: ["priceDate"], equals: Prisma.AnyNull } },
      ] });
    }
    if (a.countryCode) {
      prefilter.push({ OR: [
        { attributes: { path: ["countryCode"], equals: a.countryCode } },
        { attributes: { path: ["countryCode"], equals: Prisma.AnyNull } },
      ] });
    }

    const candidates = await this.prisma.product.findMany({
      where: {
        type: "TOUR",
        status: "PUBLISHED",
        id: { not: base.id },
        ...visibility,
        ...(prefilter.length ? { AND: prefilter } : {}),
      },
      select: { id: true, code: true, title: true, partnerId: true, attributes: true },
    });
    if (candidates.length === 0) return [];

    const hotelIds = await this.hotelIdsByTourKeys([base, ...candidates]);
    const baseKey = TourMatchingService.extract(base);
    const baseHotelId = hotelIds.get(`${baseKey.supplierCode}\u0000${baseKey.hotelKey}`) ?? null;

    const comparable: ComparableTour[] = [];
    for (const candidate of candidates) {
      const params = TourMatchingService.extract(candidate);
      const hotelId = hotelIds.get(`${params.supplierCode}\u0000${params.hotelKey}`) ?? null;
      const { comparable: isComparable } = this.areComparable(base, candidate, baseHotelId, hotelId);
      if (!isComparable) continue;
      const attrs = (candidate.attributes ?? {}) as Record<string, unknown>;
      comparable.push({
        id: candidate.id,
        code: candidate.code,
        title: candidate.title,
        price: typeof attrs.startingPrice === "number" && attrs.startingPrice > 0 ? attrs.startingPrice : null,
        currency: typeof attrs.currency === "string" ? attrs.currency : "AZN",
        partnerId: candidate.partnerId,
      });
    }
    return comparable;
  }
}
