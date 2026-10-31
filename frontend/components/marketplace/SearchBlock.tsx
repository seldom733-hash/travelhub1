"use client";

import { t, useLocale } from "@/lib/i18n";
import { resolveSearchServices } from "@/lib/search-services";
import HeroSearch from "./HeroSearch";

/** Published search configuration shape (Constructor → searchConfig). */
export interface SearchBlockConfig {
  services?: { id: string; labelKey: string; enabled: boolean }[];
  defaultService?: string;
}

export default function SearchBlock({ config }: { config?: SearchBlockConfig | null }) {
  const locale = useLocale();

  // Единственный источник истины — опубликованный searchConfig страницы
  // marketplace-home (workspace → page-builder → вкладка «Поиск»). Если конфига
  // ещё нет, включаются только услуги с реальными поставщиками
  // (tours/hotels/flights) — остальные выключены. См. lib/search-services.ts.
  const { enabled, defaultService } = resolveSearchServices(config ?? null);

  return (
    <section className="relative z-20 -mt-10 bg-dark pb-2 sm:-mt-14">
      <div className="th-container">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-3 px-1 font-display text-lg font-semibold text-white sm:text-xl">
            {t("search.block_title", locale)}
          </h2>
          <HeroSearch enabledServices={enabled} defaultService={defaultService} />
        </div>
      </div>
    </section>
  );
}
