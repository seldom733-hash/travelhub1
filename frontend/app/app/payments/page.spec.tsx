// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PaymentsPage from "./page";

vi.mock("@/lib/use-user", () => ({
  useCurrentUser: () => ({
    id: "u1", code: "U1", username: "fin", phone: null, email: null, fullName: null,
    role: "FINANCE", roleTitle: "Finance", partnerId: null, customerId: null,
    permissions: ["finance.payment.read", "finance.refund.read", "finance.supplier_payout.read"],
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

beforeEach(() => {
  getMock.mockReset();
  getMock.mockImplementation((path: string) => {
    if (path.startsWith("/finance/payments")) {
      return Promise.resolve({
        items: [{
          id: "pay-1", code: "PAY-1", referenceNumber: "MKT-PAY-00000001", orderId: "ord-1",
          orderReference: "MKT-ORD-00000001", amount: "500", currency: "AZN",
          paymentMethod: "cash", status: "CAPTURED", acceptedBy: "Финанс", paidAt: "2026-11-12T10:00:00.000Z",
          createdAt: "2026-11-12T09:00:00.000Z",
        }],
      });
    }
    if (path.startsWith("/finance/refunds")) {
      return Promise.resolve({
        items: [{
          id: "ref-1", code: "RFD-1", referenceNumber: "MKT-REF-00000001", orderId: "ord-1",
          orderCode: "MKT-ORD-00000001", dealNumber: "00000001", amount: "100", currency: "AZN",
          status: "REQUESTED", processedAt: null, createdAt: "2026-11-12T11:00:00.000Z",
        }],
      });
    }
    if (path.startsWith("/finance/supplier-payments")) {
      return Promise.resolve({
        items: [{
          id: "spo-1", code: "SPO-00000001", orderId: "ord-1", orderCode: "MKT-ORD-00000001",
          direction: "OUTGOING", amount: "300", currency: "AZN", method: "bank",
          status: "CONFIRMED", confirmedBy: "Finance", occurredAt: "2026-11-12T12:00:00.000Z",
          createdAt: "2026-11-12T11:30:00.000Z",
        }],
      });
    }
    return Promise.resolve({ items: [] });
  });
});

describe("Payments and refunds page", () => {
  it("shows client payments and refunds, and has no create-payment button", async () => {
    render(<PaymentsPage />);
    await waitFor(() => expect(screen.getByText("MKT-PAY-00000001")).toBeTruthy());
    expect(screen.getByText("MKT-REF-00000001")).toBeTruthy();
    expect(screen.queryByTestId("payments-create-button")).toBeNull();
    expect(screen.getByText("Платежи и возвраты (клиенты)")).toBeTruthy();
    expect(screen.getByText("Платежи и возвраты (поставщики)")).toBeTruthy();
  });

  it("switches to supplier payments and refunds", async () => {
    render(<PaymentsPage />);
    fireEvent.click(screen.getByTestId("payments-tab-suppliers"));
    await waitFor(() => expect(screen.getByText("SPO-00000001")).toBeTruthy());
    expect(screen.getByText("Finance")).toBeTruthy();
    expect(screen.getByText("Подтверждён")).toBeTruthy();
  });
});
