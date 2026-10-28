"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * «Нормальный список»: минимум 8 видимых элементов по ~48px (самые высокие
 * строки — пикер поставщиков с аватаром). Панель раньше ужимали до 160px,
 * «спасая» кнопку «Найти», — список превращался в полоску на 1–2 строки.
 * Нынешний контракт: список большой, выбор в нём ЗАКРЫВАЕТ панель, «Найти»
 * снова кликабельна; пока панель открыта, она (z-60) лежит поверх кнопки —
 * это осознанно и не мешает: клик по строке = выбор + закрытие.
 */
const MIN_PANEL_PX = 384;
/** Воздух над нижним краем viewport: последняя строка списка должна быть видна. */
const VIEWPORT_GAP_PX = 12;

/**
 * Чистая геометрия maxHeight для панели дропдауна (absolute, `top-full mt-1`).
 *
 * Единственное ограничение — нижний край viewport: панель не должна уезжать
 * за экран. Пол `min` гарантирует ≥8 элементов списка даже у самого низа
 * формы.
 *
 * @param panelTop верх будущей панели (низ контейнера + 4px от `mt-1`)
 * @param viewportHeight высота видимой области
 * @param min минимальная высота (по умолчанию — 8 элементов списка)
 * @returns maxHeight в px
 */
export function calcPanelMaxHeight(
  panelTop: number,
  viewportHeight: number,
  min: number = MIN_PANEL_PX,
): number {
  return Math.max(min, viewportHeight - panelTop - VIEWPORT_GAP_PX);
}

/**
 * Считает maxHeight для панели, пока она открыта: при открытии и на resize
 * (перенос строк формы меняет геометрию). Панель и кнопки сдвигаются вместе
 * при скролле — пересчёт на scroll не нужен.
 */
export function usePanelMaxHeight(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  min: number = MIN_PANEL_PX,
): number | undefined {
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;

    const compute = () => {
      // Панель: `absolute top-full mt-1` → верх = низ контейнера + 4px.
      const panelTop = el.getBoundingClientRect().bottom + 4;
      setMaxHeight(calcPanelMaxHeight(panelTop, window.innerHeight, min));
    };

    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [open, ref]);

  return maxHeight;
}
