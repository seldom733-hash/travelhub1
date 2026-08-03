"use client";

import Link from "next/link";

/**
 * Страница-заглушка для нереализованных разделов админ-панели
 * (Каталог услуг, Контент, CRM, Пользователи, Финансы и т.д.).
 * Показывает иконку и название раздела из левого меню, чтобы переход
 * по пункту меню не уводил на чужой раздел (например, в Аналитику).
 */
export default function SectionPlaceholder({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div
          className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center text-4xl"
          style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}
        >
          {icon}
        </div>
        <h1 className="text-2xl font-bold mt-6" style={{ color: "var(--admin-text)" }}>
          {title}
        </h1>
        <p className="text-sm mt-3 leading-relaxed" style={{ color: "var(--admin-muted)" }}>
          {description ?? "Раздел находится в разработке и будет доступен в одном из следующих релизов TravelHub."}
        </p>

        <div
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium"
          style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Статус: в разработке
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 flex-wrap">
          <Link
            href="/admin"
            className="px-5 h-10 rounded-xl inline-flex items-center text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "#f97316", color: "#fff" }}
          >
            ← В Центр управления
          </Link>
          <Link
            href="/admin/bookings"
            className="px-5 h-10 rounded-xl inline-flex items-center text-sm font-medium transition-all hover:bg-black/5 active:scale-[0.98]"
            style={{ border: "1px solid var(--admin-border)", color: "var(--admin-text)" }}
          >
            📑 Бронирования
          </Link>
        </div>
      </div>
    </div>
  );
}
