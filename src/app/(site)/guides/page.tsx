import CatalogPage, { CatalogSearchParams } from "@/components/CatalogPage";
import { CATALOGS } from "@/lib/catalog";

export const metadata = { title: "Гиды — TravelHub", description: CATALOGS.GUIDE.subtitle };

export default async function GuidesPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  return <CatalogPage config={CATALOGS.GUIDE} searchParams={searchParams} />;
}
