const BASE = "/api/v1";

const TOKEN_KEY = "travelhub.token";
/** Cookie-зеркало токена для server-side auth boundary (middleware.ts, Step 1.6 §10). */
const AUTH_COOKIE = "travelhub.auth";

/** Подписка на изменение токена (login/logout) — для реактивных хуков. */
type TokenListener = () => void;
const tokenListeners = new Set<TokenListener>();
const notifyToken = () => tokenListeners.forEach((l) => l());

const setAuthCookie = (token: string) => {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
};

const clearAuthCookie = () => {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0`;
};

/** Реактивный стор токена: setToken/clear уведомляют подписчиков (useCurrentUser). */
export const auth = {
  get token() {
    return typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
  },
  setToken(token: string) {
    window.localStorage.setItem(TOKEN_KEY, token);
    setAuthCookie(token);
    notifyToken();
  },
  clear() {
    window.localStorage.removeItem(TOKEN_KEY);
    clearAuthCookie();
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

const headers = (extra?: Record<string, string>): Record<string, string> => {
  const h: Record<string, string> = { ...(extra ?? {}) };
  if (auth.token) h.Authorization = `Bearer ${auth.token}`;
  return h;
};

export const api = {
  get: <T>(path: string): Promise<T> => fetch(`${BASE}${path}`, { headers: headers() }).then((r) => handle<T>(r)),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => handle<T>(r)),
  patch: <T>(path: string, body: unknown): Promise<T> =>
    fetch(`${BASE}${path}`, {
      method: "PATCH",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    }).then((r) => handle<T>(r)),
  put: <T>(path: string, body: unknown): Promise<T> =>
    fetch(`${BASE}${path}`, {
      method: "PUT",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    }).then((r) => handle<T>(r)),
  del: <T>(path: string): Promise<T> => fetch(`${BASE}${path}`, { method: "DELETE", headers: headers() }).then((r) => handle<T>(r)),
};

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

export interface Order {
  id: string;
  code: string;
  number: string;
  customerId: string;
  status: string;
  paymentStatus: string;
  currency: string;
  amount: string;
  serviceDate: string | null;
  version: number;
  createdAt: string;
  items?: { id: string; title: string; productCode: string; quantity: number; price: string; amount: string }[];
  travelers?: { id: string; firstName: string; lastName: string; passportNumber: string | null; dataCompleteness: string }[];
  history?: { id: string; action: string; from: string | null; to: string | null; comment: string | null; createdAt: string }[];
}

export interface Booking {
  id: string;
  code: string;
  orderId: string;
  productId: string;
  status: string;
  amount: string;
  serviceDate: string | null;
  version: number;
  createdAt: string;
  passengers?: { id: string; firstName: string; lastName: string; passportNumber: string | null }[];
  history?: { id: string; action: string; from: string | null; to: string | null; comment: string | null; createdAt: string }[];
}
