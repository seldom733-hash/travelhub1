import SectionPlaceholder from "@/components/admin/SectionPlaceholder";

export const metadata = { title: "TravelHub — Отчеты" };

export default function AdminReportsPage() {
  return (
    <SectionPlaceholder
      icon="📊"
      title="Отчеты"
      description="Формирование и экспорт отчётов: продажи, финансы, активность, SLA. Раздел находится в разработке."
    />
  );
}
