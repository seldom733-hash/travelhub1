import CatalogPage, { CatalogSearchParams } from "@/components/CatalogPage";
import { CATALOGS } from "@/lib/catalog";

export const metadata = { title: "Санатории — TravelHub", description: CATALOGS.SANATORIUM.subtitle };

export default async function SanatoriumsPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  return <CatalogPage config={CATALOGS.SANATORIUM} searchParams={searchParams} />;
}
