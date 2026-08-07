import CatalogPage, { CatalogSearchParams } from "@/components/CatalogPage";
import { CATALOGS } from "@/lib/catalog";

export const metadata = { title: "Туры — TravelHub", description: CATALOGS.TOUR.subtitle };

export default async function ToursPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  return <CatalogPage config={CATALOGS.TOUR} searchParams={searchParams} />;
}
