"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { useLocale, t } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-user";
import {
  supportApi, VALID_TRANSITIONS, isStatusTransition,
  HISTORY_EVENT_MAP,
  type SupportCase, type CaseHistory,
} from "@/lib/support";

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function historyEventTitle(h: CaseHistory, locale: "ru" | "az" | "en") {
  if (isStatusTransition(h.action)) return t("support.history.event.status_changed", locale);
  const mapping = HISTORY_EVENT_MAP[h.action];
  if (mapping) return t(mapping.titleKey, locale);
  return h.action;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="text-right text-slate-700">{children}</span>
    </div>
  );
}

/* ── Detail Content ────────────────────────────────────────────────────────── */

function CaseDetailContent() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const user = useCurrentUser();
  const id = params.id as string;

  const [detail, setDetail] = useState<SupportCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"comments" | "history" | "communications">("comments");
  const effectiveLocale = locale as "ru" | "az" | "en";

  const canUpdate = user?.permissions.includes("support.case.update") ?? false;

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setDetail(await supportApi.get(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadDetail(); }, [loadDetail]);

  const transition = async (status: string) => {
    if (!detail) return;
    try {
      await supportApi.transition(detail.id, status);
      await loadDetail();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-400">{t("state.loading", effectiveLocale)}</div>;
  }
  if (error && !detail) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="text-sm text-red-500">{error}</div>
        <button onClick={() => router.push("/app/support")} className="text-xs text-blue-600 hover:underline">
          {t("support.detail.back", effectiveLocale)}
        </button>
      </div>
    );
  }
  if (!detail) return null;

  const allowed = VALID_TRANSITIONS[detail.status] ?? [];

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHeader
        title={detail.code}
        breadcrumbs={["TravelHub", t("support.title", effectiveLocale), detail.code]}
        actions={
          <button onClick={() => router.push("/app/support")} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            {t("support.detail.back", effectiveLocale)}
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-3">
        {/* Left */}
        <div className="space-y-5 xl:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <StatusBadge status={detail.status} />
              <span className="text-xs text-slate-400">{new Date(detail.createdAt).toLocaleString(effectiveLocale)}</span>
            </div>
            <h1 className="text-lg font-semibold text-slate-800 mb-2">{detail.title}</h1>
            {detail.description && <p className="text-sm text-slate-500 whitespace-pre-wrap">{detail.description}</p>}
          </div>

          {canUpdate && allowed.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("support.detail.lifecycle_actions", effectiveLocale)}
              </h3>
              <div className="flex flex-wrap gap-2">
                {allowed.map((next) => (
                  <button key={next} onClick={() => void transition(next)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800">
                    → {t(`support.status.${next}`, effectiveLocale)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex gap-1 border-b border-slate-200 bg-slate-50 px-5 pt-2">
              {(["comments", "history", "communications"] as const).map((tab_) => (
                <button key={tab_} onClick={() => setActiveTab(tab_)} className={`rounded-t-lg px-4 py-2 text-xs font-medium transition-colors ${activeTab === tab_ ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  {t(`support.tab.${tab_}`, effectiveLocale)}
                  {tab_ === "comments" && detail.comments && detail.comments.length > 0 && <span className="ml-1 text-[10px] text-slate-400">({detail.comments.length})</span>}
                </button>
              ))}
            </div>
            <div className="p-5">
              {activeTab === "comments" && (
                <div className="space-y-3">
                  {(detail.comments ?? []).length === 0 ? (
                    <div className="text-xs text-slate-400">{t("support.comment.empty", effectiveLocale)}</div>
                  ) : (detail.comments ?? []).map((c) => (
                    <div key={c.id} className={`rounded-lg border px-3 py-2 text-xs ${c.isInternal ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-white"}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] text-slate-400">{c.authorId.substring(0, 8)}…</span>
                        <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleString(effectiveLocale)}</span>
                        {c.isInternal && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">{t("support.comment.internal_badge", effectiveLocale)}</span>}
                      </div>
                      <div className="text-slate-700 whitespace-pre-wrap">{c.body}</div>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === "history" && (
                <div className="space-y-3">
                  {(detail.history ?? []).length === 0 ? (
                    <div className="text-xs text-slate-400">{t("support.history.empty", effectiveLocale)}</div>
                  ) : (detail.history ?? []).map((h) => (
                    <div key={h.id} className="flex items-start gap-3 text-xs">
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-blue-400" />
                      <div className="flex-1">
                        <div className="font-medium text-slate-700">{historyEventTitle(h, effectiveLocale)}</div>
                        {isStatusTransition(h.action) && h.previousValue && h.newValue && (
                          <div className="mt-0.5 text-slate-500">
                            {t(`support.status.${h.previousValue}`, effectiveLocale)} → {t(`support.status.${h.newValue}`, effectiveLocale)}
                          </div>
                        )}
                        {!isStatusTransition(h.action) && h.previousValue && h.newValue && (
                          <div className="mt-0.5 text-slate-500">{h.previousValue} → {h.newValue}</div>
                        )}
                        {h.details && <div className="mt-0.5 text-slate-400">{h.details}</div>}
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          {h.actorName ?? h.actorId?.substring(0, 8) ?? "system"} · {new Date(h.createdAt).toLocaleString(effectiveLocale)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === "communications" && (
                <div className="space-y-3">
                  {(detail.caseLinks ?? []).length === 0 ? (
                    <div className="text-xs text-slate-400">{t("support.comm.empty", effectiveLocale)}</div>
                  ) : (detail.caseLinks ?? []).map((link) => (
                    <div key={link.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs">
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 font-semibold text-blue-700">CML</span>
                      <span className="font-mono text-slate-500">{link.communicationId.substring(0, 8)}…</span>
                      <span className="text-[10px] text-slate-400">{new Date(link.createdAt).toLocaleString(effectiveLocale)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3 text-xs">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t("support.detail.summary", effectiveLocale)}</h3>
            <Row label={t("support.detail.status", effectiveLocale)}><StatusBadge status={detail.status} /></Row>
            <Row label={t("support.detail.type", effectiveLocale)}>{t(`support.type.${detail.caseType}`, effectiveLocale)}</Row>
            <Row label={t("support.detail.priority", effectiveLocale)}>{t(`support.priority.${detail.priority}`, effectiveLocale)}</Row>
            {detail.source && <Row label={t("support.detail.source", effectiveLocale)}>{detail.source}</Row>}
            <Row label={t("support.detail.created_at", effectiveLocale)}>{new Date(detail.createdAt).toLocaleString(effectiveLocale)}</Row>
            {detail.customerId && <Row label={t("support.detail.customer", effectiveLocale)}><span className="font-mono">{detail.customerId.substring(0, 8)}…</span></Row>}
            {detail.orderId && <Row label={t("support.detail.order", effectiveLocale)}><span className="font-mono">{detail.orderId.substring(0, 8)}…</span></Row>}
            {detail.bookingId && <Row label={t("support.detail.booking", effectiveLocale)}><span className="font-mono">{detail.bookingId.substring(0, 8)}…</span></Row>}
            <Row label={t("support.detail.assignee", effectiveLocale)}>{detail.assignedToId ? <span className="font-mono">{detail.assignedToId.substring(0, 8)}…</span> : "—"}</Row>
            {detail.escalatedAt && <Row label={t("support.detail.escalated_at", effectiveLocale)}>{new Date(detail.escalatedAt).toLocaleString(effectiveLocale)}</Row>}
            {detail.escalationReason && <Row label={t("support.detail.escalation_reason", effectiveLocale)}>{detail.escalationReason}</Row>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CaseDetailPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-8 w-48 animate-pulse rounded bg-slate-100" /></div>}>
      <CaseDetailContent />
    </Suspense>
  );
}
