import { SupplierResilienceService } from "./supplier-resilience.service";

describe("SupplierResilienceService", () => {
  let resilience: SupplierResilienceService;

  beforeEach(() => {
    resilience = new SupplierResilienceService();
  });

  describe("rate limiter", () => {
    it("allows requests within limit", () => {
      resilience.acquireBucket("TEST", 2, 60);
      resilience.acquireBucket("TEST", 2, 60);
      expect(resilience.getInflight("TEST")).toBe(0);
    });

    it("throws when rate limit exceeded", () => {
      resilience.acquireBucket("TEST", 2, 1);
      resilience.acquireBucket("TEST", 2, 1);
      expect(() => resilience.acquireBucket("TEST", 2, 1)).toThrow("Rate limit");
    });
  });

  describe("concurrency limiter", () => {
    it("allows requests within limit", () => {
      resilience.incrementInflight("TEST", 2);
      resilience.incrementInflight("TEST", 2);
      expect(resilience.getInflight("TEST")).toBe(2);
    });

    it("throws when concurrency exceeded", () => {
      resilience.incrementInflight("TEST", 1);
      expect(() => resilience.incrementInflight("TEST", 1)).toThrow("Concurrency");
    });

    it("decrements inflight", () => {
      resilience.incrementInflight("TEST", 2);
      expect(resilience.getInflight("TEST")).toBe(1);
      resilience.decrementInflight("TEST");
      expect(resilience.getInflight("TEST")).toBe(0);
    });
  });

  describe("circuit breaker", () => {
    it("starts closed", () => {
      resilience.initCircuit("TEST", 3, 60_000);
      expect(resilience.isCircuitOpen("TEST")).toBe(false);
    });

    it("opens after threshold failures", () => {
      resilience.initCircuit("TEST", 3, 60_000);
      resilience.recordFailure("TEST");
      resilience.recordFailure("TEST");
      resilience.recordFailure("TEST");
      expect(resilience.isCircuitOpen("TEST")).toBe(true);
    });

    it("resets failures on success", () => {
      resilience.initCircuit("TEST", 3, 60_000);
      resilience.recordFailure("TEST");
      resilience.recordFailure("TEST");
      resilience.recordSuccess("TEST");
      resilience.recordFailure("TEST");
      expect(resilience.isCircuitOpen("TEST")).toBe(false);
    });
  });

  describe("request coalescing", () => {
    it("coalesces duplicate requests", async () => {
      let callCount = 0;
      const fn = jest.fn(async () => {
        callCount++;
        return "result";
      });

      const [r1, r2] = await Promise.all([
        resilience.coalesce("key1", fn),
        resilience.coalesce("key1", fn),
      ]);

      expect(r1).toBe("result");
      expect(r2).toBe("result");
      expect(callCount).toBe(1);
    });

    it("allows different keys to run in parallel", async () => {
      const fn = jest.fn(async () => "result");
      await Promise.all([
        resilience.coalesce("key1", fn),
        resilience.coalesce("key2", fn),
      ]);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe("retry with backoff", () => {
    it("retries on failure", async () => {
      let attempts = 0;
      const result = await resilience.withRetry(
        "TEST",
        async () => {
          attempts++;
          if (attempts < 3) throw new Error("fail");
          return "success";
        },
        3,
        1,
      );
      expect(result).toBe("success");
      expect(attempts).toBe(3);
    });

    it("throws after max retries", async () => {
      await expect(
        resilience.withRetry(
          "TEST",
          async () => { throw new Error("always fail"); },
          2,
          1,
        ),
      ).rejects.toThrow("always fail");
    });
  });
});
