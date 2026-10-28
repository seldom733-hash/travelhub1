"use client";

import { useEffect, useState } from "react";
import MarketplaceRenderer from "@/components/marketplace/MarketplaceRenderer";
import { constructorApi, type PageConfigView } from "@/lib/constructor-api";

/**
 * Draft preview for the marketplace builder. Uses the same published renderer
 * but receives the draft PageConfigView explicitly (no cache, no public URL).
 */
export default function MarketplaceBuilderPreviewPage() {
  const [page, setPage] = useState<PageConfigView | null | undefined>(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    constructorApi
      .getPreview("marketplace-home")
      .then((value) => { if (alive) setPage(value); })
      .catch((e) => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, []);

  if (error) return <div className="p-8 text-sm text-rose-600">{error}</div>;
  if (page === undefined) return <div className="p-8 text-sm text-slate-400">Загрузка предпросмотра…</div>;
  if (!page) return <div className="p-8 text-sm text-slate-400">Черновик не найден.</div>;
  return <MarketplaceRenderer pageOverride={page} />;
}
