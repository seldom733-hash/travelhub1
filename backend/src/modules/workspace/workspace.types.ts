/**
 * Global Workspace Constructor Foundation — Types & Registries
 *
 * Canonical Page Registry and Widget Registry for TravelHub.
 * Architecture authority: docs/architecture/global-workspace-constructor-phase3.md
 */

// ─── WIDGET TYPES ────────────────────────────────────────────────────

export type WidgetType =
  | "kpi-card"
  | "chart"
  | "time-series"
  | "table"
  | "status-summary"
  | "alert"
  | "funnel"
  | "list"
  | "custom";

export interface WidgetDefinition {
  /** Stable canonical ID — never display label. */
  widgetId: string;
  /** Pages this widget is compatible with. */
  pageIds: string[];
  type: WidgetType;
  category: "KPI" | "chart" | "alert" | "list" | "custom";
  title: string;
  /** Permission required to view this widget. null = no restriction. */
  permission: string | null;
  /** Section-level permission required. null = no section gate. */
  sectionPermission: string | null;
  /** Grid size constraints. */
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
  defaultW: number;
  defaultH: number;
  /** Widget behavior policy. */
  movable: boolean;
  resizable: boolean;
  removable: boolean;
  /** If true, cannot be hidden by user layout. */
  required: boolean;
  /** Canonical data source identifier (not an endpoint). */
  dataSource: string;
  /** Widget contract version. */
  version: number;
}

// ─── WIDGET POSITION (saved in user layout) ──────────────────────────

export interface WidgetPosition {
  widgetId: string;
  /** Grid position — column (0-based). */
  x: number;
  /** Grid position — row (0-based). */
  y: number;
  /** Width in grid columns. */
  w: number;
  /** Height in grid rows. */
  h: number;
  /** Whether widget is visible. */
  visible: boolean;
  /** Optional widget-specific config (validated against registry). */
  config?: Record<string, unknown>;
}

// ─── EFFECTIVE LAYOUT ────────────────────────────────────────────────

export interface EffectiveLayout {
  pageId: string;
  constructorEnabled: boolean;
  layoutVersion: number;
  widgets: WidgetPosition[];
  /** Widgets available to add (not yet in layout, user has permission). */
  availableWidgets: WidgetDefinition[];
}

// ─── PAGE REGISTRY ───────────────────────────────────────────────────

export interface PageDefinition {
  pageId: string;
  title: string;
  constructorEnabled: boolean;
  /** Widget IDs visible in default layout. */
  defaultWidgets: string[];
  /** Widget IDs that cannot be removed. */
  requiredWidgets: string[];
  /** Grid constraints. */
  minColumns: number;
  maxColumns: number;
  /** Layout schema version. */
  version: number;
  /** Optional role-specific default overrides. */
  roleDefaults?: Record<string, string[]>;
}

// ─── CANONICAL PAGE REGISTRY ─────────────────────────────────────────

export const PAGE_REGISTRY: PageDefinition[] = [
  {
    pageId: "command-center",
    title: "Command Center",
    constructorEnabled: true,
    defaultWidgets: [
      "gmv",
      "revenue",
      "net-revenue",
      "orders",
      "bookings",
      "aov",
      "conversion",
      "funnel",
      "commission",
      "reconciliation",
    ],
    requiredWidgets: ["reconciliation"],
    minColumns: 4,
    maxColumns: 12,
    version: 1,
    roleDefaults: {
      ADMIN: [
        "gmv",
        "revenue",
        "net-revenue",
        "orders",
        "bookings",
        "aov",
        "conversion",
        "funnel",
        "commission",
        "reconciliation",
        "payments",
        "net-payments",
        "sessions",
        "partners",
        "customers",
      ],
      DIRECTOR: [
        "gmv",
        "revenue",
        "net-revenue",
        "orders",
        "bookings",
        "aov",
        "conversion",
        "funnel",
        "commission",
        "reconciliation",
        "payments",
        "net-payments",
        "sessions",
        "partners",
        "customers",
      ],
      ANALYST: [
        "gmv",
        "revenue",
        "net-revenue",
        "orders",
        "bookings",
        "aov",
        "conversion",
        "funnel",
        "commission",
        "reconciliation",
        "payments",
        "net-payments",
        "sessions",
        "partners",
        "customers",
      ],
      MARKETER: [
        "gmv",
        "revenue",
        "net-revenue",
        "orders",
        "bookings",
        "aov",
        "conversion",
        "sessions",
        "partners",
        "customers",
      ],
    },
  },
  {
    pageId: "analytics",
    title: "Analytics Center",
    constructorEnabled: true,
    defaultWidgets: ["kpi-summary", "time-series", "comparison"],
    requiredWidgets: ["kpi-summary"],
    minColumns: 4,
    maxColumns: 12,
    version: 1,
  },
  {
    pageId: "crm",
    title: "CRM",
    constructorEnabled: false,
    defaultWidgets: ["customer-list", "contacts", "activities"],
    requiredWidgets: ["customer-list"],
    minColumns: 4,
    maxColumns: 8,
    version: 1,
  },
  {
    pageId: "catalog",
    title: "Catalog Center",
    constructorEnabled: false,
    defaultWidgets: ["product-list", "moderation-queue"],
    requiredWidgets: ["product-list"],
    minColumns: 4,
    maxColumns: 8,
    version: 1,
  },
  {
    pageId: "orders",
    title: "Order Center",
    constructorEnabled: false,
    defaultWidgets: ["order-list", "fulfillment"],
    requiredWidgets: ["order-list"],
    minColumns: 4,
    maxColumns: 8,
    version: 1,
  },
  {
    pageId: "bookings",
    title: "Booking Center",
    constructorEnabled: false,
    defaultWidgets: ["booking-list", "confirmations"],
    requiredWidgets: ["booking-list"],
    minColumns: 4,
    maxColumns: 8,
    version: 1,
  },
];

// ─── CANONICAL WIDGET REGISTRY ───────────────────────────────────────

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  // Executive Summary
  {
    widgetId: "gmv",
    pageIds: ["command-center"],
    type: "kpi-card",
    category: "KPI",
    title: "GMV",
    permission: "analytics.read",
    sectionPermission: "dashboard.executive.read",
    minW: 1,
    minH: 1,
    maxW: 2,
    maxH: 2,
    defaultW: 1,
    defaultH: 1,
    movable: true,
    resizable: false,
    removable: true,
    required: false,
    dataSource: "dashboard.summary.gmv",
    version: 1,
  },
  {
    widgetId: "revenue",
    pageIds: ["command-center"],
    type: "kpi-card",
    category: "KPI",
    title: "Revenue",
    permission: "analytics.read",
    sectionPermission: "dashboard.executive.read",
    minW: 1,
    minH: 1,
    maxW: 2,
    maxH: 2,
    defaultW: 1,
    defaultH: 1,
    movable: true,
    resizable: false,
    removable: true,
    required: false,
    dataSource: "dashboard.summary.revenue",
    version: 1,
  },
  {
    widgetId: "net-revenue",
    pageIds: ["command-center"],
    type: "kpi-card",
    category: "KPI",
    title: "Net Revenue",
    permission: "analytics.read",
    sectionPermission: "dashboard.executive.read",
    minW: 1,
    minH: 1,
    maxW: 2,
    maxH: 2,
    defaultW: 1,
    defaultH: 1,
    movable: true,
    resizable: false,
    removable: true,
    required: false,
    dataSource: "dashboard.summary.netRevenue",
    version: 1,
  },
  {
    widgetId: "orders",
    pageIds: ["command-center"],
    type: "kpi-card",
    category: "KPI",
    title: "Orders",
    permission: "analytics.read",
    sectionPermission: "dashboard.executive.read",
    minW: 1,
    minH: 1,
    maxW: 2,
    maxH: 2,
    defaultW: 1,
    defaultH: 1,
    movable: true,
    resizable: false,
    removable: true,
    required: false,
    dataSource: "dashboard.summary.ordersCreated",
    version: 1,
  },
  {
    widgetId: "bookings",
    pageIds: ["command-center"],
    type: "kpi-card",
    category: "KPI",
    title: "Bookings",
    permission: "analytics.read",
    sectionPermission: "dashboard.executive.read",
    minW: 1,
    minH: 1,
    maxW: 2,
    maxH: 2,
    defaultW: 1,
    defaultH: 1,
    movable: true,
    resizable: false,
    removable: true,
    required: false,
    dataSource: "dashboard.summary.bookingsRequested",
    version: 1,
  },
  {
    widgetId: "aov",
    pageIds: ["command-center"],
    type: "kpi-card",
    category: "KPI",
    title: "AOV",
    permission: "analytics.read",
    sectionPermission: "dashboard.executive.read",
    minW: 1,
    minH: 1,
    maxW: 2,
    maxH: 2,
    defaultW: 1,
    defaultH: 1,
    movable: true,
    resizable: false,
    removable: true,
    required: false,
    dataSource: "dashboard.summary.averageOrderValue",
    version: 1,
  },
  {
    widgetId: "conversion",
    pageIds: ["command-center"],
    type: "kpi-card",
    category: "KPI",
    title: "Conversion",
    permission: "analytics.read",
    sectionPermission: "dashboard.executive.read",
    minW: 1,
    minH: 1,
    maxW: 2,
    maxH: 2,
    defaultW: 1,
    defaultH: 1,
    movable: true,
    resizable: false,
    removable: true,
    required: false,
    dataSource: "dashboard.summary.conversionRate",
    version: 1,
  },
  // Charts
  {
    widgetId: "funnel",
    pageIds: ["command-center"],
    type: "funnel",
    category: "chart",
    title: "Conversion Funnel",
    permission: "analytics.read",
    sectionPermission: "dashboard.operational.read",
    minW: 2,
    minH: 2,
    maxW: 4,
    maxH: 3,
    defaultW: 3,
    defaultH: 2,
    movable: true,
    resizable: true,
    removable: true,
    required: false,
    dataSource: "dashboard.summary.funnelConversion",
    version: 1,
  },
  // Financial
  {
    widgetId: "commission",
    pageIds: ["command-center"],
    type: "kpi-card",
    category: "KPI",
    title: "Commission",
    permission: "analytics.read",
    sectionPermission: "dashboard.financial.read",
    minW: 1,
    minH: 1,
    maxW: 2,
    maxH: 2,
    defaultW: 1,
    defaultH: 1,
    movable: true,
    resizable: false,
    removable: true,
    required: false,
    dataSource: "dashboard.summary.commissionAccrued",
    version: 1,
  },
  {
    widgetId: "reconciliation",
    pageIds: ["command-center"],
    type: "alert",
    category: "alert",
    title: "Reconciliation",
    permission: "analytics.read",
    sectionPermission: "dashboard.financial.read",
    minW: 2,
    minH: 1,
    maxW: 4,
    maxH: 2,
    defaultW: 3,
    defaultH: 1,
    movable: true,
    resizable: true,
    removable: false, // required only when financial access present
    required: true,
    dataSource: "dashboard.summary.reconciliationStatus",
    version: 1,
  },
  {
    widgetId: "payments",
    pageIds: ["command-center"],
    type: "kpi-card",
    category: "KPI",
    title: "Payments",
    permission: "analytics.read",
    sectionPermission: "dashboard.financial.read",
    minW: 1,
    minH: 1,
    maxW: 2,
    maxH: 2,
    defaultW: 1,
    defaultH: 1,
    movable: true,
    resizable: false,
    removable: true,
    required: false,
    dataSource: "dashboard.summary.paymentsCaptured",
    version: 1,
  },
  {
    widgetId: "net-payments",
    pageIds: ["command-center"],
    type: "kpi-card",
    category: "KPI",
    title: "Net Payments",
    permission: "analytics.read",
    sectionPermission: "dashboard.financial.read",
    minW: 1,
    minH: 1,
    maxW: 2,
    maxH: 2,
    defaultW: 1,
    defaultH: 1,
    movable: true,
    resizable: false,
    removable: true,
    required: false,
    dataSource: "dashboard.summary.netPayments",
    version: 1,
  },
  // Marketplace
  {
    widgetId: "sessions",
    pageIds: ["command-center"],
    type: "kpi-card",
    category: "KPI",
    title: "Sessions",
    permission: "analytics.read",
    sectionPermission: "dashboard.marketplace.read",
    minW: 1,
    minH: 1,
    maxW: 2,
    maxH: 2,
    defaultW: 1,
    defaultH: 1,
    movable: true,
    resizable: false,
    removable: true,
    required: false,
    dataSource: "dashboard.summary.marketplaceSessions",
    version: 1,
  },
  {
    widgetId: "partners",
    pageIds: ["command-center"],
    type: "kpi-card",
    category: "KPI",
    title: "Partners",
    permission: "analytics.read",
    sectionPermission: "dashboard.marketplace.read",
    minW: 1,
    minH: 1,
    maxW: 2,
    maxH: 2,
    defaultW: 1,
    defaultH: 1,
    movable: true,
    resizable: false,
    removable: true,
    required: false,
    dataSource: "dashboard.summary.activePartners",
    version: 1,
  },
  {
    widgetId: "customers",
    pageIds: ["command-center"],
    type: "kpi-card",
    category: "KPI",
    title: "Customers",
    permission: "analytics.read",
    sectionPermission: "dashboard.marketplace.read",
    minW: 1,
    minH: 1,
    maxW: 2,
    maxH: 2,
    defaultW: 1,
    defaultH: 1,
    movable: true,
    resizable: false,
    removable: true,
    required: false,
    dataSource: "dashboard.summary.newCustomers",
    version: 1,
  },
  // Time Series
  {
    widgetId: "revenue-trend",
    pageIds: ["command-center"],
    type: "time-series",
    category: "chart",
    title: "Revenue Trend",
    permission: "analytics.read",
    sectionPermission: "dashboard.executive.read",
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 4,
    defaultW: 3,
    defaultH: 2,
    movable: true,
    resizable: true,
    removable: true,
    required: false,
    dataSource: "dashboard.trends.revenue",
    version: 1,
  },
  {
    widgetId: "orders-trend",
    pageIds: ["command-center"],
    type: "time-series",
    category: "chart",
    title: "Orders Trend",
    permission: "analytics.read",
    sectionPermission: "dashboard.executive.read",
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 4,
    defaultW: 3,
    defaultH: 2,
    movable: true,
    resizable: true,
    removable: true,
    required: false,
    dataSource: "dashboard.trends.orders",
    version: 1,
  },
  {
    widgetId: "bookings-trend",
    pageIds: ["command-center"],
    type: "time-series",
    category: "chart",
    title: "Bookings Trend",
    permission: "analytics.read",
    sectionPermission: "dashboard.executive.read",
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 4,
    defaultW: 3,
    defaultH: 2,
    movable: true,
    resizable: true,
    removable: true,
    required: false,
    dataSource: "dashboard.trends.bookings",
    version: 1,
  },
  // Analytics Center widgets (minimal for now)
  {
    widgetId: "kpi-summary",
    pageIds: ["analytics"],
    type: "kpi-card",
    category: "KPI",
    title: "KPI Summary",
    permission: "analytics.read",
    sectionPermission: null,
    minW: 2,
    minH: 1,
    maxW: 6,
    maxH: 2,
    defaultW: 4,
    defaultH: 1,
    movable: true,
    resizable: true,
    removable: false,
    required: true,
    dataSource: "analytics.kpi-summary",
    version: 1,
  },
  {
    widgetId: "time-series",
    pageIds: ["analytics"],
    type: "time-series",
    category: "chart",
    title: "Time Series",
    permission: "analytics.read",
    sectionPermission: null,
    minW: 2,
    minH: 2,
    maxW: 8,
    maxH: 4,
    defaultW: 6,
    defaultH: 3,
    movable: true,
    resizable: true,
    removable: true,
    required: false,
    dataSource: "analytics.time-series",
    version: 1,
  },
  {
    widgetId: "comparison",
    pageIds: ["analytics"],
    type: "chart",
    category: "chart",
    title: "Comparison",
    permission: "analytics.read",
    sectionPermission: null,
    minW: 2,
    minH: 2,
    maxW: 8,
    maxH: 4,
    defaultW: 6,
    defaultH: 3,
    movable: true,
    resizable: true,
    removable: true,
    required: false,
    dataSource: "analytics.comparison",
    version: 1,
  },
  // ─── Disabled page stubs (foundation forward-compat) ────────────────
  {
    widgetId: "customer-list",
    pageIds: ["crm"],
    type: "list",
    category: "list",
    title: "Customer List",
    permission: "crm.customer.read",
    sectionPermission: null,
    minW: 2, minH: 2, maxW: 8, maxH: 6, defaultW: 4, defaultH: 3,
    movable: false, resizable: false, removable: false, required: true,
    dataSource: "crm.customer-list", version: 1,
  },
  {
    widgetId: "contacts",
    pageIds: ["crm"],
    type: "list", category: "list", title: "Contacts",
    permission: "crm.customer.read",
    sectionPermission: null,
    minW: 2, minH: 2, maxW: 6, maxH: 4, defaultW: 3, defaultH: 2,
    movable: false, resizable: false, removable: true, required: false,
    dataSource: "crm.contacts", version: 1,
  },
  {
    widgetId: "activities",
    pageIds: ["crm"],
    type: "list", category: "list", title: "Activities",
    permission: "crm.customer.read",
    sectionPermission: null,
    minW: 2, minH: 2, maxW: 6, maxH: 4, defaultW: 3, defaultH: 2,
    movable: false, resizable: false, removable: true, required: false,
    dataSource: "crm.activities", version: 1,
  },
  {
    widgetId: "product-list",
    pageIds: ["catalog"],
    type: "list", category: "list", title: "Product List",
    permission: "catalog.product.read",
    sectionPermission: null,
    minW: 2, minH: 2, maxW: 8, maxH: 6, defaultW: 6, defaultH: 4,
    movable: false, resizable: false, removable: false, required: true,
    dataSource: "catalog.product-list", version: 1,
  },
  {
    widgetId: "moderation-queue",
    pageIds: ["catalog"],
    type: "list", category: "list", title: "Moderation Queue",
    permission: "catalog.product.read",
    sectionPermission: null,
    minW: 2, minH: 2, maxW: 6, maxH: 4, defaultW: 3, defaultH: 3,
    movable: false, resizable: false, removable: true, required: false,
    dataSource: "catalog.moderation-queue", version: 1,
  },
  {
    widgetId: "order-list",
    pageIds: ["orders"],
    type: "list", category: "list", title: "Order List",
    permission: "order.read",
    sectionPermission: null,
    minW: 2, minH: 2, maxW: 8, maxH: 6, defaultW: 6, defaultH: 4,
    movable: false, resizable: false, removable: false, required: true,
    dataSource: "order.order-list", version: 1,
  },
  {
    widgetId: "fulfillment",
    pageIds: ["orders"],
    type: "status-summary", category: "list", title: "Fulfillment",
    permission: "order.read",
    sectionPermission: null,
    minW: 2, minH: 1, maxW: 6, maxH: 3, defaultW: 3, defaultH: 2,
    movable: false, resizable: false, removable: true, required: false,
    dataSource: "order.fulfillment", version: 1,
  },
  {
    widgetId: "booking-list",
    pageIds: ["bookings"],
    type: "list", category: "list", title: "Booking List",
    permission: "booking.read",
    sectionPermission: null,
    minW: 2, minH: 2, maxW: 8, maxH: 6, defaultW: 6, defaultH: 4,
    movable: false, resizable: false, removable: false, required: true,
    dataSource: "booking.booking-list", version: 1,
  },
  {
    widgetId: "confirmations",
    pageIds: ["bookings"],
    type: "status-summary", category: "list", title: "Confirmations",
    permission: "booking.read",
    sectionPermission: null,
    minW: 2, minH: 1, maxW: 6, maxH: 3, defaultW: 3, defaultH: 2,
    movable: false, resizable: false, removable: true, required: false,
    dataSource: "booking.confirmations", version: 1,
  },
];

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────

/** Lookup a page definition by ID. Returns undefined if not found. */
export function getPageDefinition(pageId: string): PageDefinition | undefined {
  return PAGE_REGISTRY.find((p) => p.pageId === pageId);
}

/** Lookup a widget definition by ID. Returns undefined if not found. */
export function getWidgetDefinition(
  widgetId: string,
): WidgetDefinition | undefined {
  return WIDGET_REGISTRY.find((w) => w.widgetId === widgetId);
}

/** Get all widgets compatible with a page. */
export function getWidgetsForPage(pageId: string): WidgetDefinition[] {
  return WIDGET_REGISTRY.filter((w) => w.pageIds.includes(pageId));
}

/** Filter widgets by page + section permission (returns only widgets user can access). */
export function filterWidgetsByPermission(
  widgets: WidgetDefinition[],
  userPermissions: string[],
): WidgetDefinition[] {
  return widgets.filter(
    (w) =>
      (!w.permission || userPermissions.includes(w.permission)) &&
      (!w.sectionPermission || userPermissions.includes(w.sectionPermission)),
  );
}

/**
 * Build default layout positions for a page.
 * Arranges widgets in a grid, flowing left-to-right, top-to-bottom.
 */
export function buildDefaultLayout(pageId: string): WidgetPosition[] {
  const page = getPageDefinition(pageId);
  if (!page) return [];

  const widgets = getWidgetsForPage(pageId).filter((w) =>
    page.defaultWidgets.includes(w.widgetId),
  );

  const positions: WidgetPosition[] = [];
  let currentX = 0;
  let currentY = 0;
  let rowHeight = 0;

  for (const widget of widgets) {
    const w = widget.defaultW;
    const h = widget.defaultH;

    // Check if this widget fits in current row
    if (currentX + w > page.maxColumns) {
      // Move to next row
      currentX = 0;
      currentY += rowHeight;
      rowHeight = 0;
    }

    positions.push({
      widgetId: widget.widgetId,
      x: currentX,
      y: currentY,
      w,
      h,
      visible: true,
    });

    currentX += w;
    rowHeight = Math.max(rowHeight, h);
  }

  return positions;
}
