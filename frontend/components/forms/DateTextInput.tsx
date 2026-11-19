"use client";

import { useEffect, useState } from "react";

/**
 * Manual date entry (`дд.мм.гггг`) without a native date picker.
 * The public value is ISO (`yyyy-mm-dd`); the user can type the date as text.
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

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={className}
      value={text}
      placeholder={placeholder}
      onChange={(e) => handleChange(e.target.value)}
    />
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
