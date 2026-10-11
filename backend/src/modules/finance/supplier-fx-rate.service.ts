/**
 * UNIFIED FINANCE CENTER Phase 1 — SupplierFxRateService.
 *
 * Scope: master data finance.SupplierFxRate (SFX-*) — supplier-specific
 * «1 sourceCurrency = N AZN» для пары (supplierCode, sourceCurrencyIso).
 * ЕДИНСТВЕННЫЙ authority курсов: текущий курс — upsert-in-place на unique
 * (supplier, source, target); история — append-only SupplierFxRateHistory
 * (old/new value, timestamp, admin identity), каждая мутация оставляет строку.
 *
 * AZN→AZN: всегда 1, строка НЕ хранится — resolve() возвращает identity без
 * DB-lookup. Отсутствие строки = нет курса → resolveSafe() = null (fail-open,
 * browse), resolveStrict() = throw ValidationDomainError (money-пути).
 * НИКОГДА не подставлять 1 или чужой курс (Confirmed decision).
 *
 * Decimal-safe: amount × rate — Prisma.Decimal; результат — toMoney2
 * (DECIMAL(12,2) half-up 2dp, sales.money platform contract, единый rounding).
 * rate — Decimal(18,6) > 0, ≤ 6 знаков (validateRate).
 *
 * Изменение курса влияет ТОЛЬКО на будущие расчёты: frozen snapshot'ы
 * (Request/Order commercialSnapshot.fx) не переписываются (upsert-in-place
 * НЕ трогает прошлые snapshot'ы).
 */
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { SecurityService } from "../../security/security.service";
import { NotFoundError, ValidationDomainError } from "../../shared/errors";
import { toMoney2 } from "../sales/sales.money";
import { validateIsoCode, validateRate } from "./finance.validation";
import { DEFAULT_SUPPLIER_FX_RATES } from "../../shared/supplier-fx-defaults";

/** Актор мутации курса (как MarkupRuleService/CommissionPolicyService). */
export interface Actor {
  id: string;
  username: string;
}

/** Результат resolve: либо курс есть, либо явный null (нет курса). */
export interface ResolvedSupplierFxRate {
  rate: Prisma.Decimal;
  rateCode: string | null;
}

/** JSON-safe DTO текущего курса (без Decimal в HTTP). */
export interface SupplierFxRateDto {
  id: string;
  code: string;
  supplierCode: string;
  /** CRM Partner.code (PAR-*), если партнёр привязан к этому поставщику; иначе null. */
  partnerCode: string | null;
  /** CRM Partner.name для отображения; null если не привязан. */
  partnerName: string | null;
  sourceCurrencyIso: string;
  targetCurrencyIso: string;
  rate: string;
  createdAt: string;
  updatedAt: string;
  updatedById: string | null;
  updatedByName: string | null;
}

type SupplierFxRateRow = {
  id: string;
  code: string;
  supplierCode: string;
  sourceCurrencyIso: string;
  targetCurrencyIso: string;
  rate: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
  updatedById: string | null;
  updatedByName: string | null;
};

/** Management currency V1: storage колонка расширяема, API-фиксирован AZN. */
export const TARGET_AZN = "AZN";

/**
 * Контракт нового поставщика (авто-AZN из коробки, без донастройки кода):
 *  1. Партнёр создаётся в CRM (авто-курсы USD 1.7 / EUR 1.91 по его PRN-коду —
 *     seedDefaultFxRates; иные валюты админ добавляет разово в FX-таблице);
 *  2. Имя партнёра НОРМАЛИЗУЕТСЯ в токен (верхний регистр, только A-Z0-9):
 *     "Aviasales" → AVIASALES, "KazUnion" → KAZUNION. Такое имя резолвится
 *     само (шаг 2 ниже) — живых цен до первого синка тоже;
 *  3. Синк пишет Product.partnerId + attributes.supplierCode = токен адаптера
 *     (напр. "SUMMERTOUR"), Tariff.currency + attributes.startingPrice/currency
 *     в ВАЛЮТЕ поставщика (конвертация — только на чтении/границах, § demander).
 *  При соблюдении контракта витрина, поиск, календари и flight-комбайны
 *  показывают AZN автоматически. Токен с нестандартным именем (напр. партнёр
 *  "Summer / Summertour" ↔ SUMMERTOUR) резолвится через шаг 1, как только
 *  синк создал первый продукт; до этого — fail-open (исходная валюта).
 */
const NORMALIZE_TOKEN = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Legacy-исключения, не покрытые нормализацией имён (шаг 3 — последний шанс). */
const SUPPLIER_PARTNER_NAMES: Record<string, string[]> = {
  KAZUNION: ["KazUnion"],
  KOMPAS: ["KOMPAS"],
  SUMMERTOUR: ["Summer / Summertour", "Summertour"],
  AZAL: ["AZAL", "Azal"],
  AVIASALES: ["Aviasales"],
  ANEX: ["ANEX", "Anex"],
};

@Injectable()
export class SupplierFxRateService {
  private readonly logger = new Logger(SupplierFxRateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly security: SecurityService,
  ) {}

  // ── Read / resolve ───────────────────────────────────────────────────────

  /**
   * Fail-open resolve (browse-границы): курс поставщика есть → вернуть его,
   * нет → null (вызывающий показывает исходную валюту, НЕ подставляет 1).
   * AZN source → identity (rate 1, rateCode null) без DB-lookup.
   */
  async resolveSafe(supplierCode: string, sourceCurrencyIso: string): Promise<ResolvedSupplierFxRate | null> {
    const source = validateIsoCode(sourceCurrencyIso, "sourceCurrencyIso");
    if (source === TARGET_AZN) return { rate: new Prisma.Decimal(1), rateCode: null };
    try {
      return await this.resolveStrict(supplierCode, source);
    } catch (err) {
      this.logger.warn(
        `SupplierFxRate resolve failed for ${supplierCode}/${source}→${TARGET_AZN} — falling back to null (no conversion): ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Strict resolve (money-пути: snapshot build/acceptance, request creation):
   * нет курса → throw ValidationDomainError (контролируемая ошибка, никогда
   * silent-substitute). AZN source → identity без lookup.
   */
  async resolveStrict(supplierCode: string, sourceCurrencyIso: string): Promise<ResolvedSupplierFxRate> {
    const source = validateIsoCode(sourceCurrencyIso, "sourceCurrencyIso");
    if (source === TARGET_AZN) return { rate: new Prisma.Decimal(1), rateCode: null };

    let row = await this.findRate(supplierCode, source);
    // Курсы хранятся по коду поставщика (PRN-*), а коммерческие пути приходят
    // с adapter-токеном (KAZUNION/KOMPAS/…). Прямой ключ промахнулся →
    // транслируем токен → Partner.code и пробуем ещё раз. При совпадении ключа
    // (или если Partner не найден) — ровно один lookup, как раньше.
    if (!row) {
      const canonical = await this.canonicalSupplierCode(supplierCode);
      if (canonical !== supplierCode) row = await this.findRate(canonical, source);
    }
    if (!row) {
      throw new ValidationDomainError(
        `missing FX rate: no supplier FX rate for supplier "${supplierCode}" ${source}→${TARGET_AZN} — configure it in Finance → FX Rates before using this supplier price commercially (never substitute 1 or another supplier's rate)`,
      );
    }
    return { rate: row.rate, rateCode: row.code };
  }

  private async findRate(supplierCode: string, source: string): Promise<SupplierFxRateRow | null> {
    return this.prisma.supplierFxRate.findUnique({
      where: {
        supplierCode_sourceCurrencyIso_targetCurrencyIso: {
          supplierCode,
          sourceCurrencyIso: source,
          targetCurrencyIso: TARGET_AZN,
        },
      },
    });
  }

  /** Adapter-токен → код поставщика (PRN-*); без Partner — возвращаем исходный ключ. */
  private async canonicalSupplierCode(supplierCode: string): Promise<string> {
    if (supplierCode.toUpperCase().startsWith("PRN-")) return supplierCode;
    try {
      const partner = await this.resolvePartnerForSupplier(supplierCode);
      return partner?.code ?? supplierCode;
    } catch {
      return supplierCode;
    }
  }

  /** JSON-safe конвертация «amount source → AZN»: amount × rate, half-up 2dp.
   *  Чистая функция (unit-testable) — вызывается и из resolve-обёрток, и
   *  напрямую из pricing-границ. */
  convertToAzn(amount: Prisma.Decimal | number | string, fx: ResolvedSupplierFxRate): Prisma.Decimal {
    const value = toMoney2(amount, "fx.sourceAmount");
    if (value.lessThanOrEqualTo(0)) {
      throw new ValidationDomainError("fx.sourceAmount must be greater than 0");
    }
    return toMoney2(value.mul(fx.rate), "fx.aznAmount");
  }

  /** Fail-open конвертация: курса нет → null (browse; исходная валюта). */
  async convertToAznSafe(
    supplierCode: string,
    sourceCurrencyIso: string,
    amount: Prisma.Decimal | number | string,
  ): Promise<{ aznAmount: Prisma.Decimal; rate: Prisma.Decimal; rateCode: string | null } | null> {
    const fx = await this.resolveSafe(supplierCode, sourceCurrencyIso);
    if (fx == null) return null;
    const aznAmount = this.convertToAzn(amount, fx);
    return { aznAmount, rate: fx.rate, rateCode: fx.rateCode };
  }

  /** Strict конвертация: курса нет → throw (money-пути). */
  async convertToAznStrict(
    supplierCode: string,
    sourceCurrencyIso: string,
    amount: Prisma.Decimal | number | string,
  ): Promise<{ aznAmount: Prisma.Decimal; rate: Prisma.Decimal; rateCode: string | null }> {
    const fx = await this.resolveStrict(supplierCode, sourceCurrencyIso);
    const aznAmount = this.convertToAzn(amount, fx);
    return { aznAmount, rate: fx.rate, rateCode: fx.rateCode };
  }

  // ── List current rates ───────────────────────────────────────────────────

  async listCurrent(filter: { supplierCode?: string; sourceCurrencyIso?: string } = {}): Promise<SupplierFxRateDto[]> {
    const rows = await this.prisma.supplierFxRate.findMany({
      where: {
        ...(filter.supplierCode ? { supplierCode: filter.supplierCode } : {}),
        ...(filter.sourceCurrencyIso
          ? { sourceCurrencyIso: validateIsoCode(filter.sourceCurrencyIso, "sourceCurrencyIso") }
          : {}),
      },
      orderBy: [{ supplierCode: "asc" }, { sourceCurrencyIso: "asc" }],
    });
    const partners = await this.resolvePartnersForSuppliers(rows.map((r) => r.supplierCode));
    return rows.map((r) => this.toDto(r, partners.get(r.supplierCode) ?? null));
  }

  async getCurrentByCode(code: string): Promise<SupplierFxRateDto> {
    const row = await this.prisma.supplierFxRate.findUnique({ where: { code } });
    if (!row) throw new NotFoundError(`supplier FX rate ${code} not found`);
    return this.toDto(row, await this.resolvePartnerForSupplier(row.supplierCode));
  }

  /**
   * Supplier registry для FX-админки: ВСЕ поставщики (CRM-партнёры, PRN-*) ∪
   * уже настроенные токены курсов. Источник строк — партнёры, НЕ только
   * строки курсов (иначе таблица пустеет) и НЕ адаптер-токены (иначе в ней
   * значатся поставщики, которых админ ещё не добавлял). Пара
   * (supplierCode, partnerCode) совпадает для партнёра: курс хранится по
   * Partner.code, отображается тем же кодом.
   */
  async listSuppliers(): Promise<Array<{ supplierCode: string; partnerCode: string | null; partnerName: string | null }>> {
    const out = new Map<string, { supplierCode: string; partnerCode: string | null; partnerName: string | null }>();

    const partners = await this.prisma.partner.findMany({
      where: { status: "ACTIVE" },
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    });
    for (const p of partners) {
      out.set(p.code, { supplierCode: p.code, partnerCode: p.code, partnerName: p.name });
    }

    // Настроенные курсы, чей ключ не совпал с Partner.code (например
    // adapter-токен из синка) — дополняем реестр, Partner резолвим data-driven.
    const configured = await this.prisma.supplierFxRate.findMany({
      select: { supplierCode: true },
      distinct: ["supplierCode"],
    });
    const extra = configured.map((r) => r.supplierCode).filter((sc) => !out.has(sc)).sort();
    const resolved = await this.resolvePartnersForSuppliers(extra);
    for (const supplierCode of extra) {
      const p = resolved.get(supplierCode) ?? null;
      out.set(supplierCode, { supplierCode, partnerCode: p?.code ?? null, partnerName: p?.name ?? null });
    }

    return [...out.values()].sort((a, b) => a.supplierCode.localeCompare(b.supplierCode));
  }

  /**
   * Дефолтные курсы для ТОЛЬКО ЧТО созданного поставщика: 1 USD = 1.7 AZN,
   * 1 EUR = 1.91 AZN. Идемпотентно (setCurrent: тот же курс → без истории),
   * поэтому безопасно вызывать при любом создании/повторе.
   */
  async ensureDefaults(supplierCode: string, actor: Actor, tx?: Prisma.TransactionClient): Promise<void> {
    for (const [sourceCurrencyIso, rate] of DEFAULT_SUPPLIER_FX_RATES) {
      await this.setCurrent({ supplierCode, sourceCurrencyIso, rate }, actor, tx);
    }
  }

  // ── History (append-only) ────────────────────────────────────────────────

  async listHistory(
    filter: { code?: string; supplierCode?: string; sourceCurrencyIso?: string },
    page = 1,
    pageSize = 20,
  ): Promise<{ items: Record<string, unknown>[]; page: number; pageSize: number; total: number }> {
    const where: Record<string, unknown> = {};
    if (filter.code) {
      const row = await this.prisma.supplierFxRate.findUnique({ where: { code: filter.code } });
      if (!row) throw new NotFoundError(`supplier FX rate ${filter.code} not found`);
      where.rateId = row.id;
    } else if (filter.supplierCode || filter.sourceCurrencyIso) {
      const rates = await this.prisma.supplierFxRate.findMany({
        where: {
          ...(filter.supplierCode ? { supplierCode: filter.supplierCode } : {}),
          ...(filter.sourceCurrencyIso
            ? { sourceCurrencyIso: validateIsoCode(filter.sourceCurrencyIso, "sourceCurrencyIso") }
            : {}),
        },
        select: { id: true },
      });
      where.rateId = { in: rates.map((r) => r.id) };
    }
    const [total, rows] = await Promise.all([
      this.prisma.supplierFxRateHistory.count({ where }),
      this.prisma.supplierFxRateHistory.findMany({
        where,
        orderBy: { changedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map((h) => ({
        id: h.id,
        rateId: h.rateId,
        action: h.action,
        oldRate: h.oldRate == null ? null : h.oldRate.toString(),
        newRate: h.newRate.toString(),
        changedAt: h.changedAt.toISOString(),
        actorId: h.actorId,
        actorName: h.actorName,
      })),
      page,
      pageSize,
      total,
    };
  }

  // ── Set current (upsert + history + audit) ───────────────────────────────

  /**
   * Установка/обновление ТЕКУЩЕГО курса. upsert-in-place на unique
   * (supplier, source, AZN); каждая мутация — append-only история
   * (CREATE при отсутствии / UPDATE со старым значением) + AuditLog.
   * AZN→AZN отклоняется (всегда 1, строка не нужна).
   */
  async setCurrent(
    input: { supplierCode: string; sourceCurrencyIso: string; rate: string },
    actor: Actor,
    externalTx?: Prisma.TransactionClient,
  ): Promise<SupplierFxRateDto> {
    const supplierCode = input.supplierCode.trim();
    if (supplierCode.length === 0 || supplierCode.length > 64) {
      throw new ValidationDomainError("supplierCode must be a non-empty code (max 64 chars)");
    }
    const source = validateIsoCode(input.sourceCurrencyIso, "sourceCurrencyIso");
    if (source === TARGET_AZN) {
      throw new ValidationDomainError(
        "AZN→AZN rate is always 1 and must not be stored — set a rate only for a non-AZN source currency",
      );
    }
    validateRate(input.rate);
    const newRate = new Prisma.Decimal(input.rate);

    const run = async (tx: Prisma.TransactionClient): Promise<SupplierFxRateRow> => {
      const existing = await tx.supplierFxRate.findUnique({
        where: {
          supplierCode_sourceCurrencyIso_targetCurrencyIso: {
            supplierCode,
            sourceCurrencyIso: source,
            targetCurrencyIso: TARGET_AZN,
          },
        },
      });

      let row: SupplierFxRateRow;
      if (existing) {
        // Idempotent update: тот же rate → no history noise; разный → UPDATE.
        if (existing.rate.equals(newRate)) {
          return existing;
        }
        row = await tx.supplierFxRate.update({
          where: { id: existing.id },
          data: {
            rate: newRate,
            updatedById: actor.id,
            updatedByName: actor.username,
          },
        });
        await tx.supplierFxRateHistory.create({
          data: {
            rateId: row.id,
            action: "UPDATE",
            oldRate: existing.rate,
            newRate,
            actorId: actor.id,
            actorName: actor.username,
          },
        });
      } else {
        const code = await this.ids.nextCode(tx, "SFX");
        row = await tx.supplierFxRate.create({
          data: {
            code,
            supplierCode,
            sourceCurrencyIso: source,
            targetCurrencyIso: TARGET_AZN,
            rate: newRate,
            updatedById: actor.id,
            updatedByName: actor.username,
          },
        });
        await tx.supplierFxRateHistory.create({
          data: {
            rateId: row.id,
            action: "CREATE",
            oldRate: null,
            newRate,
            actorId: actor.id,
            actorName: actor.username,
          },
        });
      }

      await this.security.audit(tx, {
        userId: actor.id,
        username: actor.username,
        action: "finance.fx_rate.set",
        resource: "SupplierFxRate",
        resourceId: row.code,
        details: {
          supplierCode,
          sourceCurrencyIso: source,
          targetCurrencyIso: TARGET_AZN,
          rate: newRate.toString(),
        },
      });

      return row;
    };
    const row = externalTx ? await run(externalTx) : await this.prisma.$transaction(run);

    return this.toDto(row, await this.resolvePartnerForSupplier(row.supplierCode));
  }

  private toDto(row: SupplierFxRateRow, partner?: { code: string; name: string } | null): SupplierFxRateDto {
    return {
      id: row.id,
      code: row.code,
      supplierCode: row.supplierCode,
      partnerCode: partner?.code ?? null,
      partnerName: partner?.name ?? null,
      sourceCurrencyIso: row.sourceCurrencyIso,
      targetCurrencyIso: row.targetCurrencyIso,
      rate: row.rate.toString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      updatedById: row.updatedById,
      updatedByName: row.updatedByName,
    };
  }

  /**
   * Data-driven резолюция registry-токена поставщика → CRM Partner.
   * Sync-сервисы (kazunion/kompas/summertour) пишут supplierCode в
   * Product.attributes и привязывают Partner через Product.partnerId —
   * используем эту связь. Без формальной FK; фолбэк — null (UI покажет токен).
   */
  private async resolvePartnerForSupplier(supplierCode: string): Promise<{ code: string; name: string } | null> {
    try {
      // 0) Сам ключ уже код Partner (PRN-*) — авто-курсы нового поставщика
      //    пишутся по Partner.code: резолвим напрямую, без data-driven поиска.
      if (supplierCode.toUpperCase().startsWith("PRN-")) {
        const partner = await this.prisma.partner.findUnique({
          where: { code: supplierCode },
          select: { code: true, name: true },
        });
        if (partner) return partner;
      }
      // 1) Data-driven: sync-сервисы пишут supplierCode в Product.attributes и
      //    привязывают Partner через Product.partnerId.
      const product = await this.prisma.product.findFirst({
        where: { attributes: { path: ["supplierCode"], equals: supplierCode } },
        select: { partnerId: true },
      });
      if (product?.partnerId) {
        const partner = await this.prisma.partner.findUnique({
          where: { id: product.partnerId },
          select: { code: true, name: true },
        });
        if (partner) return partner;
      }
      // 2) Data-driven по имени: нормализованное имя ACTIVE-партнёра совпало
      //    с токеном ("Aviasales" → AVIASALES). Работает для БУДУЩИХ
      //    поставщиков без правок кода — до первого синка тоже.
      const normalized = NORMALIZE_TOKEN(supplierCode);
      if (normalized) {
        const partners = await this.prisma.partner.findMany({
          where: { status: "ACTIVE" },
          select: { code: true, name: true },
        });
        const byName = partners.find((p) => NORMALIZE_TOKEN(p.name) === normalized);
        if (byName) return byName;
      }
      // 3) Legacy-фолбэк по имени Partner (устойчив к отсутствию Product):
      //    известные адаптер-токены → канонические имена CRM-партнёров.
      const nameCandidates = SUPPLIER_PARTNER_NAMES[supplierCode.toUpperCase()];
      if (nameCandidates?.length) {
        const partner = await this.prisma.partner.findFirst({
          where: { name: { in: nameCandidates, mode: "insensitive" } },
          select: { code: true, name: true },
        });
        if (partner) return partner;
      }
      return null;
    } catch (err) {
      this.logger.warn(`Partner resolve failed for supplier ${supplierCode}: ${(err as Error).message}`);
      return null;
    }
  }

  /** Batch: один lookup на каждый distinct supplierCode (Map-кэш). */
  private async resolvePartnersForSuppliers(
    supplierCodes: string[],
  ): Promise<Map<string, { code: string; name: string } | null>> {
    const distinct = [...new Set(supplierCodes)];
    const pairs = await Promise.all(
      distinct.map(async (sc) => [sc, await this.resolvePartnerForSupplier(sc)] as const),
    );
    return new Map(pairs);
  }
}
