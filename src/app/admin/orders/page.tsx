import SalesExecTabs from "@/components/admin/SalesExecTabs";
import OrderCenter from "@/components/admin/OrderCenter";

export const metadata = {
  title: "TravelHub — Реестр заказов (Order Center)",
};

export default function OrdersPage() {
  return (
    <>
      <SalesExecTabs />
      <OrderCenter />
    </>
  );
}
