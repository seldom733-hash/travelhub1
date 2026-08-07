"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAdminSection } from "@/lib/admin-menu";
import { fmtMoney, fmtDateTime } from "@/lib/admin-data";

/** Категории фильтра центра уведомлений (Гл. 1.43). */
const NOTIFY_CATEGORIES = [
  { key: "all", label: "Все" },
  { key: "urgent", label: "Срочные" },
  { key: "finance", label: "Финансы" },
  { key: "sales", label: "Продажи" },
  { key: "execution", label: "Исполнение" },
  { key: "crm", label: "CRM" },
  { key: "system", label: "Система" },
];

/** Результаты глобального поиска (Гл. 1.5): сгруппированы по типу сущности. */
interface SearchResults {
  query: string;
  orders: { id: string; label: string; detail: string; status: string; amount: number; href: string }[];
  users: { id: string; label: string; detail: string; role: string; companyName: string | null; href: string }[];
  services: { id: string; label: string; detail: string; price: number; currency: string; href: string }[];
  bookings: { id: string; label: string; detail: string; status: string; amount: number; href: string }[];
  documents: { id: string; label: string; detail: string; actor: string; href: string }[];
}

const ROLE_ICONS: Record<string, string> = {
  ADMIN: "🛡",
  MODERATOR: "🛠",
  DIRECTOR: "👔",
  FINANCE: "💵",
  MARKETER: "📣",
  ANALYST: "📊",
  BUYER: "👤",
  PARTNER: "🤝",
  SALES_MANAGER: "💼",
  OPERATOR: "⚙️",
};

/** Категории центра уведомлений (Гл. 1.43). */
interface NotifyItem {
  id: string;
  type: string;
  category: string;
  title: string;
  detail: string;
  at: string | Date;
  href: string;
  criticality: string;
}

interface NotifyData {
  categories: { key: string; label: string }[];
  counts: Record<string, number>;
  items: NotifyItem[];
}

const NOTIFY_ICONS: Record<string, string> = {
  order: "📦",
  confirm: "✅",
  pay: "⏳",
  paid: "💳",
  refund: "↩️",
  done: "🏁",
  user: "👤",
  partner: "🤝",
  review: "⭐",
  urgent: "🚨",
  exception: "⚠️",
  automation: "⚙️",
  cancel: "🚫",
  doc: "📄",
};

/** Ключ localStorage для истории прочтения уведомлений (Гл. 1.43). */
const NOTIFY_READ_KEY = "travelhub:notifications:read:v1";

/**
 * Шапка админки (Гл. 2.3): логотип, хлебные крошки, глобальный поиск,
 * центр уведомлений (Гл. 1.43), иконки сообщений/календаря/темы/AI.
 * Заголовок и крошки отображают название активного раздела из левого меню.
 */
export default function AdminHeader({ role = "ADMIN" }: { role?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [dark, setDark] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQ, setAiQ] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  // Центр уведомлений (Гл. 1.43)
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyData, setNotifyData] = useState<NotifyData | null>(null);
  const [notifyCat, setNotifyCat] = useState("all");
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(NOTIFY_READ_KEY) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("travelhub:notifications:pinned:v1") ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const [snoozedIds, setSnoozedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("travelhub:notifications:snoozed:v1") ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const notifyRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const quickRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const section = getAdminSection(pathname, role);

  // Панели шапки (Гл. 1.5): сообщения, календарь, профиль, быстрое создание
  const [panelsOpen, setPanelsOpen] = useState<"messages" | "calendar" | "profile" | "quick" | null>(null);
  const [profile, setProfile] = useState<{
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string | null;
    companyName: string | null;
  } | null>(null);
  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => (r.ok ? (r.json() as Promise<{ user: typeof profile }>) : Promise.reject(new Error("me failed"))))
      .then((j) => setProfile(j.user))
      .catch(() => {
        /* тихо */
      });
  }, []);
  const initials = (profile?.firstName?.[0] ?? "А") + (profile?.lastName?.[0] ?? "");
  const roleLabel = (profile?.role ?? role).toLowerCase();
  interface PanelCalendarItem {
    id: string;
    orderNumber: string;
    serviceDate: string | Date | null;
    status: string;
    user: { firstName: string; lastName: string | null };
  }
  interface PanelData {
    messages: {
      unread: number;
      items: { id: string; senderName: string; text: string; createdAt: string | Date; order: { id: string; orderNumber: string }; href: string }[];
    };
    calendar: { today: PanelCalendarItem[]; tomorrow: PanelCalendarItem[]; overdue: PanelCalendarItem[] };
  }
  const [panelData, setPanelData] = useState<PanelData | null>(null);

  // Загрузка данных панелей при первом открытии; фоновое обновление раз в минуту
  const loadPanels = () => {
    fetch("/api/admin/header-panels")
      .then(async (r) => (r.ok ? (r.json() as Promise<PanelData>) : Promise.reject(new Error("panels failed"))))
      .then(setPanelData)
      .catch(() => {
        /* тихо */
      });
  };
  useEffect(() => {
    // Данные панелей нужны только для сообщений и календаря — профиль и
    // быстрое создание их не используют (Гл. 1.5)
    if (panelsOpen !== "messages" && panelsOpen !== "calendar") return;
    const first = setTimeout(() => {
      if (!panelData) loadPanels();
    }, 0);
    const timer = setInterval(loadPanels, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelsOpen, panelData]);

  // Закрытие панелей по клику вне
  useEffect(() => {
    if (!panelsOpen) return;
    const onClick = (e: MouseEvent) => {
      const refs = [notifyRef, messagesRef, calendarRef, profileRef, quickRef];
      if (!refs.some((r) => r.current?.contains(e.target as Node))) setPanelsOpen(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [panelsOpen]);

  // Персист истории прочтения/закрепления/отложенных
  useEffect(() => {
    try {
      localStorage.setItem(NOTIFY_READ_KEY, JSON.stringify(readIds));
    } catch {
      /* localStorage недоступен */
    }
  }, [readIds]);
  useEffect(() => {
    try {
      localStorage.setItem("travelhub:notifications:pinned:v1", JSON.stringify(pinnedIds));
    } catch {
      /* localStorage недоступен */
    }
  }, [pinnedIds]);
  useEffect(() => {
    try {
      localStorage.setItem("travelhub:notifications:snoozed:v1", JSON.stringify(snoozedIds));
    } catch {
      /* localStorage недоступен */
    }
  }, [snoozedIds]);

  // Загрузка ленты при открытии центра; фоновое обновление раз в 60 сек.
  // Лёгкий вариант (loadCounts) обновляет только counts — для бейджа
  // колокольчика, без рендера всей панели (Гл. 1.43).
  const loadNotifications = () => {
    setNotifyLoading(true);
    fetch(`/api/admin/notifications?category=${notifyCat}`)
      .then(async (r) => (r.ok ? (r.json() as Promise<NotifyData>) : Promise.reject(new Error("notifications failed"))))
      .then(setNotifyData)
      .catch(() => {
        /* тихо: оставляем предыдущие данные */
      })
      .finally(() => setNotifyLoading(false));
  };
  const loadNotifyCounts = () => {
    fetch("/api/admin/notifications?limit=1")
      .then(async (r) => (r.ok ? (r.json() as Promise<NotifyData>) : Promise.reject(new Error("counts failed"))))
      .then((j) => setNotifyData((prev) => (prev ? { ...prev, counts: j.counts } : prev)))
      .catch(() => {
        /* тихо */
      });
  };
  // Бейдж колокольчика работает сразу после загрузки страницы: опрашиваем
  // counts в фоне раз в 60 сек, не открывая центр.
  useEffect(() => {
    const first = setTimeout(loadNotifyCounts, 0);
    const timer = setInterval(loadNotifyCounts, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!notifyOpen) return;
    // Сброс откладываем на микротаск — setState в теле эффекта напрямую
    // вызывает предупреждение react-hooks/set-state-in-effect
    const first = setTimeout(loadNotifications, 0);
    const timer = setInterval(loadNotifications, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifyOpen, notifyCat]);

  // Закрытие центра по клику вне панели
  useEffect(() => {
    if (!notifyOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!notifyRef.current?.contains(e.target as Node)) setNotifyOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [notifyOpen]);

  const markRead = (id: string) => setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const markAllRead = () => {
    if (!notifyData) return;
    setReadIds((prev) => Array.from(new Set([...prev, ...notifyData.items.map((n) => n.id)])));
  };
  const togglePin = (id: string) => setPinnedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const snooze = (id: string) => setSnoozedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  // Число непрочитанных по всем категориям — бейдж на колокольчике
  const unreadCount = notifyData ? notifyData.items.filter((n) => !readIds.includes(n.id)).length : 0;

  // Глобальный поиск (Гл. 1.5): запрос с задержкой (debounce 250 мс), результаты
  // сгруппированы по типу сущности. Пустой/короткий запрос очищает список.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      // Сброс откладываем на микротаск — setState в теле эффекта напрямую
      // вызывает предупреждение react-hooks/set-state-in-effect
      const reset = setTimeout(() => {
        setResults(null);
        setSearching(false);
      }, 0);
      return () => clearTimeout(reset);
    }
    const searchingTimer = setTimeout(() => setSearching(true), 0);
    const timer = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(q)}`)
        .then(async (r) => (r.ok ? (r.json() as Promise<SearchResults>) : Promise.reject(new Error("search failed"))))
        .then((j) => setResults(j))
        .catch(() => setResults({ query: q, orders: [], users: [], services: [], bookings: [], documents: [] }))
        .finally(() => setSearching(false));
    }, 250);
    return () => {
      clearTimeout(searchingTimer);
      clearTimeout(timer);
    };
  }, [query]);

  // Закрытие выпадающего списка по клику вне поля поиска
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!searchBoxRef.current?.contains(e.target as Node)) setResults(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // При смене раздела (переход по ссылке результата) закрываем список
  useEffect(() => {
    const reset = setTimeout(() => setResults(null), 0);
    return () => clearTimeout(reset);
  }, [pathname]);

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

      {/* Центр: глобальный поиск (Гл. 1.5) */}
      <div ref={searchBoxRef} className="flex-1 max-w-xl mx-auto relative">
        <div className="flex items-center gap-2 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl px-3.5 h-10 focus-within:border-primary transition-colors">
          <span className={`${searching ? "animate-spin" : ""} text-[var(--admin-muted)]`}>🔍</span>
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
        {results && (
          <div className="absolute top-12 left-0 right-0 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-xl shadow-xl z-50 py-2 text-sm max-h-96 overflow-auto">
            {/* Заказы */}
            {results.orders.length > 0 && (
              <div className="mb-1">
                <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-[var(--admin-muted)] font-semibold">
                  📦 Заказы
                </div>
                {results.orders.map((o) => (
                  <Link
                    key={o.id}
                    href={o.href}
                    className="flex items-center justify-between gap-2 px-4 py-2 hover:bg-[var(--admin-bg)] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[var(--admin-text)]">{o.label}</div>
                      <div className="text-[11px] text-[var(--admin-muted)] truncate">{o.detail}</div>
                    </div>
                    <span className="text-[11px] text-[var(--admin-muted)] shrink-0">{fmtMoney(o.amount)}</span>
                  </Link>
                ))}
              </div>
            )}
            {/* Пользователи и партнёры */}
            {results.users.length > 0 && (
              <div className="mb-1">
                <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-[var(--admin-muted)] font-semibold">
                  👥 Пользователи и партнёры
                </div>
                {results.users.map((u) => (
                  <Link
                    key={u.id}
                    href={u.href}
                    className="flex items-center justify-between gap-2 px-4 py-2 hover:bg-[var(--admin-bg)] transition-colors"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span>{ROLE_ICONS[u.role] ?? "👤"}</span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-[var(--admin-text)]">{u.label}</div>
                        <div className="text-[11px] text-[var(--admin-muted)] truncate">
                          {u.companyName ?? u.detail}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-[var(--admin-muted)] shrink-0 capitalize">{u.role.toLowerCase()}</span>
                  </Link>
                ))}
              </div>
            )}
            {/* Услуги */}
            {results.services.length > 0 && (
              <div className="mb-1">
                <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-[var(--admin-muted)] font-semibold">
                  🧳 Услуги
                </div>
                {results.services.map((s) => (
                  <Link
                    key={s.id}
                    href={s.href}
                    className="flex items-center justify-between gap-2 px-4 py-2 hover:bg-[var(--admin-bg)] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[var(--admin-text)]">{s.label}</div>
                      <div className="text-[11px] text-[var(--admin-muted)] truncate">{s.detail}</div>
                    </div>
                    <span className="text-[11px] text-[var(--admin-muted)] shrink-0">{fmtMoney(s.price)}</span>
                  </Link>
                ))}
              </div>
            )}
            {/* Документы (Гл. 1.5) */}
            {results.documents.length > 0 && (
              <div className="mb-1">
                <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-[var(--admin-muted)] font-semibold">
                  📄 Документы
                </div>
                {results.documents.map((d) => (
                  <Link
                    key={d.id}
                    href={d.href}
                    className="flex items-center justify-between gap-2 px-4 py-2 hover:bg-[var(--admin-bg)] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[var(--admin-text)]">{d.label}</div>
                      <div className="text-[11px] text-[var(--admin-muted)] truncate">{d.detail}</div>
                    </div>
                    <span className="text-[11px] text-[var(--admin-muted)] shrink-0">{d.actor}</span>
                  </Link>
                ))}
              </div>
            )}
            {/* Бронирования */}
            {results.bookings.length > 0 && (
              <div className="mb-1">
                <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-[var(--admin-muted)] font-semibold">
                  📑 Бронирования
                </div>
                {results.bookings.map((b) => (
                  <Link
                    key={b.id}
                    href={b.href}
                    className="flex items-center justify-between gap-2 px-4 py-2 hover:bg-[var(--admin-bg)] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[var(--admin-text)]">{b.label}</div>
                      <div className="text-[11px] text-[var(--admin-muted)] truncate">{b.detail}</div>
                    </div>
                    <span className="text-[11px] text-[var(--admin-muted)] shrink-0">{fmtMoney(b.amount)}</span>
                  </Link>
                ))}
              </div>
            )}
            {/* Пусто */}
            {!results.orders.length && !results.users.length && !results.services.length && !results.bookings.length && !results.documents.length && (
              <div className="px-4 py-3 text-[var(--admin-muted)]">Ничего не найдено по запросу «{results.query}»</div>
            )}
            <div className="px-4 py-1.5 border-t border-[var(--admin-border)] text-[11px] text-[var(--admin-muted)]">
              Найдено:{" "}
              {results.orders.length + results.users.length + results.services.length + results.bookings.length + results.documents.length}
            </div>
          </div>
        )}
      </div>

      {/* Правая часть: иконки */}
      <div className="flex items-center gap-1">
        {/* Центр уведомлений (Гл. 1.43): колокольчик с бейджем + выпадающая панель */}
        <div ref={notifyRef} className="relative">
          <button
            onClick={() => setNotifyOpen((v) => !v)}
            className={`w-10 h-10 rounded-xl hover:bg-[var(--admin-bg)] flex items-center justify-center text-[var(--admin-muted)] transition-colors relative ${notifyOpen ? "bg-[var(--admin-bg)] text-primary" : ""}`}
            title="Центр уведомлений"
          >
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          {notifyOpen && (
            <div className="absolute right-0 top-12 w-[400px] max-w-[calc(100vw-2rem)] bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--admin-border)] flex items-center justify-between gap-2">
                <span className="font-semibold text-sm flex items-center gap-2">🔔 Центр уведомлений</span>
                <div className="flex items-center gap-2">
                  {snoozedIds.length > 0 && (
                    <button
                      onClick={() => setSnoozedIds([])}
                      className="text-[11px] text-[var(--admin-muted)] hover:text-[var(--admin-text)] hover:underline"
                      title="Вернуть все отложенные уведомления в ленту"
                    >
                      ⏰ {snoozedIds.length}
                    </button>
                  )}
                  <button
                    onClick={markAllRead}
                    className="text-[11px] text-primary font-medium hover:underline"
                    title="Отметить все прочитанными"
                  >
                    Прочитать все
                  </button>
                  <button onClick={() => setNotifyOpen(false)} className="text-[var(--admin-muted)] hover:text-[var(--admin-text)]">
                    ✕
                  </button>
                </div>
              </div>
              {/* Фильтры по категориям (Гл. 1.43) */}
              <div className="px-3 pt-2.5 flex gap-1.5 flex-wrap">
                {NOTIFY_CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setNotifyCat(c.key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                      notifyCat === c.key
                        ? "bg-secondary text-white"
                        : "bg-[var(--admin-bg)] text-[var(--admin-muted)] hover:text-[var(--admin-text)]"
                    }`}
                  >
                    {c.label}
                    {notifyData && notifyData.counts[c.key] > 0 && (
                      <span className="ml-1 opacity-70">{notifyData.counts[c.key]}</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="p-3 overflow-y-auto max-h-[50vh] space-y-1.5">
                {notifyLoading && notifyData === null && (
                  <div className="text-sm text-[var(--admin-muted)] py-6 text-center">Загрузка…</div>
                )}
                {notifyData?.items.length === 0 && (
                  <div className="text-sm text-[var(--admin-muted)] py-6 text-center">Нет событий в этой категории ✅</div>
                )}
                {notifyData?.items.map((n) => {
                  const read = readIds.includes(n.id);
                  const pinned = pinnedIds.includes(n.id);
                  const snoozed = snoozedIds.includes(n.id);
                  if (snoozed) return null; // отложенные скрываются из ленты
                  return (
                    <div
                      key={n.id}
                      className={`group rounded-xl border transition-colors ${
                        read ? "border-transparent" : "border-primary/30 bg-primary/5"
                      } ${pinned ? "bg-[#f59e0b]/5 border-[#f59e0b]/30" : ""}`}
                    >
                      <Link
                        href={n.href}
                        onClick={() => markRead(n.id)}
                        className="flex items-start gap-2.5 p-2.5 hover:bg-[var(--admin-bg)] rounded-xl transition-colors"
                      >
                        <span className="text-lg shrink-0">{NOTIFY_ICONS[n.type] ?? "🔔"}</span>
                        <div className="min-w-0 flex-1">
                          <div className={`text-[13px] leading-snug ${read ? "text-[var(--admin-muted)]" : "text-[var(--admin-text)] font-medium"}`}>
                            {n.title}
                          </div>
                          <div className="text-[11px] text-[var(--admin-muted)] mt-0.5 line-clamp-2">{n.detail}</div>
                          <div className="text-[10px] text-[var(--admin-muted)]/70 mt-1">
                            {fmtDateTime(n.at)}
                            {n.criticality === "critical" && <span className="ml-2 text-danger font-medium">🚨 Срочно</span>}
                            {n.criticality === "warning" && <span className="ml-2 text-[#f59e0b]">⚠️ Внимание</span>}
                          </div>
                        </div>
                        {!read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />}
                      </Link>
                      {/* Быстрые действия с уведомлением (Гл. 1.23): закрепить · отложить · прочитано */}
                      <div className="flex items-center gap-1 px-2.5 pb-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => togglePin(n.id)}
                          className={`text-[10px] px-1.5 py-0.5 rounded hover:bg-[var(--admin-bg)] ${pinned ? "text-[#f59e0b]" : "text-[var(--admin-muted)]"}`}
                          title={pinned ? "Снять закрепление" : "Закрепить"}
                        >
                          {pinned ? "★ Закреплено" : "☆ Закрепить"}
                        </button>
                        <button
                          onClick={() => snooze(n.id)}
                          className="text-[10px] px-1.5 py-0.5 rounded text-[var(--admin-muted)] hover:bg-[var(--admin-bg)]"
                          title="Отложить — скрыть из ленты"
                        >
                          ⏰ Отложить
                        </button>
                        {!read && (
                          <button
                            onClick={() => markRead(n.id)}
                            className="text-[10px] px-1.5 py-0.5 rounded text-[var(--admin-muted)] hover:bg-[var(--admin-bg)]"
                          >
                            ✓ Прочитано
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {/* Быстрое создание (Гл. 1.5) */}
        <div ref={quickRef} className="relative">
          <button
            onClick={() => setPanelsOpen((v) => (v === "quick" ? null : "quick"))}
            className={`px-3 h-10 rounded-xl text-xs font-medium transition-colors shrink-0 ${
              panelsOpen === "quick" ? "bg-primary text-white" : "bg-primary/10 text-primary hover:bg-primary/20"
            }`}
            title="Быстрое создание"
          >
            ＋ Создать
          </button>
          {panelsOpen === "quick" && (
            <div className="absolute right-0 top-12 w-64 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-xl shadow-xl z-50 py-1.5 text-sm">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-[var(--admin-muted)] font-semibold">
                Быстрое создание
              </div>
              {[
                { icon: "📦", label: "Новый заказ", href: "/admin/sales-execution?open=new" },
                { icon: "🧳", label: "Добавить услугу", href: "/admin/catalog" },
                { icon: "🤝", label: "Добавить партнера", href: "/admin/crm" },
                { icon: "📄", label: "Создать счет", href: "/admin/finance" },
                { icon: "📊", label: "Новый отчет", href: "/admin/reports" },
                { icon: "👤", label: "Пригласить пользователя", href: "/admin/users" },
              ].map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  onClick={() => setPanelsOpen(null)}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--admin-bg)] transition-colors"
                >
                  <span className="text-base shrink-0">{a.icon}</span>
                  <span className="truncate">{a.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        {/* Сообщения (Гл. 1.24): панель непрочитанных */}
        <div ref={messagesRef} className="relative">
          <button
            onClick={() => setPanelsOpen((v) => (v === "messages" ? null : "messages"))}
            className={`w-10 h-10 rounded-xl hover:bg-[var(--admin-bg)] flex items-center justify-center text-[var(--admin-muted)] transition-colors relative ${panelsOpen === "messages" ? "bg-[var(--admin-bg)] text-primary" : ""}`}
            title="Сообщения"
          >
            💬
            {(() => {
              const unread = panelData?.messages.unread ?? 0;
              return unread > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null;
            })()}
          </button>
          {panelsOpen === "messages" && (
            <div className="absolute right-0 top-12 w-[360px] max-w-[calc(100vw-2rem)] bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--admin-border)] flex items-center justify-between">
                <span className="font-semibold text-sm">💬 Сообщения</span>
                {!panelData && <span className="text-[11px] text-[var(--admin-muted)]">Загрузка…</span>}
              </div>
              <div className="p-3 space-y-1.5 max-h-[50vh] overflow-y-auto">
                {panelData?.messages.items.length === 0 && (
                  <div className="text-sm text-[var(--admin-muted)] py-6 text-center">Нет непрочитанных сообщений ✅</div>
                )}
                {panelData?.messages.items.map((m) => (
                  <Link
                    key={m.id}
                    href={m.href}
                    onClick={() => setPanelsOpen(null)}
                    className="block p-2.5 rounded-xl bg-[var(--admin-bg)] hover:border-primary border border-transparent transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold truncate">{m.senderName}</span>
                      <span className="text-[10px] text-[var(--admin-muted)] shrink-0">{fmtDateTime(m.createdAt)}</span>
                    </div>
                    <div className="text-sm mt-1 line-clamp-2">{m.text}</div>
                    <div className="text-[11px] text-primary font-medium mt-1">Заказ №{m.order.orderNumber} →</div>
                  </Link>
                ))}
                {panelData && panelData.messages.items.length > 0 && (
                  <Link href="/admin/sales-execution" onClick={() => setPanelsOpen(null)} className="block text-center text-[11px] text-primary font-medium pt-1 hover:underline">
                    Перейти в реестр заказов →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
        {/* Календарь (Гл. 1.25): компактный список заказов */}
        <div ref={calendarRef} className="relative">
          <button
            onClick={() => setPanelsOpen((v) => (v === "calendar" ? null : "calendar"))}
            className={`hidden sm:flex w-10 h-10 rounded-xl hover:bg-[var(--admin-bg)] items-center justify-center text-[var(--admin-muted)] transition-colors ${panelsOpen === "calendar" ? "bg-[var(--admin-bg)] text-primary" : ""}`}
            title="Календарь"
          >
            📅
          </button>
          {panelsOpen === "calendar" && (
            <div className="absolute right-0 top-12 w-[360px] max-w-[calc(100vw-2rem)] bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--admin-border)] flex items-center justify-between">
                <span className="font-semibold text-sm">📅 Календарь заказов</span>
                {!panelData && <span className="text-[11px] text-[var(--admin-muted)]">Загрузка…</span>}
              </div>
              <div className="p-3 space-y-3 max-h-[50vh] overflow-y-auto">
                {[
                  { label: "Просроченные", items: panelData?.calendar.overdue ?? [], color: "text-danger" },
                  { label: "Сегодня", items: panelData?.calendar.today ?? [], color: "text-primary" },
                  { label: "Завтра", items: panelData?.calendar.tomorrow ?? [], color: "text-[var(--admin-muted)]" },
                ].map((g) => (
                  <div key={g.label}>
                    <div className={`text-[11px] font-semibold uppercase tracking-wide ${g.color} mb-1.5`}>
                      {g.label} · {g.items.length}
                    </div>
                    {g.items.length === 0 && <div className="text-xs text-[var(--admin-muted)]">—</div>}
                    {g.items.map((o) => (
                      <Link
                        key={o.id}
                        href={`/admin/sales-execution?open=${o.id}&tab=overview`}
                        onClick={() => setPanelsOpen(null)}
                        className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-[var(--admin-bg)]"
                      >
                        <span className="truncate">№{o.orderNumber} · {o.user.firstName} {o.user.lastName ?? ""}</span>
                        <span className="text-[var(--admin-muted)] shrink-0">{o.serviceDate ? fmtDateTime(o.serviceDate) : "—"}</span>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
        {/* Профиль пользователя (Гл. 1.5) */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setPanelsOpen((v) => (v === "profile" ? null : "profile"))}
            className={`w-10 h-10 rounded-xl bg-secondary text-white flex items-center justify-center text-xs font-bold hover:opacity-90 transition-opacity ${panelsOpen === "profile" ? "ring-2 ring-primary" : ""}`}
            title="Профиль"
          >
            {initials || "А"}
          </button>
          {panelsOpen === "profile" && (
            <div className="absolute right-0 top-12 w-72 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3.5 bg-secondary text-white">
                <div className="font-semibold text-sm">
                  {profile?.firstName} {profile?.lastName}
                </div>
                <div className="text-[11px] text-gray-400 truncate">{profile?.email}</div>
                <div className="text-[10px] text-gray-400 capitalize mt-0.5">
                  {roleLabel} · {profile?.companyName ?? "TravelHub"}
                </div>
              </div>
              <div className="py-1.5">
                <Link
                  href="/admin/settings"
                  onClick={() => setPanelsOpen(null)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-[var(--admin-bg)] transition-colors"
                >
                  ⚙️ Настройки
                </Link>
                <Link
                  href="/admin/system"
                  onClick={() => setPanelsOpen(null)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-[var(--admin-bg)] transition-colors"
                >
                  🖥 Система и аудит
                </Link>
                <div className="border-t border-[var(--admin-border)] my-1" />
                <Link
                  href="/api/auth/logout"
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-danger hover:bg-danger/5 transition-colors"
                >
                  🚪 Выйти
                </Link>
              </div>
            </div>
          )}
        </div>
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
