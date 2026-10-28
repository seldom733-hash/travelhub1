import { t, type Locale } from "@/lib/i18n";

/**
 * User-facing category label. The catalog stores the legacy English category
 * title "Accommodation"; the site must show Hotel / Otel / Отель consistently.
 */
export function categoryLabel(
  category: { slug?: string | null; title?: string | null } | null | undefined,
  locale: Locale,
): string {
  if (!category) return "";
  if (category.slug === "accommodation") return t("marketplace.category_accommodation", locale);
  if (category.slug === "tours") return t("marketplace.category_tours", locale);
  return category.title ?? "";
}
