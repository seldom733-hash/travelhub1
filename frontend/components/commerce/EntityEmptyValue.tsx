"use client";

/**
 * Canonical Commerce Entity Empty Value.
 *
 * Same visual grammar for absent field values across Request / Order / Booking.
 */
export default function EntityEmptyValue() {
  return <span className="text-slate-400">—</span>;
}