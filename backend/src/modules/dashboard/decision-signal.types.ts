// ─── Decision Signal Types (Stage B Foundation) ──────────────────────────────
// Hybrid model: dynamic facts (canonical queries) + persisted lifecycle state.
// These types define the API surface for signal CRUD and lifecycle operations.

// ── Enums ────────────────────────────────────────────────────────────────────

export type SignalCategory = "OPERATIONAL" | "FINANCIAL" | "CATALOG" | "CHANNEL";
export type SignalLifecycleStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";

// ── Affected Entity Reference ────────────────────────────────────────────────

export interface AffectedEntityRef {
  entityType: "ORDER" | "BOOKING" | "PAYMENT" | "PARTNER" | "PRODUCT" | "COMMISSION";
  entityId: string;
}

// ── Structured Evidence ──────────────────────────────────────────────────────

export interface SignalEvidenceItem {
  key: string;
  value: string | number;
  unit?: string;
  source: string;
  observedAt: string; // ISO timestamp
  entityRef?: AffectedEntityRef;
  period?: string;
}

// ── Signal Response (API) ────────────────────────────────────────────────────

export interface DecisionSignalResponse {
  id: string;
  code: string;
  category: SignalCategory;
  status: SignalLifecycleStatus;
  source: string;
  fingerprint: string;
  affectedEntities: AffectedEntityRef[];
  evidence: SignalEvidenceItem[];
  firstDetectedAt: string;
  lastDetectedAt: string;
  observationCount: number;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  dismissedAt?: string;
  dismissedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ── List Query ───────────────────────────────────────────────────────────────

export interface SignalListQuery {
  status?: SignalLifecycleStatus;
  /** Comma-separated multi-status filter, e.g. "OPEN,ACKNOWLEDGED" */
  statuses?: string;
  category?: SignalCategory;
  code?: string;
  page?: number;
  limit?: number;
}

export interface SignalListResponse {
  signals: DecisionSignalResponse[];
  total: number;
  page: number;
  limit: number;
}

// ── Lifecycle Mutation ───────────────────────────────────────────────────────

export interface AcknowledgeSignalDto {
  reason?: string;
}

export interface ResolveSignalDto {
  reason?: string;
}

export interface DismissSignalDto {
  reason?: string;
}

// ── Detector Contract ────────────────────────────────────────────────────────

export interface DetectedCondition {
  code: string;
  category: SignalCategory;
  fingerprint: string;
  affectedEntities: AffectedEntityRef[];
  evidence: SignalEvidenceItem[];
}

export interface DecisionSignalDetector {
  /** Unique detector identifier. */
  key: string;

  /** Detect current business conditions. Returns 0..N conditions. */
  detect(): Promise<DetectedCondition[]>;
}
