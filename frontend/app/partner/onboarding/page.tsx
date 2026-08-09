"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { partnerOnboardingApi, type PartnerApplicationView } from "@/lib/partner-onboarding-api";
import { t, useLocale } from "@/lib/i18n";

const STATUS_LABEL_KEYS: Record<string, string> = {
  DRAFT: "partner.status_draft",
  SUBMITTED: "partner.status_submitted",
  IN_REVIEW: "partner.status_in_review",
  APPROVED: "partner.status_approved",
  REJECTED: "partner.status_rejected",
  CHANGES_REQUESTED: "partner.status_changes_requested",
  CANCELLED: "partner.status_cancelled",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-blue-50 text-blue-700",
  IN_REVIEW: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-600",
  CHANGES_REQUESTED: "bg-amber-50 text-amber-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

/**
 * PHASE 1 STEP 1.10 §17-18 — /partner/onboarding (статус заявки).
 * Pending applicant видит onboarding-статус, НЕ Product management.
 * APPROVED → /partner (Cabinet); legacy PARTNER (без заявки) → /partner.
 */
export default function PartnerOnboardingPage() {
  const router = useRouter();
  const locale = useLocale();
  const [app, setApp] = useState<PartnerApplicationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    partnerOnboardingApi
      .getOwnApplication()
      .then((a) => {
        if (!alive) return;
        if (!a) {
          // Legacy PARTNER без заявки → обычный Cabinet.
          router.replace("/partner");
          return;
        }
        setApp(a);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [router]);

  const submit = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const updated = await partnerOnboardingApi.submitOwnApplication();
      setApp(updated);
      setMessage(t("partner.submitted_ok", locale));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="py-10 text-center text-sm text-slate-400">{t("state.loading", locale)}</div>;
  if (error) return <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!app) return null;

  const isEditable = app.editable;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("partner.onboarding_title", locale)}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("partner.onboarding_hint", locale)}</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLES[app.status] ?? "bg-slate-100 text-slate-600"}`}>
            {t(STATUS_LABEL_KEYS[app.status] ?? app.status, locale)}
          </span>
          <span className="text-xs text-slate-400">
            {app.code} · {app.applicantType}
          </span>
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4"><dt className="text-slate-500">{t("partner.brand_name", locale)}</dt><dd className="font-medium text-slate-900">{app.brandName}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-slate-500">{t("partner.country", locale)}</dt><dd className="font-medium text-slate-900">{app.country}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-slate-500">{t("partner.contact_email", locale)}</dt><dd className="font-medium text-slate-900">{app.contactEmail}</dd></div>
          {app.legalName && <div className="flex justify-between gap-4"><dt className="text-slate-500">{t("partner.legal_name", locale)}</dt><dd className="font-medium text-slate-900">{app.legalName}</dd></div>}
          {app.registrationNumber && <div className="flex justify-between gap-4"><dt className="text-slate-500">{t("partner.registration_number", locale)}</dt><dd className="font-medium text-slate-900">{app.registrationNumber}</dd></div>}
          {app.serviceCategories && app.serviceCategories.length > 0 && (
            <div className="flex justify-between gap-4"><dt className="text-slate-500">{t("partner.service_categories", locale)}</dt><dd className="font-medium text-slate-900">{app.serviceCategories.length}</dd></div>
          )}
        </dl>

        {app.decisionReason && app.status !== "APPROVED" && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <div className="font-medium">{t("partner.review_feedback", locale)}</div>
            <div className="mt-1">{app.decisionReason}</div>
          </div>
        )}

        {message && <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">{message}</div>}
        {error && <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}

        <div className="mt-5 flex flex-wrap gap-3">
          {app.status === "APPROVED" && (
            <Link href="/partner" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              {t("partner.go_cabinet", locale)} →
            </Link>
          )}
          {isEditable && (
            <>
              <Link href="/partner/onboarding/edit" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-700">
                {t("partner.edit_application", locale)}
              </Link>
              <button onClick={() => void submit()} disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {busy ? t("state.loading", locale) : t("partner.submit_application", locale)}
              </button>
            </>
          )}
          {!isEditable && app.status !== "APPROVED" && (
            <p className="text-xs text-slate-400">{t("partner.readonly_hint", locale)}</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("partner.history_title", locale)}</h2>
        <ol className="space-y-2">
          {app.history.map((h) => (
            <li key={h.id} className="flex items-start gap-3 text-sm">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
              <div>
                <span className="font-medium text-slate-700">{h.action.replaceAll("_", " ")}</span>
                {h.comment && <span className="text-slate-500"> — {h.comment}</span>}
                <div className="text-xs text-slate-400">{new Date(h.createdAt).toLocaleString()}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
