"use client";

import { useCallback, useEffect, useState } from "react";
import { sellerApi, type SellerProposalView } from "@/lib/seller-api";
import Pagination from "@/components/Pagination";
import { t, useLocale } from "@/lib/i18n";
import { formatLocation } from "@/lib/locations";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  IN_REVIEW: "IN REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CHANGES_REQUESTED: "CHANGES REQUESTED",
};

const REASON_KEYS: Record<string, string> = {
  INSUFFICIENT_INFO: "seller.reason_insufficient_info",
  INAPPROPRIATE_NAME: "seller.reason_inappropriate_name",
  MISLEADING_CONTENT: "seller.reason_misleading",
  DISINTERMEDIATION_ATTEMPT: "seller.reason_disintermediation",
  OTHER: "seller.reason_other",
};

/**
 * PHASE 1 STEP 1.11 §6 — /app/seller-profiles (MODERATOR review queue).
 * Требует seller_public_profile.* (MODERATOR/ADMIN). MODERATOR решает, какую
 * публичную идентичность разрешено показывать: approve alias, approve brand,
 * reject, request changes, hide. MODERATOR НЕ получает CRM edit rights.
 */
export default function SellerProfilesReviewPage() {
  const locale = useLocale();
  const [items, setItems] = useState<SellerProposalView[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SellerProposalView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("OTHER");
  const [comment, setComment] = useState("");
  const [action, setAction] = useState<"approve_alias" | "approve_brand" | "reject" | "request-changes" | null>(null);
  const [busy, setBusy] = useState(false);
  const [hiddenPartnerIds, setHiddenPartnerIds] = useState<Set<string>>(new Set());

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await sellerApi.listProposals({ status: statusFilter || undefined, page, pageSize: 20 });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const open = async (id: string) => {
    setSelected(null);
    setAction(null);
    setReason("OTHER");
    setComment("");
    try {
      const detail = await sellerApi.getProposal(id);
      setSelected(detail);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const runAction = async (next: "IN_REVIEW" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED", mode?: "VERIFIED_ALIAS" | "PUBLIC_BRAND") => {
    if (!selected) return;
    if ((next === "REJECTED" || next === "CHANGES_REQUESTED") && reason === "OTHER" && comment.trim().length < 3) {
      setError(t("seller.comment", locale) + " (OTHER)");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (next === "IN_REVIEW") await sellerApi.startReview(selected.id);
      else if (next === "APPROVED") await sellerApi.approve(selected.id, mode ?? "VERIFIED_ALIAS");
      else if (next === "REJECTED") await sellerApi.reject(selected.id, reason, comment || undefined);
      else await sellerApi.requestChanges(selected.id, reason, comment || undefined);
      setAction(null);
      setComment("");
      await open(selected.id);
      await loadQueue();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleHide = async (proposal: SellerProposalView) => {
    if (!proposal.partnerId) return;
    setBusy(true);
    setError("");
    try {
      if (hiddenPartnerIds.has(proposal.partnerId)) {
        await sellerApi.unhide(proposal.partnerId);
        setHiddenPartnerIds((prev) => {
          const next = new Set(prev);
          next.delete(proposal.partnerId);
          return next;
        });
      } else {
        await sellerApi.hide(proposal.partnerId);
        setHiddenPartnerIds((prev) => new Set(prev).add(proposal.partnerId));
      }
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
          <h1 className="text-xl font-bold text-slate-900">{t("seller.review_queue_title", locale)}</h1>
          <p className="text-xs text-slate-500">{t("seller.review_subtitle", locale)} · {total}</p>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">
          <option value="">{t("seller.queue_empty", locale)}</option>
          <option value="SUBMITTED">SUBMITTED</option>
          <option value="IN_REVIEW">IN REVIEW</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="CHANGES_REQUESTED">CHANGES REQUESTED</option>
        </select>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Queue ── */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{t("seller.history", locale)}</div>
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">{t("state.loading", locale)}</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">{t("seller.queue_empty", locale)}</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => void open(item.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${selected?.id === item.id ? "bg-blue-50/60" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-800">{item.requestedDisplayName ?? item.code}</div>
                      <div className="truncate text-xs text-slate-400">
                        {item.code} · {formatLocation(item.profileCountryCode, item.requestedCityCode, locale) ?? item.profileCountryCode ?? "—"}
                        {item.partnerId && hiddenPartnerIds.has(item.partnerId) ? " · HIDDEN" : ""}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.status === "IN_REVIEW" ? "bg-amber-50 text-amber-700" : item.status === "SUBMITTED" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {total > 20 && (
            <div className="px-4 pb-2">
              <Pagination page={page} pageSize={20} total={total} onPageChange={setPage} />
            </div>
          )}
        </section>

        {/* ── Detail + actions ── */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{t("seller.status", locale)}</div>
          {!selected ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">{t("seller.no_proposal", locale)}</div>
          ) : (
            <div className="space-y-4 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${selected.status === "IN_REVIEW" ? "bg-amber-50 text-amber-700" : selected.status === "SUBMITTED" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                  {STATUS_LABELS[selected.status] ?? selected.status}
                </span>
                <span className="font-mono text-xs text-slate-400">{selected.code}</span>
                <span className="text-xs text-slate-400">· {selected.submittedByUsername ?? "—"}</span>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <div className="col-span-2 flex justify-between gap-2">
                  <dt className="text-slate-500">{t("seller.display_name", locale)}</dt>
                  <dd className="font-medium">{selected.requestedDisplayName ?? "—"}</dd>
                </div>
                <div className="col-span-2 flex justify-between gap-2">
                  <dt className="text-slate-500">{t("seller.description", locale)}</dt>
                  <dd className="whitespace-pre-line text-slate-600">{selected.requestedDescription ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">{t("seller.country_system", locale)}</dt>
                  <dd>{selected.profileCountryCode ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">{t("seller.city_label", locale)}</dt>
                  <dd>{selected.requestedCityCode ? (formatLocation(selected.profileCountryCode, selected.requestedCityCode, locale) ?? selected.requestedCityCode) : "—"}</dd>
                </div>
              </dl>

              {(canStart || canDecide) && (
                <div className="space-y-3 border-t border-slate-100 pt-3">
                  {canStart && (
                    <button onClick={() => void runAction("IN_REVIEW")} disabled={busy} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                      {t("partner.review_start", locale)}
                    </button>
                  )}
                  {canDecide && (
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setAction("approve_alias")} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                        {t("seller.approve_alias", locale)}
                      </button>
                      <button onClick={() => setAction("approve_brand")} disabled={busy} className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
                        {t("seller.approve_brand", locale)}
                      </button>
                      <button onClick={() => setAction("reject")} disabled={busy} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                        {t("seller.reject", locale)}
                      </button>
                      <button onClick={() => setAction("request-changes")} disabled={busy} className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                        {t("seller.request_changes", locale)}
                      </button>
                    </div>
                  )}
                  {action && (
                    <div className="space-y-2">
                      {action !== "approve_alias" && action !== "approve_brand" && (
                        <>
                          <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs">
                            {Object.entries(REASON_KEYS).map(([code, key]) => (
                              <option key={code} value={code}>
                                {t(key, locale)}
                              </option>
                            ))}
                          </select>
                          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder={t("seller.comment", locale)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                        </>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => void runAction(action === "approve_alias" || action === "approve_brand" ? "APPROVED" : action === "reject" ? "REJECTED" : "CHANGES_REQUESTED", action === "approve_brand" ? "PUBLIC_BRAND" : "VERIFIED_ALIAS")}
                          disabled={busy}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {busy ? t("state.loading", locale) : t("partner.review_confirm", locale)}
                        </button>
                        <button onClick={() => { setAction(null); setComment(""); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100">
                          {t("partner.cancel", locale)}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selected.partnerId && (
                <div className="border-t border-slate-100 pt-3">
                  <button onClick={() => void toggleHide(selected)} disabled={busy} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                    {hiddenPartnerIds.has(selected.partnerId) ? t("seller.unhide_identity", locale) : t("seller.hide_identity", locale)}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
