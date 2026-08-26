import { CrmActivitySourceType, CrmActivityActivityType, CrmActivitySubjectType } from '../../generated/prisma/enums';

// ─── Source Adapter Interface ───────────────────────────────────────────────

/**
 * Each source adapter maps canonical source data to a CrmActivity projection.
 * Adapters are stateless — they transform data, they don't write to the DB.
 */
export interface ActivityProjection {
  /** Stable dedup key: sourceType + sourceId + sourceEvent must be unique */
  sourceType: CrmActivitySourceType;
  sourceId: string;
  sourceEvent: string;
  activityType: CrmActivityActivityType;
  subjectType: CrmActivitySubjectType;
  subjectId: string;
  customerId: string | null;
  partnerId: string | null;
  occurredAt: Date;
  actorUserId: string | null;
  actorName: string | null;
  title: string;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  deepLink: string | null;
  visibility: string;
}

export interface SourceAdapter {
  readonly sourceType: CrmActivitySourceType;

  /** Project a source entity into an activity projection (or null to skip) */
  project(source: unknown): ActivityProjection | null;

  /** Backfill: query canonical sources and yield projections */
  backfill(prisma: unknown): Promise<ActivityProjection[]>;
}

// ─── Query Types ────────────────────────────────────────────────────────────

export interface ActivityQueryParams {
  subjectType: CrmActivitySubjectType;
  subjectId: string;
  activityType?: CrmActivityActivityType;
  sourceType?: CrmActivitySourceType;
  dateFrom?: Date;
  dateTo?: Date;
  cursor?: { occurredAt: Date; id: string };
  pageSize?: number;
}

export interface ActivityPage {
  items: ActivityProjection[];
  nextCursor: { occurredAt: Date; id: string } | null;
  hasMore: boolean;
}

// ─── Backfill Types ─────────────────────────────────────────────────────────

export interface BackfillResult {
  sourceType: CrmActivitySourceType;
  rowsScanned: number;
  rowsProjected: number;
  duplicatesSuppressed: number;
  rowsSkipped: number;
  errors: number;
  durationMs: number;
}

export interface BackfillReport {
  results: BackfillResult[];
  totalScanned: number;
  totalProjected: number;
  totalDuplicates: number;
  totalSkipped: number;
  totalErrors: number;
  totalDurationMs: number;
}

// ─── Display Constants ──────────────────────────────────────────────────────

/** Safe projection field sets per source type (architecture PII minimization) */
export const SAFE_PROJECTION_FIELDS: Record<CrmActivitySourceType, readonly string[]> = {
  [CrmActivitySourceType.OPERATIONAL_NOTE]: ['createdAt', 'authorName'] as const,
  [CrmActivitySourceType.ORDER]: ['createdAt', 'code', 'status', 'amount', 'currency'] as const,
  [CrmActivitySourceType.BOOKING]: ['createdAt', 'code', 'status'] as const,
  [CrmActivitySourceType.PAYMENT]: ['createdAt', 'paidAt', 'code', 'status', 'amount', 'currency'] as const,
  [CrmActivitySourceType.REFUND]: ['createdAt', 'processedAt', 'code', 'status', 'amount', 'currency', 'reason'] as const,
  [CrmActivitySourceType.MESSAGE]: ['occurredAt', 'type', 'direction', 'channel'] as const,
  [CrmActivitySourceType.AUDIT_EVENT]: ['createdAt', 'action', 'resource'] as const,
  [CrmActivitySourceType.CUSTOMER_HISTORY]: ['createdAt', 'action', 'from', 'to'] as const,
  [CrmActivitySourceType.BUYER_REQUEST]: ['createdAt', 'submittedAt', 'status'] as const,
  [CrmActivitySourceType.PARTNER_APPLICATION]: ['createdAt', 'status'] as const,
} as const;

/** Deep link patterns per source type */
export const DEEP_LINK_PATTERNS: Record<CrmActivitySourceType, ((sourceId: string) => string | null) | null> = {
  [CrmActivitySourceType.OPERATIONAL_NOTE]: null, // linked via parent entity
  [CrmActivitySourceType.ORDER]: (id) => `/app/orders/${id}`,
  [CrmActivitySourceType.BOOKING]: (id) => `/app/bookings/${id}`,
  [CrmActivitySourceType.PAYMENT]: (id) => `/app/crm/customers/${id}?tab=payments`,
  [CrmActivitySourceType.REFUND]: (id) => `/app/crm/customers/${id}?tab=refunds`,
  [CrmActivitySourceType.MESSAGE]: null, // no dedicated CRM route yet
  [CrmActivitySourceType.AUDIT_EVENT]: null, // no dedicated CRM route
  [CrmActivitySourceType.CUSTOMER_HISTORY]: null, // replaced by Activity tab
  [CrmActivitySourceType.BUYER_REQUEST]: null, // Buyer Cabinet (own-scope)
  [CrmActivitySourceType.PARTNER_APPLICATION]: null, // Partner onboarding
} as const;
