"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { getAdminSection } from "@/lib/admin-menu";

/**
 * Шапка админки (Гл. 2.3): логотип, хлебные крошки, глобальный поиск,
 * иконки уведомлений/сообщений/календаря/темы/AI.
 * Заголовок и крошки отображают название активного раздела из левого меню.
 */
export default function AdminHeader() {
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQ, setAiQ] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const pathname = usePathname();
  const section = getAdminSection(pathname);

  const askAi = async (text: string) => {
    setAiQ(text);
    setAiLoading(true);
    setAiAnswer(null);
    try {
      const res = await fetch(`/api/admin/ai-assistant?q=${encodeURIComponent(text)}`, { credentials: "include" });
      const j = (await res.json()) as { answer?: string; error?: string };
      setAiAnswer(j.answer ?? (j.error ? `Ошибка: ${j.error}` : "Не удалось получить ответ"));
    } catch {
      setAiAnswer("Ошибка запроса — проверьте консоль (F12)");
    } finally {
      setAiLoading(false);
    }
  };

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.querySelector(".admin-app")?.classList.toggle("dark", next);
  };

  return (
    <header className="h-[72px] shrink-0 sticky top-0 z-40 bg-[var(--admin-card)] border-b border-[var(--admin-border)] flex items-center gap-4 px-4 lg:px-6">
      {/* Левая часть: хлебные крошки + название активного раздела */}
      <div className="hidden md:block min-w-0">
        <nav className="text-xs text-[var(--admin-muted)] flex items-center gap-1.5">
          <span>Главная</span>
          <span>→</span>
          <span className="text-[var(--admin-text)] font-medium">{section.label}</span>
        </nav>
        <h1 className="text-base font-bold mt-0.5 truncate">{section.label}</h1>
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
            <div className="flex gap-2">
              <input
                value={aiQ}
                onChange={(e) => setAiQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && aiQ.trim()) void askAi(aiQ.trim());
                }}
                placeholder="Например: доход за 3 месяца"
                className="flex-1 min-w-0 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl px-3 h-9 outline-none text-sm focus:border-primary transition-colors"
              />
              <button
                onClick={() => aiQ.trim() && void askAi(aiQ.trim())}
                disabled={aiLoading}
                className="px-3 h-9 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 shrink-0"
              >
                ➤
              </button>
            </div>
            {["Покажи доход за последние 3 месяца", "Какие туры продаются хуже всего?", "Построй прогноз продаж на август"].map((q) => (
              <button
                key={q}
                onClick={() => void askAi(q)}
                disabled={aiLoading}
                className="w-full text-left px-3 py-2 rounded-xl bg-[var(--admin-bg)] hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-60"
              >
                {q}
              </button>
            ))}
            {aiLoading && <p className="text-xs animate-pulse">Думаю…</p>}
            {aiAnswer && !aiLoading && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-[var(--admin-text)]">
                <div className="text-[10px] uppercase tracking-wide text-[var(--admin-muted)] mb-1">Ответ</div>
                {aiAnswer}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
