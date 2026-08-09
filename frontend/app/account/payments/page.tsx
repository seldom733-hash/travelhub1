"use client";

import { useEffect, useState } from "react";
import NotAvailableCard from "@/components/account/NotAvailableCard";
import { accountApi } from "@/lib/account-api";
import { t, useLocale } from "@/lib/i18n";

/**
 * PHASE 1 STEP 1.13 §9 — /account/payments.
 * Finance domain ещё не существует (Phase 2): страница использует controlled
 * empty contract из backend (`available:false`) и показывает neutral empty state.
 * Никаких PSP/intent/charge/refund — преждевременный Finance не реализуется.
 * PSP secrets / raw card data / partner payout data никогда не отображаются.
 */
export default function AccountPaymentsPage() {
  const locale = useLocale();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    accountApi
      .getPayments()
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
        <h1 className="text-2xl font-bold text-slate-900">{t("account.payments_title", locale)}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("account.order_payment", locale)}</p>
      </div>
      {loaded ? (
        <NotAvailableCard icon="💳" emptyText={t("account.payments_empty", locale)} hint={t("account.not_yet", locale)} />
      ) : (
        <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" aria-busy="true" />
      )}
    </div>
  );
}
