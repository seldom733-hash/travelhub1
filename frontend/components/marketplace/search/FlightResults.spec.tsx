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

describe("FlightResults itinerary columns", () => {
  function makeConnectingOffer(): FlightOffer {
    return makeOffer({
      segments: [
        {
          departure: { airport: "GYD", date: "2026-09-28T07:25:00" },
          arrival: { airport: "FRA", date: "2026-09-28T10:40:00" },
          duration: { minutes: 355 },
          operatingAirline: { code: "J2", flightNumber: "J2-123" },
          marketingAirline: { code: "J2", flightNumber: "J2-123" },
        },
        {
          departure: { airport: "FRA", date: "2026-09-28T13:05:00" },
          arrival: { airport: "IST", date: "2026-09-28T17:20:00" },
          duration: { minutes: 195 },
          operatingAirline: { code: "TK", flightNumber: "TK-1580" },
          marketingAirline: { code: "TK", flightNumber: "TK-1580" },
        },
      ],
    });
  }

  it("prints the whole chain in «Код» so a connection does not read as a separate destination", () => {
    render(<FlightResults flights={[makeConnectingOffer()]} />);
    expect(screen.getByText("GYD-FRA-IST")).toBeTruthy();
    expect(screen.queryByText("GYD-FRA")).toBeNull();
  });

  it("renders «Перевозчик» as the column right after «Код»", () => {
    render(<FlightResults flights={[makeConnectingOffer()]} />);
    const headers = [...screen.getAllByRole("columnheader")].map((th) => th.textContent ?? "");
    expect(headers[0]).toContain("Код");
    expect(headers[1]).toContain("Перевозчик");
  });

  it("resolves the carrier from the first segment's operating airline", () => {
    render(<FlightResults flights={[makeConnectingOffer()]} />);
    expect(screen.getByText("Azerbaijan Airlines")).toBeTruthy();
  });

  it("falls back to the raw IATA code for an unknown carrier", () => {
    render(
      <FlightResults
        flights={[
          makeOffer({
            segments: [
              {
                departure: { airport: "GYD", date: "2026-09-28T07:25:00" },
                arrival: { airport: "IST", date: "2026-09-28T10:40:00" },
                duration: { minutes: 195 },
                operatingAirline: { code: "ZZ", flightNumber: "ZZ-1" },
              },
            ],
          }),
        ]}
      />,
    );
    expect(screen.getByText("ZZ")).toBeTruthy();
  });
});
