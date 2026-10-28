/**
 * Supplier debt as of a historical date (Finance completion, 2026-10-25).
 *
 * Текущий реестр показывает «сейчас»; здесь состояние восстанавливается по
 * бизнес-времени:
 *   - обязательство существует, если COALESCE(confirmedAt, createdAt) <= asOf;
 *   - сумма на дату = последний CREATED/ADJUSTED event <= asOf (append-only
 *     SupplierObligationEvent); legacy-обязательства без событий помечаются
 *     `precision=LEGACY_CURRENT`, а не выдаются за точные;
 *   - оплачено на дату = Σ allocation.aznAmount, где payout.confirmedAt <= asOf,
 *     allocation.createdAt <= asOf и (reversedAt IS NULL OR reversedAt > asOf);
 *     PENDING-платежи не учитываются; отмена после asOf не уменьшает прошлое;
 *   - CANCELLED — если событие отмены <= asOf;
 *   - overdue — по dueDate < asOf (date-only) и остатку > 0.
 *
 * Суммы в разных валютах не складываются: итоги группируются по sourceCurrency
 * (AZN-эквиваленты показываются отдельными колонками внутри группы).
 */
import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SecurityService } from "../../security/security.service";
import { ValidationDomainError } from "../../shared/errors";
import { toMoney2 } from "../sales/sales.money";

export interface DebtAsOfRow {
  obligationCode: string;
  invoiceNumber: string | null;
  supplierCode: string | null;
  partnerCode: string | null;
  orderCode: string | null;
  bookingCode: string | null;
  sourceAmount: string;
  sourceCurrency: string;
  aznAmount: string | null;
  paidAzn: string;
  remainingAzn: string | null;
  dueDate: string | null;
  status: string;
  overdue: boolean;
  precision: "EVENT" | "LEGACY_CURRENT";
}

export interface DebtAsOfTotals {
  currency: string;
  count: number;
  sourceAmount: string;
  aznAmount: string;
  paidAzn: string;
  remainingAzn: string;
  unknownCount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function endOfDayUtc(asOf: string): Date {
  const parsed = new Date(`${asOf}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new ValidationDomainError("asOf must be a valid date (YYYY-MM-DD)");
  return new Date(parsed.getTime() + DAY_MS - 1);
}

@Injectable()
export class SupplierDebtReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
  ) {}

  async getReport(query: {
    asOf?: string;
    supplierCode?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    asOf: string;
    generatedAt: string;
    totalsByCurrency: DebtAsOfTotals[];
    items: DebtAsOfRow[];
    total: number;
    page: number;
    pageSize: number;
    warnings: string[];
  }> {
    const asOfInput = (query.asOf ?? new Date().toISOString().slice(0, 10)).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfInput)) {
      throw new ValidationDomainError("asOf must be a date in YYYY-MM-DD format");
    }
    const asOfEnd = endOfDayUtc(asOfInput);
    const asOfDayStart = new Date(asOfEnd.getTime() - DAY_MS + 1);

    const where: Prisma.SupplierObligationWhereInput = {
      OR: [
        { confirmedAt: { lte: asOfEnd } },
        { confirmedAt: null, createdAt: { lte: asOfEnd } },
      ],
    };
    if (query.supplierCode) where.supplierCode = query.supplierCode;
    const search = query.search?.trim();
    if (search) {
      where.AND = [
        {
          OR: [
            { code: { contains: search, mode: "insensitive" } },
            { invoiceNumber: { contains: search, mode: "insensitive" } },
            { orderCode: { contains: search, mode: "insensitive" } },
            { bookingCode: { contains: search, mode: "insensitive" } },
          ],
        },
      ];
    }

    const obligations = await this.prisma.supplierObligation.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { code: "asc" }],
      take: 5000,
    });
    const ids = obligations.map((o) => o.id);
    if (ids.length === 0) {
      return {
        asOf: asOfInput,
        generatedAt: new Date().toISOString(),
        totalsByCurrency: [],
        items: [],
        total: 0,
        page: 1,
        pageSize: Math.min(200, Math.max(1, query.pageSize ?? 50)),
        warnings: [],
      };
    }

    const [events, allocations, partners] = await Promise.all([
      this.prisma.supplierObligationEvent.findMany({
        where: { obligationId: { in: ids }, occurredAt: { lte: asOfEnd } },
        orderBy: { occurredAt: "asc" },
        select: { obligationId: true, type: true, aznAmount: true },
      }),
      this.prisma.supplierPayoutAllocation.findMany({
        where: {
          obligationId: { in: ids },
          payout: { confirmedAt: { lte: asOfEnd } },
          createdAt: { lte: asOfEnd },
          OR: [{ reversedAt: null }, { reversedAt: { gt: asOfEnd } }],
        },
        select: { obligationId: true, aznAmount: true },
      }),
      this.prisma.partner.findMany({
        where: { id: { in: [...new Set(obligations.map((o) => o.partnerId).filter((id): id is string => !!id))] } },
        select: { id: true, code: true },
      }),
    ]);
    const partnerCodes = new Map(partners.map((p) => [p.id, p.code]));
    const paidByObligation = new Map<string, Prisma.Decimal>();
    for (const allocation of allocations) {
      paidByObligation.set(
        allocation.obligationId,
        (paidByObligation.get(allocation.obligationId) ?? new Prisma.Decimal(0)).plus(allocation.aznAmount),
      );
    }
    const eventsByObligation = new Map<string, typeof events>();
    for (const event of events) {
      const list = eventsByObligation.get(event.obligationId) ?? [];
      list.push(event);
      eventsByObligation.set(event.obligationId, list);
    }

    const rows: DebtAsOfRow[] = obligations.map((obligation) => {
      const history = eventsByObligation.get(obligation.id) ?? [];
      const amountEvents = history.filter((e) => e.type === "CREATED" || e.type === "ADJUSTED");
      const cancelled = history.some((e) => e.type === "CANCELLED");
      const hasAmountEvent = amountEvents.length > 0;
      const amount = hasAmountEvent
        ? (amountEvents[amountEvents.length - 1].aznAmount ?? null)
        : obligation.aznAmount;
      const paid = paidByObligation.get(obligation.id) ?? new Prisma.Decimal(0);
      const remaining = amount == null ? null : Prisma.Decimal.max(amount.minus(paid), new Prisma.Decimal(0));

      const dueDate = obligation.dueDate;
      const overdue =
        !cancelled &&
        dueDate != null &&
        dueDate.getTime() < asOfDayStart.getTime() &&
        remaining != null &&
        remaining.greaterThan(0);

      let status: string;
      if (cancelled) status = "CANCELLED";
      else if (amount == null) status = "UNKNOWN";
      else if (paid.greaterThanOrEqualTo(amount)) status = "CLOSED";
      else if (paid.greaterThan(0)) status = "PARTIALLY_PAID";
      else status = "OPEN";

      return {
        obligationCode: obligation.code,
        invoiceNumber: obligation.invoiceNumber,
        supplierCode: obligation.supplierCode,
        partnerCode: obligation.partnerId ? (partnerCodes.get(obligation.partnerId) ?? null) : null,
        orderCode: obligation.orderCode,
        bookingCode: obligation.bookingCode,
        sourceAmount: toMoney2(obligation.sourceAmount, "sourceAmount").toString(),
        sourceCurrency: obligation.sourceCurrency,
        aznAmount: amount == null ? null : amount.toString(),
        paidAzn: paid.toString(),
        remainingAzn: remaining == null ? null : remaining.toString(),
        dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : null,
        status,
        overdue,
        precision: hasAmountEvent ? "EVENT" : "LEGACY_CURRENT",
      };
    });

    const totals = new Map<string, DebtAsOfTotals & { azn: Prisma.Decimal; paid: Prisma.Decimal; remaining: Prisma.Decimal; source: Prisma.Decimal }>();
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      // Отменённое обязательство — не долг: в итоги не попадает (строка в
      // отчёте остаётся для аудита состояния на дату).
      if (row.status === "CANCELLED") continue;
      const bucket = totals.get(row.sourceCurrency) ?? {
        currency: row.sourceCurrency,
        count: 0,
        sourceAmount: "0",
        aznAmount: "0",
        paidAzn: "0",
        remainingAzn: "0",
        unknownCount: 0,
        azn: new Prisma.Decimal(0),
        paid: new Prisma.Decimal(0),
        remaining: new Prisma.Decimal(0),
        source: new Prisma.Decimal(0),
      };
      bucket.count += 1;
      bucket.source = bucket.source.plus(new Prisma.Decimal(row.sourceAmount));
      bucket.paid = bucket.paid.plus(new Prisma.Decimal(row.paidAzn));
      if (row.aznAmount == null) bucket.unknownCount += 1;
      else bucket.azn = bucket.azn.plus(new Prisma.Decimal(row.aznAmount));
      if (row.remainingAzn != null) bucket.remaining = bucket.remaining.plus(new Prisma.Decimal(row.remainingAzn));
      totals.set(row.sourceCurrency, bucket);
    }
    const totalsByCurrency = [...totals.values()].map((b) => ({
      currency: b.currency,
      count: b.count,
      sourceAmount: b.source.toString(),
      aznAmount: b.azn.toString(),
      paidAzn: b.paid.toString(),
      remainingAzn: b.remaining.toString(),
      unknownCount: b.unknownCount,
    }));

    const warnings: string[] = [];
    const legacyCount = rows.filter((r) => r.precision === "LEGACY_CURRENT").length;
    if (legacyCount > 0) {
      warnings.push(
        `${legacyCount} obligation(s) have no historical amount events; their as-of amount is the CURRENT value (precision=LEGACY_CURRENT) — not a reconstructed history.`,
      );
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));
    const start = (page - 1) * pageSize;
    return {
      asOf: asOfInput,
      generatedAt: new Date().toISOString(),
      totalsByCurrency,
      items: rows.slice(start, start + pageSize),
      total: rows.length,
      page,
      pageSize,
      warnings,
    };
  }

  /** Плоские строки для CSV/XLSX (тот же расчёт; cap 5000). */
  async exportRows(query: { asOf?: string; supplierCode?: string; search?: string }): Promise<Array<Record<string, string | null>>> {
    const report = await this.getReport({ ...query, page: 1, pageSize: 200 });
    // Для экспорта нужны все строки, а не первая страница: переиспользуем расчёт.
    const all = report.total > report.items.length ? await this.getAllRows(query) : report.items;
    return all.map((r) => ({
      asOf: report.asOf,
      obligationCode: r.obligationCode,
      invoiceNumber: r.invoiceNumber,
      supplierCode: r.supplierCode,
      partnerCode: r.partnerCode,
      orderCode: r.orderCode,
      bookingCode: r.bookingCode,
      sourceAmount: r.sourceAmount,
      sourceCurrency: r.sourceCurrency,
      aznAmount: r.aznAmount,
      paidAzn: r.paidAzn,
      remainingAzn: r.remainingAzn,
      dueDate: r.dueDate,
      status: r.status,
      overdue: String(r.overdue),
      precision: r.precision,
    }));
  }

  private async getAllRows(query: { asOf?: string; supplierCode?: string; search?: string }): Promise<DebtAsOfRow[]> {
    // pageSize=200 cap; для выгрузки увеличиваем страницу и собираем чанками.
    const first = await this.getReport({ ...query, page: 1, pageSize: 200 });
    const rows = [...first.items];
    const pages = Math.ceil(first.total / 200);
    for (let page = 2; page <= pages; page += 1) {
      const next = await this.getReport({ ...query, page, pageSize: 200 });
      rows.push(...next.items);
    }
    return rows;
  }

  async auditExport(actor: { id: string; username: string }, asOf: string, filters: Record<string, unknown>): Promise<void> {
    await this.security.audit(undefined, {
      action: "finance.supplier_debt_report.exported",
      resource: "SupplierObligation",
      resourceId: null,
      details: { asOf, filters, actor: actor.username, actorId: actor.id },
    });
  }
}
