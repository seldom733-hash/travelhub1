// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import PaymentsTable, { buildPaymentsTableRows, type PaymentsTableRow } from "./PaymentsTable";
import { t } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-user";
import { confirmPayment, cancelPayment } from "@/lib/payments";

vi.mock("@/lib/use-user", () => ({ useCurrentUser: vi.fn() }));
vi.mock("@/lib/payments", () => ({
  confirmPayment: vi.fn().mockResolvedValue({}),
  cancelPayment: vi.fn().mockResolvedValue({}),
  // Другие экспорты модуля в этом спеке не используются.
  newPaymentIdempotencyKey: vi.fn(() => "k"),
  createPayment: vi.fn(),
  isValidPaymentAmount: vi.fn(() => true),
  availableToCreate: vi.fn(() => null),
  buildCreatePaymentPayload: vi.fn((i: unknown) => i),
  paymentCreateErrorKey: vi.fn(() => null),
  fetchOrderFinancials: vi.fn(),
  fetchPayableOrdersForSelect: vi.fn(() => []),
  PAYMENT_METHODS: ["cash", "card", "bank_transfer", "other"],
}));

const ROWS: PaymentsTableRow[] = [
  {
    id: "p1",
    ordinal: 1,
    code: "PAY-00000001",
    referenceNumber: "MKT-PAY-1",
    createdAt: "2026-10-01T10:00:00.000Z",
    amount: "300.00",
    currency: "AZN",
    paymentMethod: "cash",
    status: "CAPTURED",
    acceptedBy: "admin",
    remainingAfter: "1000",
    paymentHref: "/app/payments/PAY-00000001",
    orderHref: "/app/orders/ord-1",
    orderLabel: "MKT-ORD-0001",
  },
  {
    id: "p2",
    ordinal: 2,
    code: "PAY-00000002",
    referenceNumber: null,
    createdAt: "2026-10-02T10:00:00.000Z",
    amount: "1000.00",
    currency: "AZN",
    paymentMethod: "bank_transfer",
    status: "PENDING",
    acceptedBy: null,
    remainingAfter: "0",
  },
];

describe("PaymentsTable — единый 7-колоночный контракт (§7)", () => {
  it("ровно 7 колонок в canonical-порядке: №/Дата/Сумма/Остаток/Форма оплаты/Статус/Кто принял", () => {
    render(<PaymentsTable rows={ROWS} locale="ru" />);
    const table = screen.getByTestId("payments-table");
    const headers = within(table).getAllByRole("columnheader");
    expect(headers).toHaveLength(7);
    expect(headers.map((h) => h.textContent?.trim())).toEqual([
      t("payments.table.col_ordinal", "ru"),
      t("payments.table.col_date", "ru"),
      t("payments.col.amount", "ru"),
      t("payments.col.remaining", "ru"),
      t("payments.table.col_method", "ru"),
      t("payments.col.status", "ru"),
      t("payments.col.accepted_by", "ru"),
    ]);
  });

  it("colgroup задаёт 7 колонок (фиксированная раскладка)", () => {
    const { container } = render(<PaymentsTable rows={ROWS} locale="ru" />);
    const cols = container.querySelectorAll("col");
    expect(cols).toHaveLength(7);
  });

  it("ячейки: № (ordinal + code-ссылка + ref заказа), валюта внутри Суммы/Остатка, Кто принял", () => {
    render(<PaymentsTable rows={ROWS} locale="ru" />);
    const rows = screen.getAllByTestId("payments-table-row");
    expect(rows).toHaveLength(2);

    const first = rows[0];
    // №: ordinal + code-ссылка + ссылка на заказ (код/заказ — внутри ячейки, не колонка)
    expect(first.textContent).toContain("1");
    const codeLink = within(first).getByRole("link", { name: "MKT-PAY-1" });
    expect(codeLink.getAttribute("href")).toBe("/app/payments/PAY-00000001");
    const orderLink = within(first).getByRole("link", { name: "MKT-ORD-0001" });
    expect(orderLink.getAttribute("href")).toBe("/app/orders/ord-1");
    // Сумма и Остаток несут валюту внутри ячейки
    expect(first.textContent).toContain("AZN");
    // Форма оплаты локализована
    expect(first.textContent).toContain(t("payments.create.method.cash", "ru"));
    // Статус через StatusBadge label
    expect(first.textContent).toContain(t("status.entity.CAPTURED", "ru"));
    // Кто принял
    expect(first.textContent).toContain("admin");

    const second = rows[1];
    expect(second.textContent).toContain("—"); // acceptedBy отсутствует
    // без paymentHref код рендерится плейном (не ссылкой)
    expect(second.textContent).toContain("PAY-00000002");
    expect(within(second).queryByRole("link")).toBeNull();
  });

  it("без onSort — статичные заголовки; с onSort — sortable-кнопки вызывают колбэк", () => {
    const onSort = vi.fn();
    const { rerender } = render(<PaymentsTable rows={ROWS} locale="ru" />);
    const table = screen.getByTestId("payments-table");
    // static: заголовок «Дата» без кнопки
    const dateTh = within(table).getAllByRole("columnheader")[1];
    expect(within(dateTh).queryByRole("button")).toBeNull();

    rerender(<PaymentsTable rows={ROWS} locale="ru" onSort={onSort} />);
    const table2 = screen.getByTestId("payments-table");
    const dateTh2 = within(table2).getAllByRole("columnheader")[1];
    const sortBtn = within(dateTh2).getByRole("button");
    fireEvent.click(sortBtn);
    expect(onSort).toHaveBeenCalledWith("createdAt", expect.any(String));
  });

  it("слоты фильтров рендерятся в заголовках Сумма/Статус (реестр)", () => {
    render(
      <PaymentsTable
        rows={ROWS}
        locale="ru"
        onSort={() => {}}
        amountHeaderExtra={<span data-testid="currency-filter">currency-filter</span>}
        statusHeaderExtra={<span data-testid="status-filter">status-filter</span>}
      />,
    );
    expect(screen.getByTestId("currency-filter")).toBeTruthy();
    expect(screen.getByTestId("status-filter")).toBeTruthy();
  });

  it("пустые rows → OperationsEmptyState с colSpan=7 (default или переданный message)", () => {
    const { rerender } = render(<PaymentsTable rows={[]} locale="ru" />);
    const cell = screen.getByRole("cell");
    expect(cell.getAttribute("colspan")).toBe("7");
    expect(cell.textContent).toBe(t("payments.table.empty", "ru"));

    rerender(<PaymentsTable rows={[]} locale="ru" emptyMessage="Нет платежей" />);
    expect(screen.getByRole("cell").textContent).toBe("Нет платежей");
  });
});

describe("buildPaymentsTableRows — клиентское зеркало серверной enrichment (§7)", () => {
  const payment = (id: string, createdAt: string, amount: string, status: string) => ({
    id,
    code: `PAY-${id}`,
    status,
    amount,
    createdAt,
    currency: "AZN",
    referenceNumber: null,
    paymentMethod: "cash",
  });

  it("хронологический № 1..N (независимо от порядка входа) + remainingAfter = max(0, total − Σ CAPTURED/REFUNDED)", () => {
    // вход в порядке DESC, как отдаёт financial-history
    const rows = buildPaymentsTableRows({
      payments: [
        payment("p4", "2026-10-04T10:00:00.000Z", "100.00", "CAPTURED"),
        payment("p3", "2026-10-03T10:00:00.000Z", "400.00", "CAPTURED"),
        payment("p2", "2026-10-02T10:00:00.000Z", "500.00", "CAPTURED"),
        payment("p1", "2026-10-01T10:00:00.000Z", "300.00", "CAPTURED"),
      ],
      orderTotal: "1300",
    });
    expect(rows.map((r) => r.id)).toEqual(["p1", "p2", "p3", "p4"]);
    expect(rows.map((r) => r.ordinal)).toEqual([1, 2, 3, 4]);
    // 1300 − 300/800/1200/1300 = 1000 / 500 / 100 / 0
    expect(rows.map((r) => r.remainingAfter)).toEqual(["1000", "500", "100", "0"]);
  });

  it("учитываются только CAPTURED/REFUNDED; остаток не уходит в минус; без total → remainingAfter=null", () => {
    const rows = buildPaymentsTableRows({
      payments: [
        payment("p1", "2026-10-01T10:00:00.000Z", "300.00", "PENDING"),
        payment("p2", "2026-10-02T10:00:00.000Z", "400.00", "REFUNDED"),
        payment("p3", "2026-10-03T10:00:00.000Z", "9999.00", "CAPTURED"),
      ],
      orderTotal: "100",
    });
    // PENDING не капчится → 100; REFUNDED капчится (400 > total) → 0; переплата клампится в 0
    expect(rows.map((r) => r.remainingAfter)).toEqual(["100", "0", "0"]);

    const noTotal = buildPaymentsTableRows({
      payments: [payment("p1", "2026-10-01T10:00:00.000Z", "300.00", "CAPTURED")],
    });
    expect(noTotal[0].remainingAfter).toBeNull();
  });

  it("acceptedBy = первый PaymentHistory action='created' по paymentId", () => {
    const rows = buildPaymentsTableRows({
      payments: [
        payment("p1", "2026-10-01T10:00:00.000Z", "300.00", "CAPTURED"),
        payment("p2", "2026-10-02T10:00:00.000Z", "500.00", "CAPTURED"),
      ],
      orderTotal: "800",
      history: [
        { paymentId: "p2", action: "created", actorName: "agent2" },
        { paymentId: "p1", action: "captured", actorName: "other" }, // не created — игнор
        { paymentId: "p1", action: "created", actorName: "admin" },
        { paymentId: "p1", action: "created", actorName: "admin2" }, // повтор — игнор
      ],
    });
    expect(rows[0].acceptedBy).toBe("admin");
    expect(rows[1].acceptedBy).toBe("agent2");
  });

  it("история без created-событий → acceptedBy = null (ничего не выдумываем)", () => {
    const rows = buildPaymentsTableRows({
      payments: [payment("p1", "2026-10-01T10:00:00.000Z", "300.00", "CAPTURED")],
      orderTotal: "300",
      history: [{ paymentId: "p1", action: "refunded", actorName: "x" }],
    });
    expect(rows[0].acceptedBy).toBeNull();
  });
});

describe("Статусные действия PENDING (Подтвердить/Отменить, finance.payment.manage)", () => {
  const mockUser = useCurrentUser as Mock;
  const confirmMock = confirmPayment as Mock;
  const cancelMock = cancelPayment as Mock;

  beforeEach(() => {
    confirmMock.mockReset().mockResolvedValue({});
    cancelMock.mockReset().mockResolvedValue({});
    mockUser.mockReturnValue({ permissions: ["finance.payment.manage"] });
  });

  it("кнопки только у PENDING-строки; confirm вызывает API по code + onActionCompleted", async () => {
    const done = vi.fn();
    render(<PaymentsTable rows={ROWS} locale="ru" onActionCompleted={done} />);
    const allRows = screen.getAllByTestId("payments-table-row");
    expect(within(allRows[0]).queryByTestId("payment-confirm-button")).toBeNull(); // CAPTURED
    expect(within(allRows[1]).queryByTestId("payment-confirm-button")).toBeTruthy();
    expect(within(allRows[1]).queryByTestId("payment-cancel-button")).toBeTruthy();
    expect(within(allRows[1]).getByText(t("payments.action.confirm", "ru"))).toBeTruthy();

    fireEvent.click(within(allRows[1]).getByTestId("payment-confirm-button"));
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith("PAY-00000002"));
    expect(cancelMock).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("cancel вызывает cancelPayment(code) и refresh; confirm не трогается", async () => {
    const done = vi.fn();
    render(<PaymentsTable rows={ROWS} locale="ru" onActionCompleted={done} />);
    fireEvent.click(screen.getByTestId("payment-cancel-button"));
    await waitFor(() => expect(cancelMock).toHaveBeenCalledWith("PAY-00000002"));
    expect(confirmMock).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("без finance.payment.manage — кнопок нет даже у PENDING-строки", () => {
    mockUser.mockReturnValue({ permissions: ["finance.payment.read"] });
    render(<PaymentsTable rows={ROWS} locale="ru" />);
    expect(screen.queryByTestId("payment-confirm-button")).toBeNull();
    expect(screen.queryByTestId("payment-cancel-button")).toBeNull();
  });

  it("ошибка API → inline-ошибка в строке, onActionCompleted НЕ вызывается", async () => {
    confirmMock.mockRejectedValueOnce(new Error("409 invalid transition"));
    const done = vi.fn();
    render(<PaymentsTable rows={ROWS} locale="ru" onActionCompleted={done} />);
    fireEvent.click(screen.getByTestId("payment-confirm-button"));
    await waitFor(() => expect(screen.getByTestId("payment-action-error")).toBeTruthy());
    expect(screen.getByTestId("payment-action-error").textContent).toBe(t("payments.action.error", "ru"));
    expect(done).not.toHaveBeenCalled();
  });

  it("кнопки локализованы RU/AZ/EN (payments.action.*)", () => {
    const { rerender } = render(<PaymentsTable rows={ROWS} locale="ru" />);
    expect(screen.getByText("Подтвердить")).toBeTruthy();
    expect(screen.getByText("Отменить")).toBeTruthy();
    rerender(<PaymentsTable rows={ROWS} locale="az" />);
    expect(screen.getByText("Təsdiqlə")).toBeTruthy();
    expect(screen.getByText("Ləğv et")).toBeTruthy();
    rerender(<PaymentsTable rows={ROWS} locale="en" />);
    expect(screen.getByText("Confirm")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });
});
