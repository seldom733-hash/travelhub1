"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, auth } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-user";
import { homeForRole, isExternalRole } from "@/lib/routes";
import { useLocale, t } from "@/lib/i18n";
import { useGlobalBranding } from "@/lib/use-global-branding";
import {
  NAV_GROUPS,
  canAccess,
  isNavActive,
  isRouteAllowed,
} from "@/lib/nav";

export { NAV_GROUPS } from "@/lib/nav";

/** localStorage key for sidebar collapsed state. */
const SIDEBAR_COLLAPSED_KEY = "th_sidebar_collapsed";
/** v2 stores CLOSED group ids, so new groups are open by default. */
const SIDEBAR_GROUPS_KEY = "th_sidebar_groups_v2";

function readCollapsedDefault(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function readClosedGroups(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SIDEBAR_GROUPS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});
  const [pendingPayments, setPendingPayments] = useState(0);
  const [unreadRequests, setUnreadRequests] = useState(0);
  const collapsedRef = useRef(false);
  const mobileCloseRef = useRef<HTMLButtonElement | null>(null);
  const { brandName } = useGlobalBranding();

  useEffect(() => {
    setCollapsed(readCollapsedDefault());
    setClosedGroups(readClosedGroups());
    setMounted(true);
  }, []);

  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileCloseRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  // Финансист видит, сколько платежей ждут подтверждения.
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

  // Opening a request marks its assignment notification read.
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

  const toggleGroup = useCallback((headingKey: string) => {
    setClosedGroups((prev) => {
      const next = { ...prev, [headingKey]: !prev[headingKey] };
      try {
        localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(next));
      } catch { /* noop */ }
      return next;
    });
  }, []);

  // External roles never get employee Work Centers.
  useEffect(() => {
    if (!mounted || !user) return;
    if (isExternalRole(user.role)) {
      router.replace(homeForRole(user.role));
    }
  }, [mounted, pathname, user, router]);

  // Client-side route guard: permissions + roles, explicit table in lib/nav.ts.
  useEffect(() => {
    if (!mounted || !user) return;
    if (isExternalRole(user.role)) {
      router.replace(homeForRole(user.role));
      return;
    }
    if (!isRouteAllowed(pathname, user)) {
      router.replace("/app/dashboard");
    }
  }, [mounted, pathname, user, router]);

  if (!mounted || !user || isExternalRole(user.role)) {
    return <div className="flex min-h-screen items-center justify-center bg-ink text-ink/60">{t("state.loading", locale)}</div>;
  }

  const logout = () => {
    void api.post("/auth/logout").catch(() => undefined);
    auth.clear();
    router.replace("/login");
  };

  const hiddenCount = NAV_GROUPS.flatMap((group) => group.items).filter((item) => !canAccess(user, item)).length;

  const isOpen = (headingKey: string) => !closedGroups[headingKey];

  const navContent = (mobile: boolean) => (
    <nav className="flex-1 py-3" aria-label={t("sidebar.menu", locale)}>
      {NAV_GROUPS.map((group, gi) => {
        const visibleItems = group.items.filter((item) => canAccess(user, item));
        if (visibleItems.length === 0) return null;
        const headingKey = group.headingKey;
        const open = !headingKey || isOpen(headingKey);
        return (
          <div key={headingKey ?? `top-${gi}`}>
            {headingKey && (!collapsed || mobile) && (
              <button
                type="button"
                onClick={() => toggleGroup(headingKey)}
                className="mt-4 mb-1 flex w-full items-center justify-between px-5 text-[10px] font-semibold uppercase tracking-wider text-white/50 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                aria-expanded={open}
                aria-controls={`nav-group-${headingKey}`}
              >
                <span>{t(headingKey, locale)}</span>
                <span className="text-[9px]" aria-hidden="true">{open ? "▲" : "▼"}</span>
              </button>
            )}
            <div id={headingKey ? `nav-group-${headingKey}` : undefined} hidden={!mobile && !collapsed && !open}>
              {visibleItems.map((item) => {
                const active = isNavActive(item, pathname);
                const label = t(item.labelKey, locale);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative flex items-center gap-3 text-sm transition-colors ${
                      collapsed && !mobile ? "justify-center px-2 py-2.5" : "px-5 py-2.5"
                    } ${
                      active
                        ? "border-r-2 border-brand bg-brand/10 font-medium text-white"
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    }`}
                    title={label}
                    aria-label={label}
                    aria-current={active ? "page" : undefined}
                    onClick={mobile ? () => setMobileOpen(false) : undefined}
                  >
                    <span className="w-5 shrink-0 text-center text-base" aria-hidden="true">{item.icon}</span>
                    {(!collapsed || mobile) && <span className="truncate">{label}</span>}
                    {(!collapsed || mobile) && item.href === "/app/finance/deals" && unreadRequests > 0 && (
                      <span className="ml-auto inline-flex min-w-5 animate-pulse items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-900" title={`${unreadRequests} новых назначенных заявок`}>{unreadRequests}</span>
                    )}
                    {(!collapsed || mobile) && item.href === "/app/payments" && pendingPayments > 0 && (
                      <span className={`${unreadRequests > 0 ? "ml-1" : "ml-auto"} inline-flex min-w-5 animate-pulse items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-900`} title={`${pendingPayments} платежей ждут подтверждения`}>
                        {pendingPayments}
                      </span>
                    )}
                    {collapsed && !mobile && (
                      <span className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        {label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
      {!collapsed && !mobile && hiddenCount > 0 && (
        <div className="mt-3 px-5 text-[10px] leading-relaxed text-white/50">
          {t("workspace.hidden_count", locale).replace("{n}", String(hiddenCount))}
        </div>
      )}
    </nav>
  );

  const accountArea = (mobile: boolean) => (
    <div className={`border-t border-line/40 ${collapsed && !mobile ? "px-2 py-3" : "px-5 py-4"}`}>
      <div className={collapsed && !mobile ? "text-center" : "mb-3"}>
        {collapsed && !mobile ? (
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
      {(!collapsed || mobile) && (
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
      {collapsed && !mobile && (
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
  );

  const sidebarWidth = collapsed ? "w-[72px]" : "w-60";

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={`app-sidebar thin-scroll sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto bg-ink text-white transition-all duration-200 md:flex ${sidebarWidth}`}
      >
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
              <div className="text-base font-bold text-white">{brandName}</div>
              <div className="text-[10px] text-white/60">Internal App</div>
            </div>
          )}
        </Link>

        <button
          onClick={toggleCollapse}
          className="mx-2 mt-2 flex items-center justify-center rounded-lg py-1.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("sidebar.expand", locale) : t("sidebar.collapse", locale)}
          title={collapsed ? t("sidebar.expand", locale) : t("sidebar.collapse", locale)}
        >
          {collapsed ? "»" : "«"}
        </button>

        {navContent(false)}
        {accountArea(false)}
      </aside>

      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-line/40 bg-ink px-4 text-white md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex size-10 items-center justify-center rounded-lg text-lg hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label={t("sidebar.menu", locale)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
        >
          ☰
        </button>
        <span className="text-sm font-semibold">{brandName}</span>
        <span className="w-10" aria-hidden="true" />
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label={t("sidebar.collapse", locale)}
            onClick={() => setMobileOpen(false)}
          />
          <aside
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label={t("sidebar.menu", locale)}
            className="absolute inset-y-0 left-0 flex w-[280px] flex-col overflow-y-auto bg-ink text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line/40 px-4 py-3">
              <span className="text-sm font-semibold">{brandName}</span>
              <button
                ref={mobileCloseRef}
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex size-9 items-center justify-center rounded-lg text-lg hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                aria-label={t("sidebar.collapse", locale)}
              >
                ×
              </button>
            </div>
            {navContent(true)}
            {accountArea(true)}
          </aside>
        </div>
      )}

      <main className="thin-scroll flex-1 overflow-y-auto bg-panel pt-14 text-ink [color-scheme:light] md:pt-0">{children}</main>
    </div>
  );
}
