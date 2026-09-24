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

  const configuredServices =
    config?.services?.filter((s) => s.enabled).map((s) => s.id) ?? null;

  // Flights are supplied by the flight supplier layer, not by published
  // marketplace products. Therefore the absence of a "flights" entry in the
  // published searchConfig must not hide the flight search UI.
  // If flights are explicitly configured, respect that configuration
  // (including an explicit disabled state).
  const hasExplicitFlightConfig =
    config?.services?.some((service) => service.id === "flights") ?? false;

  const enabledServices =
    configuredServices && !hasExplicitFlightConfig
      ? [...configuredServices, "flights"]
      : configuredServices;

  const defaultService = config?.defaultService;

  return (
    <section className="relative z-20 -mt-8 bg-dark sm:-mt-10">
      <div className="th-container">
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
