"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountApi, type OwnProfile } from "@/lib/account-api";
import { useCurrentUser } from "@/lib/use-user";
import { t, useLocale } from "@/lib/i18n";

/**
 * PHASE 1 STEP 1.13 §5 — Buyer Cabinet overview (/account).
 *
 * Показывает ТОЛЬКО реальные данные:
 *  - имя/email/клиентская карточка из own-profile (identity + CRM projection);
 *  - profile completeness (клиентский расчёт из реальных полей);
 *  - purchase counters только там, где authoritative data существует
 *    (Orders/Bookings — реальные own-scope read-модели);
 *  - Payments/Documents/Support — neutral empty state (canonical domain ещё нет).
 * Никаких fake KPI / синтетических counters (§5, §25).
 */
export default function AccountOverviewPage() {
  const user = useCurrentUser();
  const locale = useLocale();
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [ordersTotal, setOrdersTotal] = useState<number | null>(null);
  const [bookingsTotal, setBookingsTotal] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    // Каждый источник независимо: сбой одного counter'а не стирает профиль.
    accountApi
      .getProfile()
      .then((p) => {
        if (alive) setProfile(p);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    accountApi
      .getOrders()
      .then((r) => {
        if (alive) setOrdersTotal(r.total);
      })
      .catch(() => undefined);
    accountApi
      .getBookings()
      .then((r) => {
        if (alive) setBookingsTotal(r.total);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!user) return null;
  if (error) return <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</div>;

  const info = profile?.user;
  const customer = profile?.customer;
  const displayName = customer?.firstName || customer?.lastName ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") : info?.fullName ?? user.username;

  // Реальная заполненность профиля (из own-profile полей, не выдуманная).
  const present = [customer?.firstName, customer?.lastName, customer?.phone, info?.email].filter(Boolean).length;
  const totalFields = 4;
  const completeness = Math.round((present / totalFields) * 100);

  const sections = [
    {
      href: "/account/orders",
      title: t("account.orders", locale),
      icon: "🧾",
      body: ordersTotal === null ? t("state.loading", locale) : ordersTotal > 0 ? `${ordersTotal}` : t("account.orders_empty", locale),
      ready: ordersTotal !== null,
    },
    {
      href: "/account/bookings",
      title: t("account.bookings", locale),
      icon: "📑",
      body: bookingsTotal === null ? t("state.loading", locale) : bookingsTotal > 0 ? `${bookingsTotal}` : t("account.bookings_empty", locale),
      ready: bookingsTotal !== null,
    },
    { href: "/account/payments", title: t("account.payments", locale), icon: "💳", body: t("account.payments_empty", locale) },
    { href: "/account/documents", title: t("account.documents", locale), icon: "📄", body: t("account.documents_empty", locale) },
    { href: "/account/support", title: t("account.support", locale), icon: "🎧", body: t("account.support_empty", locale) },
  ];

  return (
    <div className="space-y-6">
      {/* ── Buyer summary ── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">{t("account.buyer_summary", locale)}</p>
          <h1 className="mt-1 text-2xl font-bold">{displayName}</h1>
          <p className="mt-0.5 text-sm text-blue-100">{info?.email ?? user.email ?? ""}</p>
        </div>
        <dl className="grid gap-x-6 gap-y-3 px-6 py-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">{t("account.customer_ref", locale)}</dt>
            <dd className="font-medium text-slate-900">{customer ? customer.code : "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("account.status", locale)}</dt>
            <dd className="font-medium text-emerald-600">{info?.status ?? "ACTIVE"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("account.profile_completeness", locale)}</dt>
            <dd>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-200" role="presentation">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${completeness}%` }} />
                </div>
                <span className="text-xs font-medium text-slate-600">{completeness}%</span>
              </div>
            </dd>
          </div>
        </dl>
        <div className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
          {completeness === 100 ? t("account.profile_complete", locale) : t("account.profile_partial", locale)}
        </div>
      </section>

      {/* ── Purchase sections ── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("account.purchase_sections", locale)}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-slate-50 text-lg transition-colors group-hover:bg-blue-50" aria-hidden>
                  {s.icon}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{s.title}</div>
                  <div className="truncate text-sm text-slate-500">{s.body}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-slate-400">
        <Link href="/account/profile" className="text-blue-600 hover:text-blue-700">
          {t("account.profile", locale)}
        </Link>
        {" · "}
        <Link href="/" className="text-blue-600 hover:text-blue-700">
          {t("nav.to_marketplace", locale)}
        </Link>
      </p>
    </div>
  );
}
