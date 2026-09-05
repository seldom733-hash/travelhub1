"use client";

/**
 * UI-C1.2F.1B — Operations Center Shared Shell with Shared Header Period.
 *
 * Canonical vertical composition:
 *
 *   BREADCRUMBS
 *   ЦЕНТР ОПЕРАЦИЙ                       Период: [ С ] [ По ] [×]
 *   ─────────────────────────────────────────────────────────────
 *   [ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]
 *   ─────────────────────────────────────────────────────────────
 *   ACTIVE DOMAIN CONTENT (slots provided by the domain page)
 *
 * The Header Period is a GLOBAL SCOPE:
 *   → affects KPI overview
 *   → affects table
 *   → persists across tab switches
 *
 * Registry-specific filters (status, paymentStatus, etc.) are TABLE-ONLY
 * and do NOT persist across tab switches.
 *
 * Security: tab visibility is derived from the session user's permissions,
 * but a hidden tab is NOT a security boundary — backend authorization
 * remains authoritative (route guard in Shell + @RequirePermissions).
 */
import Link from "next/link";
import { useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useLocale, t } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-user";

export type OperationsDomain = "requests" | "orders" | "bookings" | "payments";

export interface OperationsTabConfig {
  id: OperationsDomain;
  href: string;
  labelKey: string;
  permission: string;
}

/** Canonical tab set (ADR-OPS-011 permission mapping, UI-C1.2 contract §8). */
export const OPS_TABS: OperationsTabConfig[] = [
  { id: "requests", href: "/app/requests", labelKey: "nav.requests", permission: "order.read" },
  { id: "orders", href: "/app/orders", labelKey: "nav.orders", permission: "order.read" },
  { id: "bookings", href: "/app/bookings", labelKey: "nav.bookings", permission: "booking.read" },
  { id: "payments", href: "/app/payments", labelKey: "nav.payments", permission: "finance.payment.read" },
];

/** Shared period params that persist across tab switches. */
const SHARED_PERIOD_KEYS = ["dateFrom", "dateTo"] as const;

function OperationsCenterTabs({
  activeDomain,
  permissions,
  tabId,
  panelId,
  periodSearchParams,
}: {
  activeDomain: OperationsDomain;
  permissions: string[];
  tabId: string;
  panelId: string;
  periodSearchParams: string;
}) {
  const locale = useLocale();
  const listRef = useRef<HTMLDivElement>(null);
  const tabs = OPS_TABS.filter((tab) => !tab.permission || permissions.includes(tab.permission));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    const anchors = Array.from(
      listRef.current?.querySelectorAll<HTMLAnchorElement>('a[role="tab"]') ?? [],
    );
    if (anchors.length === 0) return;
    const current = anchors.findIndex((a) => a.getAttribute("aria-selected") === "true");
    const idx = current < 0 ? 0 : current;
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % anchors.length;
    if (e.key === "ArrowLeft") next = (idx - 1 + anchors.length) % anchors.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = anchors.length - 1;
    e.preventDefault();
    anchors[next]?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={t("ops.tabs_aria", locale)}
      onKeyDown={onKeyDown}
      className="-mb-px flex items-center gap-1 overflow-x-auto pb-px"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeDomain;
        const label = t(tab.labelKey, locale);
        // Preserve shared period params across tab switches.
        const href = periodSearchParams ? `${tab.href}?${periodSearchParams}` : tab.href;
        return (
          <Link
            key={tab.id}
            id={active ? tabId : `ops-tab-${tab.id}`}
            role="tab"
            aria-selected={active}
            aria-controls={panelId}
            href={href}
            className={`shrink-0 rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${
              active
                ? "border-blue-600 bg-blue-50/60 text-blue-700"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Shared Header Period control.
 * Reads dateFrom/dateTo from current URL, writes changes via replaceState.
 * Period is a GLOBAL SCOPE: affects KPI + table for the active registry.
 */
function HeaderPeriodControl() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";

  const updatePeriod = useCallback(
    (key: "dateFrom" | "dateTo", value: string) => {
      const sp = new URLSearchParams(window.location.search);
      if (value) sp.set(key, value); else sp.delete(key);
      // Preserve page=1 on period change (global scope change resets pagination).
      sp.delete("page");
      const qs = sp.toString();
      const newUrl = qs ? `${pathname}?${qs}` : pathname;
      window.history.replaceState(null, "", newUrl);
      // Trigger a shallow navigation to re-read params and refetch data.
      router.replace(newUrl, { scroll: false });
    },
    [pathname, router],
  );

  const clearPeriod = useCallback(() => {
    const sp = new URLSearchParams(window.location.search);
    sp.delete("dateFrom");
    sp.delete("dateTo");
    sp.delete("page");
    const qs = sp.toString();
    const newUrl = qs ? `${pathname}?${qs}` : pathname;
    window.history.replaceState(null, "", newUrl);
    router.replace(newUrl, { scroll: false });
  }, [pathname, router]);

  const hasPeriod = Boolean(dateFrom || dateTo);

  return (
    <div className="flex items-center gap-2 text-sm" role="group" aria-label={t("ops.period_aria", locale)}>
      <span className="text-xs font-medium text-slate-500">{t("ops.period", locale)}</span>
      <div className="flex items-center gap-1">
        <label className="sr-only" htmlFor="ops-period-from">{t("ops.period_from", locale)}</label>
        <input
          id="ops-period-from"
          type="date"
          value={dateFrom}
          onChange={(e) => updatePeriod("dateFrom", e.target.value)}
          aria-label={t("ops.period_from", locale)}
          className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        <span className="text-xs text-slate-400">—</span>
        <label className="sr-only" htmlFor="ops-period-to">{t("ops.period_to", locale)}</label>
        <input
          id="ops-period-to"
          type="date"
          value={dateTo}
          onChange={(e) => updatePeriod("dateTo", e.target.value)}
          aria-label={t("ops.period_to", locale)}
          className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </div>
      {hasPeriod && (
        <button
          type="button"
          onClick={clearPeriod}
          aria-label={t("ops.period_clear", locale)}
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default function OperationsCenterShell({
  activeDomain,
  headerActions,
  children,
}: {
  activeDomain: OperationsDomain;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const locale = useLocale();
  const user = useCurrentUser();
  const permissions = user?.permissions ?? [];
  const searchParams = useSearchParams();
  const activeTab = OPS_TABS.find((tab) => tab.id === activeDomain);
  const activeLabel = activeTab ? t(activeTab.labelKey, locale) : activeDomain;
  const tabId = `ops-tab-${activeDomain}`;
  const panelId = `ops-panel-${activeDomain}`;

  // Extract only shared period params for tab link persistence.
  const periodSp = new URLSearchParams();
  for (const key of SHARED_PERIOD_KEYS) {
    const v = searchParams.get(key);
    if (v) periodSp.set(key, v);
  }
  const periodSearchParams = periodSp.toString();

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-[1440px] px-6 pt-5">
          <nav aria-label={t("ops.breadcrumbs_aria", locale)} className="mb-2 text-xs text-slate-400">
            <Link href="/app/dashboard" className="transition-colors hover:text-slate-600">
              {t("ops.home", locale)}
            </Link>
            <span aria-hidden="true" className="mx-1.5 select-none">
              /
            </span>
            <span>{t("ops.title", locale)}</span>
            <span aria-hidden="true" className="mx-1.5 select-none">
              /
            </span>
            <span className="font-medium text-slate-600">{activeLabel}</span>
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t("ops.title", locale)}</h1>
            <div className="flex items-center gap-4">
              <HeaderPeriodControl />
              {headerActions}
            </div>
          </div>
          <OperationsCenterTabs
            activeDomain={activeDomain}
            permissions={permissions}
            tabId={tabId}
            panelId={panelId}
            periodSearchParams={periodSearchParams}
          />
        </div>
      </header>
      <main id={panelId} role="tabpanel" aria-labelledby={tabId} className="thin-scroll flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1440px] px-6 py-5">{children}</div>
      </main>
    </div>
  );
}

/* ── Shared content-slot grammar (ADR-OPS-014: shared outer geometry,
      domain-provided business content) ───────────────────────────────────── */

/** Toolbar frame — canonical placement [Search][filters][Reset][Export]. */
export function OperationsToolbarSlot({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

/** Registry table frame — consistent border/radius/overflow across domains. */
export function OperationsRegistrySlot({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{children}</div>;
}

/** Shared error frame: user-safe message + retry, no backend detail leakage. */
export function OperationsErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const locale = useLocale();
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600"
    >
      <span>{message || t("ops.error", locale)}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        >
          {t("ops.retry", locale)}
        </button>
      )}
    </div>
  );
}

/** Shared loading frame for the registry slot (skeleton, no layout jump, no fake numbers). */
export function OperationsLoadingState({ rows = 5 }: { rows?: number }) {
  const locale = useLocale();
  return (
    <div role="status" aria-busy="true" className="space-y-2 p-4">
      <span className="sr-only">{t("ops.loading", locale)}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

/** Shared empty row for the registry table (distinguishes filter results in pages that pass a message). */
export function OperationsEmptyState({ colSpan, message }: { colSpan: number; message?: string }) {
  const locale = useLocale();
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-slate-400">
        {message ?? t("ops.empty_no_data", locale)}
      </td>
    </tr>
  );
}
