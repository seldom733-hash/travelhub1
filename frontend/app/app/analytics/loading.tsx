"use client";

import { DashboardPageSkeleton } from "@/components/internal/WorkspaceSkeletons";

/**
 * §SKELETON-PARITY: `analytics/page.tsx:146` — `p-6 lg:p-10 space-y-6` с полосой
 * `PageHeader` и KPI/графиками; форма совпадает с дашбордной (h1 + сетка блоков).
 */
export default function Loading() {
  return <DashboardPageSkeleton />;
}
