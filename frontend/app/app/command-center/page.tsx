"use client";

import { Suspense } from "react";
import { CommandCenter } from "@/components/command-center/CommandCenter";

/**
 * Step 3.2 Stage B — Platform Command Center UI.
 *
 * Route: /app/command-center
 * Permission: analytics.read (page gate enforced by Shell + backend)
 * Sections: Executive, Operational, Financial, Marketplace
 * Timezone: fixed UTC
 */
export default function CommandCenterPage() {
  return (
    <Suspense fallback={<div className="p-6 lg:p-10"><div className="h-8 w-48 animate-pulse rounded bg-slate-100" /></div>}>
      <CommandCenter />
    </Suspense>
  );
}
