// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { useRef } from "react";
import { calcPanelMaxHeight, usePanelMaxHeight } from "./usePanelMaxHeight";

const MIN = 384; // 8 строк по ~48px — «нормальный список»

describe("calcPanelMaxHeight (список ≥8 элементов, не уезжает за экран)", () => {
  it("обычная форма: панель получает место до низа viewport", () => {
    expect(calcPanelMaxHeight(300, 800)).toBe(800 - 300 - 12);
  });

  it("у самого низа формы пол не даёт ужать список ниже 8 элементов", () => {
    // Раньше здесь получалось 58px (полоска на 1–2 строки) — теперь минимум.
    expect(calcPanelMaxHeight(500, 768)).toBe(MIN);
  });

  it("ровно на границе места — минимальная высота", () => {
    expect(calcPanelMaxHeight(768 - MIN - 12, 768)).toBe(MIN);
  });

  it("на сверхвысоком экране ограничение снимается совсем", () => {
    expect(calcPanelMaxHeight(100, 2000)).toBe(2000 - 100 - 12);
  });

  it("пол можно передать для нестандартной формы", () => {
    expect(calcPanelMaxHeight(500, 768, 200)).toBe(256); // места больше пола
    expect(calcPanelMaxHeight(600, 768, 200)).toBe(200); // пол побеждает
  });
});

function Harness({ open }: { open: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const maxHeight = usePanelMaxHeight(ref, open);
  return (
    <div>
      <div ref={ref} data-testid="container" />
      <output data-testid="max">{maxHeight === undefined ? "none" : String(maxHeight)}</output>
    </div>
  );
}

describe("usePanelMaxHeight (мост DOM → calc)", () => {
  it("панель закрыта — значение не считается (undefined)", () => {
    render(<Harness open={false} />);
    expect(document.querySelector('[data-testid="max"]')?.textContent).toBe("none");
  });

  it("открыта — maxHeight по геометрии контейнера и высоте окна", () => {
    const rect = {
      top: 260,
      bottom: 300,
      left: 0,
      right: 0,
      width: 0,
      height: 40,
      x: 0,
      y: 260,
      toJSON: () => ({}),
    } as DOMRect;
    const spy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockReturnValue(rect);

    render(<Harness open={true} />);

    // Верх панели = низ контейнера + 4px от mt-1.
    const expected = calcPanelMaxHeight(300 + 4, window.innerHeight);
    expect(document.querySelector('[data-testid="max"]')?.textContent).toBe(String(expected));
    expect(expected).toBeGreaterThanOrEqual(MIN);
    spy.mockRestore();
  });

  it("в jsdom без layout (rect=0) тоже считается и не меньше MIN", () => {
    render(<Harness open={true} />);
    const expected = calcPanelMaxHeight(0 + 4, window.innerHeight);
    expect(document.querySelector('[data-testid="max"]')?.textContent).toBe(String(expected));
    expect(expected).toBeGreaterThanOrEqual(MIN);
  });
});
