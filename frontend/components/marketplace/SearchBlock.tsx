"use client";

import { t, useLocale } from "@/lib/i18n";
import HeroSearch from "./HeroSearch";

/** Published search configuration shape (Constructor → searchConfig). */
export interface SearchBlockConfig {
  services?: { id: string; labelKey: string; enabled: boolean }[];
  defaultService?: string;
}

export default function SearchBlock({ config }: { config?: SearchBlockConfig | null }) {
  const locale = useLocale();

  const enabledServices = config?.services?.filter((s) => s.enabled).map((s) => s.id) ?? null;
  const defaultService = config?.defaultService;

  return (
    <section className="relative z-20 -mt-8 bg-dark sm:-mt-10">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center font-serif text-xl font-semibold text-white sm:text-2xl">
            {t("search.block_title", locale)}
          </h2>
          <HeroSearch enabledServices={enabledServices ?? undefined} defaultService={defaultService} />
        </div>
      </div>
    </section>
  );
}
