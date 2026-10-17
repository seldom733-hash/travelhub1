"use client";

import { CaretDown } from "@phosphor-icons/react";
import { t, useLocale, type Locale } from "@/lib/i18n";
import { PICKER_LABEL } from "./picker-styles";

interface ChildAgesProps {
  count: number;
  ages: number[];
  onChange: (ages: number[]) => void;
}

const AGE_OPTIONS = Array.from({ length: 18 }, (_, i) => i); // 0-17

/** «0 → < 1 года», «1 → 1 год», ru: 2-4 «года», 5+ «лет» (az/en — одна форма). */
function ageLabel(option: number, locale: Locale): string {
  if (option === 0) return t("search.age_under_one", locale);
  if (option === 1) return t("search.age_one", locale);
  if (locale === "ru" && option < 5) return `${option} ${t("search.age_unit_few", locale)}`;
  return `${option} ${t("search.age_unit_many", locale)}`;
}

export default function ChildAges({ count, ages, onChange }: ChildAgesProps) {
  const locale = useLocale();
  if (count <= 0) return null;

  // Ensure ages array matches count
  const displayAges = ages.slice(0, count);
  while (displayAges.length < count) displayAges.push(0);

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
            {t("search.child_n", locale).replace("{n}", String(index + 1))}
          </span>
          <div className="relative">
            <select
              value={age}
              onChange={(e) => handleChange(index, Number(e.target.value))}
              className="appearance-none rounded-lg border border-dark-border bg-dark-card px-3 py-1.5 pr-7 text-[15px] text-white outline-none transition-colors focus:border-gold/50"
              aria-label={t("search.child_age_aria", locale).replace("{n}", String(index + 1))}
            >
              {AGE_OPTIONS.map((opt) => (
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
