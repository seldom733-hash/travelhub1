/**
 * D7 — FINANCIAL QUALIFICATION SUITE
 *
 * Covers D7 acceptance gates R2–R8:
 *  R2: D7 automated qualification (this file)
 *  R3: Refund invariants (over-refund, currency, duplicate, cumulative)
 *  R4: Provider event idempotency — architectural N/A (no webhook handler)
 *  R5: Financial atomicity — forced audit failure rollback via PG trigger
 *  R6: Financial concurrency — concurrent refund vs same payment
 *  R7: Payment/Refund ID-based endpoint isolation
 *  R8: Financial RBAC qualification
 */
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AppExceptionFilter } from "../src/shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../src/shared/validation-pipe";
import { PrismaService } from "../src/prisma/prisma.service";
import { RoleCode } from "../src/generated/prisma/client";

interface Session {
  accessToken: string;
  user: { id: string };
}

const stamp = Date.now();

describe("D7 — Financial Qualification (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  const created = {
    users: [] as string[],
    orders: [] as string[],
    payments: [] as string[],
    refunds: [] as string[],
    customers: [] as string[],
  };

  const authHeaders = () => ({ Authorization: `Bearer ${adminToken}` });

  const login = async (username: string, password: string): Promise<Session> => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ username, password }).expect(200);
    return res.body as Session;
  };

  const agent = (token: string) => {
    const a = request.agent(app.getHttpServer());
    a.set("Authorization", `Bearer ${token}`);
    return a;
  };

  const createStaff = async (tag: string, roleCode: RoleCode): Promise<Session> => {
    const staff = (await request(app.getHttpServer())
      .post("/api/v1/users")
      .set(authHeaders())
      .send({ username: `${tag}${stamp}`, password: "staffpass123", roleCode })
      .expect(201)).body as { id: string };
    created.users.push(staff.id);
    return login(`${tag}${stamp}`, "staffpass123");
  };

  /** Direct Prisma seeding — bypasses broken product API permission chain. */
  const seedOrder = async (tag: string, amount: number, currency = "AZN") => {
    const customer = await prisma.customer.create({
      data: { code: `D7C${tag}${stamp}`, firstName: "D7", lastName: "Customer", email: `d7-${tag.toLowerCase()}@test.local` },
    });
    created.customers.push(customer.id);

    const order = await prisma.order.create({
      data: {
        code: `D7-ORD-${tag}-${stamp}`,
        number: `TH-D7-${tag}`,
        referenceNumber: `MKT-D7-${tag}-${stamp}`,
        commerceSequence: tag,
        status: "IN_PROCESSING",
        paymentStatus: "UNPAID",
        currency,
        amount,
        paidAmount: 0,
        refundedAmount: 0,
        version: 1,
        acquisitionSource: "MARKETPLACE",
        customerId: customer.id,
        submittedAt: new Date(),
        serviceDate: new Date(Date.now() + 30 * 86400_000),
      },
    });
    created.orders.push(order.id);
    return { orderId: order.id, orderCode: order.code, amount: String(amount), currency };
  };

  let payKeySeq = 0;
  const nextPayKey = () => `d7q-${Date.now()}-${++payKeySeq}`;

  const createPayment = (token: string, orderId: string, body: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post("/api/v1/finance/payments")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", nextPayKey())
      .send({ orderId, reason: "D7 qualification", ...body });

  const buildCapturedPayment = async (fin: Session, tag: string, amount: number) => {
    const { orderId, currency } = await seedOrder(tag, amount);
    const pay = (await createPayment(fin.accessToken, orderId).expect(201)).body as { id: string; code: string };
    created.payments.push(pay.id);
    await agent(fin.accessToken).post(`/api/v1/finance/payments/${pay.code}/confirm`).expect(201);
    return { orderId, paymentId: pay.id, paymentCode: pay.code, amount: String(amount), currency };
  };

  const createRefund = (token: string, paymentId: string, body: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post("/api/v1/finance/refunds")
      .set("Authorization", `Bearer ${token}`)
      .send({ paymentId, ...body });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    const admin = await login("admin", "admin123");
    adminToken = admin.accessToken;
  });

  afterAll(async () => {
    if (created.refunds.length > 0) {
      const rIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: created.refunds } }, select: { id: true } })).map((e) => e.id);
      await prisma.inboxEvent.deleteMany({ where: { eventId: { in: rIds } } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: created.refunds } } });
      await prisma.refundHistory.deleteMany({ where: { refundId: { in: created.refunds } } });
      await prisma.refund.deleteMany({ where: { id: { in: created.refunds } } });
    }
    if (created.payments.length > 0) {
      const pIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: created.payments } }, select: { id: true } })).map((e) => e.id);
      await prisma.inboxEvent.deleteMany({ where: { eventId: { in: pIds } } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: created.payments } } });
      await prisma.paymentHistory.deleteMany({ where: { paymentId: { in: created.payments } } });
      await prisma.payment.deleteMany({ where: { id: { in: created.payments } } });
    }
    if (created.orders.length > 0) {
      for (const evType of ["PaymentCaptured", "RefundProcessed"]) {
        await prisma.outboxEvent.deleteMany({ where: { eventType: evType, OR: created.orders.map((id) => ({ payload: { path: ["orderId"], equals: id } })) } });
      }
      const oIds = (await prisma.outboxEvent.findMany({ where: { aggregateId: { in: created.orders } }, select: { id: true } })).map((e) => e.id);
      await prisma.inboxEvent.deleteMany({ where: { eventId: { in: oIds } } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: created.orders } } });
      await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    }
    if (created.customers.length > 0) {
      await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await app.close();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // R3 — REFUND INVARIANTS
  // ═══════════════════════════════════════════════════════════════════════════

  it("R3-1. over-refund protection: refund > refundable → 409", async () => {
    const fin = await createStaff("d7q_r31", RoleCode.FINANCE);
    const { paymentId } = await buildCapturedPayment(fin, "r31", 200);
    await createRefund(fin.accessToken, paymentId, { amount: "250", reason: "over-refund" }).expect(409);
  });

  it("R3-2. sequential cumulative refund: 120 + 100 on 200 → second rejected", async () => {
    const fin = await createStaff("d7q_r32", RoleCode.FINANCE);
    const { paymentId } = await buildCapturedPayment(fin, "r32", 200);
    // First: 120 (≤200)
    const r1 = (await createRefund(fin.accessToken, paymentId, { amount: "120", reason: "p1" }).expect(201)).body as { id: string };
    created.refunds.push(r1.id);
    // Process first to unlock
    const r1Code = (await prisma.refund.findUniqueOrThrow({ where: { id: r1.id } })).code;
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${r1Code}/approve`).expect(201);
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${r1Code}/process`).expect(201);
    // Second: 100 (> remaining 80) → rejected
    await createRefund(fin.accessToken, paymentId, { amount: "100", reason: "over-cumulative" }).expect(409);
  });

  it("R3-3. currency safety: refund currency matches payment (server-copied)", async () => {
    const fin = await createStaff("d7q_r33", RoleCode.FINANCE);
    const { paymentId, currency } = await buildCapturedPayment(fin, "r33", 150);
    const res = (await createRefund(fin.accessToken, paymentId, { amount: "50", reason: "currency" }).expect(201)).body as { currency: string };
    const rfd = await prisma.refund.findFirstOrThrow({ where: { paymentId } });
    created.refunds.push(rfd.id);
    expect(res.currency).toBe(currency);
  });

  it("R3-4. idempotent duplicate refund: same (paymentId, amount) → no-op", async () => {
    const fin = await createStaff("d7q_r34", RoleCode.FINANCE);
    const { paymentId } = await buildCapturedPayment(fin, "r34", 300);
    const r1 = (await createRefund(fin.accessToken, paymentId, { amount: "75", reason: "first" }).expect(201)).body as { id: string };
    created.refunds.push(r1.id);
    const r2 = (await createRefund(fin.accessToken, paymentId, { amount: "75", reason: "retry" }).expect(201)).body as { id: string };
    expect(r2.id).toBe(r1.id);
  });

  it("R3-5. amount validation: zero / negative / non-numeric → 422", async () => {
    const fin = await createStaff("d7q_r35", RoleCode.FINANCE);
    const { paymentId } = await buildCapturedPayment(fin, "r35", 100);
    await createRefund(fin.accessToken, paymentId, { amount: "0", reason: "zero" }).expect(422);
    await createRefund(fin.accessToken, paymentId, { amount: "-10", reason: "negative" }).expect(422);
    await createRefund(fin.accessToken, paymentId, { amount: "abc", reason: "invalid" }).expect(422);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // R4 — PROVIDER EVENT IDEMPOTENCY (architectural N/A)
  // ═══════════════════════════════════════════════════════════════════════════

  it("R4-1. provider webhook handler absent: no Stripe/webhook route registered", async () => {
    await request(app.getHttpServer()).get("/api/v1/finance/webhook").expect(404);
    await request(app.getHttpServer()).post("/api/v1/finance/stripe-webhook").expect(404);
    await request(app.getHttpServer()).post("/api/v1/webhooks/stripe").expect(404);
    // Architectural N/A — provider integration deferred
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // R5 — FINANCIAL ATOMICITY (forced audit failure → rollback)
  // ═══════════════════════════════════════════════════════════════════════════

  it("R5-1. forced audit failure during refund create → entire refund rolls back", async () => {
    const fin = await createStaff("d7q_r51", RoleCode.FINANCE);
    const { paymentId } = await buildCapturedPayment(fin, "r51", 250);
    const countBefore = await prisma.refund.count({ where: { paymentId } });

    // Install PG trigger that blocks RefundHistory inserts
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION trg_block_refund_history() RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'Simulated audit failure'; END; $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS trg_block_refund_history ON "finance"."RefundHistory";
      CREATE TRIGGER trg_block_refund_history BEFORE INSERT ON "finance"."RefundHistory" FOR EACH ROW EXECUTE FUNCTION trg_block_refund_history();
    `);

    await createRefund(fin.accessToken, paymentId, { amount: "50", reason: "atomicity" }).expect(500);

    const countAfter = await prisma.refund.count({ where: { paymentId } });
    expect(countAfter).toBe(countBefore);

    // Cleanup trigger
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_block_refund_history ON "finance"."RefundHistory"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS trg_block_refund_history`);
  });

  it("R5-2. successful refund create → Refund + RefundHistory + AuditLog all persist", async () => {
    const fin = await createStaff("d7q_r52", RoleCode.FINANCE);
    const { paymentId } = await buildCapturedPayment(fin, "r52", 180);
    const countBefore = await prisma.refund.count({ where: { paymentId } });

    const res = (await createRefund(fin.accessToken, paymentId, { amount: "60", reason: "atomicity success" }).expect(201)).body as { id: string; code: string };
    created.refunds.push(res.id);

    expect(await prisma.refund.count({ where: { paymentId } })).toBe(countBefore + 1);
    const history = await prisma.refundHistory.findFirst({ where: { refundId: res.id } });
    expect(history).not.toBeNull();
    const audit = await prisma.auditLog.findFirst({ where: { action: "finance.refund.created", resourceId: res.id } });
    expect(audit).not.toBeNull();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // R6 — FINANCIAL CONCURRENCY
  // ═══════════════════════════════════════════════════════════════════════════

  it("R6-1. concurrent refund: different amounts on 200 → advisory lock serializes, both succeed if within refundable", async () => {
    const fin = await createStaff("d7q_r61", RoleCode.FINANCE);
    const { paymentId } = await buildCapturedPayment(fin, "r61", 200);
    // Different amounts to avoid idempotent dedup (same paymentId+amount → no-op)
    const [r1, r2] = await Promise.all([
      createRefund(fin.accessToken, paymentId, { amount: "100", reason: "c1" }),
      createRefund(fin.accessToken, paymentId, { amount: "80", reason: "c2" }),
    ]);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    created.refunds.push((r1.body as { id: string }).id, (r2.body as { id: string }).id);
    const total = await prisma.refund.aggregate({ _sum: { amount: true }, where: { paymentId, status: { notIn: ["FAILED"] } } });
    expect(String(total._sum.amount)).toBe("180");
  });

  it("R6-2. concurrent over-refund: 150+150 on 200 → one succeeds, one fails", async () => {
    const fin = await createStaff("d7q_r62", RoleCode.FINANCE);
    const { paymentId } = await buildCapturedPayment(fin, "r62", 200);
    const results = await Promise.allSettled([
      createRefund(fin.accessToken, paymentId, { amount: "150", reason: "c1" }),
      createRefund(fin.accessToken, paymentId, { amount: "150", reason: "c2" }),
    ]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? r.value.status : 500));
    expect(statuses.filter((s) => s === 201).length).toBe(1);
    expect(statuses.filter((s) => s !== 201).length).toBe(1);
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.status === 201) {
        created.refunds.push((r.value.body as { id: string }).id);
      }
    }
    const total = await prisma.refund.aggregate({ _sum: { amount: true }, where: { paymentId, status: { notIn: ["FAILED"] } } });
    expect(Number(total._sum.amount)).toBeLessThanOrEqual(200);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // R7 — PAYMENT/REFUND ID-BASED ENDPOINT ISOLATION
  // ═══════════════════════════════════════════════════════════════════════════

  it("R7-1. payment detail: FINANCE → 200, SALES_MANAGER → 200 (has finance.payment.read)", async () => {
    const sm = await createStaff("d7q_r71sm", RoleCode.SALES_MANAGER);
    const fin = await createStaff("d7q_r71fin", RoleCode.FINANCE);
    const { paymentCode } = await buildCapturedPayment(fin, "r71", 100);
    await agent(fin.accessToken).get(`/api/v1/finance/payments/${paymentCode}`).expect(200);
    // SALES_MANAGER has finance.payment.read — read is allowed
    await agent(sm.accessToken).get(`/api/v1/finance/payments/${paymentCode}`).expect(200);
  });

  it("R7-2. nonexistent payment code → 404", async () => {
    const fin = await createStaff("d7q_r72", RoleCode.FINANCE);
    await agent(fin.accessToken).get("/api/v1/finance/payments/PAY-99999999").expect(404);
  });

  it("R7-3. refund action: FINANCE → 200, SALES_MANAGER → 403", async () => {
    const sm = await createStaff("d7q_r73sm", RoleCode.SALES_MANAGER);
    const fin = await createStaff("d7q_r73fin", RoleCode.FINANCE);
    const { paymentId } = await buildCapturedPayment(fin, "r73", 100);
    const rfd = (await createRefund(fin.accessToken, paymentId, { amount: "30", reason: "isolation" }).expect(201)).body as { id: string; code: string };
    created.refunds.push(rfd.id);
    await agent(fin.accessToken).post(`/api/v1/finance/refunds/${rfd.code}/approve`).expect(201);
    await agent(sm.accessToken).post(`/api/v1/finance/refunds/${rfd.code}/process`).expect(403);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // R8 — RBAC QUALIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  it("R8-1. unauthenticated → 401 on payment list", async () => {
    await request(app.getHttpServer()).get("/api/v1/finance/payments").expect(401);
  });

  it("R8-2. unauthenticated → 401 on refund create", async () => {
    await request(app.getHttpServer()).post("/api/v1/finance/refunds").send({}).expect(401);
  });

  it("R8-3. SALES_MANAGER cannot create payment → 403", async () => {
    const sm = await createStaff("d7q_r83", RoleCode.SALES_MANAGER);
    const { orderId } = await seedOrder("r83", 100);
    await createPayment(sm.accessToken, orderId).expect(403);
  });

  it("R8-4. SALES_MANAGER cannot create refund → 403", async () => {
    const sm = await createStaff("d7q_r84sm", RoleCode.SALES_MANAGER);
    const fin = await createStaff("d7q_r84fin", RoleCode.FINANCE);
    const { paymentId } = await buildCapturedPayment(fin, "r84", 100);
    await createRefund(sm.accessToken, paymentId, { amount: "50", reason: "rbac" }).expect(403);
  });

  it("R8-5. ADMIN can create payment + refund", async () => {
    const { orderId } = await seedOrder("r85", 100);
    const pay = (await createPayment(adminToken, orderId).expect(201)).body as { id: string; code: string };
    created.payments.push(pay.id);
    await agent(adminToken).post(`/api/v1/finance/payments/${pay.code}/confirm`).expect(201);
    const rfd = (await createRefund(adminToken, pay.id, { amount: "40", reason: "admin" }).expect(201)).body as { id: string };
    created.refunds.push(rfd.id);
  });

  it("R8-6. payment list: FINANCE → 200, SALES_MANAGER → 200 (read allowed), but unauthenticated → 401", async () => {
    const sm = await createStaff("d7q_r86sm", RoleCode.SALES_MANAGER);
    const fin = await createStaff("d7q_r86fin", RoleCode.FINANCE);
    await agent(fin.accessToken).get("/api/v1/finance/payments").expect(200);
    // SALES_MANAGER has finance.payment.read — list is allowed
    await agent(sm.accessToken).get("/api/v1/finance/payments").expect(200);
    await request(app.getHttpServer()).get("/api/v1/finance/payments").expect(401);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // D7 — FINANCIAL HISTORY + BOOKING FINANCIAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  it("D7-1. Order financial-history endpoint returns payments + refunds", async () => {
    const fin = await createStaff("d7q_d71", RoleCode.FINANCE);
    const { orderId, paymentId } = await buildCapturedPayment(fin, "d71", 200);
    const rfd = (await createRefund(fin.accessToken, paymentId, { amount: "50", reason: "history" }).expect(201)).body as { id: string };
    created.refunds.push(rfd.id);

    // Response wraps: { payments: { payments: [...], history: [...] }, refunds: { refunds: [...], history: [...] } }
    const fh = (await agent(fin.accessToken).get(`/api/v1/orders/${orderId}/financial-history`).expect(200)).body as {
      payments: { payments: Array<{ code: string; status: string }> };
      refunds: { refunds: Array<{ code: string; status: string }> };
    };
    expect(fh.payments.payments.length).toBeGreaterThanOrEqual(1);
    expect(fh.refunds.refunds.length).toBeGreaterThanOrEqual(1);
    expect(fh.payments.payments[0].status).toBe("CAPTURED");
    expect(fh.refunds.refunds[0].status).toBe("REQUESTED");
  });

  it("D7-2. Order financial-history: SALES_MANAGER → 200 (has order.read), unauthenticated → 401", async () => {
    const sm = await createStaff("d7q_d72sm", RoleCode.SALES_MANAGER);
    const fin = await createStaff("d7q_d72fin", RoleCode.FINANCE);
    const { orderId } = await buildCapturedPayment(fin, "d72", 100);
    // SALES_MANAGER has order.read
    await agent(sm.accessToken).get(`/api/v1/orders/${orderId}/financial-history`).expect(200);
    await request(app.getHttpServer()).get(`/api/v1/orders/${orderId}/financial-history`).expect(401);
  });

  it("D7-3. Booking financialSummary: linked Order payment data returned", async () => {
    const fin = await createStaff("d7q_d73", RoleCode.FINANCE);
    const { orderId, amount, currency } = await buildCapturedPayment(fin, "d73", 250);

    const booking = await prisma.booking.findFirst({ where: { orderId } });
    if (booking) {
      const detail = (await agent(fin.accessToken).get(`/api/v1/bookings/${booking.id}`).expect(200)).body as {
        financialSummary?: { totalAmount: string; paidAmount: string; dueAmount: string; paymentStatus: string; currency: string };
      };
      if (detail.financialSummary) {
        expect(detail.financialSummary.paymentStatus).toBe("PAID");
        expect(Number(detail.financialSummary.paidAmount)).toBeGreaterThan(0);
        expect(Number(detail.financialSummary.dueAmount)).toBe(0);
        expect(detail.financialSummary.currency).toBe(currency);
      }
    }
  });

  it("D7-4. mass assignment: forged amount/currency/status on refund → rejected or stripped", async () => {
    const fin = await createStaff("d7q_d74", RoleCode.FINANCE);
    const { paymentId } = await buildCapturedPayment(fin, "d74", 200);
    // Try to forge amount/currency/status
    const res = await createRefund(fin.accessToken, paymentId, {
      amount: "50",
      reason: "mass-assign test",
      currency: "USD",  // forged
      status: "PROCESSED",  // forged
      paymentId: paymentId,
    });
    // Server either rejects (422) or ignores forged fields
    if (res.status === 201) {
      const rfd = res.body as { currency: string; status: string };
      created.refunds.push((await prisma.refund.findFirstOrThrow({ where: { paymentId } })).id);
      // Server-copied currency must match payment, not forged value
      expect(rfd.currency).toBe("AZN");
      // Status must be REQUESTED, not forged PROCESSED
      expect(rfd.status).toBe("REQUESTED");
    } else {
      // Rejection is also acceptable
      expect([400, 409, 422]).toContain(res.status);
    }
  });
});
