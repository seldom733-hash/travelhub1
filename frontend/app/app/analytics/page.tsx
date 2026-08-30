"use client";

import { redirect } from "next/navigation";

/**
 * Pre-Step 3.12 — Analytics Navigation IA Remediation
 *
 * Canonical Analytics route is /app/command-center.
 * This page exists solely to redirect any bookmarked /app/analytics URLs
 * to the canonical route, preventing 404s.
 */
export default function AnalyticsRedirectPage() {
  redirect("/app/command-center");
}
