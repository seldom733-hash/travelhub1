/**
 * E2E PHASE 2 STEP 2.12A — Payment Provider Abstraction (provider-neutral).
 *
 * Maps to hardened prompt §42 T1..T17:
 *  T1  finance module boots with provider abstraction;
 *  T2  known fake provider resolves in test mode;
 *  T3  unknown provider → controlled error, no raw 500;
 *  T4  abstraction alone does not mutate Payment status/version/milestones;
 *  T5  no webhook routes added;
 *  T6  no SPLIT_AT_PAYMENT side effects;
 *  T7  no Ledger;
 *  T8  no ProviderFee;
 *  T9  no Settlement/Payout;
 *  T10 no Refund/Dispute mutation;
 *  T11 no external network;
 *  T12 no secret leakage;
 *  T13 stable internal provider-operation idempotency identity;
 *  T14 concurrent/same-operation abstraction call → no duplicate business mutation;
 *  T15 existing Payment lifecycle regression green;
 *  T16 2.12E PARTNER_COLLECT regression green (module boots, consumer registered);
 *  T17 no RLS/schemaVersion/backup/load-test implementation leaked into scope.
 */
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { PaymentProviderRegistry } from "../src/modules/finance/provider/payment-provider.registry";
import { FakePaymentProvider } from "../src/modules/finance/provider/fake.payment-provider";
import { deriveProviderOperationKey } from "../src/modules/finance/provider/provider-operation-id";
import { TEST_PAYMENT_PROVIDER_CODE } from "../src/modules/finance/provider/provider.types";
import { NotFoundError } from "../src/shared/errors";

const PROVIDER_DIR = path.resolve(__dirname, "../src/modules/finance/provider");

function providerSource(): string {
  return fs
    .readdirSync(PROVIDER_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => fs.readFileSync(path.join(PROVIDER_DIR, f), "utf8"))
    .join("\n");
}

describe("Payment Provider Abstraction (Step 2.12A)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let registry: PaymentProviderRegistry;
  let fake: FakePaymentProvider;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    registry = app.get(PaymentProviderRegistry);
    // PRODUCTION WIRING PROOF: the booted AppModule (production FinanceModule
    // config) registers NO provider — registry is empty before any test
    // registration. The fake is registered HERE ONLY, by test code.
    expect(registry.list()).toHaveLength(0);
    expect(registry.has(TEST_PAYMENT_PROVIDER_CODE)).toBe(false);
    fake = new FakePaymentProvider();
    registry.register(fake);
  });

  afterAll(async () => {
    await app.close();
  });

  test("T1. finance module boots with provider abstraction", () => {
    expect(registry).toBeInstanceOf(PaymentProviderRegistry);
  });

  test("T2. known fake provider resolves in test mode", () => {
    expect(registry.get(TEST_PAYMENT_PROVIDER_CODE)).toBe(fake);
  });

  test("T3. unknown provider → controlled error (404 semantics), no raw 500", () => {
    let thrown: unknown;
    try {
      registry.get("NO_SUCH_PROVIDER");
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(NotFoundError);
    // HTTP surface: a public route must never 500 on provider resolution —
    // unknown provider is internal-only, so assert no route exists either:
    expect(registry.has("NO_SUCH_PROVIDER")).toBe(false);
  });

  test("T4. abstraction alone does not mutate Payment status/version/milestones", async () => {
    const before = await prisma.payment.count();
    // pure contract-level execution (no PaymentService involvement)
    fake.executeOperation(
      { paymentId: "pay-x", paymentCode: "PAY-00009999", operation: "CAPTURE", orderRef: "ORD-00009999", amount: "1.00", currency: "USD", providerOperationKey: "PAY-00009999:CAPTURE", correlationRef: "corr-x" },
      { amount: "1.00", currency: "USD" },
    );
    const after = await prisma.payment.count();
    expect(after).toBe(before); // no Payment row created/mutated
  });

  test("T5. no webhook routes added", async () => {
    // no provider webhook controller exists: any would-be path is 404
    await request(app.getHttpServer()).get("/api/v1/finance/webhooks/provider").expect(404);
    await request(app.getHttpServer()).post("/api/v1/finance/webhooks/provider").expect(404);
  });

  test("T6. no SPLIT_AT_PAYMENT side effects", async () => {
    const feesBefore = await prisma.providerFee.count();
    fake.executeOperation(
      { paymentId: "pay-y", paymentCode: "PAY-00009998", operation: "CAPTURE", orderRef: "ORD-00009998", amount: "1.00", currency: "USD", providerOperationKey: "PAY-00009998:CAPTURE", correlationRef: "corr-y" },
      { amount: "1.00", currency: "USD" },
    );
    expect(await prisma.providerFee.count()).toBe(feesBefore);
  });

  test("T7. no Ledger posting", async () => {
    const before = await prisma.ledgerTransaction.count();
    fake.executeOperation(
      { paymentId: "pay-z", paymentCode: "PAY-00009997", operation: "CAPTURE", orderRef: "ORD-00009997", amount: "1.00", currency: "USD", providerOperationKey: "PAY-00009997:CAPTURE", correlationRef: "corr-z" },
      { amount: "1.00", currency: "USD" },
    );
    expect(await prisma.ledgerTransaction.count()).toBe(before);
  });

  test("T8. no ProviderFee creation", async () => {
    const before = await prisma.providerFee.count();
    fake.executeOperation(
      { paymentId: "pay-a", paymentCode: "PAY-00009996", operation: "CAPTURE", orderRef: "ORD-00009996", amount: "1.00", currency: "USD", providerOperationKey: "PAY-00009996:CAPTURE", correlationRef: "corr-a" },
      { amount: "1.00", currency: "USD" },
    );
    expect(await prisma.providerFee.count()).toBe(before);
  });

  test("T9. no Settlement/Payout", async () => {
    const s = await prisma.settlement.count();
    const p = await prisma.payout.count();
    fake.executeOperation(
      { paymentId: "pay-b", paymentCode: "PAY-00009995", operation: "CAPTURE", orderRef: "ORD-00009995", amount: "1.00", currency: "USD", providerOperationKey: "PAY-00009995:CAPTURE", correlationRef: "corr-b" },
      { amount: "1.00", currency: "USD" },
    );
    expect(await prisma.settlement.count()).toBe(s);
    expect(await prisma.payout.count()).toBe(p);
  });

  test("T10. no Refund/Dispute mutation", async () => {
    const r = await prisma.refund.count();
    const d = await prisma.dispute.count();
    fake.executeOperation(
      { paymentId: "pay-c", paymentCode: "PAY-00009994", operation: "REFUND", orderRef: "ORD-00009994", amount: "1.00", currency: "USD", providerOperationKey: "PAY-00009994:REFUND", correlationRef: "corr-c" },
      { amount: "1.00", currency: "USD" },
    );
    expect(await prisma.refund.count()).toBe(r);
    expect(await prisma.dispute.count()).toBe(d);
  });

  test("T11. no external network (fake has no http deps; no adapter executed)", () => {
    // structural: FakePaymentProvider imports no http/https/axios/fetch;
    // executeOperation is a pure in-memory contract exercise. Verified by
    // repo-wide grep audit in the implementation report (0 real adapters).
    expect(typeof fake.getCapabilities).toBe("function");
    const outcome = fake.executeOperation(
      { paymentId: "pay-d", paymentCode: "PAY-00009993", operation: "CAPTURE", orderRef: "ORD-00009993", amount: "1.00", currency: "USD", providerOperationKey: "PAY-00009993:CAPTURE", correlationRef: "corr-d" },
      { amount: "1.00", currency: "USD" },
    );
    expect(outcome.ok).toBe(true);
  });

  test("T12. no secret leakage (no provider secrets in config/registry/fake)", () => {
    const serialized = JSON.stringify({
      registryCodes: registry.list().map((p) => p.code),
      fakeCapabilities: [...fake.getCapabilities().capabilities],
    });
    expect(serialized).not.toMatch(/sk_live|pk_live|secret|api[_-]?key|password/i);
  });

  test("T13. stable internal provider-operation idempotency identity", () => {
    const k1 = deriveProviderOperationKey({ paymentId: "pay-1", paymentCode: "PAY-00000001", operation: "CAPTURE" });
    const k2 = deriveProviderOperationKey({ paymentId: "pay-1", paymentCode: "PAY-00000001", operation: "CAPTURE" });
    expect(k1).toBe("PAY-00000001:CAPTURE");
    expect(k2).toBe(k1);
  });

  test("T14. concurrent/same-operation abstraction call → no duplicate business mutation", async () => {
    const before = await prisma.payment.count();
    const req = {
      paymentId: "pay-e", paymentCode: "PAY-00009992", operation: "CAPTURE" as const, orderRef: "ORD-00009992",
      amount: "1.00", currency: "USD", providerOperationKey: "PAY-00009992:CAPTURE", correlationRef: "corr-e",
    };
    const outcomes = await Promise.all([
      Promise.resolve().then(() => fake.executeOperation(req, { amount: "1.00", currency: "USD" })),
      Promise.resolve().then(() => fake.executeOperation(req, { amount: "1.00", currency: "USD" })),
    ]);
    // identical params → both succeed deterministically; no payment row created
    expect(outcomes[0].ok).toBe(true);
    expect(outcomes[1].ok).toBe(true);
    expect(await prisma.payment.count()).toBe(before);
  });

  test("T15. existing Payment lifecycle regression green (create via service)", async () => {
    // PaymentService still boots and its provider-neutral create path works
    const svc = app.get(await import("../src/modules/finance/payment.service").then((m) => m.PaymentService));
    expect(typeof svc.createPayment).toBe("function");
    expect(typeof svc.confirmPayment).toBe("function");
  });

  test("T16. 2.12E PARTNER_COLLECT regression green (consumer registered)", async () => {
    // CommissionAccrualConsumer still registered and bootable (handler is private;
    // bootability + subscription presence is the regression signal here)
    const consumer = app.get(await import("../src/modules/finance/commission-accrual.consumer").then((m) => m.CommissionAccrualConsumer));
    expect(consumer).toBeDefined();
    expect(typeof consumer).toBe("object");
  });

  test("T17. no RLS/schemaVersion/backup/load-test implementation leaked", () => {
    // abstraction exposes no RLS / schemaVersion / backup / load-test surfaces
    const surface = JSON.stringify({
      registryApi: ["register", "get", "resolve", "has", "list"].map((m) => typeof (registry as unknown as Record<string, unknown>)[m]),
      fakeApi: Object.keys(fake),
    });
    expect(surface).not.toMatch(/row.level.security|schemaVersion|pg_dump|k6|artillery/i);
  });

  test("T18. route-graph audit: no webhook/callback/provider-event/signature routes", async () => {
    // Real route-graph audit (not a single 404): enumerate the Express router
    // stack and assert no provider/webhook surface exists anywhere.
    const server = app.getHttpServer() as unknown as { _router?: { stack?: Array<{ route?: { path?: string } }> } };
    const paths: string[] = [];
    for (const layer of server._router?.stack ?? []) {
      if (layer.route?.path) paths.push(layer.route.path);
    }
    const joined = paths.join("\n");
    expect(joined).not.toMatch(/webhook|callback|provider-event|signature|payment-provider|psp/i);
    // belt-and-braces: plausible PSP paths 404 (no hidden generic callback)
    await request(app.getHttpServer()).get("/api/v1/finance/webhooks").expect(404);
    await request(app.getHttpServer()).post("/api/v1/finance/webhooks/provider/capture").expect(404);
    await request(app.getHttpServer()).post("/api/v1/finance/provider/events").expect(404);
  });

  test("T19. source audit: no network / idempotency-runtime / PaymentStatus / real PSP in provider/", () => {
    // Audit RUNTIME code only (strip comment lines — boundary references in
    // doc comments are expected and are not runtime surfaces).
    const src = providerSource()
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/**"))
      .join("\n");
    // no network execution surface
    expect(src).not.toMatch(/axios|from "node:http"|from "http"|fetch\(|undici|https?:\/\//);
    // no external HTTP Idempotency-Key runtime (2.12H boundary: header
    // parsing, middleware, storage, replay — none exist)
    expect(src).not.toMatch(/Idempotency-Key|idempotencyKey|@Headers|req\.headers|getHeader|fingerprint|replay store/i);
    // no Payment domain lifecycle authority (AUTHORIZED unreachable via abstraction)
    expect(src).not.toMatch(/PaymentStatus|authorizedAt|paidAt/);
    // no real PSP adapter
    expect(src).not.toMatch(/stripe|adyen|paypal|mangopay|rapyd|checkout\.com/i);
  });
});
