/**
 * UI-C1.2H.2 — Global Help Center navigation: pure, URL-deterministic query model.
 *
 * Everything the Help page derives from the URL lives here so it is unit-testable
 * without rendering: canonicalization of ?type/?area/?q, topic-list filtering and
 * per-type counts. The page (and only the page) is the consumer; no registry entry
 * or UI behavior elsewhere is affected.
 *
 * Rules:
 *  - taxonomy source is the canonical Registry (HELP_AREAS / HELP_CONTENT_AREAS /
 *    HELP_AREA_BY_DOMAIN / HELP_ENTRY_TYPES) — never a second hardcoded taxonomy;
 *  - type filters exist only for types that actually carry content today (kpi/status);
 *    group/concept/formula/workflow/policy are NOT selectable filters;
 *  - area filters are valid only for content areas (operations/finance); a future
 *    or unknown area canonicalizes to "no area filter" (never silently shows an
 *    unrelated section);
 *  - search matches Registry metadata ONLY (localized title/short/description,
 *    stable id, area, type) — never business data or API;
 *  - counts are derived from the Registry, never hardcoded.
 */
import { helpT } from "./help-i18n";
import type { Locale } from "./i18n";
import {
  helpAreaOf,
  helpDescription,
  helpShort,
  helpTitle,
  HELP_AREA_BY_DOMAIN,
  HELP_CONTENT_AREAS,
  type HelpArea,
  type HelpDomain,
  type HelpEntry,
  type HelpEntryType,
} from "./help-registry";

/** Content-bearing types that are user-selectable filters today (kpi=4, status=51). */
export const HELP_TYPE_FILTERS: readonly Extract<HelpEntryType, "kpi" | "status">[] = ["kpi", "status"] as const;
export type HelpTypeFilter = (typeof HELP_TYPE_FILTERS)[number];

/** Area filter valid values = content areas only (future areas are not filters). */
export const HELP_FILTERABLE_AREAS: readonly HelpArea[] = HELP_CONTENT_AREAS;

export interface HelpQuery {
  type?: HelpTypeFilter;
  area?: HelpArea;
  q?: string;
}

/** Deterministic canonicalization of the raw URL params (?type / ?area / ?q). */
export function parseHelpQuery(params: {
  type?: string | null;
  area?: string | null;
  q?: string | null;
}): HelpQuery {
  const type = params.type === "kpi" || params.type === "status" ? params.type : undefined;
  const area = HELP_CONTENT_AREAS.includes(params.area as HelpArea) ? (params.area as HelpArea) : undefined;
  const rawQ = (params.q ?? "").trim();
  const q = rawQ.length > 0 ? rawQ.slice(0, 120) : undefined;
  return { type, area, q };
}

/** Build the canonical query string (optionally preserving an active ?topic=). */
export function buildHelpQueryString(query: HelpQuery, keepTopic?: string | null): string {
  const sp = new URLSearchParams();
  if (keepTopic) sp.set("topic", keepTopic);
  if (query.type) sp.set("type", query.type);
  if (query.area) sp.set("area", query.area);
  if (query.q) sp.set("q", query.q);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Domain → area mapping (used by the page to place domains under their area). */
export function domainArea(domain: HelpDomain): HelpArea {
  return HELP_AREA_BY_DOMAIN[domain];
}

/** Lowercased, searchable projection of ONE entry (metadata only). */
function entryHaystack(entry: HelpEntry, locale: Locale): string {
  const parts = [
    helpTitle(entry, locale),
    helpShort(entry, locale),
    helpDescription(entry, locale),
    entry.id,
    helpAreaOf(entry),
    entry.type,
    helpT(`help.area.${helpAreaOf(entry)}`, locale),
  ];
  if (entry.aliases) parts.push(...entry.aliases);
  return parts.join(" ").toLowerCase();
}

/** True when the entry satisfies the query (type/area filters + full-text q). */
export function entryMatchesQuery(entry: HelpEntry, query: HelpQuery, locale: Locale): boolean {
  if (query.type && entry.type !== query.type) return false;
  if (query.area && helpAreaOf(entry) !== query.area) return false;
  if (query.q) {
    const haystack = entryHaystack(entry, locale);
    const tokens = query.q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.every((token) => haystack.includes(token))) return false;
  }
  return true;
}

/** Filter a list of entries by the query. */
export function filterHelpEntries(entries: readonly HelpEntry[], query: HelpQuery, locale: Locale): HelpEntry[] {
  return entries.filter((e) => entryMatchesQuery(e, query, locale));
}

/** Per-type counts of a list (kpi/status/group — derived, never hardcoded). */
export function countByType(entries: readonly HelpEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of entries) counts[e.type] = (counts[e.type] ?? 0) + 1;
  return counts;
}
