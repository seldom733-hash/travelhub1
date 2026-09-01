import { api, type AuthUser } from "./api";

/**
 * PHASE 1 STEP 1.9 + 1.13 — Buyer Identity & Buyer Cabinet API contracts.
 *
 * /auth/register — публичная self-registration BUYER (role/customerId/partnerId
 * фронтенд не отправляет никогда — backend отклоняет forged поля).
 * /account/profile — own-scope профиль (identity + linked CRM Customer business
 * projection). Только разрешённые own-поля; чужой userId/role/… недоступны.
 * /account/{orders,bookings,payments,documents,support} — own-scope read-models
 * Buyer Cabinet (Step 1.13): объектный scope всегда на сервере, фронтенд не
 * передаёт customerId. Payments/Documents/Support — controlled empty до Phase 2/3.
 */

export interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface RegisterResult {
  accessToken: string;
  user: AuthUser;
}

export interface OwnCustomerProfile {
  id: string;
  code: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
}

export interface OwnProfile {
  user: {
    id: string;
    code: string;
    username: string;
    email: string | null;
    fullName: string | null;
    status: string;
    role: string;
    roleTitle: string;
    customerId: string | null;
  };
  customer: OwnCustomerProfile | null;
}

export interface UpdateOwnProfileInput {
  fullName?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

/* ── Buyer Cabinet read-models (Step 1.13) ─────────────────────────────────── */

export interface OwnOrderItem {
  id: string;
  title: string;
  productCode: string;
  quantity: number;
  price: string;
  amount: string;
  serviceDate: string | null;
}

export interface OwnOrder {
  id: string;
  code: string;
  number: string;
  status: string;
  paymentStatus: string;
  currency: string;
  amount: string;
  serviceDate: string | null;
  /** Canonical Order.createdAt (момент создания; НЕ «дата заказа» из updatedAt). */
  createdAt: string;
  items: OwnOrderItem[];
}

export interface OwnBooking {
  id: string;
  code: string;
  referenceNumber: string;
  orderId: string;
  orderCode: string;
  /** Валюта связанного Order (у Booking нет собственной) — authoritative. */
  currency: string;
  status: string;
  amount: string;
  serviceDate: string | null;
  createdAt: string;
}

/** Own-scope список с серверной пагинацией (анти-silent truncation, §8). */
export interface OwnOrdersResult {
  items: OwnOrder[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface OwnBookingsResult {
  items: OwnBooking[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Controlled empty contract для разделов без canonical domain (Phase 2/3):
 * Payments/Documents/Support. `available: false` — честный not-yet-available
 * сигнал (UI показывает neutral empty state, не выдуманные KPI).
 */
export interface BuyerEmptySection {
  items: never[];
  total: 0;
  available: false;
}

export const accountApi = {
  /** Публичная регистрация BUYER (создаёт User + CRM Customer + link). */
  register(input: RegisterInput): Promise<RegisterResult> {
    return api.post("/auth/register", input);
  },

  /** Own-scope чтение профиля (user + связанный Customer). */
  getProfile(): Promise<OwnProfile> {
    return api.get("/account/profile");
  },

  /** Own-scope обновление профиля (только разрешённые поля). */
  updateProfile(input: UpdateOwnProfileInput): Promise<OwnProfile> {
    return api.patch("/account/profile", input);
  },

  // ── Buyer Cabinet own-scope read-models (Step 1.13) ──────────────────────
  // Объектный scope всегда на сервере (actor.customerId); фронтенд никогда не
  // передаёт customerId — эти контракты принимают только own-данные.

  /** Own-scope заказы: серверная пагинация (page/pageSize, hasMore). */
  getOrders(q: { page?: number; pageSize?: number } = {}): Promise<OwnOrdersResult> {
    const sp = new URLSearchParams();
    if (q.page && q.page > 1) sp.set("page", String(q.page));
    if (q.pageSize) sp.set("pageSize", String(q.pageSize));
    const qs = sp.toString();
    return api.get(`/account/orders${qs ? `?${qs}` : ""}`);
  },

  /** Own-scope бронирования: серверная пагинация (page/pageSize, hasMore). */
  getBookings(q: { page?: number; pageSize?: number } = {}): Promise<OwnBookingsResult> {
    const sp = new URLSearchParams();
    if (q.page && q.page > 1) sp.set("page", String(q.page));
    if (q.pageSize) sp.set("pageSize", String(q.pageSize));
    const qs = sp.toString();
    return api.get(`/account/bookings${qs ? `?${qs}` : ""}`);
  },

  /** Own-scope платежи: controlled empty до Phase 2 (finance domain). */
  getPayments(): Promise<BuyerEmptySection> {
    return api.get("/account/payments");
  },

  /** Own-scope документы: controlled empty до Phase 2 (documents domain). */
  getDocuments(): Promise<BuyerEmptySection> {
    return api.get("/account/documents");
  },

  /** Own-scope поддержка: controlled empty до Phase 3 (support domain). */
  getSupport(): Promise<BuyerEmptySection> {
    return api.get("/account/support");
  },
};
