import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StorefrontPdp from "@/components/storefront/StorefrontPdp";
import { PublicNotFoundError, publicStorefrontApi, type PublicProductDetail, type PublicStorefront } from "@/lib/public-api";

// Dynamic rendering: Storefront PDP существует только в рантайме (ACTIVE +
// entitled витрина + PUBLISHED PARTNER_STOREFRONT Product); build не должен
// статически предрендерить /store/:slug/products/:productSlug.
export const dynamic = "force-dynamic";

/**
 * PHASE 1 STEP 1.12.2 §9/§11 — Public Storefront PDP `/store/:slug/products/:productSlug`.
 * Server-компонент: читает ТОЛЬКО public storefront API (без Authorization),
 * готовит SEO metadata (§19), отдаёт client-рендеру канонические данные Product.
 * Чужой/DRAFT/ARCHIVED продукт или непубличная витрина → backend neutral 404 →
 * notFound() (search engines не индексируют непубличное).
 */
async function fetchPdp(
  slug: string,
  productSlug: string,
): Promise<{ sf: PublicStorefront; detail: PublicProductDetail } | null> {
  try {
    const [sf, detail] = await Promise.all([
      publicStorefrontApi.get(slug),
      publicStorefrontApi.getProduct(slug, productSlug),
    ]);
    return { sf, detail };
  } catch (err) {
    if (err instanceof PublicNotFoundError) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; productSlug: string }> }): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const data = await fetchPdp(slug, productSlug);
  if (!data) return { title: "Storefront — TravelHub" };
  const { sf, detail } = data;
  const name = sf.businessName ?? sf.slug;
  const description = detail.product.description?.slice(0, 160) ?? sf.tagline ?? undefined;
  const canonical = `/store/${sf.slug}/products/${detail.product.slug}`;
  return {
    title: `${detail.product.title} — ${name}`,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical },
    openGraph: {
      title: `${detail.product.title} — ${name}`,
      description,
      type: "website",
      url: canonical,
      siteName: "TravelHub",
    },
  };
}

export default async function StorefrontProductPage({ params }: { params: Promise<{ slug: string; productSlug: string }> }) {
  const { slug, productSlug } = await params;
  const data = await fetchPdp(slug, productSlug);
  if (!data) notFound();
  return <StorefrontPdp sf={data.sf} detail={data.detail} />;
}
