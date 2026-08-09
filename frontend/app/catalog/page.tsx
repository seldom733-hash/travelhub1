import { redirect } from "next/navigation";

/** Step 1.6 §9: legacy internal route → canonical /app/* (страница сохранена в /app/catalog). */
export default function LegacyCatalogRedirect() {
  redirect("/app/catalog");
}
