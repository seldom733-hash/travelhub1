/**
 * Phase 1 Step 1.15 — unit tests: request/correlation context.
 *
 * §18 Unit: ID format/trust boundary, ALS propagation, legacy NULL semantics.
 */
import { createRequestId, getRequestContext, isValidRequestId, normalizeCorrelationId, runWithRequestContext, setRequestActor } from "./request-context";

const CTX_BASE = { requestId: createRequestId(), correlationId: createRequestId(), causationId: null, actor: null };

describe("request-context (Step 1.15)", () => {
  describe("isValidRequestId — формат и trust boundary (§4/§5/§13)", () => {
    it("accepts a valid UUID v4", () => {
      expect(isValidRequestId(createRequestId())).toBe(true);
      expect(isValidRequestId("9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d")).toBe(true);
    });

    it("rejects oversized / control-character / non-UUID values", () => {
      expect(isValidRequestId("a".repeat(65))).toBe(false); // oversized
      expect(isValidRequestId("9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d\n")).toBe(false); // control chars
      expect(isValidRequestId("9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d; DELETE")).toBe(false); // log injection
      expect(isValidRequestId("not-a-uuid")).toBe(false);
      expect(isValidRequestId("")).toBe(false);
      expect(isValidRequestId(123)).toBe(false);
      expect(isValidRequestId(null)).toBe(false);
      expect(isValidRequestId(undefined)).toBe(false);
    });

    it("rejects non-v4 UUID (wrong version/variant bits)", () => {
      expect(isValidRequestId("9b1deb4d-3b7d-3bad-9bdd-2b0d7b3dcb6d")).toBe(false); // version 3
      expect(isValidRequestId("9b1deb4d-3b7d-4bad-ebdd-2b0d7b3dcb6d")).toBe(false); // variant e
    });
  });

  describe("createRequestId", () => {
    it("generates unique valid UUIDs", () => {
      const a = createRequestId();
      const b = createRequestId();
      expect(a).not.toBe(b);
      expect(isValidRequestId(a)).toBe(true);
    });
  });

  describe("normalizeCorrelationId — explicit override semantics (§6)", () => {
    it("undefined → undefined (inherit from context)", () => {
      expect(normalizeCorrelationId(undefined)).toBeUndefined();
    });

    it("null → null (intentional legacy NULL, не подменяется контекстом)", () => {
      expect(normalizeCorrelationId(null)).toBeNull();
    });

    it("valid string → trimmed value", () => {
      expect(normalizeCorrelationId(" 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d ")).toBe("9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    });

    it("empty/whitespace string → null (не сохраняется как valid correlation)", () => {
      expect(normalizeCorrelationId("")).toBeNull();
      expect(normalizeCorrelationId("   ")).toBeNull();
      expect(normalizeCorrelationId("\n\t")).toBeNull();
    });
  });

  describe("AsyncLocalStorage propagation (§6)", () => {
    it("outside a context — getRequestContext() is undefined", () => {
      expect(getRequestContext()).toBeUndefined();
    });

    it("runWithRequestContext exposes the context inside async fn", async () => {
      const ctx = { ...CTX_BASE };
      const seen = await runWithRequestContext(ctx, async () => {
        await Promise.resolve(); // async boundary — ALS сохраняет контекст
        return getRequestContext();
      });
      expect(seen).toEqual(ctx);
    });

    it("context is scoped to the run (не утекает наружу)", async () => {
      const ctx = { ...CTX_BASE };
      await runWithRequestContext(ctx, async () => {
        expect(getRequestContext()).toEqual(ctx);
      });
      expect(getRequestContext()).toBeUndefined();
    });

    it("nested run overrides and restores parent context", async () => {
      const parent = { requestId: "11111111-1111-4111-8111-111111111111", correlationId: "11111111-1111-4111-8111-111111111111", causationId: null, actor: null };
      const child = { requestId: "22222222-2222-4222-8222-222222222222", correlationId: "11111111-1111-4111-8111-111111111111", causationId: "33333333-3333-4333-8333-333333333333", actor: { type: "SYSTEM" } as const };
      await runWithRequestContext(parent, async () => {
        expect(getRequestContext()).toEqual(parent);
        await runWithRequestContext(child, async () => {
          expect(getRequestContext()).toEqual(child); // causationId = parent event id
        });
        expect(getRequestContext()).toEqual(parent); // restored
      });
    });
  });

  describe("setRequestActor — typed actor (Step 1.15A §10)", () => {
    it("outside a context — no-op (не бросает)", () => {
      expect(() => setRequestActor({ type: "USER", id: "u1" })).not.toThrow();
    });

    it("sets actor inside the active context, does not leak outside", async () => {
      await runWithRequestContext({ ...CTX_BASE }, async () => {
        expect(getRequestContext()!.actor).toBeNull(); // middleware default
        setRequestActor({ type: "USER", id: "u-123" });
        expect(getRequestContext()!.actor).toEqual({ type: "USER", id: "u-123" });
      });
      expect(getRequestContext()).toBeUndefined();
    });

    it("nested consumer context (SYSTEM) не мутирует родительский USER-контекст", async () => {
      const parent = { ...CTX_BASE };
      await runWithRequestContext(parent, async () => {
        setRequestActor({ type: "USER", id: "u-123" });
        await runWithRequestContext({ ...CTX_BASE, actor: { type: "SYSTEM" } as const }, async () => {
          setRequestActor({ type: "SYSTEM", id: "consumer-x" });
          expect(getRequestContext()!.actor).toEqual({ type: "SYSTEM", id: "consumer-x" });
        });
        expect(getRequestContext()!.actor).toEqual({ type: "USER", id: "u-123" }); // parent intact
      });
    });
  });
});
