import CatalogPage, { CatalogSearchParams } from "@/components/CatalogPage";
import { CATALOGS } from "@/lib/catalog";

export const metadata = { title: "Ж/д билеты — TravelHub", description: CATALOGS.TRAIN.subtitle };

export default async function TrainsPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  return <CatalogPage config={CATALOGS.TRAIN} searchParams={searchParams} />;
}
