// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import FlightDatePicker from "./FlightDatePicker";

describe("FlightDatePicker flight-day highlighting", () => {
  it("highlights dates with flights and reports the selected day", () => {
    const onChange = vi.fn();
    render(
      <FlightDatePicker
        id="flight-departure"
        label="Дата вылета"
        placeholder="Выберите дату"
        value="2026-10-10"
        onChange={onChange}
        availability={{ "2026-10-10": { amount: 359, currency: "AZN" } }}
      />,
    );

    // Open the calendar popup.
    fireEvent.click(screen.getByText("10.10.2026"));
    expect(screen.getByText("Октябрь 2026")).toBeTruthy();

    // Day with flights shows the price marker.
    expect(screen.getByText("359")).toBeTruthy();

    // Days without flights exist and have no price marker.
    const emptyDays = screen.getAllByTitle("Нет рейсов");
    expect(emptyDays.length).toBeGreaterThan(0);

    // Selecting a day reports ISO date.
    fireEvent.click(emptyDays[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("shows placeholder and loading state without a value", () => {
    render(
      <FlightDatePicker
        id="flight-departure"
        label="Дата вылета"
        placeholder="Выберите дату"
        value=""
        onChange={() => {}}
        availability={null}
        loadingAvailability
      />,
    );

    fireEvent.click(screen.getByText("Выберите дату"));
    expect(screen.getByText("Загрузка дат…")).toBeTruthy();
  });
});
