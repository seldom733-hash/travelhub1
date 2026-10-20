"use client";

import { CaretDown } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import { useWidestText } from "@/lib/measure-text";
import { PICKER_CONTROL, PICKER_LABEL } from "./picker-styles";

/** Правый отступ: место под свой шеврон (right-2 + иконка 12px + зазор). */
const CARET_PAD = 24;
/** Запас на расхождение canvas-замера и рендера. */
const WIDTH_SLACK = 4;

interface NightsSelectProps {
  /** id контрола — "tour-nights" / "hotel-nights". */
  id: string;
  value: number;
  /** Selectable night values (supplier capability bounds). */
  options: number[];
  onChange: (value: number) => void;
}

/**
 * «Ночи»: одно значение вместо диапазона «от–до».
 *
 * Формы поиска передают ровно одну длительность, поэтому запрос уходит с
 * nightsFrom = nightsTo = value — поставщик не перебирает лишние комбинации.
 * Размеры берутся из picker-styles (единый размер для всех форм поиска).
 */
export default function NightsSelect({ id, value, options, onChange }: NightsSelectProps) {
  const locale = useLocale();
  // Content-width: двузначное число («30») + свой шеврон.
  const digitPx = useWidestText(options.map(String));
  // At least two digits must fit even if canvas measurement underestimates
  // the rendered select (padding + caret). 64px covers "10".."30" comfortably.
  const controlWidth = Math.max(64, digitPx > 0 ? digitPx + CARET_PAD + WIDTH_SLACK : 64);

  return (
    <div className="flex flex-col">
      <label htmlFor={id} className={PICKER_LABEL}>
        {t("search.nights", locale)}
      </label>
      <div className="relative" style={{ width: controlWidth, maxWidth: controlWidth }}>
        <select
          id={id}
          value={value}
          aria-label={t("search.nights", locale)}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`${PICKER_CONTROL} cursor-pointer appearance-none`}
          style={{ paddingRight: CARET_PAD }}
        >
          {options.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <CaretDown
          size={12}
          weight="light"
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500"
        />
      </div>
    </div>
  );
}
