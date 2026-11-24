/**
 * Single source of truth for the internal workspace navigation.
 *
 * Both the sidebar and the client-side route guard consume this module:
 * adding a page to ROUTE_ACCESS without a nav item is allowed (deep links),
 * but a nav item without an access rule is a bug caught by nav-integrity.spec.
 */

export interface NavUser {
  permissions: string[];
  role?: string | null;
}

export interface NavItem {
  href: string;
  icon: string;
  labelKey: string;
  /** Any-of permissions (OR). A single string is kept for compatibility. */
  permissions?: string[];
  /** Optional role allow-list for sections backed by a role-gated API. */
  roles?: string[];
  /** Hub entries are active only on the exact path, never on children. */
  exact?: boolean;
}

export interface NavGroup {
  headingKey?: string;
  items: NavItem[];
}

export interface RouteAccess {
  prefix: string;
  permissions?: string[];
  roles?: string[];
  /** Intentionally public inside the authenticated workspace. */
  allow?: boolean;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/app/dashboard", icon: "🏠", labelKey: "nav.dashboard" },
      { href: "/app/command-center", icon: "📊", labelKey: "nav.command_center", permissions: ["analytics.read"] },
      { href: "/app/analytics/sales", icon: "📉", labelKey: "nav.sales_analytics", permissions: ["sales.kpi.read"] },
    ],
  },
  {
    headingKey: "nav.group.operations",
    items: [
      { href: "/app/requests/create", icon: "➕", labelKey: "nav.request_create", permissions: ["order.edit_noncritical"] },
      { href: "/app/finance/deals", icon: "🗂️", labelKey: "nav.finance_deals", permissions: ["finance.overview.read"] },
    ],
  },
  {
    headingKey: "nav.group.finance",
    items: [
      { href: "/app/finance/overview", icon: "📈", labelKey: "nav.finance_overview", permissions: ["finance.overview.read"] },
      { href: "/app/payments", icon: "💳", labelKey: "nav.payments", permissions: ["finance.payment.read"] },
      { href: "/app/finance/obligations", icon: "🧾", labelKey: "nav.supplier_obligations", permissions: ["finance.obligation.read"] },
      { href: "/app/finance/ledger", icon: "📒", labelKey: "nav.ledger", permissions: ["finance.ledger.read"] },
      { href: "/app/finance/payment-terms", icon: "⏱️", labelKey: "nav.payment_terms", permissions: ["finance.obligation.read"], roles: ["FINANCE", "ADMIN", "DIRECTOR"] },
      { href: "/app/pricing/markup", icon: "％", labelKey: "nav.markup_matrix", permissions: ["pricing.markup.read"] },
      { href: "/app/finance/fx-rates", icon: "💱", labelKey: "nav.fx_rates", permissions: ["finance.fx_rate.read"] },
    ],
  },
  {
    headingKey: "nav.group.commercial",
    items: [
      { href: "/app/catalog", icon: "📚", labelKey: "nav.catalog", permissions: ["catalog.product.read"] },
      { href: "/app/crm", icon: "🤝", labelKey: "nav.crm", permissions: ["crm.customer.read", "crm.partner.read"] },
      { href: "/app/sales/assignment", icon: "🧭", labelKey: "nav.assignment", permissions: ["request.assignment.read"] },
      { href: "/app/my-status", icon: "🟢", labelKey: "nav.my_status", permissions: ["request.load.read"] },
      { href: "/app/bonuses", icon: "🎁", labelKey: "nav.manager_bonuses", permissions: ["finance.bonus.read"] },
      { href: "/app/marketing", icon: "📣", labelKey: "nav.marketing", permissions: ["marketing.campaign.read"] },
    ],
  },
  {
    headingKey: "nav.group.partner_network",
    items: [
      { href: "/app/partners/onboarding", icon: "🧑‍💼", labelKey: "nav.partner_onboarding", permissions: ["partner.onboarding.review"] },
      { href: "/app/seller-profiles", icon: "🏷️", labelKey: "nav.seller_profiles", permissions: ["seller_public_profile.review"] },
    ],
  },
  {
    headingKey: "nav.group.supplier_updates",
    items: [
      { href: "/app/supplier-updates", icon: "🔄", labelKey: "nav.supplier_updates", permissions: ["supplier.search.manage"] },
    ],
  },
  {
    headingKey: "nav.group.references",
    items: [
      { href: "/app/references", icon: "🗂️", labelKey: "nav.references_hub", permissions: ["geography.read", "hotel_directory.read", "crm.customer.read", "crm.partner.read"], exact: true },
    ],
  },
  {
    headingKey: "nav.group.service",
    items: [
      { href: "/app/support", icon: "🎫", labelKey: "nav.support", permissions: ["support.case.read"] },
      { href: "/app/whatsapp", icon: "💬", labelKey: "nav.whatsapp", permissions: ["whatsapp.read"] },
      { href: "/app/help", icon: "❓", labelKey: "nav.help", permissions: [] },
    ],
  },
  {
    headingKey: "nav.group.admin",
    items: [
      { href: "/app/users", icon: "👥", labelKey: "nav.users", permissions: ["settings.write"] },
    ],
  },
  {
    headingKey: "nav.group.settings",
    items: [
      { href: "/app/page-builder", icon: "🔧", labelKey: "nav.constructor", permissions: ["settings.write"] },
      { href: "/app/settings/integrations/whatsapp", icon: "🔌", labelKey: "nav.integrations", permissions: ["whatsapp.read"] },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export const NAV_BY_HREF: Record<string, NavItem> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.href, item]),
);

/**
 * Explicit client-side route access. The backend remains authoritative; this
 * table only prevents a menu item from opening a page that immediately 403s.
 * Unknown /app/* paths stay open (fail-open) so a table typo cannot lock users
 * out of a working page.
 */
export const ROUTE_ACCESS: RouteAccess[] = [
  { prefix: "/app", allow: true, permissions: [] },
  { prefix: "/app/dashboard", allow: true },
  { prefix: "/app/command-center", permissions: ["analytics.read"] },
  { prefix: "/app/analytics/sales", permissions: ["sales.kpi.read"] },
  { prefix: "/app/analytics", permissions: ["sales.kpi.read"] },
  { prefix: "/app/requests/create", permissions: ["order.edit_noncritical"] },
  { prefix: "/app/requests", permissions: ["order.read"] },
  { prefix: "/app/orders", permissions: ["order.read"] },
  { prefix: "/app/bookings", permissions: ["booking.read"] },
  { prefix: "/app/documents", permissions: ["documents.read"] },
  { prefix: "/app/finance/deals", permissions: ["finance.overview.read"] },
  { prefix: "/app/finance/overview", permissions: ["finance.overview.read"] },
  { prefix: "/app/payments", permissions: ["finance.payment.read"] },
  { prefix: "/app/finance/payments", permissions: ["finance.payment.read"] },
  { prefix: "/app/finance/obligations", permissions: ["finance.obligation.read"] },
  { prefix: "/app/finance/reports", permissions: ["finance.obligation.read"] },
  { prefix: "/app/finance/refunds", permissions: ["finance.refund.read"] },
  { prefix: "/app/finance/ledger", permissions: ["finance.ledger.read"] },
  { prefix: "/app/finance/supplier-payments", permissions: ["finance.supplier_payout.read"] },
  { prefix: "/app/finance/payment-terms", permissions: ["finance.obligation.read"], roles: ["FINANCE", "ADMIN", "DIRECTOR"] },
  { prefix: "/app/finance/fx-rates", permissions: ["finance.fx_rate.read"] },
  { prefix: "/app/pricing/markup", permissions: ["pricing.markup.read"] },
  { prefix: "/app/catalog", permissions: ["catalog.product.read"] },
  { prefix: "/app/crm/customers", permissions: ["crm.customer.read"] },
  { prefix: "/app/crm/partners", permissions: ["crm.partner.read"] },
  { prefix: "/app/crm", permissions: ["crm.customer.read", "crm.partner.read"] },
  { prefix: "/app/sales/assignment", permissions: ["request.assignment.read"] },
  { prefix: "/app/my-status", permissions: ["request.load.read"] },
  { prefix: "/app/bonuses", permissions: ["finance.bonus.read"] },
  { prefix: "/app/marketing", permissions: ["marketing.campaign.read"] },
  { prefix: "/app/partners/onboarding", permissions: ["partner.onboarding.review"] },
  { prefix: "/app/seller-profiles", permissions: ["seller_public_profile.review"] },
  { prefix: "/app/supplier-updates", permissions: ["supplier.search.manage"] },
  { prefix: "/app/references", permissions: ["geography.read", "hotel_directory.read", "crm.customer.read", "crm.partner.read"] },
  { prefix: "/app/support", permissions: ["support.case.read"] },
  { prefix: "/app/whatsapp", permissions: ["whatsapp.read"] },
  { prefix: "/app/help", allow: true },
  { prefix: "/app/users/roles", permissions: ["settings.write"] },
  { prefix: "/app/users", permissions: ["settings.write"] },
  { prefix: "/app/page-builder", permissions: ["settings.write"] },
  { prefix: "/app/settings/integrations/whatsapp", permissions: ["whatsapp.read"] },
];

const ACCESS_BY_LENGTH = [...ROUTE_ACCESS].sort((a, b) => b.prefix.length - a.prefix.length);

/** Any-of permission check, plus optional primary-role allow-list. */
export function canAccess(user: NavUser | null, item: Pick<NavItem, "permissions" | "roles">): boolean {
  if (!user) return false;
  if (item.roles?.length && (!user.role || !item.roles.includes(user.role))) return false;
  if (!item.permissions || item.permissions.length === 0) return true;
  return item.permissions.some((permission) => user.permissions.includes(permission));
}

/** Longest matching access rule for a pathname. */
export function matchRoute(pathname: string): RouteAccess | null {
  return ACCESS_BY_LENGTH.find(
    (rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`),
  ) ?? null;
}

export function isRouteAllowed(pathname: string, user: NavUser | null): boolean {
  const rule = matchRoute(pathname);
  if (!rule || rule.allow) return true;
  return canAccess(user, { permissions: rule.permissions, roles: rule.roles });
}

/** True when a nav item owns the current pathname. */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/app/dashboard") return pathname === "/app" || pathname === "/app/dashboard";
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function activeGroupKey(pathname: string): string | undefined {
  return NAV_GROUPS.find((group) => group.headingKey && group.items.some((item) => isNavActive(item, pathname)))
    ?.headingKey;
}
