"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/use-user";
import {
  useWorkspaceLayout,
  useWorkspaceCustomize,
} from "@/lib/use-workspace";
import { type EffectiveLayout } from "@/lib/workspace-api";
import {
  dashboardApi,
  type CommandCenterSummary,
  type DashboardSection,
  type PeriodPreset,
  type DashboardQueryParams,
} from "@/lib/dashboard-api";
import { PeriodSelector } from "./PeriodSelector";
import { SectionGrid } from "./SectionGrid";
import { CustomizePanel } from "./CustomizePanel";

const PAGE_ID = "command-center";
const DEFAULT_PRESET: PeriodPreset = "MONTH";

/** Section → permission mapping for filtering. */
const SECTION_PERMISSION: Record<DashboardSection, string> = {
  executive: "dashboard.executive.read",
  operational: "dashboard.operational.read",
  financial: "dashboard.financial.read",
  marketplace: "dashboard.marketplace.read",
};

export function CommandCenter() {
  const user = useCurrentUser();
  const permissions = user?.permissions ?? [];

  // Period state (URL-synced via query params)
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>(DEFAULT_PRESET);
  const [comparison, setComparison] = useState(true);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Data state
  const [summary, setSummary] = useState<CommandCenterSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Abort controller for stale requests
  const abortRef = useRef<AbortController | null>(null);

  // Workspace layout
  const { layout, loading: layoutLoading, saveLayout, resetLayout } = useWorkspaceLayout(PAGE_ID);
  const hasCustomizePermission = permissions.includes("dashboard.customize");
  const customize = useWorkspaceCustomize(layout, permissions);

  // Authorized sections (from server response)
  const authorizedSections = summary?.availableSections ?? [];

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

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
      setSummary(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setSummaryError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setSummaryLoading(false);
    }
  }, [periodPreset, comparison, customStart, customEnd]);

  useEffect(() => {
    fetchSummary();
    return () => abortRef.current?.abort();
  }, [fetchSummary]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!customize.draft.length) return;
    await saveLayout(customize.draft);
    customize.cancelCustomize();
  }, [customize, saveLayout]);

  // Reset handler
  const handleReset = useCallback(async () => {
    await resetLayout();
    customize.cancelCustomize();
  }, [resetLayout, customize]);

  // Check if user has at least one section permission
  const hasAnySection = Object.values(SECTION_PERMISSION).some(
    (p) => permissions.includes(p),
  );

  // Loading state
  if (summaryLoading && !summary) {
    return (
      <div className="p-6 lg:p-10">
        <h1 className="text-2xl font-bold text-slate-900">Command Center</h1>
        <p className="mt-1 text-sm text-slate-500">Загрузка данных…</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  // Error state (403)
  if (summaryError?.includes("403") || summaryError?.includes("analytics.read")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Доступ запрещён</h1>
        <p className="mt-2 text-sm text-slate-500">
          У вас нет прав <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">analytics.read</code> для доступа к Command Center.
        </p>
      </div>
    );
  }

  // No authorized sections
  if (summary && !hasAnySection) {
    return (
      <div className="p-6 lg:p-10">
        <h1 className="text-2xl font-bold text-slate-900">Command Center</h1>
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
          <div className="text-3xl">📊</div>
          <p className="mt-3 text-sm text-slate-500">
            Нет доступных разделов. Обратитесь к администратору для настройки прав доступа.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Command Center</h1>
          <p className="mt-1 text-sm text-slate-500">
            Агрегированные данные Marketplace · UTC
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector
            preset={periodPreset}
            comparison={comparison}
            customStart={customStart}
            customEnd={customEnd}
            onPresetChange={setPeriodPreset}
            onComparisonChange={setComparison}
            onCustomStartChange={setCustomStart}
            onCustomEndChange={setCustomEnd}
          />
          {hasCustomizePermission && layout?.constructorEnabled && (
            <button
              onClick={customize.editing ? customize.cancelCustomize : customize.enterCustomize}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                customize.editing
                  ? "bg-red-50 text-red-600 hover:bg-red-100"
                  : "bg-blue-50 text-blue-600 hover:bg-blue-100"
              }`}
            >
              {customize.editing ? "Отмена" : "Настроить"}
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {summaryError && summary && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Ошибка обновления: {summaryError}
        </div>
      )}

      {/* Customize panel */}
      {customize.editing && (
        <CustomizePanel
          draft={customize.draft}
          availableWidgets={layout?.availableWidgets ?? []}
          allWidgets={layout?.widgets ?? []}
          onAdd={customize.addWidget}
          onRemove={(id) => customize.removeWidget(id, layout?.availableWidgets ?? [])}
          onReorder={(from, to) => {
            const draft = [...customize.draft];
            const [moved] = draft.splice(from, 1);
            draft.splice(to, 0, moved);
            customize.setDraft(draft);
          }}
          onSave={handleSave}
          onReset={handleReset}
          onToggleVisible={customize.toggleVisible}
        />
      )}

      {/* Sections */}
      <SectionGrid
        summary={summary}
        authorizedSections={authorizedSections}
        loading={summaryLoading}
        layout={layout}
        editing={customize.editing}
      />
    </div>
  );
}
