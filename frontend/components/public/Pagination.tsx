"use client";

import { formatNumber, t, useLocale } from "@/lib/i18n";

/**
 * PHASE 1 STEP 1.7 §9/§11 — pagination. onChange(page) — родитель обновляет URL.
 */
export default function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const locale = useLocale();
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="pagination" className="mt-8 flex items-center justify-center gap-3 text-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-lg border border-line px-3 py-1.5 text-ink/60 transition-colors hover:bg-panel focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
      >
        ← {t("pagination.prev", locale)}
      </button>
      <span className="text-xs text-ink/60" aria-live="polite">
        {t("pagination.page", locale)} {formatNumber(page, locale)} {t("pagination.of", locale)}{" "}
        {formatNumber(totalPages, locale)}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="rounded-lg border border-line px-3 py-1.5 text-ink/60 transition-colors hover:bg-panel focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t("pagination.next", locale)} →
      </button>
    </nav>
  );
}
