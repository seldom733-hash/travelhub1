import { Injectable, Logger } from "@nestjs/common";
import type { SupplierAdapter, SupplierConfig } from "../supplier.types";

interface RegistryEntry {
  adapter: SupplierAdapter;
  config: SupplierConfig;
}

/**
 * Registry of supplier adapters — follows PaymentProviderRegistry pattern.
 *
 * Registered adapters are stored in-memory. Several category adapters may
 * share ONE provider code when their serviceTypes do not overlap (the
 * Provider → Category-Adapter model: ANEX registers an AnexAdapter for
 * "tours" and an AnexHotelAdapter for "hotels" — prompt §2). Duplicate
 * registrations for the SAME service still throw. Resolution fails closed
 * (throws NotFoundError) — never silently skip.
 *
 * Service-aware lookup: get(code, service) returns the adapter registered
 * for that service; without a service the FIRST registered adapter of the
 * code wins (legacy tours behavior for callers without category context).
 */
@Injectable()
export class SupplierAdapterRegistry {
  private readonly logger = new Logger(SupplierAdapterRegistry.name);
  private readonly entries: RegistryEntry[] = [];

  private static serviceTypesOverlap(a?: string[], b?: string[]): boolean {
    const left = a?.length ? a : undefined;
    const right = b?.length ? b : undefined;
    // A registration without serviceTypes is a legacy wildcard: it overlaps
    // every service, so a second registration of the same code is a conflict.
    if (!left || !right) return true;
    return left.some((s) => right.includes(s));
  }

  register(adapter: SupplierAdapter, config: SupplierConfig): void {
    const duplicate = this.entries.some(
      (e) =>
        e.adapter.code === adapter.code &&
        SupplierAdapterRegistry.serviceTypesOverlap(e.config.serviceTypes, config.serviceTypes),
    );
    if (duplicate) {
      this.logger.warn(`Duplicate supplier adapter code "${adapter.code}" — ignoring`);
      throw new Error(`Supplier adapter "${adapter.code}" already registered`);
    }
    this.entries.push({ adapter, config });
    this.logger.log(
      `Registered supplier adapter: ${adapter.code} (${adapter.name})` +
        (config.serviceTypes?.length ? ` [${config.serviceTypes.join(", ")}]` : ""),
    );
  }

  private pick(code: string, service?: string): RegistryEntry | undefined {
    const byCode = this.entries.filter((e) => e.adapter.code === code);
    if (byCode.length === 0) return undefined;
    if (service) {
      return (
        byCode.find((e) => e.config.serviceTypes?.includes(service)) ??
        // Legacy wildcard registration (no serviceTypes) serves any service.
        byCode.find((e) => !e.config.serviceTypes?.length)
      );
    }
    return byCode[0];
  }

  get(code: string, service?: string): SupplierAdapter {
    const entry = this.pick(code, service);
    if (!entry) {
      throw new Error(`Supplier adapter "${code}" not found`);
    }
    return entry.adapter;
  }

  getConfig(code: string, service?: string): SupplierConfig {
    const entry = this.pick(code, service);
    if (!entry) {
      throw new Error(`Supplier config "${code}" not found`);
    }
    return entry.config;
  }

  getAll(): SupplierAdapter[] {
    return this.entries.map((e) => e.adapter);
  }

  /** Adapter + config pairs — for callers that must know the registration's
   *  serviceTypes (same code can be registered per category). */
  getEntries(): Array<{ adapter: SupplierAdapter; config: SupplierConfig }> {
    return this.entries.map((e) => ({ adapter: e.adapter, config: e.config }));
  }

  getEnabled(): SupplierAdapter[] {
    return this.getAll().filter((a) => a.enabled);
  }

  isRegistered(code: string): boolean {
    return this.entries.some((e) => e.adapter.code === code);
  }
}
