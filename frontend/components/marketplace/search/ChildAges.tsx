"use client";

import { CaretDown } from "@phosphor-icons/react";

interface ChildAgesProps {
  count: number;
  ages: number[];
  onChange: (ages: number[]) => void;
}

const AGE_OPTIONS = Array.from({ length: 18 }, (_, i) => i); // 0-17

export default function ChildAges({ count, ages, onChange }: ChildAgesProps) {
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
          <span className="text-[10px] text-neutral-500">Ребёнок {index + 1}</span>
          <div className="relative">
            <select
              value={age}
              onChange={(e) => handleChange(index, Number(e.target.value))}
              className="appearance-none rounded-lg border border-dark-border bg-dark-card px-3 py-1.5 pr-7 text-[13px] text-white outline-none transition-colors focus:border-gold/50"
              aria-label={`Возраст ребёнка ${index + 1}`}
            >
              {AGE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === 0 ? "< 1" : `${opt} ${opt === 1 ? "год" : opt < 5 ? "года" : "лет"}`}
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
