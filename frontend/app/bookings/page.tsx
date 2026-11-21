import { redirect } from "next/navigation";

/** Operations Center registry retired; the canonical registry is Sales Register. */
export default function RetiredOperationsPage() {
  redirect("/app/finance/deals");
}
