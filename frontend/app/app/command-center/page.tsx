"use client";

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
  return <CommandCenter />;
}
