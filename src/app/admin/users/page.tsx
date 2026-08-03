import SectionPlaceholder from "@/components/admin/SectionPlaceholder";

export const metadata = { title: "TravelHub — Пользователи" };

export default function AdminUsersPage() {
  return (
    <SectionPlaceholder
      icon="👥"
      title="Пользователи"
      description="Управление учётными записями: клиенты, партнёры, администраторы, роли и права доступа. Раздел находится в разработке."
    />
  );
}
