export type CatalogServiceType = "tours" | "hotels";

export interface CatalogTariffRecord {
  name: string;
  amount: number;
  currency: string;
  /** Departure/check-in date this price belongs to (nearest priced date). */
  validFrom?: string;
  inclusions?: Record<string, unknown>;
}

export interface CatalogRecord {
  supplierCode: string;
  serviceType: CatalogServiceType;
  /** Stable supplier reference, e.g. "KOMPAS-229-2807". */
  externalKey: string;
  productType: "TOUR" | "HOTEL";
  categorySlug: "tours" | "accommodation";
  title: string;
  countryCode: string | null;
  stateCode: string | null;
  hotelKey: string;
  hotelName: string;
  attributes: Record<string, unknown>;
  startingPrice: number;
  currency: string;
  tariffs: CatalogTariffRecord[];
}

export interface CatalogSourceResult {
  records: CatalogRecord[];
  /**
   * True only when the source proved it fetched the complete requested scope
   * (all programs, windows and pages). Safe archive is blocked otherwise.
   */
  complete: boolean;
  errors: string[];
  scope: Record<string, unknown>;
}

export interface CatalogCapability {
  supplierCode: string;
  name: string;
  serviceTypes: CatalogServiceType[];
  countries: Array<{ key: string; label: string }>;
  /** Human-readable reason when the catalog importer is not available. */
  unavailableReason?: string;
}

export type CatalogItemAction =
  | "CREATE"
  | "UPDATE"
  | "RESTORE"
  | "ARCHIVE"
  | "AMBIGUOUS"
  | "LEGACY_ARCHIVED"
  | "UNCHANGED"
  | "ERROR";

export interface CatalogPlanItem {
  productId: string | null;
  supplierRef: string | null;
  externalKey: string;
  action: CatalogItemAction;
  reason?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  error?: string;
}

export interface CatalogPlan {
  items: CatalogPlanItem[];
  counts: Record<string, number>;
  coverage: "COMPLETE" | "PARTIAL" | "FAILED";
  errors: string[];
  sourceRecords: CatalogRecord[];
}
