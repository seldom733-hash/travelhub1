import { Suspense } from "react";
import PartnerProductsList, { type InitialQuery } from "@/components/partner/PartnerProductsList";

/**
 * PHASE 1 STEP 1.8 — My Products (/partner/products).
 * Server-обёртка: читает searchParams (shareable фильтры/сортировка/пагинация)
 * и передаёт в client-компонент. Далее всё — через authenticated Partner API
 * (server-side own-scope; category picker — public категории).
 */
export default async function PartnerProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; categoryId?: string; sort?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const initial: InitialQuery = {
    q: sp.q ?? "",
    filter: sp.filter ?? "",
    categoryId: sp.categoryId ?? "",
    sort: sp.sort ?? "updated_desc",
    page: Math.max(1, Number(sp.page) || 1),
  };
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-slate-400">…</div>}>
      <PartnerProductsList initial={initial} />
    </Suspense>
  );
}
