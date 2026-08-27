/**
 * PHASE 3 STEP 3.5.3 — CRM Activity Round 2B
 * Activity API + Two-Level RBAC + Cursor Pagination + Server-Side Filtering
 * + Source-Specific Item Authorization + Subject Authority
 *
 * Pure unit tests (no supertest) — tests call controller methods directly.
 */

import { NotFoundException } from '@nestjs/common';
import { CrmActivityController } from './crm-activity.controller';
import { CrmActivityService } from './crm-activity.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CrmActivitySourceType, CrmActivityActivityType, CrmActivitySubjectType } from '../../generated/prisma/enums';
import type { AuthUser } from '../../security/auth/auth.service';

// ─── Test Fixtures ──────────────────────────────────────────────────────────

function makeActor(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    code: 'USR-001',
    username: 'admin',
    email: 'admin@test.com',
    fullName: 'Admin User',
    status: 'ACTIVE' as any,
    role: 'ADMIN',
    roleTitle: 'Administrator',
    partnerId: null,
    customerId: null,
    permissions: ['crm.activity.read', 'operational-notes.read', 'order.read', 'booking.read', 'finance.payment.read', 'finance.refund.read', 'communication.read', 'audit.read', 'crm.customer.read', 'reverse.request.read_own', 'partner.onboarding.read_own'],
    ...overrides,
  };
}

function makeActivity(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 'act-1',
    sourceType: overrides.sourceType ?? CrmActivitySourceType.ORDER,
    sourceId: overrides.sourceId ?? 'ord-1',
    sourceEvent: overrides.sourceEvent ?? 'created',
    activityType: overrides.activityType ?? CrmActivityActivityType.ORDER_CREATED,
    subjectType: overrides.subjectType ?? CrmActivitySubjectType.CUSTOMER,
    subjectId: overrides.subjectId ?? 'cus-1',
    customerId: overrides.customerId ?? 'cus-1',
    partnerId: overrides.partnerId ?? null,
    occurredAt: overrides.occurredAt ?? new Date('2026-08-27T10:00:00Z'),
    actorUserId: overrides.actorUserId ?? null,
    actorName: overrides.actorName ?? null,
    title: overrides.title ?? 'Order Created',
    summary: overrides.summary ?? null,
    metadata: overrides.metadata ?? null,
    deepLink: overrides.deepLink ?? null,
    visibility: overrides.visibility ?? 'INTERNAL',
  };
}

function encodeCursor(occurredAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ occurredAt: occurredAt.toISOString(), id })).toString('base64url');
}

// ─── Mock Prisma ────────────────────────────────────────────────────────────

const mockPrisma = {
  customer: { findUnique: jest.fn() },
  partner: { findUnique: jest.fn() },
  crmActivity: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
} as unknown as PrismaService;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CrmActivityController — Round 2B', () => {
  let controller: CrmActivityController;

  beforeEach(() => {
    controller = new CrmActivityController(
      {} as CrmActivityService,
      mockPrisma as any,
    );
    jest.clearAllMocks();
    (mockPrisma.customer.findUnique as any).mockResolvedValue({ id: 'cus-1' });
    (mockPrisma.partner.findUnique as any).mockResolvedValue({ id: 'par-1' });
  });

  // ──────────────────────────────────────────────────────────────────────
  // CUSTOMER ACTIVITY — Happy path
  // ──────────────────────────────────────────────────────────────────────

  describe('listCustomerActivity', () => {
    it('returns first page with items for authorized subject', async () => {
      const items = [
        makeActivity({ id: 'act-1', sourceType: CrmActivitySourceType.ORDER, occurredAt: new Date('2026-08-27T12:00:00Z') }),
        makeActivity({ id: 'act-2', sourceType: CrmActivitySourceType.BOOKING, occurredAt: new Date('2026-08-27T11:00:00Z') }),
      ];
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue(items);

      const result = await controller.listCustomerActivity('cus-1', {}, makeActor());

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.items[0].id).toBe('act-1');
      expect(result.items[1].id).toBe('act-2');
    });

    it('returns empty items for zero state', async () => {
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue([]);

      const result = await controller.listCustomerActivity('cus-1', {}, makeActor());

      expect(result.items).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('throws NotFoundException for nonexistent customer', async () => {
      (mockPrisma.customer.findUnique as any).mockResolvedValue(null);

      await expect(
        controller.listCustomerActivity('nonexistent', {}, makeActor()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // LEVEL 2: Source-Specific Item Authorization
  // ──────────────────────────────────────────────────────────────────────

  describe('Source-specific item authorization', () => {
    const sourcePermMap: Record<string, string> = {
      OPERATIONAL_NOTE: 'operational-notes.read',
      ORDER: 'order.read',
      BOOKING: 'booking.read',
      PAYMENT: 'finance.payment.read',
      REFUND: 'finance.refund.read',
      MESSAGE: 'communication.read',
      AUDIT_EVENT: 'audit.read',
      CUSTOMER_HISTORY: 'crm.customer.read',
      BUYER_REQUEST: 'reverse.request.read_own',
      PARTNER_APPLICATION: 'partner.onboarding.read_own',
    };

    for (const [sourceType, requiredPerm] of Object.entries(sourcePermMap)) {
      it(`${sourceType}: visible when actor has ${requiredPerm}`, async () => {
        const actor = makeActor({ permissions: ['crm.activity.read', requiredPerm] });
        (mockPrisma.crmActivity.findMany as any).mockResolvedValue([
          makeActivity({ sourceType: sourceType as CrmActivitySourceType }),
        ]);

        const result = await controller.listCustomerActivity('cus-1', {}, actor);

        expect(result.items).toHaveLength(1);
      });

      it(`${sourceType}: hidden when actor lacks ${requiredPerm}`, async () => {
        const actor = makeActor({ role: 'OPERATOR', permissions: ['crm.activity.read'] }); // no source perm
        (mockPrisma.crmActivity.findMany as any).mockResolvedValue([
          makeActivity({ sourceType: sourceType as CrmActivitySourceType }),
        ]);

        const result = await controller.listCustomerActivity('cus-1', {}, actor);

        expect(result.items).toHaveLength(0);
      });
    }

    it('ADMIN sees all source types regardless of specific permissions', async () => {
      const admin = makeActor({ role: 'ADMIN', permissions: [] }); // no explicit perms
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue([
        makeActivity({ sourceType: CrmActivitySourceType.ORDER }),
        makeActivity({ sourceType: CrmActivitySourceType.PAYMENT }),
        makeActivity({ sourceType: CrmActivitySourceType.OPERATIONAL_NOTE }),
      ]);

      const result = await controller.listCustomerActivity('cus-1', {}, admin);

      expect(result.items).toHaveLength(3);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // CURSOR PAGINATION
  // ──────────────────────────────────────────────────────────────────────

  describe('Cursor pagination', () => {
    it('sets hasMore=true and nextCursor when more items exist', async () => {
      const items = [
        makeActivity({ id: 'act-1', occurredAt: new Date('2026-08-27T12:00:00Z') }),
        makeActivity({ id: 'act-2', occurredAt: new Date('2026-08-27T11:00:00Z') }),
        makeActivity({ id: 'act-3', occurredAt: new Date('2026-08-27T10:00:00Z') }),
      ];
      // +1 extra item means hasMore
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue([...items, makeActivity({ id: 'act-0' })]);

      const result = await controller.listCustomerActivity('cus-1', { limit: 3 }, makeActor());

      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeTruthy();
      expect(result.items).toHaveLength(3);
    });

    it('passes cursor to DB query', async () => {
      const cursor = encodeCursor(new Date('2026-08-27T10:00:00Z'), 'act-10');
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue([]);

      await controller.listCustomerActivity('cus-1', { cursor }, makeActor());

      const whereArg = (mockPrisma.crmActivity.findMany as any).mock.calls[0][0].where;
      expect(whereArg.OR).toBeDefined();
      expect(whereArg.OR).toHaveLength(2);
    });

    it('rejects invalid cursor', async () => {
      await expect(
        controller.listCustomerActivity('cus-1', { cursor: 'not-base64!!!' }, makeActor()),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects cursor with missing id', async () => {
      const badCursor = Buffer.from(JSON.stringify({ occurredAt: '2026-08-27T10:00:00Z' })).toString('base64url');

      await expect(
        controller.listCustomerActivity('cus-1', { cursor: badCursor }, makeActor()),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects cursor with invalid timestamp', async () => {
      const badCursor = Buffer.from(JSON.stringify({ occurredAt: 'not-a-date', id: 'act-1' })).toString('base64url');

      // Invalid timestamp produces NaN date; controller throws NotFoundException
      await expect(
        controller.listCustomerActivity('cus-1', { cursor: badCursor }, makeActor()),
      ).rejects.toThrow();
    });

    it('respects limit parameter', async () => {
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue([]);

      await controller.listCustomerActivity('cus-1', { limit: 5 }, makeActor());

      // Over-fetch factor = 3, so take = 5 * 3 + 1 = 16
      const callArgs = (mockPrisma.crmActivity.findMany as any).mock.calls[0][0];
      expect(callArgs.take).toBe(16);
    });

    it('uses default limit of 20', async () => {
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue([]);

      await controller.listCustomerActivity('cus-1', {}, makeActor());

      const callArgs = (mockPrisma.crmActivity.findMany as any).mock.calls[0][0];
      expect(callArgs.take).toBe(61); // 20 * 3 + 1
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // SERVER-SIDE FILTERS
  // ──────────────────────────────────────────────────────────────────────

  describe('Server-side filtering', () => {
    it('filters by sourceType', async () => {
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue([]);

      await controller.listCustomerActivity('cus-1', { sourceType: CrmActivitySourceType.ORDER }, makeActor());

      const whereArg = (mockPrisma.crmActivity.findMany as any).mock.calls[0][0].where;
      expect(whereArg.sourceType).toBe('ORDER');
    });

    it('filters by activityType', async () => {
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue([]);

      await controller.listCustomerActivity('cus-1', { activityType: CrmActivityActivityType.ORDER_CREATED }, makeActor());

      const whereArg = (mockPrisma.crmActivity.findMany as any).mock.calls[0][0].where;
      expect(whereArg.activityType).toBe('ORDER_CREATED');
    });

    it('filters by dateFrom and dateTo', async () => {
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue([]);

      await controller.listCustomerActivity('cus-1', {
        dateFrom: '2026-08-01T00:00:00Z',
        dateTo: '2026-08-31T23:59:59Z',
      }, makeActor());

      const whereArg = (mockPrisma.crmActivity.findMany as any).mock.calls[0][0].where;
      expect(whereArg.occurredAt.gte).toEqual(new Date('2026-08-01T00:00:00Z'));
      expect(whereArg.occurredAt.lte).toEqual(new Date('2026-08-31T23:59:59Z'));
    });

    it('rejects invalid sourceType', async () => {
      await expect(
        controller.listCustomerActivity('cus-1', { sourceType: 'INVALID' as any }, makeActor()),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects invalid activityType', async () => {
      await expect(
        controller.listCustomerActivity('cus-1', { activityType: 'INVALID' as any }, makeActor()),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects invalid dateFrom', async () => {
      await expect(
        controller.listCustomerActivity('cus-1', { dateFrom: 'not-a-date' }, makeActor()),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects invalid dateTo', async () => {
      await expect(
        controller.listCustomerActivity('cus-1', { dateTo: 'not-a-date' }, makeActor()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // MIXED AUTHORIZATION PAGINATION (P0 gate)
  // ──────────────────────────────────────────────────────────────────────

  describe('Mixed-authorization pagination', () => {
    it('omits hidden items and corrects hasMore across pages', async () => {
      const actor = makeActor({ role: 'OPERATOR', permissions: ['crm.activity.read', 'order.read'] }); // only ORDER visible
      const candidates = [
        makeActivity({ id: 'a1', sourceType: CrmActivitySourceType.ORDER, occurredAt: new Date('2026-08-27T14:00:00Z') }),
        makeActivity({ id: 'a2', sourceType: CrmActivitySourceType.PAYMENT, occurredAt: new Date('2026-08-27T13:00:00Z') }),
        makeActivity({ id: 'a3', sourceType: CrmActivitySourceType.REFUND, occurredAt: new Date('2026-08-27T12:00:00Z') }),
        makeActivity({ id: 'a4', sourceType: CrmActivitySourceType.ORDER, occurredAt: new Date('2026-08-27T11:00:00Z') }),
        makeActivity({ id: 'a5', sourceType: CrmActivitySourceType.ORDER, occurredAt: new Date('2026-08-27T10:00:00Z') }),
        makeActivity({ id: 'a6', sourceType: CrmActivitySourceType.MESSAGE, occurredAt: new Date('2026-08-27T09:00:00Z') }),
        makeActivity({ id: 'a7', sourceType: CrmActivitySourceType.ORDER, occurredAt: new Date('2026-08-27T08:00:00Z') }),
      ];
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue(candidates);

      const result = await controller.listCustomerActivity('cus-1', { limit: 3 }, actor);

      // 4 ORDER items visible, limit=3 → first page has 3
      expect(result.items).toHaveLength(3);
      expect(result.items[0].id).toBe('a1');
      expect(result.items[1].id).toBe('a4');
      expect(result.items[2].id).toBe('a5');
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeTruthy();

      // No PAYMENT/REFUND/MESSAGE items leaked
      for (const item of result.items) {
        expect(item.sourceType).toBe('ORDER');
      }
    });

    it('every authorized row appears exactly once, no unauthorized rows', async () => {
      const actor = makeActor({ role: 'OPERATOR', permissions: ['crm.activity.read', 'order.read', 'communication.read'] });
      const candidates = Array.from({ length: 12 }, (_, i) =>
        makeActivity({
          id: `a-${i}`,
          sourceType: i % 3 === 0 ? CrmActivitySourceType.ORDER : CrmActivitySourceType.PAYMENT,
          occurredAt: new Date(2026, 7, 27, 14 - i),
        }),
      );
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue(candidates);

      // Page 1: limit=5, should get 4 ORDER items (a-0, a-3, a-6, a-9)
      const result1 = await controller.listCustomerActivity('cus-1', { limit: 5 }, actor);
      expect(result1.items.every((i) => i.sourceType === 'ORDER')).toBe(true);
      expect(result1.items).toHaveLength(4);

      // a-12 would be the next one (also ORDER if it existed)
      // All authorized ORDER rows from the batch are returned
      const returnedIds = result1.items.map((i) => i.id);
      const expectedOrderIds = candidates
        .filter((c) => c.sourceType === 'ORDER')
        .map((c) => c.id);
      expect(returnedIds).toEqual(expectedOrderIds);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // SAFE RESPONSE DTO
  // ──────────────────────────────────────────────────────────────────────

  describe('Safe response DTO', () => {
    it('does not expose internal fields', async () => {
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue([makeActivity({ id: 'act-1' })]);

      const result = await controller.listCustomerActivity('cus-1', {}, makeActor());

      const item = result.items[0];
      // Should have:
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('sourceType');
      expect(item).toHaveProperty('sourceId');
      expect(item).toHaveProperty('activityType');
      expect(item).toHaveProperty('occurredAt');
      expect(item).toHaveProperty('actor');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('summary');
      expect(item).toHaveProperty('deepLink');
      // Should NOT have:
      expect(item).not.toHaveProperty('sourceEvent');
      expect(item).not.toHaveProperty('visibility');
      expect(item).not.toHaveProperty('metadata');
      expect(item).not.toHaveProperty('subjectType');
      expect(item).not.toHaveProperty('customerId');
      expect(item).not.toHaveProperty('partnerId');
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // SUBJECT AUTHORITY
  // ──────────────────────────────────────────────────────────────────────

  describe('Subject authority', () => {
    it('customerId comes from route, not query', async () => {
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue([]);

      await controller.listCustomerActivity('cus-1', {}, makeActor());

      const whereArg = (mockPrisma.crmActivity.findMany as any).mock.calls[0][0].where;
      expect(whereArg.customerId).toBe('cus-1');
    });

    it('partnerId comes from route, not query', async () => {
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue([]);

      await controller.listPartnerActivity('par-1', {}, makeActor());

      const whereArg = (mockPrisma.crmActivity.findMany as any).mock.calls[0][0].where;
      expect(whereArg.partnerId).toBe('par-1');
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // PARTNER ACTIVITY
  // ──────────────────────────────────────────────────────────────────────

  describe('listPartnerActivity', () => {
    it('returns items for authorized partner', async () => {
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue([
        makeActivity({ id: 'act-p1', partnerId: 'par-1', subjectType: CrmActivitySubjectType.PARTNER, subjectId: 'par-1' }),
      ]);

      const result = await controller.listPartnerActivity('par-1', {}, makeActor());

      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it('throws for nonexistent partner', async () => {
      (mockPrisma.partner.findUnique as any).mockResolvedValue(null);

      await expect(
        controller.listPartnerActivity('nonexistent', {}, makeActor()),
      ).rejects.toThrow(NotFoundException);
    });

    it('omits unauthorized source items', async () => {
      const actor = makeActor({ role: 'OPERATOR', permissions: ['crm.activity.read', 'communication.read'] });
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue([
        makeActivity({ sourceType: CrmActivitySourceType.ORDER, partnerId: 'par-1' }),
        makeActivity({ sourceType: CrmActivitySourceType.MESSAGE, partnerId: 'par-1' }),
      ]);

      const result = await controller.listPartnerActivity('par-1', {}, actor);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].sourceType).toBe('MESSAGE');
    });

    it('filters by sourceType', async () => {
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue([]);

      await controller.listPartnerActivity('par-1', { sourceType: CrmActivitySourceType.BOOKING }, makeActor());

      const whereArg = (mockPrisma.crmActivity.findMany as any).mock.calls[0][0].where;
      expect(whereArg.sourceType).toBe('BOOKING');
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // BUSINESS DATE REGRESSION
  // ──────────────────────────────────────────────────────────────────────

  describe('Business date regression', () => {
    it('Payment items expose occurredAt from DB (paidAt-derived)', async () => {
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue([
        makeActivity({
          sourceType: CrmActivitySourceType.PAYMENT,
          activityType: CrmActivityActivityType.PAYMENT_CAPTURED,
          occurredAt: new Date('2026-08-27T15:00:00Z'),
        }),
      ]);

      const result = await controller.listCustomerActivity('cus-1', { sourceType: CrmActivitySourceType.PAYMENT }, makeActor());

      expect(result.items[0].occurredAt.toISOString()).toBe('2026-08-27T15:00:00.000Z');
    });

    it('Refund items expose occurredAt from DB (processedAt-derived)', async () => {
      (mockPrisma.crmActivity.findMany as any).mockResolvedValue([
        makeActivity({
          sourceType: CrmActivitySourceType.REFUND,
          activityType: CrmActivityActivityType.REFUND_PROCESSED,
          occurredAt: new Date('2026-08-27T16:00:00Z'),
        }),
      ]);

      const result = await controller.listCustomerActivity('cus-1', { sourceType: CrmActivitySourceType.REFUND }, makeActor());

      expect(result.items[0].occurredAt.toISOString()).toBe('2026-08-27T16:00:00.000Z');
    });
  });
});
