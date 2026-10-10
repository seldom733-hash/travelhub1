// @vitest-environment jsdom
/**
 * Phase 4 — Requests registry table contract (canonical 13 columns):
 *   № Заявки · Создана · Клиент · Услуга · Поставщик · Цена витрины ·
 *   Подтв. цена · Дата услуги · Страна · Кол. ночей ·
 *   Кол. туристов · Статус · SLA дедлайн
 *
 *  - «Поставщик» renders the supplier (registry label + code); the B2B
 *    partner is only a fallback for legacy rows;
 *  - service parameters live in their own columns (country, nights, party
 *    «2+0»), frozen in pinnedRequirements at creation;
 *  - «Подтв. цена» shows the supplier-confirmed price right after the
 *    service selection (filled at creation from the re-check);
 *  - the whole table uses ONE font size (13px = base −1).
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { api } from "@/lib/api";
import RequestsPage from "./page";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  auth: { token: null, setToken: vi.fn(), clear: vi.fn(), subscribe: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/app/requests",
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/lib/use-user", () => ({ useCurrentUser: vi.fn(() => null) }));

vi.mock("@/lib/supplier-registry", () => ({
  useSupplierLabels: (service: string) =>
    service === "tours" ? { KAZUNION: "Kazunion Tours" } : {},
}));

const getMock = api.get as Mock;

const TOUR_ROW = {
  id: "r1",
  code: "REQ-1",
  commerceSequence: 1,
  referenceNumber: "MKT-REQ-00000101",
  customerId: null,
  customerName: "Ali Veliev",
  customerCode: "C-1",
  productId: null,
  productName: "Rixos Dubai",
  productCode: null,
  serviceType: "TOUR",
  partnerId: null,
  partnerName: null,
  partnerCode: null,
  supplierCode: "KAZUNION",
  status: "NEW",
  requestedServiceDate: "2026-09-19T00:00:00.000Z",
  quantity: 1,
  travelerCount: 2,
  nights: 7,
  adults: 2,
  children: 0,
  country: "Turkey",
  destination: "Antalya",
  departureCity: "Baku",
  displayedPrice: "1050",
  displayedCurrency: "USD",
  confirmedPrice: "1050",
  confirmedCurrency: "USD",
  supplierResponseDeadline: null,
  supplierRespondedAt: null,
  supplierDecision: null,
  customerActionDeadline: null,
  customerAcceptedAt: null,
  convertedOrderId: null,
  createdAt: "2026-10-06T10:00:00.000Z",
};

const LEGACY_PARTNER_ROW = {
  id: "r2",
  code: "REQ-2",
  commerceSequence: 2,
  referenceNumber: "MKT-REQ-00000102",
  customerId: null,
  customerName: null,
  customerCode: null,
  productId: null,
  productName: null,
  productCode: null,
  serviceType: null,
  partnerId: "pt1",
  partnerName: "Azure Travel",
  partnerCode: "PTR-1",
  supplierCode: null,
  status: "CONFIRMED",
  requestedServiceDate: null,
  quantity: 1,
  travelerCount: null,
  nights: null,
  adults: null,
  children: null,
  country: null,
  destination: null,
  departureCity: null,
  displayedPrice: "400",
  displayedCurrency: "AZN",
  confirmedPrice: null,
  confirmedCurrency: null,
  supplierResponseDeadline: null,
  supplierRespondedAt: null,
  supplierDecision: null,
  customerActionDeadline: null,
  customerAcceptedAt: null,
  convertedOrderId: null,
  createdAt: "2026-10-05T09:00:00.000Z",
};

/**
 * Legacy row where the city collapsed to the country at creation (the product
 * had no distinct city attribute) and confirmedPrice was never set.
 */
const GEO_COLLAPSED_ROW = {
  id: "r3",
  code: "REQ-3",
  commerceSequence: 3,
  referenceNumber: "MKT-REQ-00000103",
  customerId: null,
  customerName: "Nigar Mammadova",
  customerCode: null,
  productId: null,
  productName: "Hilton Baku",
  productCode: null,
  serviceType: "HOTEL",
  partnerId: null,
  partnerName: null,
  partnerCode: null,
  supplierCode: null,
  status: "NEW",
  requestedServiceDate: "2026-11-02T00:00:00.000Z",
  quantity: 1,
  travelerCount: null,
  nights: 3,
  adults: null,
  children: null,
  country: "Georgia",
  destination: "Georgia",
  departureCity: null,
  displayedPrice: "300",
  displayedCurrency: "USD",
  confirmedPrice: null,
  confirmedCurrency: null,
  supplierResponseDeadline: null,
  supplierRespondedAt: null,
  supplierDecision: null,
  customerActionDeadline: null,
  customerAcceptedAt: null,
  convertedOrderId: null,
  createdAt: "2026-10-04T08:00:00.000Z",
};

function mockRoutes() {
  getMock.mockImplementation((url: string) => {
    if (String(url).startsWith("/requests/kpi")) {
      return Promise.resolve({ total: 2, new: 1, confirmed: 1 });
    }
    if (String(url).startsWith("/requests?")) {
      return Promise.resolve({ data: [TOUR_ROW, LEGACY_PARTNER_ROW, GEO_COLLAPSED_ROW], total: 3, totalPages: 1 });
    }
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

describe("Requests table — Phase 4 canonical columns (supplier, params, confirmed price)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoutes();
  });

  it("renders the canonical 13-column header in order", async () => {
    render(<RequestsPage />);
    await waitFor(() => expect(screen.getByText("MKT-REQ-00000101")).toBeTruthy());

    const headerCells = screen.getAllByRole("columnheader").map((el) => el.textContent?.trim());
    expect(headerCells).toEqual([
      "№ Заявки",
      "Создана",
      "Клиент",
      "Услуга",
      "Поставщик",
      "Цена витрины",
      "Подтв. цена",
      "Дата услуги",
      "Страна",
      "Кол. ночей",
      "Кол. туристов",
      "Статус",
      "SLA дедлайн",
    ]);
  });

  it("tour row: supplier label + code, service params columns, confirmed price", async () => {
    render(<RequestsPage />);
    await waitFor(() => expect(screen.getByText("MKT-REQ-00000101")).toBeTruthy());

    const row = screen.getByText("MKT-REQ-00000101").closest("tr") as HTMLElement;

    // «Поставщик»: registry label + code (не прочерк)
    expect(within(row).getByText("Kazunion Tours")).toBeTruthy();
    expect(within(row).getByText("KAZUNION")).toBeTruthy();

    // «Услуга»: тип услуги + название продукта
    expect(within(row).getByText("Тур")).toBeTruthy();
    expect(within(row).getByText("Rixos Dubai")).toBeTruthy();

    // Страна / Кол. ночей / Кол. туристов (2+0)
    expect(within(row).getByText("Turkey")).toBeTruthy();
    expect(within(row).getByText("7")).toBeTruthy();
    expect(within(row).getByText("2+0")).toBeTruthy();

    // «Цена витрины» + «Подтв. цена»
    expect(within(row).getAllByText("1050 USD").length).toBe(2);
  });

  it("legacy row without a supplier falls back to the B2B partner; empty params show dashes", async () => {
    render(<RequestsPage />);
    await waitFor(() => expect(screen.getByText("MKT-REQ-00000102")).toBeTruthy());

    const row = screen.getByText("MKT-REQ-00000102").closest("tr") as HTMLElement;

    expect(within(row).getByText("Azure Travel")).toBeTruthy();
    expect(within(row).getByText("PTR-1")).toBeTruthy();
    // Страна/ночи/туристы — прочерки
    expect(within(row).getAllByText("—").length).toBeGreaterThanOrEqual(5);
    expect(within(row).queryByText(/\d+\+\d+/)).toBeNull();
    // «Подтв. цена» без confirmedPrice падает на принятую цену витрины
    expect(within(row).getAllByText("400 AZN").length).toBe(2);
  });

  it("hotel row: country cell, nights; confirmed price falls back to displayed", async () => {
    render(<RequestsPage />);
    await waitFor(() => expect(screen.getByText("MKT-REQ-00000103")).toBeTruthy());

    const row = screen.getByText("MKT-REQ-00000103").closest("tr") as HTMLElement;

    // «Услуга»: тип «Отель» + название
    expect(within(row).getByText("Отель")).toBeTruthy();
    expect(within(row).getByText("Hilton Baku")).toBeTruthy();

    // «Страна» = Georgia (городская колонка удалена), ночи в своей колонке
    const cells = within(row).getAllByRole("cell").map((c) => c.textContent?.trim());
    expect(cells).toHaveLength(13);
    expect(cells[8]).toBe("Georgia");
    expect(cells[9]).toBe("3");
    expect(within(row).queryAllByText("Georgia").length).toBe(1);

    // «Подтв. цена» = принятая цена витрины (fallback на displayed)
    expect(within(row).getAllByText("300 USD").length).toBe(2);
    expect(cells[5]).toBe("300 USD");
    expect(cells[6]).toBe("300 USD");
  });

  it("whole table renders at a single 13px size (no per-cell text-size classes)", async () => {
    render(<RequestsPage />);
    await waitFor(() => expect(screen.getByText("MKT-REQ-00000101")).toBeTruthy());

    const table = screen.getByRole("table");
    expect(table.className).toContain("text-[13px]");
    // shared components (StatusBadge/SortableHeader text-xs) normalized by the
    // table-level descendant override
    expect(table.className).toContain("[&_span]:text-[13px]");
    expect(table.className).toContain("[&_button]:text-[13px]");
    for (const el of table.querySelectorAll("td, th")) {
      expect(el.className).not.toMatch(/text-(xs|sm|base|lg|xl)[\s"]/);
    }
  });
});
