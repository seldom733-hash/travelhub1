/**
 * Parser for the SAMO inline hotel dictionary: every supplier form (KOMPAS,
 * SUMMERTOUR, KAZUNION — verified via plain HTTP) embeds the requested
 * state's FULL hotel list as `samo.hotelDynamic = [{id, name, star,
 * townKey, ...}, …]`.
 *
 * `id` is the value the supplier's own widget sends as HOTELS=<id>
 * (PRICES requests of all three adapters); `townKey` is in the same id
 * space as kind=TOWNS checklistbox values, so ingest can link a hotel to
 * its town's Master Geography (city/resort/country).
 */
export interface SamoHotelEntry {
  /** HOTELS= value (supplier hotel id). */
  id: string;
  /** Supplier hotel name, verbatim (matches offer hotel strings). */
  name: string;
  /** Supplier town id (kind=TOWNS externalId space). */
  townKey?: string;
}

export function parseSamoHotelDynamic(html: string): SamoHotelEntry[] {
  const marker = "samo.hotelDynamic";
  const mi = html.indexOf(marker);
  if (mi < 0) return [];
  const eq = html.indexOf("=", mi + marker.length);
  if (eq < 0) return [];
  const start = html.indexOf("[", eq);
  if (start < 0) return [];

  // Balanced scan over the JSON array, aware of string literals (hotel names
  // may contain brackets). Stops at the matching closing bracket.
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(html.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: SamoHotelEntry[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    const id = e.id !== undefined && e.id !== null ? String(e.id) : "";
    const name = typeof e.name === "string" ? e.name : "";
    if (!/^\d+$/.test(id) || !name.trim()) continue;
    out.push({
      id,
      name,
      ...(e.townKey !== undefined && e.townKey !== null ? { townKey: String(e.townKey) } : {}),
    });
  }
  return out;
}
