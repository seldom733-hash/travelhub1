"use client";

/**
 * Payment Detail — compatibility redirect.
 *
 * Contract: ADR-OPS-001 (UI-C1.2 §6/§21) — the canonical Payments detail
 * route is `/app/payments/[code]` (lookup by Payment business code).
 * This historical `/app/finance/payments/[id]` path is retained as a
 * compatibility route so existing bookmarks keep working; it forwards the
 * code segment verbatim (the segment value is the same PAY-* business code
 * under both contracts).
 */
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function FinancePaymentsDetailRedirect() {
  const params = useParams();
  const router = useRouter();
  const code = params.id as string;

  useEffect(() => {
    router.replace(`/app/payments/${code}`);
  }, [code, router]);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-100" />
    </div>
  );
}
