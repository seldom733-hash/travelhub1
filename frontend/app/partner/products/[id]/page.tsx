"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLocale, formatDate, formatPrice } from "@/lib/i18n";
import { pt } from "@/lib/partner-i18n";
import { partnerApi, type PartnerModerationView, type PartnerProductDetail, type PublicationChannel } from "@/lib/partner-api";

function ChannelToggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-pressed={checked}
      className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
      }`}
    >
      <span className="mr-1.5">{checked ? "✓" : "○"}</span>
      {label}
    </button>
  );
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-700",
  COMPLETE: "bg-blue-100 text-blue-700",
  REVIEWED: "bg-indigo-100 text-indigo-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  CHANGED: "bg-orange-100 text-orange-700",
  ARCHIVED: "bg-slate-200 text-slate-500",
};

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const locale = useLocale();

  const [product, setProduct] = useState<PartnerProductDetail | null>(null);
  const [moderation, setModeration] = useState<PartnerModerationView[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  // Step 1.12.2 §8: каналы публикации (отделены от lifecycle).
  const [channels, setChannels] = useState<PublicationChannel[]>(["MARKETPLACE"]);
  const [channelsSaving, setChannelsSaving] = useState(false);
  const [channelsNotice, setChannelsNotice] = useState("");

  const saveChannels = async () => {
    if (!product) return;
    setChannelsSaving(true);
    setChannelsNotice("");
    try {
      await partnerApi.setChannels(product.id, channels);
      setChannelsNotice(pt("storefront.channels_saved", locale));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChannelsSaving(false);
    }
  };

  const toggleChannel = (c: PublicationChannel) => {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  useEffect(() => {
    if (!id) return;
    let alive = true;
    Promise.all([partnerApi.getProduct(id), partnerApi.moderationHistory(id).catch(() => [] as PartnerModerationView[])])
      .then(([p, mod]) => {
        if (!alive) return;
        setProduct(p);
        setModeration(mod);
        setChannels(p.publicationChannels?.length ? p.publicationChannels.map((c) => c.channel) : ["MARKETPLACE"]);
      })
      .catch((err) => {
        if (alive) setError((err as Error).message);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const latestSubmission = useMemo(() => moderation[0] ?? null, [moderation]);
  const activeSubmission = useMemo(() => moderation.find((m) => m.status === "SUBMITTED" || m.status === "IN_REVIEW") ?? null, [moderation]);

  const canSubmit = useMemo(() => {
    if (!product) return false;
    if (activeSubmission) return false;
    if (product.status === "DRAFT") return true;
    if (product.status === "PUBLISHED" && product.draft) return true;
    return false;
  }, [product, activeSubmission]);

  const submitModeration = async () => {
    if (!product) return;
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await partnerApi.submitModeration(product.id);
      setNotice(pt("partner.moderation.submit_ok", locale));
      const [p, mod] = await Promise.all([partnerApi.getProduct(product.id), partnerApi.moderationHistory(product.id).catch(() => [] as PartnerModerationView[])]);
      setProduct(p);
      setModeration(mod);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !product) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-rose-600">{pt("partner.error.not_found", locale)}</p>
        <Link href="/partner/products" className="mt-3 inline-block text-sm text-emerald-600 hover:underline">
          {pt("partner.product.back", locale)}
        </Link>
      </div>
    );
  }
  if (!product) {
    return <div className="py-16 text-center text-sm text-slate-400">{pt("partner.state.loading", locale)}</div>;
  }

  const attrEntries = product.attributes ? Object.entries(product.attributes) : [];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <Link href="/partner/products" className="text-sm text-slate-500 hover:text-emerald-700">
          {pt("partner.product.back", locale)}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">{product.title}</h1>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[product.status] ?? "bg-slate-100 text-slate-600"}`}>
            {pt(`partner.status.${product.status}`, locale)}
          </span>
          {latestSubmission && (
            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {pt(`partner.moderation.${latestSubmission.status}`, locale)}
            </span>
          )}
        </div>
        <div className="mt-1 font-mono text-xs text-slate-400">{product.code}</div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      {product.draft && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="text-sm font-medium text-emerald-800">{pt("partner.product.proposal_n", locale)}</div>
          <div className="mt-0.5 text-xs text-emerald-600">
            {pt("partner.product.live_n", locale)}: v{product.version} · {pt("partner.form.publish_note", locale)}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mb-6 flex flex-wrap gap-2">
        {product.status === "PUBLISHED" && (
          <a
            href={`/products/${product.slug}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            {pt("partner.product.published_link", locale)} ↗
          </a>
        )}
        <Link href={`/partner/products/${product.id}/preview`} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-emerald-300 hover:text-emerald-700">
          {pt("partner.product.preview", locale)}
        </Link>
        <Link href={`/partner/products/${product.id}/edit`} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-emerald-300 hover:text-emerald-700">
          {pt("partner.product.edit", locale)}
        </Link>
        <Link href={`/partner/products/${product.id}/media`} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-emerald-300 hover:text-emerald-700">
          {pt("partner.product.media", locale)}
        </Link>
        <Link href={`/partner/products/${product.id}/moderation`} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-emerald-300 hover:text-emerald-700">
          {pt("partner.product.moderation", locale)}
        </Link>
        {canSubmit && (
          <button
            type="button"
            onClick={submitModeration}
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? pt("partner.moderation.submitting", locale) : pt("partner.product.submit", locale)}
          </button>
        )}
        {activeSubmission && (
          <span className="inline-flex items-center rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
            {pt("partner.moderation.pending", locale)} — {activeSubmission.status}
          </span>
        )}
      </div>

      {/* Key info */}
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-900">{pt("partner.form.basic", locale)}</h2>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-400">{pt("partner.product.category", locale)}</dt>
              <dd className="text-slate-700">{product.category?.title ?? pt("partner.product.no_category", locale)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">{pt("partner.product.price_from", locale)}</dt>
              <dd className="text-slate-700">
                {product.tariffs.length > 0
                  ? formatPrice(product.tariffs[0].price, product.tariffs[0].currency, locale) ?? pt("partner.product.price_on_request", locale)
                  : pt("partner.product.price_on_request", locale)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">{pt("partner.product.updated", locale)}</dt>
              <dd className="text-slate-700">{formatDate(product.updatedAt, locale)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">{pt("partner.moderation.version", locale)}</dt>
              <dd className="text-slate-700">v{product.version}</dd>
            </div>
          </dl>
          {product.description && <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{product.description}</p>}
        </section>

        {attrEntries.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-slate-900">{pt("partner.form.attributes", locale)}</h2>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {attrEntries.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-slate-400">{k}</dt>
                  <dd className="truncate text-slate-700">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Step 1.12.2 §8: Publication channels (Marketplace / Моя витрина) — отдельно от lifecycle. */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-900">{pt("storefront.distribution", locale)}</h2>
          <p className="mb-3 text-xs text-slate-400">{pt("storefront.distribution_hint", locale)}</p>
          <div className="flex flex-wrap gap-3">
            <ChannelToggle
              label={pt("storefront.channel_marketplace", locale)}
              checked={channels.includes("MARKETPLACE")}
              onChange={() => toggleChannel("MARKETPLACE")}
              disabled={product.status !== "PUBLISHED" && channels.length === 1 && channels.includes("MARKETPLACE")}
            />
            <ChannelToggle
              label={pt("storefront.channel_storefront", locale)}
              checked={channels.includes("PARTNER_STOREFRONT")}
              onChange={() => toggleChannel("PARTNER_STOREFRONT")}
            />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={saveChannels}
              disabled={channelsSaving || channels.length === 0}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {channelsSaving ? pt("partner.form.saving", locale) : pt("partner.form.save", locale)}
            </button>
            {channelsNotice && <span className="text-xs text-emerald-700">{channelsNotice}</span>}
            <span className="text-[11px] text-slate-400">{pt("storefront.channels_lifecycle_note", locale)}</span>
          </div>
        </section>

        {product.tariffs.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-slate-900">{pt("partner.form.tariffs", locale)}</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-72 text-left text-sm">
                <thead className="border-b border-slate-100 text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="py-2 pr-3 font-medium">{pt("partner.form.tariff_name", locale)}</th>
                    <th className="py-2 pr-3 font-medium">{pt("partner.form.tariff_price", locale)}</th>
                    <th className="py-2 font-medium">{pt("partner.form.tariff_currency", locale)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {product.tariffs.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2 pr-3 text-slate-700">{t.name}</td>
                      <td className="py-2 pr-3 text-slate-600">{String(t.price)}</td>
                      <td className="py-2 text-slate-400">{t.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {product.media.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-slate-900">{pt("partner.form.media", locale)}</h2>
            <div className="flex flex-wrap gap-2">
              {product.media.map((m) => (
                <img
                  key={m.id}
                  src={`/api/v1/public/media/${m.id}/thumb`}
                  alt={m.altText ?? m.originalFileName}
                  className="size-16 rounded-lg object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          </section>
        )}

        {moderation.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-slate-900">{pt("partner.moderation.history", locale)}</h2>
            {moderation.slice(0, 5).map((m) => (
              <div key={m.id} className="border-l-2 border-slate-200 py-2 pl-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-slate-700">{pt(`partner.moderation.${m.status}`, locale)}</span>
                  <span className="text-xs text-slate-400">{formatDate(m.submittedAt, locale)}</span>
                </div>
                {m.reasonCode && <div className="mt-0.5 text-xs text-slate-500">{pt(`partner.reason.${m.reasonCode}`, locale)}</div>}
                {m.comment && <div className="mt-0.5 text-xs text-slate-500">«{m.comment}»</div>}
              </div>
            ))}
            <Link href={`/partner/products/${product.id}/moderation`} className="mt-3 inline-block text-sm text-emerald-600 hover:underline">
              {pt("partner.moderation.history", locale)} →
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
