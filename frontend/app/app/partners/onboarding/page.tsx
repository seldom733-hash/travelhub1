"use client";

import { useCallback, useEffect, useState } from "react";
import { partnerOnboardingApi, type PartnerApplicationView, type ReviewQueueItem } from "@/lib/partner-onboarding-api";
import { useLocale, t } from "@/lib/i18n";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  IN_REVIEW: "IN REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CHANGES_REQUESTED: "CHANGES REQUESTED",
  CANCELLED: "CANCELLED",
};

/**
 * PHASE 1 STEP 1.10 §14/§27 — /app/partners/onboarding (internal review queue).
 * Требует `partner.onboarding.review` (ADMIN/DIRECTOR). НЕ смешивается с
 * Product Moderation queue. Заявитель не может видеть очередь (403).
 */
export default function PartnerOnboardingReviewPage() {
  const locale = useLocale();
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  type ReviewDetail = PartnerApplicationView & { user: { id: string; username: string; email: string | null } };
  const [selected, setSelected] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | "request-changes" | null>(null);
  const [busy, setBusy] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await partnerOnboardingApi.listReviewQueue({ status: statusFilter || undefined, search: search || undefined, pageSize: 50 });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const open = async (id: string) => {
    setSelected(null);
    setAction(null);
    setReason("");
    try {
      const detail = await partnerOnboardingApi.getReviewApplication(id);
      setSelected(detail);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const runAction = async (nextStatus: "IN_REVIEW" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED") => {
    if (!selected) return;
    if ((nextStatus === "REJECTED" || nextStatus === "CHANGES_REQUESTED") && reason.trim().length < 3) {
      setError(t("partner.reason_required", locale));
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (nextStatus === "IN_REVIEW") await partnerOnboardingApi.startReview(selected.id);
      else if (nextStatus === "APPROVED") await partnerOnboardingApi.approve(selected.id);
      else if (nextStatus === "REJECTED") await partnerOnboardingApi.reject(selected.id, reason);
      else await partnerOnboardingApi.requestChanges(selected.id, reason);
      setAction(null);
      setReason("");
      await open(selected.id);
      await loadQueue();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const canStart = selected?.status === "SUBMITTED";
  const canDecide = selected?.status === "IN_REVIEW";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("partner.review_title", locale)}</h1>
          <p className="text-xs text-slate-500">
            {t("partner.review_subtitle", locale)} · {total}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">
            <option value="">{t("partner.review_queue", locale)}</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="IN_REVIEW">IN REVIEW</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="CHANGES_REQUESTED">CHANGES REQUESTED</option>
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("partner.review_search", locale)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400" />
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Queue ── */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t("partner.review_queue", locale)}
          </div>
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">{t("state.loading", locale)}</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">{t("partner.review_empty", locale)}</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => void open(item.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${selected?.id === item.id ? "bg-blue-50/60" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-800">{item.brandName}</div>
                      <div className="truncate text-xs text-slate-400">
                        {item.code} · {item.user?.email ?? item.user?.username} · {item.country}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.status === "IN_REVIEW" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Detail ── */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t("partner.review_detail", locale)}
          </div>
          {!selected ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">{t("partner.review_select_hint", locale)}</div>
          ) : (
            <div className="space-y-4 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${selected.status === "IN_REVIEW" ? "bg-amber-50 text-amber-700" : selected.status === "SUBMITTED" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                  {STATUS_LABELS[selected.status] ?? selected.status}
                </span>
                <span className="text-xs text-slate-400">{selected.code}</span>
                <span className="text-xs text-slate-400">· {selected.user?.username}</span>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <div className="flex justify-between gap-2"><dt className="text-slate-500">{t("partner.brand_name", locale)}</dt><dd className="font-medium">{selected.brandName}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">{t("partner.applicant_type", locale)}</dt><dd className="font-medium">{selected.applicantType}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">{t("partner.country", locale)}</dt><dd className="font-medium">{selected.country}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">{t("partner.contact_email", locale)}</dt><dd className="font-medium truncate">{selected.contactEmail}</dd></div>
                {selected.legalName && <div className="flex justify-between gap-2"><dt className="text-slate-500">{t("partner.legal_name", locale)}</dt><dd className="font-medium">{selected.legalName}</dd></div>}
                {selected.registrationNumber && <div className="flex justify-between gap-2"><dt className="text-slate-500">{t("partner.registration_number", locale)}</dt><dd className="font-medium">{selected.registrationNumber}</dd></div>}
                {selected.taxId && <div className="flex justify-between gap-2"><dt className="text-slate-500">{t("partner.tax_id", locale)}</dt><dd className="font-medium">{selected.taxId}</dd></div>}
                {selected.website && <div className="col-span-2 flex justify-between gap-2"><dt className="text-slate-500">{t("partner.website", locale)}</dt><dd className="font-medium truncate">{selected.website}</dd></div>}
                {selected.businessDescription && <div className="col-span-2"><dt className="text-slate-500 text-xs">{t("partner.business_description", locale)}</dt><dd className="text-slate-700">{selected.businessDescription}</dd></div>}
              </dl>

              {selected.decisionReason && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <b>{t("partner.review_feedback", locale)}</b> {selected.decisionReason}
                </div>
              )}

              {/* Actions */}
              {(canStart || canDecide) && (
                <div className="space-y-3 border-t border-slate-100 pt-3">
                  {canStart && (
                    <button onClick={() => void runAction("IN_REVIEW")} disabled={busy} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                      {t("partner.review_start", locale)}
                    </button>
                  )}
                  {canDecide && (
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setAction("approve")} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                        {t("partner.review_approve", locale)}
                      </button>
                      <button onClick={() => setAction("reject")} disabled={busy} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                        {t("partner.review_reject", locale)}
                      </button>
                      <button onClick={() => setAction("request-changes")} disabled={busy} className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                        {t("partner.review_request_changes", locale)}
                      </button>
                    </div>
                  )}
                  {action && (
                    <div className="space-y-2">
                      {action !== "approve" && (
                        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={t("partner.reason_placeholder", locale)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => void runAction(action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "CHANGES_REQUESTED")}
                          disabled={busy}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${action === "reject" ? "bg-red-600 hover:bg-red-700" : action === "request-changes" ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                        >
                          {busy ? t("state.loading", locale) : t("partner.review_confirm", locale)}
                        </button>
                        <button onClick={() => { setAction(null); setReason(""); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100">
                          {t("partner.cancel", locale)}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selected.history.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{t("partner.history_title", locale)}</div>
                  <ol className="space-y-1">
                    {selected.history.slice(0, 8).map((h) => (
                      <li key={h.id} className="text-xs text-slate-500">
                        <span className="font-medium text-slate-600">{h.action.replaceAll("_", " ")}</span>
                        {h.actorName ? ` · ${h.actorName}` : ""}
                        {h.comment ? ` — ${h.comment}` : ""}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
