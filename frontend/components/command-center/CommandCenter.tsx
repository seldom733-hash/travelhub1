"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/use-user";
import {
  useWorkspaceLayout,
  useWorkspaceCustomize,
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
} from "@/lib/dashboard-api";
import { t, type Locale } from "@/lib/i18n";
import { PeriodSelector } from "./PeriodSelector";
import { SectionGrid } from "./SectionGrid";
import { CustomizePanel } from "./CustomizePanel";

const PAGE_ID = "command-center";
const DEFAULT_PRESET: PeriodPreset = "MONTH";

const VALID_PRESETS: readonly PeriodPreset[] = [
  "TODAY", "LAST_3_DAYS", "LAST_7_DAYS", "MONTH", "LAST_6_MONTHS", "YEAR", "CUSTOM",
] as const;

function isValidPreset(v: string): v is PeriodPreset {
  return (VALID_PRESETS as readonly string[]).includes(v);
}

export function CommandCenter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useCurrentUser();
  const permissions = user?.permissions ?? [];
  const locale: Locale = "ru"; // default; will be extracted from i18n context in future

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

  // Update URL state
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
      if (preset === "CUSTOM") {
        // Keep existing start/end if present
      } else {
        updates.start = null;
        updates.end = null;
      }
      updateUrl(updates);
    },
    [updateUrl],
  );

  const handleComparisonChange = useCallback(
    (on: boolean) => updateUrl({ comparison: String(on) }),
    [updateUrl],
  );

  const handleCustomStartChange = useCallback(
    (v: string) => updateUrl({ start: v }),
    [updateUrl],
  );

  const handleCustomEndChange = useCallback(
    (v: string) => updateUrl({ end: v }),
    [updateUrl],
  );

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
  const sequenceRef = useRef(0); // request sequence token

  // Workspace layout
  const { layout, loading: layoutLoading, error: layoutError, saveLayout, resetLayout } = useWorkspaceLayout(PAGE_ID);
  const hasCustomizePermission = permissions.includes("dashboard.customize");
  const customize = useWorkspaceCustomize(layout, permissions);

  // Widget definitions from workspace (server-authoritative)
  const allWidgetDefs = layout?.availableWidgets ?? [];

  // Server-authoritative sections
  const authorizedSections = summary?.availableSections ?? [];

  // ── Fetch summary ─────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    // CUSTOM validation gate
    if (periodPreset === "CUSTOM" && customError) {
      setSummaryError(customError);
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
      };
      if (periodPreset === "CUSTOM") {
        params.startDate = customStart;
        params.endDate = customEnd;
      }
      const data = await dashboardApi.getSummary(params, controller.signal);
      // Only update if this is still the active request
      if (seq === sequenceRef.current) {
        setSummary(data);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (seq !== sequenceRef.current) return;
      if (err instanceof Error && "status" in err) {
        const status = (err as { status: number }).status;
        if (status === 403) setSummaryError("forbidden");
        else if (status === 401) setSummaryError("unauthorized");
        else setSummaryError(`server-error-${status}`);
      } else {
        setSummaryError("network-error");
      }
    } finally {
      if (seq === sequenceRef.current) {
        setSummaryLoading(false);
      }
    }
  }, [periodPreset, comparison, customStart, customEnd, customError]);

  useEffect(() => {
    fetchSummary();
    return () => abortRef.current?.abort();
  }, [fetchSummary]);

  // ── Save/Reset handlers ───────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!customize.draft.length) return;
    await saveLayout(customize.draft);
    customize.cancelCustomize();
  }, [customize, saveLayout]);

  const handleReset = useCallback(async () => {
    await resetLayout();
    customize.cancelCustomize();
  }, [resetLayout, customize]);

  // ── Server-authoritative no-sections check ────────────────────────
  const hasAnySection = authorizedSections.length > 0;

  // ── Layout fallback: when summary is ready but layout is loading/error ─
  const layoutReady = !layoutLoading || layout !== null;
  const layoutFailed = !layoutLoading && layout === null;

  // ── Render ────────────────────────────────────────────────────────

  // Loading state (initial)
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

  // 401
  if (summaryError === "unauthorized") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl">🔑</div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">{t("cc.auth_required", locale)}</h1>
        <p className="mt-2 text-sm text-slate-500">{t("cc.auth_hint", locale)}</p>
      </div>
    );
  }

  // 403
  if (summaryError === "forbidden") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">{t("cc.access_denied", locale)}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {t("cc.access_denied_hint", locale)}
        </p>
      </div>
    );
  }

  // No authorized sections (from server response)
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
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("cc.title", locale)}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("cc.subtitle", locale)} · UTC
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector
            preset={periodPreset}
            comparison={comparison}
            customStart={customStart}
            customEnd={customEnd}
            customError={customError}
            onPresetChange={handlePresetChange}
            onComparisonChange={handleComparisonChange}
            onCustomStartChange={handleCustomStartChange}
            onCustomEndChange={handleCustomEndChange}
          />
          {hasCustomizePermission && layout?.constructorEnabled && (
            <button
              onClick={customize.editing ? customize.cancelCustomize : customize.enterCustomize}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                customize.editing
                  ? "bg-red-50 text-red-600 hover:bg-red-100"
                  : "bg-blue-50 text-blue-600 hover:bg-blue-100"
              }`}
              aria-label={customize.editing ? t("cc.cancel", locale) : t("cc.customize", locale)}
            >
              {customize.editing ? t("cc.cancel", locale) : t("cc.customize", locale)}
            </button>
          )}
        </div>
      </div>

      {/* CUSTOM validation error */}
      {customError && periodPreset === "CUSTOM" && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {customError}
        </div>
      )}

      {/* Summary error banner */}
      {summaryError && summary && summaryError !== "forbidden" && summaryError !== "unauthorized" && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {t("cc.update_error", locale)}: {summaryError}
        </div>
      )}

      {/* Layout failure notification */}
      {layoutFailed && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {t("cc.layout_unavailable", locale)}
        </div>
      )}

      {/* Customize panel */}
      {customize.editing && (
        <CustomizePanel
          draft={customize.draft}
          allWidgetDefs={allWidgetDefs}
          onAdd={customize.addWidget}
          onRemove={(id) => customize.removeWidget(id, allWidgetDefs)}
          onReorder={(from, to) => {
            const d = [...customize.draft];
            const [moved] = d.splice(from, 1);
            d.splice(to, 0, moved);
            customize.setDraft(d);
          }}
          onSave={handleSave}
          onReset={handleReset}
          onToggleVisible={customize.toggleVisible}
          isSaving={false}
        />
      )}

      {/* Sections — uses server-availableSections, layout drives visibility/order */}
      <SectionGrid
        summary={summary}
        authorizedSections={authorizedSections}
        loading={summaryLoading}
        layout={layout}
        editing={customize.editing}
        draft={customize.editing ? customize.draft : null}
        availableMetrics={summary?.availableMetrics ?? []}
        periodPreset={periodPreset}
        customStart={customStart}
        customEnd={customEnd}
        comparison={comparison}
        allWidgetDefs={allWidgetDefs}
        locale={locale}
      />

      {/* Layout error fallback: show read-only summary if layout fails but summary is available */}
      {layoutFailed && summary && !summaryLoading && (
        <div className="mt-4 text-xs text-slate-400">
          {t("cc.readonly_fallback", locale)}
        </div>
      )}
    </div>
  );
}
