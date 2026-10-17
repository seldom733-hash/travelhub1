"use client";

import { WorkspacePageSkeleton } from "@/components/internal/WorkspaceSkeletons";

/**
 * §SKELETON-PARITY: `finance/obligations/page.tsx:128-161` — `PageHeader` +
 * `space-y-4 p-6` + строка фильтров status/supplier (:131) + таблица
 * обязательств (:161). Это ровно форма `WorkspacePageSkeleton` с `toolbar`.
 */
export default function Loading() {
  return <WorkspacePageSkeleton toolbar />;
}
