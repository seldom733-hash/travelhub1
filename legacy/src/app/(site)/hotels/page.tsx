import CatalogPage, { CatalogSearchParams } from "@/components/CatalogPage";
import { CATALOGS } from "@/lib/catalog";

export const metadata = { title: "Отели — TravelHub", description: CATALOGS.HOTEL.subtitle };

export default async function HotelsPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  return <CatalogPage config={CATALOGS.HOTEL} searchParams={searchParams} />;
}
