// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Pagination from "./Pagination";

describe("Pagination (Step 1.7 §9/§11)", () => {
  it("одна страница → ничего не рендерит", () => {
    const { container } = render(<Pagination page={1} totalPages={1} onChange={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("первая страница: Назад disabled, Вперёд enabled", () => {
    render(<Pagination page={1} totalPages={3} onChange={vi.fn()} />);
    const back = screen.getByRole("button", { name: /назад/i }) as HTMLButtonElement;
    const next = screen.getByRole("button", { name: /вперёд/i }) as HTMLButtonElement;
    expect(back.disabled).toBe(true);
    expect(next.disabled).toBe(false);
  });

  it("последняя страница: Вперёд disabled", () => {
    render(<Pagination page={3} totalPages={3} onChange={vi.fn()} />);
    const next = screen.getByRole("button", { name: /вперёд/i }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });

  it("клик Вперёд вызывает onChange(page+1)", () => {
    const onChange = vi.fn();
    render(<Pagination page={2} totalPages={5} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /вперёд/i }));
    expect(onChange).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole("button", { name: /назад/i }));
    expect(onChange).toHaveBeenCalledWith(1);
  });
});
