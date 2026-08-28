"use client";

import { useCallback, useEffect, useState } from "react";
import { crmAnalyticsApi, type CrmAnalyticsResponse, type CrmAnalyticsPreset } from "@/lib/api";
import Kpi from "@/components/Kpi";
import { useLocale, t, type Locale } from "@/lib/i18n";

/**
 * Step 3.6 — CRM Analytics Consumer
 * Consumes GET /analytics/crm (shared backend, no new engine).
 * Platform scope: cross-partner.
 * Partner scope: own Partner.
 * `repeatCustomers` NOT included (no canonical definition).
 */
export default function CrmAnalytics() {
  const locale = useLocale();
  const [data, setData] = useState<CrmAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Period preset filter
  const [preset, setPreset] = useState<CrmAnalyticsPreset>("LAST_6_MONTHS");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await crmAnalyticsApi.getCrmAnalytics({ preset });
      setData(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [preset]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="text-sm text-slate-400">{t("crm.analytics.loading", locale)}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        <div className="font-medium">{t("crm.analytics.error", locale)}</div>
        <div className="mt-1 text-xs text-red-500">{error}</div>
        <button
          onClick={() => void load()}
          className="mt-2 rounded border border-red-300 bg-white px-3 py-1 text-xs text-red-600 hover:bg-red-50"
        >
          {t("crm.error.retry", locale)}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const m = data.metrics;

  // ── KPI Cards ──
  const kpiItems = [
    {
      label: t("crm.analytics.total_customers", locale),
      value: m.totalCustomers,
      icon: "👥",
    },
    {
      label: t("crm.analytics.total_relationships", locale),
      value: m.totalRelationships,
      icon: "🔗",
    },
    {
      label: t("crm.analytics.new_relationships", locale),
      value: m.newRelationships,
      icon: "🆕",
    },
    {
      label: t("crm.analytics.commercially_active", locale),
      value: m.commerciallyActiveCustomers,
      icon: "🛒",
    },
  ];

  // ── Breakdown helpers ──
  const breakdownEntries = (obj: Record<string, number> | null | undefined) =>
    obj ? Object.entries(obj).sort(([, a], [, b]) => b - a) : [];

  const lifecycleLabel = (key: string) => {
    const map: Record<string, { ru: string; az: string; en: string }> = {
      LEAD: { ru: "Лид", az: "Lider", en: "Lead" },
      PROSPECT: { ru: "Потенциальный", az: "Perspektivli", en: "Prospect" },
      ACTIVE: { ru: "Активный", az: "Aktiv", en: "Active" },
      CHURNED: { ru: "Ушедший", az: "Uzanmış", en: "Churned" },
      UNKNOWN: { ru: "Неизвестно", az: "Naməlum", en: "Unknown" },
    };
    return map[key]?.[locale] ?? key;
  };

  const sourceLabel = (key: string) => {
    const map: Record<string, { ru: string; az: string; en: string }> = {
      DIRECT: { ru: "Прямой", az: "Birbaşa", en: "Direct" },
      PHONE: { ru: "Телефон", az: "Telefon", en: "Phone" },
      OFFICE: { ru: "Офис", az: "Ofis", en: "Office" },
      EMAIL: { ru: "Email", az: "Email", en: "Email" },
      MARKETPLACE: { ru: "Маркетплейс", az: "Marketpleys", en: "Marketplace" },
      REFERRAL: { ru: "Рекомендация", az: "Tövsiyə", en: "Referral" },
      OTHER: { ru: "Другое", az: "Digər", en: "Other" },
      UNKNOWN: { ru: "Неизвестно", az: "Naməlum", en: "Unknown" },
      UNASSIGNED: { ru: "Не назначен", az: "Təyin edilməyib", en: "Unassigned" },
    };
    return map[key]?.[locale] ?? key;
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <Kpi items={kpiItems} />

      {/* Period Preset Filter */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="text-xs font-medium text-slate-500">{t("crm.analytics.filter.period", locale)}</span>
        {([
          { value: "TODAY" as CrmAnalyticsPreset, label: t("analytics.preset.TODAY", locale) },
          { value: "LAST_3_DAYS" as CrmAnalyticsPreset, label: t("analytics.preset.LAST_3_DAYS", locale) },
          { value: "LAST_7_DAYS" as CrmAnalyticsPreset, label: t("analytics.preset.LAST_7_DAYS", locale) },
          { value: "MONTH" as CrmAnalyticsPreset, label: t("analytics.preset.MONTH", locale) },
          { value: "LAST_6_MONTHS" as CrmAnalyticsPreset, label: t("analytics.preset.LAST_6_MONTHS", locale) },
          { value: "YEAR" as CrmAnalyticsPreset, label: t("analytics.preset.YEAR", locale) },
        ]).map((p) => (
          <button
            key={p.value}
            onClick={() => setPreset(p.value)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              preset === p.value
                ? "border-blue-400 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Lifecycle Breakdown */}
        <BreakdownCard
          title={t("crm.analytics.lifecycle", locale)}
          icon="🔄"
          entries={breakdownEntries(m.lifecycleBreakdown)}
          labelFn={lifecycleLabel}
          locale={locale}
        />

        {/* Source Breakdown */}
        <BreakdownCard
          title={t("crm.analytics.source", locale)}
          icon="📍"
          entries={breakdownEntries(m.sourceBreakdown)}
          labelFn={sourceLabel}
          locale={locale}
        />

        {/* Manager Breakdown */}
        <BreakdownCard
          title={t("crm.analytics.manager", locale)}
          icon="👤"
          entries={breakdownEntries(m.managerBreakdown)}
          labelFn={sourceLabel}
          locale={locale}
        />

        {/* New by Source */}
        <BreakdownCard
          title={t("crm.analytics.new_by_source", locale)}
          icon="🆕"
          entries={breakdownEntries(m.newBySource)}
          labelFn={sourceLabel}
          locale={locale}
        />
      </div>
    </div>
  );
}

// ── Breakdown Card Component ──
function BreakdownCard({
  title,
  icon,
  entries,
  labelFn,
  locale,
}: {
  title: string;
  icon: string;
  entries: [string, number][];
  labelFn: (key: string) => string;
  locale: Locale;
}) {
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <span className="text-base">{icon}</span>
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        <span className="ml-auto text-xs font-medium text-slate-400">
          {total}
        </span>
      </div>
      <div className="p-4">
        {entries.length === 0 ? (
          <div className="text-center text-xs text-slate-400">
            {t("crm.analytics.no_data", locale)}
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map(([key, count]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={key} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-700">
                        {labelFn(key)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
