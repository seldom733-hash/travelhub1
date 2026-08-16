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
