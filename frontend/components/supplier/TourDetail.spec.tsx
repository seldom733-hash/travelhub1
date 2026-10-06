// @vitest-environment jsdom
/**
 * §4.9.4 Request Modal — calendar → modal wiring (4.8.11 hint included):
 * a click on an available price cell in the monthly calendar opens the rich
 * OfferModal with the correct tour and date.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import TourDetail from "./TourDetail";
import { getPriceCalendar } from "@/lib/supplier-api";

vi.mock("@/lib/supplier-api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/supplier-api")>();
  return { ...mod, getPriceCalendar: vi.fn() };
});
vi.mock("@/lib/supplier-registry", () => ({
  useSupplierOptions: vi.fn(() => [{ code: "KOMPAS", name: "Kompas" }]),
  supplierLabel: vi.fn((_options: unknown, code: string) => code),
}));
vi.mock("@/lib/use-user", () => ({ useCurrentUser: vi.fn(() => null) }));

const getPriceCalendarMock = getPriceCalendar as ReturnType<typeof vi.fn>;

const TODAY = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
// A day inside the current month so the initial calendar view shows it.
const DAY = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, "0")}-15`;

const OFFER = {
  tourIncValue: "t1",
  externalOfferId: "offer-1",
  hotel: "Rixos Dubai\n(Бараш)",
  hotelExternalId: "2807",
  departureDate: "2026-09-19",
  nights: 7,
  room: "DBL",
  meal: "AI",
  adults: 2,
  children: 0,
  childAges: [],
  availability: "AVAILABLE",
  price: 1050,
  currency: "USD",
};

beforeEach(() => {
  vi.clearAllMocks();
  getPriceCalendarMock.mockResolvedValue({
    entries: [
      { date: DAY, price: 1050, currency: "USD", availability: "AVAILABLE", offers: [OFFER] },
    ],
    dateFrom: `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, "0")}-01`,
    dateTo: `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, "0")}-28`,
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    totalOffersScanned: 1,
  });
});

function renderTour() {
  return render(
    <TourDetail
      attributes={{
        supplierCode: "KOMPAS",
        hotelExternalId: "2807",
        destination: "Sharm el-Sheikh",
        departureCity: "1411",
      }}
      title="Rixos Dubai"
      description="Nice hotel"
    />,
  );
}

describe("TourDetail calendar → OfferModal (§4.9.4)", () => {
  it("calendar price click opens the modal with the correct tour/date", async () => {
    renderTour();

    // Calendar hint (4.8.11) is visible near the price calendar.
    expect(
      screen.getByText(/Нажмите на цену, чтобы посмотреть варианты/),
    ).toBeTruthy();
    // Explicit step-by-step guidance on how to submit a request (Phase 4)
    expect(screen.getByText("Как подать заявку")).toBeTruthy();

    const day = await screen.findByRole("button", { name: DAY });
    expect((day as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(day);

    expect(screen.getByRole("heading", { name: "Подать заявку" })).toBeTruthy();
    expect(screen.getByText(DAY)).toBeTruthy(); // selected calendar date in modal header
    expect(screen.getByText("Варианты размещения и цены")).toBeTruthy();
    expect(screen.getAllByText("Rixos Dubai").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the price calendar with an available price cell", async () => {
    renderTour();
    const day = await screen.findByRole("button", { name: DAY });
    expect(day.textContent).toMatch(/1\s*050/);
  });
});
