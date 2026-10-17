"use client";

import { MetricsPageSkeleton } from "@/components/internal/WorkspaceSkeletons";

/**
 * §SKELETON-PARITY: `finance/overview/page.tsx:187-205` — `PageHeader` +
 * `space-y-6 p-6` + сетки метрик-карточек (`sm:grid-cols-2 lg:grid-cols-3`,
 * затем две `sm:grid-cols-2`). Нейтральная форма по умолчанию показывала здесь
 * панель-таблицу, которой на странице нет.
 */
export default function Loading() {
  return <MetricsPageSkeleton />;
}
