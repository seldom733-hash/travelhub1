import SalesExecTabs from "@/components/admin/SalesExecTabs";
import SalesCenter from "@/components/admin/SalesCenter";

export const metadata = {
  title: "TravelHub — Продажи (Sales Center)",
};

export default function SalesPage() {
  return (
    <>
      <SalesExecTabs />
      <SalesCenter />
    </>
  );
}
