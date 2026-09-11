"use client";

import Link from "next/link";
import { useState } from "react";
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
} from "@phosphor-icons/react";
import { t, useLocale, useSetLocale, LOCALES } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-user";
import { isInternalRole } from "@/lib/routes";

export default function MarketplaceHeader() {
  const user = useCurrentUser();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

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
        <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-6 py-3">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="TravelHub">
            <div className="flex size-9 items-center justify-center rounded-lg bg-gold/15 font-serif text-base font-bold text-gold">
              T
            </div>
            <div className="hidden sm:block">
              <div className="text-[15px] font-bold leading-tight text-white">TravelHub</div>
              <div className="text-[9px] uppercase tracking-[0.15em] text-neutral-500">Discover more together</div>
            </div>
          </Link>

          {/* Header search bar */}
          <form onSubmit={handleSearch} className="hidden max-w-md flex-1 md:block">
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
          <div className="hidden items-center gap-1 xl:flex">
            <Link href="/search?category=destinations" className="rounded-lg px-3 py-2 text-sm text-neutral-400 transition-colors hover:text-white">
              {t("nav.destinations", locale)}
            </Link>
            <Link href="/search" className="flex items-center gap-0.5 rounded-lg px-3 py-2 text-sm text-neutral-400 transition-colors hover:text-white">
              {t("nav.services", locale)}
            </Link>
            <Link href="/search?sort=popular" className="rounded-lg px-3 py-2 text-sm text-neutral-400 transition-colors hover:text-white">
              {t("nav.offers", locale)}
            </Link>
            <Link href="/become-a-partner" className="rounded-lg px-3 py-2 text-sm text-neutral-400 transition-colors hover:text-white">
              {t("nav.for_partners", locale)}
            </Link>
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-1">
            <button className="hidden rounded-lg p-2 text-neutral-400 transition-colors hover:text-white sm:block" aria-label={t("nav.favorites", locale)}>
              <Heart size={20} weight="light" />
            </button>
            <button className="hidden rounded-lg p-2 text-neutral-400 transition-colors hover:text-white sm:block" aria-label={t("nav.notifications", locale)}>
              <Bell size={20} weight="light" />
            </button>
            <button className="hidden rounded-lg p-2 text-neutral-400 transition-colors hover:text-white sm:block" aria-label={t("nav.cart", locale)}>
              <ShoppingCart size={20} weight="light" />
            </button>

            {user === null ? (
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-lg border border-dark-border bg-dark-card px-4 py-2 text-sm text-neutral-300 transition-all hover:border-gold/40 hover:text-white"
              >
                <User size={16} weight="light" />
                <span className="hidden sm:inline">{t("nav.login", locale)}</span>
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
