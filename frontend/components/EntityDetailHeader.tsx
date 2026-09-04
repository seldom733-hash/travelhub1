"use client";

import Link from "next/link";
import { useLocale, t } from "@/lib/i18n";

/**
 * Canonical Commerce Entity Detail Header.
 *
 * Unified header grammar for Request / Order / Booking detail pages:
 *
 *   Breadcrumbs                    ← Back-to-list
 *   Primary entity reference (h1)  Action bar
 *   Secondary reference id (mono)
 *   Lifecycle badge · payment badge · refund indicator
 *
 * The primary reference is rendered exactly once (h1); the secondary
 * reference (code/number) appears as a mono sub-line, never duplicated.
 */
export default function EntityDetailHeader({
  breadcrumbs,
  reference,
  secondary,
  backHref,
  lifecycleStatus,
  paymentStatus,
  refundIndicator,
  actions,
  children,
}: {
  breadcrumbs: string[];
  reference: string;
  secondary?: string | null;
  backHref?: string;
  lifecycleStatus: React.ReactNode;
  paymentStatus?: React.ReactNode | null;
  refundIndicator?: React.ReactNode | null;
  actions?: React.ReactNode | null;
  /** Optional extra content below status row (e.g. error messages) */
  children?: React.ReactNode;
}) {
  const locale = useLocale();
  return (
    <>
      {/* Breadcrumb bar + back-to-list */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <div className="text-xs text-slate-400">
            {breadcrumbs.map((c, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-1">/</span>}
                {c}
              </span>
            ))}
          </div>
          <h1 className="mt-0.5 text-lg font-bold text-slate-900">{reference}</h1>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {backHref && (
            <Link
              href={backHref}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              ← {t("crm.back_to_list", locale)}
            </Link>
          )}
        </div>
      </div>

      {/* Secondary reference + status badges bar */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            {secondary && (
              <div className="font-mono text-xs text-blue-600">{secondary}</div>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {lifecycleStatus}
              {paymentStatus}
              {refundIndicator}
            </div>
          </div>
        </div>
        {children}
      </div>
    </>
  );
}