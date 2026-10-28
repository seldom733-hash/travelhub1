import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  cleanHotelName,
  groupHotelRefs,
  normalizeName,
  parseStars,
  type HotelGroup,
  type HotelRef,
} from "./hotel-identity";

/** Предложение поставщика по одной физической гостинице (для «Другие предложения»). */
export interface HotelOffer {
  supplierCode: string;
  externalKey: string;
  productId: string;
  productCode: string;
  productName: string;
  partnerId: string | null;
  /** Цена из атрибутов продукта в его собственной валюте (startingPrice). */
  price: number | null;
  currency: string;
}

export interface HotelSyncResult {
  groups: number;
  refs: number;
  created: number;
  updated: number;
  attached: number;
}

/**
 * HotelMatchingService — единая идентичность физической гостиницы.
 *
 * Оборачивает чистую логику hotel-identity.ts (groupHotelRefs) и ведёт
 * catalog.Hotel + catalog.HotelSupplierRef: один supplier-native id
 * (supplierCode, hotelKey) = одна запись отеля, а одинаковые (имя, страна,
 * город) у разных поставщиков = одна физическая гостиница.
 *
 * Правила, важные для корректности:
 *  - НИКОГДА не перепривязываем существующий HotelSupplierRef к другому Hotel
 *    при синке: ручное слияние (HotelMatchReviewService.mergeHotels) иначе
 *    откатывалось бы при каждом следующем синке. Меняются только описательные
 *    поля ref-а.
 *  - Звёздность в ключ группы не входит: поставщики переклассифицируют отель.
 */
@Injectable()
export class HotelMatchingService {
  private readonly logger = new Logger(HotelMatchingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Supplier-native id отеля из атрибутов продукта (hotelKey / hotelExternalId). */
  private static hotelKeyOf(attributes: unknown): string {
    const a = (attributes ?? {}) as Record<string, unknown>;
    const key =
      typeof a.hotelKey === "string" && a.hotelKey.trim()
        ? a.hotelKey.trim()
        : typeof a.hotelExternalId === "string"
          ? a.hotelExternalId.trim()
          : a.hotelKey != null
            ? String(a.hotelKey)
            : "";
    return key;
  }

  /** HotelRef из строки продукта поставщика; null — если отель не идентифицируется. */
  private static refFromProduct(
    supplierCode: string,
    product: { title: string; attributes: unknown },
    source: "product" | "geolink",
  ): HotelRef | null {
    const a = (product.attributes ?? {}) as Record<string, unknown>;
    const hotelKey = HotelMatchingService.hotelKeyOf(a);
    if (!hotelKey) return null;
    const rawName = typeof a.hotelName === "string" && a.hotelName.trim() ? a.hotelName : product.title || "";
    // Display-имя — без хвостов «(Город)» и «5*», как в scripts/hotel-registry.ts:
    // Hotel.name становится каноническим именем карточки, поэтому звёзды и город
    // в нём дублировать нельзя.
    const name = cleanHotelName(rawName);
    if (!name) return null;
    const cityName = typeof a.city === "string" ? a.city : "";
    const rawStars = a.stars != null ? Number(a.stars) : parseStars(rawName);
    return {
      supplierCode,
      externalKey: hotelKey,
      name,
      normalizedName: normalizeName(name),
      stars: Number.isFinite(rawStars) ? rawStars : null,
      countryCode: (typeof a.countryCode === "string" ? a.countryCode : "").trim().toUpperCase(),
      countryName: typeof a.country === "string" ? a.country : typeof a.countryName === "string" ? a.countryName : "",
      cityName,
      cityKey: normalizeName(cityName),
      resortName: typeof a.resort === "string" ? a.resort : typeof a.resortName === "string" ? a.resortName : "",
      hotelHref: typeof a.hotelHref === "string" ? a.hotelHref : "",
      source,
    };
  }

  /**
   * Собрать HotelRef-ы одного поставщика из опубликованных продуктов.
   * type=HOTEL — карточки услуги «Отели»; type=TOUR — отель внутри тура.
   * Один (supplierCode, hotelKey) даёт один ref, даже если продукт есть в обоих
   * контурах: тур и услуга «Отели» с тем же ключом — один отель.
   */
  async buildRefs(supplierCode: string, type: "HOTEL" | "TOUR"): Promise<HotelRef[]> {
    const products = await this.prisma.product.findMany({
      where: { type, status: "PUBLISHED" },
      select: { title: true, attributes: true },
    });
    const refs: HotelRef[] = [];
    for (const product of products) {
      const a = (product.attributes ?? {}) as Record<string, unknown>;
      if (a.supplierCode !== supplierCode) continue;
      const ref = HotelMatchingService.refFromProduct(supplierCode, product, "product");
      if (ref) refs.push(ref);
    }
    return refs;
  }

  /**
   * Синхронизировать реестр отелей поставщика с каталогом продуктов.
   * Создаёт новые Hotel и добавляет новые ref-ы; существующие ref-ы не
   * перепривязывает (см. правило класса). Возвращает счётчики для лога/API.
   */
  async syncSupplierHotels(supplierCode: string): Promise<HotelSyncResult> {
    const allRefs = [...(await this.buildRefs(supplierCode, "HOTEL")), ...(await this.buildRefs(supplierCode, "TOUR"))];

    const byKey = new Map<string, HotelRef>();
    for (const ref of allRefs) {
      const key = `${ref.supplierCode}\u0000${ref.externalKey}`;
      if (!byKey.has(key)) byKey.set(key, ref);
    }
    const refs = [...byKey.values()];
    if (refs.length === 0) {
      this.logger.log(`HotelMatching [${supplierCode}]: нет продуктов с идентификатором отеля — пропуск`);
      return { groups: 0, refs: 0, created: 0, updated: 0, attached: 0 };
    }

    // Существующие привязки: ref уже привязан к отелю (в т.ч. вручную слитому).
    const existing = await this.prisma.hotelSupplierRef.findMany({
      where: { supplierCode },
      select: { externalKey: true, hotelId: true },
    });
    const boundHotelByKey = new Map(existing.map((r) => [r.externalKey, r.hotelId] as const));

    const groups = groupHotelRefs(refs);
    let created = 0;
    let updated = 0;
    let attached = 0;

    for (const group of groups) {
      const boundIds = [...new Set(
        group.refs.map((ref) => boundHotelByKey.get(ref.externalKey)).filter((id): id is string => !!id),
      )].sort();
      if (boundIds.length > 1) {
        // Один и тот же отель уже разнесён по разным Hotel (ручной split или
        // исторические данные). Ничего не склеиваем автоматически: это решение
        // менеджера, а не синка.
        this.logger.warn(
          `HotelMatching [${supplierCode}]: ${group.key} привязан к ${boundIds.length} отелям — авто-слияние запрещено`,
        );
      }

      const hotelId = boundIds.length > 0
        ? boundIds[0]
        : await this.findOrCreateHotel(group, () => { created += 1; });

      for (const ref of group.refs) {
        const update = {
          name: ref.name,
          countryCode: ref.countryCode,
          cityName: ref.cityName,
          resortName: ref.resortName,
          stars: ref.stars,
          lastSeenAt: new Date(),
        };
        if (boundHotelByKey.has(ref.externalKey)) {
          // hotelId намеренно НЕ меняется: ручное слияние должно выживать синк.
          await this.prisma.hotelSupplierRef.update({
            where: { supplierCode_externalKey: { supplierCode: ref.supplierCode, externalKey: ref.externalKey } },
            data: update,
          });
          updated += 1;
        } else {
          await this.prisma.hotelSupplierRef.create({
            data: {
              ...update,
              hotelId,
              supplierCode: ref.supplierCode,
              externalKey: ref.externalKey,
              hotelHref: ref.hotelHref || null,
              source: ref.source,
              firstSeenAt: new Date(),
            },
          });
          attached += 1;
        }
      }
    }

    this.logger.log(
      `HotelMatching [${supplierCode}]: ${refs.length} refs → ${groups.length} groups, ` +
        `+${created} hotel, +${attached} ref, ${updated} ref updated`,
    );
    return { groups: groups.length, refs: refs.length, created, updated, attached };
  }

  /** Найти Hotel по (имя, страна, город) или создать; заполнить пустые поля. */
  private async findOrCreateHotel(group: HotelGroup, onCreate: () => void): Promise<string> {
    const where = {
      normalizedName: group.normalizedName,
      countryCode: group.countryCode,
      cityName: group.cityName,
    };
    const existing = await this.prisma.hotel.findFirst({ where });
    if (existing) {
      const patch: Record<string, unknown> = {};
      if (!existing.countryName && group.countryName) patch.countryName = group.countryName;
      if (!existing.cityName && group.cityName) patch.cityName = group.cityName;
      if (!existing.resortName && group.resortName) patch.resortName = group.resortName;
      if (existing.stars == null && group.stars != null) patch.stars = group.stars;
      if (Object.keys(patch).length > 0) {
        await this.prisma.hotel.update({ where: { id: existing.id }, data: patch });
      }
      return existing.id;
    }
    try {
      const hotel = await this.prisma.hotel.create({
        data: {
          name: group.name,
          normalizedName: group.normalizedName,
          stars: group.stars,
          countryCode: group.countryCode,
          countryName: group.countryName,
          cityName: group.cityName,
          resortName: group.resortName,
        },
      });
      onCreate();
      return hotel.id;
    } catch (error) {
      // Гонка двух синков/запросов на одном ключе: уникальный индекс
      // (normalizedName, countryCode, cityName) — просто перечитываем.
      if ((error as { code?: string }).code !== "P2002") throw error;
      const raced = await this.prisma.hotel.findFirst({ where });
      if (!raced) throw error;
      return raced.id;
    }
  }

  /**
   * Все предложения по физической гостинице (Hotel.id), по одному на
   * supplier-native отель: самый дешёвый опубликованный Product поставщика с
   * этим hotelKey.
   *
   * Продукт ищется по supplierRef (`{SUPPLIER}HTL-{key}-{stateInc}`), а не по
   * первому попавшемуся продукту поставщика: иначе цена бралась бы у другого
   * отеля (реальный дефект ранней версии).
   */
  async getOffersForHotel(hotelId: string, visibility: Prisma.ProductWhereInput = {}): Promise<HotelOffer[]> {
    const refs = await this.prisma.hotelSupplierRef.findMany({
      where: { hotelId },
      select: { supplierCode: true, externalKey: true },
    });
    if (refs.length === 0) return [];

    const products = await this.prisma.product.findMany({
      where: {
        type: "HOTEL",
        status: "PUBLISHED",
        ...visibility,
        OR: refs.map((ref) => ({
          supplierRef: { startsWith: `${ref.supplierCode}HTL-${ref.externalKey}-` },
        })),
      },
      select: {
        id: true,
        code: true,
        title: true,
        partnerId: true,
        supplierRef: true,
        attributes: true,
      },
    });

    const best = new Map<string, HotelOffer>();
    for (const product of products) {
      const ref = refs.find(
        (candidate) =>
          typeof product.supplierRef === "string" &&
          product.supplierRef.startsWith(`${candidate.supplierCode}HTL-${candidate.externalKey}-`),
      );
      if (!ref) continue;
      const attrs = (product.attributes ?? {}) as Record<string, unknown>;
      const price = typeof attrs.startingPrice === "number" && attrs.startingPrice > 0 ? attrs.startingPrice : null;
      const offer: HotelOffer = {
        supplierCode: ref.supplierCode,
        externalKey: ref.externalKey,
        productId: product.id,
        productCode: product.code,
        productName: product.title,
        partnerId: product.partnerId,
        price,
        currency: typeof attrs.currency === "string" ? attrs.currency : "AZN",
      };
      const key = `${ref.supplierCode}\u0000${ref.externalKey}`;
      const current = best.get(key);
      if (!current) {
        best.set(key, offer);
        continue;
      }
      const currentComparable = current.price ?? Number.POSITIVE_INFINITY;
      const nextComparable = offer.price ?? Number.POSITIVE_INFINITY;
      if (nextComparable < currentComparable) best.set(key, offer);
    }

    return [...best.values()].sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY));
  }
}
