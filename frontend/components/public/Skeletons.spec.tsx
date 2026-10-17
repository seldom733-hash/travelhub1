// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PdpSkeleton, ProductGridSkeleton } from "./Skeletons";

/**
 * §PDP-SKELETON-PARITY (2026-10-16) — контракт геометрии.
 *
 * Скелетон PDP обязан повторять РЕАЛЬНУЮ карточку тура/отеля, иначе переход с
 * витрины на карточку показывает «тень старой карточки»: серая раскладка стоит
 * зеркально к финальному виду. Источник истины — `components/supplier/TourDetail.tsx`
 * (`grid gap-6 lg:grid-cols-[340px_1fr]`: панель подбора слева, медиа справа).
 * Тест падает, если раскладку снова отведут от карточки.
 */
describe("Skeletons §PDP-SKELETON-PARITY", () => {
  it("PdpSkeleton повторяет сетку живой карточки: 340px панель слева, медиа справа", () => {
    const { container } = render(<PdpSkeleton />);
    const grid = container.querySelector(".lg\\:grid-cols-\\[340px_1fr\\]");
    expect(grid).toBeTruthy();
    // Зеркальная (доравенства) раскладка не должна вернуться.
    expect(container.querySelector(".lg\\:grid-cols-\\[2fr_1fr\\]")).toBeNull();
    // Первый (левый) столбец — панель подбора; второй — медиа 16:9.
    const columns = grid?.children as HTMLCollection;
    expect(columns.length).toBe(2);
    expect(columns[0].querySelectorAll(".rounded-2xl").length).toBeGreaterThan(0);
    expect(columns[1].querySelector(".aspect-\\[16\\/9\\]")).toBeTruthy();
  });

  it("PdpSkeleton: панель подбора содержит 4 поля (город/взрослые/дети/ночи)", () => {
    const { container } = render(<PdpSkeleton />);
    // Источник истины: `TourDetail.tsx:141-250` — `space-y-4 rounded-2xl ... p-5` c 4 полями.
    const card = container.querySelector(".rounded-2xl.border-slate-200.bg-white.p-5.space-y-4");
    expect(card).toBeTruthy();
    expect(card?.children.length).toBe(4);
  });

  it("PdpSkeleton: календарь цен — белая карточка с сеткой `grid-cols-7` (7 + 42 ячеек `h-16`)", () => {
    const { container } = render(<PdpSkeleton />);
    // Источник истины: `TourDetail.tsx:267-282` + `MonthlyCalendar.tsx:455-483`.
    const grids = container.querySelectorAll(".grid-cols-7");
    expect(grids.length).toBe(2);
    expect(grids[1].querySelectorAll(".h-16").length).toBe(42);
    // Календарь — в белой карточке, а не серым блоком.
    expect(grids[0].closest(".bg-white")).toBeTruthy();
  });

  it("PdpSkeleton помечен как busy и не содержит текста-заглушки", () => {
    render(<PdpSkeleton />);
    expect(screen.getByLabelText("loading").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("ProductGridSkeleton сохраняет сетку карточек витрины", () => {
    const { container } = render(<ProductGridSkeleton count={3} />);
    expect(container.querySelectorAll(".aspect-\\[16\\/9\\]").length).toBe(3);
    expect(container.querySelector(".grid.gap-4")).toBeTruthy();
  });
});
