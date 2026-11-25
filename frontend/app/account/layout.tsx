"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, auth } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-user";
import { homeForRole } from "@/lib/routes";
import { t, useLocale } from "@/lib/i18n";
import { useGlobalBranding } from "@/lib/use-global-branding";
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
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const { brandName } = useGlobalBranding();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Unread counter for the client cabinet: polling + explicit refresh event
  // from the notifications page after "read"/"read all".
  useEffect(() => {
    if (!mounted || !user || user.role !== "BUYER") return;
    let alive = true;
    const load = () => {
      api
        .get<{ unread: number }>("/account/notifications?pageSize=1")
        .then((r) => { if (alive) setUnreadNotifications(Number(r.unread ?? 0)); })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 15_000);
    window.addEventListener("account-notifications-updated", load);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("account-notifications-updated", load);
    };
  }, [mounted, user]);

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

  if (!mounted || !user || user.role !== "BUYER") {
    return <div className="flex min-h-screen items-center justify-center bg-panel text-ink/60">…</div>;
  }

  const nav = [
    { href: "/account", label: t("account.overview", locale), exact: true },
    { href: "/account/profile", label: t("account.profile", locale) },
    { href: "/account/notifications", label: t("account.notifications", locale) },
    { href: "/account/requests", label: t("crm.detail.requests", locale) },
    { href: "/account/orders", label: t("account.orders", locale) },
    { href: "/account/bookings", label: t("account.bookings", locale) },
    { href: "/account/payments", label: t("account.payments", locale) },
    { href: "/account/documents", label: t("account.documents", locale) },
    { href: "/account/support", label: t("account.support", locale) },
  ];

  const isActive = (item: (typeof nav)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="flex min-h-screen flex-col bg-panel">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={brandName}>
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-base font-bold text-white shadow-sm">
              T
            </div>
            <span className="text-base font-bold text-ink">
              {brandName}
              <span className="ml-2 hidden rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-dark sm:inline">
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
                  isActive(item) ? "bg-brand/10 font-medium text-brand-dark" : "text-ink/60 hover:bg-panel hover:text-ink"
                }`}
              >
                {item.label}
                {item.href === "/account/notifications" && unreadNotifications > 0 && (
                  <span className="ml-1.5 inline-flex min-w-4 animate-pulse items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white motion-reduce:animate-none">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Buyer summary (desktop) */}
          <div className="ml-auto hidden min-w-0 items-center gap-2 md:flex">
            <div className="min-w-0 max-w-[10rem] rounded-lg bg-panel px-3 py-1.5">
              <div className="truncate text-xs font-semibold text-ink">{user.fullName ?? user.username}</div>
              <div className="truncate text-[11px] text-ink/60">{user.email ?? user.username}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/"
              className="hidden rounded-lg border border-line px-3 py-1.5 text-xs text-ink/60 transition-colors hover:border-brand/25 hover:text-brand-dark sm:block"
            >
              {t("nav.to_marketplace", locale)}
            </Link>
            <LocaleSelector />
            <button
              onClick={logout}
              className="hidden rounded-lg border border-line px-3 py-1.5 text-xs text-ink/60 transition-colors hover:bg-panel sm:block"
            >
              {t("nav.logout", locale)}
            </button>
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label={t("account.menu", locale)}
              className="rounded-lg border border-line px-2.5 py-1.5 text-ink/60 transition-colors hover:bg-panel md:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <nav className="border-t border-line bg-white px-4 py-3 md:hidden" aria-label={t("nav.account", locale)}>
            <div className="mb-3 flex items-center justify-between rounded-xl bg-panel px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">{user.fullName ?? user.username}</div>
                <div className="truncate text-xs text-ink/60">{user.email ?? ""}</div>
              </div>
              <button
                onClick={logout}
                className="shrink-0 rounded-lg border border-line bg-white px-3 py-1.5 text-xs text-ink/60 transition-colors hover:bg-panel"
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
                      isActive(item) ? "bg-brand/10 font-medium text-brand-dark" : "text-ink hover:bg-panel"
                    }`}
                  >
                    {item.label}
                {item.href === "/account/notifications" && unreadNotifications > 0 && (
                  <span className="ml-1.5 inline-flex min-w-4 animate-pulse items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white motion-reduce:animate-none">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="mt-3 block rounded-lg border border-line px-3 py-2 text-center text-sm text-ink/60 transition-colors hover:bg-panel"
            >
              {t("nav.to_marketplace", locale)}
            </Link>
          </nav>
        )}
      </header>

      {/* ── Content ── */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-line bg-white py-5 text-center text-xs text-ink/60">
        {brandName} — {t("account.title", locale)}
      </footer>
    </div>
  );
}
