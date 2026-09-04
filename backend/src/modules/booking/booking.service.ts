import { Injectable } from "@nestjs/common";
import type { BookingStatus, OrderStatus, Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents, type BookingEventPayload } from "../../eventbus/domain-events";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { BookingQueryService } from "./booking-query.service";
import { overviewBookingWhere } from "./booking-kpi-scope";
import { buildSortClause } from '../../shared/sort';
import { isDeniedStorefrontScope } from "../../shared/sales-scope";

export type BookingAction =
  | "prepare"
  | "send"
  | "requestClarification"
  | "resume"
  | "confirm"
  | "reject"
  | "service"
  | "requestChange"
  | "resolveChange"
  | "requestCancellation"
  | "complete"
  | "cancel"
  | "problem";

/**
 * Step 2.9 — canonical Booking lifecycle (Screen Design codes verbatim: NEW,
 * PREPARING_REQUEST, SENT_TO_SUPPLIER, AWAITING_CONFIRMATION, CONFIRMED,
 * IN_SERVICE, COMPLETED, NEEDS_CLARIFICATION, SUPPLIER_REJECTED,
 * CHANGE_REQUESTED, CANCELLATION_REQUESTED, CANCELLED, PROBLEM).
 *
 * Терминальные: SUPPLIER_REJECTED, COMPLETED, CANCELLED (не reopen-аются).
 * AWAITING_CONFIRMATION — резервный код без producer-а (legacy-источник для
 * confirm/reject; как READY_TO_CLOSE в Order). NEEDS_CLARIFICATION /
 * CHANGE_REQUESTED / CANCELLATION_REQUESTED — operational marker-состояния
 * (screen queues), НЕ меняют frozen money/acquisition/service occurrence.
 */
const ACTIVE: BookingStatus[] = [
  "NEW",
  "PREPARING_REQUEST",
  "SENT_TO_SUPPLIER",
  "AWAITING_CONFIRMATION",
  "CONFIRMED",
  "IN_SERVICE",
  "NEEDS_CLARIFICATION",
  "CHANGE_REQUESTED",
  "CANCELLATION_REQUESTED",
  "PROBLEM",
];

const TRANSITIONS: Record<BookingAction, { from: BookingStatus[]; to: BookingStatus }> = {
  prepare: { from: ["NEW"], to: "PREPARING_REQUEST" },
  send: { from: ["NEW", "PREPARING_REQUEST"], to: "SENT_TO_SUPPLIER" },
  requestClarification: { from: ["SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION"], to: "NEEDS_CLARIFICATION" },
  resume: { from: ["NEEDS_CLARIFICATION"], to: "SENT_TO_SUPPLIER" },
  confirm: { from: ["SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION"], to: "CONFIRMED" },
  reject: { from: ["SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION"], to: "SUPPLIER_REJECTED" },
  service: { from: ["CONFIRMED"], to: "IN_SERVICE" },
  requestChange: { from: ["CONFIRMED", "IN_SERVICE"], to: "CHANGE_REQUESTED" },
  resolveChange: { from: ["CHANGE_REQUESTED"], to: "CONFIRMED" },
  requestCancellation: { from: ["CONFIRMED", "IN_SERVICE", "CHANGE_REQUESTED", "NEEDS_CLARIFICATION"], to: "CANCELLATION_REQUESTED" },
  complete: { from: ["IN_SERVICE"], to: "COMPLETED" },
  cancel: { from: ACTIVE, to: "CANCELLED" },
  // STRICT REVIEW FIX (2.9 §28): problem НЕ является самопереходом (как Order
  // `problem` — исключает PROBLEM): повторный problem с PROBLEM → 409, без
  // шумной self-transition history/события.
  problem: { from: ACTIVE.filter((s) => s !== "PROBLEM"), to: "PROBLEM" },
};

/**
 * STRICT REVIEW FIX (2.9 §14/§28): терминальные состояния Order, при которых
 * lifecycle-команда Booking бессмысленна/запрещена. Инвариант Step 2.9 §15:
 * «нет активной Booking под отменённым/закрытым заказом». `cancel` разрешён
 * (сходится к терминальному состоянию — безопасный valve), остальные команды
 * (в т.ч. confirm/reject/service/complete/change/clarification) — 409.
 * Cross-domain READ (ADR-0001) — Order таблицы не пишутся.
 */
const ORDER_TERMINAL_GUARD: OrderStatus[] = ["CANCELLED", "CLOSED"];

const ACTION_LABELS: Record<BookingAction, string> = {
  prepare: "Запрос готовится к отправке поставщику",
  send: "Запрос отправлен поставщику",
  requestClarification: "Запрошено уточнение у поставщика",
  resume: "Обработка возобновлена после уточнения",
  confirm: "Бронирование подтверждено",
  reject: "Отклонено поставщиком",
  service: "Услуга началась",
  requestChange: "Запрошено изменение бронирования",
  resolveChange: "Изменение обработано, бронирование продолжается",
  requestCancellation: "Запрошена отмена бронирования",
  complete: "Бронирование завершено",
  cancel: "Бронирование отменено",
  problem: "Бронирование помечено проблемным",
};

/**
 * Booking Center — единственный владелец Booking/Reservation/SupplierConfirmation/Passenger.
 * Booking создаётся ТОЛЬКО consumer-ом BookingRequested (никакого POST /bookings).
 * Публикует: BookingConfirmed, BookingRejected, BookingCancelled, BookingCompleted,
 * BookingStatusChanged (технические переходы).
 * Step 2.9: единственная state-machine authority (HARD GATE) — контроллеры и
 * consumer-ы НЕ реализуют независимые переходы; compensation-консьюмер
 * OrderCancelled использует те же guards/CAS (см. booking.subscribers.ts).
 */
const ACTION_PERMISSIONS: Record<BookingAction, string> = {
  prepare: "booking.send_supplier",
  send: "booking.send_supplier",
  requestClarification: "booking.confirm",
  resume: "booking.confirm",
  confirm: "booking.confirm",
  reject: "booking.confirm",
  service: "booking.confirm",
  requestChange: "booking.request_change",
  resolveChange: "booking.request_change",
  requestCancellation: "booking.cancel",
  complete: "booking.confirm",
  cancel: "booking.cancel",
  problem: "booking.confirm",
};

export function computeAvailableBookingActions(
  booking: { status: BookingStatus; orderId: string },
  granted: readonly string[],
): BookingAction[] {
  const actions: BookingAction[] = [];
  for (const action of Object.keys(TRANSITIONS) as BookingAction[]) {
    const t = TRANSITIONS[action];
    if (!t.from.includes(booking.status)) continue;
    if (!granted.includes(ACTION_PERMISSIONS[action])) continue;
    actions.push(action);
  }
  return actions;
}

const BOOKING_SORT_ALLOWLIST: Record<string, string> = {
  code: 'code',
  createdAt: 'createdAt',
  amount: 'amount',
  status: 'status',
  serviceDate: 'serviceDate',
};

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly query: BookingQueryService,
  ) {}

  /**
   * Resolve search term to matching booking IDs.
   * Searches: booking code, passenger name, order number.
   * Cross-schema references use separate queries (ADR-0001).
   */
  private async resolveBookingSearchIds(search: string): Promise<string[]> {
    const s = search.trim();
    if (!s) return [];
    const bookingIds = new Set<string>();
    // 1) Match booking code or referenceNumber
    const byCode = await (this.prisma as any).booking.findMany({ where: { OR: [{ code: { contains: s, mode: "insensitive" } }, { referenceNumber: { contains: s, mode: "insensitive" } }] }, select: { id: true } });
    for (const r of byCode) bookingIds.add(r.id);
    // 2) Match traveler/passenger names → find orderIds → find bookings
    const travelers = await (this.prisma as any).orderTraveler.findMany({ where: { OR: [{ firstName: { contains: s, mode: "insensitive" } }, { lastName: { contains: s, mode: "insensitive" } }] }, select: { orderId: true } });
    const orderIds = new Set<string>();
    for (const t of travelers) { if (t.orderId) orderIds.add(t.orderId); }
    // 3) Match order number
    const orders = await (this.prisma as any).order.findMany({ where: { number: { contains: s, mode: "insensitive" } }, select: { id: true } });
    for (const o of orders) orderIds.add(o.id);
    // 4) Find bookings by matching order IDs
    if (orderIds.size > 0) {
      const byOrder = await (this.prisma as any).booking.findMany({ where: { orderId: { in: [...orderIds] } }, select: { id: true } });
      for (const b of byOrder) bookingIds.add(b.id);
    }
    return [...bookingIds];
  }

  async listBookings(query: { status?: string; orderId?: string; search?: string; upcoming?: string; overdue?: string; slaMinutes?: string; sortBy?: string; sortDirection?: string; page?: number; pageSize?: number; dateFrom?: string; dateTo?: string; acquisitionSource?: string }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    // D4 REMEDIATION F2: client acquisitionSource filter ⊆ server-authorized
    // scope — явный PARTNER_STOREFRONT на platform Booking Center-контракте →
    // deny (empty result, согласовано с Orders list/export).
    if (isDeniedStorefrontScope(query.acquisitionSource)) {
      return { items: [], total: 0, page, pageSize, aggregates: { lifecycle: { total: 0 } } };
    }
    const now = new Date();
    // ── UI-C1.2D — KPI-card dimension vs global registry scope ──────────────
    // The BookingStatus dimension is split from the GLOBAL registry scope so the
    // KPI overview stays stable when a card is clicked (Requests-style contract):
    //   TABLE scope    = global scope + active status predicate (detectors + card)
    //   OVERVIEW scope = global scope only (status dimension excluded) — used for
    //                    the 13 KPI counts + overview total.
    //
    // Detector semantics: upcoming/overdue act as GLOBAL scopes. Their temporal
    // predicates (serviceDate / createdAt thresholds) live as top-level keys that
    // scope BOTH overview and table; their STATUS predicates (upcoming →
    // CONFIRMED/NEW; overdue → AWAITING_CONFIRMATION) compose with any explicit
    // KPI-card status into the status layer that ONLY the table applies. This way
    // a KPI-card click never corrupts or deletes the detector scope, and the
    // detector never injects its status into the overview (no collapse).
    const statusPredicates: Prisma.BookingWhereInput[] = [];
    // R5-C1: comma-separated multi-status (KPI-card / filter dimension)
    if (query.status) {
      statusPredicates.push(
        query.status.includes(',')
          ? { status: { in: query.status.split(',').map(s => s.trim()) as BookingStatus[] } }
          : { status: query.status as BookingStatus },
      );
    }
    // ROUND 5: upcoming=true → detector: status IN (CONFIRMED, NEW) AND serviceDate >= now
    if (query.upcoming === "true") {
      statusPredicates.push({ status: { in: ["CONFIRMED", "NEW"] as BookingStatus[] } });
    }
    // ROUND 5: overdue=true → detector: status = AWAITING_CONFIRMATION AND createdAt < (now - SLA)
    if (query.overdue === "true") {
      statusPredicates.push({ status: "AWAITING_CONFIRMATION" as BookingStatus });
    }
    // Global temporal predicates (overview + table): compose with the date range
    // below via AND semantics — Prisma field-level constraints always AND together,
    // so the overdue createdAt cutoff is never overwritten by the From/To window.
    const createdAtFilter: Record<string, Date> = {};
    if (query.overdue === "true") {
      createdAtFilter.lt = new Date(Date.now() - (parseInt(query.slaMinutes ?? "240", 10)) * 60 * 1000);
    }
    // R5-04: Date range filtering on createdAt (exclusive end — consistent with
    // Analytics half-open [from, to))
    if (query.dateFrom) createdAtFilter.gte = new Date(query.dateFrom);
    if (query.dateTo) createdAtFilter.lt = new Date(query.dateTo);

    // Platform operational scope: default to MARKETPLACE via Order.acquisitionSource
    const effectiveSource = query.acquisitionSource || "MARKETPLACE";
    const channelOrders = await this.prisma.order.findMany({
      where: { acquisitionSource: effectiveSource },
      select: { id: true },
    });
    const channelOrderIds = channelOrders.map(o => o.id);
    if (channelOrderIds.length === 0) {
      return { items: [], total: 0, page, pageSize, aggregates: { lifecycle: { total: 0 } } };
    }
    // Explicit orderId (if given) must be intersected with the channel scope —
    // never overwritten by it (otherwise the Order detail panel lists random bookings).
    const channelScope: Prisma.BookingWhereInput = query.orderId
      ? { AND: [{ orderId: query.orderId }, { orderId: { in: channelOrderIds } }] }
      : { orderId: { in: channelOrderIds } };
    // Global registry scope (NO status dimension) — shared by table and overview.
    const globalScope: Prisma.BookingWhereInput = {
      ...(query.search ? { id: { in: await this.resolveBookingSearchIds(query.search) } } : {}),
      ...(query.upcoming === "true" ? { serviceDate: { gte: now } } : {}),
      ...(Object.keys(createdAtFilter).length > 0 ? { createdAt: createdAtFilter } : {}),
      ...channelScope,
    };
    // TABLE scope: global scope + the composed BookingStatus dimension.
    const where: Prisma.BookingWhereInput =
      statusPredicates.length === 0
        ? { ...globalScope }
        : statusPredicates.length === 1
          ? { ...globalScope, ...statusPredicates[0] }
          : { ...globalScope, AND: statusPredicates };
    // OVERVIEW scope: exactly the table `where` minus the BookingStatus dimension.
    const overviewWhere = overviewBookingWhere(where);
    const [items, total, statusCounts, overviewTotal] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: buildSortClause(query.sortBy, query.sortDirection, BOOKING_SORT_ALLOWLIST, { createdAt: 'desc' }),
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { passengers: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.booking.count({ where }),
      this.prisma.booking.groupBy({
        by: ['status'],
        where: overviewWhere as any,
        _count: { status: true },
      }),
      this.prisma.booking.count({ where: overviewWhere }),
    ]);
    // KPI aggregates: counts by every canonical booking status over the OVERVIEW
    // scope. Total = overview total (stable across KPI-card selection); the table
    // pagination `total` above stays table-scoped.
    const lifecycleAgg: Record<string, number> = { total: overviewTotal };
    for (const c of statusCounts) {
      lifecycleAgg[c.status] = c._count.status;
    }
    // Enrich bookings with order referenceNumber for canonical display
    const orderIds = [...new Set(items.map(b => b.orderId).filter(Boolean))] as string[];
    const orders = orderIds.length > 0
      ? await this.prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, referenceNumber: true } })
      : [];
    const orderRefMap = new Map(orders.map(o => [o.id, o.referenceNumber]));
    const enrichedItems = items.map(b => ({ ...b, orderReference: orderRefMap.get(b.orderId) ?? null }));
    return { items: enrichedItems, total, page, pageSize, aggregates: { lifecycle: lifecycleAgg } };
  }

  /**
   * Export all matching bookings (no pagination) for diagnostic reconciliation.
   */
  async exportBookings(query: { status?: string; orderId?: string; search?: string; dateFrom?: string; dateTo?: string; acquisitionSource?: string; sellerPartnerId?: string }) {
    // D4 REMEDIATION F2 (list/export согласованы): явный Storefront-фильтр на
    // platform export → deny (empty rows).
    if (isDeniedStorefrontScope(query.acquisitionSource)) {
      return { rows: [], total: 0 };
    }
    const effectiveSource = query.acquisitionSource || 'MARKETPLACE';

    // Build partner-scoped order IDs if sellerPartnerId provided
    let channelOrderIds: string[] | undefined;
    if (query.sellerPartnerId) {
      const partnerOrders = await this.prisma.order.findMany({
        where: { acquisitionSource: effectiveSource, sellerPartnerId: query.sellerPartnerId },
        select: { id: true },
      });
      channelOrderIds = partnerOrders.map(o => o.id);
      if (channelOrderIds.length === 0) return { rows: [], total: 0 };
    } else {
      const channelOrders = await this.prisma.order.findMany({
        where: { acquisitionSource: effectiveSource },
        select: { id: true },
      });
      channelOrderIds = channelOrders.map(o => o.id);
      if (channelOrderIds.length === 0) return { rows: [], total: 0 };
    }

    const where: any = { orderId: { in: channelOrderIds } };
    if (query.status) {
      where.status = query.status.includes(',')
        ? { in: query.status.split(',').map(s => s.trim()) }
        : query.status;
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lt: new Date(query.dateTo) } : {}),
      };
    }
    // D4 REMEDIATION F2 (drill-down consumer): explicit orderId НЕ заменяет
    // channel scope (иначе platform export отдал бы Booking Storefront-заказа
    // по его UUID). Пересечение — как в listBookings: never overwritten.
    if (query.orderId) {
      where.AND = [{ orderId: query.orderId }, { orderId: { in: channelOrderIds } }];
    }

    const items = await this.prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, code: true, referenceNumber: true, status: true,
        amount: true, currency: true, orderId: true,
        createdAt: true, updatedAt: true, serviceDate: true,
        acquisitionSource: true,
      },
    });

    const total = items.length;
    const orderIds = [...new Set(items.map(b => b.orderId).filter(Boolean))] as string[];

    // Phase 1: resolve orders first (needed for partner/customer lookup)
    const orders = orderIds.length > 0
      ? await this.prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, code: true, referenceNumber: true, sellerPartnerId: true, customerId: true } })
      : [];

    const partnerIds = [...new Set(orders.map(o => o.sellerPartnerId).filter(Boolean))] as string[];
    const customerIds = [...new Set(orders.map(o => o.customerId).filter(Boolean))] as string[];

    // Phase 2: resolve partners, customers, payments in parallel
    const [partners, customers, payments] = await Promise.all([
      partnerIds.length > 0
        ? this.prisma.partner.findMany({ where: { id: { in: partnerIds } }, select: { id: true, code: true, name: true } })
        : [],
      customerIds.length > 0
        ? this.prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, code: true, firstName: true, lastName: true, companyName: true } })
        : [],
      this.prisma.payment.findMany({
        where: { orderId: { in: orderIds } },
        select: { id: true, referenceNumber: true, orderId: true, status: true, amount: true, currency: true, paidAt: true },
      }),
    ]);

    const orderMap = new Map(orders.map(o => [o.id, o]));
    const partnerMap = new Map(partners.map(p => [p.id, p]));
    const customerMap = new Map(customers.map(c => [c.id, c]));
    const paymentByOrder = new Map<string, typeof payments>();
    for (const p of payments) {
      if (!p.orderId) continue;
      const arr = paymentByOrder.get(p.orderId) ?? [];
      arr.push(p);
      paymentByOrder.set(p.orderId, arr);
    }

    const rows = items.map(b => {
      const order = b.orderId ? orderMap.get(b.orderId) : null;
      const partner = order?.sellerPartnerId ? partnerMap.get(order.sellerPartnerId) : null;
      const customer = order?.customerId ? customerMap.get(order.customerId) : null;
      const op = b.orderId ? (paymentByOrder.get(b.orderId) ?? []) : [];
      return {
        id: b.id,
        referenceNumber: b.referenceNumber ?? b.code,
        code: b.code,
        status: b.status,
        amount: String(b.amount ?? ''),
        currency: b.currency ?? '',
        createdAt: b.createdAt?.toISOString() ?? '',
        updatedAt: b.updatedAt?.toISOString() ?? '',
        serviceDate: b.serviceDate?.toISOString() ?? '',
        acquisitionSource: b.acquisitionSource ?? '',
        orderId: b.orderId ?? '',
        orderCode: order?.referenceNumber ?? '',
        orderReference: order?.referenceNumber ?? '',
        partnerId: order?.sellerPartnerId ?? '',
        partnerCode: partner?.code ?? '',
        partnerName: partner?.name ?? '',
        customerId: order?.customerId ?? '',
        customerCode: customer?.code ?? '',
        customerName: customer ? (customer.companyName ?? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()) : '',
        paymentIds: op.map(p => p.id).join('; '),
        paymentReferences: op.map(p => p.referenceNumber ?? '').filter(Boolean).join('; '),
        paymentStatuses: op.map(p => p.status).join('; '),
        paymentAmounts: op.map(p => `${p.amount} ${p.currency}`).join('; '),
        paidAt: op.map(p => p.paidAt?.toISOString() ?? '').filter(Boolean).join('; '),
      };
    });

    return { rows, total };
  }

  async getBooking(id: string, viewer?: import("../../shared/pii").TravelerViewer, grantedPermissions: string[] = []) {
    const booking = await this.query.getById(id, viewer);
    // D6: server-authoritative available actions (state machine + RBAC + Order terminal guard)
    const availableActions = computeAvailableBookingActions(booking, grantedPermissions);
    return { ...booking, availableActions };
  }

  /** D6: immutable booking change history (append-only, ordered by createdAt desc) */
  async getBookingHistory(bookingId: string) {
    const items = await (this.prisma as any).bookingHistory.findMany({
      where: { bookingId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { items, total: items.length, page: 1, pageSize: 100 };
  }

  /** Команда жизненного цикла бронирования. */
  async bookingAction(bookingId: string, action: BookingAction, actor?: string, reason?: string | null) {
    const transition = TRANSITIONS[action];
    if (!transition) throw new ValidationDomainError(`Unknown action: ${action}`);

    const result = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking) throw new NotFoundError(`Booking ${bookingId} not found`);
      // D4 §10/§21: Storefront-tenant Booking (frozen PARTNER_STOREFRONT source)
      // не изменяется через platform marketplace lifecycle-команду → 404
      // (UUID-directed action, enumeration protection). Storefront = tenant
      // партнёра (Partner Workspace), вне Platform Marketplace контракта.
      if (booking.acquisitionSource === "PARTNER_STOREFRONT") {
        throw new NotFoundError(`Booking ${bookingId} not found`);
      }
      if (!transition.from.includes(booking.status)) {
        throw new ConflictError(`Cannot ${action} booking ${booking.code} from status ${booking.status}`);
      }

      // STRICT REVIEW FIX (2.9 §14/§28): lifecycle-команда не может «ожить»
      // бронь отменённого/закрытого заказа (инвариант §15). Читаем статус Order
      // (READ-only, ADR-0001) — если заказ терминален, команды (кроме cancel)
      // отклоняются 409. Это закрывает compensation-vs-command race детерминированно
      // для последовательного сценария (staff подтверждает бронь уже отменённого
      // заказа → 409, а не «confirm после cancel»).
      if (action !== "cancel") {
        const order = await tx.order.findUnique({
          where: { id: booking.orderId },
          select: { code: true, status: true },
        });
        if (order && ORDER_TERMINAL_GUARD.includes(order.status)) {
          throw new ConflictError(
            `Cannot ${action} booking ${booking.code}: order ${order.code} is ${order.status}`,
          );
        }
      }

      // Step 2.9 §23: optimistic concurrency (как Order, Step 1.14 §19) — переход
      // применяется только если status/version не изменились с момента чтения.
      // Concurrent/retry одного перехода → ровно ОДИН победитель; остальные —
      // контролируемый ConflictError (409), без duplicate history/event.
      //
      // Step 2.9A: canonical lifecycle milestone — первый переход только
      // (first-only через `?? now`), атомарно с CAS. Только реальные переходы:
      //  - send/resume → requestedAt (запрос отправлен поставщику);
      //  - confirm → confirmedAt; reject → rejectedAt; cancel → cancelledAt;
      //    complete → completedAt.
      // Один `now` на логический переход (единый серверный источник времени §15).
      const milestoneNow = new Date();
      const milestone: Prisma.BookingUpdateManyMutationInput = {};
      if (action === "send" || action === "resume") milestone.requestedAt = booking.requestedAt ?? milestoneNow;
      else if (action === "confirm") milestone.confirmedAt = booking.confirmedAt ?? milestoneNow;
      else if (action === "reject") milestone.rejectedAt = booking.rejectedAt ?? milestoneNow;
      else if (action === "cancel") milestone.cancelledAt = booking.cancelledAt ?? milestoneNow;
      else if (action === "complete") milestone.completedAt = booking.completedAt ?? milestoneNow;

      const updatedRows = await tx.booking.updateMany({
        where: { id: bookingId, status: booking.status, version: booking.version },
        data: { status: transition.to, version: { increment: 1 }, ...milestone },
      });
      if (updatedRows.count !== 1) {
        throw new ConflictError(`Booking ${booking.code} was concurrently modified; retry transition ${action}`);
      }
      const updated = { ...booking, status: transition.to as BookingStatus, version: booking.version + 1 };

      await tx.bookingHistory.create({
        data: {
          bookingId,
          action,
          from: booking.status,
          to: transition.to,
          actorId: actor ?? null,
          actorName: actor ?? null,
          comment: reason ? `${ACTION_LABELS[action]}: ${reason}` : ACTION_LABELS[action],
        },
      });

      // Step 1.15: correlation/causation НЕ указываются явно — они наследуются
      // из request context (correlation = requestId HTTP-команды, causation = null).
      // НЕ используем business-код (Order.code/Booking.code) как correlationId.
      switch (action) {
        case "confirm": {
          await this.eventBus.emit(tx, {
            aggregateType: "Booking",
            aggregateId: bookingId,
            eventType: DomainEvents.BookingConfirmed,
            payload: {
              bookingId,
              code: booking.code,
              orderId: booking.orderId,
              productId: booking.productId,
            } as BookingEventPayload,
          });
          break;
        }
        case "reject": {
          await this.eventBus.emit(tx, {
            aggregateType: "Booking",
            aggregateId: bookingId,
            eventType: DomainEvents.BookingRejected,
            payload: {
              bookingId,
              code: booking.code,
              orderId: booking.orderId,
              productId: booking.productId,
              reason: "Поставщик отклонил запрос",
            } as BookingEventPayload,
          });
          break;
        }
        case "cancel": {
          await this.eventBus.emit(tx, {
            aggregateType: "Booking",
            aggregateId: bookingId,
            eventType: DomainEvents.BookingCancelled,
            payload: {
              bookingId,
              code: booking.code,
              orderId: booking.orderId,
              productId: booking.productId,
            } as BookingEventPayload,
          });
          break;
        }
        case "complete": {
          // Step 2.9 §17: canonical fulfillment факт — ровно одно BookingCompleted
          // на реальный complete (retry/concurrent → CAS не даёт повторного перехода).
          // BookingStatusChanged (технический) остаётся — существующий approved
          // consumer-контракт Order reconcile (2.5A) полагается на него; вместе
          // они пишутся атомарно в одной транзакции (state + history + outbox).
          await this.eventBus.emit(tx, {
            aggregateType: "Booking",
            aggregateId: bookingId,
            eventType: DomainEvents.BookingCompleted,
            payload: {
              bookingId,
              code: booking.code,
              orderId: booking.orderId,
              productId: booking.productId,
            } as BookingEventPayload,
          });
          await this.eventBus.emit(tx, {
            aggregateType: "Booking",
            aggregateId: bookingId,
            eventType: DomainEvents.BookingStatusChanged,
            payload: {
              from: booking.status,
              to: transition.to,
              actor,
              bookingId,
              orderId: booking.orderId,
              code: booking.code,
            } as Prisma.InputJsonValue,
          });
          break;
        }
        default: {
          await this.eventBus.emit(tx, {
            aggregateType: "Booking",
            aggregateId: bookingId,
            eventType: DomainEvents.BookingStatusChanged,
            payload: {
              from: booking.status,
              to: transition.to,
              actor,
              bookingId,
              orderId: booking.orderId,
              code: booking.code,
            } as Prisma.InputJsonValue,
          });
        }
      }

      return updated;
    });

    await this.eventBus.publishPending();
    return result;
  }
}
