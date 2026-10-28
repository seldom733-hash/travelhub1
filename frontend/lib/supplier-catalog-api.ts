import { api } from "./api";

export type SupplierCatalogServiceType = "tours" | "hotels";
export type SupplierCatalogRunServiceType = SupplierCatalogServiceType | "all";

export interface SupplierCatalogCapability {
  supplierCode: string;
  name: string;
  serviceTypes: SupplierCatalogServiceType[];
  countries: Array<{ key: string; label: string }>;
  unavailableReason?: string;
}

export type SupplierCatalogRunStatus =
  | "PREVIEWING"
  | "PREVIEW_READY"
  | "APPLYING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
  | "CANCELLED";

export interface SupplierCatalogRunItem {
  id: string;
  productId: string | null;
  supplierRef: string | null;
  externalKey: string;
  action: "CREATE" | "UPDATE" | "RESTORE" | "ARCHIVE" | "AMBIGUOUS" | "LEGACY_ARCHIVED" | "UNCHANGED" | "ERROR";
  reason: string | null;
  error: string | null;
  applied: boolean;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  /** Photo report: hotel file exists/uploaded or no photo available. */
  photo?: "YES" | "NO";
}

export interface SupplierCatalogRun {
  id: string;
  supplierCode: string;
  serviceType: string;
  countryCode: string | null;
  status: SupplierCatalogRunStatus;
  coverage: "COMPLETE" | "PARTIAL" | "FAILED";
  counts: Record<string, number> | null;
  errors: string[] | { fatal?: string } | null;
  scope: Record<string, unknown> | null;
  createdByName: string | null;
  createdAt: string;
  finishedAt: string | null;
  confirmedAt: string | null;
  items?: SupplierCatalogRunItem[];
}

export const supplierCatalogApi = {
  capabilities: () => api.get<SupplierCatalogCapability[]>("/supplier/catalog/capabilities"),
  runs: (limit = 30) => api.get<SupplierCatalogRun[]>(`/supplier/catalog/runs?limit=${limit}`),
  run: (id: string) => api.get<SupplierCatalogRun>(`/supplier/catalog/runs/${encodeURIComponent(id)}`),
  preview: (input: { supplierCode: string; serviceType: SupplierCatalogRunServiceType; countryKey: string }) =>
    api.post<SupplierCatalogRun>("/supplier/catalog/runs/preview", input),
  discoverCountries: (input: { supplierCode: string; serviceType: SupplierCatalogServiceType }) =>
    api.post<{ discovered: number; skipped: number; countries: Array<{ key: string; label: string }> }>(
      "/supplier/catalog/countries/discover",
      input,
    ),
  confirm: (id: string) => api.post<SupplierCatalogRun>(`/supplier/catalog/runs/${encodeURIComponent(id)}/confirm`),
  cancel: (id: string) => api.post<SupplierCatalogRun>(`/supplier/catalog/runs/${encodeURIComponent(id)}/cancel`),
  manualRestore: (runId: string, itemId: string) =>
    api.post<SupplierCatalogRun>(`/supplier/catalog/runs/${encodeURIComponent(runId)}/items/${encodeURIComponent(itemId)}/restore`),
};
