// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import FlightDatePicker from "./FlightDatePicker";

const MONTH_NAMES_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

function isoOf(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

describe("FlightDatePicker flight-day highlighting", () => {
  it("highlights dates with flights and reports the selected day", () => {
    const onChange = vi.fn();
    // Future date (+30 days) keeps the whole viewed month selectable,
    // so the test does not depend on the day it runs (past days are disabled).
    const flightDate = new Date();
    flightDate.setDate(flightDate.getDate() + 30);
    const iso = isoOf(flightDate);
    const display = `${String(flightDate.getDate()).padStart(2, "0")}.${String(flightDate.getMonth() + 1).padStart(2, "0")}.${flightDate.getFullYear()}`;

    render(
      <FlightDatePicker
        id="flight-departure"
        label="Дата вылета"
        placeholder="Выберите дату"
        value={iso}
        onChange={onChange}
        availability={{ [iso]: { amount: 359, currency: "AZN" } }}
      />,
    );

    // Open the calendar popup.
    fireEvent.click(screen.getByText(display));
    expect(
      screen.getByText(`${MONTH_NAMES_RU[flightDate.getMonth()]} ${flightDate.getFullYear()}`),
    ).toBeTruthy();

    // Day with flights shows the price marker.
    expect(screen.getByText("359")).toBeTruthy();

    // Days without flights exist, are selectable and have no price marker.
    const emptyDays = screen
      .getAllByTitle("Нет рейсов")
      .filter((el) => !el.hasAttribute("disabled"));
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
