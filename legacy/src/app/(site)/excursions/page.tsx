import CatalogPage, { CatalogSearchParams } from "@/components/CatalogPage";
import { CATALOGS } from "@/lib/catalog";

export const metadata = { title: "Экскурсии — TravelHub", description: CATALOGS.EXCURSION.subtitle };

export default async function ExcursionsPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  return <CatalogPage config={CATALOGS.EXCURSION} searchParams={searchParams} />;
}
