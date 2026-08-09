"use client";

import { useCallback, useEffect, useState } from "react";
import { accountApi, type OwnOrdersResult } from "@/lib/account-api";
import { formatDate, formatPrice, orderStatusLabel, paymentStatusLabel, t, useLocale } from "@/lib/i18n";

const PAGE_SIZE = 10;

/**
 * PHASE 1 STEP 1.13 §7 — /account/orders (Buyer Cabinet read-model foundation).
 *
 * Кабинет НЕ владеет Order: здесь read-only own-scope records (Order.customerId ==
 * actor.customerId, серверный scope). Показываются только реальные существующие
 * заказы либо честный empty state — никаких fake данных (§25). Temporal semantics:
 * createdAt — canonical создание, serviceDate — услуга (§13). Серверная пагинация
 * (page/pageSize/hasMore) — без silent truncation (§8).
 */
export default function AccountOrdersPage() {
  const locale = useLocale();
  const [data, setData] = useState<OwnOrdersResult | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setError("");
    accountApi
      .getOrders({ page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const goPrev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const goNext = useCallback(() => setPage((p) => p + 1), []);

  if (error) return <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("account.orders_title", locale)}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data !== null ? `${t("account.orders", locale)}: ${data.total}` : t("state.loading", locale)}
          </p>
        </div>
      </div>

      {data === null ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-slate-50 text-2xl" aria-hidden>
            🧾
          </div>
          <p className="text-base font-medium text-slate-700">{t("account.orders_empty", locale)}</p>
          <p className="mt-1 text-sm text-slate-500">{t("account.orders_empty_hint", locale)}</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Desktop table */}
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">{t("account.order_code", locale)}</th>
                  <th scope="col" className="px-5 py-3 font-semibold">{t("account.order_status", locale)}</th>
                  <th scope="col" className="px-5 py-3 font-semibold">{t("account.order_payment", locale)}</th>
                  <th scope="col" className="px-5 py-3 font-semibold">{t("account.order_amount", locale)}</th>
                  <th scope="col" className="px-5 py-3 font-semibold">{t("account.order_service_date", locale)}</th>
                  <th scope="col" className="px-5 py-3 font-semibold">{t("account.order_created", locale)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((o) => (
                  <tr key={o.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {o.code}
                      <div className="text-xs text-slate-400">{o.number}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {orderStatusLabel(o.status, locale)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{paymentStatusLabel(o.paymentStatus, locale)}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">{formatPrice(o.amount, o.currency, locale) ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(o.serviceDate, locale) || "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(o.createdAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {data.items.map((o) => (
                <li key={o.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900">{o.code}</div>
                    <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {orderStatusLabel(o.status, locale)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{o.number}</div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">{t("account.order_amount", locale)}</dt>
                      <dd className="font-medium text-slate-900">{formatPrice(o.amount, o.currency, locale) ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">{t("account.order_payment", locale)}</dt>
                      <dd className="text-slate-700">{paymentStatusLabel(o.paymentStatus, locale)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">{t("account.order_service_date", locale)}</dt>
                      <dd className="text-slate-700">{formatDate(o.serviceDate, locale) || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">{t("account.order_created", locale)}</dt>
                      <dd className="text-slate-700">{formatDate(o.createdAt, locale)}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </div>

          {/* Pagination (§8): явные page controls, без «как будто всё показано» */}
          <nav className="flex items-center justify-between gap-3 text-sm" aria-label={t("account.orders", locale)}>
            <button
              onClick={goPrev}
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("pagination.prev", locale)}
            </button>
            <span className="text-xs text-slate-500">
              {t("pagination.page", locale)} {data.page} {t("pagination.of", locale)} {totalPages} · {data.total}
            </span>
            <button
              onClick={goNext}
              disabled={!data.hasMore}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("pagination.next", locale)}
            </button>
          </nav>
        </>
      )}
    </div>
  );
}
