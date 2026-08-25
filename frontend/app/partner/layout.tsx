"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, auth, type CrmTierResponse } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-user";
import { isInternalRole } from "@/lib/routes";
import { useLocale } from "@/lib/i18n";
import { pt } from "@/lib/partner-i18n";
import LocaleSelector from "@/components/public/LocaleSelector";

/**
 * PHASE 1 STEP 1.8 + 1.10 — PartnerLayout (внешний контур /partner/*).
 *
 * - brand/logo + навигация ТОЛЬКО партнёрского кабинета (employee Work Centers
 *   НЕ показываются);
 * - locale selector RU/AZ/EN + logout;
 * - role gate: только PARTNER. BUYER → витрина, internal-роли → /app/dashboard,
 *   anonymous — перехватывает proxy.ts (server-side) + клиентский guard (defense).
 * - Step 1.10 onboarding gate: PARTNER БЕЗ partnerId (pending onboarding) видит
 *   ТОЛЬКО /partner/onboarding* (НЕ Product management); approved PARTNER —
 *   обычный Cabinet. Backend остаётся авторитетным (Product create/list
 *   заблокированы до approve на сервере).
 * - дети рендерятся только для PARTNER (нет вспышки внутреннего UI).
 * Backend остаётся авторитетным: эти проверки — UX-барьер, не security.
 */
// Base navigation items (always visible for approved PARTNER)
const BASE_NAV = [
  { href: "/partner", labelKey: "partner.nav.overview", icon: "🏠" },
  { href: "/partner/products", labelKey: "partner.nav.products", icon: "🧳" },
  { href: "/partner/products/new", labelKey: "partner.nav.new_product", icon: "➕" },
  { href: "/partner/seller-profile", labelKey: "partner.nav.seller_identity", icon: "🛡" },
  { href: "/partner/storefront", labelKey: "partner.nav.storefront", icon: "🏪" },
] as const;

// Tier-aware CRM entry — added after base items for approved PARTNER
const CUSTOMER_NAV_BASIC = { href: "/partner/customers", labelKey: "partner.nav.customers", icon: "👤" } as const;
const CUSTOMER_NAV_PRO = { href: "/partner/customers", labelKey: "partner.nav.crm", icon: "👥" } as const;

const ONBOARDING_NAV = [{ href: "/partner/onboarding", labelKey: "partner.nav.onboarding", icon: "📝" }] as const;

const isOnboardingPath = (pathname: string) => pathname === "/partner/onboarding" || pathname.startsWith("/partner/onboarding/");

const isActive = (href: string, pathname: string) =>
  href === "/partner" ? pathname === "/partner" : pathname.startsWith(href);

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);
  const [crmTier, setCrmTier] = useState<"BASIC" | "PRO" | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Step 3.5C: resolve CRM tier for partner navigation
  useEffect(() => {
    if (!user || user.role !== "PARTNER" || !user.partnerId) return;
    api
      .get<CrmTierResponse>("/partner/crm-tier")
      .then((res) => setCrmTier(res.tier))
      .catch(() => setCrmTier("BASIC"));
  }, [user]);

  // Auth boundary: anonymous /partner/* перехватывается proxy.ts (server-side,
  // по отсутствию HttpOnly cookie). Клиентский !auth.token-guard здесь НЕ
  // используется (Step 2.17: сессия в HttpOnly cookie, JS не читает токен):
  // истина — useCurrentUser через /auth/session; отсутствие сессии на защищённом
  // пути обрабатывает useCurrentUser (path-guarded fallback на /login).

  // Role gate: только PARTNER имеет право на /partner/*. Решение — по ЗАГРУЖЕННОМУ
  // user из /auth/me (единственный источник истины), никогда не logout.
  // Step 1.10 onboarding gate: pending (partnerId=null) — только onboarding;
  // approved — Cabinet (onboarding-пути уводят на /partner).
  useEffect(() => {
    if (!mounted || !user) return;
    if (user.role !== "PARTNER") {
      router.replace(isInternalRole(user.role) ? "/app/dashboard" : "/");
      return;
    }
    if (!user.partnerId && !isOnboardingPath(pathname)) {
      router.replace("/partner/onboarding");
      return;
    }
    if (user.partnerId && isOnboardingPath(pathname)) {
      router.replace("/partner");
    }
  }, [mounted, pathname, user, router]);

  if (!mounted || !user || user.role !== "PARTNER") {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">…</div>;
  }

  // Pending applicant: children рендерятся ТОЛЬКО для onboarding-путей.
  const pending = !user.partnerId;
  if (pending && !isOnboardingPath(pathname)) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">…</div>;
  }

  const NAV = pending
    ? ONBOARDING_NAV
    : [...BASE_NAV, crmTier === "PRO" ? CUSTOMER_NAV_PRO : CUSTOMER_NAV_BASIC];

  const logout = () => {
    void api.post("/auth/logout").catch(() => undefined);
    auth.clear();
    router.replace("/login");
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          {/* Workspace title — static label, NOT a link */}
          <div className="flex shrink-0 items-center gap-2" role="presentation">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-base font-bold text-white">T</div>
            <span className="text-base font-bold text-slate-900">
              Travel<span className="text-emerald-600">Hub</span>
              <span className="ml-2 hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 sm:inline">
                {pt("partner.nav.cabinet", locale)}
              </span>
            </span>
          </div>

          <nav className="flex items-center gap-1 text-sm" aria-label={pt("partner.nav.cabinet", locale)}>
            {NAV.map((item) => {
              const active = isActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 transition-colors ${
                    active ? "bg-emerald-50 font-medium text-emerald-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span aria-hidden className="mr-1.5">
                    {item.icon}
                  </span>
                  {pt(item.labelKey, locale)}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              className="hidden rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-emerald-300 hover:text-emerald-700 sm:block"
            >
              {pt("partner.nav.to_marketplace", locale)}
            </Link>
            <LocaleSelector />
            <div className="flex items-center gap-2 border-l border-slate-200 pl-2">
              <span className="hidden max-w-32 truncate text-xs text-slate-500 md:block">{user.fullName ?? user.username}</span>
              <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">PARTNER</span>
              <button
                onClick={logout}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100"
              >
                {pt("partner.nav.logout", locale)}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-400">
        TravelHub — {pt("partner.nav.cabinet", locale)}
      </footer>
    </div>
  );
}
