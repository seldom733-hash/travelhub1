"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, auth } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-user";
import { homeForRole } from "@/lib/routes";
import { t, useLocale } from "@/lib/i18n";
import LocaleSelector from "@/components/public/LocaleSelector";

/**
 * PHASE 1 STEP 1.13 — BuyerAccountLayout (/account/*).
 *
 * Отдельный Buyer Cabinet layout (§4):
 *  - ROLE GATE: кабинет доступен ТОЛЬКО BUYER. PARTNER → /partner, internal-роли
 *    → /app/dashboard (internal routing rules сохраняются, §3). BUYER никогда не
 *    видит internal Shell-меню и Partner Cabinet nav.
 *  - canonical nav: Overview / Profile / Orders / Bookings / Payments / Documents / Support;
 *  - buyer summary (имя + email из own-profile/identity), locale selector, logout;
 *  - mobile navigation (hamburger → dropdown), loading/error states;
 *  - anonymous /account/* перехватывает middleware (proxy.ts) + клиентский
 *    fallback (useCurrentUser → /login?next=...).
 * Дети рендерятся только после загрузки user и подтверждения роли BUYER —
 * никакой вспышки чужого UI.
 */
export default function BuyerAccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Role gate (§3): только BUYER. Прочие authenticated роли уходят в свой home.
  useEffect(() => {
    if (!mounted || !user) return;
    if (user.role !== "BUYER") {
      router.replace(homeForRole(user.role));
    }
  }, [mounted, pathname, user, router]);

  const logout = () => {
    void api.post("/auth/logout").catch(() => undefined);
    auth.clear();
    router.replace("/login");
  };

  if (!mounted || !auth.token || !user || user.role !== "BUYER") {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400">…</div>;
  }

  const nav = [
    { href: "/account", label: t("account.overview", locale), exact: true },
    { href: "/account/profile", label: t("account.profile", locale) },
    { href: "/account/orders", label: t("account.orders", locale) },
    { href: "/account/bookings", label: t("account.bookings", locale) },
    { href: "/account/payments", label: t("account.payments", locale) },
    { href: "/account/documents", label: t("account.documents", locale) },
    { href: "/account/support", label: t("account.support", locale) },
  ];

  const isActive = (item: (typeof nav)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="TravelHub">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-base font-bold text-white shadow-sm">
              T
            </div>
            <span className="text-base font-bold text-slate-900">
              Travel<span className="text-blue-600">Hub</span>
              <span className="ml-2 hidden rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 sm:inline">
                {t("account.buyer_summary", locale)}
              </span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="thin-scroll ml-2 hidden flex-1 items-center gap-1 overflow-x-auto text-sm md:flex" aria-label={t("nav.account", locale)}>
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item) ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 transition-colors ${
                  isActive(item) ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Buyer summary (desktop) */}
          <div className="ml-auto hidden min-w-0 items-center gap-2 md:flex">
            <div className="min-w-0 max-w-[10rem] rounded-lg bg-slate-50 px-3 py-1.5">
              <div className="truncate text-xs font-semibold text-slate-800">{user.fullName ?? user.username}</div>
              <div className="truncate text-[11px] text-slate-500">{user.email ?? user.username}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/"
              className="hidden rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700 sm:block"
            >
              {t("nav.to_marketplace", locale)}
            </Link>
            <LocaleSelector />
            <button
              onClick={logout}
              className="hidden rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100 sm:block"
            >
              {t("nav.logout", locale)}
            </button>
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label={t("account.menu", locale)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <nav className="border-t border-slate-200 bg-white px-4 py-3 md:hidden" aria-label={t("nav.account", locale)}>
            <div className="mb-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">{user.fullName ?? user.username}</div>
                <div className="truncate text-xs text-slate-500">{user.email ?? ""}</div>
              </div>
              <button
                onClick={logout}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100"
              >
                {t("nav.logout", locale)}
              </button>
            </div>
            <ul className="space-y-1">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={isActive(item) ? "page" : undefined}
                    className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive(item) ? "bg-blue-50 font-medium text-blue-700" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="mt-3 block rounded-lg border border-slate-200 px-3 py-2 text-center text-sm text-slate-600 transition-colors hover:bg-slate-100"
            >
              {t("nav.to_marketplace", locale)}
            </Link>
          </nav>
        )}
      </header>

      {/* ── Content ── */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-400">
        TravelHub — {t("account.title", locale)}
      </footer>
    </div>
  );
}
