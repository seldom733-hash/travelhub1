// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PaymentsPage from "./page";
import { HttpError } from "@/lib/api";

const state = vi.hoisted(() => ({ canCreate: true }));

vi.mock("@/lib/use-can", () => ({
  useCan: (permission?: string) => (permission === "finance.payment.create" ? state.canCreate : false),
}));
vi.mock("@/lib/use-user", () => ({
  useCurrentUser: () => ({
    id: "u1",
    code: "U1",
    username: "fin",
    phone: null,
    email: null,
    fullName: null,
    role: "FINANCE",
    roleTitle: "Finance",
    partnerId: null,
    customerId: null,
    permissions: ["finance.payment.read", "finance.payment.create", "order.read", "booking.read", "documents.read"],
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/app/payments",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn() } };
});

import { api } from "@/lib/api";

const getMock = api.get as ReturnType<typeof vi.fn>;
const postMock = api.post as ReturnType<typeof vi.fn>;

const LIST = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  hasMore: false,
  aggregates: {
    total: 0,
    paymentStatus: { PENDING: 0, AUTHORIZED: 0, CAPTURED: 0, FAILED: 0, CANCELLED: 0, REFUNDED: 0 },
    refundStatus: { REQUESTED: 0, APPROVED: 0, PROCESSED: 0, FAILED: 0 },
    currency: [],
  },
};

const ORDERS = {
  items: [
    {
      id: "ord-1",
      code: "MKT-ORD-1",
      number: "0001",
      referenceNumber: "MKT-ORD-0001",
      customerId: "c1",
      status: "IN_PROCESS",
      paymentStatus: "UNPAID",
      currency: "AZN",
      amount: "1250.00",
      serviceDate: null,
      cancelledAt: null,
      version: 1,
      createdAt: "2026-10-01T10:00:00.000Z",
    },
  ],
  total: 1,
  page: 1,
  pageSize: 100,
};

/** GET /orders/:id detail — финансовый контекст (MULTI/PARTIAL: default = Осталось). */
const FINANCIALS = {
  amount: "1250.00",
  paidAmount: "0.00",
  refundedAmount: "0.00",
  dueAmount: "1250.00",
  paymentStatus: "UNPAID",
  currency: "AZN",
};

function paymentsListCalls(): number {
  return getMock.mock.calls.filter((c) => String(c[0]).startsWith("/finance/payments")).length;
}

beforeEach(() => {
  state.canCreate = true;
  getMock.mockReset();
  postMock.mockReset();
  getMock.mockImplementation((path: string) => {
    if (path.startsWith("/finance/payments")) return Promise.resolve(LIST);
    if (path === "/orders/ord-1") return Promise.resolve(FINANCIALS);
    if (path.startsWith("/orders")) return Promise.resolve(ORDERS);
    return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 20 });
  });
  postMock.mockResolvedValue({
    id: "pay-1",
    code: "PAY-00000001",
    referenceNumber: "MKT-PAY-1",
    orderId: "ord-1",
    amount: "1250.00",
    currency: "AZN",
    status: "PENDING",
    paymentMethod: "cash",
  });
});

describe("AC-1/AC-2 — кнопка в Payments registry + permission guard", () => {
  it("с finance.payment.create кнопка «+ Создать платеж» видна", async () => {
    render(<PaymentsPage />);
    await waitFor(() => expect(paymentsListCalls()).toBe(1));
    expect(screen.getByTestId("payments-create-button")).toBeTruthy();
    expect(screen.getByText("+ Создать платеж")).toBeTruthy();
  });

  it("без finance.payment.create кнопки нет (AC-2)", async () => {
    state.canCreate = false;
    render(<PaymentsPage />);
    await waitFor(() => expect(paymentsListCalls()).toBe(1));
    expect(screen.queryByTestId("payments-create-button")).toBeNull();
  });
});

describe("AC-3/AC-4/AC-8/AC-9 — form → POST → refresh registry", () => {
  it("кнопка открывает форму; POST обновляет registry (фильтры сохраняются load())", async () => {
    render(<PaymentsPage />);
    await waitFor(() => expect(paymentsListCalls()).toBe(1));

    fireEvent.click(screen.getByTestId("payments-create-button"));
    // форма открыта: order selector загружается
    await waitFor(() => expect(getMock.mock.calls.some((c) => String(c[0]).startsWith("/orders"))).toBe(true));
    const select = (await screen.findByTestId("create-payment-order-select")) as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBeGreaterThan(1));

    fireEvent.change(select, { target: { value: "ord-1" } });
    fireEvent.change(screen.getByTestId("create-payment-reason"), { target: { value: "Оплата" } });
    // financials должны загрузиться (default суммы = Осталось), иначе submit disabled
    await waitFor(() => expect((screen.getByTestId("create-payment-submit") as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId("create-payment-submit"));

    // AC-8: POST /finance/payments (MULTI/PARTIAL: amount входит в payload)
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    expect(postMock.mock.calls[0][0]).toBe("/finance/payments");
    const body = postMock.mock.calls[0][1] as Record<string, unknown>;
    expect(body).toHaveProperty("amount", "1250.00");
    expect(body).not.toHaveProperty("currency");

    // success feedback
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByText("Платёж успешно создан")).toBeTruthy();

    // AC-9: registry обновлён (вторая загрузка списка)
    await waitFor(() => expect(paymentsListCalls()).toBeGreaterThanOrEqual(2));
  });

  it("403 → «Нет прав» в форме", async () => {
    postMock.mockRejectedValue(new HttpError("Forbidden", 403));
    render(<PaymentsPage />);
    await waitFor(() => expect(paymentsListCalls()).toBe(1));
    fireEvent.click(screen.getByTestId("payments-create-button"));
    const select = (await screen.findByTestId("create-payment-order-select")) as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBeGreaterThan(1));
    fireEvent.change(select, { target: { value: "ord-1" } });
    fireEvent.change(screen.getByTestId("create-payment-reason"), { target: { value: "r" } });
    await waitFor(() => expect((screen.getByTestId("create-payment-submit") as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId("create-payment-submit"));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Нет прав");
  });
});
