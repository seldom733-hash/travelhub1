import { redirect } from "next/navigation";

/** Step 1.6 §9: legacy internal route → canonical /app/* (страница сохранена в /app/orders). */
export default function LegacyOrdersRedirect() {
  redirect("/app/orders");
}
