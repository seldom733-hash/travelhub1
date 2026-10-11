/**
 * UNIFIED FINANCE CENTER Phase 3 — FinanceOverviewService (сводные KPI).
 *
 * Read-only агрегаты из source-of-truth таблиц (НЕ пересчитывает и не
 * дублирует Payment/Refund/Commission/Payout). Ключевой принцип (§2 «Profit is
 * not cash flow»): каждый метрика — из своего источника; AZN-итог возвращается
 * ТОЛЬКО когда frozen AZN-значение уже существует (obligation/payout
 * aznAmount, snapshot margin); иначе amount=null + availability=UNKNOWN («never
 * zero»), а source-currency разбивка раскрывается отдельно. Никакого invented
 * FX-конверта для исторических платежей (нет frozen rate → UNKNOWN).
 *
 * Метрики:
 *  - obligations (AZN): SUM aznAmount/paidAmount/remainingAmount по
 *    SupplierObligation (исключая CANCELLED); unknownCount — обязательства с
 *    aznAmount UNKNOWN (blocked, never zero);
 *  - supplierPayouts (AZN): SUM SupplierPayout.aznAmount (реальный исход);
 *  - expectedMargin (AZN): из Order.commercialSnapshot (frozen) —
 *    customerFinalPrice(AZN) − supplierCostAZN(fx.aznAmount|AZN-source);
 *    PARTIAL/UNKNOWN если snapshot/курс отсутствует (disclosed, не «ноль»);
 *  - customerReceipts: SUM Payment.amount WHERE CAPTURED, group by currency;
 *    AZN = UNKNOWN (нет frozen per-payment AZN-курса) + source-currency
 *    разбивка;
 *  - customerDebt: SUM(Order.amount − Order.paidAmount) по не-отменённым
 *    заказам, group by currency; AZN = UNKNOWN (нет frozen AZN).
 *
 * НЕ считает profit/cash-flow как «captured − payouts» (§2: отдельные
 * концепции). Actual profit / net cash flow — Phase 5 (recognition policy),
 * здесь маркируются UNAVAILABLE с причиной, а не изобретаются.
 */
import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TARGET_AZN } from "./supplier-obligation.service";

const TARGET = TARGET_AZN;
/** Лимит заказов для snapshot-margin сканирования (overview, не analytics). */
const MARGIN_SCAN_LIMIT = 2000;

export type Availability = "OK" | "PARTIAL" | "UNKNOWN" | "UNAVAILABLE";

/** AZN-метрика с честной availability-семантикой (never zero for UNKNOWN). */
export interface AznMetric {
  /** AZN-итог; null если UNKNOWN/UNAVAILABLE (не «0»). */
  amount: string | null;
  availability: Availability;
  /** Компоненты без данных (для PARTIAL/UNKNOWN). */
  unknownCount?: number;
  knownCount?: number;
  note?: string;
}

export interface CurrencyAmount {
  currency: string;
  amount: string;
}

export interface FinanceOverview {
  range: { from: string | null; to: string | null };
  obligations: {
    totalAzn: string;
    paidAzn: string;
    remainingAzn: string;
    count: number;
    /** Обязательства с aznAmount UNKNOWN (не входят в total, раскрыты). */
    unknownCount: number;
  };
  supplierPayouts: { paidAzn: string; count: number };
  expectedMargin: AznMetric;
  customerReceipts: { byCurrency: CurrencyAmount[]; azn: AznMetric };
  customerDebt: { byCurrency: CurrencyAmount[]; azn: AznMetric };
  /** Phase 5: recognition policy не wired → честный UNAVAILABLE. */
  actualProfit: AznMetric;
  netCashFlow: AznMetric;
  generatedAt: string;
}

interface RangeFilter {
  from?: string;
  to?: string;
}

/** Prisma-where для диапазона по полю даты (inclusive from, exclusive to). */
function rangeWhere(field: string, range: RangeFilter): Record<string, unknown> {
  const cond: Record<string, Date> = {};
  if (range.from) cond.gte = new Date(range.from);
  if (range.to) cond.lte = new Date(range.to);
  return Object.keys(cond).length ? { [field]: cond } : {};
}

function decStr(d: Prisma.Decimal | null | undefined): string {
  return (d ?? new Prisma.Decimal(0)).toString();
}

interface SnapshotLike {
  supplierCurrency?: unknown;
  supplierPrice?: unknown;
  customerFinalPrice?: unknown;
  customerCurrency?: unknown;
  fx?: { aznAmount?: unknown } | null;
}

/**
 * Ожидаемая маржа заказа из frozen snapshot (AZN). Возвращает null (UNKNOWN),
 * если любой из двух концов не в AZN / отсутствует snapshot/fx.
 */
function marginFromSnapshot(raw: unknown): Prisma.Decimal | null {
  if (raw == null) return null;
  let s: SnapshotLike;
  try {
    s = (typeof raw === "string" ? JSON.parse(raw) : raw) as SnapshotLike;
  } catch {
    return null;
  }
  if (!s || typeof s !== "object") return null;

  // Customer final price должен быть в AZN (management currency).
  if (s.customerCurrency !== TARGET) return null;
  if (typeof s.customerFinalPrice !== "number") return null;
  const finalPrice = new Prisma.Decimal(s.customerFinalPrice);

  // Supplier cost AZN: fx.aznAmount (frozen FX) либо AZN-source supplierPrice.
  let costAzn: Prisma.Decimal;
  if (s.fx && typeof s.fx.aznAmount === "number") {
    costAzn = new Prisma.Decimal(s.fx.aznAmount);
  } else if (s.supplierCurrency === TARGET && typeof s.supplierPrice === "number") {
    costAzn = new Prisma.Decimal(s.supplierPrice);
  } else {
    return null; // нет frozen AZN-стоимости поставщика → UNKNOWN
  }
  return finalPrice.sub(costAzn);
}

@Injectable()
export class FinanceOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(range: RangeFilter = {}): Promise<FinanceOverview> {
    const [obligations, supplierPayouts, expectedMargin, customerReceipts, customerDebt] = await Promise.all([
      this.obligationsAggregate(range),
      this.payoutsAggregate(range),
      this.expectedMarginMetric(range),
      this.receiptsMetric(range),
      this.debtMetric(range),
    ]);

    return {
      range: { from: range.from ?? null, to: range.to ?? null },
      obligations,
      supplierPayouts,
      expectedMargin,
      customerReceipts,
      customerDebt,
      actualProfit: {
        amount: null,
        availability: "UNAVAILABLE",
        note: "Actual profit requires a documented recognition policy over confirmed service events (Phase 5); not derived from captured−payouts.",
      },
      netCashFlow: {
        amount: null,
        availability: "UNAVAILABLE",
        note: "Net cash flow requires complete explicit incoming/outgoing movement sources (Phase 5); not derived here.",
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private async obligationsAggregate(range: RangeFilter): Promise<FinanceOverview["obligations"]> {
    // Исключаем CANCELLED (не owed); aznAmount UNKNOWN не суммируется (null),
    // но раскрывается через unknownCount.
    const where = { status: { not: "CANCELLED" }, ...rangeWhere("confirmedAt", range) };
    const [agg, unknown] = await Promise.all([
      this.prisma.supplierObligation.aggregate({
        where,
        _sum: { aznAmount: true, paidAmount: true, remainingAmount: true },
        _count: { _all: true },
      }),
      this.prisma.supplierObligation.count({ where: { ...where, aznAmount: null } }),
    ]);
    return {
      totalAzn: decStr(agg._sum.aznAmount),
      paidAzn: decStr(agg._sum.paidAmount),
      remainingAzn: decStr(agg._sum.remainingAmount),
      count: agg._count._all,
      unknownCount: unknown,
    };
  }

  private async payoutsAggregate(range: RangeFilter): Promise<FinanceOverview["supplierPayouts"]> {
    const agg = await this.prisma.supplierPayout.aggregate({
      where: rangeWhere("occurredAt", range),
      _sum: { aznAmount: true },
      _count: { _all: true },
    });
    return { paidAzn: decStr(agg._sum.aznAmount), count: agg._count._all };
  }

  private async expectedMarginMetric(range: RangeFilter): Promise<AznMetric> {
    const orders = await this.prisma.order.findMany({
      where: { commercialSnapshot: { not: Prisma.JsonNull }, ...rangeWhere("createdAt", range) },
      select: { commercialSnapshot: true },
      orderBy: { createdAt: "desc" },
      take: MARGIN_SCAN_LIMIT,
    });
    let total = new Prisma.Decimal(0);
    let known = 0;
    let unknown = 0;
    for (const o of orders) {
      const m = marginFromSnapshot(o.commercialSnapshot);
      if (m == null) unknown += 1;
      else {
        total = total.add(m);
        known += 1;
      }
    }
    if (known === 0) {
      return {
        amount: null,
        availability: unknown > 0 ? "UNKNOWN" : "OK",
        knownCount: 0,
        unknownCount: unknown,
        note: unknown > 0 ? "No frozen AZN commercial snapshot available for margin." : undefined,
      };
    }
    return {
      amount: total.toString(),
      availability: unknown > 0 ? "PARTIAL" : "OK",
      knownCount: known,
      unknownCount: unknown,
      note: unknown > 0 ? `Margin covers ${known} of ${known + unknown} orders; ${unknown} lack frozen AZN snapshot.` : undefined,
    };
  }

  private async receiptsMetric(range: RangeFilter): Promise<{ byCurrency: CurrencyAmount[]; azn: AznMetric }> {
    // CAPTURED = фактически полученные деньги (Payment — source of truth).
    // Группируем по валютам; AZN = UNKNOWN (нет frozen per-payment AZN-курса).
    const grouped = await this.prisma.payment.groupBy({
      by: ["currency"],
      where: { status: "CAPTURED", ...rangeWhere("paidAt", range) },
      _sum: { amount: true },
    });
    const byCurrency = grouped
      .map((g) => ({ currency: g.currency, amount: decStr(g._sum.amount) }))
      .sort((a, b) => a.currency.localeCompare(b.currency));
    return {
      byCurrency,
      azn: {
        amount: null,
        availability: "UNKNOWN",
        note: "AZN conversion of historical captured payments requires a frozen per-payment FX rate (not stored); source-currency totals disclosed instead.",
      },
    };
  }

  private async debtMetric(range: RangeFilter): Promise<{ byCurrency: CurrencyAmount[]; azn: AznMetric }> {
    // Debt = amount − paidAmount по не-отменённым заказам (Order — source of
    // truth). Группируем по валюте; AZN = UNKNOWN (нет frozen AZN).
    const grouped = await this.prisma.order.groupBy({
      by: ["currency"],
      where: { status: { not: "CANCELLED" }, ...rangeWhere("createdAt", range) },
      _sum: { amount: true, paidAmount: true },
    });
    const byCurrency = grouped
      .map((g) => {
        const debt = (g._sum.amount ?? new Prisma.Decimal(0)).sub(g._sum.paidAmount ?? new Prisma.Decimal(0));
        return { currency: g.currency, amount: debt.toString() };
      })
      .sort((a, b) => a.currency.localeCompare(b.currency));
    return {
      byCurrency,
      azn: {
        amount: null,
        availability: "UNKNOWN",
        note: "AZN debt requires frozen per-order AZN amount; source-currency debt disclosed instead.",
      },
    };
  }
}
