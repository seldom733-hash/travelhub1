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
  Envelope,
  MapPin,
  MagnifyingGlass,
  CaretDown,
  X,
} from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-user";
import { isInternalRole } from "@/lib/routes";
import LocaleSelector from "../public/LocaleSelector";

export default function MarketplaceHeader() {
  const user = useCurrentUser();
  const locale = useLocale();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
  };

  return (
    <header className="sticky top-0 z-50">
      {/* Top utility bar */}
      <div className="border-b border-dark-border bg-dark-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 text-xs text-neutral-400">
          <div className="hidden items-center gap-4 md:flex">
            <a
              href="tel:+994123456789"
              className="flex items-center gap-1 transition-colors hover:text-gold"
            >
              <Phone size={12} weight="light" />
              <span>+994 12 345 67 89</span>
            </a>
            <a
              href="mailto:info@travelhub.az"
              className="flex items-center gap-1 transition-colors hover:text-gold"
            >
              <Envelope size={12} weight="light" />
              <span>info@travelhub.az</span>
            </a>
            <span className="flex items-center gap-1">
              <MapPin size={12} weight="light" />
              <span>Баку, Азербайджан</span>
            </span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <LocaleSelector variant="compact" />
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <nav className="border-b border-dark-border bg-dark/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="TravelHub">
            <div className="flex size-9 items-center justify-center rounded-lg bg-gold text-sm font-bold text-dark">
              T
            </div>
            <span className="text-base font-semibold text-white">
              Travel<span className="text-gold">Hub</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden items-center gap-1 md:flex">
            <Link
              href="/search?category=destinations"
              className="rounded-lg px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              {t("nav.destinations", locale)}
            </Link>
            <Link
              href="/search"
              className="rounded-lg px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              {t("nav.services", locale)}
            </Link>
            <Link
              href="/search?sort=popular"
              className="rounded-lg px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              {t("nav.offers", locale)}
            </Link>
            <Link
              href="/become-a-partner"
              className="rounded-lg px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              {t("nav.for_partners", locale)}
            </Link>
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            {/* Search toggle */}
            <button
              type="button"
              onClick={() => setSearchOpen(!searchOpen)}
              className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
              aria-label={t("nav.search", locale)}
            >
              <MagnifyingGlass size={20} weight="light" />
            </button>

            {/* Favorites */}
            <button
              type="button"
              className="hidden rounded-lg p-2 text-neutral-400 transition-colors hover:bg-white/5 hover:text-white sm:block"
              aria-label={t("nav.favorites", locale)}
            >
              <Heart size={20} weight="light" />
            </button>

            {/* Notifications */}
            <button
              type="button"
              className="hidden rounded-lg p-2 text-neutral-400 transition-colors hover:bg-white/5 hover:text-white sm:block"
              aria-label={t("nav.notifications", locale)}
            >
              <Bell size={20} weight="light" />
            </button>

            {/* Cart */}
            <button
              type="button"
              className="hidden rounded-lg p-2 text-neutral-400 transition-colors hover:bg-white/5 hover:text-white sm:block"
              aria-label={t("nav.cart", locale)}
            >
              <ShoppingCart size={20} weight="light" />
            </button>

            {/* Auth */}
            {user === null ? (
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-lg border border-dark-border px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-gold/50 hover:text-white"
              >
                <User size={16} weight="light" />
                <span className="hidden sm:inline">{t("nav.login", locale)}</span>
              </Link>
            ) : isInternalRole(user.role) ? (
              <Link
                href="/app/dashboard"
                className="rounded-lg bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20"
              >
                {t("nav.workspace", locale)}
              </Link>
            ) : user.role === "PARTNER" ? (
              <Link
                href="/partner"
                className="rounded-lg bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20"
              >
                {t("nav.cabinet", locale)}
              </Link>
            ) : (
              <Link
                href="/account"
                className="rounded-lg bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20"
              >
                {t("nav.account", locale)}
              </Link>
            )}

            {/* Mobile menu */}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-white/5 hover:text-white md:hidden"
              aria-label="Menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={22} weight="light" /> : <List size={22} weight="light" />}
            </button>
          </div>
        </div>

        {/* Search overlay */}
        {searchOpen && (
          <div className="border-t border-dark-border bg-dark-surface/95 backdrop-blur-md">
            <div className="mx-auto max-w-7xl px-4 py-4">
              <form onSubmit={handleSearch} className="flex gap-2">
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
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="rounded-lg p-2.5 text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <X size={20} weight="light" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-dark-border bg-dark-surface/95 backdrop-blur-md md:hidden">
            <div className="mx-auto max-w-7xl px-4 py-4">
              <div className="flex flex-col gap-1">
                <Link
                  href="/search?category=destinations"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-4 py-3 text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  {t("nav.destinations", locale)}
                </Link>
                <Link
                  href="/search"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-4 py-3 text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  {t("nav.services", locale)}
                </Link>
                <Link
                  href="/search?sort=popular"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-4 py-3 text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  {t("nav.offers", locale)}
                </Link>
                <Link
                  href="/become-a-partner"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-4 py-3 text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-white"
                >
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
