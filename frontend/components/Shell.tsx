"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, auth } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-user";
import { homeForRole, isExternalRole } from "@/lib/routes";

interface NavItem {
  href: string;
  icon: string;
  label: string;
  /** Гранулярное право, открывающее раздел (RBAC Matrix §4). */
  permission?: string;
}

/**
 * PHASE 1 STEP 1.6 — internal navigation: ВСЕ пункты ведут на /app/*.
 * Public витрина доступна по ссылке «На витрину» (наружу), но sidebar ведёт
 * только на внутренние Work Centers (§14).
 */
const NAV: NavItem[] = [
  { href: "/app/dashboard", icon: "🏠", label: "Рабочий стол" },
  { href: "/app/catalog", icon: "📚", label: "Catalog Center", permission: "catalog.product.read" },
  { href: "/app/orders", icon: "🧾", label: "Order Center", permission: "order.read" },
  { href: "/app/bookings", icon: "📑", label: "Booking Center", permission: "booking.read" },
  { href: "/app/crm", icon: "🤝", label: "CRM mini", permission: "crm.customer.read" },
  { href: "/app/partners/onboarding", icon: "📋", label: "Partner onboarding", permission: "partner.onboarding.review" },
  { href: "/app/seller-profiles", icon: "🛡", label: "Seller profiles", permission: "seller_public_profile.review" },
  { href: "/app/users", icon: "👥", label: "Пользователи", permission: "settings.write" },
];

/** Маршрут → требуемое право (для редиректа при прямом переходе). */
const ROUTE_PERMISSION: Record<string, string> = Object.fromEntries(
  NAV.filter((n) => n.permission).map((n) => [n.href, n.permission as string]),
);

const canAccess = (user: { permissions: string[] } | null, permission?: string) =>
  !permission || (user?.permissions.includes(permission) ?? false);

const isDashboardPath = (href: string, pathname: string) =>
  href === "/app/dashboard" ? pathname === "/app" || pathname === "/app/dashboard" : pathname.startsWith(href);

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auth boundary: anonymous /app/* перехватывается middleware (server-side).
  // Клиентский !auth.token-guard убран: во время гидратации чтение localStorage
  // может разойтись с загрузкой user (race) → ложный logout. Отсутствие сессии
  // на защищённом пути обрабатывает useCurrentUser (path-guarded fallback).

  // Step 1.6 §11 + Step 1.8 + Step 1.13: внешние роли НЕ получают employee Work
  // Centers. PARTNER → /partner (Partner Cabinet), BUYER → /account (Buyer Cabinet).
  // pathname в deps: редирект повторяется, если другой эффект успел перевести
  // на /app/* до срабатывания этой проверки (race двух router.replace).
  useEffect(() => {
    if (!mounted || !user) return;
    if (isExternalRole(user.role)) {
      router.replace(homeForRole(user.role));
    }
  }, [mounted, pathname, user, router]);

  // Редирект с маршрута, на который у пользователя нет права.
  useEffect(() => {
    if (!mounted || !user) return;
    // Внешние роли никогда не перенаправляются на /app/* (в т.ч. при нехватке прав).
    if (isExternalRole(user.role)) {
      router.replace(homeForRole(user.role));
      return;
    }
    const required = ROUTE_PERMISSION[pathname];
    if (required && !user.permissions.includes(required)) {
      router.replace("/app/dashboard");
    }
  }, [mounted, pathname, user, router]);

  // До монтирования рендерим одинаковый заглушечный DOM (SSR = client, без hydration mismatch).
  // Children НЕ рендерятся, пока user не разрешён: (a) без токена — boundary → /login;
  // (b) внешние роли (PARTNER/BUYER) никогда не получают внутренние Work Centers —
  // рендер детей блокирован до редиректа (review: исключает вспышку внутреннего UI
  // и лишние internal API-запросы от внешней роли). BUYER → /account (Step 1.13).
  if (!mounted || !auth.token || !user || isExternalRole(user.role)) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Загрузка…</div>;
  }

  const visibleNav = NAV.filter((item) => canAccess(user, item.permission));
  const hiddenCount = NAV.length - visibleNav.length;

  const logout = () => {
    void api.post("/auth/logout").catch(() => undefined);
    auth.clear();
    router.replace("/login");
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ── */}
      <aside className="thin-scroll sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto bg-slate-900 text-slate-200">
        <Link href="/app/dashboard" className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
          <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500 text-base font-bold text-white">T</div>
          <div>
            <div className="text-base font-bold text-white">
              Travel<span className="text-blue-400">Hub</span>
            </div>
            <div className="text-[10px] text-slate-400">Internal App</div>
          </div>
        </Link>
        <nav className="flex-1 py-3">
          {visibleNav.map((item) => {
            const active = isDashboardPath(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  active
                    ? "border-r-2 border-blue-400 bg-blue-500/15 font-medium text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="w-5 text-center text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          {hiddenCount > 0 && (
            <div className="mt-3 px-5 text-[10px] leading-relaxed text-slate-600">
              {hiddenCount} раздел(ов) скрыто — нет прав доступа
            </div>
          )}
        </nav>
        <div className="border-t border-white/10 px-5 py-4">
          {user && (
            <div className="mb-3">
              <div className="truncate text-sm font-medium text-white">{user.fullName ?? user.username}</div>
              <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
                {user.role}
              </div>
            </div>
          )}
          <Link
            href="/"
            className="mb-2 block w-full rounded-lg border border-white/10 px-3 py-1.5 text-center text-xs text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            На витрину →
          </Link>
          <button
            onClick={logout}
            className="w-full rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            Выйти
          </button>
        </div>
      </aside>

      {/* ── Content ── */}
      <main className="thin-scroll flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
