"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale, formatDate } from "@/lib/i18n";
import { pt } from "@/lib/partner-i18n";
import { partnerApi, type PartnerModerationView, type PartnerProductDetail } from "@/lib/partner-api";

const DOT: Record<string, string> = {
  SUBMITTED: "bg-blue-500",
  IN_REVIEW: "bg-indigo-500",
  APPROVED: "bg-emerald-500",
  REJECTED: "bg-rose-500",
  CHANGES_REQUESTED: "bg-rose-400",
};

/**
 * PHASE 1 STEP 1.8 §17/§18 — Moderation result/history (только own Product).
 * Показывает: статус, submittedAt, reviewedAt/decidedAt, решение, локализованную
 * причину, комментарий модератора, предыдущие submission'ы. При
 * CHANGES_REQUESTED — reopen edit + повторный submit (история не перезаписывается).
 */
export default function ProductModerationPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const locale = useLocale();

  const [history, setHistory] = useState<PartnerModerationView[] | null>(null);
  const [product, setProduct] = useState<PartnerProductDetail | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!id) return;
    let alive = true;
    Promise.all([partnerApi.getProduct(id).catch(() => null), partnerApi.moderationHistory(id).catch(() => [] as PartnerModerationView[])])
      .then(([p, h]) => {
        if (!alive) return;
        setProduct(p);
        setHistory(h);
      })
      .catch((err) => {
        if (alive) setError((err as Error).message);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const active = history?.find((m) => m.status === "SUBMITTED" || m.status === "IN_REVIEW") ?? null;
  const latest = history?.[0] ?? null;

  const canSubmit = product && !active && (product.status === "DRAFT" || (product.status === "PUBLISHED" && !!product.draft));

  const submit = async () => {
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await partnerApi.submitModeration(id);
      setNotice(pt("partner.moderation.submit_ok", locale));
      const h = await partnerApi.moderationHistory(id);
      setHistory(h);
      const p = await partnerApi.getProduct(id);
      setProduct(p);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!history) {
    return <div className="py-16 text-center text-sm text-slate-400">{pt("partner.state.loading", locale)}</div>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <Link href={`/partner/products/${id}`} className="text-sm text-slate-500 hover:text-emerald-700">
          {pt("partner.product.back", locale)}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{pt("partner.moderation.title", locale)}</h1>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      {active && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {pt("partner.moderation.pending", locale)} — {pt(`partner.moderation.${active.status}`, locale)}
        </div>
      )}

      {canSubmit && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="flex-1 text-sm text-slate-600">
            {latest?.status === "CHANGES_REQUESTED" ? pt("partner.moderation.resubmit_hint", locale) : pt("partner.moderation.submit", locale)}
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? pt("partner.moderation.submitting", locale) : pt("partner.moderation.submit", locale)}
          </button>
        </div>
      )}

      {latest?.status === "CHANGES_REQUESTED" && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {latest.reasonCode && <div className="font-medium">{pt(`partner.reason.${latest.reasonCode}`, locale)}</div>}
          {latest.comment && <div className="mt-1">«{latest.comment}»</div>}
          <Link href={`/partner/products/${id}/edit`} className="mt-2 inline-block text-sm font-medium text-rose-700 underline">
            {pt("partner.product.edit", locale)} →
          </Link>
        </div>
      )}

      {history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
          {pt("partner.moderation.empty", locale)}
        </div>
      ) : (
        <ol className="space-y-3">
          {history.map((m, i) => (
            <li key={m.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <span className={`mt-1 size-2.5 shrink-0 rounded-full ${DOT[m.status] ?? "bg-slate-300"}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{pt(`partner.moderation.${m.status}`, locale)}</span>
                    <span className="text-xs text-slate-400">
                      {i === 0 && latest?.status === m.status ? " · " : ""}
                      {pt("partner.moderation.submitted_at", locale)}: {formatDate(m.submittedAt, locale)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
                    <span>
                      {pt("partner.moderation.version", locale)} v{m.productVersion}
                      {m.draftVersion !== null ? ` · N+1 rev ${m.draftVersion}` : ""}
                    </span>
                    {m.decidedAt && <span>{pt("partner.moderation.decided_at", locale)}: {formatDate(m.decidedAt, locale)}</span>}
                  </div>
                  {m.reasonCode && (
                    <div className="mt-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
                      <span className="font-medium">{pt(`partner.reason.${m.reasonCode}`, locale)}</span>
                      {m.comment && <span className="text-rose-600"> — «{m.comment}»</span>}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
