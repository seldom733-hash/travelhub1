"use client";

import { t, type Locale } from "../lib/i18n";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  locale?: Locale;
  onPageChange: (page: number) => void;
}

/**
 * Shared pagination component — 20-row default, multi-page navigation.
 * Used by Catalog, Orders, Bookings, CRM, and all operational tables.
 *
 * Shows: "1–20 из 31 ‹ 1 2 ›"
 */
export default function Pagination({
  page,
  pageSize,
  total,
  locale = "ru",
  onPageChange,
}: PaginationProps) {
  if (total <= 0) return null;

  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const rangeLabel =
    locale === "ru"
      ? `${from}–${to} из ${total}`
      : locale === "az"
        ? `${from}–${to} / ${total}`
        : `${from}–${to} of ${total}`;

  // Build page numbers to show (max 7 visible)
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
      <span className="text-xs text-slate-500">{rangeLabel}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          ‹
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`dots-${i}`} className="px-1 text-xs text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                p === page
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          ›
        </button>
      </div>
    </div>
  );
}
