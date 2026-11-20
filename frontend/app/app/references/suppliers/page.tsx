import { redirect } from "next/navigation";

export default function SuppliersPage() {
  redirect("/app/crm?tab=partners");
}
