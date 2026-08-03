"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { href: "/tours", label: "Туры" },
  { href: "/hotels", label: "Отели" },
  { href: "/sanatoriums", label: "Санатории" },
  { href: "/flights", label: "Авиабилеты" },
  { href: "/trains", label: "Ж/Д" },
  { href: "/excursions", label: "Экскурсии" },
  { href: "/guides", label: "Гиды" },
  { href: "/photographers", label: "Фотографы" },
  { href: "/transfers", label: "Трансферы" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const profileRef = useRef<HTMLDivElement>(null);

  // Закрыть меню профиля при клике вне
  useEffect(() => {
    function handleClickOutside(e: PointerEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      document.addEventListener("pointerdown", handleClickOutside);
      return () => document.removeEventListener("pointerdown", handleClickOutside);
    }
  }, [profileOpen]);

  const handleLogout = async () => {
    await logout();
    setOpen(false);
    setProfileOpen(false);
    router.push("/");
  };

  return (
    <>
      {/* Верхняя панель: контакты + языки */}
      <div className="bg-secondary text-white text-sm">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-9">
          <div className="flex items-center gap-4">
            <span className="text-gray-400">📞 +994 12 345 67 89</span>
            <span className="text-gray-400 hidden sm:inline">📧 info@travelhub.az</span>
          </div>
          <div className="flex gap-2">
            {["RU", "AZ", "EN"].map((l) => (
              <button
                key={l}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${l === "RU" ? "bg-primary text-white" : "text-gray-400 hover:text-white"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Основной header */}
      <header className="bg-white/95 backdrop-blur-xl border-b border-gray-200/70 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          {/* Логотип */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary/25">T</div>
            <span className="text-xl font-bold text-secondary">Travel<span className="text-primary">Hub</span></span>
          </Link>

          {/* Навигация */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="px-3 py-2 rounded-xl text-sm font-medium text-gray-600 hover:text-primary hover:bg-primary/5 transition-colors"
              >
                {n.label}
              </a>
            ))}
          </nav>

          {/* Действия */}
          <div className="flex items-center gap-1">
            <button className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors" title="Поиск">🔍</button>
            <button className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors" title="Избранное">❤️</button>
            {!isLoading && !user && (
              <>
                <Link
                  href="/login"
                  className="hidden sm:flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25"
                >
                  Войти
                </Link>
                <Link
                  href="/register"
                  className="hidden sm:flex items-center gap-2 px-4 h-10 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:border-primary hover:text-primary transition-colors"
                >
                  Регистрация
                </Link>
              </>
            )}
            {!isLoading && user && (
              <div className="hidden sm:flex items-center gap-2" ref={profileRef}>
                {/* Профиль — выпадающее меню для всех ролей */}
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 px-2.5 h-10 rounded-xl hover:bg-gray-100 transition-colors"
                    title="Мой профиль"
                    aria-expanded={profileOpen}
                    aria-haspopup="menu"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {user.firstName[0]}
                    </div>
                    <span className="text-sm font-medium text-gray-600 hidden lg:inline">{user.firstName}</span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Выпадающее меню */}
                  {profileOpen && (
                    <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150" role="menu">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName || ""}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                      </div>
                      <Link
                        href="/profile"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        role="menuitem"
                      >
                        <span>👤</span>
                        <span>Мой профиль</span>
                      </Link>
                      {user.role === "ADMIN" && (
                        <Link
                          href="/admin"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          role="menuitem"
                        >
                          <span>⚙️</span>
                          <span>Центр Управления</span>
                        </Link>
                      )}
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-danger hover:bg-danger/5 transition-colors"
                          role="menuitem"
                        >
                          <span>🚪</span>
                          <span>Выход</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Мобильное меню */}
            <button onClick={() => setOpen(!open)} className="lg:hidden w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors" aria-label="Меню">
              {open ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Мобильное меню */}
        {open && (
          <div className="lg:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="block px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-primary transition-colors"
              >
                {n.label}
              </a>
            ))}
            <div className="pt-2 mt-2 border-t border-gray-100 flex gap-2">
              {!isLoading && !user && (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="flex-1 text-center px-3 py-2.5 rounded-xl bg-primary text-white text-sm font-medium"
                  >
                    Войти
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="flex-1 text-center px-3 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium"
                  >
                    Регистрация
                  </Link>
                </>
              )}
              {!isLoading && user && (
                <>
                  <Link
                    href="/profile"
                    onClick={() => setOpen(false)}
                    className="flex-1 text-center px-3 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium"
                  >
                    👤 Профиль
                  </Link>
                  {user.role === "ADMIN" && (
                    <Link
                      href="/admin"
                      onClick={() => setOpen(false)}
                      className="flex-1 text-center px-3 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-medium"
                    >
                      ⚙️ Управление
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="flex-1 text-center px-3 py-2.5 rounded-xl bg-danger/10 text-danger text-sm font-medium"
                  >
                    🚪 Выход
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
