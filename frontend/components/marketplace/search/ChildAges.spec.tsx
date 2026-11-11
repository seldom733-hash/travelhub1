// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ChildAges from "./ChildAges";

describe("ChildAges — flight age ranges", () => {
  it("children are limited to 2–11 years and default to 2", () => {
    render(<ChildAges count={2} ages={[]} onChange={vi.fn()} minAge={2} maxAge={11} />);

    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(selects).toHaveLength(2);
    expect(selects[0].value).toBe("2");
    const options = [...selects[0].options].map((o) => Number(o.value));
    expect(options).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("infants are limited to 0–1 years and default to 0", () => {
    render(
      <ChildAges
        count={1}
        ages={[]}
        onChange={vi.fn()}
        minAge={0}
        maxAge={1}
        labelKey="search.infant_n"
        ageAriaKey="search.infant_age_aria"
      />,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("0");
    expect([...select.options].map((o) => Number(o.value))).toEqual([0, 1]);
  });

  it("clamps out-of-range saved ages into the allowed range", () => {
    const onChange = vi.fn();
    render(<ChildAges count={2} ages={[0, 15]} onChange={onChange} minAge={2} maxAge={11} />);

    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(selects[0].value).toBe("2");
    expect(selects[1].value).toBe("11");

    fireEvent.change(selects[0], { target: { value: "7" } });
    expect(onChange).toHaveBeenCalledWith([7, 11]);
  });
});
