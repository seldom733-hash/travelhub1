import { Injectable, Logger } from "@nestjs/common";

/**
 * Token-bucket rate limiter + circuit breaker for supplier HTTP calls.
 *
 * Rate limiter: token bucket per supplier (configurable RPM, concurrency).
 * Circuit breaker: consecutive failures → open → half-open → close.
 * Request coalescing: in-flight dedup per query key.
 */
@Injectable()
export class SupplierResilienceService {
  private readonly logger = new Logger(SupplierResilienceService.name);

  // ── Rate Limiter (Token Bucket) ─────────────────────────────────────

  private readonly buckets = new Map<string, { tokens: number; lastRefill: number; maxTokens: number; refillRate: number }>();
  private readonly inflight = new Map<string, number>();

  acquireBucket(supplierCode: string, maxConcurrency: number, requestsPerMinute: number): void {
    const now = Date.now();
    let bucket = this.buckets.get(supplierCode);
    if (!bucket) {
      bucket = { tokens: maxConcurrency, lastRefill: now, maxTokens: maxConcurrency, refillRate: requestsPerMinute / 60_000 };
      this.buckets.set(supplierCode, bucket);
    }

    // Refill tokens
    const elapsed = now - bucket.lastRefill;
    const refill = elapsed * bucket.refillRate;
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + refill);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      this.logger.warn(`Rate limit exceeded for supplier ${supplierCode}`);
      throw new Error(`Rate limit exceeded for supplier ${supplierCode}`);
    }
    bucket.tokens -= 1;
  }

  incrementInflight(supplierCode: string, maxConcurrency: number): void {
    const current = this.inflight.get(supplierCode) ?? 0;
    if (current >= maxConcurrency) {
      this.logger.warn(`Concurrency limit exceeded for supplier ${supplierCode} (${current}/${maxConcurrency})`);
      throw new Error(`Concurrency limit exceeded for supplier ${supplierCode}`);
    }
    this.inflight.set(supplierCode, current + 1);
  }

  decrementInflight(supplierCode: string): void {
    const current = this.inflight.get(supplierCode) ?? 0;
    this.inflight.set(supplierCode, Math.max(0, current - 1));
  }

  getInflight(supplierCode: string): number {
    return this.inflight.get(supplierCode) ?? 0;
  }

  // ── Circuit Breaker ─────────────────────────────────────────────────

  private readonly circuits = new Map<string, { state: "CLOSED" | "OPEN" | "HALF_OPEN"; failures: number; lastFailure: number; threshold: number; openMs: number }>();

  initCircuit(supplierCode: string, threshold: number, openMs: number): void {
    if (!this.circuits.has(supplierCode)) {
      this.circuits.set(supplierCode, { state: "CLOSED", failures: 0, lastFailure: 0, threshold, openMs });
    }
  }

  recordSuccess(supplierCode: string): void {
    const circuit = this.circuits.get(supplierCode);
    if (!circuit) return;
    circuit.failures = 0;
    circuit.state = "CLOSED";
  }

  recordFailure(supplierCode: string): void {
    const circuit = this.circuits.get(supplierCode);
    if (!circuit) return;
    circuit.failures += 1;
    circuit.lastFailure = Date.now();
    if (circuit.failures >= circuit.threshold) {
      circuit.state = "OPEN";
      this.logger.warn(`Circuit OPEN for supplier ${supplierCode} after ${circuit.failures} failures`);
    }
  }

  isCircuitOpen(supplierCode: string): boolean {
    const circuit = this.circuits.get(supplierCode);
    if (!circuit) return false;

    if (circuit.state === "CLOSED") return false;

    if (circuit.state === "OPEN") {
      if (Date.now() - circuit.lastFailure > circuit.openMs) {
        circuit.state = "HALF_OPEN";
        this.logger.log(`Circuit HALF_OPEN for supplier ${supplierCode}`);
        return false;
      }
      return true;
    }

    // HALF_OPEN — allow one request
    return false;
  }

  // ── Request Coalescing ──────────────────────────────────────────────

  private readonly coalescing = new Map<string, Promise<unknown>>();

  async coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.coalescing.get(key);
    if (existing) {
      // Wait for in-flight request
      return existing as Promise<T>;
    }

    const promise = fn().finally(() => {
      this.coalescing.delete(key);
    });
    this.coalescing.set(key, promise);
    return promise;
  }

  // ── Retry with Backoff ──────────────────────────────────────────────

  async withRetry<T>(
    supplierCode: string,
    fn: () => Promise<T>,
    maxRetries: number = 2,
    baseDelayMs: number = 1000,
  ): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err as Error;
        this.recordFailure(supplierCode);
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
          this.logger.warn(`Retry ${attempt + 1}/${maxRetries} for supplier ${supplierCode} after ${Math.round(delay)}ms`);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  }

  // ── Stats ───────────────────────────────────────────────────────────

  stats(): Record<string, { state: string; failures: number; inflight: number }> {
    const result: Record<string, { state: string; failures: number; inflight: number }> = {};
    for (const [code, circuit] of this.circuits) {
      result[code] = {
        state: circuit.state,
        failures: circuit.failures,
        inflight: this.inflight.get(code) ?? 0,
      };
    }
    return result;
  }
}
