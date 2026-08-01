import CatalogPage, { CatalogSearchParams } from "@/components/CatalogPage";
import { CATALOGS } from "@/lib/catalog";

export const metadata = { title: "Трансферы — TravelHub", description: CATALOGS.TRANSFER.subtitle };

export default async function TransfersPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  return <CatalogPage config={CATALOGS.TRANSFER} searchParams={searchParams} />;
}
