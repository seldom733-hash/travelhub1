"use client";

import { FormPageSkeleton } from "@/components/internal/WorkspaceSkeletons";

/** §SKELETON-PARITY: `support/new/page.tsx:37-50` — `PageHeader` + `max-w-xl space-y-5 p-6` + карточка формы. */
export default function Loading() {
  return <FormPageSkeleton maxWidth="max-w-xl" header />;
}
