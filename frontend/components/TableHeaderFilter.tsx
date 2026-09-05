"use client";

/**
 * UI-C1.2F.1C — Shared TableHeaderFilter primitive for Operations Center.
 *
 * Renders a filter icon button in a table column header that opens a
 * dropdown with selectable options. Used to move entity-specific filters
 * (status, paymentStatus, etc.) from toolbar to table header.
 *
 * Contract:
 * - Generic — no business-domain enum logic inside
 * - Single-select only
 * - URL-authoritative (caller manages URL state)
 * - Accessible: aria-expanded, aria-haspopup, keyboard, Escape closes
 * - Active state visually distinct (filled icon, highlighted row)
 * - Registry provides: allowed options, URL key, server query mapping
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface FilterOption {
  /** Canonical value sent to backend / URL */
  value: string;
  /** Localized display label */
  label: string;
}

interface TableHeaderFilterProps {
  /** Unique filter identifier for aria */
  id: string;
  /** Display label shown next to filter icon */
  label: string;
  /** Available filter options */
  options: FilterOption[];
  /** Currently active filter value (empty string = no filter) */
  value: string;
  /** Called when user selects an option or clears */
  onChange: (value: string) => void;
  /** Accessible label for the filter button */
  ariaLabel?: string;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Shared table header filter with dropdown popover.
 *
 * Usage in a <th>:
 * ```tsx
 * <th className="px-4 py-2.5">
 *   <TableHeaderFilter
 *     id="filter-status"
 *     label="Статус"
 *     options={STATUS_OPTIONS}
 *     value={statusFilter}
 *     onChange={applyStatus}
 *   />
 * </th>
 * ```
 */
export default function TableHeaderFilter({
  id,
  label,
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
}: TableHeaderFilterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isActive = Boolean(value);

  const handleClose = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue === value ? "" : optionValue);
      handleClose();
    },
    [onChange, value, handleClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        handleClose();
        e.preventDefault();
      }
    },
    [open, handleClose],
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClose]);

  return (
    <div ref={containerRef} className="relative inline-flex items-center gap-1" onKeyDown={handleKeyDown}>
      {/* Label — visible, not a button */}
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>

      {/* Filter button */}
      <button
        ref={buttonRef}
        type="button"
        id={id}
        onClick={() => setOpen(!open)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel ?? `${label} filter`}
        className={`inline-flex items-center rounded p-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
          isActive
            ? "bg-blue-100 text-blue-600"
            : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
      >
        {/* Filter funnel icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M1.5 2h13l-5.5 6.5v4.5l-2 1V8.5L1.5 2z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Dropdown popover */}
      {open && (
        <div
          role="listbox"
          aria-label={`${label} options`}
          className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {/* "All" option */}
          <button
            type="button"
            role="option"
            aria-selected={!value}
            onClick={() => handleSelect("")}
            className={`w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-slate-50 ${
              !value ? "bg-blue-50 font-medium text-blue-700" : "text-slate-700"
            }`}
          >
            Все
          </button>

          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={value === opt.value}
              onClick={() => handleSelect(opt.value)}
              className={`w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-slate-50 ${
                value === opt.value
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-slate-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
