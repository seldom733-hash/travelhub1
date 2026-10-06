// @vitest-environment jsdom
/**
 * Supplier Markup (PHASE 4 §4.1/§4.2) — Admin matrix page.
 *
 * Рендер матрицы из API (строки/колонки приходят с backend, не хардкодятся);
 * клик по ячейке открывает create-form с prefill key; RBAC-гейт
 * pricing.markup.manage (без права — ни кнопок, ни кликабельных ячеек);
 * create → POST body; update-409 (CAS) показывает серверное сообщение;
 * нечисловая ставка блокируется клиентской валидацией (сервер — authority).
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { api } from "@/lib/api";
import MarkupAdminPage from "./page";

const mocks = vi.hoisted(() => ({ canManage: true }));

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  auth: { token: null, setToken: vi.fn(), clear: vi.fn(), subscribe: vi.fn() },
}));

vi.mock("@/lib/use-can", () => ({ useCan: () => mocks.canManage }));

const getMock = api.get as Mock;
const postMock = api.post as Mock;
const patchMock = api.patch as Mock;

const DRAFT_RULE = {
  id: "r1",
  code: "MKR-00000001",
  supplierCode: "KOMPAS",
  serviceType: "tours",
  rate: "0.075",
  status: "DRAFT",
  version: 1,
  effectiveFrom: "2026-01-01T00:00:00.000Z",
  effectiveTo: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const LIST = { items: [DRAFT_RULE], page: 1, pageSize: 20, total: 1 };

const CONFIGURED_MATRIX = {
  at: "2026-10-06T00:00:00.000Z",
  services: ["tours"],
  suppliers: [{ code: "KOMPAS", name: "Kompas Tour", enabled: true }],
  cells: [
    {
      supplierCode: "KOMPAS",
      serviceType: "tours",
      state: "CONFIGURED",
      rate: "0.075",
      ruleCode: "MKR-00000001",
      ruleVersion: 1,
    },
  ],
};

const NOT_CONFIGURED_MATRIX = {
  ...CONFIGURED_MATRIX,
  cells: [
    { supplierCode: "KOMPAS", serviceType: "tours", state: "NOT_CONFIGURED", rate: "0", ruleCode: null, ruleVersion: null },
  ],
};

function mockRoutes(matrix: unknown = CONFIGURED_MATRIX) {
  getMock.mockImplementation((url: string) => {
    if (url.startsWith("/pricing/markup-matrix")) return Promise.resolve(matrix);
    if (url.includes("/history")) return Promise.resolve({ items: [] });
    if (url.startsWith("/pricing/markup-rules")) return Promise.resolve(LIST);
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
  postMock.mockResolvedValue(DRAFT_RULE);
  patchMock.mockResolvedValue(DRAFT_RULE);
}

const supplierInput = () => document.querySelector('input[list="markup-supplier-codes"]') as HTMLInputElement;
const serviceInput = () => document.querySelector('input[list="markup-service-types"]') as HTMLInputElement;
const rateInput = () => document.querySelector('input[placeholder="0.05"]') as HTMLInputElement;

describe("MarkupAdminPage — Supplier × Service matrix + rules (§4.1/§4.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canManage = true;
    mockRoutes();
  });

  it("рендерит матрицу из API: поставщик, rate в %, CONFIGURED без «не настроен»", async () => {
    render(<MarkupAdminPage />);
    await waitFor(() => expect(getMock).toHaveBeenCalledWith("/pricing/markup-matrix"));

    expect(screen.getByText("Kompas Tour")).toBeTruthy();
    expect(screen.getAllByText("7.5%").length).toBeGreaterThan(0);
    expect(screen.queryByText("не настроен")).toBeNull();
    // rules list тоже загружен
    expect(getMock).toHaveBeenCalledWith("/pricing/markup-rules?page=1&pageSize=20");
    expect(screen.getByText("MKR-00000001")).toBeTruthy();
  });

  it("NOT_CONFIGURED ячейка: 0% + «не настроен» (отличима от сконфигурированного 0%)", async () => {
    mockRoutes(NOT_CONFIGURED_MATRIX);
    render(<MarkupAdminPage />);
    await waitFor(() => expect(getMock).toHaveBeenCalledWith("/pricing/markup-matrix"));

    expect(screen.getByText("0%")).toBeTruthy();
    expect(screen.getByText("не настроен")).toBeTruthy();
  });

  it("клик по ячейке (manage) открывает create-form с prefill поставщик+сервис", async () => {
    render(<MarkupAdminPage />);
    await waitFor(() => expect(getMock).toHaveBeenCalledWith("/pricing/markup-matrix"));

    fireEvent.click(screen.getByTitle("MKR-00000001 v1"));
    expect(supplierInput().value).toBe("KOMPAS");
    expect(serviceInput().value).toBe("tours");
    expect(screen.getByText("Новое правило наценки")).toBeTruthy();
  });

  it("без pricing.markup.manage: нет create/activate/edit, ячейка не кликабельна; history доступна (read)", async () => {
    mocks.canManage = false;
    render(<MarkupAdminPage />);
    await waitFor(() => expect(getMock).toHaveBeenCalledWith("/pricing/markup-matrix"));

    expect(screen.queryByText("Создать правило")).toBeNull();
    expect(screen.queryByText("Активировать")).toBeNull();
    expect(screen.queryByText("Изм.")).toBeNull();
    expect(screen.getByText("История")).toBeTruthy();
    const cell = screen.getByTitle("MKR-00000001 v1");
    expect(cell.tagName).toBe("SPAN");
  });

  it("create: POST /pricing/markup-rules с body (server-authoritative валидация на бэке)", async () => {
    render(<MarkupAdminPage />);
    await waitFor(() => expect(getMock).toHaveBeenCalledWith("/pricing/markup-matrix"));

    fireEvent.click(screen.getByText("Создать правило"));
    fireEvent.change(supplierInput(), { target: { value: "KOMPAS" } });
    fireEvent.change(serviceInput(), { target: { value: "tours" } });
    fireEvent.change(rateInput(), { target: { value: "0.1" } });
    fireEvent.click(screen.getByText("Сохранить"));

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith("/pricing/markup-rules", {
        supplierCode: "KOMPAS",
        serviceType: "tours",
        rate: "0.1",
        effectiveFrom: undefined,
        effectiveTo: undefined,
      }),
    );
  });

  it("клиентская валидация ставки: «10» (percent-as-number) блокирует отправку", async () => {
    render(<MarkupAdminPage />);
    await waitFor(() => expect(getMock).toHaveBeenCalledWith("/pricing/markup-matrix"));

    fireEvent.click(screen.getByText("Создать правило"));
    fireEvent.change(supplierInput(), { target: { value: "KOMPAS" } });
    fireEvent.change(serviceInput(), { target: { value: "tours" } });
    fireEvent.change(rateInput(), { target: { value: "10" } });
    fireEvent.click(screen.getByText("Сохранить"));

    await waitFor(() => expect(screen.getByText(/Ставка: 0 ≤ x < 1/)).toBeTruthy());
    expect(postMock).not.toHaveBeenCalled();
  });

  it("update с stale версии: серверный 409 показывается и список перечитывается (CAS)", async () => {
    render(<MarkupAdminPage />);
    await waitFor(() => expect(getMock).toHaveBeenCalledWith("/pricing/markup-rules?page=1&pageSize=20"));

    fireEvent.click(screen.getByText("Изм."));
    expect(screen.getByText("Редактирование правила")).toBeTruthy();
    patchMock.mockRejectedValueOnce(
      new Error("MarkupRule MKR-00000001 was modified concurrently (expected v1, current v2) — reload and retry"),
    );
    fireEvent.click(screen.getByText("Сохранить"));

    await waitFor(() => expect(screen.getByText(/was modified concurrently/)).toBeTruthy());
    await waitFor(() =>
      expect((getMock as Mock).mock.calls.filter((c) => String(c[0]).startsWith("/pricing/markup-rules")).length).toBeGreaterThan(1),
    );
  });

  it("history открывается в панели (MarkupRuleHistory audit)", async () => {
    render(<MarkupAdminPage />);
    await waitFor(() => expect(getMock).toHaveBeenCalledWith("/pricing/markup-rules?page=1&pageSize=20"));

    fireEvent.click(screen.getByText("История"));
    await waitFor(() =>
      expect(getMock).toHaveBeenCalledWith("/pricing/markup-rules/MKR-00000001/history"),
    );
    await waitFor(() => expect(screen.getByText("История изменений")).toBeTruthy());
  });
});
