"use client";

import { EntityDetailSkeleton } from "@/components/internal/WorkspaceSkeletons";

/** §SKELETON-PARITY: `EntityDetailShell.tsx:17-19` + `EntityDetailLayout.tsx:21` — две полосы-шапки + сетка `lg:grid-cols-3`. */
export default function Loading() {
  return <EntityDetailSkeleton />;
}
