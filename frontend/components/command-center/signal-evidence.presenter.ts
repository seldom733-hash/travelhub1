/**
 * Decision Queue — Signal Evidence Presentation Adapters
 *
 * Maps raw machine-readable evidence fields to human-readable localized labels.
 * Each signal code has a deterministic presentation adapter.
 * No raw system field names visible to end users.
 *
 * Architecture: frontend presentation layer (localization is frontend responsibility).
 * Backend remains authority for evidence data; this module only formats for display.
 */

import { t, type Locale } from "../../lib/i18n";

// ── Types ────────────────────────────────────────────────────────────────────

interface EvidenceItem {
  key: string;
  value: string | number | string[];
  unit?: string;
}

/** A single rendered evidence line for the UI. */
export interface EvidenceDisplay {
  label: string;
  value: string;
  /** If true, render as a highlighted badge/chip rather than plain text. */
  highlight?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format minutes as human-readable duration: "5 ч 12 мин" / "3d 2h" */
function formatDuration(minutes: number, locale: Locale): string {
  if (minutes < 60) {
    return locale === "ru" ? `${minutes} мин` : locale === "az" ? `${minutes} dəq` : `${minutes}m`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) {
    const mPart = m > 0 ? ` ${m}${locale === "ru" ? " мин" : locale === "az" ? " dəq" : "m"}` : "";
    return `${h}${locale === "ru" ? " ч" : locale === "az" ? " saat" : "h"}${mPart}`;
  }
  const d = Math.floor(h / 24);
  const hRem = h % 24;
  const hPart = hRem > 0 ? ` ${hRem}${locale === "ru" ? " ч" : locale === "az" ? " saat" : "h"}` : "";
  return `${d}${locale === "ru" ? " дн" : locale === "az" ? " gün" : "d"}${hPart}`;
}

/** Format monetary value with AZN symbol */
function formatMoney(amount: number, locale: Locale): string {
  const formatted = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(amount);
  return `${formatted} ₼`;
}

/** Compact array display: first N items + "...and X more" */
function compactList(items: string[], maxShown: number, locale: Locale): string[] {
  if (items.length <= maxShown) return items;
  const shown = items.slice(0, maxShown);
  const remaining = items.length - maxShown;
  const moreText = locale === "ru"
    ? `и ещё ${remaining}`
    : locale === "az"
      ? `və ${remaining} daha`
      : `and ${remaining} more`;
  shown.push(moreText);
  return shown;
}

// ── Per-Signal Presenters ────────────────────────────────────────────────────

function presentPendingBookings(evidence: EvidenceItem[], locale: Locale): EvidenceDisplay[] {
  const get = (key: string) => evidence.find((e) => e.key === key);
  const result: EvidenceDisplay[] = [];

  const count = get("pendingConfirmationCount");
  if (count) result.push({
    label: t("cc.evidence.pendingConfirmationCount", locale),
    value: String(count.value),
    highlight: true,
  });

  const oldest = get("oldestPendingMinutes");
  if (oldest) result.push({
    label: t("cc.evidence.oldestPendingMinutes", locale),
    value: formatDuration(Number(oldest.value), locale),
  });

  const gmv = get("affectedGmv");
  if (gmv) result.push({
    label: t("cc.evidence.affectedGmv", locale),
    value: formatMoney(Number(gmv.value), locale),
  });

  const sla = get("slaThresholdMinutes");
  if (sla) result.push({
    label: t("cc.evidence.slaThresholdMinutes", locale),
    value: formatDuration(Number(sla.value), locale),
  });

  return result;
}

function presentFailedPayments(evidence: EvidenceItem[], locale: Locale): EvidenceDisplay[] {
  const get = (key: string) => evidence.find((e) => e.key === key);
  const result: EvidenceDisplay[] = [];

  const count = get("failedCount");
  if (count) result.push({
    label: t("cc.evidence.failedCount", locale),
    value: String(count.value),
    highlight: true,
  });

  const oldest = get("oldestFailedMinutes");
  if (oldest) result.push({
    label: t("cc.evidence.oldestFailedMinutes", locale),
    value: formatDuration(Number(oldest.value), locale),
  });

  const amount = get("totalFailedAmount");
  if (amount) result.push({
    label: t("cc.evidence.totalFailedAmount", locale),
    value: formatMoney(Number(amount.value), locale),
  });

  const groups = get("failureCodeGroups");
  if (groups) {
    // Parse and localize payment method distribution
    const raw = String(groups.value);
    const paymentMethodLabels: Record<string, Record<string, string>> = {
      BANK_TRANSFER: { ru: "Банковский перевод", az: "Bank köçürməsi", en: "Bank transfer" },
      CARD: { ru: "Карта", az: "Kart", en: "Card" },
      MOBILE_PAYMENT: { ru: "Мобильный платёж", az: "Mobil ödəniş", en: "Mobile payment" },
    };
    const formatted = raw.split(";").map((g) => {
      const [method, cnt] = g.split(":");
      const label = paymentMethodLabels[method]?.[locale] ?? method;
      return `${label}: ${cnt}`;
    }).join(", ");
    result.push({
      label: t("cc.evidence.failureCodeGroups", locale),
      value: formatted,
    });
  }

  return result;
}

function presentRecentCancellations(evidence: EvidenceItem[], locale: Locale): EvidenceDisplay[] {
  const get = (key: string) => evidence.find((e) => e.key === key);
  const result: EvidenceDisplay[] = [];

  const count = get("cancellationCount");
  if (count) result.push({
    label: t("cc.evidence.cancellationCount", locale),
    value: String(count.value),
    highlight: true,
  });

  const oldest = get("oldestCancellationMinutes");
  if (oldest) result.push({
    label: t("cc.evidence.oldestCancellationMinutes", locale),
    value: formatDuration(Number(oldest.value), locale),
  });

  const gmv = get("affectedGmv");
  if (gmv) result.push({
    label: t("cc.evidence.affectedGmv", locale),
    value: formatMoney(Number(gmv.value), locale),
  });

  const period = get("periodDays");
  if (period) result.push({
    label: t("cc.evidence.periodDays", locale),
    value: locale === "ru" ? `${period.value} дн.` : locale === "az" ? `${period.value} gün` : `${period.value}d`,
  });

  return result;
}

function presentPendingRefunds(evidence: EvidenceItem[], locale: Locale): EvidenceDisplay[] {
  const get = (key: string) => evidence.find((e) => e.key === key);
  const result: EvidenceDisplay[] = [];

  const count = get("pendingRefundCount");
  if (count) result.push({
    label: t("cc.evidence.pendingRefundCount", locale),
    value: String(count.value),
    highlight: true,
  });

  const oldest = get("oldestPendingMinutes");
  if (oldest) result.push({
    label: t("cc.evidence.oldestPendingMinutes", locale),
    value: formatDuration(Number(oldest.value), locale),
  });

  const amount = get("totalRefundAmount");
  if (amount) result.push({
    label: t("cc.evidence.totalRefundAmount", locale),
    value: formatMoney(Number(amount.value), locale),
  });

  return result;
}

function presentUpcomingBookings(evidence: EvidenceItem[], locale: Locale): EvidenceDisplay[] {
  const get = (key: string) => evidence.find((e) => e.key === key);
  const result: EvidenceDisplay[] = [];

  const count = get("upcomingCount");
  if (count) result.push({
    label: t("cc.evidence.upcomingCount", locale),
    value: String(count.value),
    highlight: true,
  });

  const days = get("daysUntilNearest");
  if (days) result.push({
    label: t("cc.evidence.daysUntilNearest", locale),
    value: Number(days.value) === 0
      ? (locale === "ru" ? "сегодня" : locale === "az" ? "bu gün" : "today")
      : locale === "ru" ? `через ${days.value} дн.` : locale === "az" ? `${days.value} gün sonra` : `in ${days.value}d`,
  });

  const gmv = get("totalUpcomingGmv");
  if (gmv) result.push({
    label: t("cc.evidence.totalUpcomingGmv", locale),
    value: formatMoney(Number(gmv.value), locale),
  });

  return result;
}

function presentServicesWithoutSales(evidence: EvidenceItem[], locale: Locale): EvidenceDisplay[] {
  const get = (key: string) => evidence.find((e) => e.key === key);
  const result: EvidenceDisplay[] = [];

  const unsoldCount = get("unsoldProductCount");
  if (unsoldCount) result.push({
    label: t("cc.evidence.unsoldProductCount", locale),
    value: String(unsoldCount.value),
    highlight: true,
  });

  const withAvail = get("withAvailabilityCount");
  const withoutAvail = get("withoutAvailabilityCount");
  if (withAvail || withoutAvail) {
    result.push({
      label: t("cc.evidence.availabilitySummary", locale),
      value: locale === "ru"
        ? `${withoutAvail?.value ?? 0} без доступности / ${withAvail?.value ?? 0} с доступностью`
        : locale === "az"
          ? `${withoutAvail?.value ?? 0} mövcudluq olmadan / ${withAvail?.value ?? 0} mövcudluqla`
          : `${withoutAvail?.value ?? 0} without / ${withAvail?.value ?? 0} with availability`,
    });
  }

  const names = get("productNames");
  if (names && Array.isArray(names.value)) {
    const items = compactList(names.value as string[], 3, locale);
    result.push({
      label: t("cc.evidence.productNames", locale),
      value: items.join(", "),
    });
  }

  const recent = get("recentlyPublishedCount");
  if (recent && Number(recent.value) > 0) {
    result.push({
      label: t("cc.evidence.recentlyPublishedCount", locale),
      value: locale === "ru"
        ? `${recent.value} недавно опубликовано`
        : locale === "az"
          ? `${recent.value} yaxınlarda nəşr olunub`
          : `${recent.value} recently published`,
    });
  }

  const longTerm = get("longTermUnsoldCount");
  if (longTerm && Number(longTerm.value) > 0) {
    result.push({
      label: t("cc.evidence.longTermUnsoldCount", locale),
      value: locale === "ru"
        ? `${longTerm.value} долгое время без продаж`
        : locale === "az"
          ? `${longTerm.value} uzun müddət satılmayıb`
          : `${longTerm.value} long-term unsold`,
    });
  }

  return result;
}

// ── Main Presenter ───────────────────────────────────────────────────────────

const PRESENTERS: Record<string, (evidence: EvidenceItem[], locale: Locale) => EvidenceDisplay[]> = {
  PENDING_BOOKINGS: presentPendingBookings,
  FAILED_PAYMENTS: presentFailedPayments,
  RECENT_CANCELLATIONS: presentRecentCancellations,
  PENDING_REFUNDS: presentPendingRefunds,
  UPCOMING_BOOKINGS: presentUpcomingBookings,
  SERVICES_WITHOUT_SALES: presentServicesWithoutSales,
};

/**
 * Present raw evidence items as human-readable display items.
 * Falls back to generic key:value rendering for unknown signal codes.
 */
export function presentEvidence(
  signalCode: string,
  evidence: EvidenceItem[],
  locale: Locale = "ru",
): EvidenceDisplay[] {
  const presenter = PRESENTERS[signalCode];
  if (presenter) {
    return presenter(evidence, locale);
  }
  // Fallback: generic but still use i18n key if available
  return evidence.map((ev) => ({
    label: t(`cc.evidence.${ev.key}`, locale) !== `cc.evidence.${ev.key}`
      ? t(`cc.evidence.${ev.key}`, locale)
      : ev.key,
    value: ev.unit ? `${ev.value} ${ev.unit}` : String(ev.value),
  }));
}

/**
 * Check if a signal code has a typed presenter (for testing/audit).
 */
export function hasPresenter(signalCode: string): boolean {
  return signalCode in PRESENTERS;
}
