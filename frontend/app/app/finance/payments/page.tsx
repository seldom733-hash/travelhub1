"use client";

/**
 * UI-C1.2A — compatibility redirect.
 *
 * The canonical Payments Operations Center tab moved to /app/payments
 * (ADR-OPS-001). This historical /app/finance/payments route is retained as
 * a compatibility path so existing bookmarks and analytics drill-downs keep
 * working: it redirects to /app/payments preserving all query params
 * (fromAnalytics/status/currency/date/sort).
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FinancePaymentsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/app/payments${window.location.search}`);
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-100" />
    </div>
  );
}