import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StorefrontBlocks from "@/components/storefront/StorefrontBlocks";
import { publicStorefrontApi, PublicNotFoundError, type PublicListResult, type PublicStorefront } from "@/lib/public-api";
import type { PageConfigView } from "@/lib/constructor-api";

export const dynamic = "force-dynamic";

async function fetchPage(slug: string, pageSlug: string): Promise<{ sf: PublicStorefront; products: PublicListResult; page: PageConfigView | null; menu: Array<{ slug: string; name: string; isHome: boolean }> } | null> {
  try {
    const [sf, products, page, menu] = await Promise.all([
      publicStorefrontApi.get(slug),
      publicStorefrontApi.listProducts(slug, { pageSize: 12 }),
      publicStorefrontApi.getPage(slug, pageSlug).catch(() => null),
      publicStorefrontApi.listPages(slug).catch(() => []),
    ]);
    return { sf, products, page, menu };
  } catch (err) {
    if (err instanceof PublicNotFoundError) return null;
    throw err;
  }
}

function seoText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    return typeof rec.ru === "string" ? rec.ru : typeof rec.az === "string" ? rec.az : typeof rec.en === "string" ? rec.en : undefined;
  }
  return undefined;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; pageSlug: string }> }): Promise<Metadata> {
  const { slug, pageSlug } = await params;
  const data = await fetchPage(slug, pageSlug);
  if (!data || !data.page) return { title: "Storefront — TravelHub" };
  const title = seoText(data.page.seo?.title) ?? `${data.sf.businessName ?? data.sf.slug} — ${pageSlug}`;
  const description = seoText(data.page.seo?.description) ?? data.sf.tagline ?? undefined;
  return { title, description, alternates: { canonical: `/store/${slug}/${pageSlug}` } };
}

export default async function StorefrontSubpage({ params }: { params: Promise<{ slug: string; pageSlug: string }> }) {
  const { slug, pageSlug } = await params;
  const data = await fetchPage(slug, pageSlug);
  if (!data || !data.page || !data.page.sections.some((s) => s.enabled)) notFound();
  return <StorefrontBlocks sf={data.sf} products={data.products} page={data.page} menu={data.menu} />;
}
