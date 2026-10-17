"use client";

import { DashboardPageSkeleton } from "@/components/internal/WorkspaceSkeletons";

/**
 * §SKELETON-PARITY: `command-center/page.tsx:17` → `CommandCenter.tsx:264` —
 * `p-6 lg:p-10` + h1 `text-2xl` + сетка виджетов-карточек `rounded-2xl border bg-white`.
 */
export default function Loading() {
  return <DashboardPageSkeleton />;
}
