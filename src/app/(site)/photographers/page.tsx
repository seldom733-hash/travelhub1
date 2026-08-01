import CatalogPage, { CatalogSearchParams } from "@/components/CatalogPage";
import { CATALOGS } from "@/lib/catalog";

export const metadata = { title: "Фотографы — TravelHub", description: CATALOGS.PHOTOGRAPHER.subtitle };

export default async function PhotographersPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  return <CatalogPage config={CATALOGS.PHOTOGRAPHER} searchParams={searchParams} />;
}
