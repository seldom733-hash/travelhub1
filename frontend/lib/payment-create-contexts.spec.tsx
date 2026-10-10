// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Payment create — контексты Order/Booking detail и сохранение Analytics
 * navigation (prompt §4/§5/§6/§10). Source-контракт-проверки (конвенция
 * проекта: payments-registry.spec / operations-center-shell.spec).
 */

const ROOT = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
}

const ORDER_PAGE = read("app/app/orders/[id]/page.tsx");
const BOOKING_PAGE = read("app/app/bookings/[id]/page.tsx");
const METRIC_DRILLDOWN = read("lib/metric-drilldown.ts");
const SECTION_GRID = read("components/command-center/SectionGrid.tsx");
const ANALYTICS_PAGE = read("app/app/analytics/page.tsx");
const PAYMENTS_PAGE = read("app/app/payments/page.tsx");

describe("AC-10 — Order detail: + Создать платеж с текущим Order", () => {
  it("кнопка присутствует и гейтится finance.payment.create", () => {
    expect(ORDER_PAGE).toContain('data-testid="order-create-payment-button"');
    expect(ORDER_PAGE).toContain('useCan("finance.payment.create")');
    expect(ORDER_PAGE).toContain("{canCreatePayment && (");
  });

  it("presetOrder = текущий Order (нельзя случайно заменить)", () => {
    expect(ORDER_PAGE).toContain("id: order.id,");
    expect(ORDER_PAGE).toContain("label: order.referenceNumber,");
    expect(ORDER_PAGE).toContain("amount: order.amount,");
    expect(ORDER_PAGE).toContain("currency: order.currency,");
    expect(ORDER_PAGE).toContain("presetOrder={{");
  });

  it("после создания обновляет финансовую историю и данные Order", () => {
    expect(ORDER_PAGE).toContain("onCreated={handlePaymentCreated}");
    expect(ORDER_PAGE).toContain("void loadFinHistory();");
    expect(ORDER_PAGE).toContain("void loadOrder();");
  });
});

describe("AC-11/AC-12/AC-13 — Booking detail: + Создать платеж через linkedOrder", () => {
  it("кнопка присутствует и гейтится finance.payment.create", () => {
    expect(BOOKING_PAGE).toContain('data-testid="booking-create-payment-button"');
    expect(BOOKING_PAGE).toContain('useCan("finance.payment.create")');
    expect(BOOKING_PAGE).toContain("{canCreatePayment && (");
  });

  it("orderId берётся из booking.linkedOrder.id (fallback booking.orderId — тот же id)", () => {
    expect(BOOKING_PAGE).toContain("id: booking.linkedOrder?.id ?? booking.orderId");
  });

  it("bookingId НЕ передаётся — в preset CreatePaymentForm нет bookingId (AC-12)", () => {
    const modalStart = BOOKING_PAGE.indexOf("<CreatePaymentForm");
    expect(modalStart).toBeGreaterThan(-1);
    const modal = BOOKING_PAGE.slice(modalStart, BOOKING_PAGE.indexOf("/>", modalStart) + 2);
    expect(modal).not.toContain("bookingId");
    expect(modal).not.toContain("booking.id");
    // payload вообще собирается в whitelist-билдере, а не в странице
    expect(BOOKING_PAGE).not.toContain("bookingId:");
  });

  it("после создания — обновление detail (financialSummary/activePayment из loadBooking) AC-13", () => {
    const modal = BOOKING_PAGE.slice(BOOKING_PAGE.indexOf("<CreatePaymentForm"));
    expect(modal).toContain("void loadBooking();");
    expect(modal).toContain("financialSummary?.totalAmount");
    expect(modal).toContain("financialSummary?.currency");
  });
});

describe("AC-14 — Analytics payment cards / navigation не сломаны", () => {
  it("metric-drilldown: карточки оплат ведут в канонический /app/payments", () => {
    expect(METRIC_DRILLDOWN).toContain('"analytics.finance.payment_count"');
    expect(METRIC_DRILLDOWN).toContain('destination: "/app/payments"');
    expect(METRIC_DRILLDOWN).toContain('"analytics.finance.payments"');
  });

  it("command-center SectionGrid: payments-captured / refunds-processed → /app/payments?…", () => {
    expect(SECTION_GRID).toContain("/app/payments?paymentStatus=CAPTURED");
    expect(SECTION_GRID).toContain("/app/payments?refundStatus=PROCESSED");
  });

  it("analytics page: оплат-карточки используют существующий resolveDrilldownUrl", () => {
    expect(ANALYTICS_PAGE).toContain("resolveDrilldownUrl(");
    expect(ANALYTICS_PAGE).toContain('METRIC_CONFIGS["analytics.finance.payment_count"]');
  });

  it("второй payment registry / payment dashboard / новый API не созданы (§6)", () => {
    // analytics не мутирует платежи и не знает о create-form
    expect(ANALYTICS_PAGE).not.toContain("CreatePaymentForm");
    expect(ANALYTICS_PAGE).not.toContain("finance/payments");
    // канонический create живёт ТОЛЬКО в /app/payments (+ detail-страницы)
    expect(PAYMENTS_PAGE).toContain("<CreatePaymentForm");
  });
});
