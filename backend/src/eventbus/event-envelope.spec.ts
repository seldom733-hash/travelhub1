/**
 * Phase 1 Step 1.15A — unit contract tests: business event envelope.
 *
 * §36 Contract tests: validator (§18/§20) + canonical projection
 * toOutboxEnvelope (§19: required fields, UTC occurredAt, entityId mapping,
 * legacy actor=null, malformed actor → null).
 */
import { assertValidBusinessEventWrite, type BusinessEventActor } from "./domain-events";
import { toOutboxEnvelope } from "./eventbus.service";

function row(overrides: Record<string, unknown> = {}) {
  const base = {
    id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    aggregateType: "Order",
    aggregateId: "ord-1",
    eventType: "OrderReadyForBooking",
    payload: { orderId: "ord-1", code: "ORD-1", customerId: "cus-1" },
    correlationId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e",
    causationId: null,
    createdAt: new Date("2026-08-09T12:00:00.000Z"),
    actor: { type: "USER", id: "u-1" },
  };
  return { ...base, ...overrides };
}

describe("business event envelope validation (Step 1.15A §18/§20)", () => {
  const valid = {
    aggregateType: "Order",
    aggregateId: "ord-1",
    eventType: "OrderReadyForBooking",
    payload: { orderId: "ord-1", code: "ORD-1", customerId: "cus-1" },
  };

  it("accepts a minimal valid write", () => {
    expect(() => assertValidBusinessEventWrite(valid)).not.toThrow();
  });

  it("accepts explicit typed actors", () => {
    const actors: (BusinessEventActor | null)[] = [
      { type: "USER", id: "u-1" },
      { type: "SYSTEM" },
      { type: "SYSTEM", id: "consumer-x" },
      { type: "UNKNOWN" },
      null,
    ];
    for (const actor of actors) {
      expect(() => assertValidBusinessEventWrite({ ...valid, actor })).not.toThrow();
    }
  });

  it("rejects empty/whitespace entity ID (§20: no empty string IDs)", () => {
    expect(() => assertValidBusinessEventWrite({ ...valid, aggregateId: "" })).toThrow(/aggregateId/);
    expect(() => assertValidBusinessEventWrite({ ...valid, aggregateId: "   " })).toThrow(/aggregateId/);
  });

  it("rejects empty eventType / aggregateType", () => {
    expect(() => assertValidBusinessEventWrite({ ...valid, eventType: "" })).toThrow(/eventType/);
    expect(() => assertValidBusinessEventWrite({ ...valid, aggregateType: "  " })).toThrow(/aggregateType/);
  });

  it("rejects non-canonical eventType (не в DomainEvents registry, §6/§24)", () => {
    expect(() => assertValidBusinessEventWrite({ ...valid, eventType: "OrderFULFILLED" })).toThrow(/eventType/);
    expect(() => assertValidBusinessEventWrite({ ...valid, eventType: "ORDER_FULFILLED" })).toThrow(/eventType/);
    expect(() => assertValidBusinessEventWrite({ ...valid, eventType: "MadeUpEvent" })).toThrow(/eventType/);
  });

  it("rejects undefined/null payload (§15 payload boundary)", () => {
    expect(() => assertValidBusinessEventWrite({ ...valid, payload: undefined })).toThrow(/payload/);
    expect(() => assertValidBusinessEventWrite({ ...valid, payload: null })).toThrow(/payload/);
  });

  it("rejects malformed actors (§10: USER requires canonical id, no username/email)", () => {
    expect(() => assertValidBusinessEventWrite({ ...valid, actor: { type: "USER", id: "" } })).toThrow(/actor/);
    expect(() =>
      assertValidBusinessEventWrite({ ...valid, actor: { type: "USER" } as unknown as BusinessEventActor }),
    ).toThrow(/actor/);
    expect(() => assertValidBusinessEventWrite({ ...valid, actor: { type: "UNKNOWN", id: "x" } as unknown as BusinessEventActor })).toThrow(/actor/);
    expect(() =>
      assertValidBusinessEventWrite({ ...valid, actor: { type: "GUEST" } as unknown as BusinessEventActor }),
    ).toThrow(/actor/);
  });

  it("rejects arbitrary keys in actor (нельзя подсунуть email/name/roles, §9)", () => {
    expect(() =>
      assertValidBusinessEventWrite({ ...valid, actor: { type: "USER", id: "u-1", email: "a@b.c" } as unknown as BusinessEventActor }),
    ).toThrow(/actor/);
    expect(() =>
      assertValidBusinessEventWrite({ ...valid, actor: { type: "USER", id: "u-1", name: "x" } as unknown as BusinessEventActor }),
    ).toThrow(/actor/);
    expect(() =>
      assertValidBusinessEventWrite({ ...valid, actor: { type: "SYSTEM", roles: ["a"] } as unknown as BusinessEventActor }),
    ).toThrow(/actor/);
  });
});

describe("toOutboxEnvelope — canonical projection (§19/§36)", () => {
  it("maps row → canonical envelope (eventId, entityId/entityType, occurredAt UTC ISO, actor)", () => {
    const env = toOutboxEnvelope(row());
    expect(env.eventId).toBe("9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    expect(env.entityId).toBe("ord-1");
    expect(env.entityType).toBe("Order");
    expect(env.eventType).toBe("OrderReadyForBooking");
    expect(env.correlationId).toBe("9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e");
    expect(env.causationId).toBeNull();
    expect(env.actor).toEqual({ type: "USER", id: "u-1" });
    // occurredAt = createdAt (опция A), UTC ISO instant.
    expect(env.occurredAt).toBe("2026-08-09T12:00:00.000Z");
    expect(env.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    // legacy aliases сохраняются (backward compat consumer-ов).
    expect(env.id).toBe(env.eventId);
    expect(env.aggregateId).toBe(env.entityId);
    expect(env.aggregateType).toBe(env.entityType);
    expect(env.createdAt).toEqual(new Date("2026-08-09T12:00:00.000Z"));
    expect(env.payload).toEqual({ orderId: "ord-1", code: "ORD-1", customerId: "cus-1" });
  });

  it("legacy row (actor null, correlation null) → actor null, correlationId null (без угадывания)", () => {
    const env = toOutboxEnvelope(row({ actor: null, correlationId: null }));
    expect(env.actor).toBeNull();
    expect(env.correlationId).toBeNull();
  });

  it("SYSTEM/UNKNOWN actor passthrough; malformed legacy actor → null (не ломает consumer)", () => {
    expect(toOutboxEnvelope(row({ actor: { type: "SYSTEM" } })).actor).toEqual({ type: "SYSTEM" });
    expect(toOutboxEnvelope(row({ actor: { type: "SYSTEM", id: "consumer-x" } })).actor).toEqual({ type: "SYSTEM", id: "consumer-x" });
    expect(toOutboxEnvelope(row({ actor: { type: "UNKNOWN" } })).actor).toEqual({ type: "UNKNOWN" });
    expect(toOutboxEnvelope(row({ actor: "corrupt-string" })).actor).toBeNull();
    expect(toOutboxEnvelope(row({ actor: { type: "USER" } })).actor).toBeNull(); // без id
    expect(toOutboxEnvelope(row({ actor: { bogus: 1 } })).actor).toBeNull();
  });

  it("не мутирует входную row (immutability)", () => {
    const input = row();
    const snapshot = JSON.stringify(input);
    toOutboxEnvelope(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
