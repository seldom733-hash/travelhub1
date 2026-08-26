"use client";

import { useCallback } from "react";

export type SortDirection = "asc" | "desc";

export interface SortState {
  sortBy: string;
  sortDirection: SortDirection;
}

interface SortableHeaderProps {
  /** Unique key matching the API sort parameter */
  field: string;
  /** Display label for the column */
  children: React.ReactNode;
  /** Current active sort state (null if no sort active) */
  currentSort: SortState | null;
  /** Callback when sort changes */
  onSort: (field: string, direction: SortDirection) => void;
  /** Optional: right-align the content */
  alignRight?: boolean;
  /** Optional: additional CSS classes */
  className?: string;
}

/**
 * Sortable column header with ASC/DESC visual indicators.
 *
 * Click cycle: unsorted → ASC → DESC → ASC → ...
 * New field replaces previous sort and resets to ASC.
 *
 * Accessibility:
 * - Uses button semantics for interactive headers
 * - aria-sort reflects current sort direction
 * - Keyboard activation supported (Enter/Space)
 * - Focus-visible state via browser default
 */
export default function SortableHeader({
  field,
  children,
  currentSort,
  onSort,
  alignRight = false,
  className = "",
}: SortableHeaderProps) {
  const isActive = currentSort?.sortBy === field;
  const direction: SortDirection | null = isActive ? currentSort.sortDirection : null;

  const handleClick = useCallback(() => {
    // If clicking the active column, toggle direction
    // Otherwise, start with ASC on the new field
    const newDirection: SortDirection = isActive && direction === "asc" ? "desc" : "asc";
    onSort(field, newDirection);
  }, [field, isActive, direction, onSort]);

  return (
    <th
      className={`px-4 py-2.5 font-medium ${alignRight ? 'text-right' : ''} ${className}`}
    >
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1 text-left text-[10px] font-medium uppercase tracking-wide transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 ${alignRight ? 'flex-row-reverse text-right' : ''}`}
        aria-sort={isActive ? (direction === "asc" ? "ascending" : "descending") : "none"}
        title={isActive ? `Sorted ${direction === "asc" ? "ascending" : "descending"}` : "Click to sort"}
      >
        {children}
        <span className="text-slate-400" aria-hidden="true">
          {isActive ? (direction === "asc" ? "↑" : "↓") : ""}
        </span>
      </button>
    </th>
  );
}
