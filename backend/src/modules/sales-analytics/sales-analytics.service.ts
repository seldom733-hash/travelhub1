import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export const SALES_ANALYTICS_PRESETS = [
  "TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS",
  "CURRENT_WEEK", "PREVIOUS_WEEK", "CURRENT_MONTH", "PREVIOUS_MONTH",
  "CURRENT_QUARTER", "PREVIOUS_QUARTER", "CURRENT_YEAR", "PREVIOUS_YEAR", "CUSTOM",
] as const;
export type SalesAnalyticsPreset = (typeof SALES_ANALYTICS_PRESETS)[number];

export interface SalesAnalyticsQuery {
  preset?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  managerId?: string;
  serviceType?: string;
  source?: string;
  status?: string;
}

interface Period { start: Date; end: Date; preset: string; timezone: string }

function tzParts(date: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour), mi: Number(p.minute), s: Number(p.second) };
}

function zonedMidnight(y: number, m: number, d: number, timeZone: string): Date {
  const utcNoon = Date.UTC(y, m - 1, d, 12);
  const p = tzParts(new Date(utcNoon), timeZone);
  const tzAsUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  const offset = tzAsUtc - utcNoon;
  return new Date(Date.UTC(y, m - 1, d) - offset);
}

function addDays(d: Date, n: number) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }
function addMonths(y: number, m: number, n: number) { const d = new Date(Date.UTC(y, m - 1 + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }; }
function monthEnd(y: number, m: number, tz: string) { const n = addMonths(y, m, 1); return zonedMidnight(n.y, n.m, 1, tz); }
function quarterStartMonth(m: number) { return Math.floor((m - 1) / 3) * 3 + 1; }
function parseDate(s?: string): [number, number, number] | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return [y, m, d];
}

export function resolveSalesPeriod(q: SalesAnalyticsQuery, now = new Date()): Period {
  const timezone = q.timezone || "UTC";
  const preset = (q.preset || "CURRENT_MONTH").toUpperCase();
  const p = tzParts(now, timezone);
  const today = zonedMidnight(p.y, p.m, p.d, timezone);
  const tomorrow = addDays(today, 1);
  const nm = addMonths(p.y, p.m, 1);
  const nextMonth = zonedMidnight(nm.y, nm.m, 1, timezone);
  const pm = addMonths(p.y, p.m, -1);
  const prevMonth = zonedMidnight(pm.y, pm.m, 1, timezone);
  const weekStart = addDays(today, -((new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay() + 6) % 7));
  const weekEnd = addDays(weekStart, 7);
  const qStartMonth = quarterStartMonth(p.m);
  const qStart = zonedMidnight(p.y, qStartMonth, 1, timezone);
  const qEndMonth = addMonths(p.y, qStartMonth, 3);
  const qEnd = zonedMidnight(qEndMonth.y, qEndMonth.m, 1, timezone);
  const prevQStart = addMonths(p.y, qStartMonth, -3);
  const prevQEnd = qStart;
  const yearStart = zonedMidnight(p.y, 1, 1, timezone);
  const prevYearStart = zonedMidnight(p.y - 1, 1, 1, timezone);
  const prevYearEnd = yearStart;

  let start = today, end = tomorrow;
  switch (preset) {
    case "TODAY": break;
    case "YESTERDAY": start = addDays(today, -1); end = today; break;
    case "LAST_7_DAYS": start = addDays(today, -6); break;
    case "LAST_30_DAYS": start = addDays(today, -29); break;
    case "CURRENT_WEEK": start = weekStart; end = weekEnd; break;
    case "PREVIOUS_WEEK": start = addDays(weekStart, -7); end = weekStart; break;
    case "CURRENT_MONTH": start = zonedMidnight(p.y, p.m, 1, timezone); end = nextMonth; break;
    case "PREVIOUS_MONTH": start = prevMonth; end = zonedMidnight(p.y, p.m, 1, timezone); break;
    case "CURRENT_QUARTER": start = qStart; end = qEnd; break;
    case "PREVIOUS_QUARTER": start = zonedMidnight(prevQStart.y, prevQStart.m, 1, timezone); end = qStart; break;
    case "CURRENT_YEAR": start = yearStart; end = zonedMidnight(p.y + 1, 1, 1, timezone); break;
    case "PREVIOUS_YEAR": start = prevYearStart; end = prevYearEnd; break;
    case "CUSTOM": {
      const s = parseDate(q.startDate), e = parseDate(q.endDate);
      if (!s || !e) throw new Error("CUSTOM requires startDate and endDate (YYYY-MM-DD)");
      start = zonedMidnight(s[0], s[1], s[2], timezone);
      end = addDays(zonedMidnight(e[0], e[1], e[2], timezone), 1);
      break;
    }
    default: break;
  }
  return { start, end, preset, timezone };
}

function previousPeriod(p: Period): Period {
  const t = tzParts(p.start, p.timezone);
  if (p.preset === "CURRENT_MONTH") {
    const m = addMonths(t.y, t.m, -1);
    return { start: zonedMidnight(m.y, m.m, 1, p.timezone), end: p.start, preset: "PREVIOUS", timezone: p.timezone };
  }
  if (p.preset === "CURRENT_QUARTER") {
    const m = addMonths(t.y, t.m, -3);
    return { start: zonedMidnight(m.y, m.m, 1, p.timezone), end: p.start, preset: "PREVIOUS", timezone: p.timezone };
  }
  if (p.preset === "CURRENT_YEAR") {
    return { start: zonedMidnight(t.y - 1, 1, 1, p.timezone), end: p.start, preset: "PREVIOUS", timezone: p.timezone };
  }
  if (p.preset === "CURRENT_WEEK") {
    return { start: addDays(p.start, -7), end: p.start, preset: "PREVIOUS", timezone: p.timezone };
  }
  const ms = p.end.getTime() - p.start.getTime();
  return { start: new Date(p.start.getTime() - ms), end: new Date(p.start.getTime()), preset: "PREVIOUS", timezone: p.timezone };
}

function pct(cur: number, prev: number): number | null {
  if (!prev) return cur === 0 ? 0 : null;
  return Math.round(((cur - prev) / prev) * 10000) / 100;
}
function delta(cur: number, prev: number) { return Math.round((cur - prev) * 100) / 100; }
function num(v: any) { return v == null ? 0 : Number(v); }
function dateIn(d: Date | null | undefined, p: Period) { return !!d && d >= p.start && d < p.end; }
function key(...parts: Array<string | null | undefined>) { return parts.filter(Boolean).join("|"); }

const TERMINAL_REQUEST = ["CONVERTED", "REJECTED", "UNAVAILABLE", "EXPIRED", "CUSTOMER_PAYMENT_TIMEOUT", "CANCELLED_BY_CUSTOMER"];

@Injectable()
export class SalesAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(q: SalesAnalyticsQuery, user: any) {
    const period = resolveSalesPeriod(q);
    const previous = previousPeriod(period);
    const managerId = user?.role === "SALES_MANAGER" ? user.id : (q.managerId || undefined);
    const current = await this.compute(period, { ...q, managerId });
    const prev = await this.compute(previous, { ...q, managerId });
    // Period assignments and live load are different facts: live load includes
    // older requests still active today.
    const liveWhere: any = { status: { notIn: TERMINAL_REQUEST } };
    if (managerId) liveWhere.assignedManagerId = managerId;
    const liveRequests = await this.prisma.request.findMany({
      where: liveWhere,
      select: { assignedManagerId: true, processingStartedAt: true, slaDueAt: true },
    });
    const liveByManager = new Map<string, { load: number; unprocessed: number; overdue: number }>();
    for (const r of liveRequests) {
      const k = r.assignedManagerId ?? "unassigned";
      const row = liveByManager.get(k) ?? { load: 0, unprocessed: 0, overdue: 0 };
      row.load++;
      if (!r.processingStartedAt) row.unprocessed++;
      if (r.slaDueAt && r.slaDueAt < new Date()) row.overdue++;
      liveByManager.set(k, row);
    }
    if (current.distribution?.managers) {
      current.distribution.managers = current.distribution.managers.map((m: any) => {
        const live = liveByManager.get(m.managerId ?? "unassigned") ?? { load: 0, unprocessed: 0, overdue: 0 };
        return { ...m, currentLoad: live.load, unprocessed: live.unprocessed, overdue: live.overdue };
      });
    }
    current.managers = current.managers.map((m: any) => {
      const live = liveByManager.get(m.managerId ?? "unassigned") ?? { load: 0, unprocessed: 0, overdue: 0 };
      return { ...m, currentLoad: live.load, liveUnprocessed: live.unprocessed, liveOverdue: live.overdue };
    });
    const kpis: Record<string, any> = {};
    for (const k of Object.keys(current.kpis)) {
      const cur = current.kpis[k];
      const old = prev.kpis[k] ?? 0;
      kpis[k] = { value: cur, previous: old, delta: delta(cur, old), pct: pct(cur, old) };
    }
    return {
      period: { ...period, comparison: { start: previous.start, end: previous.end } },
      scope: { managerId: managerId ?? null, restricted: user?.role === "SALES_MANAGER" },
      kpis,
      managers: current.managers,
      funnel: current.funnel,
      services: current.services,
      activity: current.activity,
      deals: current.deals,
      series: current.series,
      sources: current.sources,
      distribution: current.distribution,
      lossReasons: current.lossReasons,
      financials: current.financials,
    };
  }

  async drilldown(metric: string, q: SalesAnalyticsQuery, user: any) {
    const data = await this.dashboard(q, user);
    const requestMetrics = new Set([
      "requestsTotal", "assigned", "accepted", "inWork", "noFirstResponse",
      "proposalsSent", "lostRequests", "overdueRequests",
    ]);
    let rows: any[] = [];
    if (requestMetrics.has(metric)) rows = data.activity ?? [];
    else if (metric === "ordersCreated" || metric === "cancelledOrders" || metric === "grossProfit") {
      rows = (data.activity ?? []).filter((r: any) => !!r.orderCode);
    } else if (metric === "bookingsConfirmed" || metric === "cancelledBookings") {
      rows = (data.activity ?? []).filter((r: any) => !!r.bookingCode);
    } else if (metric === "capturedRevenue" || metric === "refunds" || metric === "salesAmount") {
      rows = data.financials ?? [];
    } else if (metric === "completedDeals" || metric === "completedResult") {
      rows = data.deals?.completed ?? [];
    } else if (metric === "closedDeals" || metric === "closedResult") {
      rows = data.deals?.closed ?? [];
    } else {
      rows = data.activity ?? [];
    }
    return { metric, total: rows.length, rows, period: data.period };
  }

  async managerDetail(id: string, q: SalesAnalyticsQuery, user: any) {
    if (user?.role === "SALES_MANAGER" && user.id !== id) throw new ForbiddenException("Manager scope");
    const data = await this.dashboard({ ...q, managerId: id }, user);
    const requestCodes = new Map((data.activity ?? []).map((r: any) => [r.requestId, r.requestCode]));
    const requestIds = [...requestCodes.keys()];
    const history = requestIds.length
      ? await this.prisma.requestHistory.findMany({
          where: { requestId: { in: requestIds } },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : [];
    const manager = (data.managers ?? []).find((m: any) => m.managerId === id) ?? null;
    return {
      ...data,
      managerId: id,
      manager,
      assignments: history
        .filter((h) => ["ASSIGNED", "returned_from_order"].includes(h.action))
        .map((h) => ({
          requestId: h.requestId,
          requestCode: requestCodes.get(h.requestId) ?? null,
          action: h.action,
          to: h.to,
          actorName: h.actorName,
          comment: h.comment,
          createdAt: h.createdAt,
        })),
      actions: history.slice(0, 100).map((h) => ({
        requestId: h.requestId,
        requestCode: requestCodes.get(h.requestId) ?? null,
        action: h.action,
        from: h.from,
        to: h.to,
        actorName: h.actorName,
        createdAt: h.createdAt,
      })),
    };
  }

  private async compute(p: Period, q: SalesAnalyticsQuery) {
    const requestWhere: any = { createdAt: { gte: p.start, lt: p.end } };
    if (q.managerId) requestWhere.assignedManagerId = q.managerId;
    if (q.serviceType) requestWhere.requestType = q.serviceType;
    if (q.source) requestWhere.sourceChannel = q.source;
    if (q.status) requestWhere.status = q.status;

    const requests = await this.prisma.request.findMany({ where: requestWhere, orderBy: { createdAt: "desc" } });
    const requestIds = requests.map((r) => r.id);
    const requestOrderIds = requests.map((r) => r.convertedOrderId).filter((x): x is string => !!x);

    const orders = await this.prisma.order.findMany({
      where: {
        OR: [
          { createdAt: { gte: p.start, lt: p.end } },
          ...(requestOrderIds.length ? [{ id: { in: requestOrderIds } }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      include: { items: { select: { id: true, title: true, type: true, amount: true } } },
    });
    const orderIds = orders.map((o) => o.id);
    const bookings = await this.prisma.booking.findMany({ where: { orderId: { in: orderIds } } });
    const bookingOrderIds = new Map(bookings.map((b) => [b.id, b.orderId]));
    const payments = await this.prisma.payment.findMany({
      where: { status: "CAPTURED", paidAt: { gte: p.start, lt: p.end }, orderId: { in: orderIds } },
      select: { orderId: true, amount: true, code: true, paidAt: true },
    });
    const refunds = await this.prisma.refund.findMany({
      where: { status: "PROCESSED", processedAt: { gte: p.start, lt: p.end }, orderId: { in: orderIds } },
      select: { orderId: true, amount: true, code: true, processedAt: true },
    });

    const requestByOrder = new Map<string, any>();
    for (const r of requests) if (r.convertedOrderId) requestByOrder.set(r.convertedOrderId, r);
    const orderById = new Map(orders.map((o) => [o.id, o]));
    const bookingByOrder = new Map<string, any[]>();
    for (const b of bookings) {
      const arr = bookingByOrder.get(b.orderId) ?? [];
      arr.push(b);
      bookingByOrder.set(b.orderId, arr);
    }
    const paymentsByOrder = new Map<string, number>();
    for (const pay of payments) paymentsByOrder.set(pay.orderId, (paymentsByOrder.get(pay.orderId) ?? 0) + num(pay.amount));
    const refundsByOrder = new Map<string, number>();
    for (const r of refunds) refundsByOrder.set(r.orderId, (refundsByOrder.get(r.orderId) ?? 0) + num(r.amount));

    const customerIds = [...new Set([...requests.map((r) => r.customerId), ...orders.map((o) => o.customerId)].filter((x): x is string => !!x))];
    const customerById = new Map((await this.prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, code: true, firstName: true, lastName: true, companyName: true, phone: true } })).map((c) => [c.id, c]));
    const managerIds = [...new Set(requests.map((r) => r.assignedManagerId).filter((x): x is string => !!x))];
    const managerById = new Map((await this.prisma.user.findMany({ where: { id: { in: managerIds } }, select: { id: true, fullName: true, username: true } })).map((u) => [u.id, u]));
    const financials = [
      ...payments.map((x) => ({
        kind: "PAYMENT", code: x.code, orderId: x.orderId,
        orderCode: orderById.get(x.orderId)?.referenceNumber ?? null,
        manager: requestByOrder.get(x.orderId)?.assignedManagerId
          ? managerById.get(requestByOrder.get(x.orderId).assignedManagerId)?.fullName ?? null : null,
        amount: num(x.amount), date: x.paidAt, status: "CAPTURED",
      })),
      ...refunds.map((x) => ({
        kind: "REFUND", code: x.code, orderId: x.orderId,
        orderCode: orderById.get(x.orderId)?.referenceNumber ?? null,
        manager: requestByOrder.get(x.orderId)?.assignedManagerId
          ? managerById.get(requestByOrder.get(x.orderId).assignedManagerId)?.fullName ?? null : null,
        amount: num(x.amount), date: x.processedAt, status: "PROCESSED",
      })),
    ];

    const requestHistory = requestIds.length
      ? await this.prisma.requestHistory.findMany({ where: { requestId: { in: requestIds } }, orderBy: { createdAt: "desc" } })
      : [];
    const proposals = new Set(requestHistory.filter((h) => ["supplier_confirmed", "PRICE_CHANGED"].includes(h.action)).map((h) => h.requestId));

    // A manager-scoped report must never include other managers' Orders merely
    // because those Orders were created in the same period.
    const linkedOrderIds = new Set(requests.map((r) => r.convertedOrderId).filter((x): x is string => !!x));
    const scopedOrders = q.managerId ? orders.filter((o) => linkedOrderIds.has(o.id)) : orders;
    const scopedOrderIdSet = new Set(scopedOrders.map((o) => o.id));
    const inScopeBooking = (b: any) => scopedOrderIdSet.has(b.orderId);

    const ordersCreated = scopedOrders.filter((o) => dateIn(o.createdAt, p));
    const bookingsConfirmed = bookings.filter((b) => inScopeBooking(b) && orderById.get(b.orderId)?.status !== "CANCELLED" && dateIn(b.confirmedAt, p));
    const completedBookings = bookings.filter((b) => inScopeBooking(b) && orderById.get(b.orderId)?.status !== "CANCELLED" && dateIn(b.completedAt, p));
    const closedOrders = scopedOrders.filter((o) => o.status !== "CANCELLED" && dateIn(o.closedAt, p));
    const cancelledOrders = scopedOrders.filter((o) => dateIn(o.cancelledAt, p));
    const cancelledBookings = bookings.filter((b) => inScopeBooking(b) && dateIn(b.cancelledAt, p));
    const completedOrders = scopedOrders.filter((o) => o.status !== "CANCELLED" && (dateIn(o.fulfilledAt, p) || bookings.some((b) => b.orderId === o.id && dateIn(b.completedAt, p))));
    const lostRequests = requests.filter((r) => ["REJECTED", "UNAVAILABLE", "EXPIRED", "CUSTOMER_PAYMENT_TIMEOUT", "CANCELLED_BY_CUSTOMER"].includes(r.status));
    const lossReasonMap = new Map<string, number>();
    for (const r of lostRequests) {
      const reason = r.rejectionReason?.trim() || r.status;
      lossReasonMap.set(reason, (lossReasonMap.get(reason) ?? 0) + 1);
    }
    const overdue = requests.filter((r) => !!r.slaDueAt && r.slaDueAt < new Date() && !TERMINAL_REQUEST.includes(r.status));
    const noFirstResponse = requests.filter((r) => !r.firstContactAt && !TERMINAL_REQUEST.includes(r.status));
    const assigned = requests.filter((r) => !!r.assignedAt);
    const accepted = requests.filter((r) => !!r.processingStartedAt);
    const inWork = requests.filter((r) => !TERMINAL_REQUEST.includes(r.status));
    const slaEligible = requests.filter((r) => !!r.slaDueAt);
    const slaCompliant = slaEligible.filter((r) => !!r.firstContactAt && r.firstContactAt <= r.slaDueAt!);

    const linkedOrders = linkedOrderIds;
    const linkedOrderList = [...linkedOrders].map((id) => orderById.get(id)).filter((x): x is NonNullable<typeof x> => !!x);
    const cohortOrders = linkedOrderList.length ? linkedOrderList : [];
    const cohortWithBooking = cohortOrders.filter((o) => (bookingByOrder.get(o.id) ?? []).some((b) => !!b.confirmedAt));
    const cohortCompleted = cohortOrders.filter((o) => !!o.fulfilledAt || (bookingByOrder.get(o.id) ?? []).some((b) => !!b.completedAt));
    const cohortClosed = cohortOrders.filter((o) => !!o.closedAt);

    const salesOrders = ordersCreated.filter((o) => o.status !== "CANCELLED");
    const salesAmount = salesOrders.reduce((s, o) => s + num(o.amount), 0);
    const captured = payments.filter((x) => scopedOrderIdSet.has(x.orderId) && orderById.get(x.orderId)?.status !== "CANCELLED").reduce((s, x) => s + num(x.amount), 0);
    const refunded = refunds.filter((x) => scopedOrderIdSet.has(x.orderId) && orderById.get(x.orderId)?.status !== "CANCELLED").reduce((s, x) => s + num(x.amount), 0);
    const costFor = (o: any) => {
      const linkedRequest = requestByOrder.get(o.id);
      const snapshot = linkedRequest?.commercialSnapshot as any;
      const snapshotCost = num(snapshot?.netSupplierCost);
      if (snapshotCost > 0) return snapshotCost;
      return (bookingByOrder.get(o.id) ?? [])
        .filter((b) => b.status !== "CANCELLED" && b.status !== "SUPPLIER_REJECTED")
        .reduce((s, b) => s + num(b.amount), 0);
    };
    const cost = salesOrders.reduce((s, o) => s + costFor(o), 0);
    const grossProfit = salesAmount - cost;
    const completedResult = completedOrders.reduce((s, o) => s + num(o.amount) - costFor(o) - (refundsByOrder.get(o.id) ?? 0), 0);
    const closedResult = closedOrders.reduce((s, o) => s + num(o.amount) - costFor(o) - (refundsByOrder.get(o.id) ?? 0), 0);
    const avgCheck = salesOrders.length ? salesAmount / salesOrders.length : 0;

    const kpis: Record<string, number> = {
      requestsTotal: requests.length,
      assigned: assigned.length,
      accepted: accepted.length,
      inWork: inWork.length,
      noFirstResponse: noFirstResponse.length,
      proposalsSent: proposals.size,
      lostRequests: lostRequests.length,
      overdueRequests: overdue.length,
      slaCompliance: slaEligible.length ? slaCompliant.length / slaEligible.length * 100 : 0,
      ordersCreated: ordersCreated.length,
      bookingsConfirmed: bookingsConfirmed.length,
      completedDeals: completedOrders.length,
      closedDeals: closedOrders.length,
      cancelledOrders: cancelledOrders.length,
      cancelledBookings: cancelledBookings.length,
      conversionRequestOrder: requests.length ? cohortOrders.length / requests.length * 100 : 0,
      conversionOrderBooking: cohortOrders.length ? cohortWithBooking.length / cohortOrders.length * 100 : 0,
      conversionRequestBooking: requests.length ? cohortWithBooking.length / requests.length * 100 : 0,
      conversionRequestCompleted: requests.length ? cohortCompleted.length / requests.length * 100 : 0,
      conversionRequestClosed: requests.length ? cohortClosed.length / requests.length * 100 : 0,
      salesAmount: Math.round(salesAmount * 100) / 100,
      capturedRevenue: Math.round(captured * 100) / 100,
      costAmount: Math.round(cost * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      avgCheck: Math.round(avgCheck * 100) / 100,
      refunds: Math.round(refunded * 100) / 100,
      completedResult: Math.round(completedResult * 100) / 100,
      closedResult: Math.round(closedResult * 100) / 100,
    };

    const managerRows = new Map<string, any>();
    const ensureManager = (id: string | null | undefined) => {
      const k = id ?? "unassigned";
      if (!managerRows.has(k)) {
        const u = id ? managerById.get(id) : null;
        managerRows.set(k, {
          managerId: id, manager: u?.fullName ?? u?.username ?? (id ? id : "Не назначен"),
          requests: 0, assigned: 0, accepted: 0, processed: 0, inWork: 0, noFirstResponse: 0,
          proposalsSent: 0, transferred: 0, receivedTransfers: 0, lost: 0, overdue: 0,
          orders: 0, bookings: 0, completed: 0, closed: 0, cancelledOrders: 0, cancelledBookings: 0,
          salesAmount: 0, capturedRevenue: 0, grossProfit: 0, refunds: 0, slaEligible: 0, slaCompliant: 0,
          responseSum: 0, responseCount: 0,
        });
      }
      return managerRows.get(k);
    };
    for (const r of requests) {
      const m = ensureManager(r.assignedManagerId);
      m.requests++;
      if (r.assignedAt) m.assigned++;
      if (r.processingStartedAt) m.accepted++;
      if (r.firstContactAt || r.processingStartedAt) m.processed++;
      if (!TERMINAL_REQUEST.includes(r.status)) m.inWork++;
      if (!r.firstContactAt && !TERMINAL_REQUEST.includes(r.status)) m.noFirstResponse++;
      if (proposals.has(r.id)) m.proposalsSent++;
      if (lostRequests.some((x) => x.id === r.id)) m.lost++;
      if (overdue.some((x) => x.id === r.id)) m.overdue++;
      if (r.slaDueAt) { m.slaEligible++; if (r.firstContactAt && r.firstContactAt <= r.slaDueAt) m.slaCompliant++; }
      const firstContact = r.firstContactAt ?? r.processingStartedAt;
      if (firstContact && r.createdAt) { m.responseSum += Math.max(0, (firstContact.getTime() - r.createdAt.getTime()) / 3600000); m.responseCount++; }
      const o = r.convertedOrderId ? orderById.get(r.convertedOrderId) : null;
      if (o) {
        m.orders++;
        if ((bookingByOrder.get(o.id) ?? []).some((b) => !!b.confirmedAt)) m.bookings++;
        if (o.fulfilledAt || (bookingByOrder.get(o.id) ?? []).some((b) => !!b.completedAt)) m.completed++;
        if (o.closedAt) m.closed++;
        if (o.cancelledAt) m.cancelledOrders++;
        if (o.status !== "CANCELLED") {
          m.salesAmount += num(o.amount);
          m.capturedRevenue += paymentsByOrder.get(o.id) ?? 0;
          m.refunds += refundsByOrder.get(o.id) ?? 0;
          m.grossProfit += num(o.amount) - costFor(o);
        }
        m.cancelledBookings += (bookingByOrder.get(o.id) ?? []).filter((b) => !!b.cancelledAt).length;
      }
    }
    const managers = [...managerRows.values()].map((m) => ({
      ...m,
      avgResponseHours: m.responseCount ? Math.round((m.responseSum / m.responseCount) * 100) / 100 : null,
      slaCompliance: m.slaEligible ? Math.round((m.slaCompliant / m.slaEligible) * 10000) / 100 : 0,
      conversionRequestOrder: m.requests ? Math.round((m.orders / m.requests) * 10000) / 100 : 0,
      conversionRequestCompleted: m.requests ? Math.round((m.completed / m.requests) * 10000) / 100 : 0,
      conversionRequestClosed: m.requests ? Math.round((m.closed / m.requests) * 10000) / 100 : 0,
    })).sort((a, b) => b.salesAmount - a.salesAmount);

    const funnel = [
      { stage: "requests", label: "Заявки", count: requests.length, conversion: 100 },
      { stage: "processing", label: "В обработке", count: accepted.length, conversion: requests.length ? accepted.length / requests.length * 100 : 0 },
      { stage: "proposal", label: "Предложение", count: proposals.size, conversion: requests.length ? proposals.size / requests.length * 100 : 0 },
      { stage: "orders", label: "Заказы", count: cohortOrders.length, conversion: requests.length ? cohortOrders.length / requests.length * 100 : 0 },
      { stage: "bookings", label: "Бронирования", count: cohortWithBooking.length, conversion: requests.length ? cohortWithBooking.length / requests.length * 100 : 0 },
      { stage: "completed", label: "Завершено", count: cohortCompleted.length, conversion: requests.length ? cohortCompleted.length / requests.length * 100 : 0 },
      { stage: "closed", label: "Закрыто", count: cohortClosed.length, conversion: requests.length ? cohortClosed.length / requests.length * 100 : 0 },
    ];

    const serviceMap = new Map<string, any>();
    for (const r of requests) {
      const t = r.requestType ?? "OTHER";
      const row = serviceMap.get(t) ?? { serviceType: t, requests: 0, orders: 0, bookings: 0, completed: 0, salesAmount: 0, capturedRevenue: 0, grossProfit: 0 };
      row.requests++;
      const o = r.convertedOrderId ? orderById.get(r.convertedOrderId) : null;
      if (o) {
        row.orders++;
        if ((bookingByOrder.get(o.id) ?? []).some((b) => !!b.confirmedAt)) row.bookings++;
        if (o.fulfilledAt) row.completed++;
        row.salesAmount += num(o.amount);
        row.capturedRevenue += paymentsByOrder.get(o.id) ?? 0;
        row.grossProfit += num(o.amount) - costFor(o);
      }
      serviceMap.set(t, row);
    }

    const sourceMap = new Map<string, any>();
    for (const r of requests) {
      const s = r.sourceChannel ?? "UNKNOWN";
      const row = sourceMap.get(s) ?? { source: s, requests: 0, orders: 0, bookings: 0, completed: 0, closed: 0, salesAmount: 0 };
      row.requests++;
      const o = r.convertedOrderId ? orderById.get(r.convertedOrderId) : null;
      if (o) {
        row.orders++;
        if ((bookingByOrder.get(o.id) ?? []).some((b) => !!b.confirmedAt)) row.bookings++;
        if (o.fulfilledAt) row.completed++;
        if (o.closedAt) row.closed++;
        row.salesAmount += num(o.amount);
      }
      sourceMap.set(s, row);
    }

    const cname = (id: string | null) => {
      const c = id ? customerById.get(id) : null;
      return c?.companyName ?? [c?.firstName, c?.lastName].filter(Boolean).join(" ") ?? "—";
    };
    const activity = requests.map((r) => {
      const o = r.convertedOrderId ? orderById.get(r.convertedOrderId) : null;
      const bs = o ? bookingByOrder.get(o.id) ?? [] : [];
      const first = bs.find((b) => !!b.confirmedAt);
      return {
        requestId: r.id, requestCode: r.referenceNumber, createdAt: r.createdAt, assignedAt: r.assignedAt,
        managerId: r.assignedManagerId, manager: r.assignedManagerId ? managerById.get(r.assignedManagerId)?.fullName ?? "—" : "Не назначен",
        customerId: r.customerId, customer: cname(r.customerId), phone: r.customerId ? customerById.get(r.customerId)?.phone ?? null : null,
        requestType: r.requestType, destination: r.tripCountry, source: r.sourceChannel, status: r.status,
        firstContactAt: r.firstContactAt, processingStartedAt: r.processingStartedAt,
        ageHours: Math.round(((Date.now() - r.createdAt.getTime()) / 3600000) * 10) / 10,
        responseHours: r.firstContactAt ? Math.round(((r.firstContactAt.getTime() - r.createdAt.getTime()) / 3600000) * 10) / 10 : null,
        slaCompliant: r.slaDueAt ? Boolean(r.firstContactAt && r.firstContactAt <= r.slaDueAt) : null,
        overdue: !!r.slaDueAt && r.slaDueAt < new Date() && !TERMINAL_REQUEST.includes(r.status),
        orderCode: o?.referenceNumber ?? null, bookingCode: first?.referenceNumber ?? null,
        proposalSent: proposals.has(r.id),
        waitingCustomer: !r.customerAcceptedAt && ["PRICE_CHANGED", "CONFIRMED"].includes(r.status),
        waitingSupplier: !r.supplierRespondedAt && ["NEW", "CHECKING"].includes(r.status),
      };
    });

    const dealRows = (tab: "completed" | "closed") => scopedOrders.filter((o) => o.status !== "CANCELLED" && (tab === "completed" ? (dateIn(o.fulfilledAt, p) || (bookingByOrder.get(o.id) ?? []).some((b) => dateIn(b.completedAt, p))) : dateIn(o.closedAt, p))).map((o) => {
      const r = requestByOrder.get(o.id);
      const bs = bookingByOrder.get(o.id) ?? [];
      const b = bs.find((x) => tab === "closed" ? !!x.completedAt : !!x.completedAt) ?? bs[0];
      return {
        orderId: o.id, orderCode: o.referenceNumber, requestCode: r?.referenceNumber ?? null, bookingCode: b?.referenceNumber ?? null,
        customer: cname(o.customerId), phone: o.customerId ? customerById.get(o.customerId)?.phone ?? null : null,
        manager: r?.assignedManagerId ? managerById.get(r.assignedManagerId)?.fullName ?? null : null,
        requestType: r?.requestType ?? null, destination: r?.tripCountry ?? null,
        requestCreatedAt: r?.createdAt ?? null, orderCreatedAt: o.createdAt, bookingConfirmedAt: b?.confirmedAt ?? null,
        serviceCompletedAt: o.fulfilledAt ?? b?.completedAt ?? null, closedAt: o.closedAt,
        clientPrice: num(o.amount), cost: costFor(o), revenue: paymentsByOrder.get(o.id) ?? 0,
        grossProfit: num(o.amount) - costFor(o), financialStatus: o.financialStatus,
        status: o.status,
        services: ((o as any).items ?? []).map((item: any) => ({
          title: item.title,
          type: item.type,
          amount: num(item.amount),
          cost: num(o.amount) > 0 ? costFor(o) * (num(item.amount) / num(o.amount)) : 0,
        })),
      };
    });

    const days = Math.max(1, Math.ceil((p.end.getTime() - p.start.getTime()) / 86400000));
    const series = Array.from({ length: Math.min(days, 90) }, (_, i) => {
      const d = addDays(new Date(p.start), i);
      const next = addDays(d, 1);
      return {
        date: d.toISOString().slice(0, 10),
        requests: requests.filter((r) => r.createdAt >= d && r.createdAt < next).length,
        orders: ordersCreated.filter((o) => o.createdAt >= d && o.createdAt < next).length,
        bookings: bookingsConfirmed.filter((b) => b.confirmedAt && b.confirmedAt >= d && b.confirmedAt < next).length,
        completed: completedOrders.filter((o) => (o.fulfilledAt ?? o.updatedAt) >= d && (o.fulfilledAt ?? o.updatedAt) < next).length,
        closed: closedOrders.filter((o) => o.closedAt && o.closedAt >= d && o.closedAt < next).length,
        salesAmount: ordersCreated.filter((o) => o.createdAt >= d && o.createdAt < next).reduce((s, o) => s + num(o.amount), 0),
      };
    });

    const assignmentRows = requestHistory.filter((h) => h.action === "ASSIGNED");
    const assignmentCounts = new Map<string, number>();
    for (const h of assignmentRows) assignmentCounts.set(h.requestId, (assignmentCounts.get(h.requestId) ?? 0) + 1);
    const distribution = {
      received: requests.length,
      autoAssigned: requests.filter((r) => r.assignmentType === "AUTO").length,
      manualAssigned: requests.filter((r) => r.assignmentType === "MANUAL" || r.assignmentType === "SELF").length,
      unassigned: requests.filter((r) => !r.assignedManagerId).length,
      reassigned: [...assignmentCounts.values()].filter((n) => n > 1).length,
      assignmentEvents: assignmentRows.length,
      managers: managers.map((m) => ({
        managerId: m.managerId, manager: m.manager, assigned: m.assigned,
        currentLoad: m.inWork, unprocessed: m.noFirstResponse, overdue: m.overdue,
      })),
    };

    return { kpis, managers, funnel, services: [...serviceMap.values()], sources: [...sourceMap.values()], lossReasons: [...lossReasonMap.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count), activity, deals: { completed: dealRows("completed"), closed: dealRows("closed") }, series, distribution, financials };
  }
}
