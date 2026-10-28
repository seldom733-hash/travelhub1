import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { cleanHotelName, nameSimilarity, normalizeName } from "./hotel-identity";

/** Актёр для audit trail (staff-операция слияния/разъединения). */
export interface HotelMatchActor {
  id?: string | null;
  username?: string | null;
}

export interface HotelCandidateSide {
  id: string;
  name: string;
  countryCode: string;
  cityName: string;
  stars: number | null;
  photoFile: string | null;
  refCount: number;
  suppliers: string[];
}

export interface HotelCandidate {
  hotelA: HotelCandidateSide;
  hotelB: HotelCandidateSide;
  similarity: number;
  reason: string;
}

export interface HotelCandidatePage {
  items: HotelCandidate[];
  total: number;
  limit: number;
  offset: number;
}

export interface HotelMutationResult {
  ok: boolean;
  message: string;
  hotelId?: string;
}

/** Порог похожести имён, ниже которого пара не попадает в очередь ревью. */
const CANDIDATE_MIN_SIMILARITY = 0.6;
/** Защита от O(n²) на аномально большом городе: не больше пар за один вызов. */
const CANDIDATE_PAIR_BUDGET = 250_000;

/**
 * HotelMatchReviewService — очередь ручной проверки дубликатов отелей.
 *
 * Автослияние по одному сходству названий ЗАПРЕЩЕНО (аудит 23.10.2026: без
 * адресов/координат совпадение имени не доказывает идентичность). Сервис
 * только показывает кандидатов с evidence; слияние/разъединение выполняет
 * менеджер, каждое действие пишется в security."AuditLog".
 *
 * Важно: каноническое имя карточки читается на витрине из Hotel.name по
 * (supplierCode, hotelKey) → HotelSupplierRef, а не копируется в Product.
 * Поэтому слияние не требует переписывать продукты и не теряется при синке.
 */
@Injectable()
export class HotelMatchReviewService {
  private readonly logger = new Logger(HotelMatchReviewService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Кандидаты на слияние: отели одного города с похожими именами, но разными
   * Hotel.id. Пары собираются внутри (страна, город) — сравнение имён между
   * разными городами не имеет смысла и даёт ложные пары.
   */
  async findCandidates(limit = 50, offset = 0): Promise<HotelCandidatePage> {
    const safeLimit = Math.min(Math.max(Number.isFinite(limit) ? limit : 50, 1), 200);
    const safeOffset = Math.max(Number.isFinite(offset) ? offset : 0, 0);

    const hotels = await this.prisma.hotel.findMany({
      where: { normalizedName: { not: "" } },
      orderBy: [{ countryCode: "asc" }, { cityName: "asc" }, { name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        countryCode: true,
        cityName: true,
        stars: true,
        photoFile: true,
        refs: { select: { supplierCode: true }, orderBy: { supplierCode: "asc" } },
      },
    });

    const byCity = new Map<string, typeof hotels>();
    for (const hotel of hotels) {
      const key = `${hotel.countryCode}\u0000${hotel.cityName.trim().toLowerCase()}`;
      const bucket = byCity.get(key);
      if (bucket) bucket.push(hotel);
      else byCity.set(key, [hotel]);
    }

    const candidates: HotelCandidate[] = [];
    let budget = CANDIDATE_PAIR_BUDGET;
    for (const bucket of byCity.values()) {
      for (let i = 0; i < bucket.length && budget > 0; i += 1) {
        for (let j = i + 1; j < bucket.length && budget > 0; j += 1) {
          budget -= 1;
          const a = bucket[i];
          const b = bucket[j];
          const similarity = nameSimilarity(a.name, b.name);
          if (similarity < CANDIDATE_MIN_SIMILARITY) continue;
          const suppliersA = [...new Set(a.refs.map((r) => r.supplierCode))];
          const suppliersB = [...new Set(b.refs.map((r) => r.supplierCode))];
          candidates.push({
            hotelA: {
              id: a.id,
              name: a.name,
              countryCode: a.countryCode,
              cityName: a.cityName,
              stars: a.stars,
              photoFile: a.photoFile,
              refCount: a.refs.length,
              suppliers: suppliersA,
            },
            hotelB: {
              id: b.id,
              name: b.name,
              countryCode: b.countryCode,
              cityName: b.cityName,
              stars: b.stars,
              photoFile: b.photoFile,
              refCount: b.refs.length,
              suppliers: suppliersB,
            },
            similarity,
            reason: `похожесть имени ${similarity.toFixed(2)}; ${a.countryCode}/${a.cityName || b.cityName}`,
          });
        }
      }
      if (budget <= 0) break;
    }

    candidates.sort(
      (x, y) =>
        y.similarity - x.similarity ||
        x.hotelA.name.localeCompare(y.hotelA.name) ||
        x.hotelA.id.localeCompare(y.hotelA.id),
    );

    return {
      items: candidates.slice(safeOffset, safeOffset + safeLimit),
      total: candidates.length,
      limit: safeLimit,
      offset: safeOffset,
    };
  }

  /** Supplier-привязки отеля: evidence для экрана ревью и для split. */
  async listRefs(hotelId: string) {
    const refs = await this.prisma.hotelSupplierRef.findMany({
      where: { hotelId },
      orderBy: [{ supplierCode: "asc" }, { externalKey: "asc" }],
      select: {
        id: true,
        supplierCode: true,
        externalKey: true,
        name: true,
        countryCode: true,
        cityName: true,
        stars: true,
        source: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
    });
    return { hotelId, refs };
  }

  /**
   * Объединить дубликат в канонический отель: перенести все supplier-refs,
   * заполнить пустые поля, удалить дубликат. Транзакционно: при ошибке в БД
   * не остаётся полуслитого состояния (refs перенесены, Hotel ещё жив).
   *
   * Защита: разные непустые страны не сливаются — это почти наверняка два
   * разных отеля с одинаковым названием.
   */
  async mergeHotels(canonicalId: string, duplicateId: string, actor: HotelMatchActor = {}): Promise<HotelMutationResult> {
    if (!canonicalId || !duplicateId) return { ok: false, message: "canonicalId и duplicateId обязательны" };
    if (canonicalId === duplicateId) return { ok: false, message: "Нельзя слить отель с самим собой" };

    return this.prisma.$transaction(async (tx) => {
      // Последовательно: interactive-транзакция Prisma — одно соединение,
      // параллельные запросы внутри неё только сериализуются.
      const canonical = await tx.hotel.findUnique({ where: { id: canonicalId } });
      const duplicate = await tx.hotel.findUnique({ where: { id: duplicateId } });
      if (!canonical || !duplicate) return { ok: false, message: "Один из отелей не найден" };
      if (canonical.countryCode && duplicate.countryCode && canonical.countryCode !== duplicate.countryCode) {
        return {
          ok: false,
          message: `Разные страны (${canonical.countryCode} ≠ ${duplicate.countryCode}) — слияние запрещено`,
        };
      }

      await tx.hotelSupplierRef.updateMany({
        where: { hotelId: duplicateId },
        data: { hotelId: canonicalId, lastSeenAt: new Date() },
      });

      // Канонические поля не перезаписываем: заполняем только пустые. Фото
      // переносим вместе со всеми метаданными, иначе карточка потеряет атрибуцию.
      const patch: Prisma.HotelUpdateInput = {};
      if (!canonical.countryName && duplicate.countryName) patch.countryName = duplicate.countryName;
      if (!canonical.cityName && duplicate.cityName) patch.cityName = duplicate.cityName;
      if (!canonical.resortName && duplicate.resortName) patch.resortName = duplicate.resortName;
      if (canonical.stars == null && duplicate.stars != null) patch.stars = duplicate.stars;
      if (!canonical.photoFile && duplicate.photoFile) {
        patch.photoFile = duplicate.photoFile;
        patch.photoStatus = duplicate.photoStatus;
        patch.photoSource = duplicate.photoSource;
        patch.photoSourceUrl = duplicate.photoSourceUrl;
        patch.photoAttribution = duplicate.photoAttribution;
        patch.photoWidth = duplicate.photoWidth;
        patch.photoHeight = duplicate.photoHeight;
        patch.photoBytes = duplicate.photoBytes;
        patch.photoUpdatedAt = duplicate.photoUpdatedAt;
      }
      if (Object.keys(patch).length > 0) {
        await tx.hotel.update({ where: { id: canonicalId }, data: patch });
      }

      await tx.hotel.delete({ where: { id: duplicateId } });
      await tx.auditLog.create({
        data: {
          userId: actor.id ?? null,
          username: actor.username ?? null,
          action: "catalog.hotel.merge",
          resource: "catalog.Hotel",
          resourceId: canonicalId,
          details: {
            canonicalId,
            canonicalName: canonical.name,
            duplicateId,
            duplicateName: duplicate.name,
            duplicateCountryCode: duplicate.countryCode,
            duplicateCityName: duplicate.cityName,
          } as Prisma.InputJsonValue,
        },
      });

      this.logger.log(`Hotel merge: ${duplicateId} (${duplicate.name}) → ${canonicalId} (${canonical.name})`);
      return { ok: true, message: `«${duplicate.name}» присоединён к «${canonical.name}»`, hotelId: canonicalId };
    });
  }

  /**
   * Разъединить отель: вынести один supplier-ref в новый Hotel. Нужно, когда
   * автоматическая группировка склеила разные гостиницы с одинаковым именем.
   */
  async splitHotel(refId: string, actor: HotelMatchActor = {}): Promise<HotelMutationResult> {
    if (!refId) return { ok: false, message: "refId обязателен" };

    return this.prisma.$transaction(async (tx) => {
      const ref = await tx.hotelSupplierRef.findUnique({ where: { id: refId } });
      if (!ref) return { ok: false, message: "Привязка не найдена" };
      const hotel = await tx.hotel.findUnique({ where: { id: ref.hotelId } });
      if (!hotel) return { ok: false, message: "Отель не найден" };

      const refCount = await tx.hotelSupplierRef.count({ where: { hotelId: hotel.id } });
      if (refCount <= 1) {
        return { ok: false, message: "У отеля единственная привязка — разделять нечего" };
      }

      const name = cleanHotelName(ref.name.trim() || hotel.name);
      const normalizedName = normalizeName(name);
      const countryCode = ref.countryCode || hotel.countryCode;
      const cityName = ref.cityName || hotel.cityName;

      const clash = await tx.hotel.findFirst({ where: { normalizedName, countryCode, cityName } });
      if (clash) {
        return { ok: false, message: `Отдельный отель «${name}» уже существует (${clash.id})` };
      }

      const created = await tx.hotel.create({
        data: {
          name,
          normalizedName,
          stars: ref.stars ?? hotel.stars,
          countryCode,
          countryName: hotel.countryName,
          cityName,
          resortName: ref.resortName || hotel.resortName,
        },
      });
      await tx.hotelSupplierRef.update({ where: { id: refId }, data: { hotelId: created.id, lastSeenAt: new Date() } });
      await tx.auditLog.create({
        data: {
          userId: actor.id ?? null,
          username: actor.username ?? null,
          action: "catalog.hotel.split",
          resource: "catalog.Hotel",
          resourceId: created.id,
          details: {
            sourceHotelId: hotel.id,
            sourceHotelName: hotel.name,
            refId,
            supplierCode: ref.supplierCode,
            externalKey: ref.externalKey,
            newHotelId: created.id,
            name,
          } as Prisma.InputJsonValue,
        },
      });

      this.logger.log(`Hotel split: ref ${refId} → hotel ${created.id} (${name})`);
      return { ok: true, message: `Создан отдельный отель «${name}»`, hotelId: created.id };
    });
  }
}
