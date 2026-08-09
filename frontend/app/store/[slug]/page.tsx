import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StorefrontSite from "@/components/storefront/StorefrontSite";
import { publicStorefrontApi, PublicNotFoundError, type PublicListResult, type PublicStorefront } from "@/lib/public-api";

// Dynamic rendering: public storefront существует только в рантайме (ACTIVE +
// entitled); build не должен пытаться статически предрендерить /store/:slug.
export const dynamic = "force-dynamic";

/**
 * PHASE 1 STEP 1.12.2 §9/§10 — Public Storefront `/store/:slug`.
 * Canonical public route (anonymous). Сервер читает ТОЛЬКО public storefront API
 * (без Authorization), рендерит самостоятельный сайт бизнеса (StorefrontSite).
 * DRAFT/INACTIVE/SUSPENDED/EXPIRED → backend отдаёт нейтральный 404 → notFound().
 * SEO foundation (§19): title/meta description/canonical/OG.
 */

async function fetchStorefront(slug: string): Promise<{ sf: PublicStorefront; products: PublicListResult } | null> {
  try {
    const [sf, products] = await Promise.all([publicStorefrontApi.get(slug), publicStorefrontApi.listProducts(slug, { pageSize: 12 })]);
    return { sf, products };
  } catch (err) {
    if (err instanceof PublicNotFoundError) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchStorefront(slug);
  if (!data) return { title: "Storefront — TravelHub" };
  const { sf } = data;
  const name = sf.businessName ?? sf.slug;
  const description = sf.tagline ?? sf.description?.slice(0, 160) ?? undefined;
  return {
    title: `${name} — ${sf.tagline ?? "Storefront"}`,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: `/store/${sf.slug}` },
    openGraph: {
      title: name,
      description,
      type: "website",
      url: `/store/${sf.slug}`,
      siteName: "TravelHub",
    },
  };
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await fetchStorefront(slug);
  if (!data) notFound();
  return <StorefrontSite sf={data.sf} products={data.products} />;
}
