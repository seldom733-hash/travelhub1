/**
 * Shared sorting helpers for all paginated operational tables.
 *
 * Contract:
 * - Single-column user sort only (no multi-sort)
 * - ASC ↔ DESC toggle
 * - Stable tie-breaker: always append `id` for deterministic pagination
 * - Allowlist prevents SQL injection via arbitrary sortBy values
 */

export type SortDirection = 'asc' | 'desc';

export const TIE_BREAKER = { id: 'desc' as SortDirection };

export function parseSortDirection(raw?: string): SortDirection {
  return raw?.toLowerCase() === 'asc' ? 'asc' : 'desc';
}

/**
 * Build a Prisma `orderBy` array from user-provided sort params.
 *
 * @param sortBy - user-selected sort key (matched against allowlist)
 * @param sortDirection - "asc" or "desc" (defaults to "desc")
 * @param allowlist - maps public sort keys to Prisma field names
 * @param defaultSort - fallback when no valid sort key is provided
 * @returns Array of Prisma orderBy objects (primary sort + id tie-breaker)
 */
export function buildSortClause(
  sortBy: string | undefined,
  sortDirection: string | undefined,
  allowlist: Record<string, string>,
  defaultSort: Record<string, SortDirection>,
): Record<string, SortDirection>[] {
  if (!sortBy || !(sortBy in allowlist)) {
    return [
      ...Object.entries(defaultSort).map(([k, v]) => ({ [k]: v })),
      TIE_BREAKER,
    ];
  }
  const dir = parseSortDirection(sortDirection);
  return [{ [allowlist[sortBy]]: dir }, TIE_BREAKER];
}
