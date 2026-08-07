import CatalogPage, { CatalogSearchParams } from "@/components/CatalogPage";
import { CATALOGS } from "@/lib/catalog";

export const metadata = { title: "Авиабилеты — TravelHub", description: CATALOGS.FLIGHT.subtitle };

export default async function FlightsPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  return <CatalogPage config={CATALOGS.FLIGHT} searchParams={searchParams} />;
}
