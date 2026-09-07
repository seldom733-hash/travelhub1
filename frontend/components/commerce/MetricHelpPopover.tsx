"use client";

/**
 * UI-C1.2H — MetricHelpPopover (KPI / status help trigger + popover).
 *
 * Content flows strictly through:
 *
 *   Help Registry (help-registry.ts)
 *     → localizationKeys
 *     → i18n (help-i18n.ts HELP_DICT / main DICT)
 *
 * There is NO hardcoded user-facing JSX text here. The registry is the
 * metadata authority; this component is a consumer only.
 *
 * Accessibility contract (UI-C1.2H §16):
 *  - trigger has an accessible name («Справка: {label}»);
 *  - trigger is keyboard reachable and exposes aria-haspopup / aria-expanded;
 *  - popover has role="dialog" + aria-label and receives focus on open;
 *  - Escape closes and returns focus to the trigger;
 *  - click outside closes;
 *  - Help is never hover-only (button-based).
 *
 * Callers wrap the rendered popover in a positioned container; the dialog
 * panel anchors to that container (`right-0 top-full`), not to the trigger,
 * so it never overlaps the card it describes.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getHelpEntry, helpShort, helpTitle } from "@/lib/help-registry";
import { helpT } from "@/lib/help-i18n";
import { useLocale } from "@/lib/i18n";

export default function MetricHelpPopover({ entryId }: { entryId: string }) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const entry = getHelpEntry(entryId);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: Event) => {
      const root = rootRef.current;
      if (root && e.target instanceof Node && !root.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  // Defensive: an unknown entryId renders no control (registry is authoritative).
  if (!entry) return null;

  const title = helpTitle(entry, locale);
  const short = helpShort(entry, locale);
  const triggerLabel = helpT("help.trigger_aria", locale).replace("{label}", title);
  const detailsLabel = helpT("help.details_link", locale);

  return (
    <span ref={rootRef} className="inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={triggerLabel}
        className="flex size-5 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-bold leading-none text-slate-400 transition-colors hover:border-blue-300 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <span aria-hidden="true">{helpT("help.trigger_symbol", locale)}</span>
      </button>
      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-label={title}
          tabIndex={-1}
          className="absolute right-0 top-full z-50 mt-1.5 w-72 max-w-[min(20rem,calc(100vw-3rem))] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg outline-none"
        >
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{short}</p>
          <Link
            href={`/app/help?topic=${encodeURIComponent(entry.id)}`}
            onClick={() => setOpen(false)}
            className="mt-2 inline-block text-xs font-medium text-blue-600 underline-offset-2 hover:underline"
          >
            {detailsLabel} →
          </Link>
        </div>
      )}
    </span>
  );
}
