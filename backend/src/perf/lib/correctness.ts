/**
 * Step 2.17B — post-run correctness validator.
 *
 * Independent of the load generator: queries authoritative DB/application
 * state and emits correctness.json. A run is never PASS merely because the
 * load tool succeeded — correctness-under-load is a HARD GATE.
 */

import { PrismaService } from "../../prisma/prisma.service";
import { ExternalIdempotencyStatus } from "../../generated/prisma/enums";

export interface CorrectnessCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface CorrectnessResult {
  checks: CorrectnessCheck[];
  verdict: "PASS" | "FAIL";
}

/** Generic checks applied to any load run. Any unexpected non-expected outcome
 *  (5xx, 4xx, 409, 429, timeout, transport) is a harness/application defect —
 *  the profile declares the full expected outcome set per step. */
export function loadRunChecks(result: {
  unexpected5xx: number;
  unexpected4xx: number;
  unexpected409: number;
  unexpected429: number;
  timeouts: number;
  transportErrors: number;
}): CorrectnessCheck[] {
  return [
    {
      name: "unexpected 5xx = 0",
      passed: result.unexpected5xx === 0,
      detail: `unexpected5xx=${result.unexpected5xx}`,
    },
    {
      name: "unexpected 4xx = 0",
      passed: result.unexpected4xx === 0,
      detail: `unexpected4xx=${result.unexpected4xx}`,
    },
    {
      name: "unexpected 409 = 0",
      passed: result.unexpected409 === 0,
      detail: `unexpected409=${result.unexpected409}`,
    },
    {
      name: "unexpected 429 = 0",
      passed: result.unexpected429 === 0,
      detail: `unexpected429=${result.unexpected429}`,
    },
    {
      name: "timeouts = 0",
      passed: result.timeouts === 0,
      detail: `timeouts=${result.timeouts}`,
    },
    {
      name: "transport errors = 0",
      passed: result.transportErrors === 0,
      detail: `transport=${result.transportErrors}`,
    },
  ];
}

export interface PaycreateContext {
  /** orderId → expected number of Payment facts on that order (0 or 1). */
  expectedPerOrder: Array<{ orderId: string; expected: number }>;
  userIds: string[];
  expectedPayments: number; // total unique Payment facts created
  /** Business-level no-op keys: canonical PaymentService idempotent retry — a
   *  second key on an order with an active payment returns the existing fact
   *  (201) and still records a COMPLETED idempotency slot. */
  businessNoopKeys: number;
}

/** payment.create scenario invariants (external idempotency + one-active-per-order). */
export async function paycreateChecks(prisma: PrismaService, ctx: PaycreateContext): Promise<CorrectnessCheck[]> {
  const checks: CorrectnessCheck[] = [];
  let totalPayments = 0;
  for (const { orderId, expected } of ctx.expectedPerOrder) {
    const count = await prisma.payment.count({ where: { orderId } });
    totalPayments += count;
    checks.push({
      name: `payments(order ${orderId.slice(0, 8)}) = ${expected}`,
      passed: count === expected,
      detail: `count=${count} expected=${expected}`,
    });
  }
  checks.push({
    name: "total unique Payment facts",
    passed: totalPayments === ctx.expectedPayments,
    detail: `actual=${totalPayments} expected=${ctx.expectedPayments}`,
  });
  // Each committed Payment has exactly one COMPLETED idempotency slot (the key
  // that created it). Business-level no-op keys (second key on an order with an
  // active payment) also record COMPLETED slots. Keys whose execution rolled
  // back have their claim removed (2.12H T13). Exact relation:
  //   completedSlots = payments + businessNoopKeys
  const completedSlots = await prisma.externalIdempotencyRecord.count({
    where: { scopeId: { in: ctx.userIds }, operation: "payment.create", status: ExternalIdempotencyStatus.COMPLETED },
  });
  checks.push({
    name: "COMPLETED idempotency slots = payments + business no-op keys",
    passed: completedSlots === totalPayments + ctx.businessNoopKeys,
    detail: `completedSlots=${completedSlots} payments=${totalPayments} businessNoop=${ctx.businessNoopKeys}`,
  });
  return checks;
}

export interface EventbusContext {
  seededCount: number;
  poisonId?: string;
  publishedCount: number;
  residualPending: number;
  residualFailed: number;
  poisonStillFailed: boolean;
  drainMs: number;
}

/** EventBus recovery scenario invariants. */
export function eventbusChecks(ctx: EventbusContext): CorrectnessCheck[] {
  return [
    {
      name: "all seeded events published",
      passed: ctx.publishedCount === ctx.seededCount,
      detail: `published=${ctx.publishedCount} seeded=${ctx.seededCount}`,
    },
    {
      name: "residual PENDING = 0",
      passed: ctx.residualPending === 0,
      detail: `pending=${ctx.residualPending}`,
    },
    {
      name: "no unexpected FAILED",
      passed: ctx.residualFailed === 0,
      detail: `failed=${ctx.residualFailed}`,
    },
    ...(ctx.poisonId
      ? [
          {
            name: "poison isolated (stays FAILED)",
            passed: ctx.poisonStillFailed,
            detail: ctx.poisonStillFailed ? "poison remained FAILED" : "poison was retried/unexpectedly drained",
          } satisfies CorrectnessCheck,
        ]
      : []),
  ];
}

export function verdictOf(checks: CorrectnessCheck[]): CorrectnessResult {
  return { checks, verdict: checks.every((c) => c.passed) ? "PASS" : "FAIL" };
}
