import { LOCALE_TAGS, type Locale } from "./i18n";

/**
 * D8 SHOULD #1 — shared TemporalDisplay (registry date formatting).
 *
 * Extracted verbatim from the four byte-identical registry-page `fmtDate`
 * implementations (orders/bookings/requests/payments list pages) so registry
 * date cells cannot drift. Boundary/validation/formatting authority remains
 * server-side (D8); this is display-only, no parsing authority.
 *
 * NOT extracted (intentional variances, different signatures — leave in place):
 *   - requests/[id]/page.tsx: detail-page variant (returns null for empty,
 *     inline arrow; different contract).
 *   - finance/payments/[id]/page.tsx: datetime variant (`toLocaleString`,
 *     inline locale ternary).
 *
 * Locale contract: RU/AZ/EN via BCP-47 tags from `LOCALE_TAGS` (@/lib/i18n).
 * Empty-value contract: `—` (em dash), identical to the extracted originals.
 */
export function fmtDate(iso: string | null, locale: Locale): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(LOCALE_TAGS[locale]);
}
