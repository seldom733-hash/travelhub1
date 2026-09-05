/**
 * UI-C1.2F.1G — Requests sorting contract.
 *
 * Server-side sorting for the Requests registry, aligned with the shared
 * Operations Center sort contract (shared/sort.ts):
 *
 *   URL params:    sortBy=<canonical-key>&sortDirection=asc|desc
 *   Server:        buildSortClause with an explicit allowlist (never passes a
 *                  raw URL field into Prisma — explicit key → Prisma field map).
 *   Default:       createdAt desc (preserved — Requests default row order does
 *                  NOT change when no sort params are present).
 *   Stable pages:  primary sort + `id` tie-breaker (deterministic pagination —
 *                  equal referenceNumber/status/timestamp rows never drift).
 *
 * Nullable columns (displayedPrice, confirmedPrice, serviceDate →
 * requestedServiceDate, slaDeadline → supplierResponseDeadline): no explicit
 * `nulls` clause is emitted, so Prisma/PostgreSQL DB defaults apply — ascending
 * sorts place NULLs LAST, descending sorts place NULLs FIRST. This is the same
 * accidental-null ordering the rest of the Operations Center registries rely
 * on; it is intentionally left to the DB default (documented, not asserted as
 * a business rule).
 *
 * Validation (section 11/30 of the stage spec): an explicitly-present but
 * disallowed sortBy / malformed sortDirection is rejected with the canonical
 * Requests validation failure (BadRequestException → HTTP 400), the same
 * convention Requests dates use. Absent sort params keep the createdAt desc
 * default. `sortBy=__proto__`, `sortBy=tenantId`, `sortDirection=DROP…` never
 * reach the Prisma query builder.
 */

import { BadRequestException } from "@nestjs/common";
import { buildSortClause, type SortDirection } from "../../shared/sort";

/** Canonical Requests sort keys → Prisma Request field (explicit mapping). */
export const REQUEST_SORT_ALLOWLIST: Record<string, string> = {
  referenceNumber: "referenceNumber",
  displayedPrice: "displayedPrice",
  confirmedPrice: "confirmedPrice",
  serviceDate: "requestedServiceDate",
  status: "status",
  createdAt: "createdAt",
  slaDeadline: "supplierResponseDeadline",
};

/** Requests default sort (kept identical to the pre-sorting hardcoded order). */
export const REQUEST_DEFAULT_SORT: Record<string, SortDirection> = {
  createdAt: "desc",
};

/**
 * Build a deterministic Prisma `orderBy` array for a Requests list query.
 * Any missing/empty sort param falls back to `createdAt desc` + `id` tie-breaker.
 */
export function buildRequestOrderBy(
  sortBy: string | undefined,
  sortDirection: string | undefined,
): Record<string, SortDirection>[] {
  return buildSortClause(sortBy, sortDirection, REQUEST_SORT_ALLOWLIST, REQUEST_DEFAULT_SORT);
}

/**
 * Strict boundary validation for user-supplied sort params.
 *
 * - sortBy present but not in the allowlist → HTTP 400 canonical validation
 *   failure (raw keys — including `__proto__`, `tenantId`, SQL fragments — can
 *   never be forwarded to Prisma).
 * - sortDirection present but not asc|desc (case-insensitive) → HTTP 400.
 * - absent / empty params pass (default createdAt desc is applied downstream).
 */
export function assertValidRequestSort(sortBy?: string, sortDirection?: string): void {
  if (sortBy) {
    // Own-property check only: `in` also matches inherited Object.prototype keys
    // (__proto__, constructor) and must never pass the boundary.
    if (!Object.prototype.hasOwnProperty.call(REQUEST_SORT_ALLOWLIST, sortBy)) {
      throw new BadRequestException(
        `sortBy must be one of: ${Object.keys(REQUEST_SORT_ALLOWLIST).join(", ")}`,
      );
    }
  }
  if (sortDirection) {
    const dir = sortDirection.toLowerCase();
    if (dir !== "asc" && dir !== "desc") {
      throw new BadRequestException("sortDirection must be asc or desc");
    }
  }
}
