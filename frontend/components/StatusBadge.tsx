"use client";

import { useLocale, t } from "@/lib/i18n";

/**
 * Locale-aware status badge.
 *
 * Maps canonical enum values to i18n keys.
 * Falls back to raw status value if no mapping exists.
 */

/** Maps status enum → i18n key. Covers all domain statuses. */
const STATUS_I18N_KEY: Record<string, string> = {
  // Product
  DRAFT: "status.product.DRAFT",
  COMPLETE: "status.product.COMPLETE",
  REVIEWED: "status.product.REVIEWED",
  PUBLISHED: "status.product.PUBLISHED",
  CHANGED: "status.product.CHANGED",
  ARCHIVED: "status.product.ARCHIVED",
  // Order — use order.status.* to match KPI/filter canonical labels
  NEW: "order.status.NEW",
  IN_PROCESSING: "order.status.IN_PROCESSING",
  WAITING_FOR_DATA: "order.status.WAITING_FOR_DATA",
  READY_FOR_BOOKING: "order.status.READY_FOR_BOOKING",
  SENT_TO_BOOKING: "order.status.SENT_TO_BOOKING",
  PARTIALLY_FULFILLED: "order.status.PARTIALLY_FULFILLED",
  FULFILLED: "order.status.FULFILLED",
  READY_TO_CLOSE: "order.status.READY_TO_CLOSE",
  CLOSED: "order.status.CLOSED",
  CANCELLED: "order.status.CANCELLED",
  PROBLEM: "order.status.PROBLEM",
  SUSPENDED: "order.status.SUSPENDED",
  // Booking — use booking.status.* to match KPI/filter canonical labels
  PREPARING_REQUEST: "booking.status.PREPARING_REQUEST",
  SENT_TO_SUPPLIER: "booking.status.SENT_TO_SUPPLIER",
  AWAITING_CONFIRMATION: "booking.status.AWAITING_CONFIRMATION",
  CONFIRMED: "booking.status.CONFIRMED",
  IN_SERVICE: "booking.status.IN_SERVICE",
  COMPLETED: "booking.status.COMPLETED",
  SUPPLIER_REJECTED: "booking.status.SUPPLIER_REJECTED",
  NEEDS_CLARIFICATION: "booking.status.NEEDS_CLARIFICATION",
  CHANGE_REQUESTED: "booking.status.CHANGE_REQUESTED",
  CANCELLATION_REQUESTED: "booking.status.CANCELLATION_REQUESTED",
  // Payment — use order.payment.* to match KPI/filter canonical labels
  UNPAID: "order.payment.UNPAID",
  PARTIALLY_PAID: "order.payment.PARTIALLY_PAID",
  PAID: "order.payment.PAID",
  REFUNDED: "order.payment.REFUNDED",
  // Payment entity statuses (Finance module — Payment lifecycle)
  PENDING: "status.entity.PENDING",
  CAPTURED: "status.entity.CAPTURED",
  AUTHORIZED: "status.entity.AUTHORIZED",
  FAILED: "status.entity.FAILED",
  // Refund entity statuses (APPROVED maps to status.entity.APPROVED via CRM section)
  REQUESTED: "status.entity.REQUESTED",
  PROCESSED: "status.entity.PROCESSED",
  // Request decision statuses
  ACCEPTED: "status.decision.ACCEPTED",
  DECLINED: "status.decision.DECLINED",
  // Common (users, CRM, etc.)
  ACTIVE: "status.common.ACTIVE",
  INACTIVE: "status.common.INACTIVE",
  LOCKED: "status.common.LOCKED",
  // CRM statuses
  SUBMITTED: "status.crm.SUBMITTED",
  IN_REVIEW: "status.crm.IN_REVIEW",
  APPROVED: "status.crm.APPROVED",
  REJECTED: "status.crm.REJECTED",
  CHANGES_REQUESTED: "status.crm.CHANGES_REQUESTED",
  // Request
  CHECKING: "status.request.CHECKING",
  SUPPLIER_TIMEOUT: "status.request.SUPPLIER_TIMEOUT",
  PRICE_CHANGED: "status.request.PRICE_CHANGED",
  CUSTOMER_ACCEPTED: "status.request.CUSTOMER_ACCEPTED",
  CONVERTED: "status.request.CONVERTED",
  UNAVAILABLE: "status.request.UNAVAILABLE",
  EXPIRED: "status.request.EXPIRED",
  CUSTOMER_PAYMENT_TIMEOUT: "status.request.CUSTOMER_PAYMENT_TIMEOUT",
  CANCELLED_BY_CUSTOMER: "status.request.CANCELLED_BY_CUSTOMER",
  // Marketing
  SCHEDULED: "marketing.status.scheduled",
  PAUSED: "marketing.status.paused",
  // Document statuses (UI-DOC-ADMIN)
  NOT_ISSUED: "documents.status.NOT_ISSUED",
  ISSUED: "documents.status.ISSUED",
  SUPERSEDED: "documents.status.SUPERSEDED",
  INVALIDATED: "documents.status.INVALIDATED",
};

// Support statuses are mapped inline in StatusBadge component (support.status.* keys)
const SUPPORT_STATUS_I18N: Record<string, string> = {
  OPEN: "support.status.OPEN",
  IN_PROGRESS: "support.status.IN_PROGRESS",
  WAITING_CUSTOMER: "support.status.WAITING_CUSTOMER",
  WAITING_PARTNER: "support.status.WAITING_PARTNER",
  WAITING_INTERNAL: "support.status.WAITING_INTERNAL",
  ESCALATED: "support.status.ESCALATED",
  RESOLVED: "support.status.RESOLVED",
  CLOSED: "support.status.CLOSED",
};

/** Tailwind classes for status badge color. */
const STATUS_CLS: Record<string, string> = {
  DRAFT: "bg-panel text-ink/60 border-line",
  COMPLETE: "bg-brand/10 text-brand-dark border-brand/20",
  REVIEWED: "bg-brand/10 text-brand-dark border-brand/20",
  PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CHANGED: "bg-amber-50 text-amber-700 border-amber-200",
  ARCHIVED: "bg-panel text-ink/60 border-line",
  SUSPENDED: "bg-orange-50 text-orange-700 border-orange-200",
  NEW: "bg-panel text-ink/60 border-line",
  IN_PROCESSING: "bg-brand/10 text-brand-dark border-brand/20",
  WAITING_FOR_DATA: "bg-amber-50 text-amber-700 border-amber-200",
  READY_FOR_BOOKING: "bg-violet-50 text-violet-700 border-violet-200",
  SENT_TO_BOOKING: "bg-brand/10 text-brand-dark border-brand/20",
  PARTIALLY_FULFILLED: "bg-brand/10 text-brand-dark border-brand/20",
  FULFILLED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  READY_TO_CLOSE: "bg-teal-50 text-teal-700 border-teal-200",
  CLOSED: "bg-panel text-ink/60 border-line",
  CANCELLED: "bg-red-50 text-red-600 border-red-200",
  PROBLEM: "bg-red-100 text-red-700 border-red-300",
  PREPARING_REQUEST: "bg-brand/10 text-brand-dark border-brand/20",
  SENT_TO_SUPPLIER: "bg-brand/10 text-brand-dark border-brand/20",
  AWAITING_CONFIRMATION: "bg-amber-50 text-amber-700 border-amber-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  IN_SERVICE: "bg-brand/10 text-brand-dark border-brand/20",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  SUPPLIER_REJECTED: "bg-red-50 text-red-600 border-red-200",
  NEEDS_CLARIFICATION: "bg-amber-50 text-amber-700 border-amber-200",
  CHANGE_REQUESTED: "bg-amber-50 text-amber-700 border-amber-200",
  CANCELLATION_REQUESTED: "bg-orange-50 text-orange-700 border-orange-200",
  UNPAID: "bg-panel text-ink/60 border-line",
  PARTIALLY_PAID: "bg-amber-50 text-amber-700 border-amber-200",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REFUNDED: "bg-panel text-ink/60 border-line",
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  INACTIVE: "bg-panel text-ink/60 border-line",
  LOCKED: "bg-red-50 text-red-600 border-red-200",
  SUBMITTED: "bg-amber-50 text-amber-700 border-amber-200",
  IN_REVIEW: "bg-brand/10 text-brand-dark border-brand/20",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-600 border-red-200",
  CHANGES_REQUESTED: "bg-orange-50 text-orange-700 border-orange-200",
  // Payment entity statuses
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  CAPTURED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  AUTHORIZED: "bg-brand/10 text-brand-dark border-brand/20",
  FAILED: "bg-red-50 text-red-600 border-red-200",
  // Refund entity statuses
  REQUESTED: "bg-amber-50 text-amber-700 border-amber-200",
  PROCESSED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  // Request decision statuses
  ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DECLINED: "bg-red-50 text-red-600 border-red-200",
  // Request
  CHECKING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  SUPPLIER_TIMEOUT: "bg-red-50 text-red-600 border-red-200",
  PRICE_CHANGED: "bg-orange-50 text-orange-700 border-orange-200",
  CUSTOMER_ACCEPTED: "bg-teal-50 text-teal-700 border-teal-200",
  CONVERTED: "bg-purple-50 text-purple-700 border-purple-200",
  UNAVAILABLE: "bg-panel text-ink/60 border-line",
  EXPIRED: "bg-panel text-ink/60 border-line",
  CUSTOMER_PAYMENT_TIMEOUT: "bg-red-50 text-red-600 border-red-200",
  CANCELLED_BY_CUSTOMER: "bg-panel text-ink/60 border-line",
  // Marketing
  SCHEDULED: "bg-violet-50 text-violet-700 border-violet-200",
  PAUSED: "bg-amber-50 text-amber-700 border-amber-200",
  // Document statuses
  NOT_ISSUED: "bg-panel text-ink/60 border-line",
  ISSUED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SUPERSEDED: "bg-amber-50 text-amber-700 border-amber-200",
  INVALIDATED: "bg-red-50 text-red-600 border-red-200",
};

const SUPPORT_STATUS_CLS: Record<string, string> = {
  OPEN: "bg-brand/10 text-brand-dark border-brand/20",
  IN_PROGRESS: "bg-brand/10 text-brand-dark border-brand/20",
  WAITING_CUSTOMER: "bg-amber-50 text-amber-700 border-amber-200",
  WAITING_PARTNER: "bg-orange-50 text-orange-700 border-orange-200",
  WAITING_INTERNAL: "bg-purple-50 text-purple-700 border-purple-200",
  ESCALATED: "bg-red-50 text-red-600 border-red-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CLOSED: "bg-panel text-ink/60 border-line",
};

export default function StatusBadge({ status, label: labelOverride }: { status: string; label?: string }) {
  const locale = useLocale();
  const i18nKey = STATUS_I18N_KEY[status] ?? SUPPORT_STATUS_I18N[status];
  // Optional label override: lets a registry bind the badge text to its own
  // canonical label source (UI-C1.2B §19 — Requests registry unifies the table
  // badge with the KPI card / filter label on requests.kpi.*).
  const label = labelOverride ?? (i18nKey ? t(i18nKey, locale) : status);
  const cls = STATUS_CLS[status] ?? SUPPORT_STATUS_CLS[status] ?? "bg-panel text-ink/60 border-line";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}
