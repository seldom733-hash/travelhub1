import { CrmService } from './crm.service';

/* ─────────────────────────────────────────────────────────────────────────────
 * Step 3.5C — CRM Intake Service Unit Tests
 * ─────────────────────────────────────────────────────────────────────────── */

class MockStore {
  rows: Map<string, any[]> = new Map();

  insert(table: string, data: any) {
    const list = this.rows.get(table) ?? [];
    list.push({ table, data });
    this.rows.set(table, list);
    return data;
  }

  findFirst(table: string, predicate: (d: any) => boolean) {
    return (this.rows.get(table) ?? []).find((r) => predicate(r.data))?.data ?? null;
  }

  findMany(table: string, predicate?: (d: any) => boolean) {
    const list = (this.rows.get(table) ?? []).map((r) => r.data);
    return predicate ? list.filter(predicate) : list;
  }

  count(table: string, predicate?: (d: any) => boolean) {
    return this.findMany(table, predicate).length;
  }
}

function resolveWhere(table: string, store: MockStore, where: any) {
  if (where.email) return store.findFirst(table, (d) => d.email === where.email);
  if (where.id) return store.findFirst(table, (d) => d.id === where.id);
  if (where.partnerId_customerId) {
    const { partnerId, customerId } = where.partnerId_customerId;
    return store.findFirst(table, (d) => d.partnerId === partnerId && d.customerId === customerId);
  }
  if (where.partnerId !== undefined && where.partnerId !== null) {
    // For partnerStorefront: find by partnerId field
    return store.findFirst(table, (d) => d.partnerId === where.partnerId);
  }
  if (where.code) return store.findFirst(table, (d) => d.code === where.code);
  return null;
}

function buildMockPrisma(store: MockStore) {
  const makeModelClient = (table: string) => ({
    findUnique: jest.fn(async ({ where, select }: any) => {
      let result = resolveWhere(table, store, where);
      if (result && select) {
        return Object.fromEntries(Object.keys(select).filter(k => k in result).map(k => [k, result[k]]));
      }
      return result;
    }),
    create: jest.fn(async ({ data, select }: any) => {
      const id = data.id ?? `mock-${table}-${store.count(table) + 1}`;
      const record = { ...data, id, createdAt: new Date(), updatedAt: new Date() };
      store.insert(table, record);
      if (select) {
        return Object.fromEntries(Object.keys(select).filter(k => k in record).map(k => [k, record[k]]));
      }
      return record;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const existing = resolveWhere(table, store, where);
      if (!existing) throw new Error(`Not found in ${table}`);
      Object.assign(existing, data);
      return existing;
    }),
    findMany: jest.fn(async ({ where, orderBy, skip, take }: any = {}) => {
      let items = store.findMany(table);
      if (where?.customerId) items = items.filter((d) => d.customerId === where.customerId);
      if (where?.sellerPartnerId) items = items.filter((d) => d.sellerPartnerId === where.sellerPartnerId);
      if (where?.partnerId) items = items.filter((d) => d.partnerId === where.partnerId);
      if (take) items = items.slice(skip ?? 0, (skip ?? 0) + take);
      return items;
    }),
    count: jest.fn(async ({ where } = {}) => {
      return store.findMany(table, (d) => {
        if (where?.customerId && d.customerId !== where.customerId) return false;
        if (where?.sellerPartnerId && d.sellerPartnerId !== where.sellerPartnerId) return false;
        if (where?.partnerId && d.partnerId !== where.partnerId) return false;
        return true;
      }).length;
    }),
  });

  const prisma = {
    $transaction: jest.fn(async (fn: any) => {
      const tx: any = {};
      const tables: [string, string][] = [
        ['Customer', 'customer'], ['Partner', 'partner'],
        ['PartnerCustomerRelation', 'partnerCustomerRelation'],
        ['PartnerCustomerRelationHistory', 'partnerCustomerRelationHistory'],
        ['CustomerHistory', 'customerHistory'], ['OperationalNote', 'operationalNote'],
        ['Order', 'order'], ['Booking', 'booking'], ['Payment', 'payment'],
        ['PartnerStorefront', 'partnerStorefront'], ['Contact', 'contact'],
      ];
      for (const [tbl, accessor] of tables) {
        tx[accessor] = makeModelClient(tbl);
      }
      return fn(tx);
    }),
    customer: makeModelClient('Customer'),
    partner: makeModelClient('Partner'),
    partnerCustomerRelation: makeModelClient('PartnerCustomerRelation'),
    partnerCustomerRelationHistory: makeModelClient('PartnerCustomerRelationHistory'),
    customerHistory: makeModelClient('CustomerHistory'),
    operationalNote: makeModelClient('OperationalNote'),
    order: makeModelClient('Order'),
    booking: makeModelClient('Booking'),
    payment: makeModelClient('Payment'),
    partnerStorefront: makeModelClient('PartnerStorefront'),
    contact: makeModelClient('Contact'),
  } as any;

  return prisma;
}

function buildService() {
  const store = new MockStore();
  store.insert('Partner', { id: 'partner-a', name: 'Partner Alpha', status: 'ACTIVE', code: 'PAR-001' });
  store.insert('Partner', { id: 'partner-b', name: 'Partner Beta', status: 'ACTIVE', code: 'PAR-002' });

  const prisma = buildMockPrisma(store);
  let codeSeq = 0;
  const ids = { nextCode: jest.fn(async (_tx: any, prefix: string) => { codeSeq++; return `${prefix}-${String(codeSeq).padStart(8, '0')}`; }) } as any;
  const eventBus = { emit: jest.fn(), publishPending: jest.fn() } as any;
  const service = new CrmService(prisma, ids, eventBus);
  return { service, prisma, store, eventBus, ids };
}

function buildProService() {
  const { service, store, ...rest } = buildService();
  store.insert('PartnerStorefront', { id: 'ps-1', partnerId: 'partner-a', status: 'ACTIVE', entitlementStatus: 'ACTIVE' });
  return { service, store, ...rest };
}

describe('Step 3.5C — CRM Intake Service', () => {
  describe('Scenario A: new identity + Partner A', () => {
    it('creates Customer and PCR via platformIntakeCustomer', async () => {
      const { service, store } = buildService();
      const result = await service.platformIntakeCustomer('partner-a', {
        firstName: 'Marie', lastName: 'Park', email: 'marie.park@example.com',
        phone: '+994501234567', leadSource: 'PHONE', lifecycle: 'LEAD',
      }, 'admin');

      expect(result.customerCreated).toBe(true);
      expect(result.relationCreated).toBe(true);
      expect(result.customerId).toBeDefined();
      expect(result.relationId).toBeDefined();
      expect(result.partnerName).toBe('Partner Alpha');
      expect(store.count('Customer')).toBe(1);
      expect(store.count('PartnerCustomerRelation')).toBe(1);

      const customer = store.findFirst('Customer', (d) => d.email === 'marie.park@example.com');
      expect(customer.firstName).toBe('Marie');
      expect(customer.status).toBe('ACTIVE');

      const pcr = store.findFirst('PartnerCustomerRelation', () => true);
      expect(pcr.partnerId).toBe('partner-a');
      expect(pcr.leadSource).toBe('PHONE');
      expect(pcr.lifecycle).toBe('LEAD');
    });
  });

  describe('Scenario B: existing Customer + new Partner', () => {
    it('reuses Customer and creates PCR with new Partner', async () => {
      const { service, store } = buildService();
      const r1 = await service.platformIntakeCustomer('partner-a', { firstName: 'John', email: 'john@example.com' }, 'admin');
      expect(r1.customerCreated).toBe(true);
      expect(r1.relationCreated).toBe(true);

      const r2 = await service.platformIntakeCustomer('partner-b', { firstName: 'John', email: 'john@example.com' }, 'admin');
      expect(r2.customerCreated).toBe(false);
      expect(r2.relationCreated).toBe(true);
      expect(r2.customerId).toBe(r1.customerId);

      expect(store.count('Customer')).toBe(1);
      expect(store.count('PartnerCustomerRelation')).toBe(2);
    });
  });

  describe('Scenario C: existing Customer + same Partner repeat', () => {
    it('reuses both Customer and PCR', async () => {
      const { service, store } = buildService();
      const r1 = await service.platformIntakeCustomer('partner-a', { firstName: 'Jane', email: 'jane@example.com' }, 'admin');
      const r2 = await service.platformIntakeCustomer('partner-a', { firstName: 'Jane', email: 'jane@example.com' }, 'admin');

      expect(r2.customerCreated).toBe(false);
      expect(r2.relationCreated).toBe(false);
      expect(r2.customerId).toBe(r1.customerId);
      expect(r2.relationId).toBe(r1.relationId);
      expect(store.count('Customer')).toBe(1);
      expect(store.count('PartnerCustomerRelation')).toBe(1);
    });
  });

  describe('Scenario D: multi-partner isolation', () => {
    it('creates separate PCRs for same Customer across different Partners', async () => {
      const { service, store } = buildService();
      const rA = await service.platformIntakeCustomer('partner-a', { firstName: 'Alex', email: 'alex@example.com', leadSource: 'PHONE' }, 'admin');
      const rB = await service.platformIntakeCustomer('partner-b', { firstName: 'Alex', email: 'alex@example.com', leadSource: 'OFFICE' }, 'admin');

      expect(rA.customerId).toBe(rB.customerId);
      expect(rA.relationId).not.toBe(rB.relationId);
      expect(store.count('Customer')).toBe(1);
      expect(store.count('PartnerCustomerRelation')).toBe(2);

      const pcrA = store.findFirst('PartnerCustomerRelation', (d) => d.partnerId === 'partner-a');
      const pcrB = store.findFirst('PartnerCustomerRelation', (d) => d.partnerId === 'partner-b');
      expect(pcrA.leadSource).toBe('PHONE');
      expect(pcrB.leadSource).toBe('OFFICE');
    });
  });

  describe('Scenario E: sequential retries are idempotent', () => {
    it('no duplicate Customer or PCR on repeated intake', async () => {
      const { service, store } = buildService();
      for (let i = 0; i < 5; i++) {
        await service.platformIntakeCustomer('partner-a', { email: 'retry@example.com', firstName: 'Retry' }, 'admin');
      }
      expect(store.count('Customer')).toBe(1);
      expect(store.count('PartnerCustomerRelation')).toBe(1);
    });
  });

  describe('Validation', () => {
    it('fails if partner does not exist', async () => {
      const { service } = buildService();
      await expect(
        service.platformIntakeCustomer('nonexistent', { email: 'test@example.com' }, 'admin'),
      ).rejects.toThrow('not found');
    });

    it('normalizes email before matching', async () => {
      const { service, store } = buildService();
      await service.platformIntakeCustomer('partner-a', { email: '  Test@Example.COM  ' }, 'admin');
      await service.platformIntakeCustomer('partner-a', { email: 'test@example.com' }, 'admin');
      expect(store.count('Customer')).toBe(1);
      expect(store.count('PartnerCustomerRelation')).toBe(1);
    });

    it('creates initial note when customerCreated', async () => {
      const { service, store } = buildService();
      const result = await service.platformIntakeCustomer('partner-a', { email: 'note@example.com', initialNote: 'Important lead' }, 'admin');
      expect(result.customerCreated).toBe(true);
      expect(result.initialNote).toBeDefined();
      const notes = store.findMany('OperationalNote', (d) => d.entityId === result.customerId);
      expect(notes.length).toBe(1);
      expect(notes[0].text).toBe('Important lead');
    });

    it('does NOT create initial note on PCR reuse', async () => {
      const { service } = buildService();
      await service.platformIntakeCustomer('partner-a', { email: 'exist@example.com' }, 'admin');
      const r2 = await service.platformIntakeCustomer('partner-a', { email: 'exist@example.com', initialNote: 'Nope' }, 'admin');
      expect(r2.customerCreated).toBe(false);
      expect(r2.initialNote).toBeNull();
    });
  });

  describe('Partner-context intake (intakePartnerCustomer)', () => {
    it('reuses existing PCR instead of throwing ConflictError', async () => {
      const { service, store } = buildProService();
      const r1 = await service.intakePartnerCustomer(
        { partnerId: 'partner-a' }, { firstName: 'Test', email: 'reuse@example.com', leadSource: 'DIRECT' }, 'user1',
      );
      expect(r1.relationCreated).toBe(true);

      const r2 = await service.intakePartnerCustomer(
        { partnerId: 'partner-a' }, { firstName: 'Test', email: 'reuse@example.com', leadSource: 'MARKETPLACE' }, 'user1',
      );
      expect(r2.relationCreated).toBe(false);
      expect(r2.relationId).toBe(r1.relationId);
      expect(store.count('Customer')).toBe(1);
      expect(store.count('PartnerCustomerRelation')).toBe(1);
    });

    it('rejects non-PRO tier', async () => {
      const { service } = buildService(); // No PartnerStorefront seeded → BASIC
      await expect(
        service.intakePartnerCustomer({ partnerId: 'partner-a' }, { email: 'test@example.com' }, 'user1'),
      ).rejects.toThrow('Storefront Pro');
    });
  });
});
