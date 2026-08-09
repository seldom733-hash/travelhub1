"use client";

import { useEffect, useState } from "react";
import NotAvailableCard from "@/components/account/NotAvailableCard";
import { accountApi } from "@/lib/account-api";
import { t, useLocale } from "@/lib/i18n";

/**
 * PHASE 1 STEP 1.13 §10 — /account/documents.
 * Documents domain ещё не завершён: route/layout/empty state допустимы, но без
 * fake vouchers/invoices (§10). Контракт — controlled empty из backend. Позже сюда
 * попадут только документы, доступные Buyer по access rules (Order/Booking/
 * Payment/Support contexts).
 */
export default function AccountDocumentsPage() {
  const locale = useLocale();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    accountApi
      .getDocuments()
      .then(() => {
        if (alive) setLoaded(true);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("account.documents_title", locale)}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("account.documents", locale)}</p>
      </div>
      {loaded ? (
        <NotAvailableCard icon="📄" emptyText={t("account.documents_empty", locale)} hint={t("account.not_yet", locale)} />
      ) : (
        <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" aria-busy="true" />
      )}
    </div>
  );
}
