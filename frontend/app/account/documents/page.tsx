"use client";

import { useEffect, useState } from "react";
import { accountApi, type DocumentItem } from "@/lib/account-api";
import { t, useLocale } from "@/lib/i18n";

const TYPE_LABELS: Record<string, string> = {
  VOUCHER: "Voucher",
  PARTIAL_PAYMENT: "Partial Payment",
  REFUND: "Refund",
};

const STATUS_LABELS: Record<string, string> = {
  ISSUED: "Active",
  SUPERSEDED: "Superseded",
  INVALIDATED: "Invalidated",
  NOT_ISSUED: "Pending",
};

const STATUS_COLORS: Record<string, string> = {
  ISSUED: "bg-green-100 text-green-700",
  SUPERSEDED: "bg-slate-100 text-slate-500",
  INVALIDATED: "bg-red-100 text-red-600",
  NOT_ISSUED: "bg-amber-100 text-amber-700",
};

/**
 * PHASE 3 D13 — /account/documents.
 * Functional document list for Buyer Cabinet.
 */
export default function AccountDocumentsPage() {
  const locale = useLocale();
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    accountApi
      .getDocuments({ page, pageSize: 20 })
      .then((res) => {
        if (alive) {
          setItems(res.items);
          setTotal(res.total);
          setLoaded(true);
        }
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [page]);

  if (error) return <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("account.documents_title", locale)}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("account.documents", locale)}</p>
      </div>

      {!loaded ? (
        <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" aria-busy="true" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-base font-medium text-slate-700">{t("account.documents_empty", locale)}</p>
          <p className="mt-1 text-sm text-slate-500">{t("account.not_yet", locale)}</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500">{total} document{total !== 1 ? "s" : ""}</p>
          <div className="space-y-3">
            {items.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">
                    {doc.type === "VOUCHER" ? "📄" : doc.type === "REFUND" ? "💰" : "🧾"}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{doc.code}</span>
                      <span className="text-xs text-slate-400">{TYPE_LABELS[doc.type] ?? doc.type}</span>
                    </div>
                    <div className="mt-0.5 text-sm text-slate-500">
                      {doc.bookingCode && <span>Booking: {doc.bookingCode}</span>}
                      {doc.serviceDate && <span className="ml-2">Service: {new Date(doc.serviceDate).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {doc.totalAmount && (
                    <span className="text-sm font-medium text-slate-700">
                      {doc.totalAmount} {doc.currency}
                    </span>
                  )}
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[doc.status] ?? ""}`}>
                    {STATUS_LABELS[doc.status] ?? doc.status}
                  </span>
                  {doc.status === "ISSUED" && (
                    <a
                      href={`/api/v1/account/documents/${doc.id}/download`}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Download
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          {total > 20 && (
            <div className="flex justify-center gap-2 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-sm text-slate-600">Page {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={items.length < 20}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
