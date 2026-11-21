import { redirect } from "next/navigation";

/** The separate Analytics section is retired in favour of Sales Analytics. */
export default function AnalyticsPage() {
  redirect("/app/analytics/sales");
}
