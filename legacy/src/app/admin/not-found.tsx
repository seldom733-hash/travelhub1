import Link from "next/link";

/**
 * Кастомная 404 для админ-панели — тёмная тема (рендерится внутри admin/layout).
 */
export default function AdminNotFound() {
  return (
    <div
      className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4"
      style={{ color: "var(--admin-text)" }}
    >
      <div
        className="text-[96px] leading-none font-extrabold select-none"
        style={{ color: "var(--admin-muted)", opacity: 0.6 }}
      >
        404
      </div>
      <h1 className="text-2xl font-bold mt-2">Раздел не найден</h1>
      <p className="text-sm mt-2 max-w-sm" style={{ color: "var(--admin-muted)" }}>
        Запрошенный раздел админ-панели не существует или был перемещён.
      </p>
      <Link
        href="/admin"
        className="mt-6 px-5 h-10 rounded-xl inline-flex items-center text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
        style={{ background: "#f97316", color: "#fff" }}
      >
        ← Вернуться в админку
      </Link>
    </div>
  );
}
