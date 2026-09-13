"use client";

import Link from "next/link";
import { t, useLocale } from "@/lib/i18n";
import { Buildings, PaperPlaneRight } from "@phosphor-icons/react";

const FOOTER_SERVICES = [
  { href: "/search?category=accommodation", labelKey: "footer.service_accommodation" },
  { href: "/search?category=tours", labelKey: "footer.service_tours" },
  { href: "/search?category=excursions", labelKey: "footer.service_excursions" },
  { href: "/search?category=transfers", labelKey: "footer.service_transfers" },
] as const;

const FOOTER_NAV = [
  { href: "/search?category=destinations", labelKey: "footer.nav_destinations" },
  { href: "/search?sort=popular", labelKey: "footer.nav_offers" },
  { href: "/become-a-partner", labelKey: "footer.nav_partners" },
] as const;

const FOOTER_AUTH = [
  { href: "/login", labelKey: "footer.auth_login" },
  { href: "/register", labelKey: "footer.auth_register" },
] as const;

/** Published footer configuration shape (Constructor → footerConfig). */
export interface MarketplaceFooterConfig {
  name?: Record<string, string>;
  description?: Record<string, string>;
  phone?: string;
  email?: string;
  copyright?: Record<string, string>;
}

const DEFAULT_FOOTER_CONFIG: MarketplaceFooterConfig = {
  phone: "+994 12 345 67 89",
  email: "info@travelhub.az",
};

export default function MarketplaceFooter({ config }: { config?: MarketplaceFooterConfig | null }) {
  const locale = useLocale();
  const year = new Date().getFullYear();

  const cfg = { ...DEFAULT_FOOTER_CONFIG, ...(config ?? {}) };
  const brandName = (cfg.name?.[locale] || cfg.name?.ru || "TravelHub").trim();
  const description = (cfg.description?.[locale] || cfg.description?.ru || t("footer.brand_description", locale)).trim();
  const copyright = (cfg.copyright?.[locale] || cfg.copyright?.ru || `© ${year} TravelHub. ${t("footer.rights_reserved", locale)}`).trim();

  return (
    <footer className="border-t border-dark-border bg-dark" role="contentinfo">
      <div className="mx-auto max-w-[1400px] px-6 pt-16 pb-8">
        {/* Main grid */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2" aria-label={brandName || "TravelHub"}>
              <Buildings className="h-7 w-7 text-gold" weight="fill" />
              <span className="font-display text-xl font-semibold tracking-tight">{brandName || "TravelHub"}</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-neutral-500">{description}</p>
          </div>

          {/* Services */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">
              {t("footer.heading_services", locale)}
            </h3>
            <ul className="space-y-3">
              {FOOTER_SERVICES.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-neutral-500 transition-colors hover:text-white"
                  >
                    {t(item.labelKey, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">
              {t("footer.heading_navigation", locale)}
            </h3>
            <ul className="space-y-3">
              {FOOTER_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-neutral-500 transition-colors hover:text-white"
                  >
                    {t(item.labelKey, locale)}
                  </Link>
                </li>
              ))}
              {FOOTER_AUTH.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-neutral-500 transition-colors hover:text-white"
                  >
                    {t(item.labelKey, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">
              {t("footer.heading_contact", locale)}
            </h3>
            <ul className="space-y-3">
              {cfg.phone && (
                <li>
                  <a
                    href={`tel:${cfg.phone.replace(/\s+/g, "")}`}
                    className="inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-white"
                  >
                    <PaperPlaneRight className="h-4 w-4 text-gold" />
                    {cfg.phone}
                  </a>
                </li>
              )}
              {cfg.email && (
                <li>
                  <a
                    href={`mailto:${cfg.email}`}
                    className="inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-white"
                  >
                    <PaperPlaneRight className="h-4 w-4 text-gold" />
                    {cfg.email}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-12 border-t border-dark-border pt-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-xs text-neutral-600">{copyright}</p>
            <p className="text-xs text-neutral-600">
              {t("footer.baku_azerbaijan", locale)}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
