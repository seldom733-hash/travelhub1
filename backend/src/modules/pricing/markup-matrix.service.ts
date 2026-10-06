/**
 * Supplier Markup (STRICT PROMPT §4.1) — MarkupMatrixService.
 *
 * Admin «Supplier × Service» матрица наценок: строки/колонки СТРОЯТСЯ из
 * реестров (SupplierAdapterRegistry.getEntries() UNION
 * FlightSupplierRegistry.list()) — без хардкод-списков поставщиков и
 * сервисов, поэтому новый supplier/service расширяет матрицу без изменения
 * кода (Gate A). Ячейка = resolve активного правила на текущий instant:
 * CONFIGURED (rate/ruleCode/ruleVersion) либо NOT_CONFIGURED (0%).
 *
 * Fail-closed: matrix — admin-инструмент, поэтому используется строгий
 * resolve (сбой чтения правила → ошибка видна админу, а НЕ маскируется под
 * NOT_CONFIGURED). Ячейки только для реально поддерживаемых пар
 * (supplier-supports-service), Decimal сериализуется строкой (никаких
 * Decimal в HTTP-теле).
 */
import { Injectable } from "@nestjs/common";
import { SupplierAdapterRegistry } from "../supplier/adapter/supplier-adapter.registry";
import { FlightSupplierRegistry } from "../supplier/flight-supplier.registry";
import { SupplierPricingService } from "./supplier-pricing.service";

/** Сервис FlightSupplierRegistry (реестр живёт вне adapter-реестра). */
export const FLIGHTS_SERVICE = "flights";

export interface MarkupMatrixCell {
  supplierCode: string;
  serviceType: string;
  state: "CONFIGURED" | "NOT_CONFIGURED";
  /** Decimal-строка: "0" для NOT_CONFIGURED, иначе активный rate (0.05 = 5%). */
  rate: string;
  ruleCode: string | null;
  ruleVersion: number | null;
}

export interface MarkupMatrixSupplier {
  code: string;
  name: string;
  enabled: boolean;
}

export interface MarkupMatrix {
  /** ISO-момент, на который разрешены ячейки (для effective-окон правил). */
  at: string;
  /** Колонки — производная реестров (tours/hotels/flights и будущие). */
  services: string[];
  suppliers: MarkupMatrixSupplier[];
  cells: MarkupMatrixCell[];
}

interface MatrixRow {
  code: string;
  name: string;
  enabled: boolean;
  services: Set<string>;
  /** Legacy wildcard-регистрация (без serviceTypes) поддерживает ВСЕ сервисы. */
  wildcard: boolean;
}

@Injectable()
export class MarkupMatrixService {
  constructor(
    private readonly pricing: SupplierPricingService,
    private readonly adapters: SupplierAdapterRegistry,
    private readonly flights: FlightSupplierRegistry,
  ) {}

  async build(at: Date = new Date()): Promise<MarkupMatrix> {
    const adapterEntries = this.adapters.getEntries();
    const flightCodes = this.flights.list();

    // ── Колонки: производная реестров (никакого хардкода сервисов) ─────────
    const serviceSet = new Set<string>();
    for (const { config } of adapterEntries) {
      for (const service of config.serviceTypes ?? []) serviceSet.add(service);
    }
    if (flightCodes.length > 0) serviceSet.add(FLIGHTS_SERVICE);
    const services = [...serviceSet].sort((a, b) => a.localeCompare(b));

    // ── Строки: UNION adapter-реестра и FlightSupplierRegistry ─────────────
    const rows = new Map<string, MatrixRow>();
    const upsert = (code: string, name: string, enabled: boolean): MatrixRow => {
      const existing = rows.get(code);
      if (existing) {
        existing.enabled = existing.enabled || enabled;
        if (!existing.name && name) existing.name = name;
        return existing;
      }
      const row: MatrixRow = { code, name, enabled, services: new Set(), wildcard: false };
      rows.set(code, row);
      return row;
    };

    for (const { adapter, config } of adapterEntries) {
      const row = upsert(adapter.code, adapter.name, adapter.enabled);
      const types = config.serviceTypes ?? [];
      if (types.length === 0) {
        row.wildcard = true;
      } else {
        for (const service of types) row.services.add(service);
      }
    }
    for (const code of flightCodes) {
      const supplier = this.flights.get(code);
      const row = upsert(supplier.code, supplier.name, true);
      row.services.add(FLIGHTS_SERVICE);
    }

    const suppliers: MarkupMatrixSupplier[] = [...rows.values()]
      .map((row) => ({ code: row.code, name: row.name || row.code, enabled: row.enabled }))
      .sort((a, b) => a.code.localeCompare(b.code));

    // ── Ячейки: только поддерживаемые пары, строгий resolve на at ──────────
    const cells: MarkupMatrixCell[] = [];
    const orderedRows = [...rows.values()].sort((a, b) => a.code.localeCompare(b.code));
    for (const row of orderedRows) {
      const rowServices = row.wildcard ? services : [...row.services].sort((a, b) => a.localeCompare(b));
      for (const serviceType of rowServices) {
        const resolved = await this.pricing.resolve(row.code, serviceType, at);
        cells.push({
          supplierCode: row.code,
          serviceType,
          state: resolved.state,
          rate: resolved.rate.toString(),
          ruleCode: resolved.ruleCode,
          ruleVersion: resolved.ruleVersion,
        });
      }
    }

    return { at: at.toISOString(), services, suppliers, cells };
  }
}
