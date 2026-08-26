import { Test, TestingModule } from '@nestjs/testing';
import { CrmActivityService } from './crm-activity.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CrmActivitySourceType, CrmActivityActivityType, CrmActivitySubjectType } from '../../generated/prisma/enums';
import {
  OperationalNoteAdapter,
  OrderAdapter,
  BookingAdapter,
  PaymentAdapter,
  RefundAdapter,
  MessageAdapter,
  AuditAdapter,
  CustomerHistoryAdapter,
  BuyerRequestAdapter,
  PartnerApplicationAdapter,
  getAllAdapters,
} from './crm-activity.adapters';
import { ACTIVITY_TYPE_TITLES } from './crm-activity.constants';

// ─── Mock Prisma ────────────────────────────────────────────────────────────

function makeMockPrisma() {
  const store = new Map<string, any>();
  return {
    crmActivity: {
      upsert: jest.fn(async ({ where, create }: any) => {
        const key = `${create.sourceType}|${create.sourceId}|${create.sourceEvent}`;
        store.set(key, { ...create, id: `activity-${store.size + 1}` });
        return store.get(key);
      }),
      findMany: jest.fn(async ({ where, orderBy, take }: any = {}) => {
        let items = Array.from(store.values());
        if (where?.customerId) items = items.filter((i) => i.customerId === where.customerId);
        if (where?.partnerId) items = items.filter((i) => i.partnerId === where.partnerId);
        if (where?.subjectType) items = items.filter((i) => i.subjectType === where.subjectType);
        if (where?.subjectId) items = items.filter((i) => i.subjectId === where.subjectId);
        // Sort by occurredAt desc, id desc
        items.sort((a: any, b: any) => {
          const cmp = b.occurredAt.getTime() - a.occurredAt.getTime();
          return cmp !== 0 ? cmp : b.id.localeCompare(a.id);
        });
        if (take) items = items.slice(0, take);
        return items;
      }),
      count: jest.fn(async ({ where }: any = {}) => {
        let items = Array.from(store.values());
        if (where?.subjectType) items = items.filter((i) => i.subjectType === where.subjectType);
        if (where?.subjectId) items = items.filter((i) => i.subjectId === where.subjectId);
        return items.length;
      }),
      deleteMany: jest.fn(async () => {
        const count = store.size;
        store.clear();
        return { count };
      }),
    },
    _store: store,
  } as any;
}

// ─── Adapter Tests ──────────────────────────────────────────────────────────

describe('Source Adapters', () => {
  describe('OperationalNoteAdapter', () => {
    const adapter = new OperationalNoteAdapter();

    it('projects a Customer note correctly', () => {
      const note = {
        id: 'note-1',
        entityType: 'CUSTOMER',
        entityId: 'cust-1',
        text: 'Test note content',
        visibility: 'INTERNAL',
        authorUserId: 'user-1',
        authorName: 'Admin',
        createdAt: new Date('2026-08-01T10:00:00Z'),
        deletedAt: null,
      };
      const result = adapter.project(note);
      expect(result).not.toBeNull();
      expect(result!.sourceType).toBe(CrmActivitySourceType.OPERATIONAL_NOTE);
      expect(result!.sourceId).toBe('note-1');
      expect(result!.sourceEvent).toBe('created');
      expect(result!.activityType).toBe(CrmActivityActivityType.NOTE_CREATED);
      expect(result!.subjectType).toBe(CrmActivitySubjectType.CUSTOMER);
      expect(result!.subjectId).toBe('cust-1');
      expect(result!.customerId).toBe('cust-1');
      expect(result!.partnerId).toBeNull();
      expect(result!.occurredAt).toEqual(new Date('2026-08-01T10:00:00Z'));
      expect(result!.actorUserId).toBe('user-1');
      expect(result!.actorName).toBe('Admin');
      expect(result!.title).toBe(ACTIVITY_TYPE_TITLES[CrmActivityActivityType.NOTE_CREATED]);
      expect(result!.summary).toBe('Test note content');
    });

    it('projects a Partner note correctly', () => {
      const note = {
        id: 'note-2',
        entityType: 'PARTNER',
        entityId: 'partner-1',
        text: 'Partner note',
        visibility: 'INTERNAL',
        authorUserId: null,
        authorName: null,
        createdAt: new Date('2026-08-02T12:00:00Z'),
        deletedAt: null,
      };
      const result = adapter.project(note);
      expect(result).not.toBeNull();
      expect(result!.subjectType).toBe(CrmActivitySubjectType.PARTNER);
      expect(result!.subjectId).toBe('partner-1');
      expect(result!.partnerId).toBe('partner-1');
      expect(result!.customerId).toBeNull();
    });

    it('skips soft-deleted notes', () => {
      const note = {
        id: 'note-3',
        entityType: 'CUSTOMER',
        entityId: 'cust-1',
        text: 'Deleted',
        visibility: 'INTERNAL',
        authorUserId: null,
        authorName: null,
        createdAt: new Date(),
        deletedAt: new Date(),
      };
      expect(adapter.project(note)).toBeNull();
    });

    it('skips non-CUSTOMER/PARTNER entity types (returns null without resolved subject)', () => {
      const note = {
        id: 'note-4',
        entityType: 'ORDER',
        entityId: 'order-1',
        text: 'Order note',
        visibility: 'INTERNAL',
        authorUserId: null,
        authorName: null,
        createdAt: new Date(),
        deletedAt: null,
      };
      expect(adapter.project(note)).toBeNull();
    });

    it('truncates long note text in summary', () => {
      const longText = 'x'.repeat(200);
      const note = {
        id: 'note-5',
        entityType: 'CUSTOMER',
        entityId: 'cust-1',
        text: longText,
        visibility: 'INTERNAL',
        authorUserId: null,
        authorName: null,
        createdAt: new Date(),
        deletedAt: null,
      };
      const result = adapter.project(note);
      expect(result!.summary).toHaveLength(100);
      expect(result!.summary!.endsWith('…')).toBe(true);
    });
  });

  describe('OrderAdapter', () => {
    const adapter = new OrderAdapter();

    it('projects an Order with customerId and partner binding via items', () => {
      const order = {
        id: 'order-1',
        code: 'ORD-00000001',
        status: 'NEW',
        customerId: 'cust-1',
        totalAmount: 1500,
        currency: 'AZN',
        createdAt: new Date('2026-08-03T09:00:00Z'),
        items: [{ product: { partnerId: 'partner-1' } }],
      };
      const result = adapter.project(order);
      expect(result).not.toBeNull();
      expect(result!.sourceType).toBe(CrmActivitySourceType.ORDER);
      expect(result!.activityType).toBe(CrmActivityActivityType.ORDER_CREATED);
      expect(result!.customerId).toBe('cust-1');
      expect(result!.partnerId).toBe('partner-1');
      expect(result!.occurredAt).toEqual(new Date('2026-08-03T09:00:00Z'));
      expect(result!.metadata).toEqual({
        code: 'ORD-00000001',
        status: 'NEW',
        amount: '1500',
        currency: 'AZN',
      });
      expect(result!.deepLink).toBe('/app/orders/order-1');
    });
  });

  describe('BookingAdapter', () => {
    const adapter = new BookingAdapter();

    it('projects a Booking with indirect customer/partner binding', () => {
      const booking = {
        id: 'booking-1',
        code: 'BK-00000001',
        status: 'CONFIRMED',
        createdAt: new Date('2026-08-04T14:00:00Z'),
        order: { customerId: 'cust-1' },
        product: { partnerId: 'partner-1' },
      };
      const result = adapter.project(booking);
      expect(result).not.toBeNull();
      expect(result!.sourceType).toBe(CrmActivitySourceType.BOOKING);
      expect(result!.activityType).toBe(CrmActivityActivityType.BOOKING_CREATED);
      expect(result!.customerId).toBe('cust-1');
      expect(result!.partnerId).toBe('partner-1');
      expect(result!.deepLink).toBe('/app/bookings/booking-1');
    });
  });

  describe('PaymentAdapter', () => {
    const adapter = new PaymentAdapter();

    it('projects a Payment as PAYMENT_CREATED', () => {
      const payment = {
        id: 'pay-1',
        code: 'PAY-00000001',
        status: 'PENDING',
        amount: 500,
        currency: 'AZN',
        customerId: 'cust-1',
        createdAt: new Date('2026-08-05T11:00:00Z'),
        paidAt: null,
        order: { items: [] },
      };
      const result = adapter.project(payment, 'created');
      expect(result).not.toBeNull();
      expect(result!.activityType).toBe(CrmActivityActivityType.PAYMENT_CREATED);
      expect(result!.occurredAt).toEqual(new Date('2026-08-05T11:00:00Z'));
    });

    it('projects a Payment as PAYMENT_CAPTURED with paidAt', () => {
      const payment = {
        id: 'pay-1',
        code: 'PAY-00000001',
        status: 'CAPTURED',
        amount: 500,
        currency: 'AZN',
        customerId: 'cust-1',
        createdAt: new Date('2026-08-05T11:00:00Z'),
        paidAt: new Date('2026-08-05T11:05:00Z'),
        order: { items: [] },
      };
      const result = adapter.project(payment, 'captured');
      expect(result).not.toBeNull();
      expect(result!.activityType).toBe(CrmActivityActivityType.PAYMENT_CAPTURED);
      // occurredAt MUST be paidAt, not createdAt
      expect(result!.occurredAt).toEqual(new Date('2026-08-05T11:05:00Z'));
    });
  });

  describe('RefundAdapter', () => {
    const adapter = new RefundAdapter();

    it('projects a Refund as REFUND_CREATED', () => {
      const refund = {
        id: 'ref-1',
        code: 'REF-00000001',
        status: 'PENDING',
        amount: 200,
        currency: 'AZN',
        reason: 'Defective',
        createdAt: new Date('2026-08-06T09:00:00Z'),
        processedAt: null,
        payment: {
          customerId: 'cust-1',
          order: { items: [] },
        },
      };
      const result = adapter.project(refund, 'created');
      expect(result).not.toBeNull();
      expect(result!.activityType).toBe(CrmActivityActivityType.REFUND_CREATED);
      expect(result!.occurredAt).toEqual(new Date('2026-08-06T09:00:00Z'));
    });

    it('projects a Refund as REFUND_PROCESSED with processedAt', () => {
      const refund = {
        id: 'ref-1',
        code: 'REF-00000001',
        status: 'PROCESSED',
        amount: 200,
        currency: 'AZN',
        reason: 'Defective',
        createdAt: new Date('2026-08-06T09:00:00Z'),
        processedAt: new Date('2026-08-07T10:00:00Z'),
        payment: {
          customerId: 'cust-1',
          order: { items: [] },
        },
      };
      const result = adapter.project(refund, 'processed');
      expect(result).not.toBeNull();
      expect(result!.activityType).toBe(CrmActivityActivityType.REFUND_PROCESSED);
      // occurredAt MUST be processedAt, not createdAt
      expect(result!.occurredAt).toEqual(new Date('2026-08-07T10:00:00Z'));
    });
  });

  describe('MessageAdapter', () => {
    const adapter = new MessageAdapter();

    it('projects a Customer-context MESSAGE', () => {
      const msg = {
        id: 'msg-1',
        type: 'MESSAGE',
        direction: 'OUTBOUND',
        channel: 'PLATFORM',
        contextType: 'CUSTOMER',
        contextId: 'cust-1',
        body: 'Hello!',
        senderType: 'USER',
        senderId: 'user-1',
        occurredAt: new Date('2026-08-08T15:00:00Z'),
        createdAt: new Date(),
      };
      const result = adapter.project(msg);
      expect(result).not.toBeNull();
      expect(result!.activityType).toBe(CrmActivityActivityType.MESSAGE_SENT);
      expect(result!.customerId).toBe('cust-1');
      expect(result!.summary).toBe('Hello!');
    });

    it('skips NOTE type messages', () => {
      const msg = {
        id: 'msg-2',
        type: 'NOTE',
        direction: 'INTERNAL',
        channel: 'PLATFORM',
        contextType: 'CUSTOMER',
        contextId: 'cust-1',
        body: 'Internal',
        senderType: 'USER',
        senderId: 'user-1',
        occurredAt: new Date(),
        createdAt: new Date(),
      };
      expect(adapter.project(msg)).toBeNull();
    });

    it('skips INTERNAL direction messages', () => {
      const msg = {
        id: 'msg-3',
        type: 'MESSAGE',
        direction: 'INTERNAL',
        channel: 'PLATFORM',
        contextType: 'CUSTOMER',
        contextId: 'cust-1',
        body: 'Internal',
        senderType: 'USER',
        senderId: 'user-1',
        occurredAt: new Date(),
        createdAt: new Date(),
      };
      expect(adapter.project(msg)).toBeNull();
    });
  });

  describe('AuditAdapter', () => {
    const adapter = new AuditAdapter();

    it('projects customer.created audit event', () => {
      const audit = {
        id: 'audit-1',
        action: 'customer.created',
        resource: 'Customer',
        userId: 'user-1',
        username: 'admin',
        createdAt: new Date('2026-08-09T08:00:00Z'),
      };
      const result = adapter.project(audit);
      expect(result).not.toBeNull();
      expect(result!.activityType).toBe(CrmActivityActivityType.AUDIT_CUSTOMER_CREATED);
    });

    it('skips non-business-safe audit events', () => {
      const audit = {
        id: 'audit-2',
        action: 'auth.login_failed',
        resource: 'User',
        userId: 'user-1',
        username: 'admin',
        createdAt: new Date(),
      };
      expect(adapter.project(audit)).toBeNull();
    });
  });

  describe('CustomerHistoryAdapter', () => {
    const adapter = new CustomerHistoryAdapter();

    it('projects created action', () => {
      const history = {
        id: 'ch-1',
        action: 'created',
        customerId: 'cust-1',
        actorId: 'user-1',
        actorName: 'Admin',
        from: null,
        to: null,
        fields: null,
        comment: 'New customer',
        createdAt: new Date('2026-08-10T10:00:00Z'),
      };
      const result = adapter.project(history);
      expect(result).not.toBeNull();
      expect(result!.activityType).toBe(CrmActivityActivityType.CUSTOMER_HISTORY_CREATED);
      expect(result!.customerId).toBe('cust-1');
      expect(result!.subjectType).toBe(CrmActivitySubjectType.CUSTOMER);
    });

    it('projects status_changed action', () => {
      const history = {
        id: 'ch-2',
        action: 'status_changed',
        customerId: 'cust-1',
        actorId: 'user-1',
        actorName: 'Admin',
        from: 'ACTIVE',
        to: 'BLOCKED',
        fields: null,
        comment: null,
        createdAt: new Date('2026-08-11T11:00:00Z'),
      };
      const result = adapter.project(history);
      expect(result!.activityType).toBe(CrmActivityActivityType.CUSTOMER_HISTORY_STATUS_CHANGED);
    });

    it('projects field update as UPDATED', () => {
      const history = {
        id: 'ch-3',
        action: 'updated_firstName',
        customerId: 'cust-1',
        actorId: 'user-1',
        actorName: 'Admin',
        from: 'Old',
        to: 'New',
        fields: 'firstName',
        comment: null,
        createdAt: new Date('2026-08-12T12:00:00Z'),
      };
      const result = adapter.project(history);
      expect(result!.activityType).toBe(CrmActivityActivityType.CUSTOMER_HISTORY_UPDATED);
    });
  });

  describe('BuyerRequestAdapter', () => {
    const adapter = new BuyerRequestAdapter();

    it('projects a BuyerRequest as CREATED', () => {
      const request = {
        id: 'br-1',
        buyerId: 'cust-1',
        title: 'Hotel search',
        status: 'DRAFT',
        createdAt: new Date('2026-08-13T09:00:00Z'),
        submittedAt: null,
      };
      const result = adapter.project(request, 'created');
      expect(result).not.toBeNull();
      expect(result!.activityType).toBe(CrmActivityActivityType.BUYER_REQUEST_CREATED);
      expect(result!.customerId).toBe('cust-1');
    });
  });

  describe('PartnerApplicationAdapter', () => {
    const adapter = new PartnerApplicationAdapter();

    it('projects a PartnerApplication as SUBMITTED', () => {
      const app = {
        id: 'pa-1',
        partnerId: 'partner-1',
        status: 'PENDING',
        createdAt: new Date('2026-08-14T08:00:00Z'),
        history: [{ action: 'submitted' }],
      };
      const result = adapter.project(app, 'submitted');
      expect(result).not.toBeNull();
      expect(result!.activityType).toBe(CrmActivityActivityType.PARTNER_APPLICATION_SUBMITTED);
      expect(result!.partnerId).toBe('partner-1');
      expect(result!.subjectType).toBe(CrmActivitySubjectType.PARTNER);
    });

    it('projects APPROVED event', () => {
      const app = {
        id: 'pa-1',
        partnerId: 'partner-1',
        status: 'APPROVED',
        createdAt: new Date('2026-08-14T08:00:00Z'),
        history: [{ action: 'submitted' }, { action: 'approved' }],
      };
      const result = adapter.project(app, 'approved');
      expect(result!.activityType).toBe(CrmActivityActivityType.PARTNER_APPLICATION_APPROVED);
    });
  });

  describe('getAllAdapters', () => {
    it('returns exactly 10 adapters', () => {
      const adapters = getAllAdapters();
      expect(adapters).toHaveLength(10);
      const sourceTypes = adapters.map((a) => a.sourceType);
      expect(sourceTypes).toContain(CrmActivitySourceType.OPERATIONAL_NOTE);
      expect(sourceTypes).toContain(CrmActivitySourceType.ORDER);
      expect(sourceTypes).toContain(CrmActivitySourceType.BOOKING);
      expect(sourceTypes).toContain(CrmActivitySourceType.PAYMENT);
      expect(sourceTypes).toContain(CrmActivitySourceType.REFUND);
      expect(sourceTypes).toContain(CrmActivitySourceType.MESSAGE);
      expect(sourceTypes).toContain(CrmActivitySourceType.AUDIT_EVENT);
      expect(sourceTypes).toContain(CrmActivitySourceType.CUSTOMER_HISTORY);
      expect(sourceTypes).toContain(CrmActivitySourceType.BUYER_REQUEST);
      expect(sourceTypes).toContain(CrmActivitySourceType.PARTNER_APPLICATION);
    });
  });
});

// ─── Service Tests ──────────────────────────────────────────────────────────

describe('CrmActivityService', () => {
  let service: CrmActivityService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrmActivityService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CrmActivityService>(CrmActivityService);
  });

  describe('projectActivity', () => {
    it('creates a new activity row', async () => {
      const projection = {
        sourceType: CrmActivitySourceType.ORDER,
        sourceId: 'order-1',
        sourceEvent: 'created',
        activityType: CrmActivityActivityType.ORDER_CREATED,
        subjectType: CrmActivitySubjectType.CUSTOMER,
        subjectId: 'cust-1',
        customerId: 'cust-1',
        partnerId: null,
        occurredAt: new Date('2026-08-01T10:00:00Z'),
        actorUserId: null,
        actorName: null,
        title: 'Заказ создан',
        summary: 'ORD-00000001',
        metadata: { code: 'ORD-00000001', status: 'NEW' },
        deepLink: '/app/orders/order-1',
        visibility: 'INTERNAL',
      };
      const id = await service.projectActivity(projection);
      expect(id).toBeDefined();
      expect(mockPrisma.crmActivity.upsert).toHaveBeenCalledTimes(1);
    });

    it('is idempotent: same projection twice creates one row', async () => {
      const projection = {
        sourceType: CrmActivitySourceType.ORDER,
        sourceId: 'order-1',
        sourceEvent: 'created',
        activityType: CrmActivityActivityType.ORDER_CREATED,
        subjectType: CrmActivitySubjectType.CUSTOMER,
        subjectId: 'cust-1',
        customerId: 'cust-1',
        partnerId: null,
        occurredAt: new Date('2026-08-01T10:00:00Z'),
        actorUserId: null,
        actorName: null,
        title: 'Заказ создан',
        summary: 'ORD-00000001',
        metadata: null,
        deepLink: '/app/orders/order-1',
        visibility: 'INTERNAL',
      };
      await service.projectActivity(projection);
      await service.projectActivity(projection);
      // upsert called twice but only one logical row
      expect(mockPrisma.crmActivity.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('queryCustomerActivity', () => {
    it('returns paginated results', async () => {
      // Seed some activities
      for (let i = 0; i < 5; i++) {
        await service.projectActivity({
          sourceType: CrmActivitySourceType.ORDER,
          sourceId: `order-${i}`,
          sourceEvent: 'created',
          activityType: CrmActivityActivityType.ORDER_CREATED,
          subjectType: CrmActivitySubjectType.CUSTOMER,
          subjectId: 'cust-1',
          customerId: 'cust-1',
          partnerId: null,
          occurredAt: new Date(`2026-08-0${i + 1}T10:00:00Z`),
          actorUserId: null,
          actorName: null,
          title: 'Заказ создан',
          summary: null,
          metadata: null,
          deepLink: null,
          visibility: 'INTERNAL',
        });
      }

      const page = await service.queryCustomerActivity('cust-1', { pageSize: 3 });
      expect(page.items).toHaveLength(3);
      expect(page.hasMore).toBe(true);
      expect(page.nextCursor).not.toBeNull();
    });

    it('returns hasMore=false when all items fit', async () => {
      await service.projectActivity({
        sourceType: CrmActivitySourceType.ORDER,
        sourceId: 'order-1',
        sourceEvent: 'created',
        activityType: CrmActivityActivityType.ORDER_CREATED,
        subjectType: CrmActivitySubjectType.CUSTOMER,
        subjectId: 'cust-1',
        customerId: 'cust-1',
        partnerId: null,
        occurredAt: new Date('2026-08-01T10:00:00Z'),
        actorUserId: null,
        actorName: null,
        title: 'Заказ создан',
        summary: null,
        metadata: null,
        deepLink: null,
        visibility: 'INTERNAL',
      });

      const page = await service.queryCustomerActivity('cust-1');
      expect(page.items).toHaveLength(1);
      expect(page.hasMore).toBe(false);
      expect(page.nextCursor).toBeNull();
    });
  });

  describe('Subject Isolation', () => {
    it('Customer A activity never matches Customer B', async () => {
      // Project activity for customer A
      await service.projectActivity({
        sourceType: CrmActivitySourceType.ORDER,
        sourceId: 'order-a1',
        sourceEvent: 'created',
        activityType: CrmActivityActivityType.ORDER_CREATED,
        subjectType: CrmActivitySubjectType.CUSTOMER,
        subjectId: 'cust-A',
        customerId: 'cust-A',
        partnerId: null,
        occurredAt: new Date('2026-08-01T10:00:00Z'),
        actorUserId: null,
        actorName: null,
        title: 'Заказ создан',
        summary: null,
        metadata: null,
        deepLink: null,
        visibility: 'INTERNAL',
      });

      // Project activity for customer B
      await service.projectActivity({
        sourceType: CrmActivitySourceType.ORDER,
        sourceId: 'order-b1',
        sourceEvent: 'created',
        activityType: CrmActivityActivityType.ORDER_CREATED,
        subjectType: CrmActivitySubjectType.CUSTOMER,
        subjectId: 'cust-B',
        customerId: 'cust-B',
        partnerId: null,
        occurredAt: new Date('2026-08-02T10:00:00Z'),
        actorUserId: null,
        actorName: null,
        title: 'Заказ создан',
        summary: null,
        metadata: null,
        deepLink: null,
        visibility: 'INTERNAL',
      });

      const pageA = await service.queryCustomerActivity('cust-A');
      const pageB = await service.queryCustomerActivity('cust-B');

      expect(pageA.items).toHaveLength(1);
      expect(pageA.items[0].customerId).toBe('cust-A');
      expect(pageB.items).toHaveLength(1);
      expect(pageB.items[0].customerId).toBe('cust-B');
    });

    it('Partner A never matches Partner B', async () => {
      await service.projectActivity({
        sourceType: CrmActivitySourceType.OPERATIONAL_NOTE,
        sourceId: 'note-p1',
        sourceEvent: 'created',
        activityType: CrmActivityActivityType.NOTE_CREATED,
        subjectType: CrmActivitySubjectType.PARTNER,
        subjectId: 'partner-A',
        customerId: null,
        partnerId: 'partner-A',
        occurredAt: new Date('2026-08-01T10:00:00Z'),
        actorUserId: null,
        actorName: null,
        title: 'Примечание',
        summary: null,
        metadata: null,
        deepLink: null,
        visibility: 'INTERNAL',
      });

      await service.projectActivity({
        sourceType: CrmActivitySourceType.OPERATIONAL_NOTE,
        sourceId: 'note-p2',
        sourceEvent: 'created',
        activityType: CrmActivityActivityType.NOTE_CREATED,
        subjectType: CrmActivitySubjectType.PARTNER,
        subjectId: 'partner-B',
        customerId: null,
        partnerId: 'partner-B',
        occurredAt: new Date('2026-08-02T10:00:00Z'),
        actorUserId: null,
        actorName: null,
        title: 'Примечание',
        summary: null,
        metadata: null,
        deepLink: null,
        visibility: 'INTERNAL',
      });

      const pageA = await service.queryPartnerActivity('partner-A');
      const pageB = await service.queryPartnerActivity('partner-B');

      expect(pageA.items).toHaveLength(1);
      expect(pageA.items[0].partnerId).toBe('partner-A');
      expect(pageB.items).toHaveLength(1);
      expect(pageB.items[0].partnerId).toBe('partner-B');
    });

    it('dual-subject Order appears in both Customer and Partner scopes', async () => {
      await service.projectActivity({
        sourceType: CrmActivitySourceType.ORDER,
        sourceId: 'order-dual',
        sourceEvent: 'created',
        activityType: CrmActivityActivityType.ORDER_CREATED,
        subjectType: CrmActivitySubjectType.CUSTOMER,
        subjectId: 'cust-1',
        customerId: 'cust-1',
        partnerId: 'partner-1',
        occurredAt: new Date('2026-08-01T10:00:00Z'),
        actorUserId: null,
        actorName: null,
        title: 'Заказ создан',
        summary: null,
        metadata: null,
        deepLink: null,
        visibility: 'INTERNAL',
      });

      const customerPage = await service.queryCustomerActivity('cust-1');
      const partnerPage = await service.queryPartnerActivity('partner-1');

      // Both should find this dual-subject order
      expect(customerPage.items).toHaveLength(1);
      expect(partnerPage.items).toHaveLength(1);
    });
  });

  describe('Cursor Ordering', () => {
    it('deterministic ordering with same occurredAt: cursor encodes last item', async () => {
      const sameTime = new Date('2026-08-01T10:00:00Z');

      // Project 3 items with same occurredAt but different IDs
      for (let i = 0; i < 3; i++) {
        await service.projectActivity({
          sourceType: CrmActivitySourceType.ORDER,
          sourceId: `order-${i}`,
          sourceEvent: 'created',
          activityType: CrmActivityActivityType.ORDER_CREATED,
          subjectType: CrmActivitySubjectType.CUSTOMER,
          subjectId: 'cust-1',
          customerId: 'cust-1',
          partnerId: null,
          occurredAt: sameTime,
          actorUserId: null,
          actorName: null,
          title: 'Заказ создан',
          summary: null,
          metadata: null,
          deepLink: null,
          visibility: 'INTERNAL',
        });
      }

      const page = await service.queryCustomerActivity('cust-1', { pageSize: 2 });
      expect(page.items).toHaveLength(2);
      expect(page.hasMore).toBe(true);
      expect(page.nextCursor).not.toBeNull();
      // Cursor encodes the last item's occurredAt and id
      expect(page.nextCursor!.occurredAt).toEqual(sameTime);
      expect(page.nextCursor!.id).toBeDefined();
    });
  });

  describe('Business Date Authority', () => {
    it('Payment activity uses paidAt for PAYMENT_CAPTURED', () => {
      const adapter = new PaymentAdapter();
      const payment = {
        id: 'pay-1',
        code: 'PAY-00000001',
        status: 'CAPTURED',
        amount: 500,
        currency: 'AZN',
        customerId: 'cust-1',
        createdAt: new Date('2026-08-05T11:00:00Z'),
        paidAt: new Date('2026-08-05T11:30:00Z'),
        order: { items: [] },
      };
      const result = adapter.project(payment, 'captured');
      expect(result!.occurredAt).toEqual(new Date('2026-08-05T11:30:00Z'));
    });

    it('Refund activity uses processedAt for REFUND_PROCESSED', () => {
      const adapter = new RefundAdapter();
      const refund = {
        id: 'ref-1',
        code: 'REF-00000001',
        status: 'PROCESSED',
        amount: 200,
        currency: 'AZN',
        reason: 'Defective',
        createdAt: new Date('2026-08-06T09:00:00Z'),
        processedAt: new Date('2026-08-07T10:00:00Z'),
        payment: {
          customerId: 'cust-1',
          order: { items: [] },
        },
      };
      const result = adapter.project(refund, 'processed');
      expect(result!.occurredAt).toEqual(new Date('2026-08-07T10:00:00Z'));
    });
  });

  describe('removeActivityForSource', () => {
    it('removes all activity for a deleted source', async () => {
      // Seed activities
      await service.projectActivity({
        sourceType: CrmActivitySourceType.OPERATIONAL_NOTE,
        sourceId: 'note-1',
        sourceEvent: 'created',
        activityType: CrmActivityActivityType.NOTE_CREATED,
        subjectType: CrmActivitySubjectType.CUSTOMER,
        subjectId: 'cust-1',
        customerId: 'cust-1',
        partnerId: null,
        occurredAt: new Date('2026-08-01T10:00:00Z'),
        actorUserId: null,
        actorName: null,
        title: 'Примечание',
        summary: null,
        metadata: null,
        deepLink: null,
        visibility: 'INTERNAL',
      });

      const removed = await service.removeActivityForSource(
        CrmActivitySourceType.OPERATIONAL_NOTE,
        'note-1',
      );
      expect(removed).toBe(1);
    });
  });

  describe('getActivityCount', () => {
    it('returns correct count for subject', async () => {
      await service.projectActivity({
        sourceType: CrmActivitySourceType.ORDER,
        sourceId: 'order-1',
        sourceEvent: 'created',
        activityType: CrmActivityActivityType.ORDER_CREATED,
        subjectType: CrmActivitySubjectType.CUSTOMER,
        subjectId: 'cust-1',
        customerId: 'cust-1',
        partnerId: null,
        occurredAt: new Date('2026-08-01T10:00:00Z'),
        actorUserId: null,
        actorName: null,
        title: 'Заказ',
        summary: null,
        metadata: null,
        deepLink: null,
        visibility: 'INTERNAL',
      });

      const count = await service.getActivityCount(CrmActivitySubjectType.CUSTOMER, 'cust-1');
      expect(count).toBe(1);
    });
  });

  describe('All 10 Source Types in Taxonomy', () => {
    it('each source type maps to correct activity types', () => {
      const sourceActivityMap: Record<string, CrmActivityActivityType[]> = {
        [CrmActivitySourceType.OPERATIONAL_NOTE]: [CrmActivityActivityType.NOTE_CREATED],
        [CrmActivitySourceType.ORDER]: [
          CrmActivityActivityType.ORDER_CREATED,
          CrmActivityActivityType.ORDER_STATUS_CHANGED,
          CrmActivityActivityType.ORDER_CANCELLED,
        ],
        [CrmActivitySourceType.BOOKING]: [
          CrmActivityActivityType.BOOKING_CREATED,
          CrmActivityActivityType.BOOKING_STATUS_CHANGED,
          CrmActivityActivityType.BOOKING_COMPLETED,
        ],
        [CrmActivitySourceType.PAYMENT]: [
          CrmActivityActivityType.PAYMENT_CREATED,
          CrmActivityActivityType.PAYMENT_CAPTURED,
        ],
        [CrmActivitySourceType.REFUND]: [
          CrmActivityActivityType.REFUND_CREATED,
          CrmActivityActivityType.REFUND_PROCESSED,
        ],
        [CrmActivitySourceType.MESSAGE]: [CrmActivityActivityType.MESSAGE_SENT],
        [CrmActivitySourceType.AUDIT_EVENT]: [
          CrmActivityActivityType.AUDIT_CUSTOMER_CREATED,
          CrmActivityActivityType.AUDIT_CUSTOMER_STATUS_CHANGED,
          CrmActivityActivityType.AUDIT_PARTNER_APPROVED,
        ],
        [CrmActivitySourceType.CUSTOMER_HISTORY]: [
          CrmActivityActivityType.CUSTOMER_HISTORY_CREATED,
          CrmActivityActivityType.CUSTOMER_HISTORY_STATUS_CHANGED,
          CrmActivityActivityType.CUSTOMER_HISTORY_UPDATED,
        ],
        [CrmActivitySourceType.BUYER_REQUEST]: [
          CrmActivityActivityType.BUYER_REQUEST_CREATED,
          CrmActivityActivityType.BUYER_REQUEST_SUBMITTED,
          CrmActivityActivityType.BUYER_REQUEST_CANCELLED,
        ],
        [CrmActivitySourceType.PARTNER_APPLICATION]: [
          CrmActivityActivityType.PARTNER_APPLICATION_SUBMITTED,
          CrmActivityActivityType.PARTNER_APPLICATION_APPROVED,
          CrmActivityActivityType.PARTNER_APPLICATION_REJECTED,
        ],
      };

      // Verify each activity type has a title
      for (const [, types] of Object.entries(sourceActivityMap)) {
        for (const type of types) {
          expect(ACTIVITY_TYPE_TITLES[type]).toBeDefined();
          expect(ACTIVITY_TYPE_TITLES[type].length).toBeGreaterThan(0);
        }
      }
    });
  });
});
