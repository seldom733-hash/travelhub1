"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Верхние вкладки раздела «Продажи и исполнение» (мастер-архитектура, разд. 3).
 * Единый раздел содержит реестр заказов, продажи, очереди — вкладки переключают
 * между рабочими экранами раздела.
 */
export default function SalesExecTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/admin/orders", label: "📦 Реестр заказов", match: pathname.startsWith("/admin/orders") },
    { href: "/admin/sales", label: "📈 Продажи", match: pathname.startsWith("/admin/sales") },
  ];
  return (
    <div className="flex items-center gap-1.5 mb-5 flex-wrap">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`px-4 h-9 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
            t.match
              ? "bg-secondary text-white shadow-sm"
              : "bg-[var(--admin-card)] border border-[var(--admin-border)] text-[var(--admin-muted)] hover:border-primary hover:text-primary"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
