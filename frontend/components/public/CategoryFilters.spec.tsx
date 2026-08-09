// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CategoryFilters from "./CategoryFilters";
import type { PublicFilterMetadata } from "@/lib/public-api";

function meta(): PublicFilterMetadata {
  return {
    category: { id: "c1", slug: "tours", title: "Tours" },
    filters: [
      { key: "days", label: "Days", type: "integer", min: 1 },
      { key: "level", label: "Level", type: "enum", options: ["easy", "hard"] },
      { key: "family", label: "Family", type: "boolean" },
    ],
    availability: { enabled: true, dateRequired: true },
    sort: ["newest", "price_asc", "price_desc"],
  };
}

describe("CategoryFilters (Step 1.7 §10 — dynamic controls from metadata)", () => {
  it("строит контролы по типам: number input, select с опциями, checkbox", () => {
    render(<CategoryFilters meta={meta()} applied={{}} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Days")).toBeTruthy(); // number input
    const level = screen.getByLabelText("Level") as HTMLSelectElement;
    expect(level.tagName).toBe("SELECT");
    expect(level.querySelectorAll("option").length).toBe(3); // — + easy + hard
    expect(screen.getByLabelText("Family")).toBeTruthy(); // checkbox (label "Да")
  });

  it("Apply передаёт введённые значения через onChange", () => {
    const onChange = vi.fn();
    render(<CategoryFilters meta={meta()} applied={{}} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Days"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Level"), { target: { value: "hard" } });
    fireEvent.click(screen.getByRole("button", { name: /применить/i }));
    expect(onChange).toHaveBeenCalledWith({ days: "7", level: "hard" });
  });

  it("Reset очищает draft и вызывает onChange({})", () => {
    const onChange = vi.fn();
    render(<CategoryFilters meta={meta()} applied={{ days: "7" }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /сбросить/i }));
    expect(onChange).toHaveBeenCalledWith({});
  });

  it("без фильтров в metadata — ничего не рендерит", () => {
    const { container } = render(
      <CategoryFilters meta={{ ...meta(), filters: [] }} applied={{}} onChange={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
