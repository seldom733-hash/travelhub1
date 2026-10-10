import { computeAvailableOrderActions, ACTION_PERMISSIONS, type OrderAction } from "./order.service";
import { computeRequestAvailableActions } from "./request.service";

/**
 * Stage 1 — Order → Request (только назад).
 *
 * Проекции обязаны зеркалить execution-контракт:
 *  - Request-флаги больше НЕ гейтятся `convertedOrderId === null`:
 *    вернувшаяся из Order заявка (link сохранён) снова живёт в цикле
 *    поставщика (proposePrice/confirmPrice) и в customer-окне (accept/decline);
 *  - convert зеркалит статусный гейт convertRequestToOrder
 *    (CUSTOMER_ACCEPTED), а не link: повторная конвертация вернувшейся
 *    заявки — штатный forward (существующая фича), а не спец-блокировка;
 *  - Order-проекция отдаёт returnToRequest из active-диапазона и только
 *    при granular-праве order.cancel (как в TRANSITIONS/ACTION_PERMISSIONS).
 */

const FULL_REQUEST = {
  convertedOrderId: "ord-1",
  customerActionDeadline: null,
  customerAcceptedAt: new Date("2026-01-10"),
  pinnedRequirements: { doc: "passport" },
  travelerCount: 2,
  productSnapshot: { productId: "p-1" },
  // Phase 3 (design §8): convert-gate = status + link + деньги.
  confirmedPrice: 1050,
  confirmedCurrency: "USD",
  displayedPrice: 1050,
  displayedCurrency: "USD",
} as const;

const EDIT = ["order.edit_noncritical"] as const;

describe("Stage 1 — computeRequestAvailableActions (после возврата из Order)", () => {
  it("CHECKING + link (возврат): цикл поставщика открыт, convert/accept закрыты", () => {
    const a = computeRequestAvailableActions({ ...FULL_REQUEST, status: "CHECKING" }, EDIT);
    expect(a).toEqual({
      confirmPrice: true,
      proposePrice: true,
      reject: true,
      unavailable: true,
      customerAccept: false,
      customerDecline: false,
      convert: false,
    });
  });

  it("PRICE_CHANGED + link (повторный цикл после возврата): customer-окно открыто", () => {
    const a = computeRequestAvailableActions({ ...FULL_REQUEST, status: "PRICE_CHANGED" }, EDIT);
    expect(a.customerAccept).toBe(true);
    expect(a.customerDecline).toBe(true);
    expect(a.convert).toBe(false);
  });

  it("CUSTOMER_ACCEPTED + link (повторный accept после возврата): convert закрыт (409-гейт, один Order на chain)", () => {
    const a = computeRequestAvailableActions({ ...FULL_REQUEST, status: "CUSTOMER_ACCEPTED" }, EDIT);
    expect(a.convert).toBe(false);
    // customer-окно execution-паритетно (status-only), но forward блокирован link-ом.
    expect(a.customerAccept).toBe(false); // status не PRICE_CHANGED/CONFIRMED
  });

  it("CUSTOMER_ACCEPTED без link (обычный первый convert): convert открыт", () => {
    const a = computeRequestAvailableActions(
      { ...FULL_REQUEST, status: "CUSTOMER_ACCEPTED", convertedOrderId: null },
      EDIT,
    );
    expect(a.convert).toBe(true);
  });

  it("CONVERTED + link: convert закрыт (fast-path — идемпотентный no-op)", () => {
    const a = computeRequestAvailableActions({ ...FULL_REQUEST, status: "CONVERTED" }, EDIT);
    expect(a.convert).toBe(false);
  });

  it("без прав: все флаги false (гранулярный заказ)", () => {
    const a = computeRequestAvailableActions({ ...FULL_REQUEST, status: "CUSTOMER_ACCEPTED" }, []);
    expect(Object.values(a).every((v) => v === false)).toBe(true);
  });

  it("NEW без link: привычный первый цикл не меняется", () => {
    const a = computeRequestAvailableActions(
      { ...FULL_REQUEST, status: "NEW", convertedOrderId: null, customerAcceptedAt: null },
      EDIT,
    );
    expect(a.proposePrice).toBe(true);
    expect(a.convert).toBe(false);
  });

  it("Phase 3 money-gate: без денег convert=false (зеркалит Order conversion gate)", () => {
    const base = { ...FULL_REQUEST, status: "CUSTOMER_ACCEPTED", convertedOrderId: null };
    // обе money-пары отсутствуют
    expect(
      computeRequestAvailableActions(
        { ...base, confirmedPrice: null, displayedPrice: null } as never,
        EDIT,
      ).convert,
    ).toBe(false);
    // confirmed null, displayed 0 → тоже 0
    expect(
      computeRequestAvailableActions(
        { ...base, confirmedPrice: null, confirmedCurrency: null, displayedPrice: 0 } as never,
        EDIT,
      ).convert,
    ).toBe(false);
    // confirmed есть, но обе валюты отсутствуют → convert закрыт
    expect(
      computeRequestAvailableActions(
        {
          ...base,
          confirmedPrice: 1050,
          confirmedCurrency: null,
          displayedPrice: 1050,
          displayedCurrency: null,
        } as never,
        EDIT,
      ).convert,
    ).toBe(false);
    // fallback на displayed при отсутствии confirmed — convert открыт
    expect(
      computeRequestAvailableActions(
        { ...base, confirmedPrice: null, confirmedCurrency: null } as never,
        EDIT,
      ).convert,
    ).toBe(true);
  });
});

describe("Stage 1 — computeAvailableOrderActions (returnToRequest)", () => {
  const grantedAll = Object.values(ACTION_PERMISSIONS) as string[];

  it("NEW + order.cancel: returnToRequest в проекции", () => {
    const actions = computeAvailableOrderActions(
      { status: "NEW", travelerCount: null, termsAcceptedAt: null, finalConfirmedAt: null },
      grantedAll,
    );
    expect(actions).toContain("returnToRequest");
    expect(actions).toContain("process");
  });

  it("без order.cancel: returnToRequest скрыт (гранулярный RBAC)", () => {
    const actions = computeAvailableOrderActions(
      { status: "NEW", travelerCount: null, termsAcceptedAt: null, finalConfirmedAt: null },
      ["order.edit_noncritical", "order.accept"],
    );
    expect(actions).not.toContain("returnToRequest");
  });

  it("CANCELLED: returnToRequest недоступен (повторный вызов → 409)", () => {
    const actions = computeAvailableOrderActions(
      { status: "CANCELLED", travelerCount: null, termsAcceptedAt: null, finalConfirmedAt: null },
      grantedAll,
    );
    expect(actions).not.toContain("returnToRequest");
    expect(actions).toHaveLength(0);
  });

  it("FULFILLED/CLOSED: returnToRequest недоступен (вне active-диапазона)", () => {
    for (const status of ["FULFILLED", "CLOSED"] as const) {
      const actions = computeAvailableOrderActions(
        { status, travelerCount: null, termsAcceptedAt: null, finalConfirmedAt: null },
        grantedAll,
      );
      expect(actions).not.toContain("returnToRequest");
    }
  });

  // ── Stage 2 fix (Bug 2 / AC-3 / AC-5): блокирует только активный Booking ──
  it("BUG2: 0 активных blocking Booking → returnToRequest в проекции (Case A/C)", () => {
    const actions = computeAvailableOrderActions(
      { status: "READY_FOR_BOOKING", travelerCount: null, termsAcceptedAt: null, finalConfirmedAt: null },
      grantedAll,
      0,
    );
    expect(actions).toContain("returnToRequest");
  });

  it("BUG2: ≥1 активный blocking Booking → returnToRequest скрыт (Case B)", () => {
    for (const status of ["SENT_TO_BOOKING", "PARTIALLY_FULFILLED", "PROBLEM"] as const) {
      const actions = computeAvailableOrderActions(
        { status, travelerCount: null, termsAcceptedAt: null, finalConfirmedAt: null },
        grantedAll,
        2,
      );
      expect(actions).not.toContain("returnToRequest");
    }
  });

  it("BUG2: активный Booking прячет только returnToRequest, остальные действия целы", () => {
    const actions = computeAvailableOrderActions(
      { status: "PARTIALLY_FULFILLED", travelerCount: null, termsAcceptedAt: null, finalConfirmedAt: null },
      grantedAll,
      1,
    );
    expect(actions).not.toContain("returnToRequest");
    expect(actions).toContain("send");
    expect(actions).toContain("cancel");
  });

  it("permission map покрывает новую команду (type-safe Record<OrderAction>)", () => {
    const perm = ACTION_PERMISSIONS["returnToRequest" as OrderAction];
    expect(perm).toBe("order.cancel");
  });
});
