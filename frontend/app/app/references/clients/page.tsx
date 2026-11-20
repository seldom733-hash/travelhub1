import { redirect } from "next/navigation";

export default function ClientsPage() {
  redirect("/app/crm?tab=customers");
}
