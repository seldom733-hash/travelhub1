"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Kpi from "@/components/Kpi";
import Pagination from "@/components/Pagination";
import { useLocale, t } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-user";
import { supportApi, VALID_TRANSITIONS, CASE_TYPES, PRIORITIES, type SupportCase, type SupportStats } from "@/lib/support";
import TableExportButton from "@/components/TableExportButton";

/* ── Filter Panel ──────────────────────────────────────────────────────────── */

function Filters({
  filters,
  onChange,
  locale,
}: {
  filters: { status: string; priority: string; caseType: string };
  onChange: (f: { status: string; priority: string; caseType: string }) => void;
  locale: "ru" | "az" | "en";
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <select
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value })}
        className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
      >
        <option value="">{t("support.filter.all_status", locale)}</option>
        {Object.keys(VALID_TRANSITIONS).map((s) => (
          <option key={s} value={s}>{t(`support.status.${s}`, locale)}</option>
        ))}
      </select>
      <select
        value={filters.priority}
        onChange={(e) => onChange({ ...filters, priority: e.target.value })}
        className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
      >
        <option value="">{t("support.filter.all_priority", locale)}</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>{t(`support.priority.${p}`, locale)}</option>
        ))}
      </select>
      <select
        value={filters.caseType}
        onChange={(e) => onChange({ ...filters, caseType: e.target.value })}
        className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
      >
        <option value="">{t("support.filter.all_type", locale)}</option>
        {CASE_TYPES.map((ty) => (
          <option key={ty} value={ty}>{t(`support.type.${ty}`, locale)}</option>
        ))}
      </select>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────────────── */

function SupportListContent() {
  const locale = useLocale();
  const router = useRouter();
  const user = useCurrentUser();
  const [cases, setCases] = useState<Awaited<ReturnType<typeof supportApi.list>> | null>(null);
  const [stats, setStats] = useState<SupportStats | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "", priority: "", caseType: "" });

  const effectiveLocale = locale as "ru" | "az" | "en";
  const canCreate = user?.permissions.includes("support.case.create") ?? false;

  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await supportApi.list(page, 20, filters);
      setCases(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  const loadStats = useCallback(async () => {
    try {
      const res = await supportApi.stats();
      setStats(res);
    } catch {
      /* stats optional */
    }
  }, []);

  useEffect(() => {
    void loadCases();
    void loadStats();
  }, [loadCases, loadStats]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHeader
        title={t("support.title", effectiveLocale)}
        breadcrumbs={["TravelHub", t("support.title", effectiveLocale)]}
        actions={
          <div className="flex items-center gap-2">
            {canCreate && (
              <button
                onClick={() => router.push("/app/support/new")}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
              >
                {t("support.create_case", effectiveLocale)}
              </button>
            )}
            <TableExportButton
              exportUrl="/api/v1/support/cases/export"
              extraParams={{
                ...(filters.status ? { status: filters.status } : {}),
                ...(filters.priority ? { priority: filters.priority } : {}),
                ...(filters.caseType ? { caseType: filters.caseType } : {}),
              }}
            />
            <button
              onClick={() => { void loadCases(); void loadStats(); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              ⟳
            </button>
          </div>
        }
      />

      <div className="space-y-4 p-6">
        {stats && (
          <Kpi
            items={[
              { label: t("support.stats.total", effectiveLocale), value: stats.total, icon: "🎫" },
              { label: t("support.stats.open", effectiveLocale), value: stats.open, icon: "🔵" },
              { label: t("support.stats.in_progress", effectiveLocale), value: stats.inProgress, icon: "⚙️" },
              { label: t("support.stats.waiting", effectiveLocale), value: stats.waiting, icon: "⏳" },
              { label: t("support.stats.escalated", effectiveLocale), value: stats.escalated, icon: "🔴" },
              { label: t("support.stats.resolved", effectiveLocale), value: stats.resolved, icon: "✅" },
              { label: t("support.stats.closed", effectiveLocale), value: stats.closed, icon: "📦" },
            ]}
          />
        )}

        <Filters filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} locale={effectiveLocale} />

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <div className="font-medium">{t("support.error.load_failed", effectiveLocale)}</div>
            <div className="mt-1 text-xs text-red-500">{error}</div>
            <button
              onClick={() => { setError(""); void loadCases(); }}
              className="mt-2 rounded border border-red-300 bg-white px-3 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              {t("support.error.retry", effectiveLocale)}
            </button>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2.5">{t("support.col.code", effectiveLocale)}</th>
                <th className="px-4 py-2.5">{t("support.col.title", effectiveLocale)}</th>
                <th className="px-4 py-2.5">{t("support.col.type", effectiveLocale)}</th>
                <th className="px-4 py-2.5">{t("support.col.priority", effectiveLocale)}</th>
                <th className="px-4 py-2.5">{t("support.col.status", effectiveLocale)}</th>
                <th className="px-4 py-2.5">{t("support.col.assignee", effectiveLocale)}</th>
                <th className="px-4 py-2.5">{t("support.col.created", effectiveLocale)}</th>
              </tr>
            </thead>
            <tbody>
              {(cases?.items ?? []).map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-blue-50/50"
                  onClick={() => router.push(`/app/support/${c.id}`)}
                >
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-blue-600">{c.code}</span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[200px] truncate">{c.title}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{t(`support.type.${c.caseType}`, effectiveLocale)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{t(`support.priority.${c.priority}`, effectiveLocale)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {c.assignedToId ? c.assignedToId.substring(0, 8) + "…" : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">
                    {new Date(c.createdAt).toLocaleDateString(effectiveLocale)}
                  </td>
                </tr>
              ))}
              {(cases?.items ?? []).length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                    {t("support.cases_empty", effectiveLocale)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {cases && cases.total > 0 && (
            <Pagination page={page} pageSize={20} total={cases.total} onPageChange={(p) => setPage(p)} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-8 w-48 animate-pulse rounded bg-slate-100" /></div>}>
      <SupportListContent />
    </Suspense>
  );
}
