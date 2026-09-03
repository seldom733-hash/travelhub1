// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent, type RenderResult } from "@testing-library/react";
import TravelerCollectionPanel, { type TravelerCollectionView } from "./TravelerCollectionPanel";
import { LocaleProvider } from "@/lib/i18n";

let canEdit = true;
let view: TravelerCollectionView;
const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("@/lib/use-can", () => ({
  useCan: (permission?: string) => {
    if (!permission) return true;
    if (permission === "order.edit_noncritical") return canEdit;
    return true;
  },
}));

function makeView(overrides: Partial<TravelerCollectionView> = {}): TravelerCollectionView {
  return {
    pinnedRequirements: {
      firstName: "REQUIRED",
      lastName: "REQUIRED",
      birthDate: "OPTIONAL",
      citizenship: "NOT_REQUESTED",
      gender: "NOT_REQUESTED",
      passportNumber: "NOT_REQUESTED",
      passportExpiry: "NOT_REQUESTED",
    },
    termsAcceptedAt: "2026-09-01T10:00:00.000Z",
    travelerDataCompletedAt: null,
    finalConfirmedAt: null,
    travelerCount: 1,
    travelers: [
      {
        id: "t1",
        firstName: "Иван",
        lastName: "Иванов",
        birthDate: null,
        citizenship: null,
        gender: null,
        passportNumber: null,
        passportExpiry: null,
        dataCompleteness: "INCOMPLETE",
      },
    ],
    ...overrides,
  };
}

function renderWithLocale(locale: "ru" | "az" | "en" = "ru"): RenderResult {
  window.localStorage.setItem("travelhub.locale", locale);
  return render(
    <LocaleProvider>
      <TravelerCollectionPanel orderId="order-1" />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  canEdit = true;
  view = makeView();
  apiMock.get.mockReset();
  apiMock.patch.mockReset();
  apiMock.post.mockReset();
  apiMock.get.mockResolvedValue(view);
  apiMock.patch.mockResolvedValue({ id: "t1" });
  apiMock.post.mockResolvedValue({});
});

describe("TravelerCollectionPanel (D3)", () => {
  it("рендерит поля из pinned requirements: REQUIRED visible + '*', OPTIONAL visible, NOT_REQUESTED hidden", async () => {
    renderWithLocale();
    // Форма загрузилась: значение firstName приходит из server-view (resume).
    await waitFor(() => expect(screen.getByDisplayValue("Иван")).toBeTruthy());
    expect(screen.getByText("Имя")).toBeTruthy();
    expect(screen.getByText("Фамилия")).toBeTruthy();
    expect(screen.getAllByText("*").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Дата рождения")).toBeTruthy();
    expect(screen.queryByText("Гражданство")).toBeNull();
    expect(screen.queryByText("Номер паспорта")).toBeNull();
  });

  it("multi-traveler: N форм (2 туриста), счётчик 'Турист 1 из 2'", async () => {
    view = makeView({
      travelerCount: 2,
      travelers: [
        { ...makeView().travelers[0] },
        { id: "t2", firstName: "Пётр", lastName: "Петров", birthDate: null, citizenship: null, gender: null, passportNumber: null, passportExpiry: null, dataCompleteness: "INCOMPLETE" },
      ],
    });
    apiMock.get.mockResolvedValue(view);
    renderWithLocale();
    await waitFor(() => expect(screen.getByText("Турист 1 из 2")).toBeTruthy());
    expect(screen.getByText("Турист 2 из 2")).toBeTruthy();
    expect(screen.getAllByDisplayValue("Иван").length).toBe(1);
    expect(screen.getAllByDisplayValue("Пётр").length).toBe(1);
    expect(screen.getAllByRole("textbox").length).toBe(4); // 2 туриста × (имя+фамилия) — TOUR
  });

  it("save: PATCH per traveler с изменёнными полями; затем refetch (refresh → resume)", async () => {
    renderWithLocale();
    await waitFor(() => expect(screen.getByDisplayValue("Иван")).toBeTruthy());
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[1], { target: { value: "Иванов-Новый" } });
    fireEvent.click(screen.getByText("Сохранить"));
    await waitFor(() => expect(apiMock.patch).toHaveBeenCalledTimes(1));
    expect(apiMock.patch).toHaveBeenCalledWith("/orders/order-1/travelers/t1", { firstName: "Иван", lastName: "Иванов-Новый" });
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/сохранены/i)).toBeTruthy();
  });

  it("final confirm: неполные данные (server complete:false) — ошибка, final-confirm не вызван", async () => {
    apiMock.post.mockImplementation(async (path: string) => {
      if (path.endsWith("/validate-completion")) return { complete: false, reason: "1 required field(s) missing: lastName (Пётр Петров)" };
      throw new Error("final-confirm must not be called");
    });
    renderWithLocale();
    await waitFor(() => expect(screen.getByDisplayValue("Иван")).toBeTruthy());
    const buttons = screen.getAllByText("Финальное подтверждение");
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(screen.getByText(/отклонено/)).toBeTruthy());
    expect(apiMock.post).not.toHaveBeenCalledWith("/orders/order-1/final-confirm");
  });

  it("final confirm: полные данные → validate-completion OK → final-confirm выполнен", async () => {
    apiMock.post.mockImplementation(async (path: string) => {
      if (path.endsWith("/validate-completion")) return { complete: true, reason: null, travelerDataCompletedAt: "2026-09-02T00:00:00.000Z" };
      if (path.endsWith("/final-confirm")) return { orderId: "order-1", finalConfirmedAt: "2026-09-02T01:00:00.000Z" };
      throw new Error("unexpected");
    });
    renderWithLocale();
    await waitFor(() => expect(screen.getByDisplayValue("Иван")).toBeTruthy());
    const buttons = screen.getAllByText("Финальное подтверждение");
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith("/orders/order-1/final-confirm"));
  });

  it("после finalConfirmedAt данные locked: input disabled, кнопки disabled", async () => {
    view = makeView({
      finalConfirmedAt: "2026-09-02T01:00:00.000Z",
      travelerDataCompletedAt: "2026-09-02T00:00:00.000Z",
      travelers: [{ ...makeView().travelers[0], dataCompleteness: "COMPLETE" }],
    });
    apiMock.get.mockResolvedValue(view);
    renderWithLocale();
    await waitFor(() => expect(screen.getByDisplayValue("Иван")).toBeTruthy());
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs.every((i) => i.disabled)).toBe(true);
    const saveBtn = screen.getByText("Сохранить") as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it("legacy order (pinned null) — информационная плашка вместо формы", async () => {
    view = makeView({ pinnedRequirements: null, termsAcceptedAt: null, travelerCount: null });
    apiMock.get.mockResolvedValue(view);
    renderWithLocale();
    await waitFor(() => expect(screen.getByText(/вне D3-потока/)).toBeTruthy());
  });

  it("RU/AZ/EN: REQUIRED-поля локализуются", async () => {
    let r = renderWithLocale("en");
    await waitFor(() => expect(screen.getByDisplayValue("Иван")).toBeTruthy());
    expect(screen.getByText("First name")).toBeTruthy();
    expect(screen.getByText("Last name")).toBeTruthy();
    r.unmount();
    r = renderWithLocale("az");
    await waitFor(() => expect(screen.getByDisplayValue("Иван")).toBeTruthy());
    expect(screen.getByText("Ad")).toBeTruthy();
    expect(screen.getByText("Soyad")).toBeTruthy();
    r.unmount();
  });
});