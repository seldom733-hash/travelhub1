import CommandCenter from "@/components/admin/CommandCenter";
import { getCurrentUser } from "@/lib/auth";
import { roleDefaultWorkspace } from "@/lib/admin-data";

export const metadata = {
  title: "TravelHub — Центр принятия решений",
};

/**
 * Стартовое пространство Dashboard (Гл. 1.2, 1.44): значение из настроек
 * пользователя, а если оно не задано — по умолчанию для роли
 * (менеджер по продажам → «Продажи», операционист → «Исполнение» и т.д.).
 */
export default async function AdminPage() {
  const user = await getCurrentUser();
  const defaultWorkspace = user?.defaultWorkspace ?? roleDefaultWorkspace(user?.role ?? "ADMIN");
  return <CommandCenter defaultWorkspace={defaultWorkspace} />;
}
