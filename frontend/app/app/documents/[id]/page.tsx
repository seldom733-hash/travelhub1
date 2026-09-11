"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  documentsApi,
  type DocumentDetail,
} from "@/lib/documents-api";
import StatusBadge from "@/components/StatusBadge";
import { useLocale, t, LOCALE_TAGS } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";
import { fmtDate } from "@/lib/temporal-display";

function documentTypeLabel(code: string, locale: import("@/lib/i18n").Locale): string {
  const key = `documents.type.${code}`;
  const localized = t(key, locale);
  return localized !== key ? localized : code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function documentStatusLabel(code: string, locale: import("@/lib/i18n").Locale): string {
  const key = `documents.status.${code}`;
  const localized = t(key, locale);
  return localized !== key ? localized : code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtMoney(amount: string | null, currency: string | null | undefined, locale: import("@/lib/i18n").Locale): string {
  if (!amount) return "—";
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  return `${value.toLocaleString(LOCALE_TAGS[locale], { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency ?? ""}`;
}

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const locale = useLocale();
  const canWrite = useCan("documents.write");
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [invalidateOpen, setInvalidateOpen] = useState(false);
  const [invalidateReason, setInvalidateReason] = useState("");
  const [invalidateBusy, setInvalidateBusy] = useState(false);
  const [invalidateError, setInvalidateError] = useState("");

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const d = await documentsApi.get(params.id);
      setDoc(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const handleInvalidate = async () => {
    if (!doc || !invalidateReason.trim()) return;
    setInvalidateBusy(true);
    setInvalidateError("");
    try {
      await documentsApi.invalidate(doc.id, invalidateReason.trim());
      setInvalidateOpen(false);
      setInvalidateReason("");
      await load();
    } catch (e) {
      setInvalidateError((e as Error).message);
    } finally {
      setInvalidateBusy(false);
    }
  };

  const snapshot = doc?.versions?.[0]?.snapshot as Record<string, unknown> | undefined;
  const travelers = (snapshot?.travelers as Array<Record<string, unknown>> | undefined) ?? [];
  const bookingCode = (snapshot?.bookingCode as string) ?? null;
  const orderCode = (snapshot?.orderCode as string) ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/app/documents" className="hover:text-blue-600">{t("nav.documents", locale)}</Link>
        <span>/</span>
        <span className="text-slate-700">{doc?.code ?? "…"}</span>
      </nav>

      {busy ? (
        <div className="space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-100" />
          <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : doc ? (
        <>
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{doc.code}</h1>
              <div className="mt-1 flex items-center gap-3">
                <StatusBadge status={doc.status} />
                <span className="text-sm text-slate-500">{documentTypeLabel(doc.type, locale)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={documentsApi.downloadUrl(doc.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                target="_blank"
                rel="noopener noreferrer"
              >
                ↓ {t("documents.detail.download", locale)}
              </a>
              {canWrite && doc.status !== "INVALIDATED" && (
                <button
                  onClick={() => setInvalidateOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  ✕ {t("documents.detail.invalidate", locale)}
                </button>
              )}
            </div>
          </div>

          {/* Info card */}
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3">
            <InfoItem label={t("documents.detail.booking", locale)} value={bookingCode ?? "—"} />
            <InfoItem label={t("documents.detail.order", locale)} value={orderCode ?? "—"} />
            <InfoItem label={t("documents.detail.payment", locale)} value={doc.paymentStatus ?? "—"} />
            <InfoItem label={t("documents.detail.service_date", locale)} value={doc.serviceDate ? fmtDate(doc.serviceDate, locale) : "—"} />
            <InfoItem label={t("documents.detail.total_amount", locale)} value={fmtMoney(doc.totalAmount, doc.currency, locale)} />
            <InfoItem label={t("documents.detail.paid_amount", locale)} value={fmtMoney(doc.paidAmount, doc.currency, locale)} />
            <InfoItem label={t("documents.detail.currency", locale)} value={doc.currency ?? "—"} />
            <InfoItem label={t("documents.detail.payment_status", locale)} value={doc.paymentStatus ?? "—"} />
            <InfoItem label={t("documents.detail.version", locale)} value={`v${doc.version}`} />
            <InfoItem label={t("documents.detail.created", locale)} value={fmtDate(doc.createdAt, locale)} />
          </div>

          {/* Travelers (from snapshot) */}
          {travelers.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("documents.detail.traveler", locale)}</h2>
              <div className="space-y-2">
                {travelers.map((tr, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="font-medium text-slate-700">
                      {String(tr.firstName ?? "")} {String(tr.lastName ?? "")}
                    </span>
                    <span className="text-xs text-slate-400">
                      {tr.passportNumber ? String(tr.passportNumber) : t("documents.pii.redacted", locale)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Versions */}
          {doc.versions.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("documents.detail.versions", locale)}</h2>
              <div className="space-y-1.5">
                {doc.versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <span className="font-mono font-medium text-slate-700">v{v.versionNumber}</span>
                    <span className="text-slate-500">{fmtDate(v.createdAt, locale)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          {doc.history.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("documents.detail.history", locale)}</h2>
              <div className="space-y-1.5">
                {doc.history.map((h) => (
                  <div key={h.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <div className="font-medium text-slate-600">{h.action}</div>
                    {h.comment && <div className="text-slate-400">{h.comment}</div>}
                    <div className="text-slate-400">{fmtDate(h.createdAt, locale)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invalidate dialog */}
          {invalidateOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                <h3 className="mb-4 text-lg font-semibold text-slate-800">{t("documents.detail.invalidate_title", locale)}</h3>
                <textarea
                  value={invalidateReason}
                  onChange={(e) => setInvalidateReason(e.target.value)}
                  placeholder={t("documents.detail.invalidate_reason", locale)}
                  className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  rows={3}
                />
                {invalidateError && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{invalidateError}</div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setInvalidateOpen(false); setInvalidateReason(""); setInvalidateError(""); }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    {t("documents.detail.invalidate_cancel", locale)}
                  </button>
                  <button
                    onClick={() => void handleInvalidate()}
                    disabled={invalidateBusy || !invalidateReason.trim()}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {invalidateBusy ? "…" : t("documents.detail.invalidate_confirm", locale)}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-700">{value}</div>
    </div>
  );
}
