import { redirect } from "next/navigation";

export default function AirportsPage() {
  redirect("/app/geography?tab=airports");
}
