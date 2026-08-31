"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/use-user";
import {
  useWorkspaceLayout,
  useWorkspaceCustomize,
  useWorkspaceAvailableWidgets,
} from "@/lib/use-workspace";
import {
  type WidgetDefinition,
  type WidgetPosition,
} from "@/lib/workspace-api";
import {
  dashboardApi,
  type CommandCenterSummary,
  type PeriodPreset,
  type DashboardQueryParams,
  validateCustomRange,
  HttpError,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/dashboard-api";
import { useLocale, t, type Locale } from "@/lib/i18n";
import { PeriodSelector } from "./PeriodSelector";
import { SectionGrid } from "./SectionGrid";
import { CustomizePanel } from "./CustomizePanel";
import SalesChannelScope, { type SalesChannelScope as ChannelScope, scopeToAcquisitionSource } from "@/components/SalesChannelScope";

const PAGE_ID = "command-center";
const DEFAULT_PRESET: PeriodPreset = "MONTH";

const VALID_PRESETS: readonly PeriodPreset[] = [
  "TODAY", "LAST_3_DAYS", "LAST_7_DAYS", "MONTH", "LAST_6_MONTHS", "YEAR", "CUSTOM",
] as const;

function isValidPreset(v: string): v is PeriodPreset {
  return (VALID_PRESETS as readonly string[]).includes(v);
}

/** Known Command Center widget IDs — used for layout fallback. */
const ALL_CC_WIDGET_IDS = [
  "gmv", "revenue", "refunds", "orders", "bookings", "aov", "conversion",
  "orders-trend", "bookings-trend", "revenue-trend",
  "funnel",
  "commission", "reconciliation", "payments", "net-payments",
  "sessions", "storefront-sessions", "partners", "customers",
];

/** Build safe default positions from authorized sections when layout is empty/unavailable. */
function buildFallbackPositions(
  authorizedSections: string[],
  defs: WidgetDefinition[],
): WidgetPosition[] {
  const positions: WidgetPosition[] = [];
  let y = 0;
  for (const section of authorizedSections) {
    const sectionDefs = defs.filter(
      (d) => d.sectionPermission?.includes(section) || d.pageIds.includes(PAGE_ID),
    );
    let x = 0;
    let rowH = 0;
    for (const def of sectionDefs) {
      if (x + def.defaultW > 12) { x = 0; y += rowH; rowH = 0; }
      positions.push({
        widgetId: def.widgetId, x, y,
        w: def.defaultW, h: def.defaultH, visible: true,
      });
      x += def.defaultW;
      rowH = Math.max(rowH, def.defaultH);
    }
    if (x > 0) y += rowH;
  }
  // If no definitions available, create minimal fallback for known IDs
  if (positions.length === 0) {
    let fx = 0; let fy = 0;
    for (const id of ALL_CC_WIDGET_IDS) {
      if (fx + 1 > 12) { fx = 0; fy += 1; }
      positions.push({ widgetId: id, x: fx, y: fy, w: 1, h: 1, visible: true });
      fx += 1;
    }
  }
  return positions;
}

export function CommandCenter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useCurrentUser();
  const permissions = user?.permissions ?? [];
  const locale: Locale = useLocale();

  // ── URL-synced period state ────────────────────────────────────────
  const urlPreset = searchParams.get("preset") ?? "";
  const urlComparison = searchParams.get("comparison");
  const urlStart = searchParams.get("start") ?? "";
  const urlEnd = searchParams.get("end") ?? "";

  const periodPreset: PeriodPreset = isValidPreset(urlPreset)
    ? urlPreset
    : DEFAULT_PRESET;
  const comparison = urlComparison !== "false";
  const customStart = periodPreset === "CUSTOM" ? urlStart : "";
  const customEnd = periodPreset === "CUSTOM" ? urlEnd : "";

  // ── URL-synced channel scope ──────────────────────────────────────
  const urlChannel = (searchParams.get("channel") ?? "ALL").toUpperCase();
  const channelScope: ChannelScope =
    urlChannel === "MARKETPLACE" || urlChannel === "STOREFRONT" ? urlChannel : "ALL";
  const setChannelScope = useCallback(
    (scope: ChannelScope) => {
      const params = new URLSearchParams(searchParams.toString());
      if (scope === "ALL") params.delete("channel");
      else params.set("channel", scope);
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const updateUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null) params.delete(k);
        else params.set(k, v);
      }
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const handlePresetChange = useCallback(
    (preset: PeriodPreset) => {
      const updates: Record<string, string | null> = { preset };
      if (preset !== "CUSTOM") { updates.start = null; updates.end = null; }
      updateUrl(updates);
    },
    [updateUrl],
  );
  const handleComparisonChange = useCallback((on: boolean) => updateUrl({ comparison: String(on) }), [updateUrl]);
  const handleCustomStartChange = useCallback((v: string) => updateUrl({ start: v }), [updateUrl]);
  const handleCustomEndChange = useCallback((v: string) => updateUrl({ end: v }), [updateUrl]);

  // ── CUSTOM validation ─────────────────────────────────────────────
  const customError = useMemo(() => {
    if (periodPreset !== "CUSTOM") return null;
    return validateCustomRange(customStart, customEnd);
  }, [periodPreset, customStart, customEnd]);

  // ── Data state ────────────────────────────────────────────────────
  const [summary, setSummary] = useState<CommandCenterSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);

  // Workspace layout + definitions
  const { layout, loading: layoutLoading, error: layoutError, saveLayout, resetLayout } = useWorkspaceLayout(PAGE_ID);
  const { widgets: allWidgetDefs, loading: defsLoading } = useWorkspaceAvailableWidgets(PAGE_ID);
  const hasCustomizePermission = permissions.includes("dashboard.customize");
  const customize = useWorkspaceCustomize(layout, permissions);

  // Server-authoritative sections
  const authorizedSections = summary?.availableSections ?? [];

  // ── Fetch summary ─────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    if (periodPreset === "CUSTOM" && customError) {
      setSummaryError(customError);
      setSummaryLoading(false); // R2-06: don't leave infinite loading
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const seq = ++sequenceRef.current;

    setSummaryLoading(true);
    setSummaryError(null);

    try {
      const params: DashboardQueryParams = {
        preset: periodPreset,
        timezone: "UTC",
        comparison,
        acquisitionSource: scopeToAcquisitionSource(channelScope),
      };
      if (periodPreset === "CUSTOM") {
        params.startDate = customStart;
        params.endDate = customEnd;
      }
      const data = await dashboardApi.getSummary(params, controller.signal);
      if (seq === sequenceRef.current) setSummary(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (seq !== sequenceRef.current) return;
      // R2-09: typed error classification
      if (err instanceof UnauthorizedError) setSummaryError("unauthorized");
      else if (err instanceof ForbiddenError) setSummaryError("forbidden");
      else if (err instanceof HttpError) setSummaryError(`server-error-${err.status}`);
      else setSummaryError("network-error");
    } finally {
      if (seq === sequenceRef.current) setSummaryLoading(false);
    }
  }, [periodPreset, comparison, customStart, customEnd, customError, channelScope]);

  useEffect(() => {
    fetchSummary();
    return () => abortRef.current?.abort();
  }, [fetchSummary]);

  // ── Mutation state ────────────────────────────────────────────────
  const [mutationPending, setMutationPending] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!customize.draft.length || mutationPending) return;
    setMutationPending(true);
    setMutationError(null);
    try {
      const result = await saveLayout(customize.draft);
      // R2-16: use server-returned layout
      customize.cancelCustomize();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setMutationError(msg);
      // Stay in edit mode on failure
    } finally {
      setMutationPending(false);
    }
  }, [customize, saveLayout, mutationPending]);

  const handleReset = useCallback(async () => {
    if (mutationPending) return;
    setMutationPending(true);
    setMutationError(null);
    try {
      const result = await resetLayout();
      // R2-16: use server-returned default layout
      customize.cancelCustomize();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      setMutationError(msg);
    } finally {
      setMutationPending(false);
    }
  }, [resetLayout, customize, mutationPending]);

  // ── Layout resolution ─────────────────────────────────────────────
  const hasAnySection = authorizedSections.length > 0;
  const layoutFailed = !layoutLoading && layout === null;
  const defsFailed = !defsLoading && allWidgetDefs.length === 0 && !layoutLoading;

  // R2-04/R2-15: Use all definitions from workspace endpoint
  const activeWidgetDefs = allWidgetDefs;

  // R2-08: Build fallback positions when layout is empty but summary exists
  const effectivePositions = useMemo(() => {
    if (customize.editing && customize.draft.length > 0) return customize.draft;
    if (layout && layout.widgets.length > 0) return layout.widgets;
    // Fallback: build from definitions + authorized sections
    if (summary && activeWidgetDefs.length > 0) {
      return buildFallbackPositions(authorizedSections, activeWidgetDefs);
    }
    // Last resort: minimal known widget positions
    if (summary) {
      return buildFallbackPositions(authorizedSections, []);
    }
    return [];
  }, [customize.editing, customize.draft, layout, summary, activeWidgetDefs, authorizedSections]);

  // ── Render ────────────────────────────────────────────────────────

  if (summaryLoading && !summary) {
    return (
      <div className="p-6 lg:p-10">
        <h1 className="text-2xl font-bold text-slate-900">{t("cc.title", locale)}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("cc.loading", locale)}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (summaryError === "unauthorized") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl">🔑</div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">{t("cc.auth_required", locale)}</h1>
        <p className="mt-2 text-sm text-slate-500">{t("cc.auth_hint", locale)}</p>
      </div>
    );
  }

  if (summaryError === "forbidden") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">{t("cc.access_denied", locale)}</h1>
        <p className="mt-2 text-sm text-slate-500">{t("cc.access_denied_hint", locale)}</p>
      </div>
    );
  }

  if (summary && !hasAnySection) {
    return (
      <div className="p-6 lg:p-10">
        <h1 className="text-2xl font-bold text-slate-900">{t("cc.title", locale)}</h1>
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
          <div className="text-3xl">📊</div>
          <p className="mt-3 text-sm text-slate-500">{t("cc.no_sections", locale)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("cc.title", locale)}</h1>
          <p className="mt-1 text-sm text-slate-500">{t(`cc.subtitle.${channelScope.toLowerCase()}`, locale) || t("cc.subtitle", locale)} · UTC</p>
        </div>
        <div className="flex items-center gap-3">
          <SalesChannelScope value={channelScope} onChange={setChannelScope} />
          <PeriodSelector
            preset={periodPreset} comparison={comparison}
            customStart={customStart} customEnd={customEnd} customError={customError}
            onPresetChange={handlePresetChange} onComparisonChange={handleComparisonChange}
            onCustomStartChange={handleCustomStartChange} onCustomEndChange={handleCustomEndChange}
            locale={locale}
          />
          {hasCustomizePermission && layout?.constructorEnabled && (
            <button
              onClick={customize.editing ? customize.cancelCustomize : customize.enterCustomize}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                customize.editing ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-blue-50 text-blue-600 hover:bg-blue-100"
              }`}
              aria-label={customize.editing ? t("cc.cancel", locale) : t("cc.customize", locale)}
            >
              {customize.editing ? t("cc.cancel", locale) : t("cc.customize", locale)}
            </button>
          )}
        </div>
      </div>

      {customError && periodPreset === "CUSTOM" && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {customError}
        </div>
      )}

      {summaryError && summary && summaryError !== "forbidden" && summaryError !== "unauthorized" && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {t("cc.update_error", locale)}: {summaryError}
          <button onClick={fetchSummary} className="ml-2 underline">{t("cc.retry", locale)}</button>
        </div>
      )}

      {layoutFailed && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {t("cc.layout_unavailable", locale)}
        </div>
      )}

      {mutationError && (
        <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {mutationError}
        </div>
      )}

      {customize.editing && (
        <CustomizePanel
          draft={customize.draft} allWidgetDefs={activeWidgetDefs}
          onAdd={customize.addWidget}
          onRemove={(id) => customize.removeWidget(id, activeWidgetDefs)}
          onReorder={(from, to) => {
            const d = [...customize.draft];
            const [moved] = d.splice(from, 1);
            d.splice(to, 0, moved);
            customize.setDraft(d);
          }}
          onSave={handleSave} onReset={handleReset}
          onToggleVisible={customize.toggleVisible}
          isSaving={mutationPending} locale={locale}
        />
      )}

      <SectionGrid
        summary={summary} authorizedSections={authorizedSections}
        loading={summaryLoading} positions={effectivePositions}
        allWidgetDefs={activeWidgetDefs}
        availableMetrics={summary?.availableMetrics ?? []}
        periodPreset={periodPreset} customStart={customStart} customEnd={customEnd}
        comparison={comparison} locale={locale}
      />
    </div>
  );
}
