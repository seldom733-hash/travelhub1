import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StorefrontSite from "@/components/storefront/StorefrontSite";
import StorefrontBlocks from "@/components/storefront/StorefrontBlocks";
import { publicStorefrontApi, PublicNotFoundError, type PublicListResult, type PublicStorefront } from "@/lib/public-api";
import type { PageConfigView } from "@/lib/constructor-api";

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

async function fetchStorefront(slug: string): Promise<{ sf: PublicStorefront; products: PublicListResult; page: PageConfigView | null; menu: Array<{ slug: string; name: string; isHome: boolean }> } | null> {
  try {
    const [sf, products, page, menu] = await Promise.all([
      publicStorefrontApi.get(slug),
      publicStorefrontApi.listProducts(slug, { pageSize: 12 }),
      // Backward compatible: an older backend without the builder endpoint
      // must not break the legacy storefront.
      publicStorefrontApi.getPage(slug).catch(() => null),
      publicStorefrontApi.listPages(slug).catch(() => []),
    ]);
    return { sf, products, page, menu };
  } catch (err) {
    if (err instanceof PublicNotFoundError) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchStorefront(slug);
  if (!data) return { title: "Storefront — TravelHub" };
  const { sf, page } = data;
  const seoTitle = page?.seo?.title;
  const seoDescription = page?.seo?.description;
  const pick = (v: unknown): string | undefined => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object") {
      const rec = v as Record<string, unknown>;
      return typeof rec.ru === "string" ? rec.ru : typeof rec.az === "string" ? rec.az : typeof rec.en === "string" ? rec.en : undefined;
    }
    return undefined;
  };
  const name = sf.businessName ?? sf.slug;
  const title = pick(seoTitle) || `${name} — ${sf.tagline ?? "Storefront"}`;
  const description = pick(seoDescription) || sf.tagline || sf.description?.slice(0, 160) || undefined;
  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: `/store/${sf.slug}` },
    openGraph: {
      title,
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
  const { sf, products, page, menu } = data;
  // Published constructor page is the new path; legacy fixed template remains
  // the fallback for partners that have not opened the builder yet.
  if (page && page.sections.some((s) => s.enabled)) {
    return <StorefrontBlocks sf={sf} products={products} page={page} menu={menu} />;
  }
  return <StorefrontSite sf={sf} products={products} />;
}
