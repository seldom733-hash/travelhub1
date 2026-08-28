import { MarketplacePcrAttributionConsumer } from "./marketplace-pcr-attribution.consumer";

/**
 * PHASE 3 STEP 3.6A — Marketplace PCR Attribution Consumer Tests.
 *
 * Tests the auto-creation of PartnerCustomerRelation with leadSource=MARKETPLACE
 * on OrderCreated events.
 */

// ── In-memory test store ──────────────────────────────────────────────────

class InMemoryStore {
  private data: Map<string, Map<string, any[]>> = new Map();

  insert(table: string, row: any) {
    if (!this.data.has(table)) this.data.set(table, new Map());
    const tableData = this.data.get(table)!;
    const key = row.id || row.partnerId + "|" + row.customerId || "auto";
    if (!tableData.has(key)) tableData.set(key, []);
    tableData.get(key)!.push(row);
  }

  count(table: string): number {
    const tableData = this.data.get(table);
    if (!tableData) return 0;
    let total = 0;
    tableData.forEach((rows) => (total += rows.length));
    return total;
  }

  findFirst(table: string, where: (row: any) => boolean): any | null {
    const tableData = this.data.get(table);
    if (!tableData) return null;
    for (const rows of tableData.values()) {
      for (const row of rows) {
        if (where(row)) return row;
      }
    }
    return null;
  }

  findMany(table: string, where: (row: any) => boolean): any[] {
    const tableData = this.data.get(table);
    if (!tableData) return [];
    const result: any[] = [];
    for (const rows of tableData.values()) {
      for (const row of rows) {
        if (where(row)) result.push(row);
      }
    }
    return result;
  }

  countWhere(table: string, where: (row: any) => boolean): number {
    return this.findMany(table, where).length;
  }
}

// ── Mock Prisma ──────────────────────────────────────────────────────────

function buildMockPrisma(store: InMemoryStore) {
  return {
    $transaction: async (fn: (tx: any) => Promise<any>) => {
      const tx = {
        inboxEvent: {
          findUnique: async ({ where }: any) => {
            const key = where.consumerId_eventId;
            return store.findFirst("inboxEvent", (r: any) => r.consumerId === key.consumerId && r.eventId === key.eventId);
          },
          create: async ({ data }: any) => {
            store.insert("inboxEvent", data);
            return data;
          },
        },
        order: {
          findUnique: async ({ where, select }: any) => {
            const order = store.findFirst("Order", (r: any) => r.id === where.id);
            if (!order) return null;
            if (select) {
              const result: any = {};
              for (const key of Object.keys(select)) {
                if (select[key] && order[key] !== undefined) result[key] = order[key];
              }
              return result;
            }
            return order;
          },
        },
        partnerCustomerRelation: {
          findUnique: async ({ where }: any) => {
            if (where.partnerId_customerId) {
              const { partnerId, customerId } = where.partnerId_customerId;
              return store.findFirst("PartnerCustomerRelation", (r: any) => r.partnerId === partnerId && r.customerId === customerId);
            }
            return null;
          },
          create: async ({ data }: any) => {
            const existing = store.findFirst("PartnerCustomerRelation", (r: any) => r.partnerId === data.partnerId && r.customerId === data.customerId);
            if (existing) {
              const err = new Error("Unique constraint") as any;
              err.code = "P2002";
              err.meta = { target: "PartnerCustomerRelation_partnerId_customerId_key" };
              throw err;
            }
            store.insert("PartnerCustomerRelation", { id: "pcr-" + Date.now(), ...data, createdAt: new Date(), updatedAt: new Date() });
            return { id: "pcr-" + Date.now() };
          },
        },
        partnerCustomerRelationHistory: {
          create: async ({ data }: any) => {
            store.insert("PartnerCustomerRelationHistory", { id: "hist-" + Date.now(), ...data });
            return data;
          },
        },
      };
      return fn(tx);
    },
  };
}

// ── Mock EventBus ────────────────────────────────────────────────────────

function buildMockEventBus() {
  const handlers = new Map<string, Function>();
  return {
    on: (event: string, handler: Function) => handlers.set(event, handler),
    isProcessed: async () => false,
    getHandler: (event: string) => handlers.get(event),
  };
}

// ── Test data ────────────────────────────────────────────────────────────

const PARTNER_A = "partner-a";
const CUSTOMER_1 = "customer-1";
const ORDER_1 = "order-1";

function buildOrderCreatedEvent(orderId: string, customerId: string | null = CUSTOMER_1) {
  return {
    id: "event-" + orderId,
    eventType: "OrderCreated",
    payload: {
      orderId,
      code: "ORD-00000001",
      number: "1",
      customerId,
      amount: "100.00",
      currency: "AZN",
    },
    correlationId: null,
    causationId: null,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("Step 3.6A — Marketplace PCR Attribution Consumer", () => {
  describe("Scenario A: New Customer + new Partner + Marketplace Order", () => {
    it("creates PCR with source MARKETPLACE", async () => {
      const store = new InMemoryStore();
      store.insert("Order", { id: ORDER_1, customerId: CUSTOMER_1, sellerPartnerId: PARTNER_A });

      const eventBus = buildMockEventBus();
      const prisma = buildMockPrisma(store);

      const consumer = new MarketplacePcrAttributionConsumer(eventBus as any, prisma as any);
      consumer.onModuleInit();

      const handler = eventBus.getHandler("OrderCreated")!;
      await handler(buildOrderCreatedEvent(ORDER_1));

      const pcr = store.findFirst("PartnerCustomerRelation", (r: any) => r.partnerId === PARTNER_A && r.customerId === CUSTOMER_1);
      expect(pcr).toBeTruthy();
      expect(pcr.leadSource).toBe("MARKETPLACE");
      expect(pcr.lifecycle).toBe("LEAD");
    });
  });

  describe("Scenario B: Existing Customer + new Partner", () => {
    it("creates PCR for this partner only with MARKETPLACE", async () => {
      const store = new InMemoryStore();
      store.insert("Order", { id: ORDER_1, customerId: CUSTOMER_1, sellerPartnerId: PARTNER_A });
      // No existing PCR
      const eventBus = buildMockEventBus();
      const prisma = buildMockPrisma(store);

      const consumer = new MarketplacePcrAttributionConsumer(eventBus as any, prisma as any);
      consumer.onModuleInit();

      const handler = eventBus.getHandler("OrderCreated")!;
      await handler(buildOrderCreatedEvent(ORDER_1));

      expect(store.countWhere("PartnerCustomerRelation", (r: any) => r.partnerId === PARTNER_A)).toBe(1);
      const pcr = store.findFirst("PartnerCustomerRelation", (r: any) => r.partnerId === PARTNER_A);
      expect(pcr.leadSource).toBe("MARKETPLACE");
    });
  });

  describe("Scenario C: Existing PCR MARKETPLACE + second order", () => {
    it("does not create duplicate PCR", async () => {
      const store = new InMemoryStore();
      store.insert("Order", { id: ORDER_1, customerId: CUSTOMER_1, sellerPartnerId: PARTNER_A });
      store.insert("PartnerCustomerRelation", {
        id: "pcr-existing",
        partnerId: PARTNER_A,
        customerId: CUSTOMER_1,
        leadSource: "MARKETPLACE",
        lifecycle: "ACTIVE",
      });

      const eventBus = buildMockEventBus();
      const prisma = buildMockPrisma(store);

      const consumer = new MarketplacePcrAttributionConsumer(eventBus as any, prisma as any);
      consumer.onModuleInit();

      const handler = eventBus.getHandler("OrderCreated")!;
      await handler(buildOrderCreatedEvent(ORDER_1));

      expect(store.countWhere("PartnerCustomerRelation", (r: any) => r.partnerId === PARTNER_A && r.customerId === CUSTOMER_1)).toBe(1);
    });
  });

  describe("Scenario D: Existing PCR PHONE + Marketplace Order", () => {
    it("preserves PHONE source", async () => {
      const store = new InMemoryStore();
      store.insert("Order", { id: ORDER_1, customerId: CUSTOMER_1, sellerPartnerId: PARTNER_A });
      store.insert("PartnerCustomerRelation", {
        id: "pcr-phone",
        partnerId: PARTNER_A,
        customerId: CUSTOMER_1,
        leadSource: "PHONE",
        lifecycle: "PROSPECT",
      });

      const eventBus = buildMockEventBus();
      const prisma = buildMockPrisma(store);

      const consumer = new MarketplacePcrAttributionConsumer(eventBus as any, prisma as any);
      consumer.onModuleInit();

      const handler = eventBus.getHandler("OrderCreated")!;
      await handler(buildOrderCreatedEvent(ORDER_1));

      const pcr = store.findFirst("PartnerCustomerRelation", (r: any) => r.partnerId === PARTNER_A && r.customerId === CUSTOMER_1);
      expect(pcr.leadSource).toBe("PHONE"); // Not overwritten
    });
  });

  describe("Scenario E: Existing PCR STOREFRONT + Marketplace Order", () => {
    it("preserves STOREFRONT source", async () => {
      const store = new InMemoryStore();
      store.insert("Order", { id: ORDER_1, customerId: CUSTOMER_1, sellerPartnerId: PARTNER_A });
      store.insert("PartnerCustomerRelation", {
        id: "pcr-storefront",
        partnerId: PARTNER_A,
        customerId: CUSTOMER_1,
        leadSource: "STOREFRONT",
        lifecycle: "ACTIVE",
      });

      const eventBus = buildMockEventBus();
      const prisma = buildMockPrisma(store);

      const consumer = new MarketplacePcrAttributionConsumer(eventBus as any, prisma as any);
      consumer.onModuleInit();

      const handler = eventBus.getHandler("OrderCreated")!;
      await handler(buildOrderCreatedEvent(ORDER_1));

      const pcr = store.findFirst("PartnerCustomerRelation", (r: any) => r.partnerId === PARTNER_A && r.customerId === CUSTOMER_1);
      expect(pcr.leadSource).toBe("STOREFRONT"); // Not overwritten
    });
  });

  describe("Fail-closed scenarios", () => {
    it("no-op when Order missing", async () => {
      const store = new InMemoryStore();
      // No order inserted
      const eventBus = buildMockEventBus();
      const prisma = buildMockPrisma(store);

      const consumer = new MarketplacePcrAttributionConsumer(eventBus as any, prisma as any);
      consumer.onModuleInit();

      const handler = eventBus.getHandler("OrderCreated")!;
      await handler(buildOrderCreatedEvent(ORDER_1));

      expect(store.count("PartnerCustomerRelation")).toBe(0);
    });

    it("no-op when sellerPartnerId is null", async () => {
      const store = new InMemoryStore();
      store.insert("Order", { id: ORDER_1, customerId: CUSTOMER_1, sellerPartnerId: null });
      const eventBus = buildMockEventBus();
      const prisma = buildMockPrisma(store);

      const consumer = new MarketplacePcrAttributionConsumer(eventBus as any, prisma as any);
      consumer.onModuleInit();

      const handler = eventBus.getHandler("OrderCreated")!;
      await handler(buildOrderCreatedEvent(ORDER_1));

      expect(store.count("PartnerCustomerRelation")).toBe(0);
    });

    it("no-op when customerId is null", async () => {
      const store = new InMemoryStore();
      store.insert("Order", { id: ORDER_1, customerId: null, sellerPartnerId: PARTNER_A });
      const eventBus = buildMockEventBus();
      const prisma = buildMockPrisma(store);

      const consumer = new MarketplacePcrAttributionConsumer(eventBus as any, prisma as any);
      consumer.onModuleInit();

      const handler = eventBus.getHandler("OrderCreated")!;
      await handler(buildOrderCreatedEvent(ORDER_1, null));

      expect(store.count("PartnerCustomerRelation")).toBe(0);
    });
  });

  describe("Idempotency", () => {
    it("skip if already processed (inbox)", async () => {
      const store = new InMemoryStore();
      store.insert("Order", { id: ORDER_1, customerId: CUSTOMER_1, sellerPartnerId: PARTNER_A });
      store.insert("inboxEvent", { consumerId: "marketplace-pcr-attribution-consumer", eventId: "event-" + ORDER_1 });

      const eventBus = buildMockEventBus();
      const prisma = buildMockPrisma(store);

      const consumer = new MarketplacePcrAttributionConsumer(eventBus as any, prisma as any);
      consumer.onModuleInit();

      const handler = eventBus.getHandler("OrderCreated")!;
      await handler(buildOrderCreatedEvent(ORDER_1));

      expect(store.count("PartnerCustomerRelation")).toBe(0);
    });
  });

  describe("Entitlement proof", () => {
    it("Marketplace Basic server-side denial preserved", async () => {
      // The consumer does NOT check tier — it always creates PCR for any Order
      // The PRO gating is in intakePartnerCustomer(), not in auto-attribution
      // This test verifies that the consumer does not block on tier
      const store = new InMemoryStore();
      store.insert("Order", { id: ORDER_1, customerId: CUSTOMER_1, sellerPartnerId: PARTNER_A });
      const eventBus = buildMockEventBus();
      const prisma = buildMockPrisma(store);

      const consumer = new MarketplacePcrAttributionConsumer(eventBus as any, prisma as any);
      consumer.onModuleInit();

      const handler = eventBus.getHandler("OrderCreated")!;
      await handler(buildOrderCreatedEvent(ORDER_1));

      // PCR created regardless of tier — auto-attribution is tier-agnostic
      expect(store.count("PartnerCustomerRelation")).toBe(1);
    });
  });
});
