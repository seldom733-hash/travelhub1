// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import FlightResults from "./FlightResults";
import type { FlightOffer } from "@/lib/flight-api";

function makeOffer(overrides: Partial<FlightOffer> = {}): FlightOffer {
  return {
    optionId: "opt1",
    optionSetId: "set1",
    available: true,
    soldOut: false,
    requested: {
      from: "BAK",
      to: "LON",
      departureDate: "2026-09-28",
      tripType: "OW",
      passengers: { adults: 1, children: 0, infants: 0 },
    },
    segments: [
      {
        departure: { airport: "GYD", date: "2026-09-28T07:25:00" },
        arrival: { airport: "LGW", date: "2026-09-28T10:25:00" },
        duration: { minutes: 360 },
      },
    ],
    fares: [
      {
        id: "f1",
        fareFamily: "BUDGET",
        available: true,
        price: { total: { amount: 1064.02, currency: "AZN" } },
      },
    ],
    ...overrides,
  };
}

describe("FlightResults seat availability column", () => {
  it("shows availability header and 'Есть места' for available fare", () => {
    render(<FlightResults flights={[makeOffer()]} />);
    expect(screen.getByText("Места")).toBeTruthy();
    expect(screen.getByText("Есть места")).toBeTruthy();
    const buttons = screen.getAllByRole("button", { name: "Подать заявку" });
    expect(buttons).toHaveLength(1);
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(false);
  });

  it("marks unavailable fare with 'Нет мест' and disables the request button", () => {
    render(
      <FlightResults
        flights={[makeOffer({ fares: [{ id: "f1", fareFamily: "BUDGET", available: false, price: { total: { amount: 1064.02, currency: "AZN" } } }] })]}
      />,
    );
    expect(screen.getByText("Нет мест")).toBeTruthy();
    const buttons = screen.getAllByRole("button", { name: "Подать заявку" });
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it("marks every row of a sold-out flight with 'Нет мест'", () => {
    render(<FlightResults flights={[makeOffer({ soldOut: true })]} />);
    expect(screen.getAllByText("Нет мест")).toHaveLength(1);
    const buttons = screen.getAllByRole("button", { name: "Подать заявку" });
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
  });
});
