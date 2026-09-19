import { Injectable, Logger } from "@nestjs/common";
import type { SupplierAdapter, SupplierConfig } from "../supplier.types";

/**
 * Registry of supplier adapters — follows PaymentProviderRegistry pattern.
 *
 * Registered adapters are stored in-memory. No duplicate codes allowed.
 * Resolution fails closed (throws NotFoundError) — never silently skip.
 */
@Injectable()
export class SupplierAdapterRegistry {
  private readonly logger = new Logger(SupplierAdapterRegistry.name);
  private readonly adapters = new Map<string, SupplierAdapter>();
  private readonly configs = new Map<string, SupplierConfig>();

  register(adapter: SupplierAdapter, config: SupplierConfig): void {
    if (this.adapters.has(adapter.code)) {
      this.logger.warn(`Duplicate supplier adapter code "${adapter.code}" — ignoring`);
      throw new Error(`Supplier adapter "${adapter.code}" already registered`);
    }
    this.adapters.set(adapter.code, adapter);
    this.configs.set(adapter.code, config);
    this.logger.log(`Registered supplier adapter: ${adapter.code} (${adapter.name})`);
  }

  get(code: string): SupplierAdapter {
    const adapter = this.adapters.get(code);
    if (!adapter) {
      throw new Error(`Supplier adapter "${code}" not found`);
    }
    return adapter;
  }

  getConfig(code: string): SupplierConfig {
    const config = this.configs.get(code);
    if (!config) {
      throw new Error(`Supplier config "${code}" not found`);
    }
    return config;
  }

  getAll(): SupplierAdapter[] {
    return Array.from(this.adapters.values());
  }

  getEnabled(): SupplierAdapter[] {
    return this.getAll().filter((a) => a.enabled);
  }

  isRegistered(code: string): boolean {
    return this.adapters.has(code);
  }
}
