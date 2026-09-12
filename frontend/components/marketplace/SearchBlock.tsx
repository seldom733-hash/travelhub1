"use client";

import { t, useLocale } from "@/lib/i18n";
import HeroSearch from "./HeroSearch";

export default function SearchBlock() {
  const locale = useLocale();

  return (
    <section className="relative z-20 -mt-8 bg-dark sm:-mt-10">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center font-serif text-xl font-semibold text-white sm:text-2xl">
            {t("search.block_title", locale)}
          </h2>
          <HeroSearch />
        </div>
      </div>
    </section>
  );
}
