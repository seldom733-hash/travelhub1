import { redirect } from "next/navigation";

/** Step 1.6 §9: legacy /customers (CRM mini) → canonical /app/crm (страница сохранена в /app/crm). */
export default function LegacyCustomersRedirect() {
  redirect("/app/crm");
}
