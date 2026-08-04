import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminRoleGuard from "@/components/admin/AdminRoleGuard";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "TravelHub — Административная панель",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Защита /admin: без сессии → на логин с возвратом, покупатели → на главную
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/admin");
  if (user.role === "BUYER") redirect("/");

  const [services, users] = await Promise.all([
    prisma.service.count(),
    prisma.user.count(),
  ]);
  return (
    <div className="admin-app min-h-screen flex flex-col bg-[var(--admin-bg)] text-[var(--admin-text)]">
      {/* Ограничение разделов по роли (SALES_MANAGER / OPERATOR) */}
      <AdminRoleGuard role={user.role} />
      {/* Верхняя тонкая панель: телефон, почта, локали (Гл. 1.3) */}
      <div className="h-9 bg-secondary text-white text-sm flex items-center justify-between px-4 lg:px-6 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-gray-400">📞 +994 12 345 67 89</span>
          <span className="text-gray-400 hidden sm:inline">📧 admin@travelhub.az</span>
        </div>
        <div className="flex gap-2">
          {["RU", "AZ", "EN"].map((l) => (
            <button
              key={l}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                l === "RU" ? "bg-primary text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Левое меню — закреплено (для ограниченных ролей — только их разделы) */}
        <AdminSidebar role={user.role} />

        {/* Рабочая область */}
        <div className="flex-1 min-w-0 flex flex-col">
          <AdminHeader role={user.role} />
          <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">{children}</main>
          {/* Footer админки */}
          <footer className="px-4 lg:px-6 py-4 text-xs text-[var(--admin-muted)] border-t border-[var(--admin-border)] flex items-center justify-between">
            <span>TravelHub Admin · © 2026</span>
            <span className="hidden sm:inline">Версия 0.1.0 · Услуги: {services} · Пользователи: {users}</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
