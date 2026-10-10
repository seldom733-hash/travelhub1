import { computeAvailableBookingActions, ACTION_PERMISSIONS, type BookingAction } from "./booking.service";
import type { BookingStatus } from "../../generated/prisma/client";

/**
 * Stage 2 — Booking → Order (round-trip).
 *
 * Проекция computeAvailableBookingActions обязана зеркалить execution-контракт
 * applyReturnToOrder:
 *  - returnToOrder виден из direct-статусов (NEW, PREPARING_REQUEST,
 *    SENT_TO_SUPPLIER, AWAITING_CONFIRMATION, NEEDS_CLARIFICATION), из PROBLEM
 *    (recovery-решение владельца) и из phase-2 (CANCELLED, SUPPLIER_REJECTED);
 *  - СКРЫТ из подтверждённых/активных статусов (CONFIRMED, IN_SERVICE,
 *    CANCELLATION_REQUESTED, CHANGE_REQUESTED) — execution → 409 «сначала
 *    подтверждённая отмена»;
 *  - СКРЫТ из COMPLETED — терминальный, возврат невозможен (Q2);
 *  - СКРЫТ для УЖЕ возвращённой брони (history-факт returned_to_order →
 *    returnedToOrder=true): CANCELLED/SUPPLIER_REJECTED без факта — phase-2
 *    кандидат (показывается), с фактом — «уже возвращена» (скрывается, Bug 1);
 *  - гранулярный RBAC: без booking.return_to_order команда не показывается
 *    (Q7, отдельно от booking.cancel).
 */

const grantedAll = [...new Set(Object.values(ACTION_PERMISSIONS))] as string[];

const DIRECT: BookingStatus[] = [
  "NEW",
  "PREPARING_REQUEST",
  "SENT_TO_SUPPLIER",
  "AWAITING_CONFIRMATION",
  "NEEDS_CLARIFICATION",
];

const BOOKING = { orderId: "ord-1" } as const;

describe("Stage 2 — computeAvailableBookingActions (returnToOrder)", () => {
  it("direct-статусы: returnToOrder в проекции при granular-праве", () => {
    for (const status of DIRECT) {
      const actions = computeAvailableBookingActions({ ...BOOKING, status }, grantedAll);
      expect(actions).toContain("returnToOrder");
    }
  });

  it("PROBLEM: returnToOrder доступен (recovery без подтверждённой отмены)", () => {
    const actions = computeAvailableBookingActions({ ...BOOKING, status: "PROBLEM" }, grantedAll);
    expect(actions).toContain("returnToOrder");
  });

  it("phase-2 (CANCELLED / SUPPLIER_REJECTED): returnToOrder в проекции", () => {
    for (const status of ["CANCELLED", "SUPPLIER_REJECTED"] as const) {
      const actions = computeAvailableBookingActions({ ...BOOKING, status }, grantedAll);
      expect(actions).toContain("returnToOrder");
    }
  });

  // ── Stage 2 fix (Bug 1 / AC-1): уже возвращённая бронь не предлагает возврат ──
  it("BUG1: возвращённая бронь (returnedToOrder=true): returnToOrder скрыт", () => {
    for (const status of ["CANCELLED", "SUPPLIER_REJECTED"] as const) {
      const actions = computeAvailableBookingActions(
        { ...BOOKING, status, returnedToOrder: true },
        grantedAll,
      );
      expect(actions).not.toContain("returnToOrder");
    }
  });

  it("BUG1: явный returnedToOrder=false (phase-2 кандидат) — returnToOrder виден", () => {
    for (const status of ["CANCELLED", "SUPPLIER_REJECTED"] as const) {
      const actions = computeAvailableBookingActions(
        { ...BOOKING, status, returnedToOrder: false },
        grantedAll,
      );
      expect(actions).toContain("returnToOrder");
    }
  });

  it("подтверждённые/активные статусы: returnToOrder скрыт (execution → 409)", () => {
    for (const status of ["CONFIRMED", "IN_SERVICE", "CANCELLATION_REQUESTED", "CHANGE_REQUESTED"] as const) {
      const actions = computeAvailableBookingActions({ ...BOOKING, status }, grantedAll);
      expect(actions).not.toContain("returnToOrder");
    }
  });

  it("COMPLETED: returnToOrder скрыт (никогда не возвращается, Q2)", () => {
    const actions = computeAvailableBookingActions({ ...BOOKING, status: "COMPLETED" }, grantedAll);
    expect(actions).not.toContain("returnToOrder");
  });

  it("без booking.return_to_order: команда скрыта (гранулярный RBAC Q7)", () => {
    const without = grantedAll.filter((p) => p !== "booking.return_to_order");
    const actions = computeAvailableBookingActions({ ...BOOKING, status: "NEW" }, without);
    expect(actions).not.toContain("returnToOrder");
    // Остальные права оператора при этом не «ломаются».
    expect(actions.length).toBeGreaterThan(0);
  });

  it("permission map покрывает новую команду (type-safe Record<BookingAction>)", () => {
    const perm = ACTION_PERMISSIONS["returnToOrder" as BookingAction];
    expect(perm).toBe("booking.return_to_order");
  });
});
