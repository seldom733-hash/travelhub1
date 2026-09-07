"use client";

import { useLocale, t, ti, LOCALE_TAGS, type Locale } from "@/lib/i18n";
import EntitySectionCard from "./EntitySectionCard";
import EntityRow from "./EntityRow";
import StatusBadge from "../StatusBadge";

/**
 * Canonical Commerce Entity Audit History (UI-C4).
 *
 * Immutable change-history presentation — WHO changed WHAT WHEN — shared by
 * Request / Order / Booking detail pages. This is NOT the business timeline
 * (EntityTimeline stays the milestones/current-stage presentation).
 *
 * Server-authoritative: pages feed whole normalized rows returned by the
 * backend history endpoints (`/requests/:id/history`, `/orders/:id/history`,
 * `/bookings/:id/history`). This component never invents events, statuses,
 * authors or old/new values — it renders only what the backend provided.
 *
 * Entity-specific grammar is supplied via props:
 *  - actionLabel        — localized action mapper (request/order/booking);
 *  - fieldLabel         — optional field-name localizer (Order `d3.field.*`);
 *  - renderFieldValue   — optional old/new value renderer (Order date masking);
 *  - onLoadMore/total   — optional pagination (Order);
 *  - emptyText          — optional empty-state override (Order disclaimer).
 */

/** Нормализованная запись истории изменений (per-entity history row). */
export interface EntityAuditHistoryRow {
  id: string;
  action: string;
  from: string | null;
  to: string | null;
  actorName: string | null;
  comment: string | null;
  createdAt: string;
  /** Structured field diff — только там, где backend пишет fields (Order). */
  fields?: Array<{ field: string; oldValue: string | null; newValue: string | null; redacted?: boolean }> | null;
}

function formatTs(iso: string | null, locale: Locale): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString(LOCALE_TAGS[locale]);
}

/** Default old/new renderer: ISO date fields → local date; null → em-dash. */
function renderFieldValueDefault(field: string, value: string | null): string {
  if (value === null) return "—";
  if (/birthDate|passportExpiry/.test(field)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString().slice(0, 10);
  }
  return value;
}

export default function EntityAuditHistory({
  items,
  total,
  loading = false,
  error = null,
  onLoadMore,
  actionLabel,
  fieldLabel,
  renderFieldValue = renderFieldValueDefault,
  emptyText,
  locale: localeProp,
}: {
  items: EntityAuditHistoryRow[];
  total?: number;
  loading?: boolean;
  error?: string | null;
  onLoadMore?: () => void;
  actionLabel: (action: string, locale: Locale) => string;
  fieldLabel?: (field: string, locale: Locale) => string;
  renderFieldValue?: (field: string, value: string | null) => string;
  emptyText?: string;
  /** Explicit locale override (testability; pages rely on useLocale()). */
  locale?: Locale;
}) {
  const contextLocale = useLocale();
  const locale = localeProp ?? contextLocale;

  return (
    <EntitySectionCard title={t("bookings.change_history", locale)}>
      {error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-xs text-red-600">{error}</div>
      ) : null}

      {!error && loading && items.length === 0 ? (
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-400">
          {t("crm.loading", locale)}
        </div>
      ) : null}

      {!error && !loading && items.length === 0 ? (
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-400">
          {emptyText ?? t("detail.history.empty", locale)}
        </div>
      ) : null}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((h) => (
            <EntityRow key={h.id} className="items-start">
              <div className="w-full">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700">{actionLabel(h.action, locale)}</span>
                  <span className="shrink-0 text-slate-400">{formatTs(h.createdAt, locale)}</span>
                </div>
                {(h.from || h.to) && (
                  <div className="mt-0.5 text-slate-500">
                    {h.from ? <StatusBadge status={h.from} /> : null}
                    {h.from && h.to ? <span className="mx-1 text-slate-400">→</span> : null}
                    {h.to ? <StatusBadge status={h.to} /> : null}
                  </div>
                )}
                {h.comment && <div className="mt-1 text-slate-500">{h.comment}</div>}
                {Array.isArray(h.fields) && h.fields.length > 0 && (
                  <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2">
                    {h.fields.map((f, idx) => {
                      const labelBase = f.field.includes("traveler[")
                        ? f.field.replace(/^traveler\[\d+\]\./, "")
                        : f.field;
                      return (
                        <li key={idx} className="flex flex-wrap items-center gap-1 text-[11px] text-slate-600">
                          <span className="font-medium">{fieldLabel ? fieldLabel(labelBase, locale) : labelBase}:</span>
                          <span className="text-slate-400 line-through">{renderFieldValue(labelBase, f.oldValue)}</span>
                          <span>→</span>
                          <span>{renderFieldValue(labelBase, f.newValue)}</span>
                          {f.redacted && <span className="text-amber-600">{t("order.history.redacted", locale)}</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {h.actorName && (
                  <div className="mt-1 text-slate-400">{ti("order.history.author", locale, { name: h.actorName })}</div>
                )}
              </div>
            </EntityRow>
          ))}
        </div>
      )}

      {onLoadMore && typeof total === "number" && items.length < total && (
        <button
          disabled={loading}
          onClick={onLoadMore}
          className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "…" : ti("order.history.show_more", locale, { n: total - items.length })}
        </button>
      )}
    </EntitySectionCard>
  );
}