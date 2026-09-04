"use client";

/**
 * UI-C1.2A — Operations Center Shared Shell (ADR-OPS-014 canonical composition).
 *
 * One shared registry frame rendered by /app/requests, /app/orders,
 * /app/bookings and /app/payments:
 *
 *   BREADCRUMBS
 *   ЦЕНТР ОПЕРАЦИЙ                        PERIOD / ACTIONS
 *   [ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]
 *   ──────────────────────────────────────────────────
 *   ACTIVE DOMAIN CONTENT (slots provided by the domain page)
 *
 * The shell owns page geometry, header, tabs, scroll container and the
 * loading/empty/error/table slot grammar. Business content stays in the
 * domain page (shared shell ≠ identical business semantics).
 *
 * Security: tab visibility is derived from the session user's permissions,
 * but a hidden tab is NOT a security boundary — backend authorization
 * remains authoritative (route guard in Shell + @RequirePermissions).
 */
import Link from "next/link";
import { useRef } from "react";
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

function OperationsCenterTabs({
  activeDomain,
  permissions,
  tabId,
  panelId,
}: {
  activeDomain: OperationsDomain;
  permissions: string[];
  tabId: string;
  panelId: string;
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
    // Manual-activation tab pattern: arrows move focus, Enter/Space activates
    // the (native anchor) navigation.
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
        return (
          <Link
            key={tab.id}
            id={active ? tabId : `ops-tab-${tab.id}`}
            role="tab"
            aria-selected={active}
            aria-controls={panelId}
            href={tab.href}
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
  const activeTab = OPS_TABS.find((tab) => tab.id === activeDomain);
  const activeLabel = activeTab ? t(activeTab.labelKey, locale) : activeDomain;
  const tabId = `ops-tab-${activeDomain}`;
  const panelId = `ops-panel-${activeDomain}`;

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
            {headerActions}
          </div>
          <OperationsCenterTabs activeDomain={activeDomain} permissions={permissions} tabId={tabId} panelId={panelId} />
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

/** Toolbar frame — canonical placement [Search][filters][date][Reset][Export]. */
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