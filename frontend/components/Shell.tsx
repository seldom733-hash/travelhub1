"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, auth } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-user";
import { homeForRole, isExternalRole } from "@/lib/routes";
import { useLocale, t } from "@/lib/i18n";
import { useGlobalBranding } from "@/lib/use-global-branding";

interface NavItem {
  href: string;
  icon: string;
  labelKey: string;
  /** Гранулярное право, открывающее раздел (RBAC Matrix §4). */
  permission?: string;
  /** Optional role allow-list for UI sections that are stricter than permissions. */
  roles?: string[];
}

/**
 * PHASE 1 STEP 1.6 — internal navigation: ВСЕ пункты ведут на /app/*.
 * Public витрина доступна по ссылке «На витрину» (наружу), но sidebar ведёт
 * только на внутренние Work Centers (§14).
 */
interface NavGroup {
  /** i18n key for the group heading (localized RU/AZ/EN); absent = top-level. */
  headingKey?: string;
  items: NavItem[];
}

/**
 * UI-C1.2A: canonical sidebar ownership (UI-C1.2 contract §5/§7):
 * ОПЕРАЦИИ → Реестр продаж/Заявки/Документы; ФИНАНСЫ → Платежи (Operations
 * Center tab, domain ownership stays Finance). No invented "Центр операций"
 * sidebar item — the Operations Center is a workflow shell, not a domain.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/app/dashboard", icon: "🏠", labelKey: "nav.dashboard" },
      { href: "/app/command-center", icon: "📊", labelKey: "nav.command_center", permission: "analytics.read" },
      { href: "/app/analytics/sales", icon: "📉", labelKey: "nav.sales_analytics", permission: "sales.kpi.read" },
      { href: "/app/bookings", icon: "📅", labelKey: "nav.bookings", permission: "booking.read" },
    ],
  },
  {
    headingKey: "nav.group.operations",
    items: [
      { href: "/app/requests/create", icon: "➕", labelKey: "nav.request_create", permission: "order.edit_noncritical" },
      { href: "/app/finance/deals", icon: "📊", labelKey: "nav.finance_deals", permission: "finance.overview.read" },
      { href: "/app/documents", icon: "📄", labelKey: "nav.documents", permission: "documents.read" },
    ],
  },
  {
    headingKey: "nav.group.finance",
    items: [
      { href: "/app/payments", icon: "💳", labelKey: "nav.payments", permission: "finance.payment.read" },
      { href: "/app/finance/reports/debt-as-of", icon: "📅", labelKey: "nav.supplier_debt_report", permission: "finance.obligation.read" },
      { href: "/app/finance/payment-terms", icon: "⏱️", labelKey: "nav.payment_terms", permission: "finance.obligation.read", roles: ["FINANCE", "ADMIN", "DIRECTOR"] },
      { href: "/app/pricing/markup", icon: "％", labelKey: "nav.markup_matrix", permission: "pricing.markup.read" },
      { href: "/app/finance/fx-rates", icon: "💱", labelKey: "nav.fx_rates", permission: "finance.fx_rate.read" },
    ],
  },
  {
    headingKey: "nav.group.commercial",
    items: [
      { href: "/app/catalog", icon: "📚", labelKey: "nav.catalog", permission: "catalog.product.read" },
      { href: "/app/sales/assignment", icon: "🧭", labelKey: "nav.assignment", permission: "request.load.read" },
      { href: "/app/my-status", icon: "🟢", labelKey: "nav.my_status", permission: "request.load.read" },
      { href: "/app/marketing", icon: "📣", labelKey: "nav.marketing", permission: "marketing.campaign.read" },
    ],
  },
  {
    headingKey: "nav.group.supplier_updates",
    items: [
      { href: "/app/supplier-updates", icon: "🔄", labelKey: "nav.supplier_updates", permission: "supplier.search.manage" },
    ],
  },
  {
    headingKey: "nav.group.references",
    items: [
      { href: "/app/geography", icon: "🗺", labelKey: "nav.geography", permission: "geography.read" },
      { href: "/app/hotel-directory", icon: "🏨", labelKey: "nav.hotels", permission: "hotel_directory.read" },
      { href: "/app/references/service-types", icon: "🧾", labelKey: "nav.service_types", permission: "hotel_directory.read" },
      { href: "/app/references/airports", icon: "✈️", labelKey: "nav.airports", permission: "hotel_directory.read" },
      { href: "/app/references/clients", icon: "👥", labelKey: "nav.clients", permission: "crm.customer.read" },
      { href: "/app/references/suppliers", icon: "🏭", labelKey: "nav.suppliers", permission: "crm.partner.read" },
      { href: "/app/references/dictionaries", icon: "📚", labelKey: "nav.dictionaries", permission: "catalog.product.read_own" },
    ],
  },
  {
    headingKey: "nav.group.service",
    items: [
      { href: "/app/support", icon: "🎫", labelKey: "nav.support", permission: "support.case.read" },
      { href: "/app/whatsapp", icon: "💬", labelKey: "nav.whatsapp", permission: "whatsapp.read" },
      { href: "/app/help", icon: "❓", labelKey: "nav.help" },
    ],
  },
  {
    headingKey: "nav.group.admin",
    items: [
      { href: "/app/users", icon: "👥", labelKey: "nav.users", permission: "settings.write" },
    ],
  },
  {
    headingKey: "nav.group.settings",
    items: [
      { href: "/app/page-builder", icon: "🔧", labelKey: "nav.constructor", permission: "settings.write" },
      { href: "/app/settings/integrations/whatsapp", icon: "🔌", labelKey: "nav.integrations", permission: "whatsapp.read" },
    ],
  },
];

const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Маршрут → требуемое право (для редиректа при прямом переходе). */
const ROUTE_PERMISSION: Record<string, string> = Object.fromEntries(
  NAV.filter((n) => n.permission).map((n) => [n.href, n.permission as string]),
);

const canAccess = (user: { permissions: string[]; role?: string } | null, permission?: string, roles?: string[]) =>
  (!permission || (user?.permissions.includes(permission) ?? false)) &&
  (!roles || (!!user?.role && roles.includes(user.role)));

const isDashboardPath = (href: string, pathname: string) =>
  href === "/app/dashboard" ? pathname === "/app" || pathname === "/app/dashboard" : pathname.startsWith(href);

/** localStorage key for sidebar collapsed state. */
const SIDEBAR_COLLAPSED_KEY = "th_sidebar_collapsed";

function readCollapsedDefault(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return v === "true";
  } catch {
    return false;
  }
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [pendingPayments, setPendingPayments] = useState(0);
  const [unreadRequests, setUnreadRequests] = useState(0);
  const [dealNotifications, setDealNotifications] = useState(0);
  const [waLinked, setWaLinked] = useState(0);
  const [waUnlinked, setWaUnlinked] = useState(0);
  const collapsedRef = useRef(false);
  const { brandName } = useGlobalBranding();

  // Hydrate collapsed state after mount. На мобильных (<768px) sidebar
  // принудительно свёрнут: 240px колонка съедала половину экрана и контент
  // уходил за правый край (визуальный аудит 2026-10-25, 375px).
  useEffect(() => {
    const apply = () => {
      setCollapsed(window.innerWidth < 768 ? true : readCollapsedDefault());
    };
    apply();
    setMounted(true);
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  // Keep the group containing the current route expanded on navigation.
  useEffect(() => {
    const activeGroup = NAV_GROUPS.find((group) =>
      group.headingKey && group.items.some((item) => isDashboardPath(item.href, pathname)),
    );
    if (activeGroup?.headingKey) {
      setOpenGroups((prev) => (prev[activeGroup.headingKey!] ? prev : { ...prev, [activeGroup.headingKey!]: true }));
    }
  }, [pathname]);

  // Sync ref for animations / effects.
  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  // Финансист видит, сколько платежей ждут подтверждения. Опрашиваем при
  // переходе по разделам и раз в 30 секунд; менеджеру бейдж не нужен, если
  // у него нет права подтверждения (но read есть — показываем только счётчик).
  useEffect(() => {
    if (!user?.permissions.includes("finance.payment.manage")) { setPendingPayments(0); return; }
    let alive = true;
    const load = () => api.get<{ payments: number }>("/sales/assignment/notifications/unread-count")
      .then((res) => { if (alive) setPendingPayments(Number(res.payments) || 0); })
      .catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 30000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [user?.id, pathname]);

  useEffect(() => {
    if (!user) { setUnreadRequests(0); return; }
    let alive = true;
    const load = () => api.get<{ requests: number }>("/sales/assignment/notifications/unread-count")
      .then((res) => { if (alive) setUnreadRequests(Number(res.requests) || 0); })
      .catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 30000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [user?.id, pathname]);

  // Opening a request marks its assignment notification read; the request
  // business status is untouched (read ≠ processing started).
  useEffect(() => {
    const match = pathname.match(/^\/app\/requests\/([^/]+)/);
    if (!match || !user) return;
    void api.post("/sales/assignment/notifications/read-entity", { entityType: "Request", entityId: match[1] })
      .then(() => api.get<{ requests: number }>("/sales/assignment/notifications/unread-count"))
      .then((res) => setUnreadRequests(Number(res.requests) || 0))
      .catch(() => undefined);
  }, [pathname, user?.id]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch { /* noop */ }
      return next;
    });
  }, []);

  // Auth boundary: anonymous /app/* перехватывается proxy.ts (server-side,
  // по отсутствию HttpOnly cookie). Клиентский !auth.token-guard убран (Step 2.17:
  // сессия в HttpOnly cookie, JS не читает токен): истина — useCurrentUser
  // через /auth/session. Отсутствие сессии на защищённом пути обрабатывает
  // useCurrentUser (path-guarded fallback).

  // Step 1.6 §11 + Step 1.8 + Step 1.13: внешние роли НЕ получают employee Work
  // Centers. PARTNER → /partner (Partner Cabinet), BUYER → /account (Buyer Cabinet).
  useEffect(() => {
    if (!mounted || !user) return;
    if (isExternalRole(user.role)) {
      router.replace(homeForRole(user.role));
    }
  }, [mounted, pathname, user, router]);

  // Редирект с маршрута, на который у пользователя нет права.
  useEffect(() => {
    if (!mounted || !user) return;
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
  if (!mounted || !user || isExternalRole(user.role)) {
    return <div className="flex min-h-screen items-center justify-center bg-ink text-ink/60">{t("state.loading", locale)}</div>;
  }

  const visibleNav = NAV.filter((item) => canAccess(user, item.permission, item.roles));
  const hiddenCount = NAV.length - visibleNav.length;

  const logout = () => {
    void api.post("/auth/logout").catch(() => undefined);
    auth.clear();
    router.replace("/login");
  };

  const sidebarWidth = collapsed ? "w-[72px]" : "w-60";

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ── */}
      <aside
        className={`app-sidebar thin-scroll sticky top-0 flex h-screen shrink-0 flex-col overflow-y-auto bg-ink text-white transition-all duration-200 ${sidebarWidth}`}
      >
        {/* Logo / Brand */}
        <Link
          href="/app/dashboard"
          className={`flex items-center gap-2.5 border-b border-line/40 ${collapsed ? "justify-center px-2 py-4" : "px-5 py-4"}`}
        >
          <div className="flex size-11 shrink-0 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/navitravel-icon.png" alt={brandName} className="h-full w-auto object-contain" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-base font-bold text-white">
                {brandName}
              </div>
              <div className="text-[10px] text-white/60">Internal App</div>
            </div>
          )}
        </Link>

        {/* Toggle button */}
        <button
          onClick={toggleCollapse}
          className="mx-2 mt-2 flex items-center justify-center rounded-lg py-1.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("sidebar.expand", locale) : t("sidebar.collapse", locale)}
          title={collapsed ? t("sidebar.expand", locale) : t("sidebar.collapse", locale)}
        >
          {collapsed ? "»" : "«"}
        </button>

        {/* Navigation */}
        <nav className="flex-1 py-3">
          {NAV_GROUPS.map((group, gi) => {
            const visibleItems = group.items.filter((item) => canAccess(user, item.permission, item.roles));
            if (visibleItems.length === 0) return null;
            return (
              <div key={gi}>
                {group.headingKey && !collapsed && (
                  <button
                    type="button"
                    onClick={() => setOpenGroups((prev) => ({ ...prev, [group.headingKey!]: !prev[group.headingKey!] }))}
                    className="mt-4 mb-1 flex w-full items-center justify-between px-5 text-[10px] font-semibold uppercase tracking-wider text-white/50 hover:text-white/80"
                    aria-expanded={Boolean(openGroups[group.headingKey!])}
                  >
                    <span>{t(group.headingKey, locale)}</span>
                    <span className="text-[9px]">{openGroups[group.headingKey!] ? "▲" : "▼"}</span>
                  </button>
                )}
                {(collapsed || !group.headingKey || openGroups[group.headingKey!]) && visibleItems.map((item) => {
                  const active = isDashboardPath(item.href, pathname);
                  const label = t(item.labelKey, locale);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group relative flex items-center gap-3 text-sm transition-colors ${
                        collapsed ? "justify-center px-2 py-2.5" : "px-5 py-2.5"
                      } ${
                        active
                          ? "border-r-2 border-brand bg-brand/10 font-medium text-white"
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      }`}
                      title={label}
                      aria-label={label}
                    >
                      <span className="w-5 shrink-0 text-center text-base">{item.icon}</span>
                      {!collapsed && <span className="truncate">{label}</span>}
                      {!collapsed && item.href === "/app/finance/deals" && dealNotifications > 0 && (
                        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700" title={`${dealNotifications} новых сделок`}>🏷 {dealNotifications}</span>
                      )}
                      {!collapsed && item.href === "/app/finance/deals" && waLinked > 0 && (
                        <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700" title={`${waLinked} новых сообщений клиентов`}>💬 {waLinked}</span>
                      )}
                      {!collapsed && item.href === "/app/whatsapp" && (waLinked > 0 || waUnlinked > 0) && (
                        <span className="ml-auto inline-flex items-center gap-1">
                          {waLinked > 0 && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700" title={`${waLinked} сообщений от клиентов`}>💬 {waLinked}</span>}
                          {waUnlinked > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800" title={`${waUnlinked} сообщений от неизвестных номеров`}>👤 {waUnlinked}</span>}
                        </span>
                      )}
                      {!collapsed && item.href === "/app/finance/deals" && unreadRequests > 0 && (
                        <span className="ml-auto inline-flex min-w-5 animate-pulse items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-900" title={`${unreadRequests} новых назначенных заявок`}>{unreadRequests}</span>
                      )}
                      {collapsed && item.href === "/app/finance/deals" && unreadRequests > 0 && (
                        <span className="absolute right-1 top-1 size-2 animate-pulse rounded-full bg-amber-400" />
                      )}
                      {!collapsed && item.href === "/app/finance/deals" && pendingPayments > 0 && (
                        <span className={`${unreadRequests > 0 ? "ml-1" : "ml-auto"} inline-flex min-w-5 animate-pulse items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-900`} title={`${pendingPayments} платежей ждут подтверждения`}>
                          {pendingPayments}
                        </span>
                      )}
                      {collapsed && item.href === "/app/finance/deals" && pendingPayments > 0 && (
                        <span className="absolute right-1 top-1 size-2 animate-pulse rounded-full bg-amber-400" />
                      )}
                      {collapsed && (
                        <span className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          {label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
          {!collapsed && hiddenCount > 0 && (
            <div className="mt-3 px-5 text-[10px] leading-relaxed text-white/50">
              {t("workspace.hidden_count", locale).replace("{n}", String(hiddenCount))}
            </div>
          )}
        </nav>

        {/* User / Account area */}
        <div className={`border-t border-line/40 ${collapsed ? "px-2 py-3" : "px-5 py-4"}`}>
          {user && (
            <div className={collapsed ? "text-center" : "mb-3"}>
              {collapsed ? (
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-brand/20 text-xs font-bold text-gold" title={user.fullName ?? user.username}>
                  {(user.fullName ?? user.username).charAt(0).toUpperCase()}
                </span>
              ) : (
                <>
                  <div className="truncate text-sm font-medium text-white">{user.fullName ?? user.username}</div>
                  <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold">
                    {user.role}
                  </div>
                </>
              )}
            </div>
          )}
          {!collapsed && (
            <>
              <Link
                href="/"
                className="mb-2 block w-full rounded-lg border border-line/40 px-3 py-1.5 text-center text-xs text-white/60 transition-colors hover:bg-white/5 hover:text-white"
              >
                {t("nav.to_marketplace", locale)} →
              </Link>
              <button
                onClick={logout}
                className="w-full rounded-lg border border-line/40 px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/5 hover:text-white"
              >
                {t("nav.logout", locale)}
              </button>
            </>
          )}
          {collapsed && (
            <button
              onClick={logout}
              className="mt-2 flex w-full items-center justify-center rounded-lg border border-line/40 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/5 hover:text-white"
              title={t("nav.logout", locale)}
              aria-label={t("nav.logout", locale)}
            >
              🚪
            </button>
          )}
        </div>
      </aside>

      {/* ── Content ── */}
      {/* Admin content is a LIGHT surface: глобальный body-color из marketplace
          (#e8e8e8) давал нечитаемые значения в таблицах/панелях. Явный
          text-ink — базовая типографика internal-контура. */}
      <main className="thin-scroll flex-1 overflow-y-auto bg-panel text-ink [color-scheme:light]">{children}</main>
    </div>
  );
}
