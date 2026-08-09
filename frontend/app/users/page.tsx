import { redirect } from "next/navigation";

/** Step 1.6 §9: legacy internal route → canonical /app/* (страница сохранена в /app/users). */
export default function LegacyUsersRedirect() {
  redirect("/app/users");
}
