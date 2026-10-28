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

/** Параметры сопоставимости, извлекаемые из attributes продукта-тура. */
interface TourParams {
  hotelKey: string;
  supplierCode: string;
  country: string;
  city: string;
  nights: number | null;
  departureCity: string;
  airline: string;
}

/**
 * TourMatchingService — сопоставимость туров для «Другие предложения».
 *
 * Два тура сопоставимы, если у них ОДНА физическая гостиница (через
 * HotelSupplierRef → Hotel.id, а не по supplier-native hotelKey: ключи разных
 * поставщиков не пересекаются), совпадают страна/город, длительность, город
 * вылета и авиакомпания — там, где поля заполнены. Если гостиничная привязка
 * ещё не построена, сравниваем только туры одного поставщика с одинаковым
 * hotelKey (консервативный fallback: не выдаём чужие отели за тот же самый).
 */
@Injectable()
export class TourMatchingService {
  private readonly logger = new Logger(TourMatchingService.name);

  constructor(private readonly prisma: PrismaService) {}

  private static text(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
  }

  private static extract(params: { attributes: unknown }): TourParams {
    const a = (params.attributes ?? {}) as Record<string, unknown>;
    const nightsRaw = a.nights != null ? Number(a.nights) : null;
    return {
      hotelKey: TourMatchingService.text(a.hotelKey) || (a.hotelKey != null ? String(a.hotelKey) : ""),
      supplierCode: TourMatchingService.text(a.supplierCode),
      country: TourMatchingService.text(a.country) || TourMatchingService.text(a.countryName),
      city: TourMatchingService.text(a.city),
      nights: nightsRaw != null && Number.isFinite(nightsRaw) ? nightsRaw : null,
      departureCity: TourMatchingService.text(a.departureCity),
      airline: TourMatchingService.text(a.airline) || TourMatchingService.text(a.airlineCode),
    };
  }

  /** HotelRef-ключ тура (supplierCode + hotelKey) → Hotel.id, если реестр знает отель. */
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
   * Сравнить два тура. `hotelIdA/B` — заранее разрешённые физические отели
   * (из hotelIdsByTourKeys), чтобы не делать запрос на каждую пару.
   */
  areComparable(
    tourA: { attributes: unknown },
    tourB: { attributes: unknown },
    hotelIdA?: string | null,
    hotelIdB?: string | null,
  ): { comparable: boolean; reasons: string[] } {
    const a = TourMatchingService.extract(tourA);
    const b = TourMatchingService.extract(tourB);

    // 1. Один и тот же физический отель. Гостиничный реестр — источник истины;
    //    без него допускаем только supplier-native совпадение внутри поставщика.
    if (hotelIdA && hotelIdB) {
      if (hotelIdA !== hotelIdB) return { comparable: false, reasons: ["разные гостиницы"] };
    } else if (!(a.supplierCode && a.supplierCode === b.supplierCode && a.hotelKey && a.hotelKey === b.hotelKey)) {
      return { comparable: false, reasons: ["разные отели"] };
    }

    if (a.country && b.country && a.country.toLowerCase() !== b.country.toLowerCase()) {
      return { comparable: false, reasons: ["разная страна"] };
    }
    if (a.city && b.city && a.city.toLowerCase() !== b.city.toLowerCase()) {
      return { comparable: false, reasons: ["разный город"] };
    }
    if (a.nights != null && b.nights != null && a.nights !== b.nights) {
      return { comparable: false, reasons: ["разная длительность"] };
    }
    if (a.departureCity && b.departureCity && a.departureCity.toLowerCase() !== b.departureCity.toLowerCase()) {
      return { comparable: false, reasons: ["разный город вылета"] };
    }
    if (a.airline && b.airline && a.airline.toLowerCase() !== b.airline.toLowerCase()) {
      return { comparable: false, reasons: ["разная авиакомпания"] };
    }
    return { comparable: true, reasons: [] };
  }

  /**
   * Все сопоставимые туры для данного продукта. visibility — публичный фильтр
   * (marketplaceWhere), чтобы не отдавать черновики/чужие каналы.
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

    const baseAttrs = (base.attributes ?? {}) as Record<string, unknown>;
    const city = TourMatchingService.text(baseAttrs.city);
    const candidates = await this.prisma.product.findMany({
      where: {
        type: "TOUR",
        status: "PUBLISHED",
        id: { not: base.id },
        ...visibility,
        ...(city ? { attributes: { path: ["city"], equals: city } } : {}),
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
