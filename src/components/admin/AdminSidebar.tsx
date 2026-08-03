"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ADMIN_MENU, getAdminSection } from "@/lib/admin-menu";

export default function AdminSidebar() {
  const pathname = usePathname();
  const activeSection = getAdminSection(pathname);

  return (
    <aside className="w-16 lg:w-60 shrink-0 bg-secondary text-white flex flex-col sticky top-0 h-screen overflow-y-auto no-scrollbar">
      {/* Логотип */}
      <div className="h-16 flex items-center gap-2 px-3 lg:px-5 border-b border-white/10 shrink-0">
        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0">
          T
        </div>
        <span className="hidden lg:inline text-lg font-bold">
          Travel<span className="text-primary">Hub</span>
          <span className="block text-[10px] font-normal text-gray-400 -mt-0.5">Административная панель</span>
        </span>
      </div>

      {/* Пункты меню (скрытые временно — не показываются) */}
      <nav className="flex-1 py-3">
        {ADMIN_MENU.filter((item) => !item.hidden).map((item) => {
          const active =
            (item === ADMIN_MENU[0] && pathname === "/admin") ||
            (item === activeSection && pathname !== "/admin");
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 lg:px-5 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-primary/15 text-white border-r-2 border-primary"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="text-lg w-6 text-center shrink-0">{item.icon}</span>
              <span className="hidden lg:inline truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Низ сайдбара */}
      <div className="p-3 lg:p-4 border-t border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
            А
          </div>
          <div className="hidden lg:block">
            <div className="text-sm font-medium">Администратор</div>
            <div className="text-xs text-gray-400">admin@travelhub.az</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
