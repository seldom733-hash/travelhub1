// @vitest-environment jsdom
/**
 * Unified «Наценки и комиссионные» table: markup and commission live in one
 * row/table, with a single edit panel.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { api } from "@/lib/api";
import MarkupAdminPage from "./page";

const mocks = vi.hoisted(() => ({ canManage: true }));

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
vi.mock("@/lib/use-can", () => ({ useCan: () => mocks.canManage }));

const getMock = api.get as Mock;
const postMock = api.post as Mock;

const MARKUP_MATRIX = {
  services: ["tours", "flights"],
  suppliers: [
    { code: "KOMPAS", name: "Kompastour", enabled: true },
    { code: "AZAL", name: "AZAL", enabled: true },
  ],
  cells: [
    { supplierCode: "KOMPAS", serviceType: "tours", state: "CONFIGURED", rate: "0.03", ruleCode: "MKR-1", ruleVersion: 1 },
    { supplierCode: "AZAL", serviceType: "flights", state: "CONFIGURED", rate: "0.025", ruleCode: "MKR-2", ruleVersion: 1 },
  ],
};
const COMMISSION_MATRIX = {
  services: ["tours", "flights"],
  suppliers: [
    { code: "KOMPAS", name: "Kompastour", enabled: true },
    { code: "AZAL", name: "AZAL", enabled: true },
  ],
  cells: [
    { supplierCode: "KOMPAS", serviceType: "tours", state: "CONFIGURED", commissionType: "PERCENT", rate: "0.07", fixedAmount: null, calculationBase: "SUPPLIER_BASE", ruleCode: "CMR-1" },
    { supplierCode: "AZAL", serviceType: "flights", state: "CONFIGURED", commissionType: "PERCENT", rate: "0.05", fixedAmount: null, calculationBase: "SUPPLIER_BASE", ruleCode: "CMR-2" },
  ],
};
const MARKUP_RULES = {
  items: [
    { id: "m1", code: "MKR-1", supplierCode: "KOMPAS", serviceType: "tours", rate: "0.03", status: "ACTIVE", version: 1 },
    { id: "m2", code: "MKR-2", supplierCode: "AZAL", serviceType: "flights", rate: "0.025", status: "ACTIVE", version: 1 },
  ],
};
const COMMISSION_RULES = {
  items: [
    { id: "c1", code: "CMR-1", supplierCode: "KOMPAS", serviceType: "tours", commissionType: "PERCENT", rate: "0.07", fixedAmount: null, fixedCurrency: null, calculationBase: "SUPPLIER_BASE", status: "ACTIVE", version: 1 },
    { id: "c2", code: "CMR-2", supplierCode: "AZAL", serviceType: "flights", commissionType: "PERCENT", rate: "0.05", fixedAmount: null, fixedCurrency: null, calculationBase: "SUPPLIER_BASE", status: "ACTIVE", version: 1 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canManage = true;
  getMock.mockImplementation((url: string) => {
    if (url === "/pricing/markup-matrix") return Promise.resolve(MARKUP_MATRIX);
    if (url === "/pricing/commission-matrix") return Promise.resolve(COMMISSION_MATRIX);
    if (url.startsWith("/pricing/markup-rules")) return Promise.resolve(MARKUP_RULES);
    if (url.startsWith("/pricing/commission-rules")) return Promise.resolve(COMMISSION_RULES);
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
  postMock.mockResolvedValue({ code: "MKR-NEW" });
});

describe("MarkupAdminPage — unified markup + commission table", () => {
  it("renders one table with both rates and the combined final rule", async () => {
    render(<MarkupAdminPage />);

    await waitFor(() => expect(screen.getAllByText("Kompastour").length).toBeGreaterThan(0));
    expect(screen.getByText("3,00 %")).toBeTruthy();
    expect(screen.getByText("7,00 %")).toBeTruthy();
    expect(screen.getByText("Наценка 3,00 % + Комиссия 7,00 %")).toBeTruthy();
    expect(screen.getByText("2,50 %")).toBeTruthy();
    expect(screen.getByText("5,00 %")).toBeTruthy();
    // no separate commission-only table/tab
    expect(screen.queryByText("Комиссионные")).toBeNull();
    // only one data table on the page
    expect(screen.getAllByRole("table")).toHaveLength(1);
  });

  it("opens a single edit panel prefilled with markup and commission", async () => {
    render(<MarkupAdminPage />);
    await waitFor(() => expect(screen.getByText("Наценка (Markup)")).toBeTruthy());

    fireEvent.click(screen.getAllByText("Изменить")[0]);

    expect(screen.getByText("Изменить правило")).toBeTruthy();
    expect((screen.getByDisplayValue("2.5") as HTMLInputElement).value).toBe("2.5");
    expect((screen.getByDisplayValue("5") as HTMLInputElement).value).toBe("5");
  });

  it("hides editing controls without pricing.markup.manage", async () => {
    mocks.canManage = false;
    render(<MarkupAdminPage />);

    await waitFor(() => expect(screen.getAllByText("Kompastour").length).toBeGreaterThan(0));
    expect(screen.queryByText("+ Добавить правило")).toBeNull();
    expect(screen.queryByText("Изменить")).toBeNull();
  });
});
