"use client";

import { Fragment, Suspense, useCallback, useEffect, useState } from "react";
import { api, type Page } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Kpi from "@/components/Kpi";
import Pagination from "@/components/Pagination";
import PanelFrame from "@/components/PanelFrame";
import { useLocale, t } from "@/lib/i18n";

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface SupportCase {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  caseType: string;
  priority: string;
  status: string;
  source?: string | null;
  customerId?: string | null;
  orderId?: string | null;
  bookingId?: string | null;
  assignedToId?: string | null;
  slaDeadline?: string | null;
  slaBreached?: boolean;
  escalatedAt?: string | null;
  escalatedById?: string | null;
  escalationReason?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
  comments?: CaseComment[];
  history?: CaseHistory[];
  caseLinks?: CaseLink[];
}

interface CaseComment {
  id: string;
  caseId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

interface CaseHistory {
  id: string;
  caseId: string;
  action: string;
  actorId?: string | null;
  actorName?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  details?: string | null;
  createdAt: string;
}

interface CaseLink {
  id: string;
  caseId: string;
  communicationId: string;
  createdAt: string;
}

interface SupportStats {
  total: number;
  open: number;
  inProgress: number;
  escalated: number;
  resolved: number;
  closed: number;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS", "WAITING_CUSTOMER", "WAITING_PARTNER", "WAITING_INTERNAL", "ESCALATED", "CLOSED"],
  IN_PROGRESS: ["WAITING_CUSTOMER", "WAITING_PARTNER", "WAITING_INTERNAL", "ESCALATED", "RESOLVED", "CLOSED"],
  WAITING_CUSTOMER: ["IN_PROGRESS", "ESCALATED", "CLOSED"],
  WAITING_PARTNER: ["IN_PROGRESS", "ESCALATED", "CLOSED"],
  WAITING_INTERNAL: ["IN_PROGRESS", "ESCALATED", "CLOSED"],
  ESCALATED: ["IN_PROGRESS", "WAITING_CUSTOMER", "WAITING_PARTNER", "WAITING_INTERNAL", "RESOLVED", "CLOSED"],
  RESOLVED: ["CLOSED", "OPEN"],
  CLOSED: [],
};

type Tab = "comments" | "history" | "communications";

/* ── Main Component ────────────────────────────────────────────────────────── */

function SupportContent() {
  const locale = useLocale();
  const [cases, setCases] = useState<Page<SupportCase> | null>(null);
  const [stats, setStats] = useState<SupportStats | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    caseType: "GENERAL",
    priority: "MEDIUM",
    source: "",
  });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SupportCase | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<Tab>("comments");
  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    caseType: "",
  });

  // ── Load cases ──
  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const qs = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (filters.status) qs.set("status", filters.status);
      if (filters.priority) qs.set("priority", filters.priority);
      if (filters.caseType) qs.set("caseType", filters.caseType);
      const res = await api.get<Page<SupportCase>>(`/support/cases?${qs}`);
      setCases(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  // ── Load stats ──
  const loadStats = useCallback(async () => {
    try {
      const res = await api.get<SupportStats>("/support/stats");
      setStats(res);
    } catch {
      // Stats are optional
    }
  }, []);

  // ── Load detail ──
  const loadDetail = useCallback(async (id: string) => {
    try {
      setDetailLoading(true);
      const res = await api.get<SupportCase>(`/support/cases/${id}`);
      setDetail(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCases();
    void loadStats();
  }, [loadCases, loadStats]);

  // ── Create case ──
  const createCase = async () => {
    if (!form.title.trim()) return;
    setCreating(true);
    setError("");
    try {
      await api.post("/support/cases", {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        caseType: form.caseType || undefined,
        priority: form.priority || undefined,
        source: form.source.trim() || undefined,
      });
      setShowCreate(false);
      setForm({ title: "", description: "", caseType: "GENERAL", priority: "MEDIUM", source: "" });
      await loadCases();
      await loadStats();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  // ── Transition case ──
  const transitionCase = async (id: string, status: string) => {
    try {
      await api.post(`/support/cases/${id}/transition`, { status });
      await loadCases();
      if (detailId === id) await loadDetail(id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // ── Open detail ──
  const openDetail = async (id: string) => {
    setDetailId(id);
    setDetailTab("comments");
    await loadDetail(id);
  };

  // ── Close detail ──
  const closeDetail = () => {
    setDetailId(null);
    setDetail(null);
  };

  const effectiveLocale = locale as "ru" | "az" | "en";

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          title={t("support.title", effectiveLocale)}
          breadcrumbs={["TravelHub", t("support.title", effectiveLocale)]}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreate(true)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
              >
                {t("support.create_case", effectiveLocale)}
              </button>
              <button
                onClick={() => void loadCases()}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {t("support.refresh", effectiveLocale)}
              </button>
            </div>
          }
        />

        <div className="space-y-4 p-6">
          {/* KPIs */}
          {stats && (
            <Kpi
              items={[
                { label: t("support.stats.total", effectiveLocale), value: stats.total, icon: "🎫" },
                { label: t("support.stats.open", effectiveLocale), value: stats.open, icon: "🔵" },
                { label: t("support.stats.in_progress", effectiveLocale), value: stats.inProgress, icon: "⚙️" },
                { label: t("support.stats.escalated", effectiveLocale), value: stats.escalated, icon: "🔴" },
                { label: t("support.stats.resolved", effectiveLocale), value: stats.resolved, icon: "✅" },
                { label: t("support.stats.closed", effectiveLocale), value: stats.closed, icon: "📦" },
              ]}
            />
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Filters
            </span>
            <select
              value={filters.status}
              onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
            >
              <option value="">{t("support.col.status", effectiveLocale)} — All</option>
              {Object.keys(VALID_TRANSITIONS).map((s) => (
                <option key={s} value={s}>{t(`support.status.${s}`, effectiveLocale)}</option>
              ))}
            </select>
            <select
              value={filters.priority}
              onChange={(e) => { setFilters({ ...filters, priority: e.target.value }); setPage(1); }}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
            >
              <option value="">{t("support.col.priority", effectiveLocale)} — All</option>
              {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                <option key={p} value={p}>{t(`support.priority.${p}`, effectiveLocale)}</option>
              ))}
            </select>
            <select
              value={filters.caseType}
              onChange={(e) => { setFilters({ ...filters, caseType: e.target.value }); setPage(1); }}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
            >
              <option value="">{t("support.col.type", effectiveLocale)} — All</option>
              {["GENERAL", "ORDER_ISSUE", "BOOKING_ISSUE", "PAYMENT_ISSUE", "REFUND_REQUEST", "TECHNICAL", "BILLING", "PARTNER_ISSUE", "PRODUCT_QUALITY"].map((ty) => (
                <option key={ty} value={ty}>{t(`support.type.${ty}`, effectiveLocale)}</option>
              ))}
            </select>
          </div>

          {/* Error */}
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

          {/* Cases Table */}
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
                  <th className="px-4 py-2.5 text-right">{t("support.col.transition_to", effectiveLocale)}</th>
                </tr>
              </thead>
              <tbody>
                {(cases?.items ?? []).map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 transition-colors hover:bg-blue-50/50">
                    <td className="px-4 py-2.5">
                      <button onClick={() => void openDetail(c.id)} className="font-mono text-xs text-blue-600 hover:underline">
                        {c.code}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[200px] truncate">{c.title}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{t(`support.type.${c.caseType}`, effectiveLocale)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{t(`support.priority.${c.priority}`, effectiveLocale)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {c.assignedToId ? c.assignedToId.substring(0, 8) + "…" : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">
                      {new Date(c.createdAt).toLocaleDateString(effectiveLocale)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(VALID_TRANSITIONS[c.status] ?? []).slice(0, 3).map((next) => (
                          <button
                            key={next}
                            onClick={() => void transitionCase(c.id, next)}
                            className="rounded border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                            title={t(`support.status.${next}`, effectiveLocale)}
                          >
                            → {t(`support.status.${next}`, effectiveLocale).substring(0, 8)}
                          </button>
                        ))}
                        {(VALID_TRANSITIONS[c.status] ?? []).length > 3 && (
                          <button
                            onClick={() => void openDetail(c.id)}
                            className="text-[10px] text-slate-400 hover:text-slate-600"
                          >
                            +{(VALID_TRANSITIONS[c.status] ?? []).length - 3}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(cases?.items ?? []).length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
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

      {/* ── Detail Panel ── */}
      {detailId && (
        <div className="w-[480px] shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
          {detailLoading && !detail ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              {t("state.loading", effectiveLocale)}
            </div>
          ) : detail ? (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="border-b border-slate-100 px-5 py-4">
                <button onClick={closeDetail} className="mb-2 text-xs text-slate-400 hover:text-slate-600">
                  {t("support.detail.back", effectiveLocale)}
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-blue-600">{detail.code}</span>
                  <StatusBadge status={detail.status} />
                </div>
                <h2 className="mt-1 text-base font-semibold text-slate-800">{detail.title}</h2>
                {detail.description && (
                  <p className="mt-1 text-xs text-slate-500 line-clamp-3">{detail.description}</p>
                )}
              </div>

              {/* Summary */}
              <div className="border-b border-slate-100 px-5 py-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">{t("support.detail.type", effectiveLocale)}</span>
                  <span className="text-slate-700">{t(`support.type.${detail.caseType}`, effectiveLocale)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t("support.detail.priority", effectiveLocale)}</span>
                  <span className="text-slate-700">{t(`support.priority.${detail.priority}`, effectiveLocale)}</span>
                </div>
                {detail.source && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t("support.detail.source", effectiveLocale)}</span>
                    <span className="text-slate-700">{detail.source}</span>
                  </div>
                )}
                {detail.customerId && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t("support.detail.customer", effectiveLocale)}</span>
                    <span className="font-mono text-slate-600">{detail.customerId.substring(0, 8)}…</span>
                  </div>
                )}
                {detail.orderId && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t("support.detail.order", effectiveLocale)}</span>
                    <span className="font-mono text-slate-600">{detail.orderId.substring(0, 8)}…</span>
                  </div>
                )}
                {detail.bookingId && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t("support.detail.booking", effectiveLocale)}</span>
                    <span className="font-mono text-slate-600">{detail.bookingId.substring(0, 8)}…</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">{t("support.detail.assignee", effectiveLocale)}</span>
                  <span className="text-slate-700">
                    {detail.assignedToId ? detail.assignedToId.substring(0, 8) + "…" : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t("support.detail.created_at", effectiveLocale)}</span>
                  <span className="text-slate-700">{new Date(detail.createdAt).toLocaleString(effectiveLocale)}</span>
                </div>
                {detail.escalatedAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t("support.detail.escalated_at", effectiveLocale)}</span>
                    <span className="text-slate-700">{new Date(detail.escalatedAt).toLocaleString(effectiveLocale)}</span>
                  </div>
                )}
                {detail.escalationReason && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t("support.detail.escalation_reason", effectiveLocale)}</span>
                    <span className="max-w-[200px] truncate text-slate-700">{detail.escalationReason}</span>
                  </div>
                )}
              </div>

              {/* Lifecycle Actions */}
              <div className="border-b border-slate-100 px-5 py-3">
                <div className="flex flex-wrap gap-1">
                  {(VALID_TRANSITIONS[detail.status] ?? []).map((next) => (
                    <button
                      key={next}
                      onClick={() => void transitionCase(detail.id, next)}
                      className="rounded border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
                    >
                      → {t(`support.status.${next}`, effectiveLocale)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-slate-200 bg-slate-50 px-5 pt-2">
                {(["comments", "history", "communications"] as const).map((tab_) => (
                  <button
                    key={tab_}
                    onClick={() => setDetailTab(tab_)}
                    className={`rounded-t-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      detailTab === tab_ ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {t(`support.tab.${tab_}`, effectiveLocale)}
                    {tab_ === "comments" && detail.comments && detail.comments.length > 0 && (
                      <span className="ml-1 text-[10px] text-slate-400">({detail.comments.length})</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-5">
                {/* Comments Tab */}
                {detailTab === "comments" && (
                  <div className="space-y-3">
                    {(detail.comments ?? []).length === 0 ? (
                      <div className="text-xs text-slate-400">{t("support.comment.empty", effectiveLocale)}</div>
                    ) : (
                      (detail.comments ?? []).map((comment) => (
                        <div
                          key={comment.id}
                          className={`rounded-lg border px-3 py-2 text-xs ${
                            comment.isInternal
                              ? "border-amber-200 bg-amber-50"
                              : "border-slate-100 bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-[10px] text-slate-400">
                              {comment.authorId.substring(0, 8)}…
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(comment.createdAt).toLocaleString(effectiveLocale)}
                            </span>
                            {comment.isInternal && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                INTERNAL
                              </span>
                            )}
                          </div>
                          <div className="text-slate-700 whitespace-pre-wrap">{comment.body}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* History Tab */}
                {detailTab === "history" && (
                  <div className="space-y-2">
                    {(detail.history ?? []).length === 0 ? (
                      <div className="text-xs text-slate-400">{t("support.history.empty", effectiveLocale)}</div>
                    ) : (
                      (detail.history ?? []).map((h) => (
                        <div key={h.id} className="flex items-start gap-2 text-xs">
                          <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-blue-400" />
                          <div>
                            <div className="text-slate-700">
                              <span className="font-medium">{h.action}</span>
                              {h.previousValue && h.newValue && (
                                <span className="text-slate-400">: {h.previousValue} → {h.newValue}</span>
                              )}
                              {h.details && (
                                <span className="text-slate-400"> — {h.details}</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {h.actorName ?? h.actorId?.substring(0, 8) ?? "system"} · {new Date(h.createdAt).toLocaleString(effectiveLocale)}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Communications Tab */}
                {detailTab === "communications" && (
                  <div className="space-y-3">
                    {(detail.caseLinks ?? []).length === 0 ? (
                      <div className="text-xs text-slate-400">{t("support.comm.empty", effectiveLocale)}</div>
                    ) : (
                      (detail.caseLinks ?? []).map((link) => (
                        <div key={link.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs">
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 font-semibold text-blue-700">CML</span>
                          <span className="font-mono text-slate-500">{link.communicationId.substring(0, 8)}…</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(link.createdAt).toLocaleString(effectiveLocale)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-red-500">
              {t("support.error.not_found", effectiveLocale)}
            </div>
          )}
        </div>
      )}

      {/* ── Create Case Panel ── */}
      {showCreate && (
        <PanelFrame
          title={t("support.create_case", effectiveLocale)}
          subtitle={t("support.title", effectiveLocale)}
          onClose={() => setShowCreate(false)}
        >
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              {t("support.form.title_label", effectiveLocale)} *
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
              maxLength={200}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              {t("support.form.description_label", effectiveLocale)}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              maxLength={5000}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                {t("support.form.type_label", effectiveLocale)}
              </label>
              <select
                value={form.caseType}
                onChange={(e) => setForm({ ...form, caseType: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                {["GENERAL", "ORDER_ISSUE", "BOOKING_ISSUE", "PAYMENT_ISSUE", "REFUND_REQUEST", "TECHNICAL", "BILLING", "PARTNER_ISSUE", "PRODUCT_QUALITY"].map((ty) => (
                  <option key={ty} value={ty}>{t(`support.type.${ty}`, effectiveLocale)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                {t("support.form.priority_label", effectiveLocale)}
              </label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                  <option key={p} value={p}>{t(`support.priority.${p}`, effectiveLocale)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              {t("support.form.source_label", effectiveLocale)}
            </label>
            <input
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              placeholder="email / phone / chat / web"
            />
          </div>
          <button
            onClick={() => void createCase()}
            disabled={creating || !form.title.trim()}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "…" : t("support.form.submit", effectiveLocale)}
          </button>
        </PanelFrame>
      )}
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-8 w-48 animate-pulse rounded bg-slate-100" /></div>}>
      <SupportContent />
    </Suspense>
  );
}
