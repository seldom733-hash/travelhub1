"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  publicApi,
  type PublicComparableTours,
  type PublicHotelOffers,
  type PublicOfferSummary,
} from "@/lib/public-api";
import { formatPrice, t, useLocale } from "@/lib/i18n";

/**
 * Единый каталог: минимальная цена + код партнёра здорового предложения на
 * общей карточке отеля/тура и раскрывающийся список «Другие предложения».
 * Сводка приходит вместе с PDP; полный список подгружается только по запросу.
 */
interface Props {
  summary: PublicOfferSummary;
  product: { id: string; type: string };
}

type OfferRow = {
  key: string;
  code: string;
  title: string;
  price: number | null;
  currency: string;
  partnerLabel: string | null;
};

export default function BestOfferPanel({ summary, product }: Props) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<OfferRow[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (product.type === "HOTEL" && summary.hotelId) {
        const data: PublicHotelOffers = await publicApi.getHotelOffers(summary.hotelId);
        setRows(
          data.offers.map((o) => ({
            key: `${o.supplierCode}-${o.externalKey}-${o.productId}`,
            code: o.productCode,
            title: o.productName,
            price: o.price,
            currency: o.currency,
            partnerLabel: o.comparable ? o.supplierCode : null,
          })),
        );
      } else {
        const data: PublicComparableTours = await publicApi.getComparableTours(product.id);
        setRows(
          data.comparable.map((o) => ({
            key: o.id,
            code: o.code,
            title: o.title,
            price: o.price,
            currency: o.currency,
            partnerLabel: o.comparable ? o.partnerCode : null,
          })),
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [product.id, product.type, summary.hotelId]);

  const toggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    if (next && rows === null && !loading) void load();
  }, [open, rows, loading, load]);

  const best = formatPrice(summary.minPrice, summary.minPriceCurrency, locale);

  return (
    <section className="mt-6 rounded-xl border border-line bg-white p-4" aria-labelledby="best-offer-title">
      <h2 id="best-offer-title" className="text-sm font-semibold text-ink">
        {t("offers.title", locale)}
      </h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-panel px-3 py-2">
          <div className="text-xs text-ink/60">{t("offers.best_price", locale)}</div>
          <div className="mt-0.5 font-semibold text-ink">
            {best ?? t("offers.no_min", locale)}
          </div>
        </div>
        <div className="rounded-lg bg-panel px-3 py-2">
          <div className="text-xs text-ink/60">{t("offers.partner", locale)}</div>
          <div className="mt-0.5 font-mono text-sm text-brand">
            {summary.minPartnerCode ?? "—"}
          </div>
        </div>
        <div className="rounded-lg bg-panel px-3 py-2">
          <div className="text-xs text-ink/60">{t("offers.count", locale)}</div>
          <div className="mt-0.5 font-semibold text-ink">{summary.offersCount}</div>
        </div>
      </div>

      {summary.minPrice !== null && (
        <p className="mt-2 text-xs text-ink/50">{t("offers.compare_note", locale)}</p>
      )}

      {summary.hasAlternatives && (
        <>
          <button
            type="button"
            onClick={toggle}
            disabled={loading}
            className="mt-3 rounded-lg border border-brand/30 bg-brand/5 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/10 disabled:opacity-50"
            aria-expanded={open}
          >
            {loading ? "…" : open ? t("offers.collapse", locale) : t("offers.expand", locale)}
          </button>

          {open && (
            <div className="mt-3 space-y-2">
              {error && <div className="text-xs text-red-500">{error}</div>}
              {rows !== null && rows.length === 0 && (
                <div className="text-xs text-ink/60">{t("offers.empty", locale)}</div>
              )}
              {rows?.map((row) => (
                <div
                  key={row.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <Link href={`/products/${encodeURIComponent(row.code)}`} className="font-medium text-brand hover:underline">
                      {row.title}
                    </Link>
                    <div className="font-mono text-ink/50">{row.code}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-ink">
                      {formatPrice(row.price, row.currency, locale) ?? "—"}
                    </div>
                    {row.partnerLabel && <div className="font-mono text-ink/50">{row.partnerLabel}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
