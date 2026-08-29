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

interface Campaign {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  objective?: string | null;
  status: string;
  partnerId?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

interface CampaignAudience {
  id: string;
  code: string;
  campaignId: string;
  name: string;
  description?: string | null;
  criteria?: Record<string, unknown> | null;
  partnerId?: string | null;
  createdById: string;
  createdAt: string;
}

interface CampaignAttribution {
  id: string;
  campaignId: string;
  entityType: string;
  entityId: string;
  attributionType: string;
  attributedAt: string;
  notes?: string | null;
  partnerId?: string | null;
  createdById: string;
}

type Tab = "campaigns" | "audiences" | "attributions";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "marketing.status.draft",
  SCHEDULED: "marketing.status.scheduled",
  ACTIVE: "marketing.status.active",
  PAUSED: "marketing.status.paused",
  COMPLETED: "marketing.status.completed",
  CANCELLED: "marketing.status.cancelled",
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["PAUSED", "COMPLETED", "CANCELLED"],
  PAUSED: ["ACTIVE", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/* ── Main Component ────────────────────────────────────────────────────────── */

function MarketingContent() {
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>("campaigns");
  const [campaigns, setCampaigns] = useState<Page<Campaign> | null>(null);
  const [audiences, setAudiences] = useState<CampaignAudience[] | null>(null);
  const [attributions, setAttributions] = useState<CampaignAttribution[] | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", objective: "" });
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  // ── Load campaigns ──
  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const qs = new URLSearchParams({ page: String(page), pageSize: "20" });
      const res = await api.get<Page<Campaign>>(`/marketing/campaigns?${qs}`);
      setCampaigns(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  // ── Load audiences for a campaign ──
  const loadAudiences = useCallback(async (campaignId: string) => {
    try {
      const res = await api.get<CampaignAudience[]>(`/marketing/campaigns/${campaignId}/audiences`);
      setAudiences(res);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // ── Load attributions for a campaign ──
  const loadAttributions = useCallback(async (campaignId: string) => {
    try {
      const res = await api.get<CampaignAttribution[]>(`/marketing/campaigns/${campaignId}/attributions`);
      setAttributions(res);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (tab === "campaigns") void loadCampaigns();
  }, [tab, loadCampaigns]);

  // ── Create campaign ──
  const createCampaign = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    setError("");
    try {
      await api.post("/marketing/campaigns", {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        objective: form.objective.trim() || undefined,
      });
      setShowCreate(false);
      setForm({ name: "", description: "", objective: "" });
      await loadCampaigns();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  // ── Transition campaign ──
  const transitionCampaign = async (id: string, status: string) => {
    try {
      await api.post(`/marketing/campaigns/${id}/transition`, { status });
      await loadCampaigns();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // ── Toggle campaign detail (load audiences + attributions) ──
  const toggleCampaignDetail = async (id: string) => {
    if (expandedCampaign === id) {
      setExpandedCampaign(null);
      setAudiences(null);
      setAttributions(null);
    } else {
      setExpandedCampaign(id);
      await Promise.all([loadAudiences(id), loadAttributions(id)]);
    }
  };

  const campaign = expandedCampaign ? campaigns?.items?.find((c) => c.id === expandedCampaign) : null;

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          title={t("marketing.title", locale)}
          breadcrumbs={["TravelHub", t("marketing.title", locale)]}
          actions={
            <div className="flex items-center gap-2">
              {tab === "campaigns" && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  ＋ {t("marketing.create_campaign", locale)}
                </button>
              )}
              <button
                onClick={() => tab === "campaigns" && void loadCampaigns()}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                ⟳
              </button>
            </div>
          }
        />

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 bg-slate-50 px-6 pt-2">
          {(["campaigns", "audiences", "attributions"] as const).map((t_) => (
            <button
              key={t_}
              onClick={() => { setTab(t_); setExpandedCampaign(null); setAudiences(null); setAttributions(null); }}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t_ ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t(`marketing.tab.${t_}`, locale)}
            </button>
          ))}
        </div>

        <div className="space-y-4 p-6">
          {/* KPIs */}
          {tab === "campaigns" && (
            <Kpi items={[
              { label: t("marketing.total_campaigns", locale), value: campaigns?.total ?? 0, icon: "📣" },
            ]} />
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <div className="font-medium">{t("marketing.error.load_failed", locale)}</div>
              <div className="mt-1 text-xs text-red-500">{error}</div>
              <button
                onClick={() => { setError(""); tab === "campaigns" && void loadCampaigns(); }}
                className="mt-2 rounded border border-red-300 bg-white px-3 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                {t("marketing.error.retry", locale)}
              </button>
            </div>
          )}

          {/* Campaigns Tab */}
          {tab === "campaigns" && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5">{t("marketing.col.code", locale)}</th>
                    <th className="px-4 py-2.5">{t("marketing.col.name", locale)}</th>
                    <th className="px-4 py-2.5">{t("marketing.col.status", locale)}</th>
                    <th className="px-4 py-2.5">{t("marketing.col.scope", locale)}</th>
                    <th className="px-4 py-2.5">{t("marketing.col.created", locale)}</th>
                    <th className="px-4 py-2.5 text-right">{t("marketing.lifecycle.to", locale)}</th>
                  </tr>
                </thead>
                <tbody>
                  {(campaigns?.items ?? []).map((c) => (
                    <Fragment key={c.id}>
                      <tr className="border-b border-slate-50 transition-colors hover:bg-blue-50/50">
                        <td className="px-4 py-2.5">
                          <button onClick={() => void toggleCampaignDetail(c.id)} className="font-mono text-xs text-blue-600 hover:underline">
                            {c.code}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-800">{c.name}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">
                          {c.partnerId ? c.partnerId.substring(0, 8) + "…" : t("marketing.scope.platform", locale)}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">
                          {new Date(c.createdAt).toLocaleDateString(locale)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {(VALID_TRANSITIONS[c.status] ?? []).map((next) => (
                              <button
                                key={next}
                                onClick={() => void transitionCampaign(c.id, next)}
                                className="rounded border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                              >
                                → {t(STATUS_LABELS[next] ?? next, locale)}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                      {/* Expanded detail row */}
                      {expandedCampaign === c.id && (
                        <tr key={`${c.id}-detail`}>
                          <td colSpan={6} className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                            <div className="space-y-4">
                              {c.description && (
                                <div className="text-sm text-slate-600">{c.description}</div>
                              )}

                              {/* Audiences */}
                              <div>
                                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  {t("marketing.tab.audiences", locale)} ({audiences?.length ?? 0})
                                </h4>
                                {audiences && audiences.length > 0 ? (
                                  <div className="space-y-1">
                                    {audiences.map((a) => (
                                      <div key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs">
                                        <span className="font-mono text-blue-600">{a.code}</span>
                                        <span className="font-medium text-slate-700">{a.name}</span>
                                        {a.criteria && (
                                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                                            {JSON.stringify(a.criteria)}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-400">{t("marketing.audiences_empty", locale)}</div>
                                )}
                              </div>

                              {/* Attributions */}
                              <div>
                                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  {t("marketing.tab.attributions", locale)} ({attributions?.length ?? 0})
                                </h4>
                                {attributions && attributions.length > 0 ? (
                                  <div className="space-y-1">
                                    {attributions.map((a) => (
                                      <div key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs">
                                        <span className="rounded bg-blue-100 px-1.5 py-0.5 font-semibold text-blue-700">{a.entityType}</span>
                                        <span className="font-mono text-slate-500">{a.entityId.substring(0, 8)}…</span>
                                        <span className="text-slate-400">{a.attributionType}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-400">{t("marketing.attributions_empty", locale)}</div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {(campaigns?.items ?? []).length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                        {t("marketing.campaigns_empty", locale)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {campaigns && campaigns.total > 0 && (
                <Pagination page={page} pageSize={20} total={campaigns.total} onPageChange={(p) => setPage(p)} />
              )}
            </div>
          )}

          {/* Audiences Tab (all campaigns) */}
          {tab === "audiences" && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm text-slate-500">
                {t("marketing.audiences_empty", locale)}
              </div>
            </div>
          )}

          {/* Attributions Tab (all campaigns) */}
          {tab === "attributions" && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm text-slate-500">
                {t("marketing.attributions_empty", locale)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Campaign Panel */}
      {showCreate && (
        <PanelFrame
          title={t("marketing.create_campaign", locale)}
          subtitle={t("marketing.title", locale)}
          onClose={() => setShowCreate(false)}
        >
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              {t("marketing.create.form.name", locale)} *
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
              maxLength={200}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              {t("marketing.create.form.description", locale)}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              maxLength={2000}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              {t("marketing.create.form.objective", locale)}
            </label>
            <input
              value={form.objective}
              onChange={(e) => setForm({ ...form, objective: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
            />
          </div>
          <button
            onClick={() => void createCampaign()}
            disabled={creating || !form.name.trim()}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "…" : t("marketing.create.submit", locale)}
          </button>
        </PanelFrame>
      )}
    </div>
  );
}

export default function MarketingPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-8 w-48 animate-pulse rounded bg-slate-100" /></div>}>
      <MarketingContent />
    </Suspense>
  );
}
