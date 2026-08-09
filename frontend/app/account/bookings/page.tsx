"use client";

import { useCallback, useEffect, useState } from "react";
import { accountApi, type OwnBookingsResult } from "@/lib/account-api";
import { bookingStatusLabel, formatDate, formatPrice, t, useLocale } from "@/lib/i18n";

const PAGE_SIZE = 10;

/**
 * PHASE 1 STEP 1.13 §8 — /account/bookings (Buyer Cabinet read-model foundation).
 *
 * Booking ownership остаётся Booking domain; Buyer видит только СВОИ future/current
 * бронирования через доказанную Order relation (Booking.orderId → Order.customerId
 * == actor.customerId, серверный scope). Только реальные records либо честный
 * empty state — никаких fake Bookings (§25). Серверная пагинация (§8).
 */
export default function AccountBookingsPage() {
  const locale = useLocale();
  const [data, setData] = useState<OwnBookingsResult | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setError("");
    accountApi
      .getBookings({ page, pageSize: PAGE_SIZE })
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
          <h1 className="text-2xl font-bold text-slate-900">{t("account.bookings_title", locale)}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data !== null ? `${t("account.bookings", locale)}: ${data.total}` : t("state.loading", locale)}
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
            📑
          </div>
          <p className="text-base font-medium text-slate-700">{t("account.bookings_empty", locale)}</p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((b) => (
              <li key={b.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-slate-900">{b.code}</div>
                  <span className="inline-flex shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    {bookingStatusLabel(b.status, locale)}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-slate-500">{t("account.booking_order", locale)}</dt>
                    <dd className="font-medium text-slate-900">{b.orderCode}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">{t("account.booking_amount", locale)}</dt>
                    <dd className="text-slate-700">{formatPrice(b.amount, b.currency, locale) ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">{t("account.booking_service_date", locale)}</dt>
                    <dd className="text-slate-700">{formatDate(b.serviceDate, locale) || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">{t("account.booking_created", locale)}</dt>
                    <dd className="text-slate-700">{formatDate(b.createdAt, locale)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          {/* Pagination (§8) */}
          <nav className="flex items-center justify-between gap-3 text-sm" aria-label={t("account.bookings", locale)}>
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
