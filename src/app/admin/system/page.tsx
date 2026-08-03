import SectionPlaceholder from "@/components/admin/SectionPlaceholder";

export const metadata = { title: "TravelHub — Система" };

export default function AdminSystemPage() {
  return (
    <SectionPlaceholder
      icon="🖥"
      title="Система"
      description="Состояние системы: журналы, очереди, статусы сервисов, техническое обслуживание. Раздел находится в разработке."
    />
  );
}
