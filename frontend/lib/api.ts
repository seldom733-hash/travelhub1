const BASE = "/api/v1";

/**
 * Step 2.17 — Auth hardening: сессионный credential НЕ хранится в JS-readable
 * сторадже (localStorage/document.cookie). Токен живёт в серверной HttpOnly
 * cookie `travelhub.auth` (Secure в prod, SameSite=Lax), которую JS не может
 * прочитать. Здесь — ТОЛЬКО in-memory «флаг сессии» для реактивного UI:
 * ставится при login/register-ответе, снимается при logout/401. Настоящая
 * аутентификация — cookie (credentials: "include"), истина — GET /auth/session.
 *
 * In-memory токен (если он есть, напр. в тестах/SSR-прокси) отправляется как
 * Authorization: Bearer — backend guard читает И header, И cookie (Step 2.17).
 */

/** Подписка на изменение сессии (login/logout) — для реактивных хуков. */
type TokenListener = () => void;
const tokenListeners = new Set<TokenListener>();
const notifyToken = () => tokenListeners.forEach((l) => l());

let memoryToken: string | null = null;

/** Реактивный стор сессии: setToken/clear уведомляют подписчиков (useCurrentUser). */
export const auth = {
  get token() {
    return memoryToken;
  },
  setToken(token: string) {
    memoryToken = token;
    notifyToken();
  },
  clear() {
    memoryToken = null;
    notifyToken();
  },
  subscribe(listener: TokenListener): () => void {
    tokenListeners.add(listener);
    return () => tokenListeners.delete(listener);
  },
};

export interface AuthUser {
  id: string;
  code: string;
  username: string;
  email: string | null;
  fullName: string | null;
  role: string;
  roleTitle: string;
  /** Step 1.10: объектный scope PARTNER (null = pending onboarding / legacy без link). */
  partnerId: string | null;
  customerId: string | null;
  permissions: string[];
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401 && !res.url.includes("/auth/login")) {
    auth.clear();
    if (typeof window !== "undefined") {
      // Сохраняем deep-link в ?next=, чтобы после повторного входа вернуться (review).
      const here = window.location.pathname + window.location.search;
      window.location.href = `/login?next=${encodeURIComponent(here)}`;
    }
    throw new Error("Session expired");
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/**
 * Step 2.17: credentials "include" — HttpOnly cookie летит с каждым запросом.
 * Authorization добавляется ТОЛЬКО если есть in-memory токен (тесты/прокси).
 */
const fetchOptions = (extra?: Record<string, string>): RequestInit => {
  const h: Record<string, string> = { ...(extra ?? {}) };
  if (auth.token) h.Authorization = `Bearer ${auth.token}`;
  return { headers: h, credentials: "include" };
};

export const api = {
  get: <T>(path: string): Promise<T> => fetch(`${BASE}${path}`, fetchOptions()).then((r) => handle<T>(r)),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    fetch(`${BASE}${path}`, {
      ...fetchOptions({ "Content-Type": "application/json" }),
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => handle<T>(r)),
  patch: <T>(path: string, body: unknown): Promise<T> =>
    fetch(`${BASE}${path}`, {
      ...fetchOptions({ "Content-Type": "application/json" }),
      method: "PATCH",
      body: JSON.stringify(body),
    }).then((r) => handle<T>(r)),
  put: <T>(path: string, body: unknown): Promise<T> =>
    fetch(`${BASE}${path}`, {
      ...fetchOptions({ "Content-Type": "application/json" }),
      method: "PUT",
      body: JSON.stringify(body),
    }).then((r) => handle<T>(r)),
  del: <T>(path: string): Promise<T> =>
    fetch(`${BASE}${path}`, { ...fetchOptions(), method: "DELETE" }).then((r) => handle<T>(r)),
};

/** Публичная сессионная проба (GET /auth/session) — cookie-аутентификация. */
export async function fetchSessionUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${BASE}/auth/session`, fetchOptions());
    if (!res.ok) return null;
    const body = (await res.json()) as { user: AuthUser | null };
    return body.user ?? null;
  } catch {
    return null;
  }
}

export interface PlatformUser {
  id: string;
  code: string;
  username: string;
  email: string | null;
  fullName: string | null;
  status: string;
  role: { code: string; title: string };
  partnerId: string | null;
  customerId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  aggregates?: Record<string, number>;
}

export interface Product {
  id: string;
  code: string;
  type: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  version: number;
  publishedAt: string | null;
  createdAt: string;
  tariffs?: { id: string; code: string; name: string; price: number; currency: string }[];
  history?: { id: string; action: string; from: string | null; to: string | null; comment: string | null; createdAt: string }[];
  passengers?: unknown[];
}

export interface Customer {
  id: string;
  code: string;
  type: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
}

export interface CustomerDetail extends Customer {
  contacts: { id: string; code: string; name: string; email: string | null; phone: string | null; role: string | null }[];
  history: { id: string; action: string; from: string | null; to: string | null; comment: string | null; createdAt: string }[];
  partnerRelations: PartnerCustomerRelation[];
  orders: { id: string; code: string; number: string; status: string; paymentStatus: string; amount: string; paidAmount: string; currency: string; createdAt: string }[];
  bookings: { id: string; code: string; status: string; amount: string; currency: string; orderId: string; productId: string; createdAt: string }[];
  payments: { id: string; code: string; status: string; amount: string; currency: string; orderId: string; paymentMethod: string | null; orderCode: string | null; orderNumber: string | null; createdAt: string; paidAt: string | null }[];
  refunds: { id: string; code: string; amount: string; currency: string; status: string; reason: string | null; paymentId: string; orderId: string; paymentCode: string | null; orderCode: string | null; orderNumber: string | null; createdAt: string; processedAt: string | null }[];
  summary: { totalOrders: number; totalBookings: number; totalPayments: number; totalRefunds: number };
}

export interface CustomerPartner {
  partnerId: string;
  partnerCode: string | null;
  partnerName: string;
  partnerStatus: string | null;
  orderCount: number;
  totalBookings: number;
  totalAmount: number;
  currency: string;
  lastActivity: string;
  lifecycle: string | null;
  leadSource: string | null;
  assignedTo: string | null;
}

export interface Partner {
  id: string;
  code: string;
  name: string;
  status: string;
  countryCode: string | null;
  contactEmail: string | null;
  registrationNumber: string | null;
  createdAt: string;
}

export interface PartnerDetail extends Partner {
  customerRelations: PartnerCustomerRelation[];
  products: { id: string; code: string; title: string; type: string; status: string; slug: string; createdAt: string }[];
  totalProducts: number;
  orders: { id: string; code: string; number: string; status: string; paymentStatus: string; amount: string; currency: string; customerId: string | null; createdAt: string }[];
  totalOrders: number;
  bookings: { id: string; code: string; status: string; amount: string; currency: string; orderId: string; createdAt: string }[];
  totalBookings: number;
  totalCustomers: number;
  commercialCustomers: { customerId: string; customerCode: string | null; firstName: string | null; lastName: string | null; companyName: string | null; email: string | null; customerStatus: string | null; orderCount: number; bookingCount: number; totalAmount: number; currency: string; lastActivity: string; lifecycle: string | null; leadSource: string | null; assignedTo: string | null }[];
  storefront: { id: string; code: string; slug: string; status: string; entitlementStatus: string; businessName: string | null; tagline: string | null; defaultLocale: string; countryCode: string | null; cityCode: string | null } | null;
}

export interface PartnerCustomerRelation {
  id: string;
  partnerId: string;
  customerId: string;
  status: string;
  leadSource: string | null;
  assignedTo: string | null;
  lifecycle: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
  customer?: Customer;
  partner?: Partner;
}

// Step 3.5C — Three-Context CRM
export interface PartnerCustomer {
  id: string;
  code: string;
  type: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
  _relation?: {
    id: string;
    lifecycle: string | null;
    leadSource: string | null;
    tags: string[];
    notes: string | null;
    assignedTo: string | null;
  };
}

export interface PartnerCustomerDetail extends PartnerCustomer {
  orders: { id: string; code: string; number: string; status: string; paymentStatus: string; amount: string; paidAmount: string; currency: string; createdAt: string }[];
  bookings: { id: string; code: string; status: string; amount: string; currency: string; createdAt: string }[];
  payments: { id: string; code: string; status: string; amount: string; currency: string; createdAt: string }[];
  summary: { totalOrders: number; totalBookings: number; totalPayments: number };
  _tier: "BASIC" | "PRO";
}

export interface CrmTierResponse {
  tier: "BASIC" | "PRO";
}

export interface PartnerIntakeResult {
  customerId: string;
  relationId: string;
  customerCreated: boolean;
  relationCreated: boolean;
  tier: "BASIC" | "PRO";
}

export interface Order {
  id: string;
  code: string;
  number: string;
  referenceNumber: string;
  customerId: string;
  status: string;
  paymentStatus: string;
  currency: string;
  amount: string;
  serviceDate: string | null;
  cancelledAt: string | null;
  version: number;
  createdAt: string;
  items?: { id: string; title: string; productCode: string; quantity: number; price: string; amount: string }[];
  travelers?: { id: string; firstName: string; lastName: string; passportNumber: string | null; dataCompleteness: string }[];
  history?: { id: string; action: string; from: string | null; to: string | null; comment: string | null; createdAt: string }[];
}

export interface Booking {
  id: string;
  code: string;
  referenceNumber: string;
  orderId: string;
  productId: string;
  status: string;
  amount: string;
  currency?: string;
  serviceDate: string | null;
  version: number;
  createdAt: string;
  passengers?: { id: string; firstName: string; lastName: string; passportNumber: string | null }[];
  history?: { id: string; action: string; from: string | null; to: string | null; comment: string | null; createdAt: string }[];
}

// ── Operational Notes (Phase 3 Step 3.5 Round 2C) ───────────────────────

export interface OperationalNote {
  id: string;
  entityType: string;
  entityId: string;
  text: string;
  visibility: string;
  authorUserId: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
}

export interface OperationalNotesPage {
  notes: OperationalNote[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── CRM Activity (Phase 3 Step 3.5.3 Round 2C) ─────────────────────────

export interface ActivityItem {
  id: string;
  sourceType: string;
  sourceId: string;
  activityType: string;
  occurredAt: string;
  actor: { userId: string; name: string | null } | null;
  title: string;
  summary: string | null;
  deepLink: string | null;
}

export interface ActivityPage {
  items: ActivityItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ── CRM Analytics (Phase 3 Step 3.5E / Step 3.6) ─────────────────────

export interface CrmAnalyticsMetrics {
  totalCustomers: number;
  totalRelationships: number;
  lifecycleBreakdown: Record<string, number> | null;
  sourceBreakdown: Record<string, number> | null;
  managerBreakdown: Record<string, number> | null;
  newRelationships: number;
  newBySource: Record<string, number> | null;
  commerciallyActiveCustomers: number;
}

export interface CrmAnalyticsResponse {
  period?: { start: string; endExclusive: string; timezone: string; preset: string };
  scope?: { partnerId: string | null; label: string };
  metrics: CrmAnalyticsMetrics;
}

export type CrmAnalyticsPreset = 'TODAY' | 'LAST_3_DAYS' | 'LAST_7_DAYS' | 'MONTH' | 'LAST_6_MONTHS' | 'YEAR' | 'CUSTOM';

export const crmAnalyticsApi = {
  getCrmAnalytics: (opts?: { preset?: CrmAnalyticsPreset; startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    sp.set('preset', opts?.preset ?? 'LAST_6_MONTHS');
    if (opts?.startDate) sp.set('startDate', opts.startDate);
    if (opts?.endDate) sp.set('endDate', opts.endDate);
    return api.get<CrmAnalyticsResponse>(`/analytics/crm?${sp.toString()}`);
  },
};

// ── Platform Analytics Engine (Step 3.3 / Pre-3.12 IA Separation) ─────

export type AnalyticsPreset = 'TODAY' | 'LAST_3_DAYS' | 'LAST_7_DAYS' | 'MONTH' | 'LAST_6_MONTHS' | 'YEAR' | 'CUSTOM';

interface ComparisonValue<T> {
  current: T;
  previous?: T;
  changePercent?: number;
}

export interface CompanyKpiResponse {
  period: { start: string; endExclusive: string; timezone: string; preset: string };
  comparison?: { start: string; endExclusive: string };
  metrics: {
    gmv: ComparisonValue<string>;
    revenue: ComparisonValue<string>;
    netRevenue: ComparisonValue<string>;
    commissionAccrued: ComparisonValue<string>;
    ordersCreated: ComparisonValue<number>;
    ordersFulfilled: ComparisonValue<number>;
    bookingsRequested: ComparisonValue<number>;
    bookingsConfirmed: ComparisonValue<number>;
    bookingsCompleted: ComparisonValue<number>;
    paymentsCaptured: ComparisonValue<number>;
    refundsProcessed: ComparisonValue<number>;
    marketplaceSessions: ComparisonValue<number>;
    storefrontSessions: ComparisonValue<number>;
    marketplaceVisitors: ComparisonValue<number>;
    marketplaceVisits: ComparisonValue<number>;
    marketplacePartners: ComparisonValue<number>;
    storefrontPartners: ComparisonValue<number>;
    totalActivePartners: ComparisonValue<number>;
    marketplaceCustomers: ComparisonValue<number>;
    storefrontCustomers: ComparisonValue<number>;
    totalActiveCustomers: ComparisonValue<number>;
    averageOrderValue: ComparisonValue<string>;
    refunds: ComparisonValue<string>;
    refundsCurrency: string;
    gmvCurrency: string;
    revenueCurrency: string;
    commissionCurrency: string;
    qualifiedGmv: ComparisonValue<string>;
    completedGmv: ComparisonValue<string>;
    collectedGmv: ComparisonValue<string>;
    outstandingGmv: ComparisonValue<string>;
  };
}

export interface ConversionFunnelResponse {
  period: { start: string; endExclusive: string; timezone: string; preset: string };
  stages: Array<{ stage: string; count: number; uniqueEntities?: number }>;
}

export interface TimeSeriesResponse {
  period: { start: string; endExclusive: string; timezone: string; preset: string };
  granularity: string;
  buckets: Array<{ label: string; start: string; endExclusive: string; value: number }>;
}

export interface PartnerPerformanceResponse {
  period: { start: string; endExclusive: string; timezone: string; preset: string };
  partners: Array<{
    partnerId: string; partnerName: string; gmv: string; revenue: string;
    commission: string; ordersCount: number; bookingsCount: number;
    activeProducts: number; bookingCompletionRate: number | null;
  }>;
}

export interface FinancialReconciliationResponse {
  period: { start: string; endExclusive: string; timezone: string; preset: string };
  currencies: Array<{
    currency: string; paymentCount: number; totalPayments: string; totalRefunds: string;
    netPayments: string; totalCommission: string;
  }>;
  totalLedgerEntries: number;
}

export const analyticsApi = {
  getCompanyKpi: (opts?: { preset?: AnalyticsPreset; startDate?: string; endDate?: string; comparison?: boolean; acquisitionSource?: string }) => {
    const sp = new URLSearchParams();
    sp.set('preset', opts?.preset ?? 'MONTH');
    if (opts?.startDate) sp.set('startDate', opts.startDate);
    if (opts?.endDate) sp.set('endDate', opts.endDate);
    if (opts?.comparison === false) sp.set('comparison', 'false');
    if (opts?.acquisitionSource) sp.set('acquisitionSource', opts.acquisitionSource);
    return api.get<CompanyKpiResponse>(`/analytics/company-kpi?${sp.toString()}`);
  },
  getConversionFunnel: (opts?: { preset?: AnalyticsPreset; startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    sp.set('preset', opts?.preset ?? 'MONTH');
    if (opts?.startDate) sp.set('startDate', opts.startDate);
    if (opts?.endDate) sp.set('endDate', opts.endDate);
    return api.get<ConversionFunnelResponse>(`/analytics/conversion-funnel?${sp.toString()}`);
  },
  getTimeSeries: (opts?: { preset?: AnalyticsPreset; startDate?: string; endDate?: string; metric?: string }) => {
    const sp = new URLSearchParams();
    sp.set('preset', opts?.preset ?? 'MONTH');
    if (opts?.startDate) sp.set('startDate', opts.startDate);
    if (opts?.endDate) sp.set('endDate', opts.endDate);
    if (opts?.metric) sp.set('metric', opts.metric);
    return api.get<TimeSeriesResponse>(`/analytics/time-series?${sp.toString()}`);
  },
  getPartnerPerformance: (opts?: { preset?: AnalyticsPreset; startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    sp.set('preset', opts?.preset ?? 'MONTH');
    if (opts?.startDate) sp.set('startDate', opts.startDate);
    if (opts?.endDate) sp.set('endDate', opts.endDate);
    return api.get<PartnerPerformanceResponse>(`/analytics/partner-performance?${sp.toString()}`);
  },
  getFinancialReconciliation: (opts?: { preset?: AnalyticsPreset; startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    sp.set('preset', opts?.preset ?? 'MONTH');
    if (opts?.startDate) sp.set('startDate', opts.startDate);
    if (opts?.endDate) sp.set('endDate', opts.endDate);
    return api.get<FinancialReconciliationResponse>(`/analytics/financial-reconciliation?${sp.toString()}`);
  },
};

export const activityApi = {
  listCustomer: (
    customerId: string,
    opts?: {
      sourceType?: string;
      activityType?: string;
      dateFrom?: string;
      dateTo?: string;
      cursor?: string;
      limit?: number;
    },
  ) => {
    const sp = new URLSearchParams();
    if (opts?.sourceType) sp.set('sourceType', opts.sourceType);
    if (opts?.activityType) sp.set('activityType', opts.activityType);
    if (opts?.dateFrom) sp.set('dateFrom', opts.dateFrom);
    if (opts?.dateTo) sp.set('dateTo', opts.dateTo);
    if (opts?.cursor) sp.set('cursor', opts.cursor);
    if (opts?.limit) sp.set('limit', String(opts.limit));
    const qs = sp.toString();
    return api.get<ActivityPage>(`/customers/${customerId}/activity${qs ? '?' + qs : ''}`);
  },
  listPartner: (
    partnerId: string,
    opts?: {
      sourceType?: string;
      activityType?: string;
      dateFrom?: string;
      dateTo?: string;
      cursor?: string;
      limit?: number;
    },
  ) => {
    const sp = new URLSearchParams();
    if (opts?.sourceType) sp.set('sourceType', opts.sourceType);
    if (opts?.activityType) sp.set('activityType', opts.activityType);
    if (opts?.dateFrom) sp.set('dateFrom', opts.dateFrom);
    if (opts?.dateTo) sp.set('dateTo', opts.dateTo);
    if (opts?.cursor) sp.set('cursor', opts.cursor);
    if (opts?.limit) sp.set('limit', String(opts.limit));
    const qs = sp.toString();
    return api.get<ActivityPage>(`/partners/${partnerId}/activity${qs ? '?' + qs : ''}`);
  },
};

export const operationalNotesApi = {
  list: (entityType: string, entityId: string, page?: number, pageSize?: number) => {
    const params = new URLSearchParams();
    if (page) params.set('page', String(page));
    if (pageSize) params.set('pageSize', String(pageSize));
    const qs = params.toString();
    return api.get<OperationalNotesPage>(`/operational-notes/${entityType}/${entityId}${qs ? '?' + qs : ''}`);
  },
  create: (entityType: string, entityId: string, text: string) =>
    api.post<OperationalNote>(`/operational-notes/${entityType}/${entityId}`, { text }),
  update: (noteId: string, text: string) =>
    api.patch<OperationalNote>(`/operational-notes/${noteId}`, { text }),
  delete: (noteId: string) =>
    api.del<void>(`/operational-notes/${noteId}`),
};
