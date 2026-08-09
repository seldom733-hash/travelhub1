import { redirect } from "next/navigation";

/** Step 1.10 §27 — /partner/onboarding/status → канонический /partner/onboarding. */
export default function PartnerOnboardingStatusPage() {
  redirect("/partner/onboarding");
}
