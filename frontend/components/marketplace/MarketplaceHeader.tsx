"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  List,
  Heart,
  Bell,
  ShoppingCart,
  User,
  Phone,
  EnvelopeSimple,
  MapPin,
  MagnifyingGlass,
  X,
  Globe,
  CaretDown,
  HouseSimple,
  Compass,
  Van,
  Star,
  Sun,
  ForkKnife,
} from "@phosphor-icons/react";
import { t, useLocale, useSetLocale, LOCALES } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-user";
import { isInternalRole } from "@/lib/routes";

interface ServiceItem {
  icon: React.ReactNode;
  labelKey: string;
  href: string;
}

const SERVICES: ServiceItem[] = [
  { icon: <HouseSimple size={18} weight="light" />, labelKey: "marketplace.category_accommodation", href: "/search?category=accommodation" },
  { icon: <MapPin size={18} weight="light" />, labelKey: "marketplace.category_tours", href: "/search?category=tours" },
  { icon: <Compass size={18} weight="light" />, labelKey: "marketplace.category_excursions", href: "/search?category=excursions" },
  { icon: <Van size={18} weight="light" />, labelKey: "marketplace.category_transfers", href: "/search?category=transfers" },
  { icon: <Star size={18} weight="light" />, labelKey: "marketplace.category_experiences", href: "/search?category=experiences" },
  { icon: <Sun size={18} weight="light" />, labelKey: "marketplace.category_wellness", href: "/search?category=wellness" },
  { icon: <ForkKnife size={18} weight="light" />, labelKey: "marketplace.category_gastronomy", href: "/search?category=gastronomy" },
];

export default function MarketplaceHeader() {
  const user = useCurrentUser();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [servicesOpen, setServicesOpen] = useState(false);
  const servicesRef = useRef<HTMLDivElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  // Close services dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (servicesRef.current && !servicesRef.current.contains(e.target as Node)) {
        setServicesOpen(false);
      }
    };
    if (servicesOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [servicesOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setServicesOpen(false);
    };
    if (servicesOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [servicesOpen]);

  return (
    <header className="sticky top-0 z-50">
      {/* Top utility bar */}
      <div className="border-b border-dark-border/60 bg-dark/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-1.5 text-xs text-neutral-500">
          <div className="hidden items-center gap-5 md:flex">
            <a href="tel:+994123456789" className="flex items-center gap-1.5 transition-colors hover:text-neutral-300">
              <Phone size={12} weight="light" />
              <span>+994 12 345 67 89</span>
            </a>
            <a href="mailto:info@travelhub.az" className="flex items-center gap-1.5 transition-colors hover:text-neutral-300">
              <EnvelopeSimple size={12} weight="light" />
              <span>info@travelhub.az</span>
            </a>
            <span className="hidden items-center gap-1.5 lg:flex">
              <MapPin size={12} weight="light" />
              <span>Баку, Азербайджан</span>
            </span>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <Globe size={12} weight="light" className="text-neutral-500" />
            {LOCALES.map((loc) => (
              <button
                key={loc}
                onClick={() => setLocale(loc)}
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                  locale === loc
                    ? "bg-gold/20 text-gold"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {loc.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <nav className="border-b border-dark-border/60 bg-dark/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center gap-5 px-6 py-3">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="TravelHub">
            <div className="flex size-9 items-center justify-center rounded-lg bg-gold/15 font-serif text-base font-bold text-gold">
              T
            </div>
            <div className="hidden sm:block">
              <div className="text-[15px] font-bold leading-tight">
                <span className="text-white">Travel</span>
                <span className="text-gold">Hub</span>
              </div>
              <div className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Discover more together</div>
            </div>
          </Link>

          {/* Header search bar - wider */}
          <form onSubmit={handleSearch} className="hidden w-full max-w-lg md:block">
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                <MagnifyingGlass size={16} weight="light" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск отелей, туров, экскурсий и услуг..."
                className="w-full rounded-lg border border-dark-border bg-dark-card py-2 pl-9 pr-4 text-sm text-white placeholder-neutral-500 outline-none transition-colors focus:border-gold/40"
              />
            </div>
          </form>

          {/* Desktop nav links */}
          <div className="hidden items-center gap-0.5 xl:flex">
            <Link href="/search?category=destinations" className="rounded-lg px-3 py-2 text-sm text-neutral-400 transition-colors hover:text-white">
              {t("nav.destinations", locale)}
            </Link>

            {/* Услуги - click dropdown */}
            <div className="relative" ref={servicesRef}>
              <button
                onClick={() => setServicesOpen(!servicesOpen)}
                aria-expanded={servicesOpen}
                aria-haspopup="true"
                className="flex items-center gap-0.5 rounded-lg px-3 py-2 text-sm text-neutral-400 transition-colors hover:text-white"
              >
                {t("nav.services", locale)}
                <CaretDown size={12} weight="light" className={`text-neutral-500 transition-transform duration-200 ${servicesOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Dropdown */}
              {servicesOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-dark-border bg-dark-surface/95 shadow-xl backdrop-blur-md">
                  {SERVICES.map((svc) => (
                    <Link
                      key={svc.href}
                      href={svc.href}
                      onClick={() => setServicesOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <span className="text-gold">{svc.icon}</span>
                      <span>{t(svc.labelKey, locale)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link href="/search?sort=popular" className="rounded-lg px-3 py-2 text-sm text-neutral-400 transition-colors hover:text-white">
              {t("nav.offers", locale)}
            </Link>
            <Link href="/become-a-partner" className="rounded-lg px-3 py-2 text-sm text-neutral-400 transition-colors hover:text-white">
              {t("nav.for_partners", locale)}
            </Link>
          </div>

          {/* Right side - icons with labels */}
          <div className="ml-auto flex items-center gap-2">
            <button className="hidden flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-neutral-400 transition-colors hover:text-white sm:flex" aria-label={t("nav.favorites", locale)}>
              <Heart size={20} weight="light" />
              <span className="text-[10px]">{t("nav.favorites", locale)}</span>
            </button>
            <button className="hidden flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-neutral-400 transition-colors hover:text-white sm:flex" aria-label={t("nav.notifications", locale)}>
              <div className="relative">
                <Bell size={20} weight="light" />
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-gold text-[8px] font-bold text-dark">2</span>
              </div>
              <span className="text-[10px]">{t("nav.notifications", locale)}</span>
            </button>
            <button className="hidden flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-neutral-400 transition-colors hover:text-white sm:flex" aria-label={t("nav.cart", locale)}>
              <ShoppingCart size={20} weight="light" />
              <span className="text-[10px]">{t("nav.cart", locale)}</span>
            </button>

            {user === null ? (
              <Link
                href="/login"
                className="flex flex-col items-center gap-0.5 rounded-lg border border-dark-border bg-dark-card px-3 py-1.5 text-neutral-300 transition-all hover:border-gold/40 hover:text-white"
              >
                <User size={18} weight="light" />
                <span className="text-[10px]">{t("nav.login", locale)}</span>
              </Link>
            ) : isInternalRole(user.role) ? (
              <Link href="/app/dashboard" className="rounded-lg bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20">
                {t("nav.workspace", locale)}
              </Link>
            ) : user.role === "PARTNER" ? (
              <Link href="/partner" className="rounded-lg bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20">
                {t("nav.cabinet", locale)}
              </Link>
            ) : (
              <Link href="/account" className="rounded-lg bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20">
                {t("nav.account", locale)}
              </Link>
            )}

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-lg p-2 text-neutral-400 transition-colors hover:text-white xl:hidden"
              aria-label="Menu"
            >
              {mobileOpen ? <X size={22} weight="light" /> : <List size={22} weight="light" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-dark-border bg-dark-surface/95 backdrop-blur-md xl:hidden">
            <div className="mx-auto max-w-[1400px] px-6 py-4">
              <form onSubmit={handleSearch} className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("nav.search_placeholder", locale)}
                  className="flex-1 rounded-lg border border-dark-border bg-dark-card px-4 py-2.5 text-sm text-white placeholder-neutral-500 outline-none transition-colors focus:border-gold/50"
                  autoFocus
                />
                <button type="submit" className="btn-gold rounded-lg px-6 py-2.5 text-sm">
                  {t("nav.find", locale)}
                </button>
              </form>
              <div className="flex flex-col gap-1">
                <Link href="/search?category=destinations" onClick={() => setMobileOpen(false)} className="rounded-lg px-4 py-3 text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-white">
                  {t("nav.destinations", locale)}
                </Link>
                <Link href="/search" onClick={() => setMobileOpen(false)} className="rounded-lg px-4 py-3 text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-white">
                  {t("nav.services", locale)}
                </Link>
                <Link href="/search?sort=popular" onClick={() => setMobileOpen(false)} className="rounded-lg px-4 py-3 text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-white">
                  {t("nav.offers", locale)}
                </Link>
                <Link href="/become-a-partner" onClick={() => setMobileOpen(false)} className="rounded-lg px-4 py-3 text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-white">
                  {t("nav.for_partners", locale)}
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
