"use client";

import Link from "next/link";

/**
 * Canonical Commerce Entity Detail Header.
 *
 * Unified header for Request / Order / Booking detail pages.
 * Renders breadcrumbs, entity reference, lifecycle + payment/refund status badges, and actions.
 */
export default function EntityDetailHeader({
  breadcrumbs,
  reference,
  number,
  lifecycleStatus,
  paymentStatus,
  refundIndicator,
  actions,
  children,
}: {
  breadcrumbs: string[];
  reference: string;
  number?: string | null;
  lifecycleStatus: React.ReactNode;
  paymentStatus?: React.ReactNode | null;
  refundIndicator?: React.ReactNode | null;
  actions?: React.ReactNode | null;
  /** Optional extra content below status row (e.g. error messages) */
  children?: React.ReactNode;
}) {
  return (
    <>
      {/* Breadcrumb bar */}
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
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Status + metadata bar */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-mono text-xs text-blue-600">
              {reference}
              {number && <span className="ml-1 font-sans text-slate-400">{number}</span>}
            </div>
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
