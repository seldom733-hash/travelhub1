import PublicLayout from "@/components/PublicLayout";
import SearchResults from "@/components/public/SearchResults";

/**
 * PHASE 1 STEP 1.7 §9 — Search Results `/search`.
 *
 * Server-обёртка: страница читает `searchParams` (→ роут всегда dynamic, ƒ).
 * Это критично: на статически пререндеренном /search Next 16.2 игнорирует
 * client-side router.replace с новыми search-параметрами (sort/f[days] терялись).
 * Парсинг f[key]=value — здесь (server), URL остаётся единственным источником
 * состояния (shareable). Данные — ТОЛЬКО Public Catalog API (§21).
 */
export const dynamic = "force-dynamic";

type RawParams = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = await searchParams;

  const filters: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const m = /^f\[(.+)\]$/.exec(k);
    if (m && typeof v === "string" && v) filters[m[1]] = v;
  }

  return (
    <PublicLayout>
      <SearchResults
        q={str(sp.q)}
        category={str(sp.category)}
        sort={str(sp.sort) || "newest"}
        page={Math.max(1, Number(str(sp.page)) || 1)}
        availableFrom={str(sp.available_from)}
        initialFilters={filters}
      />
    </PublicLayout>
  );
}
