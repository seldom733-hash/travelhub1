// @vitest-environment jsdom
/**
 * §4.9.4 → INLINE (2026-10-13): the calendar day click no longer opens the
 * §4.8 modal — the day's tariffs render INLINE under the calendar in a
 * DayTariffsPanel, and the NEAREST priced day is selected by default.
 *
 * Contract covered here:
 *  1. a click on an available price cell switches the inline panel to that day
 *  2. the calendar renders an available price cell
 *  3. the nearest priced day is selected on load (no click needed)
 *  4. a per-tariff «Оформить заявку» exists for every offer of the day
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// A day inside the current month so the initial calendar view shows it.
const DAY = `${TODAY.getFullYear()}-${pad(TODAY.getMonth() + 1)}-15`;
// A LATER day in the same month — used to prove the click switches the panel.
const OTHER_DAY = `${TODAY.getFullYear()}-${pad(TODAY.getMonth() + 1)}-20`;

const offerFor = (date: string, id: string, price: number) => ({
  tourIncValue: "t1",
  externalOfferId: id,
  hotel: "Rixos Dubai\n(Бараш)",
  hotelExternalId: "2807",
  departureDate: date,
  nights: 7,
  room: "DBL",
  meal: "AI",
  adults: 2,
  children: 0,
  childAges: [],
  availability: "AVAILABLE",
  price,
  currency: "USD",
});

beforeEach(() => {
  vi.clearAllMocks();
  getPriceCalendarMock.mockResolvedValue({
    entries: [
      { date: DAY, price: 1050, currency: "USD", availability: "AVAILABLE", offers: [offerFor(DAY, "offer-1", 1050)] },
      { date: OTHER_DAY, price: 900, currency: "USD", availability: "AVAILABLE", offers: [offerFor(OTHER_DAY, "offer-2", 900)] },
    ],
    dateFrom: `${TODAY.getFullYear()}-${pad(TODAY.getMonth() + 1)}-01`,
    dateTo: `${TODAY.getFullYear()}-${pad(TODAY.getMonth() + 1)}-28`,
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    totalOffersScanned: 2,
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

describe("TourDetail calendar → INLINE day tariffs (§4.9.4, no modal)", () => {
  it("selects the NEAREST priced day by default and shows its tariffs inline", async () => {
    renderTour();

    // Calendar hint (4.8.11) is visible near the price calendar.
    expect(
      screen.getByText(/Нажмите на цену, чтобы посмотреть варианты/),
    ).toBeTruthy();
    // Explicit step-by-step guidance on how to submit a request (Phase 4)
    expect(screen.getByText("Как подать заявку")).toBeTruthy();

    // The nearest priced day of the loaded month is picked WITHOUT a click.
    const panel = await screen.findByRole("region", { name: /Подать заявку/ });
    expect(within(panel).getAllByText(DAY).length).toBeGreaterThan(0);
    // Its tariff is listed with a per-offer submit button.
    expect(within(panel).getByText("Варианты размещения и цены")).toBeTruthy();
    expect(within(panel).getAllByText("Rixos Dubai").length).toBeGreaterThanOrEqual(1);
    expect(within(panel).getAllByRole("button", { name: "Подать заявку" }).length).toBe(1);

    // No modal: the panel is inline, never a fixed overlay.
    expect(document.querySelector(".fixed.inset-0")).toBeNull();
  });

  it("clicking another priced day switches the inline panel to that day", async () => {
    renderTour();

    const otherDay = await screen.findByRole("button", { name: OTHER_DAY });
    expect((otherDay as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(otherDay);

    const panel = await screen.findByRole("region", { name: /Подать заявку/ });
    expect(within(panel).getAllByText(OTHER_DAY).length).toBeGreaterThan(0);
    // The other day carries its own tariff row.
    expect(within(panel).getAllByRole("button", { name: "Подать заявку" }).length).toBe(1);
  });

  it("renders the price calendar with an available price cell", async () => {
    renderTour();
    const day = await screen.findByRole("button", { name: DAY });
    expect(day.textContent).toMatch(/1\s*050/);
  });
});
