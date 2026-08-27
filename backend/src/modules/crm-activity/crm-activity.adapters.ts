import { CrmActivitySourceType, CrmActivityActivityType, CrmActivitySubjectType } from '../../generated/prisma/enums';
import { ActivityProjection, SourceAdapter } from './crm-activity.types';
import { ACTIVITY_TYPE_TITLES, ACTIVITY_DEFAULT_VISIBILITY, SUMMARY_MAX_LENGTH } from './crm-activity.constants';

// ─── Helper ─────────────────────────────────────────────────────────────────

function truncate(text: string | null | undefined, maxLen: number): string | null {
  if (!text) return null;
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

function buildDeepLink(sourceType: CrmActivitySourceType, sourceId: string): string | null {
  switch (sourceType) {
    case CrmActivitySourceType.ORDER:
      return `/app/orders/${sourceId}`;
    case CrmActivitySourceType.BOOKING:
      return `/app/bookings/${sourceId}`;
    case CrmActivitySourceType.PAYMENT:
      return null; // linked via customer context
    case CrmActivitySourceType.REFUND:
      return null; // linked via customer context
    default:
      return null;
  }
}

// ─── 1. OperationalNote Adapter ─────────────────────────────────────────────

export class OperationalNoteAdapter implements SourceAdapter {
  readonly sourceType = CrmActivitySourceType.OPERATIONAL_NOTE;

  project(source: any): ActivityProjection | null {
    if (!source) return null;
    // Skip soft-deleted notes
    if (source.deletedAt) return null;

    const entityType = source.entityType;
    const entityId = source.entityId;

    let subjectType: CrmActivitySubjectType;
    let subjectId: string;
    let customerId: string | null = null;
    let partnerId: string | null = null;

    if (entityType === 'CUSTOMER') {
      subjectType = CrmActivitySubjectType.CUSTOMER;
      subjectId = entityId;
      customerId = entityId;
    } else if (entityType === 'PARTNER') {
      subjectType = CrmActivitySubjectType.PARTNER;
      subjectId = entityId;
      partnerId = entityId;
    } else {
      // For other entity types, the note is attached to an entity
      // We can't derive subject binding without looking up the parent.
      // Backfill handles this; live projection should receive resolved subject.
      return null;
    }

    return {
      sourceType: CrmActivitySourceType.OPERATIONAL_NOTE,
      sourceId: source.id,
      sourceEvent: 'created',
      activityType: CrmActivityActivityType.NOTE_CREATED,
      subjectType,
      subjectId,
      customerId,
      partnerId,
      occurredAt: source.createdAt,
      actorUserId: source.authorUserId ?? null,
      actorName: source.authorName ?? null,
      title: ACTIVITY_TYPE_TITLES[CrmActivityActivityType.NOTE_CREATED],
      summary: truncate(source.text, SUMMARY_MAX_LENGTH),
      metadata: {
        visibility: source.visibility,
      },
      deepLink: null, // note: linked via parent entity detail
      visibility: ACTIVITY_DEFAULT_VISIBILITY,
    };
  }

  async backfill(prisma: any): Promise<ActivityProjection[]> {
    const notes = await prisma.operationalNote.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return notes.map((n: any) => this.project(n)).filter(Boolean) as ActivityProjection[];
  }
}

// ─── 2. Order Adapter ───────────────────────────────────────────────────────

export class OrderAdapter implements SourceAdapter {
  readonly sourceType = CrmActivitySourceType.ORDER;

  project(source: any): ActivityProjection | null {
    if (!source) return null;

    const customerId = source.customerId ?? null;
    // Partner binding: Order.sellerPartnerId (denormalized at creation)
    const partnerId = source.sellerPartnerId ?? null;

    return {
      sourceType: CrmActivitySourceType.ORDER,
      sourceId: source.id,
      sourceEvent: 'created',
      activityType: CrmActivityActivityType.ORDER_CREATED,
      subjectType: CrmActivitySubjectType.CUSTOMER,
      subjectId: customerId ?? source.id, // fallback for backfill
      customerId,
      partnerId,
      occurredAt: source.createdAt,
      actorUserId: null, // system-created
      actorName: null,
      title: ACTIVITY_TYPE_TITLES[CrmActivityActivityType.ORDER_CREATED],
      summary: source.code ?? null,
      metadata: {
        code: source.code,
        status: source.status,
        amount: source.totalAmount?.toString() ?? null,
        currency: source.currency ?? null,
      },
      deepLink: buildDeepLink(CrmActivitySourceType.ORDER, source.id),
      visibility: ACTIVITY_DEFAULT_VISIBILITY,
    };
  }

  async backfill(prisma: any): Promise<ActivityProjection[]> {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return orders.map((o: any) => this.project(o)).filter(Boolean) as ActivityProjection[];
  }
}

// ─── 3. Booking Adapter ─────────────────────────────────────────────────────

export class BookingAdapter implements SourceAdapter {
  readonly sourceType = CrmActivitySourceType.BOOKING;

  project(source: any): ActivityProjection | null {
    if (!source) return null;

    // Booking → Order → Customer; Booking → Order.sellerPartnerId → Partner
    const customerId = source.order?.customerId ?? null;
    const partnerId = source.order?.sellerPartnerId ?? null;

    return {
      sourceType: CrmActivitySourceType.BOOKING,
      sourceId: source.id,
      sourceEvent: 'created',
      activityType: CrmActivityActivityType.BOOKING_CREATED,
      subjectType: CrmActivitySubjectType.CUSTOMER,
      subjectId: customerId ?? source.id,
      customerId,
      partnerId,
      occurredAt: source.createdAt,
      actorUserId: null,
      actorName: null,
      title: ACTIVITY_TYPE_TITLES[CrmActivityActivityType.BOOKING_CREATED],
      summary: source.code ?? null,
      metadata: {
        code: source.code,
        status: source.status,
      },
      deepLink: buildDeepLink(CrmActivitySourceType.BOOKING, source.id),
      visibility: ACTIVITY_DEFAULT_VISIBILITY,
    };
  }

  async backfill(prisma: any): Promise<ActivityProjection[]> {
    // Cross-schema: Booking.orderId → Order.customerId + Order.sellerPartnerId
    const bookings = await prisma.booking.findMany({ orderBy: { createdAt: 'asc' } });
    if (bookings.length === 0) return [];
    const orderIds = [...new Set(bookings.map((b: any) => b.orderId))];
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, customerId: true, sellerPartnerId: true },
    });
    const orderMap = new Map(orders.map((o: any) => [o.id, o]));
    const enriched = bookings.map((b: any) => ({ ...b, order: orderMap.get(b.orderId) ?? null }));
    return enriched.map((b: any) => this.project(b)).filter(Boolean) as ActivityProjection[];
  }
}

// ─── 4. Payment Adapter ─────────────────────────────────────────────────────

export class PaymentAdapter implements SourceAdapter {
  readonly sourceType = CrmActivitySourceType.PAYMENT;

  project(source: any, event?: string): ActivityProjection | null {
    if (!source) return null;

    // Canonical ownership: direct customerId first, then order-derived via Order.customerId
    const customerId = source.customerId ?? source.order?.customerId ?? null;
    const partnerId = source.order?.sellerPartnerId ?? source.partnerId ?? null;

    const isCaptured = event === 'captured' || (source.status === 'CAPTURED' && source.paidAt);
    const activityType = isCaptured
      ? CrmActivityActivityType.PAYMENT_CAPTURED
      : CrmActivityActivityType.PAYMENT_CREATED;
    const occurredAt = isCaptured && source.paidAt ? source.paidAt : source.createdAt;

    return {
      sourceType: CrmActivitySourceType.PAYMENT,
      sourceId: source.id,
      sourceEvent: isCaptured ? 'captured' : 'created',
      activityType,
      subjectType: CrmActivitySubjectType.CUSTOMER,
      subjectId: customerId ?? source.id,
      customerId,
      partnerId,
      occurredAt,
      actorUserId: null,
      actorName: null,
      title: ACTIVITY_TYPE_TITLES[activityType],
      summary: source.code ?? null,
      metadata: {
        code: source.code,
        status: source.status,
        amount: source.amount?.toString() ?? null,
        currency: source.currency ?? null,
      },
      deepLink: null,
      visibility: ACTIVITY_DEFAULT_VISIBILITY,
    };
  }

  async backfill(prisma: any): Promise<ActivityProjection[]> {
    // Cross-schema: Payment has customerId/partnerId directly; orderId for order ref
    // Round 2C.2R: also fetch Order.customerId for canonical ownership resolution
    const payments = await prisma.payment.findMany({ orderBy: { createdAt: 'asc' } });
    if (payments.length === 0) return [];
    const orderIds = [...new Set(payments.map((p: any) => p.orderId).filter(Boolean))];
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, customerId: true, sellerPartnerId: true },
    });
    const orderMap = new Map(orders.map((o: any) => [o.id, o]));
    const enriched = payments.map((p: any) => ({ ...p, order: orderMap.get(p.orderId) ?? null }));
    const projections: ActivityProjection[] = [];
    for (const p of enriched) {
      // Always emit PAYMENT_CREATED
      const created = this.project(p, 'created');
      if (created) projections.push(created);
      // If already captured, also emit PAYMENT_CAPTURED
      if (p.status === 'CAPTURED' && p.paidAt) {
        const captured = this.project(p, 'captured');
        if (captured) projections.push(captured);
      }
    }
    return projections;
  }
}

// ─── 5. Refund Adapter ──────────────────────────────────────────────────────

export class RefundAdapter implements SourceAdapter {
  readonly sourceType = CrmActivitySourceType.REFUND;

  project(source: any, event?: string): ActivityProjection | null {
    if (!source) return null;

    const customerId = source.payment?.customerId ?? null;
    const partnerId = source.payment?.order?.sellerPartnerId ?? source.payment?.partnerId ?? null;

    const isProcessed = event === 'processed' || (source.status === 'PROCESSED' && source.processedAt);
    const activityType = isProcessed
      ? CrmActivityActivityType.REFUND_PROCESSED
      : CrmActivityActivityType.REFUND_CREATED;
    const occurredAt = isProcessed && source.processedAt ? source.processedAt : source.createdAt;

    return {
      sourceType: CrmActivitySourceType.REFUND,
      sourceId: source.id,
      sourceEvent: isProcessed ? 'processed' : 'created',
      activityType,
      subjectType: CrmActivitySubjectType.CUSTOMER,
      subjectId: customerId ?? source.id,
      customerId,
      partnerId,
      occurredAt,
      actorUserId: null,
      actorName: null,
      title: ACTIVITY_TYPE_TITLES[activityType],
      summary: source.code ?? null,
      metadata: {
        code: source.code,
        status: source.status,
        amount: source.amount?.toString() ?? null,
        currency: source.currency ?? null,
        reason: source.reason ?? null,
      },
      deepLink: null,
      visibility: ACTIVITY_DEFAULT_VISIBILITY,
    };
  }

  async backfill(prisma: any): Promise<ActivityProjection[]> {
    // Cross-schema: Refund → Payment (by paymentId) → Order (by orderId)
    const refunds = await prisma.refund.findMany({ orderBy: { createdAt: 'asc' } });
    if (refunds.length === 0) return [];
    const paymentIds = [...new Set(refunds.map((r: any) => r.paymentId))];
    const payments = await prisma.payment.findMany({
      where: { id: { in: paymentIds } },
      select: { id: true, customerId: true, partnerId: true, orderId: true },
    });
    const paymentMap = new Map<string, any>(payments.map((p: any) => [p.id, p]));
    const orderIds = [...new Set(payments.map((p: any) => p.orderId))];
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, sellerPartnerId: true },
    });
    const orderMap = new Map<string, any>(orders.map((o: any) => [o.id, o]));
    const enriched = refunds.map((r: any) => {
      const pay: any = paymentMap.get(r.paymentId) ?? null;
      const ord: any = pay ? orderMap.get(pay.orderId) ?? null : null;
      return { ...r, payment: pay ? { ...pay, order: ord } : null };
    });
    const projections: ActivityProjection[] = [];
    for (const r of refunds) {
      const created = this.project(r, 'created');
      if (created) projections.push(created);
      if (r.status === 'PROCESSED' && r.processedAt) {
        const processed = this.project(r, 'processed');
        if (processed) projections.push(processed);
      }
    }
    return projections;
  }
}

// ─── 6. Message Adapter ─────────────────────────────────────────────────────

export class MessageAdapter implements SourceAdapter {
  readonly sourceType = CrmActivitySourceType.MESSAGE;

  project(source: any): ActivityProjection | null {
    if (!source) return null;
    // Only include type=MESSAGE (not NOTE), exclude INTERNAL direction
    if (source.type === 'NOTE') return null;
    if (source.direction === 'INTERNAL') return null;

    let subjectType: CrmActivitySubjectType;
    let subjectId: string;
    let customerId: string | null = null;
    let partnerId: string | null = null;

    if (source.contextType === 'CUSTOMER') {
      subjectType = CrmActivitySubjectType.CUSTOMER;
      subjectId = source.contextId;
      customerId = source.contextId;
    } else if (source.contextType === 'PARTNER') {
      subjectType = CrmActivitySubjectType.PARTNER;
      subjectId = source.contextId;
      partnerId = source.contextId;
    } else if (source.contextType === 'ORDER') {
      // Order context: link to customer via order, partner via product
      subjectType = CrmActivitySubjectType.CUSTOMER;
      subjectId = source.contextId; // placeholder; resolved in backfill
      // In live projection, these should be resolved from the order
      customerId = source.contextId; // will be resolved from order
    } else {
      return null; // other context types not in v1 scope
    }

    return {
      sourceType: CrmActivitySourceType.MESSAGE,
      sourceId: source.id,
      sourceEvent: 'sent',
      activityType: CrmActivityActivityType.MESSAGE_SENT,
      subjectType,
      subjectId,
      customerId,
      partnerId,
      occurredAt: source.occurredAt ?? source.createdAt,
      actorUserId: source.senderType === 'USER' ? source.senderId : null,
      actorName: null,
      title: ACTIVITY_TYPE_TITLES[CrmActivityActivityType.MESSAGE_SENT],
      summary: truncate(source.body, SUMMARY_MAX_LENGTH),
      metadata: {
        channel: source.channel,
        direction: source.direction,
        contextType: source.contextType,
      },
      deepLink: null,
      visibility: ACTIVITY_DEFAULT_VISIBILITY,
    };
  }

  async backfill(prisma: any): Promise<ActivityProjection[]> {
    const messages = await prisma.communication.findMany({
      where: {
        type: 'MESSAGE',
        direction: { not: 'INTERNAL' },
      },
      orderBy: { occurredAt: 'asc' },
    });
    return messages.map((m: any) => this.project(m)).filter(Boolean) as ActivityProjection[];
  }
}

// ─── 7. Audit Adapter (business-safe subset only) ───────────────────────────

export class AuditAdapter implements SourceAdapter {
  readonly sourceType = CrmActivitySourceType.AUDIT_EVENT;

  /** Only business-safe audit events are projected */
  private readonly ALLOWED_ACTIONS = new Set([
    'customer.created',
    'customer.status_changed',
    'partner.approved',
  ]);

  project(source: any): ActivityProjection | null {
    if (!source) return null;

    const action = source.action;
    if (!this.ALLOWED_ACTIONS.has(action)) return null;

    let activityType: CrmActivityActivityType;
    if (action === 'customer.created') {
      activityType = CrmActivityActivityType.AUDIT_CUSTOMER_CREATED;
    } else if (action === 'customer.status_changed') {
      activityType = CrmActivityActivityType.AUDIT_CUSTOMER_STATUS_CHANGED;
    } else if (action === 'partner.approved') {
      activityType = CrmActivityActivityType.AUDIT_PARTNER_APPROVED;
    } else {
      return null;
    }

    // Audit events don't have direct customer/partner binding
    // Subject binding is indirect (via userId→User→Customer)
    return {
      sourceType: CrmActivitySourceType.AUDIT_EVENT,
      sourceId: source.id,
      sourceEvent: action,
      activityType,
      subjectType: CrmActivitySubjectType.CUSTOMER, // default; resolved during backfill
      subjectId: source.userId ?? source.id,
      customerId: null, // resolved during backfill
      partnerId: null, // resolved during backfill
      occurredAt: source.createdAt,
      actorUserId: source.userId ?? null,
      actorName: source.username ?? null,
      title: ACTIVITY_TYPE_TITLES[activityType],
      summary: null, // audit details are not displayed in timeline
      metadata: {
        action: source.action,
        resource: source.resource,
      },
      deepLink: null,
      visibility: ACTIVITY_DEFAULT_VISIBILITY,
    };
  }

  async backfill(prisma: any): Promise<ActivityProjection[]> {
    const audits = await prisma.auditLog.findMany({
      where: { action: { in: Array.from(this.ALLOWED_ACTIONS) } },
      orderBy: { createdAt: 'asc' },
    });
    return audits.map((a: any) => this.project(a)).filter(Boolean) as ActivityProjection[];
  }
}

// ─── 8. CustomerHistory Adapter ─────────────────────────────────────────────

export class CustomerHistoryAdapter implements SourceAdapter {
  readonly sourceType = CrmActivitySourceType.CUSTOMER_HISTORY;

  project(source: any): ActivityProjection | null {
    if (!source) return null;

    const action = source.action;
    let activityType: CrmActivityActivityType;
    if (action === 'created') {
      activityType = CrmActivityActivityType.CUSTOMER_HISTORY_CREATED;
    } else if (action?.startsWith('status')) {
      activityType = CrmActivityActivityType.CUSTOMER_HISTORY_STATUS_CHANGED;
    } else {
      activityType = CrmActivityActivityType.CUSTOMER_HISTORY_UPDATED;
    }

    return {
      sourceType: CrmActivitySourceType.CUSTOMER_HISTORY,
      sourceId: source.id,
      sourceEvent: action ?? 'updated',
      activityType,
      subjectType: CrmActivitySubjectType.CUSTOMER,
      subjectId: source.customerId,
      customerId: source.customerId,
      partnerId: null,
      occurredAt: source.createdAt,
      actorUserId: source.actorId ?? null,
      actorName: source.actorName ?? null,
      title: ACTIVITY_TYPE_TITLES[activityType],
      summary: source.comment ?? null,
      metadata: {
        action: source.action,
        from: source.from ?? null,
        to: source.to ?? null,
        fields: source.fields ?? null,
      },
      deepLink: null,
      visibility: ACTIVITY_DEFAULT_VISIBILITY,
    };
  }

  async backfill(prisma: any): Promise<ActivityProjection[]> {
    const histories = await prisma.customerHistory.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return histories.map((h: any) => this.project(h)).filter(Boolean) as ActivityProjection[];
  }
}

// ─── 9. BuyerRequest Adapter ────────────────────────────────────────────────

export class BuyerRequestAdapter implements SourceAdapter {
  readonly sourceType = CrmActivitySourceType.BUYER_REQUEST;

  project(source: any, event?: string): ActivityProjection | null {
    if (!source) return null;

    const activityType = event === 'submitted'
      ? CrmActivityActivityType.BUYER_REQUEST_SUBMITTED
      : event === 'cancelled'
        ? CrmActivityActivityType.BUYER_REQUEST_CANCELLED
        : CrmActivityActivityType.BUYER_REQUEST_CREATED;

    const occurredAt = event === 'submitted' && source.submittedAt
      ? source.submittedAt
      : source.createdAt;

    return {
      sourceType: CrmActivitySourceType.BUYER_REQUEST,
      sourceId: source.id,
      sourceEvent: event ?? 'created',
      activityType,
      subjectType: CrmActivitySubjectType.CUSTOMER,
      subjectId: source.buyerId ?? source.id,
      customerId: source.buyerId ?? null,
      partnerId: null,
      occurredAt,
      actorUserId: null,
      actorName: null,
      title: ACTIVITY_TYPE_TITLES[activityType],
      summary: source.title ?? null,
      metadata: {
        status: source.status,
      },
      deepLink: null,
      visibility: ACTIVITY_DEFAULT_VISIBILITY,
    };
  }

  async backfill(prisma: any): Promise<ActivityProjection[]> {
    const requests = await prisma.buyerRequest.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return requests.map((r: any) => this.project(r, 'created')).filter(Boolean) as ActivityProjection[];
  }
}

// ─── 10. PartnerApplication Adapter ─────────────────────────────────────────

export class PartnerApplicationAdapter implements SourceAdapter {
  readonly sourceType = CrmActivitySourceType.PARTNER_APPLICATION;

  project(source: any, event?: string): ActivityProjection | null {
    if (!source) return null;

    // Use history records for submitted/approved/rejected events
    if (event && source.history) {
      const matchingHistory = source.history.find((h: any) => {
        if (event === 'submitted') return h.action === 'submitted';
        if (event === 'approved') return h.action === 'approved';
        if (event === 'rejected') return h.action === 'rejected';
        return false;
      });
      if (!matchingHistory) return null;
    }

    let activityType: CrmActivityActivityType;
    if (event === 'approved') {
      activityType = CrmActivityActivityType.PARTNER_APPLICATION_APPROVED;
    } else if (event === 'rejected') {
      activityType = CrmActivityActivityType.PARTNER_APPLICATION_REJECTED;
    } else {
      activityType = CrmActivityActivityType.PARTNER_APPLICATION_SUBMITTED;
    }

    return {
      sourceType: CrmActivitySourceType.PARTNER_APPLICATION,
      sourceId: source.id,
      sourceEvent: event ?? 'submitted',
      activityType,
      subjectType: CrmActivitySubjectType.PARTNER,
      subjectId: source.partnerId ?? source.id,
      customerId: null,
      partnerId: source.partnerId ?? null,
      occurredAt: source.createdAt,
      actorUserId: null,
      actorName: null,
      title: ACTIVITY_TYPE_TITLES[activityType],
      summary: null,
      metadata: {
        status: source.status,
      },
      deepLink: null,
      visibility: ACTIVITY_DEFAULT_VISIBILITY,
    };
  }

  async backfill(prisma: any): Promise<ActivityProjection[]> {
    const applications = await prisma.partnerApplication.findMany({
      include: { history: true },
      orderBy: { createdAt: 'asc' },
    });
    const projections: ActivityProjection[] = [];
    for (const app of applications) {
      // Project submitted event
      const submitted = this.project(app, 'submitted');
      if (submitted) projections.push(submitted);
      // Project approved/rejected if status is terminal
      if (app.status === 'APPROVED') {
        const approved = this.project(app, 'approved');
        if (approved) projections.push(approved);
      } else if (app.status === 'REJECTED') {
        const rejected = this.project(app, 'rejected');
        if (rejected) projections.push(rejected);
      }
    }
    return projections;
  }
}

// ─── Adapter Registry ───────────────────────────────────────────────────────

export function getAllAdapters(): SourceAdapter[] {
  return [
    new OperationalNoteAdapter(),
    new OrderAdapter(),
    new BookingAdapter(),
    new PaymentAdapter(),
    new RefundAdapter(),
    new MessageAdapter(),
    new AuditAdapter(),
    new CustomerHistoryAdapter(),
    new BuyerRequestAdapter(),
    new PartnerApplicationAdapter(),
  ];
}

export function getAdapterFor(sourceType: CrmActivitySourceType): SourceAdapter | undefined {
  return getAllAdapters().find((a) => a.sourceType === sourceType);
}
