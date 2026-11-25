"use client";

/**
 * Canonical Commerce Entity Empty Value.
 *
 * Same visual grammar for absent field values across Request / Order / Booking.
 */
export default function EntityEmptyValue() {
  return <span className="text-ink/60">—</span>;
}