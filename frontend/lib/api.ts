const BASE = "/api/v1";

async function handle<T>(res: Response): Promise<T> {
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

export const api = {
  get: <T>(path: string): Promise<T> => fetch(`${BASE}${path}`).then((r) => handle<T>(r)),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => handle<T>(r)),
  patch: <T>(path: string, body: unknown): Promise<T> =>
    fetch(`${BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => handle<T>(r)),
};

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
