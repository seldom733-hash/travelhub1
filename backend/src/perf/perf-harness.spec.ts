/**
 * Step 2.17B — perf harness unit/integration tests.
 *
 * Covers the pure logic (guard, classification, percentiles, redaction,
 * config) plus an end-to-end loader test against a tiny local HTTP server.
 * The loader test uses real fetch + concurrency — the same code path the
 * harness runs in production of the harness.
 */

import { createServer, type Server } from "http";
import { AddressInfo } from "net";
import { classifyOutcome } from "./lib/classify";
import { computeLatencyStats, mulberry32, percentile } from "./lib/percentile";
import { guardViolations, isProtectedDbName } from "./lib/guard";
import { redact, REDACTED, scrubUrlCredentials, sanitizeMetadata } from "./lib/redact";
import { parseArgs, PROFILE_NAMES } from "./lib/config";
import { runLoad } from "./lib/loader";
import { loadRunChecks, verdictOf } from "./lib/correctness";
import { scheduledStartMs, scheduledOperationsFor, classifyPacingValidity } from "./lib/pacer";
import { datasetCountsFor, validateQualificationConfig, QUALIFICATION } from "./lib/qualification";
import { drainOutbox, newRegistry, cleanup } from "./lib/seed";

describe("perf guard — safe-target (fail-closed)", () => {
  it("refuses NODE_ENV=production unconditionally", () => {
    const v = guardViolations({ dbUrl: "postgresql://postgres:postgres@localhost:5432/travelhub_perf", nodeEnv: "production" });
    expect(v.some((x) => /NODE_ENV=production/.test(x))).toBe(true);
  });

  it("refuses canonical dev database name", () => {
    const v = guardViolations({ dbUrl: "postgresql://postgres:postgres@localhost:5432/travelhub1" });
    expect(v.some((x) => /protected\/canonical/.test(x))).toBe(true);
  });

  it("refuses production-like database names", () => {
    for (const name of ["travelhub_prod", "travelhub_production", "myapp_prod"]) {
      expect(isProtectedDbName(name)).toBe(true);
      const v = guardViolations({ dbUrl: `postgresql://u:p@localhost:5432/${name}` });
      expect(v.some((x) => /protected\/canonical/.test(x))).toBe(true);
    }
  });

  it("refuses postgres/template databases", () => {
    for (const name of ["postgres", "template0", "template1"]) {
      const v = guardViolations({ dbUrl: `postgresql://u:p@localhost:5432/${name}` });
      expect(v.some((x) => /protected\/canonical/.test(x))).toBe(true);
    }
  });

  it("refuses malformed DATABASE_URL", () => {
    const v = guardViolations({ dbUrl: "not-a-url" });
    expect(v.length).toBeGreaterThan(0);
  });

  it("refuses non-local DB host unless --allow-non-local", () => {
    const v = guardViolations({ dbUrl: "postgresql://u:p@db.internal:5432/travelhub_perf" });
    expect(v.some((x) => /non-local/.test(x))).toBe(true);
    const ok = guardViolations({ dbUrl: "postgresql://u:p@db.internal:5432/travelhub_perf", allowNonLocal: true });
    expect(ok.some((x) => /non-local/.test(x))).toBe(false);
  });

  it("refuses non-local remote base URL unless acknowledged", () => {
    const v = guardViolations({ dbUrl: "postgresql://u:p@localhost:5432/travelhub_perf", remoteBaseUrl: "https://staging.example.com" });
    expect(v.some((x) => /non-local/.test(x))).toBe(true);
  });

  it("stress profile requires explicit opt-in", () => {
    const v = guardViolations({ dbUrl: "postgresql://u:p@localhost:5432/travelhub_perf", profile: "stress" });
    expect(v.some((x) => /--stress/.test(x))).toBe(true);
    const ok = guardViolations({ dbUrl: "postgresql://u:p@localhost:5432/travelhub_perf", profile: "stress", stress: true });
    expect(ok).toHaveLength(0);
  });

  it("allows a local perf-named DB with no env issues", () => {
    const v = guardViolations({ dbUrl: "postgresql://postgres:postgres@localhost:5432/travelhub_perf_smoke", profile: "smoke" });
    expect(v).toEqual([]);
  });
});

describe("perf classification — expected vs unexpected", () => {
  it("classifies expected statuses", () => {
    expect(classifyOutcome(200, false, [200])).toEqual({ outcome: "expected", expected: true });
    expect(classifyOutcome(201, false, [200, 201])).toEqual({ outcome: "expected", expected: true });
  });

  it("classifies unexpected 5xx/409/429/4xx distinctly", () => {
    expect(classifyOutcome(500, false, [200]).outcome).toBe("unexpected5xx");
    expect(classifyOutcome(409, false, [201]).outcome).toBe("unexpected409");
    expect(classifyOutcome(429, false, [200]).outcome).toBe("unexpected429");
    expect(classifyOutcome(403, false, [200]).outcome).toBe("unexpected4xx");
  });

  it("classifies timeout and transport failure", () => {
    expect(classifyOutcome(null, true, [200]).outcome).toBe("timeout");
    expect(classifyOutcome(null, false, [200]).outcome).toBe("transportError");
  });
});

describe("perf percentiles", () => {
  it("computes nearest-rank percentiles", () => {
    const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(sorted, 50)).toBe(50); // ceil(0.5*10)=5 → index 4 → sorted[4]=50
    expect(percentile(sorted, 95)).toBe(100);
    expect(percentile(sorted, 100)).toBe(100);
    expect(percentile(sorted, 1)).toBe(10);
  });

  it("computes stats with p50/p95/p99/max/mean", () => {
    const s = computeLatencyStats([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(s.count).toBe(10);
    expect(s.min).toBe(10);
    expect(s.max).toBe(100);
    expect(s.mean).toBe(55);
    expect(s.p50).toBe(50);
    expect(s.p99).toBe(100);
  });

  it("empty input → zeroed stats", () => {
    const s = computeLatencyStats([]);
    expect(s.count).toBe(0);
    expect(s.p95).toBe(0);
  });

  it("mulberry32 is deterministic for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(Array.from({ length: 5 }, () => a())).toEqual(Array.from({ length: 5 }, () => b()));
    const c = mulberry32(43);
    expect(c()).not.toBe(a());
  });
});

describe("perf redaction", () => {
  it("redacts sensitive keys recursively", () => {
    const out = redact({ user: { password: "x", nested: { token: "abc" } }, safe: "keep" }) as Record<string, unknown>;
    expect(out.user).toEqual({ password: REDACTED, nested: { token: REDACTED } });
    expect(out.safe).toBe("keep");
  });

  it("redacts arrays and idempotency keys", () => {
    const out = redact({ list: [{ accessToken: "t" }], idempotencyKey: "k" }) as Record<string, unknown>;
    expect((out.list as Array<Record<string, unknown>>)[0].accessToken).toBe(REDACTED);
    expect(out.idempotencyKey).toBe(REDACTED);
  });

  it("scrubs URL credentials", () => {
    expect(scrubUrlCredentials("postgresql://user:secret@localhost:5432/db")).toBe("postgresql://***@localhost:5432/db");
    expect(scrubUrlCredentials("https://api:key@host/x")).toBe("https://***@host/x");
    expect(scrubUrlCredentials("plain")).toBe("plain");
  });

  it("sanitizeMetadata scrubs credentials in nested strings", () => {
    const out = sanitizeMetadata({ dbUrl: "postgresql://u:p@localhost:5432/x", token: "raw" }) as Record<string, string>;
    expect(out.dbUrl).toBe("postgresql://***@localhost:5432/x");
    expect(out.token).toBe(REDACTED);
  });
});

describe("perf config — fail-closed parsing", () => {
  it("rejects unknown flags", () => {
    const r = parseArgs(["--profile=smoke", "--nope=1"]);
    expect(r.ok).toBe(false);
  });

  it("rejects malformed numeric values", () => {
    expect(parseArgs(["--profile=smoke", "--concurrency=abc"]).ok).toBe(false);
    expect(parseArgs(["--profile=smoke", "--concurrency=-3"]).ok).toBe(false);
    expect(parseArgs(["--profile=smoke", "--duration=0"]).ok).toBe(false);
  });

  it("rejects unknown profiles", () => {
    const r = parseArgs(["--profile=nope"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toContain("unknown profile");
  });

  it("rejects missing values", () => {
    expect(parseArgs(["--profile"]).ok).toBe(false);
    expect(parseArgs(["--profile=smoke", "--run-id"]).ok).toBe(false);
  });

  it("rejects positional arguments", () => {
    const r = parseArgs(["--profile=smoke", "stray"]);
    expect(r.ok).toBe(false);
  });

  it("parses a valid config with defaults", () => {
    const r = parseArgs(["--profile=baseline", "--run-id=test-run", "--concurrency=7", "--seed=5"]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.profile).toBe("baseline");
      expect(r.config.runId).toBe("test-run");
      expect(r.config.concurrency).toBe(7);
      expect(r.config.seed).toBe(5);
      expect(r.config.allowNonLocal).toBe(false);
      expect(r.config.stress).toBe(false);
      expect(PROFILE_NAMES).toContain("smoke");
    }
  });

  it("boolean flags accept no value", () => {
    expect(parseArgs(["--profile=smoke", "--stress=yes"]).ok).toBe(false);
    const r = parseArgs(["--profile=stress", "--stress", "--allow-non-local"]);
    expect(r.ok).toBe(true);
  });
});

describe("perf correctness — validator semantics", () => {
  it("loadRunChecks fails on unexpected 5xx/4xx/timeout/transport", () => {
    const base = { unexpected4xx: 0, unexpected409: 0, unexpected429: 0 };
    expect(loadRunChecks({ ...base, unexpected5xx: 1, timeouts: 0, transportErrors: 0 }).every((c) => c.passed)).toBe(false);
    expect(loadRunChecks({ ...base, unexpected5xx: 0, unexpected4xx: 1, timeouts: 0, transportErrors: 0 }).every((c) => c.passed)).toBe(false);
    expect(loadRunChecks({ ...base, unexpected5xx: 0, timeouts: 1, transportErrors: 0 }).every((c) => c.passed)).toBe(false);
    expect(loadRunChecks({ ...base, unexpected5xx: 0, timeouts: 0, transportErrors: 0 }).every((c) => c.passed)).toBe(true);
  });

  it("verdictOf aggregates checks", () => {
    expect(verdictOf([{ name: "a", passed: true, detail: "" }]).verdict).toBe("PASS");
    expect(verdictOf([{ name: "a", passed: true, detail: "" }, { name: "b", passed: false, detail: "" }]).verdict).toBe("FAIL");
  });
});

describe("perf loader — end-to-end against a local HTTP server", () => {
  let server: Server;
  let port: number;
  let fail500: boolean;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (fail500) {
        res.writeHead(500);
        res.end("boom");
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("collects samples, percentiles and outcome counts", async () => {
    fail500 = false;
    const result = await runLoad({
      baseUrl: `http://127.0.0.1:${port}`,
      concurrency: 4,
      durationMs: 800,
      warmupMs: 200,
      makeRequest: () => ({ label: "ping", method: "GET", path: "/", expected: [200] }),
      seed: 7,
    });
    expect(result.totalRequests).toBeGreaterThan(0);
    expect(result.expected).toBe(result.totalRequests);
    expect(result.unexpected5xx).toBe(0);
    expect(result.requestsPerSec).toBeGreaterThan(0);
    expect(result.byLabel["ping"].stats.p50).toBeGreaterThanOrEqual(0);
    expect(result.byLabel["ping"].outcomes.expected).toBe(result.byLabel["ping"].count);
  });

  it("classifies unexpected 5xx as correctness failure", async () => {
    fail500 = true;
    const result = await runLoad({
      baseUrl: `http://127.0.0.1:${port}`,
      concurrency: 2,
      durationMs: 400,
      warmupMs: 100,
      makeRequest: () => ({ label: "ping", method: "GET", path: "/", expected: [200] }),
      seed: 3,
    });
    fail500 = false;
    expect(result.unexpected5xx).toBe(result.totalRequests);
    expect(loadRunChecks(result).some((c) => !c.passed)).toBe(true);
  });
});

describe("perf pacing — arrival-rate scheduler (H1)", () => {
  it("schedules monotonic start times: start(n) = phaseStart + n/rate", () => {
    const spec = { targetRps: 50, durationMs: 10_000, windowStartMs: 1_000_000 };
    expect(scheduledStartMs(spec, 0)).toBe(1_000_000);
    expect(scheduledStartMs(spec, 1)).toBe(1_000_020); // 20ms apart at 50 rps
    expect(scheduledStartMs(spec, 10)).toBe(1_000_200);
  });

  it("computes scheduled operations from duration and rate", () => {
    expect(scheduledOperationsFor({ targetRps: 50, durationMs: 10_000, windowStartMs: 0 })).toBe(500);
    expect(scheduledOperationsFor({ targetRps: 2, durationMs: 60_000, windowStartMs: 0 })).toBe(120);
    expect(scheduledOperationsFor({ targetRps: 200, durationMs: 60_000, windowStartMs: 0 })).toBe(12_000);
  });

  it("classifies sustained start-rate within ±5% as valid", () => {
    const spec = { targetRps: 50, durationMs: 10_000, windowStartMs: 0 };
    const offsets = Array.from({ length: 501 }, (_, i) => (i / 50) * 1000); // exactly 50/s
    const v = classifyPacingValidity(spec, { burst: false, startOffsetsMs: offsets, startedOperations: 501, completedOperations: 500, maxConcurrencyObserved: 1 });
    expect(v.valid).toBe(true);
  });

  it("classifies slow start-rate beyond ±5% as invalid", () => {
    const spec = { targetRps: 50, durationMs: 10_000, windowStartMs: 0 };
    // 40/s instead of 50/s → 20% off
    const offsets = Array.from({ length: 401 }, (_, i) => (i / 40) * 1000);
    const v = classifyPacingValidity(spec, { burst: false, startOffsetsMs: offsets, startedOperations: 401, completedOperations: 400, maxConcurrencyObserved: 1 });
    expect(v.valid).toBe(false);
  });

  it("classifies burst started-vs-scheduled within ±5% as valid", () => {
    const spec = { targetRps: 200, durationMs: 60_000, windowStartMs: 0 };
    const offsets = Array.from({ length: 12_000 }, (_, i) => (i / 200) * 1000);
    expect(classifyPacingValidity(spec, { burst: true, startOffsetsMs: offsets, startedOperations: 12_000, completedOperations: 12_000, maxConcurrencyObserved: 1 }).valid).toBe(true);
    expect(classifyPacingValidity(spec, { burst: true, startOffsetsMs: offsets.slice(0, 10_000), startedOperations: 10_000, completedOperations: 10_000, maxConcurrencyObserved: 1 }).valid).toBe(false);
  });

  it("zero-started runs always FAIL load validity", () => {
    const spec = { targetRps: 50, durationMs: 10_000, windowStartMs: 0 };
    expect(classifyPacingValidity(spec, { burst: false, startOffsetsMs: [], startedOperations: 0, completedOperations: 0, maxConcurrencyObserved: 0 }).valid).toBe(false);
  });
});

describe("perf paced loader — wall-clock scheduling, not completion-rate", () => {
  let server: Server;
  let port: number;
  let slow: boolean;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (slow) {
        setTimeout(() => {
          res.writeHead(200);
          res.end("ok");
        }, 60);
        return;
      }
      res.writeHead(200);
      res.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("starts requests at the target rate even when the server is slow (no completion-rate pacing)", async () => {
    slow = true; // 60ms latency — a completion-driven schedule would start ~16/s
    const result = await runLoad({
      baseUrl: `http://127.0.0.1:${port}`,
      concurrency: 200,
      durationMs: 1_000,
      warmupMs: 0,
      mode: "paced",
      targetRps: 100,
      makeRequest: () => ({ label: "ping", method: "GET", path: "/", expected: [200], routeClass: "A" }),
      seed: 1,
    });
    slow = false;
    expect(result.pacing).toBeDefined();
    // ~100 scheduled starts in 1s with a 60ms-latency server — only possible with
    // wall-clock scheduling (completion-rate pacing would produce ~16/s ≫ ±5%).
    // ±15% tolerance: wall-clock scheduling on Windows CI can drift due to
    // OS scheduler latency; the key invariant is that started >> completion-rate
    // target (~16/s), which 15% still proves unambiguously.
    expect(Math.abs(result.pacing!.startedOperations - result.pacing!.scheduledOperations) / result.pacing!.scheduledOperations).toBeLessThanOrEqual(0.15);
    expect(result.pacing!.loadApplicationValid).toBe(true);
    // Drain completes every started request.
    expect(result.pacing!.completedOperations).toBe(result.pacing!.startedOperations);
    expect(result.mode).toBe("paced");
  });

  it("enforces the concurrency ceiling in paced mode", async () => {
    slow = true;
    const result = await runLoad({
      baseUrl: `http://127.0.0.1:${port}`,
      concurrency: 8,
      durationMs: 1_000,
      warmupMs: 0,
      mode: "paced",
      targetRps: 200,
      makeRequest: () => ({ label: "ping", method: "GET", path: "/", expected: [200] }),
      seed: 2,
    });
    slow = false;
    expect(result.pacing!.maxConcurrencyObserved).toBeLessThanOrEqual(8);
    expect(result.pacing!.maxConcurrencyObserved).toBeGreaterThan(0);
  });

  it("distributes requests across baseUrls (multi-instance) and emits per-instance counts", async () => {
    const server2 = createServer((req, res) => {
      res.writeHead(200);
      res.end("ok");
    });
    await new Promise<void>((resolve) => server2.listen(0, "127.0.0.1", () => resolve()));
    const port2 = (server2.address() as AddressInfo).port;
    const result = await runLoad({
      baseUrl: `http://127.0.0.1:${port}`,
      baseUrls: [`http://127.0.0.1:${port}`, `http://127.0.0.1:${port2}`],
      concurrency: 4,
      durationMs: 600,
      warmupMs: 0,
      mode: "paced",
      targetRps: 50,
      makeRequest: () => ({ label: "ping", method: "GET", path: "/", expected: [200] }),
      seed: 3,
    });
    await new Promise<void>((resolve) => server2.close(() => resolve()));
    const counts = Object.values(result.perBaseUrl);
    expect(counts.length).toBe(2);
    expect(counts[0]).toBeGreaterThan(0);
    expect(counts[1]).toBeGreaterThan(0);
    const diff = Math.abs(counts[0] - counts[1]) / Math.max(1, counts[0] + counts[1]);
    expect(diff).toBeLessThan(0.2); // round-robin → near-balanced
  });

  it("separates paced warm-up from measurement and attributes route classes", async () => {
    const result = await runLoad({
      baseUrl: `http://127.0.0.1:${port}`,
      concurrency: 4,
      durationMs: 500,
      warmupMs: 300,
      mode: "paced",
      targetRps: 50,
      makeRequest: (n: number) => ({ label: n % 2 === 0 ? "ping" : "pong", method: "GET", path: "/", expected: [200], routeClass: (n % 2 === 0 ? "A" : "B") as "A" | "B" }),
      seed: 4,
    });
    expect(result.warmup.requests).toBeGreaterThan(0);
    expect(result.warmup.durationMs).toBe(300);
    expect(result.byRouteClass["A"].count).toBeGreaterThan(0);
    expect(result.byRouteClass["B"].count).toBeGreaterThan(0);
    // Measurement window ≈ 500ms @ 50 rps = 25 requests.
    expect(result.totalRequests).toBeGreaterThanOrEqual(20);
  });

  it("warm-up and measurement use DISJOINT identity streams (namespace disjointness)", async () => {
    // §13 harness-defect fix: warm-up keys must never collide with measurement
    // keys (paced windows previously restarted `n` at 0 → identical idempotency
    // keys → warm-up slots formally invalidated the payment gate).
    const seen: number[] = [];
    await runLoad({
      baseUrl: `http://127.0.0.1:${port}`,
      concurrency: 8,
      durationMs: 400,
      warmupMs: 250,
      mode: "paced",
      targetRps: 40,
      makeRequest: (n: number) => {
        seen.push(n);
        return { label: "ping", method: "GET", path: "/", expected: [200] };
      },
      seed: 7,
    });
    // warmup ∪ measurement = one monotonic, non-repeating stream: no identity is
    // ever reused across the two windows, so idempotency keys are disjoint by
    // construction (warmupSlotSet ∩ measurementSlotSet = ∅).
    expect(new Set(seen).size).toBe(seen.length);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThan(seen[i - 1]);
    expect(seen[0]).toBe(0);
    // Both windows really executed: identities span warm-up AND measurement.
    expect(seen.length).toBeGreaterThan(10);
  });

  it("deterministic run-scoped namespaces: same seed, same identity sequence", async () => {
    const ids = async (seed: number): Promise<number[]> => {
      const seen: number[] = [];
      await runLoad({
        baseUrl: `http://127.0.0.1:${port}`,
        concurrency: 4,
        durationMs: 300,
        warmupMs: 200,
        mode: "paced",
        targetRps: 30,
        makeRequest: (n: number) => {
          seen.push(n);
          return { label: "ping", method: "GET", path: "/", expected: [200] };
        },
        seed,
      });
      return seen;
    };
    const a = await ids(42);
    const b = await ids(42);
    expect(a).toEqual(b);
    // Run-scoped: each run starts its own monotonic stream at 0 (actual idempotency
    // keys additionally embed the runId, so cross-run identity reuse is harmless).
    expect(Math.min(...a)).toBe(0);
    const c = await ids(43);
    expect(Math.min(...c)).toBe(0);
  });
});

describe("perf final-mode validation — fail-closed (H9/H10/§17)", () => {
  const base = {
    finalMode: true,
    profile: "qual-steady",
    targetRps: 50,
    durationMs: 900_000,
    concurrency: 500,
    warmupMs: 300_000,
    dataset: "REPRESENTATIVE",
    apps: 2,
    workers: 2,
    pspEnvVars: [] as Array<{ name: string; value?: string }>,
  };

  it("accepts the canonical qualification configuration", () => {
    expect(validateQualificationConfig({ ...base })).toEqual([]);
  });

  it("rejects non-canonical worker interval override", () => {
    const issues = validateQualificationConfig({ ...base, workerIntervalEnv: "200" });
    expect(issues.some((i) => i.code === "WORKER_INTERVAL")).toBe(true);
  });

  it("rejects non-canonical worker batch override", () => {
    const issues = validateQualificationConfig({ ...base, workerBatchEnv: "50" });
    expect(issues.some((i) => i.code === "WORKER_BATCH")).toBe(true);
  });

  it("accepts canonical (unset) worker env", () => {
    expect(validateQualificationConfig({ ...base, workerIntervalEnv: undefined, workerBatchEnv: undefined })).toEqual([]);
  });

  it("rejects wrong instance topology (apps/workers != 2)", () => {
    expect(validateQualificationConfig({ ...base, apps: 1 }).some((i) => i.code === "APPS")).toBe(true);
    expect(validateQualificationConfig({ ...base, workers: 1 }).some((i) => i.code === "WORKERS")).toBe(true);
  });

  it("rejects invalid dataset and zero rps", () => {
    expect(validateQualificationConfig({ ...base, dataset: "HUGE" }).some((i) => i.code === "DATASET")).toBe(true);
    expect(validateQualificationConfig({ ...base, targetRps: 0 }).some((i) => i.code === "RPS")).toBe(true);
  });

  it("rejects PSP connectivity env in final mode", () => {
    expect(validateQualificationConfig({ ...base, pspEnvVars: [{ name: "STRIPE_SECRET_KEY", value: "sk_test_x" }] }).some((i) => i.code === "PSP")).toBe(true);
  });

  it("exploratory mode returns no issues", () => {
    expect(validateQualificationConfig({ ...base, finalMode: false, apps: 1, workers: 0, workerIntervalEnv: "200" })).toEqual([]);
  });
});

describe("perf dataset profiles (H3)", () => {
  it("SMALL is a tiny deterministic slice", () => {
    const c = datasetCountsFor("SMALL");
    expect(c.users).toBe(8);
    expect(c.orderChains).toBe(8);
  });

  it("REPRESENTATIVE meets the approved authority counts", () => {
    const c = datasetCountsFor("REPRESENTATIVE");
    expect(c.users).toBeGreaterThanOrEqual(1_000);
    expect(c.products).toBeGreaterThanOrEqual(500);
    expect(c.customers).toBeGreaterThanOrEqual(1_000);
    expect(c.quotes).toBeGreaterThanOrEqual(1_000);
    expect(c.orderChains).toBeGreaterThanOrEqual(1_000);
    expect(c.paymentCapableOrders).toBeGreaterThanOrEqual(500);
    expect(c.ledger).toBeGreaterThanOrEqual(5_000);
    expect(c.eventBusSeed).toBeGreaterThanOrEqual(5_000);
  });

  it("scale factor scales REPRESENTATIVE deterministically", () => {
    const c = datasetCountsFor("REPRESENTATIVE", 0.1);
    expect(c.users).toBe(100);
    expect(c.products).toBe(50);
  });

  it("STRESS scales the envelope up", () => {
    const c = datasetCountsFor("STRESS", 0.5);
    expect(c.users).toBeGreaterThan(datasetCountsFor("REPRESENTATIVE").users);
  });

  it("frozen manifest is intact", () => {
    expect(QUALIFICATION.steady).toEqual({ rps: 50, durationMs: 900_000, concurrency: 500 });
    expect(QUALIFICATION.peak).toEqual({ rps: 100, durationMs: 900_000, concurrency: 500 });
    expect(QUALIFICATION.burst).toEqual({ rps: 200, durationMs: 60_000, concurrency: 1_000 });
    expect(QUALIFICATION.soak).toEqual({ rps: 50, durationMs: 1_800_000, concurrency: 250 });
    // Step 2.17B remediation (Workstream A): canonical idle interval 2000 → 500ms.
    // Proven: at 100 ev/s a 2000ms poll creates an unavoidable sawtooth backlog
    // floor of ~200 (> frozen gate ≤100); 500ms ⇒ floor ≤50. Verified on the
    // remediation DB: steady maxBacklog 17 (was 171), oldest PENDING 146ms.
    // Authorization: remediation prompt §перечень изменяемых параметров
    // (polling interval с расчётом, доказательством и проверкой побочных эффектов).
    expect(QUALIFICATION.canonical).toEqual({ workerIntervalMs: 500, workerBatch: 100 });
  });
});

describe("perf config — new flags (H2/H4–H6/H8/H11)", () => {
  it("parses --rps/--warmup/--dataset/--apps/--workers/--seed-events/--final", () => {
    const r = parseArgs([
      "--profile=payment-steady",
      "--rps=2",
      "--duration=20000",
      "--warmup=5000",
      "--dataset=REPRESENTATIVE",
      "--dataset-scale=0.5",
      "--apps=2",
      "--workers=2",
      "--seed-events=5000",
      "--final",
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.targetRps).toBe(2);
      expect(r.config.durationMs).toBe(20_000);
      expect(r.config.warmupMs).toBe(5_000);
      expect(r.config.dataset).toBe("REPRESENTATIVE");
      expect(r.config.datasetScale).toBe(0.5);
      expect(r.config.apps).toBe(2);
      expect(r.config.workers).toBe(2);
      expect(r.config.seedEvents).toBe(5_000);
      expect(r.config.finalMode).toBe(true);
    }
  });

  it("rejects invalid dataset class and out-of-range scale", () => {
    expect(parseArgs(["--profile=smoke", "--dataset=BIG"]).ok).toBe(false);
    expect(parseArgs(["--profile=smoke", "--dataset-scale=2"]).ok).toBe(false);
    expect(parseArgs(["--profile=smoke", "--dataset-scale=0"]).ok).toBe(false);
  });

  it("new qualification/scenario profiles are registered", () => {
    for (const p of ["qual-steady", "qual-peak", "qual-burst", "qual-soak", "payment-steady", "payment-burst", "payment-concurrency", "booking-order-steady", "booking-order-burst", "login-qualification", "login-burst", "eventbus-steady", "eventbus-burst", "multi-instance"]) {
      expect(PROFILE_NAMES).toContain(p);
    }
  });
});

describe("perf outbox drain — bounded state-driven (round 2, F-1)", () => {
  interface DrainState {
    pending: number;
    retryable: number; // FAILED retryable=true attempts<max (retryFailed flips these)
    poison: number; // FAILED retryable=false OR exhausted — terminal, isolated
    publishedTotal: number;
    retriedTotal: number;
    publishCalls: number;
    retryCalls: number;
  }

  interface DrainConfig {
    /** Each processed event spawns one nested PENDING while budget > 0 (consumer chains). */
    spawnBudget: number;
    /** Simulate a retryable event that always fails on publish (flips back to retryable). */
    alwaysFailRetryable: boolean;
  }

  function makeMocks(initial: { pending?: number; retryable?: number; poison?: number }, cfg: Partial<DrainConfig> = {}) {
    const state: DrainState = {
      pending: initial.pending ?? 0,
      retryable: initial.retryable ?? 0,
      poison: initial.poison ?? 0,
      publishedTotal: 0,
      retriedTotal: 0,
      publishCalls: 0,
      retryCalls: 0,
    };
    const config: DrainConfig = { spawnBudget: cfg.spawnBudget ?? 0, alwaysFailRetryable: cfg.alwaysFailRetryable ?? false };
    const eventBus = {
      publishPending: jest.fn(async (limit: number) => {
        state.publishCalls++;
        const n = Math.min(state.pending, limit);
        state.pending -= n;
        if (config.alwaysFailRetryable) {
          // every processed event fails again → back to retryable (attempts<max forever in this mock)
          state.retryable += n;
          return 0; // nothing durably published
        }
        state.publishedTotal += n;
        const spawned = Math.min(n, config.spawnBudget);
        config.spawnBudget -= spawned;
        state.pending += spawned;
        return n;
      }),
      retryFailed: jest.fn(async (limit: number) => {
        state.retryCalls++;
        const n = Math.min(state.retryable, limit);
        state.retryable -= n;
        state.pending += n;
        state.retriedTotal += n;
        return n;
      }),
    };
    const prisma = {
      outboxEvent: {
        count: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
          if (where.status === "PENDING") return state.pending;
          if (where.status === "FAILED") {
            if (where.retryable === true && (where.attempts as { lt?: number })?.lt !== undefined) return state.retryable;
            return state.poison;
          }
          return 0;
        }),
      },
    };
    return { state, config, eventBus, prisma };
  }

  it("1. drains less than one batch (<200) and converges", async () => {
    const { state, eventBus, prisma } = makeMocks({ pending: 50 });
    const r = await drainOutbox(eventBus as never, prisma as never, { batchSize: 200 });
    expect(r.completed).toBe(true);
    expect(r.published).toBe(50);
    expect(r.iterations).toBe(1);
    expect(state.pending).toBe(0);
  });

  it("2. drains exactly one batch (200)", async () => {
    const { state, eventBus, prisma } = makeMocks({ pending: 200 });
    const r = await drainOutbox(eventBus as never, prisma as never, { batchSize: 200 });
    expect(r.completed).toBe(true);
    expect(r.published).toBe(200);
    expect(r.iterations).toBe(1);
    expect(state.pending).toBe(0);
  });

  it("3. drains >20×batch volume (4,200) — old 20-round bound no longer caps", async () => {
    const { state, eventBus, prisma } = makeMocks({ pending: 200 * 21 });
    const r = await drainOutbox(eventBus as never, prisma as never, { batchSize: 200 });
    expect(r.completed).toBe(true);
    expect(r.published).toBe(4_200);
    expect(r.iterations).toBe(21);
    expect(state.pending).toBe(0);
  });

  it("4. drains 5,000+ events (REPRESENTATIVE EventBus seed contract)", async () => {
    const { state, eventBus, prisma } = makeMocks({ pending: 5_000 });
    const r = await drainOutbox(eventBus as never, prisma as never, { batchSize: 200 });
    expect(r.completed).toBe(true);
    expect(r.published).toBe(5_000);
    expect(r.iterations).toBe(25);
    expect(state.pending).toBe(0);
  });

  it("5. continues when consumers emit nested PENDING events", async () => {
    // 1,000 initial events each spawn one nested event (OrderRequested→OrderCreated→…)
    const { state, eventBus, prisma } = makeMocks({ pending: 1_000 }, { spawnBudget: 1_000 });
    const r = await drainOutbox(eventBus as never, prisma as never, { batchSize: 200 });
    expect(r.completed).toBe(true);
    expect(r.published).toBe(2_000);
    expect(state.pending).toBe(0);
  });

  it("6. does not stop on a partial final batch (350 = 200 + 150)", async () => {
    const { state, eventBus, prisma } = makeMocks({ pending: 350 });
    const r = await drainOutbox(eventBus as never, prisma as never, { batchSize: 200 });
    expect(r.completed).toBe(true);
    expect(r.published).toBe(350);
    expect(r.iterations).toBe(2);
    expect(state.pending).toBe(0);
  });

  it("7. exits when healthy work is empty (poison retained, not blocking)", async () => {
    const { state, eventBus, prisma } = makeMocks({ pending: 0, retryable: 0, poison: 5 });
    const r = await drainOutbox(eventBus as never, prisma as never, { batchSize: 200 });
    expect(r.completed).toBe(true);
    expect(r.remainingPending).toBe(0);
    expect(r.remainingRetryableFailed).toBe(0);
    expect(state.poison).toBe(5); // poison untouched
  });

  it("8. poison/exhausted retained but never treated as healthy pending", async () => {
    const { state, eventBus, prisma } = makeMocks({ pending: 100, retryable: 0, poison: 3 });
    const r = await drainOutbox(eventBus as never, prisma as never, { batchSize: 200 });
    expect(r.completed).toBe(true);
    expect(r.published).toBe(100);
    expect(state.pending).toBe(0);
    expect(state.poison).toBe(3);
    expect(state.retryable).toBe(0);
  });

  it("9. non-converging retryable work hits the safety bound (fail-closed)", async () => {
    const { state, eventBus, prisma } = makeMocks({ pending: 1 }, { alwaysFailRetryable: true });
    await expect(drainOutbox(eventBus as never, prisma as never, { batchSize: 200, maxIterations: 5 })).rejects.toThrow("outbox did not drain within bound");
    expect(eventBus.publishPending).toHaveBeenCalledTimes(5);
    expect(state.pending).toBe(0);
    expect(state.retryable).toBe(1); // still retryable — never converged
  });

  it("10. diagnostics include remaining counts, iterations, elapsed and batch", async () => {
    const failing = makeMocks({ pending: 1 }, { alwaysFailRetryable: true });
    // maxIterations=3 → 3 work rounds, then the bound fires on the next iteration (reports 4).
    await expect(drainOutbox(failing.eventBus as never, failing.prisma as never, { batchSize: 50, maxIterations: 3 })).rejects.toThrow(/pending=\d+ retryableFailed=\d+ iterations=4 elapsedMs=\d+ batchSize=50/);
    const ok = makeMocks({ pending: 100 });
    const r = await drainOutbox(ok.eventBus as never, ok.prisma as never, { batchSize: 200 });
    expect(r.completed).toBe(true);
    expect(r.remainingPending).toBe(0);
    expect(r.remainingRetryableFailed).toBe(0);
    expect(r.batchSize).toBe(200);
    expect(r.published).toBe(100);
    expect(r.iterations).toBeGreaterThan(0);
    expect(r.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("11. no unbounded loop — maxIterations terminates a never-converging drain", async () => {
    const { eventBus, prisma } = makeMocks({ pending: 3 }, { alwaysFailRetryable: true });
    const started = Date.now();
    await expect(drainOutbox(eventBus as never, prisma as never, { batchSize: 200, maxIterations: 7 })).rejects.toThrow("outbox did not drain within bound");
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(eventBus.publishPending).toHaveBeenCalledTimes(7);
  });

  it("12. cleanup after seed failure deletes tracked rows (no orphan residue)", async () => {
    const registry = newRegistry();
    registry.users.push("u1");
    registry.products.push("p1");
    registry.customers.push("c1");
    const deletes: string[] = [];
    const prisma = {
      externalIdempotencyRecord: { deleteMany: jest.fn(async () => { deletes.push("idem"); return { count: 0 }; }) },
      outboxEvent: {
        findMany: jest.fn(async () => []),
        deleteMany: jest.fn(async () => { deletes.push("outbox"); return { count: 0 }; }),
      },
      inboxEvent: { deleteMany: jest.fn(async () => { deletes.push("inbox"); return { count: 0 }; }) },
      paymentHistory: { deleteMany: jest.fn(async () => ({ count: 0 })) },
      payment: { deleteMany: jest.fn(async () => ({ count: 0 })) },
      order: { deleteMany: jest.fn(async () => ({ count: 0 })) },
      availabilityReservation: { deleteMany: jest.fn(async () => ({ count: 0 })) },
      sale: { deleteMany: jest.fn(async () => ({ count: 0 })) },
      ledgerTransaction: { deleteMany: jest.fn(async () => ({ count: 0 })) },
      customer: { deleteMany: jest.fn(async () => ({ count: 0 })) },
      availability: { deleteMany: jest.fn(async () => ({ count: 0 })) },
      checkoutIntent: { deleteMany: jest.fn(async () => ({ count: 0 })) },
      quote: { deleteMany: jest.fn(async () => ({ count: 0 })) },
      product: { deleteMany: jest.fn(async () => ({ count: 0 })) },
      user: { deleteMany: jest.fn(async () => { deletes.push("user"); return { count: 0 }; }) },
    };
    const issues = await cleanup(prisma as never, registry);
    expect(issues).toEqual([]);
    expect(deletes).toContain("idem");
    expect(deletes).toContain("user");
  });

  it("contract: REPRESENTATIVE EventBus seed ≥5,000 is drainable in one drain call", async () => {
    expect(datasetCountsFor("REPRESENTATIVE").eventBusSeed).toBeGreaterThanOrEqual(5_000);
    // The F-1 defect failed here: 5,000 probes + nested chain events exceeded the
    // old 20×200=4,000 cap. The state-driven drain must converge with headroom.
    const { state, eventBus, prisma } = makeMocks({ pending: 5_000 }, { spawnBudget: 2_000 });
    const r = await drainOutbox(eventBus as never, prisma as never, { batchSize: 200 });
    expect(r.completed).toBe(true);
    expect(r.published).toBe(7_000);
    expect(r.iterations).toBeLessThan(100);
    expect(state.pending).toBe(0);
  });
});
