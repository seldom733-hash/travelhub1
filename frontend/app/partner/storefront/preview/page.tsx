"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StorefrontSite from "@/components/storefront/StorefrontSite";
import { pt } from "@/lib/partner-i18n";
import { useLocale } from "@/lib/i18n";
import { storefrontApi, type StorefrontView } from "@/lib/storefront-api";
import { partnerApi, type PartnerProductListItem } from "@/lib/partner-api";
import type { PublicListResult, PublicProductCard } from "@/lib/public-api";

/**
 * PHASE 1 STEP 1.12.2 §13 — Preview (owner-only, own-scope).
 * - не делает витрину публичной (anonymous /store/:slug остаётся 404 для
 *   DRAFT/INACTIVE — публичный контур не задействован);
 * - noindex (robots) — приватная витрина не индексируется;
 * - staged branding media — owner-only (signed preview URLs);
 * - показывает то, что появится на публичном сайте (ACTIVE+entitled).
 */
export default function StorefrontPreviewPage() {
  const locale = useLocale();
  const router = useRouter();
  const [sf, setSf] = useState<StorefrontView | null>(null);
  const [products, setProducts] = useState<PublicListResult | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const view = await storefrontApi.getOwn();
        if (!alive) return;
        setSf(view);

        // Staged media owner-only: signed preview URLs.
        const overrides: Record<string, string> = {};
        for (const m of view.media) {
          try {
            const { url } = await storefrontApi.previewMedia(m.id);
            overrides[m.id] = url;
          } catch {
            /* best-effort */
          }
        }
        if (alive) setMediaUrls(overrides);

        // Own published products (показать то, что появится на сайте).
        const list = await partnerApi.listProducts({ filter: "published", pageSize: 50 });
        if (!alive) return;
        setProducts({
          items: list.items.map(toCard),
          total: list.total,
          page: 1,
          pageSize: 50,
        });
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // noindex для приватного preview (SEO §19).
    if (typeof document !== "undefined") {
      const meta = document.createElement("meta");
      meta.name = "robots";
      meta.content = "noindex, nofollow";
      document.head.appendChild(meta);
      return () => {
        document.head.removeChild(meta);
      };
    }
  }, []);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-rose-600">{error}</p>
        <button onClick={() => router.push("/partner/storefront")} className="mt-3 text-sm text-emerald-600 hover:underline">
          ← {pt("storefront.back_management", locale)}
        </button>
      </div>
    );
  }

  if (!sf) {
    return <div className="py-16 text-center text-sm text-slate-400">{pt("partner.state.loading", locale)}</div>;
  }

  return (
    <div className="bg-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-3 text-center text-xs text-slate-500">
        {pt("storefront.preview_top_bar", locale)}{" "}
        <button onClick={() => router.push("/partner/storefront")} className="ml-2 text-emerald-600 hover:underline">
          ← {pt("storefront.back_management", locale)}
        </button>
      </div>
      <StorefrontSite
        sf={{
          id: sf.id,
          code: sf.code,
          slug: sf.slug,
          businessName: sf.businessName,
          tagline: sf.tagline,
          description: sf.description,
          defaultLocale: sf.defaultLocale,
          countryCode: sf.countryCode,
          cityCode: sf.cityCode,
          publicPhone: sf.publicPhone,
          publicEmail: sf.publicEmail,
          websiteUrl: sf.websiteUrl,
          whatsapp: sf.whatsapp,
          socialLinks: sf.socialLinks,
          heroHeading: sf.heroHeading,
          heroSubheading: sf.heroSubheading,
          themePreset: sf.themePreset,
          media: sf.media.map((m) => ({ id: m.id, kind: m.kind, url: "" })),
          seller: null,
          activatedAt: sf.activatedAt ?? new Date().toISOString(),
        }}
        products={products}
        preview
        mediaUrlOverrides={mediaUrls}
      />
    </div>
  );
}

/** Маппинг partner list item → публичная карточка (для предпросмотра сайта). */
function toCard(p: PartnerProductListItem): PublicProductCard {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    shortDescription: p.description ? (p.description.length > 180 ? p.description.slice(0, 179).trimEnd() + "…" : p.description) : null,
    type: p.type,
    category: p.category ? { id: p.category.id, slug: p.category.slug, title: p.category.title } : null,
    primaryImage: p.thumbnail ? { id: p.thumbnail.id, thumbUrl: `/api/v1/public/media/${p.thumbnail.id}/thumb`, largeUrl: `/api/v1/public/media/${p.thumbnail.id}/large` } : null,
    priceFrom: p.priceFrom,
    currency: p.currency,
    pricingUnit: "unit",
    availabilitySummary: null,
    seller: null,
    publishedAt: p.publishedAt ?? new Date().toISOString(),
  };
}
