"use client";

import { useState } from "react";

/**
 * Шапка админки (Гл. 2.3): логотип, хлебные крошки, глобальный поиск,
 * иконки уведомлений/сообщений/календаря/темы/AI.
 */
export default function AdminHeader() {
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.querySelector(".admin-app")?.classList.toggle("dark", next);
  };

  return (
    <header className="h-[72px] shrink-0 sticky top-0 z-40 bg-[var(--admin-card)] border-b border-[var(--admin-border)] flex items-center gap-4 px-4 lg:px-6">
      {/* Левая часть: хлебные крошки */}
      <div className="hidden md:block min-w-0">
        <nav className="text-xs text-[var(--admin-muted)] flex items-center gap-1.5">
          <span>Главная</span>
          <span>→</span>
          <span className="text-[var(--admin-text)] font-medium">Центр принятия решений</span>
        </nav>
        <h1 className="text-base font-bold mt-0.5 truncate">Центр принятия решений</h1>
      </div>

      {/* Центр: глобальный поиск */}
      <div className="flex-1 max-w-xl mx-auto relative">
        <div className="flex items-center gap-2 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl px-3.5 h-10 focus-within:border-primary transition-colors">
          <span className="text-[var(--admin-muted)]">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Глобальный поиск: заказы, бронирования, пользователи, услуги…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--admin-muted)]"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-[var(--admin-muted)] hover:text-[var(--admin-text)]">
              ✕
            </button>
          )}
        </div>
        {query.trim() && (
          <div className="absolute top-12 left-0 right-0 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-xl shadow-xl z-50 py-2 text-sm max-h-80 overflow-auto">
            {["Бронирования", "Заказы", "Пользователи", "Партнёры", "Услуги"].map((g) => (
              <div key={g} className="px-3 py-1 text-[11px] uppercase tracking-wide text-[var(--admin-muted)] font-semibold">
                {g}
              </div>
            ))}
            <button className="w-full text-left px-4 py-2 hover:bg-[var(--admin-bg)] transition-colors text-[var(--admin-muted)]">
              Поиск «{query}» во всех разделах…
            </button>
          </div>
        )}
      </div>

      {/* Правая часть: иконки */}
      <div className="flex items-center gap-1">
        <button className="w-10 h-10 rounded-xl hover:bg-[var(--admin-bg)] flex items-center justify-center text-[var(--admin-muted)] transition-colors relative" title="Уведомления">
          🔔
          <span className="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full" />
        </button>
        <button className="w-10 h-10 rounded-xl hover:bg-[var(--admin-bg)] flex items-center justify-center text-[var(--admin-muted)] transition-colors" title="Сообщения">
          💬
        </button>
        <button className="hidden sm:flex w-10 h-10 rounded-xl hover:bg-[var(--admin-bg)] items-center justify-center text-[var(--admin-muted)] transition-colors" title="Календарь">
          📅
        </button>
        <button
          onClick={toggleTheme}
          className="w-10 h-10 rounded-xl hover:bg-[var(--admin-bg)] flex items-center justify-center text-[var(--admin-muted)] transition-colors"
          title="Светлая / темная тема"
        >
          {dark ? "☀️" : "🌙"}
        </button>
        <button
          onClick={() => setAiOpen(!aiOpen)}
          className="w-10 h-10 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center transition-colors"
          title="AI Assistant"
        >
          🤖
        </button>
      </div>

      {/* AI-панель (мини-превью) */}
      {aiOpen && (
        <div className="fixed right-4 top-20 w-[420px] max-w-[calc(100vw-2rem)] bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--admin-border)] flex items-center justify-between">
            <span className="font-semibold flex items-center gap-2">🤖 AI Assistant</span>
            <button onClick={() => setAiOpen(false)} className="text-[var(--admin-muted)] hover:text-[var(--admin-text)]">
              ✕
            </button>
          </div>
          <div className="p-4 text-sm text-[var(--admin-muted)] space-y-2">
            <p>Задайте вопрос о платформе на естественном языке:</p>
            {["Покажи доход за последние 3 месяца", "Какие туры продаются хуже всего?", "Построй прогноз продаж на август"].map((q) => (
              <button
                key={q}
                className="w-full text-left px-3 py-2 rounded-xl bg-[var(--admin-bg)] hover:bg-primary/10 hover:text-primary transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
