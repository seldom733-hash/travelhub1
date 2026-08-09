import { redirect } from "next/navigation";

/** Step 1.6: /app → рабочий стол (канонический внутренний home). */
export default function AppIndexPage() {
  redirect("/app/dashboard");
}
