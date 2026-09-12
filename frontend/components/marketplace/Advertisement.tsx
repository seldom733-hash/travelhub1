"use client";

import { useLocale } from "@/lib/i18n";
import { Globe } from "@phosphor-icons/react";

export default function Advertisement() {
  const locale = useLocale();

  return (
    <section className="bg-dark py-16 sm:py-20">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="relative overflow-hidden rounded-2xl border border-dark-border bg-dark-card/50">
          {/* Decorative gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/5" />

          <div className="relative flex flex-col items-center px-6 py-14 text-center sm:py-20">
            <div className="mb-5 flex size-12 items-center justify-center rounded-full border border-gold/20 bg-gold/5">
              <Globe size={24} weight="light" className="text-gold/60" />
            </div>
            <p className="max-w-md text-sm leading-relaxed text-neutral-400">
              {locale === "ru"
                ? "Здесь может быть ваша реклама"
                : locale === "az"
                  ? "Burada sizin reklamınız ola bilər"
                  : "Your advertisement could be here"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
