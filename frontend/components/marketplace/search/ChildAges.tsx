"use client";

import { CaretDown } from "@phosphor-icons/react";
import { t, useLocale, type Locale } from "@/lib/i18n";
import { PICKER_LABEL } from "./picker-styles";

interface ChildAgesProps {
  count: number;
  ages: number[];
  onChange: (ages: number[]) => void;
  /** Minimum selectable age (default 0). */
  minAge?: number;
  /** Maximum selectable age (default 17 for children). */
  maxAge?: number;
  /** i18n key for the per-picker label; `{n}` is replaced with the ordinal. */
  labelKey?: string;
  /** i18n key for aria-label; `{n}` is replaced with the ordinal. */
  ageAriaKey?: string;
}

const AGE_OPTIONS = Array.from({ length: 18 }, (_, i) => i); // 0-17

/** «0 → < 1 года», «1 → 1 год», ru: 2-4 «года», 5+ «лет» (az/en — одна форма). */
function ageLabel(option: number, locale: Locale): string {
  if (option === 0) return t("search.age_under_one", locale);
  if (option === 1) return t("search.age_one", locale);
  if (locale === "ru" && option < 5) return `${option} ${t("search.age_unit_few", locale)}`;
  return `${option} ${t("search.age_unit_many", locale)}`;
}

export default function ChildAges({ count, ages, onChange, minAge = 0, maxAge = 17, labelKey = "search.child_n", ageAriaKey = "search.child_age_aria" }: ChildAgesProps) {
  const locale = useLocale();
  if (count <= 0) return null;
  const ageOptions = AGE_OPTIONS.filter((age) => age >= minAge && age <= maxAge);

  // Ensure ages array matches count and stays inside the allowed range.
  const displayAges = ages
    .slice(0, count)
    .map((age) => Math.min(maxAge, Math.max(minAge, Number.isFinite(age) ? age : minAge)));
  while (displayAges.length < count) displayAges.push(minAge);

  const handleChange = (index: number, value: number) => {
    const newAges = [...displayAges];
    newAges[index] = value;
    onChange(newAges.slice(0, count));
  };

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {displayAges.map((age, index) => (
        <div key={index} className="flex flex-col items-center gap-0.5">
          <span className={`${PICKER_LABEL} text-center`}>
            {t(labelKey, locale).replace("{n}", String(index + 1))}
          </span>
          <div className="relative">
            <select
              value={age}
              onChange={(e) => handleChange(index, Number(e.target.value))}
              className="appearance-none rounded-lg border border-dark-border bg-dark-card px-3 py-1.5 pr-7 text-[15px] text-white outline-none transition-colors focus:border-gold/50"
              aria-label={t(ageAriaKey, locale).replace("{n}", String(index + 1))}
            >
              {ageOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {ageLabel(opt, locale)}
                </option>
              ))}
            </select>
            <CaretDown size={12} weight="light" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500" />
          </div>
        </div>
      ))}
    </div>
  );
}
