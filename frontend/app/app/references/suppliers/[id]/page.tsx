import { redirect } from "next/navigation";

export default async function SupplierDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/app/crm/partners/${id}`);
}
