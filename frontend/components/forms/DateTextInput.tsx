"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Date input with BOTH:
 *  - manual entry (`дд.мм.гггг`, text);
 *  - calendar picker (native date input opened by the calendar button).
 * The public value is ISO (`yyyy-mm-dd`).
 */
export default function DateTextInput({
  value,
  onChange,
  className,
  placeholder = "дд.мм.гггг",
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(toDisplay(value));
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(toDisplay(value));
  }, [value]);

  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let next = digits;
    if (digits.length > 4) next = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
    else if (digits.length > 2) next = `${digits.slice(0, 2)}.${digits.slice(2)}`;
    setText(next);

    if (digits.length === 0) {
      onChange("");
      return;
    }
    if (digits.length === 8) {
      const iso = toIso(digits);
      if (iso) onChange(iso);
    }
  }

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      picker.showPicker();
    } catch {
      picker.focus();
      picker.click();
    }
  }

  return (
    <span className="relative block">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={`${className ?? ""} pr-9`}
        value={text}
        placeholder={placeholder}
        onChange={(e) => handleChange(e.target.value)}
      />
      <button
        type="button"
        onClick={openPicker}
        aria-label="Открыть календарь"
        className="absolute right-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded text-ink/50 hover:bg-panel hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute bottom-0 right-6 h-px w-px opacity-0"
        value={value || ""}
        onChange={(e) => {
          const next = e.target.value;
          setText(toDisplay(next));
          onChange(next);
        }}
      />
    </span>
  );
}

function toDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

function toIso(digits: string): string | null {
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
