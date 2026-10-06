/**
 * Supplier registry client (PHASE 4 §4.7 — registry SSOT).
 *
 * Single source for supplier {code, name} lists and display labels on the
 * client: everything comes from GET /api/v1/public/supplier/suppliers?service=
 * (backend registries — SupplierAdapterRegistry for tours/hotels,
 * FlightSupplierRegistry for flights). No hardcoded supplier label maps,
 * tabs, or option lists anywhere in the UI.
 *
 * Module-level cache + in-flight dedupe: one request per service per app
 * lifetime; failed fetches are NOT cached (next call retries).
 */
import { useEffect, useMemo, useState } from "react";

export type SupplierService = "tours" | "hotels" | "flights";

export interface SupplierOption {
  code: string;
  name: string;
}

const BASE = "/api/v1/public/supplier";
const cache = new Map<SupplierService, SupplierOption[]>();
const inflight = new Map<SupplierService, Promise<SupplierOption[]>>();

/** Fetch (and cache) the enabled suppliers of a service. */
export function listSuppliers(service: SupplierService): Promise<SupplierOption[]> {
  const cached = cache.get(service);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(service);
  if (pending) return pending;

  const request = fetch(`${BASE}/suppliers?service=${service}`, { cache: "no-store" })
    .then((res): Promise<unknown> => (res.ok ? res.json() : Promise.resolve([])))
    .then((data): SupplierOption[] => {
      const options = (Array.isArray(data) ? data : [])
        .filter((entry): entry is SupplierOption => !!entry && typeof entry.code === "string")
        .map((entry) => ({
          code: entry.code,
          name: typeof entry.name === "string" && entry.name ? entry.name : entry.code,
        }))
        .sort((x, y) => x.code.localeCompare(y.code));
      cache.set(service, options);
      inflight.delete(service);
      return options;
    })
    .catch((err) => {
      inflight.delete(service);
      throw err;
    });

  inflight.set(service, request);
  return request;
}

/** Display label for a supplier code: registry name, raw code as fallback. */
export function supplierLabel(options: SupplierOption[], code?: string | null): string {
  if (!code) return "";
  return options.find((option) => option.code === code)?.name ?? code;
}

/** Registry options of a service (cached; [] until loaded / on failure). */
export function useSupplierOptions(service: SupplierService): SupplierOption[] {
  const [options, setOptions] = useState<SupplierOption[]>(() => cache.get(service) ?? []);
  useEffect(() => {
    let alive = true;
    listSuppliers(service)
      .then((list) => {
        if (alive) setOptions(list);
      })
      .catch(() => {
        // Registry unavailable → keep current value (raw codes / previous cache).
      });
    return () => {
      alive = false;
    };
  }, [service]);
  return options;
}

/** code → registry name map for a service (cached). */
export function useSupplierLabels(service: SupplierService): Record<string, string> {
  const options = useSupplierOptions(service);
  return useMemo(
    () => Object.fromEntries(options.map((option) => [option.code, option.name])),
    [options],
  );
}
