/**
 * PHASE 2 STEP 2.12A — PaymentProviderRegistry.
 *
 * One NestJS DI-based registry/resolver:
 *  - explicit registration (never dynamic arbitrary module loading);
 *  - deterministic resolution;
 *  - unknown provider → controlled NotFoundError (never raw 500);
 *  - duplicate registration → controlled ConflictError;
 *  - NO fallback to first provider, NO "default provider" without explicit
 *    canonical configuration;
 *  - production configuration registers NO provider today (registry empty —
 *    no production PSP selected); the test/fake provider is never registered
 *    by production code and cannot be selected by accident.
 *
 * Registry owns NO Payment business state and performs NO writes.
 */
import { Injectable } from "@nestjs/common";
import { ConflictError, NotFoundError } from "../../../shared/errors";
import type { PaymentProvider } from "./provider.types";

@Injectable()
export class PaymentProviderRegistry {
  private readonly providers = new Map<string, PaymentProvider>();

  /** Explicit registration. Duplicate code → controlled 409 conflict. */
  register(provider: PaymentProvider): void {
    if (this.providers.has(provider.code)) {
      throw new ConflictError(`Payment provider ${provider.code} is already registered`);
    }
    this.providers.set(provider.code, provider);
  }

  /** Deterministic resolution. Unknown provider → controlled 404, never 500. */
  get(code: string): PaymentProvider {
    const provider = this.providers.get(code);
    if (!provider) {
      throw new NotFoundError(`Payment provider ${code} is not registered`);
    }
    return provider;
  }

  /** Alias of get() — explicit resolver semantics for future adapters. */
  resolve(code: string): PaymentProvider {
    return this.get(code);
  }

  has(code: string): boolean {
    return this.providers.has(code);
  }

  /** Registered providers (production: empty set). */
  list(): PaymentProvider[] {
    return [...this.providers.values()];
  }
}
