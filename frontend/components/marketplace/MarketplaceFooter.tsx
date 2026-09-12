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

export default function MarketplaceFooter() {
  const locale = useLocale();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-dark-border bg-dark" role="contentinfo">
      <div className="mx-auto max-w-[1400px] px-6 pt-16 pb-8">
        {/* Main grid */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2" aria-label="TravelHub">
              <Buildings className="h-7 w-7 text-gold" weight="fill" />
              <span className="font-display text-xl font-semibold tracking-tight">
                <span className="text-white">Travel</span>
                <span className="text-gold">Hub</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-neutral-500">
              {t("footer.brand_description", locale)}
            </p>
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
              <li>
                <a
                  href="tel:+994123456789"
                  className="inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-white"
                >
                  <PaperPlaneRight className="h-4 w-4 text-gold" />
                  +994 12 345 67 89
                </a>
              </li>
              <li>
                <a
                  href="mailto:info@travelhub.az"
                  className="inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-white"
                >
                  <PaperPlaneRight className="h-4 w-4 text-gold" />
                  info@travelhub.az
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-12 border-t border-dark-border pt-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-xs text-neutral-600">
              © {year} TravelHub. {t("footer.rights_reserved", locale)}
            </p>
            <p className="text-xs text-neutral-600">
              {t("footer.baku_azerbaijan", locale)}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
