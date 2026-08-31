"use client";

/**
 * Shared Sales Channel Scope selector.
 *
 * Maps to backend `acquisitionSource` param:
 *   ALL         → no predicate (includes NULL/unknown)
 *   MARKETPLACE → acquisitionSource = MARKETPLACE
 *   STOREFRONT  → acquisitionSource = PARTNER_STOREFRONT
 */

import { useLocale, t } from "@/lib/i18n";

export type SalesChannelScope = "ALL" | "MARKETPLACE" | "STOREFRONT";

interface SalesChannelScopeProps {
  value: SalesChannelScope;
  onChange: (scope: SalesChannelScope) => void;
  className?: string;
}

/**
 * Maps UI scope to backend `acquisitionSource` param value.
 * ALL → undefined (no filter), MARKETPLACE → "MARKETPLACE", STOREFRONT → "PARTNER_STOREFRONT"
 */
export function scopeToAcquisitionSource(scope: SalesChannelScope): string | undefined {
  if (scope === "MARKETPLACE") return "MARKETPLACE";
  if (scope === "STOREFRONT") return "PARTNER_STOREFRONT";
  return undefined; // ALL → no predicate
}

export default function SalesChannelScope({ value, onChange, className = "" }: SalesChannelScopeProps) {
  const locale = useLocale();

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SalesChannelScope)}
      className={`rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400 ${className}`}
      aria-label={t("salesChannel.label", locale)}
    >
      <option value="ALL">{t("salesChannel.all", locale)}</option>
      <option value="MARKETPLACE">{t("salesChannel.marketplace", locale)}</option>
      <option value="STOREFRONT">{t("salesChannel.storefront", locale)}</option>
    </select>
  );
}
