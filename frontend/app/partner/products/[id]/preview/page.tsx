"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale, formatDate, formatPrice } from "@/lib/i18n";
import { pt } from "@/lib/partner-i18n";
import { partnerApi, type PartnerProductDetail } from "@/lib/partner-api";

/**
 * PHASE 1 STEP 1.8 §15 — Authenticated draft/change-proposal preview.
 * Рендерит данные СВОЕГО продукта (read_own) как мини-PDP. DRAFT media — через
 * authenticated signed preview; PUBLISHED media — через stable public URL.
 * Этот контент НЕ публичен: public /products/:slug показывает только одобренную
 * опубликованную версию (backend) — предпросмотр не дублирует public API.
 */
export default function ProductPreviewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const locale = useLocale();

  const [product, setProduct] = useState<PartnerProductDetail | null>(null);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let alive = true;
    partnerApi
      .getProduct(id)
      .then((p) => {
        if (!alive) return;
        setProduct(p);
        // Signed preview для DRAFT media (не public).
        for (const m of p.media) {
          if (m.status !== "PUBLISHED") {
            partnerApi
              .previewUrl(id, m.id, "large")
              .then((s) => {
                if (alive) setSigned((prev) => ({ ...prev, [m.id]: s.url }));
              })
              .catch(() => undefined);
          }
        }
      })
      .catch((err) => {
        if (alive) setError((err as Error).message);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (error && !product) {
    return <div className="py-16 text-center text-sm text-rose-600">{pt("partner.error.not_found", locale)}</div>;
  }
  if (!product) {
    return <div className="py-16 text-center text-sm text-slate-400">{pt("partner.state.loading", locale)}</div>;
  }

  const attrEntries = product.attributes ? Object.entries(product.attributes) : [];
  const isPublic = product.status === "PUBLISHED";
  const previewTitle = product.draft?.title ?? product.title;
  const previewDescription = product.draft?.description !== undefined ? product.draft.description : product.description;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/partner/products/${product.id}`} className="text-sm text-slate-500 hover:text-emerald-700">
          {pt("partner.preview.back", locale)}
        </Link>
        {isPublic && (
          <a href={`/products/${product.slug}`} target="_blank" rel="noreferrer" className="text-sm text-slate-500 hover:text-emerald-700">
            {pt("partner.preview.open_public", locale)} ↗
          </a>
        )}
      </div>

      <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
        <div className="text-sm font-semibold text-amber-800">{pt("partner.preview.draft_banner", locale)}</div>
        <div className="mt-0.5 text-xs text-amber-700">{pt("partner.preview.public_hint", locale)}</div>
      </div>

      {/* ── Мини-PDP из собственных данных ── */}
      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {product.media.length > 0 ? (
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 sm:grid-cols-4">
            {product.media.map((m) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={m.id}
                src={m.status === "PUBLISHED" ? `/api/v1/public/media/${m.id}/large` : (signed[m.id] ?? undefined)}
                alt={m.altText ?? m.originalFileName}
                className={`h-36 w-full rounded-xl object-cover ${m.isPrimary ? "ring-2 ring-emerald-500" : ""}`}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center bg-slate-50 text-sm text-slate-300">—</div>
        )}

        <div className="p-6">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-mono">{product.code}</span>
            {product.category && <span>· {product.category.title}</span>}
            <span>· {pt(`partner.status.${product.status}`, locale)}</span>
            {product.draft && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">{pt("partner.product.proposal_n", locale)}</span>}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{previewTitle}</h1>
          {previewDescription && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">{previewDescription}</p>}

          {attrEntries.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">{pt("pdp.attributes_title", locale)}</h2>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {attrEntries.map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-wide text-slate-400">{k}</dt>
                    <dd className="text-slate-700">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">{pt("pdp.tariffs_title", locale)}</div>
              {product.tariffs.length > 0 ? (
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {formatPrice(product.tariffs[0].price, product.tariffs[0].currency, locale) ?? pt("partner.product.price_on_request", locale)}
                </div>
              ) : (
                <div className="mt-1 text-sm text-slate-400">{pt("partner.product.price_on_request", locale)}</div>
              )}
            </div>
            <div className="text-right text-xs text-slate-400">
              <div>{pt("partner.product.updated", locale)}: {formatDate(product.updatedAt, locale)}</div>
              {product.publishedAt && <div>{pt("pdp.published_on", locale)}: {formatDate(product.publishedAt, locale)}</div>}
            </div>
          </div>

          {!isPublic && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              {pt("partner.preview.no_public", locale)} — {pt("partner.preview.public_hint", locale)}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
