"use client";

import { CaretDown } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import { useWidestText } from "@/lib/measure-text";
import { PICKER_CONTROL, PICKER_LABEL } from "./picker-styles";

/** Правый отступ: место под свой шеврон (right-2 + иконка 12px + зазор). */
const CARET_PAD = 24;
/** Запас на расхождение canvas-замера и рендера. */
const WIDTH_SLACK = 4;

interface NightsRangeProps {
  /** id prefix — "tour-nights" / "hotel-nights" → -from / -to selects. */
  idPrefix: string;
  from: number;
  to: number;
  /** Selectable night values (supplier capability bounds). */
  options: number[];
  onChange: (from: number, to: number) => void;
}

/**
 * «Ночи»: два select'а с инвариантом from ≤ to.
 *
 * Раскладка (запрос владельца): подписи «от»/«до» вынесены ИЗ контролов и стоят
 * НАД ними, слово «Ночи» — по центру, над тире между контролами. Внутри
 * контрола остаётся только число, поэтому ширина считается по двузначному
 * значению, а не по префиксу, и контролы стали узкими.
 *
 * Размеры берутся из picker-styles (единый размер для ВСЕХ форм поиска).
 */
export default function NightsRange({ idPrefix, from, to, options, onChange }: NightsRangeProps) {
  const locale = useLocale();
  // Свой шеврон вместо нативного: у нативного <select> стрелка рисуется внутри
  // content-box и при большом padding-left съедала значение.
  const selectClass = `${PICKER_CONTROL} cursor-pointer appearance-none`;

  const handleFrom = (value: number) => onChange(value, value > to ? value : to);
  const handleTo = (value: number) => onChange(value < from ? value : from, value);

  // Content-width: двузначное число («30») + свой шеврон. Префиксы больше не
  // участвуют — они вне контрола. useWidestText is SSR-safe (0 on server).
  const digitPx = useWidestText(options.map(String));
  const controlWidth = digitPx > 0 ? digitPx + CARET_PAD + WIDTH_SLACK : undefined;

  const renderSelect = (kind: "from" | "to") => {
    const value = kind === "from" ? from : to;
    const label = kind === "from" ? t("search.nights_from", locale) : t("search.nights_to", locale);
    return (
      <div className="flex flex-col">
        <label htmlFor={`${idPrefix}-${kind}`} className={PICKER_LABEL}>
          {label}
        </label>
        <div className="relative" style={{ width: controlWidth, maxWidth: controlWidth }}>
          <select
            id={`${idPrefix}-${kind}`}
            value={value}
            aria-label={`${t("search.nights", locale)} ${label}`}
            onChange={(e) => (kind === "from" ? handleFrom(Number(e.target.value)) : handleTo(Number(e.target.value)))}
            className={selectClass}
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
  };

  return (
    <div className="flex items-end gap-3">
      {renderSelect("from")}
      {/* «Ночи» — между контролами, над тире. Текст декоративный: смысл уже в
          aria-label каждого select'а. */}
      <div className="flex flex-col items-center pb-3">
        <span className={PICKER_LABEL} aria-hidden="true">
          {t("search.nights", locale)}
        </span>
        <span aria-hidden="true" className="shrink-0 leading-none text-neutral-500">
          -
        </span>
      </div>
      {renderSelect("to")}
    </div>
  );
}
