// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n";
import PaymentsPage from "./payments/page";
import DocumentsPage from "./documents/page";
import SupportPage from "./support/page";

const { paymentsMock, documentsMock, supportMock } = vi.hoisted(() => ({
  paymentsMock: vi.fn(),
  documentsMock: vi.fn(),
  supportMock: vi.fn(),
}));

vi.mock("@/lib/account-api", () => ({
  accountApi: {
    getPayments: paymentsMock,
    getDocuments: documentsMock,
    getSupport: supportMock,
  },
}));

const EMPTY = { items: [], total: 0, available: false } as const;

const CASES = [
  { name: "payments", page: PaymentsPage, mock: paymentsMock, title: "Мои платежи", empty: "Платежей пока нет", icon: "💳" },
  { name: "documents", page: DocumentsPage, mock: documentsMock, title: "Мои документы", empty: "Документов пока нет", icon: "📄" },
  { name: "support", page: SupportPage, mock: supportMock, title: "Поддержка", empty: "Обращений пока нет", icon: "🎧" },
] as const;

function renderWithLocale(ui: React.ReactElement, locale: "ru" | "az" | "en" = "ru") {
  window.localStorage.setItem("travelhub.locale", locale);
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

beforeEach(() => {
  window.localStorage.clear();
  paymentsMock.mockReset();
  documentsMock.mockReset();
  supportMock.mockReset();
});

describe("Buyer Cabinet empty-section pages (Step 1.13 §27 — обязательные tests)", () => {
  for (const c of CASES) {
    describe(c.name, () => {
      it("loading: скелетон с aria-busy, без контента (§28.9-12)", async () => {
        let resolveFn!: (v: typeof EMPTY) => void;
        c.mock.mockReturnValue(new Promise<typeof EMPTY>((res) => (resolveFn = res)));
        const { container } = renderWithLocale(<c.page />);
        expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
        expect(screen.queryByText(c.empty)).toBeNull();
        await act(async () => {
          resolveFn(EMPTY);
        });
        expect(screen.getByText(c.empty)).toBeTruthy();
      });

      it("controlled empty: available:false → neutral empty state, БЕЗ fake content (§25)", async () => {
        c.mock.mockResolvedValue(EMPTY);
        await act(async () => {
          renderWithLocale(<c.page />);
        });
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(c.title);
        expect(screen.getByText(c.empty)).toBeTruthy();
        // Никаких fake records/KPI/времён.
        expect(screen.queryByText(/ORD-/)).toBeNull();
        expect(screen.queryByText(/BKG-/)).toBeNull();
        expect(screen.queryByText(/CUS-/)).toBeNull();
      });

      it("error: сбой API → controlled error state, без fake контента", async () => {
        c.mock.mockRejectedValue(new Error("HTTP 403"));
        await act(async () => {
          renderWithLocale(<c.page />);
        });
        await waitFor(() => expect(screen.getByText("HTTP 403")).toBeTruthy());
        expect(screen.queryByText(c.empty)).toBeNull();
      });

      it("localization EN: заголовок и empty state локализованы (§28.13)", async () => {
        c.mock.mockResolvedValue(EMPTY);
        await act(async () => {
          renderWithLocale(<c.page />, "en");
        });
        const enTitles: Record<string, string> = {
          payments: "My payments",
          documents: "My documents",
          support: "Support",
        };
        const enEmpties: Record<string, string> = {
          payments: "No payments yet",
          documents: "No documents yet",
          support: "No support requests yet",
        };
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(enTitles[c.name]);
        expect(screen.getByText(enEmpties[c.name])).toBeTruthy();
      });

      it("RU/AZ: ключевые строки переведены на az", async () => {
        c.mock.mockResolvedValue(EMPTY);
        await act(async () => {
          renderWithLocale(<c.page />, "az");
        });
        const azEmpties: Record<string, string> = {
          payments: "Hələ ödəniş yoxdur",
          documents: "Hələ sənəd yoxdur",
          support: "Hələ müraciət yoxdur",
        };
        expect(screen.getByText(azEmpties[c.name])).toBeTruthy();
      });
    });
  }
});
