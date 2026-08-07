import Link from "next/link";
import { TYPE_META, TYPE_LIST } from "@/lib/service-utils";

const CATEGORY_COLORS: Record<string, string> = {
  TOUR: "from-orange-500 to-amber-500",
  HOTEL: "from-blue-500 to-indigo-500",
  SANATORIUM: "from-emerald-500 to-teal-500",
  FLIGHT: "from-sky-500 to-cyan-500",
  TRAIN: "from-violet-500 to-purple-500",
  EXCURSION: "from-rose-500 to-pink-500",
  GUIDE: "from-teal-500 to-emerald-500",
  TRANSFER: "from-slate-600 to-slate-800",
  PHOTOGRAPHER: "from-fuchsia-500 to-purple-600",
};

const QUICK_LINKS = [
  { href: "/tours", label: "Туры" },
  { href: "/hotels", label: "Отели" },
  { href: "/sanatoriums", label: "Санатории" },
  { href: "/flights", label: "Авиабилеты" },
  { href: "/excursions", label: "Экскурсии" },
  { href: "/transfers", label: "Трансферы" },
];

/**
 * Кастомная страница 404 в стиле TravelHub.
 * Рендерится в корневом layout (без Header/Footer), поэтому содержит собственный
 * логотип, поиск по сайту и популярные категории, чтобы пользователь не уходил.
 */
export default function NotFound() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50/70 via-white to-white flex flex-col">
      {/* Мини-шапка */}
      <header className="max-w-7xl w-full mx-auto px-4 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary/25">
            T
          </div>
          <span className="text-xl font-bold text-secondary">
            Travel<span className="text-primary">Hub</span>
          </span>
        </Link>
        <Link
          href="/"
          className="px-4 h-10 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25 inline-flex items-center"
        >
          На главную
        </Link>
      </header>

      <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-10 text-center">
        {/* 404 */}
        <div className="text-[120px] leading-none font-extrabold bg-gradient-to-br from-primary to-amber-500 bg-clip-text text-transparent select-none">
          404
        </div>
        <h1 className="text-3xl font-extrabold text-secondary mt-2">Страница не найдена</h1>
        <p className="text-gray-400 mt-3 max-w-md mx-auto">
          Возможно, страница была удалена или вы перешли по неверной ссылке.
          Попробуйте поискать нужный тур или услугу.
        </p>

        {/* Поиск */}
        <form
          action="/search"
          method="get"
          className="mt-8 flex items-center gap-2 max-w-lg mx-auto"
        >
          <div className="flex-1 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              name="q"
              placeholder="Поиск туров, отелей, экскурсий…"
              className="w-full h-12 pl-10 pr-4 rounded-2xl border border-gray-200 bg-white text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-shadow shadow-sm"
            />
          </div>
          <button
            type="submit"
            className="h-12 px-6 rounded-2xl bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-all hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98] shrink-0"
          >
            Найти
          </button>
        </form>

        {/* Быстрые ссылки */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {QUICK_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3.5 h-9 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:border-primary hover:text-primary transition-colors inline-flex items-center"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Популярные категории */}
        <div className="mt-12 text-left">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-4 text-center">
            🌍 Популярные категории
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TYPE_LIST.map((t) => {
              const meta = TYPE_META[t];
              return (
                <Link
                  key={t}
                  href={`/search?type=${t}`}
                  className="group flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-3 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div
                    className={`w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br ${
                      CATEGORY_COLORS[t] || "from-gray-500 to-gray-700"
                    } flex items-center justify-center text-xl shadow group-hover:scale-110 transition-transform`}
                  >
                    {meta.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-secondary group-hover:text-primary transition-colors truncate">
                      {meta.label}
                    </p>
                    <p className="text-[11px] text-gray-400">{meta.per}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Мини-подвал */}
      <footer className="max-w-7xl w-full mx-auto px-4 py-6 border-t border-gray-100 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} TravelHub. Все права защищены.
      </footer>
    </main>
  );
}
