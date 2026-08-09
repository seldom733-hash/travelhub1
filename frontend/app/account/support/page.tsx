"use client";

import { useEffect, useState } from "react";
import NotAvailableCard from "@/components/account/NotAvailableCard";
import { accountApi } from "@/lib/account-api";
import { t, useLocale } from "@/lib/i18n";

/**
 * PHASE 1 STEP 1.13 §11 — /account/support.
 * Полноценный Support domain — Phase 3. Сейчас: entry point + empty state +
 * CTA «Связаться с поддержкой» только тогда, когда появится реальный безопасный
 * flow (пока его нет — CTA не показываем). Legacy chat fragments не используются
 * как новая canonical Support модель без решения.
 */
export default function AccountSupportPage() {
  const locale = useLocale();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    accountApi
      .getSupport()
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
        <h1 className="text-2xl font-bold text-slate-900">{t("account.support_title", locale)}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("account.support", locale)}</p>
      </div>
      {loaded ? (
        <NotAvailableCard icon="🎧" emptyText={t("account.support_empty", locale)} hint={t("account.not_yet", locale)} />
      ) : (
        <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" aria-busy="true" />
      )}
    </div>
  );
}
