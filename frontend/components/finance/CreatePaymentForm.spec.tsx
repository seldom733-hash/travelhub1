// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CreatePaymentForm, { type PaymentFormPresetOrder } from "./CreatePaymentForm";
import { HttpError } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    api: { ...actual.api, get: vi.fn(), post: vi.fn() },
  };
});

import { api } from "@/lib/api";

const getMock = api.get as ReturnType<typeof vi.fn>;
const postMock = api.post as ReturnType<typeof vi.fn>;

const ORDER = {
  id: "ord-1",
  code: "MKT-ORD-1",
  number: "0001",
  referenceNumber: "MKT-ORD-0001",
  customerId: "cust-1",
  status: "IN_PROCESS",
  paymentStatus: "UNPAID",
  currency: "AZN",
  amount: "1250.00",
  serviceDate: null,
  cancelledAt: null,
  version: 1,
  createdAt: "2026-10-01T10:00:00.000Z",
};

/** Финансовый контекст (GET /orders/:id) — MULTI/PARTIAL: default = Осталось. */
const FINANCIALS = {
  amount: "1250.00",
  paidAmount: "0.00",
  refundedAmount: "0.00",
  dueAmount: "1250.00",
  paymentStatus: "UNPAID",
  currency: "AZN",
};

const PRESET: PaymentFormPresetOrder = {
  id: "ord-preset",
  label: "MKT-ORD-0009",
  amount: "900.00",
  currency: "AZN",
};

const PRESET_FINANCIALS = {
  ...FINANCIALS,
  amount: "900.00",
  dueAmount: "900.00",
};

function ordersResponse() {
  return { items: [ORDER], total: 1, page: 1, pageSize: 100 };
}

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  getMock.mockImplementation((url: string) => {
    if (url === "/orders?pageSize=100") return Promise.resolve(ordersResponse());
    if (url === "/orders/ord-preset") return Promise.resolve(PRESET_FINANCIALS);
    if (url.startsWith("/orders/")) return Promise.resolve(FINANCIALS);
    return Promise.resolve(ordersResponse());
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

function submitButton(): HTMLButtonElement {
  return screen.getByTestId("create-payment-submit") as HTMLButtonElement;
}

function amountInput(): HTMLInputElement {
  return screen.getByTestId("create-payment-amount") as HTMLInputElement;
}

/** Выбрать заказ, заполнить причину и дождаться, пока financials загрузится (submit активен). */
async function selectOrderAndReason(orderId = "ord-1", reason = "Оплата наличными") {
  const select = (await screen.findByTestId("create-payment-order-select")) as HTMLSelectElement;
  await waitFor(() => expect(select.options.length).toBeGreaterThan(1));
  fireEvent.change(select, { target: { value: orderId } });
  fireEvent.change(screen.getByTestId("create-payment-reason"), { target: { value: reason } });
  await waitFor(() => expect(submitButton().disabled).toBe(false));
}

describe("CreatePaymentForm — form opens, order selector, editable amount (§9 MULTI/PARTIAL)", () => {
  it("рендерит modal с заголовком и загружает заказы в селект", async () => {
    render(<CreatePaymentForm open onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Создать платеж")).toBeTruthy();
    await waitFor(() => expect(getMock).toHaveBeenCalledWith("/orders?pageSize=100"));
    const select = (await screen.findByTestId("create-payment-order-select")) as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe("");
    expect(screen.getAllByRole("option").length).toBeGreaterThan(1);
  });

  it("closed → ничего не рендерит", () => {
    render(<CreatePaymentForm open={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("сумма — РЕДАКТИРУЕМАЯ: default = «Осталось» из financials, не содержит валюту", async () => {
    render(<CreatePaymentForm open onClose={() => {}} />);
    await screen.findByTestId("create-payment-order-select");
    // до выбора заказа financials нет → пустое поле, но НЕ readOnly/disabled
    expect(amountInput().readOnly).toBe(false);
    expect(amountInput().disabled).toBe(false);
    expect(amountInput().value).toBe("");
    fireEvent.change(screen.getByTestId("create-payment-order-select"), { target: { value: "ord-1" } });
    // default редактируемого поля = Осталось (due), plain number без валюты
    await waitFor(() => expect(amountInput().value).toBe("1250.00"));
    expect(amountInput().value).not.toContain("AZN");
    expect(getMock).toHaveBeenCalledWith("/orders/ord-1");
    // пользователь может редактировать (partial payment)
    fireEvent.change(amountInput(), { target: { value: "300" } });
    expect(amountInput().value).toBe("300");
    fireEvent.change(screen.getByTestId("create-payment-reason"), { target: { value: "Частичная оплата" } });
    expect(submitButton().disabled).toBe(false);
  });

  it("некорректная сумма (0 / > due / >2 знаков) — inline error + submit заблокирован", async () => {
    render(<CreatePaymentForm open onClose={() => {}} />);
    await selectOrderAndReason();
    expect(amountInput().value).toBe("1250.00");

    fireEvent.change(amountInput(), { target: { value: "0" } });
    expect(screen.getByTestId("create-payment-amount-error")).toBeTruthy();
    expect(submitButton().disabled).toBe(true);

    fireEvent.change(amountInput(), { target: { value: "9999.99" } }); // > due 1250.00
    expect(screen.getByTestId("create-payment-amount-error")).toBeTruthy();
    expect(submitButton().disabled).toBe(true);

    fireEvent.change(amountInput(), { target: { value: "10.999" } }); // >2 знаков
    expect(screen.getByTestId("create-payment-amount-error")).toBeTruthy();
    expect(submitButton().disabled).toBe(true);

    fireEvent.change(amountInput(), { target: { value: "100.50" } });
    expect(screen.queryByTestId("create-payment-amount-error")).toBeNull();
    expect(submitButton().disabled).toBe(false);
  });

  it("reason обязателен — submit заблокирован до заполнения (AC-6)", async () => {
    render(<CreatePaymentForm open onClose={() => {}} />);
    await screen.findByTestId("create-payment-order-select");
    const select = screen.getByTestId("create-payment-order-select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "ord-1" } });
    await waitFor(() => expect(amountInput().value).toBe("1250.00"));
    expect(submitButton().disabled).toBe(true); // reason ещё пустой
    fireEvent.change(screen.getByTestId("create-payment-reason"), { target: { value: "x" } });
    expect(submitButton().disabled).toBe(false);
    expect(postMock).not.toHaveBeenCalled();
  });

  it("presetOrder — заказ фиксирован (селекта нет), financials preset-заказа, payload amount = due", async () => {
    const onCreated = vi.fn();
    render(<CreatePaymentForm open onClose={() => {}} presetOrder={PRESET} onCreated={onCreated} />);
    expect(screen.queryByTestId("create-payment-order-select")).toBeNull();
    const fixed = screen.getByTestId("create-payment-order-fixed") as HTMLInputElement;
    expect(fixed.value).toBe("MKT-ORD-0009");
    // заказы НЕ загружаются, financials preset-заказа — загружаются
    expect(getMock).not.toHaveBeenCalledWith("/orders?pageSize=100");
    await waitFor(() => expect(getMock).toHaveBeenCalledWith("/orders/ord-preset"));
    await waitFor(() => expect(amountInput().value).toBe("900.00"));
    fireEvent.change(screen.getByTestId("create-payment-reason"), { target: { value: "Причина" } });
    await waitFor(() => expect(submitButton().disabled).toBe(false));
    fireEvent.click(submitButton());
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    expect(postMock.mock.calls[0][1]).toEqual({
      orderId: "ord-preset",
      reason: "Причина",
      paymentMethod: "cash",
      amount: "900.00",
    });
  });
});

describe("CreatePaymentForm — successful POST (AC-8/AC-9, §9)", () => {
  it("POST /finance/payments: amount отправляется (default = Осталось), currency/bookingId — нет", async () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();
    render(<CreatePaymentForm open onClose={onClose} onCreated={onCreated} />);
    await selectOrderAndReason();
    fireEvent.click(submitButton());

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    expect(postMock.mock.calls[0][0]).toBe("/finance/payments");
    const body = postMock.mock.calls[0][1] as Record<string, unknown>;
    // MULTI/PARTIAL: редактируемая сумма входит в payload; server-owned поля — никогда
    expect(body).toEqual({
      orderId: "ord-1",
      reason: "Оплата наличными",
      paymentMethod: "cash",
      amount: "1250.00",
    });
    expect(body).not.toHaveProperty("currency");
    expect(body).not.toHaveProperty("bookingId");

    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByText("Платёж успешно создан")).toBeTruthy();
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it("пустая сумма → amount НЕ отправляется (сервер сам возьмёт due)", async () => {
    render(<CreatePaymentForm open onClose={() => {}} />);
    await selectOrderAndReason();
    fireEvent.change(amountInput(), { target: { value: "" } });
    expect(submitButton().disabled).toBe(false);
    fireEvent.click(submitButton());
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    const body = postMock.mock.calls[0][1] as Record<string, unknown>;
    expect(body).not.toHaveProperty("amount");
    expect(body).toEqual({
      orderId: "ord-1",
      reason: "Оплата наличными",
      paymentMethod: "cash",
    });
  });

  it("двойной клик → ровно один POST", async () => {
    let resolvePost!: (v: unknown) => void;
    postMock.mockReturnValue(new Promise((r) => { resolvePost = r; }));
    render(<CreatePaymentForm open onClose={() => {}} />);
    await selectOrderAndReason("ord-1", "r");
    fireEvent.click(submitButton());
    expect(submitButton().disabled).toBe(true); // submitting → disabled (§8)
    fireEvent.click(submitButton());
    fireEvent.click(submitButton());
    expect(postMock).toHaveBeenCalledTimes(1); // guard до resolve
    resolvePost({ id: "pay-1", code: "PAY-1", referenceNumber: null, orderId: "ord-1", amount: "1", currency: "AZN", status: "PENDING", paymentMethod: "cash" });
    await screen.findByRole("status"); // success после resolve
    expect(postMock).toHaveBeenCalledTimes(1); // ровно один POST
  });
});

describe("CreatePaymentForm — ошибки 403/404/409/422 (§3)", () => {
  const cases: Array<[number, string]> = [
    [403, "Нет прав"],
    [404, "Заказ не найден"],
    [409, "Активный платёж уже существует"],
    [422, "Ошибка проверки данных"],
  ];

  for (const [status, message] of cases) {
    it(`${status} → «${message}»; форма остаётся открытой`, async () => {
      postMock.mockRejectedValue(new HttpError(`HTTP ${status}`, status));
      render(<CreatePaymentForm open onClose={() => {}} />);
      await selectOrderAndReason();
      fireEvent.click(submitButton());
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe(message);
      expect(screen.getByRole("dialog")).toBeTruthy();
      // после ошибки снова можно отправить (phase → idle)
      expect(submitButton().disabled).toBe(false);
      expect(postMock).toHaveBeenCalledTimes(1);
    });
  }

  it("прочая ошибка → generic-сообщение сервера", async () => {
    postMock.mockRejectedValue(new HttpError("Payment X is CANCELLED; payment cannot be initiated", 400));
    render(<CreatePaymentForm open onClose={() => {}} />);
    await selectOrderAndReason();
    fireEvent.click(submitButton());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Payment X is CANCELLED; payment cannot be initiated");
  });
});

describe("CreatePaymentForm — reserved: активные платежи уменьшают доступный остаток", () => {
  const RESERVED_400 = { ...FINANCIALS, reservedAmount: "400.00" }; // due 1250 → available 850
  const FULLY_RESERVED = { ...FINANCIALS, reservedAmount: "1250.00" }; // available 0

  function mockFinancials(f: typeof FINANCIALS) {
    getMock.mockImplementation((url: string) => {
      if (url === "/orders?pageSize=100") return Promise.resolve(ordersResponse());
      if (url.startsWith("/orders/")) return Promise.resolve(f);
      return Promise.resolve(ordersResponse());
    });
  }

  it("default = available (due − reserved), а НЕ «Осталось»; hint с reserved/available", async () => {
    mockFinancials(RESERVED_400);
    render(<CreatePaymentForm open onClose={() => {}} />);
    await selectOrderAndReason();
    expect(amountInput().value).toBe("850.00");
    // readonly «Осталось» остаётся canonical due (prompt §5)
    const due = screen.getByTestId("create-payment-due");
    expect((due.textContent ?? "").replace(/\s/g, "")).toContain("1250,00");
    const hint = screen.getByTestId("create-payment-reserved-hint");
    expect(hint.textContent).toContain("400");
    expect(hint.textContent).toContain("850");
  });

  it("ввод > available → inline error + submit blocked; ≤ available → ок", async () => {
    mockFinancials(RESERVED_400);
    render(<CreatePaymentForm open onClose={() => {}} />);
    await selectOrderAndReason();
    fireEvent.change(amountInput(), { target: { value: "1000" } });
    expect(screen.getByTestId("create-payment-amount-error")).toBeTruthy();
    expect(submitButton().disabled).toBe(true);
    fireEvent.change(amountInput(), { target: { value: "851" } });
    expect(screen.getByTestId("create-payment-amount-error")).toBeTruthy();
    fireEvent.change(amountInput(), { target: { value: "850" } });
    expect(screen.queryByTestId("create-payment-amount-error")).toBeNull();
    expect(submitButton().disabled).toBe(false);
  });

  it("резерв = весь остаток → default «0.00», create заблокирован, hint available 0", async () => {
    mockFinancials(FULLY_RESERVED);
    render(<CreatePaymentForm open onClose={() => {}} />);
    const select = (await screen.findByTestId("create-payment-order-select")) as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBeGreaterThan(1));
    fireEvent.change(select, { target: { value: "ord-1" } });
    await waitFor(() => expect(amountInput().value).toBe("0.00"));
    fireEvent.change(screen.getByTestId("create-payment-reason"), { target: { value: "r" } });
    expect(submitButton().disabled).toBe(true); // 0 невалидно
    fireEvent.change(amountInput(), { target: { value: "1" } });
    expect(screen.getByTestId("create-payment-amount-error")).toBeTruthy(); // 1 > available 0
    expect(submitButton().disabled).toBe(true);
    const hint = screen.getByTestId("create-payment-reserved-hint");
    expect(hint.textContent).toContain("0,00");
  });

  it("без reservedAmount (старый DTO) → hint отсутствует, default = due (как раньше)", async () => {
    render(<CreatePaymentForm open onClose={() => {}} />);
    await selectOrderAndReason();
    expect(amountInput().value).toBe("1250.00");
    expect(screen.queryByTestId("create-payment-reserved-hint")).toBeNull();
  });
});

describe("CreatePaymentForm — Idempotency-Key (Step 2.12H, @Idempotent payment.create)", () => {
  const KEY_RE = /^[A-Za-z0-9._~-]+$/;
  const SUCCESS = {
    id: "pay-1",
    code: "PAY-1",
    referenceNumber: null,
    orderId: "ord-1",
    amount: "1250.00",
    currency: "AZN",
    status: "PENDING",
    paymentMethod: "cash",
  };

  function headerKey(call: unknown[]): string {
    return (call[2] as Record<string, string>)["Idempotency-Key"];
  }

  it("POST /finance/payments ВСЕГДА с Idempotency-Key (backend regex ≤128)", async () => {
    render(<CreatePaymentForm open onClose={() => {}} />);
    await selectOrderAndReason();
    fireEvent.click(submitButton());
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    expect(postMock.mock.calls[0]).toHaveLength(3);
    const key = headerKey(postMock.mock.calls[0]);
    expect(key).toMatch(KEY_RE);
    expect(key.length).toBeLessThanOrEqual(128);
    expect(key.startsWith("payment.create-")).toBe(true);
  });

  it("retry того же payload после сетевой ошибки → ТОТ ЖЕ ключ (replay, не дубль)", async () => {
    postMock.mockRejectedValueOnce(new HttpError("HTTP 502", 502));
    postMock.mockResolvedValueOnce(SUCCESS);
    render(<CreatePaymentForm open onClose={() => {}} />);
    await selectOrderAndReason();
    fireEvent.click(submitButton());
    await screen.findByRole("alert"); // 502 → generic, форма остаётся открытой
    fireEvent.click(submitButton());
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(2));
    expect(headerKey(postMock.mock.calls[1])).toBe(headerKey(postMock.mock.calls[0]));
  });

  it("изменение payload (amount) → НОВЫЙ ключ (иначе 409 divergent)", async () => {
    postMock.mockRejectedValueOnce(new HttpError("HTTP 502", 502));
    postMock.mockResolvedValueOnce(SUCCESS);
    render(<CreatePaymentForm open onClose={() => {}} />);
    await selectOrderAndReason();
    fireEvent.click(submitButton());
    await screen.findByRole("alert");
    fireEvent.change(amountInput(), { target: { value: "300" } });
    fireEvent.click(submitButton());
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(2));
    expect(headerKey(postMock.mock.calls[1])).not.toBe(headerKey(postMock.mock.calls[0]));
  });

  it("переоткрытие диалога → новый ключ (намеренный повторный платёж не replay-ится)", async () => {
    const first = render(<CreatePaymentForm open onClose={() => {}} />);
    await selectOrderAndReason();
    fireEvent.click(submitButton());
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    first.unmount();

    render(<CreatePaymentForm open onClose={() => {}} />);
    await selectOrderAndReason();
    fireEvent.click(submitButton());
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(2));
    expect(headerKey(postMock.mock.calls[1])).not.toBe(headerKey(postMock.mock.calls[0]));
  });
});
