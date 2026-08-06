"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkline, DonutChart, CHART_COLORS } from "@/components/admin/charts";
import { fmtMoney, fmtDateTime, fmtNumber, ruPlural, MANAGERS } from "@/lib/admin-data";
import { describeApiError } from "@/lib/api-error";
import {
  WidgetFrame,
  WidgetActionsContext,
  ActivityMap,
  exportCSV,
  exportExcel,
  exportPDF,
  exportPNG,
  WIDGET_META,
  WIDGET_GROUP_LABELS,
  PERIOD_OPTIONS,
  WORKSPACES,
  defaultLayoutFor,
  loadWorkspacesState,
  saveWorkspacesState,
  exportWorkspaceJSON,
  copyWorkspaceJSON,
  parseWorkspaceJSON,
  aiComposeDashboard,
  logDashboardAction,
  clearDashboardHistory,
  loadDashboardHistory,
  flagEmoji,
  type PeriodKey,
  type LayoutState,
  type AiComposeResult,
} from "@/components/admin/dashboard-widgets";

/* ─── Типы данных API (Гл. 1: Центр управления) ─── */

interface KpiCard {
  value: number;
  change: number;
  spark?: number[];
  planPct?: number;
  forecast?: number;
}

interface DashData {
  greeting: { name: string; timeOfDay: string; dateText: string; activeUsers: number; attentionTasks: number };
  kpi: {
    ordersToday: KpiCard;
    ordersInWork: KpiCard;
    awaitingConfirmation: KpiCard;
    awaitingPayment: KpiCard;
    completed: KpiCard;
    revenueToday: KpiCard;
    revenueMonth: KpiCard;
    commission: KpiCard;
    newUsers: KpiCard;
    newPartners: KpiCard;
  };
  queues: { key: string; label: string; statuses: string[]; count: number }[];
  tasks: { id: string; orderNumber: string; title: string; client: string; priority: string; deadline: string | Date; amount: number; tab?: string }[];
  ai: {
    summary: { text: string; href?: string }[];
    recommendations: { level: string; title: string; effect: string; action: string }[];
    warnings: { title: string; detail: string }[];
    forecast: { label: string; change: number }[];
  };
  notifications: { id: string; type: string; title: string; detail: string; at: string | Date; href: string }[];
  messages: {
    unread: number;
    items: {
      id: string;
      senderName: string;
      text: string;
      createdAt: string | Date;
      order: { id: string; orderNumber: string };
      href: string;
    }[];
  };
  calendar: {
    today: CalendarOrderItem[];
    tomorrow: CalendarOrderItem[];
    overdue: CalendarOrderItem[];
    upcoming: CalendarOrderItem[];
  };
  departments: {
    sales: { received: number; transferred: number; conversion: number };
    operations: { received: number; confirmed: number; noAvailability: number; priceChanged: number; avgTime: string };
    support: { tickets: number; avgResponse: string };
    moderation: { newServices: number; rejected: number };
  };
  events: { id: string; type: string; title: string; detail: string; at: string | Date; href?: string }[];
  health: Record<string, { status: string; latency?: string; detail?: string }>;
  system: { cpu: number; memory: number; apiMs: number; dbMs: number; queue: number; storage: string; uptime: number };
  salesByCategory: { type: string; label: string; icon: string; revenue: number }[];
  popularDestinations: { name: string; code: string | null; revenue: number; sales: number }[];
  finance: {
    revenueToday: number;
    revenueMonth: number;
    commission: number;
    partnerPayouts: number;
    debtTotal: number;
    refunds: number;
    refundsCount: number;
    expectedInflow: number;
    awaitingCount: number;
  };
  userActivity: {
    online: number;
    managerActions: number;
    managerLabel: string;
    lastLogins: { id: string; name: string; email: string; role: string; at: string | Date }[];
    inactive: number;
  };
  decisionFeed: { level: string; title: string; impact: string; action: string; href: string }[];
  footer: {
    version: string;
    lastUpdate: string | Date;
    integrations: Record<string, { status: string; detail?: string }>;
    queue: number;
    docs: { label: string; href: string }[];
  };
  taskCounts: {
    status: string;
    label: string;
    count: number;
    reminded: number;
    notReminded: { orderNumber: string; client: string }[];
  }[];
  periodLabel: string;
  partnersAll: number;
  sales: {
    newRequests: number;
    paidOrders: number;
    paidAmount: number;
    avgCheck: number;
    conversion: number;
    topManagers: { name: string; orders: number; amount: number }[];
  };
  execution: {
    inProcessing: number;
    awaitingSupplier: number;
    docsReady: number;
    overdue: number;
    avgTime: string;
  };
}

/* ─── Стили и хелперы ─── */

/** Пункт виджета «Календарь»: заказ + deep-link на карточку в реестре. */
interface CalendarOrderItem {
  id: string;
  orderNumber: string;
  serviceDate: string | Date;
  status: string;
  user: { firstName: string; lastName: string | null };
  href: string;
}

const CARD_COLORS: Record<string, string> = {
  ordersToday: "#3b82f6",
  ordersInWork: "#06b6d4",
  awaitingConfirmation: "#f59e0b",
  awaitingPayment: "#f97316",
  completed: "#22c55e",
  revenueToday: "#22c55e",
  revenueMonth: "#f97316",
  commission: "#8b5cf6",
  newUsers: "#3b82f6",
  newPartners: "#14b8a6",
};

const NOTIFY_ICONS: Record<string, string> = {
  order: "📦",
  confirm: "✅",
  pay: "⏳",
  paid: "💳",
  refund: "↩️",
  done: "🏁",
  user: "👤",
  review: "⭐",
};

const QUEUE_HINTS: Record<string, string> = {
  new: "Созданные заявки, ожидающие обработки",
  check: "Ожидают ответа поставщика",
  pay: "Ждут оплаты от клиента",
  ops: "В работе операционного отдела",
  docs: "Документы готовы к выдаче",
  refund: "Оформление возвратов",
};

export default function CommandCenter({ defaultWorkspace = "main", role = "ADMIN", userName = "" }: { defaultWorkspace?: string; role?: string; userName?: string }) {
  const [data, setData] = useState<DashData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiTab, setAiTab] = useState<"summary" | "recs" | "warnings" | "forecast">("summary");
  // Настройка Dashboard (Гл. 1.17, 1.44): период данных и рабочие пространства —
  // у каждого пространства свой макет (скрытые виджеты, порядок, размеры, избранное).
  // Стартовое пространство берётся из настроек пользователя/роли (Гл. 1.2).
  const [period, setPeriod] = useState<PeriodKey>("month");
  // Настройка виджета (Гл. 1.33): страна и тип услуги фильтруют данные дашборда
  const [widgetCountry, setWidgetCountry] = useState("");
  const [widgetType, setWidgetType] = useState("");
  const [wsState] = useState(() => loadWorkspacesState(defaultWorkspace));
  const [activeWs, setActiveWs] = useState<string>(wsState.active);
  const [userDefaultWs, setUserDefaultWs] = useState<string>(defaultWorkspace);
  const [layouts, setLayouts] = useState<Record<string, LayoutState>>(wsState.layouts);
  const [libOpen, setLibOpen] = useState(false);
  const [aiBuilderOpen, setAiBuilderOpen] = useState(false);
  const [aiBuilderQuery, setAiBuilderQuery] = useState("");
  const [aiCompose, setAiCompose] = useState<AiComposeResult | null>(null);
  const [aiApplyMsg, setAiApplyMsg] = useState<"ok" | null>(null);
  const aiApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fullscreen, setFullscreen] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  // Меню настроек пространства (Гл. 1.44): экспорт / импорт / обмен / сброс
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  // История изменений Dashboard (Гл. 1.41) и шаблоны (Гл. 1.36)
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<ReturnType<typeof loadDashboardHistory>>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; role: string; name: string; layout: string; createdAt: string }[]>([]);
  const [templatesMsg, setTemplatesMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const templatesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Быстрые действия с задачами (Гл. 1.8): назначение менеджера и отложенные
  const [taskAssignments, setTaskAssignments] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem("travelhub:tasks:assignments:v1") ?? "{}") as Record<string, string>;
    } catch {
      return {};
    }
  });
  const [snoozedTasks, setSnoozedTasks] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("travelhub:tasks:snoozed:v1") ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const [assignOpenFor, setAssignOpenFor] = useState<string | null>(null);
  const assignRefs = useRef(new Map<string, HTMLDivElement>());
  // Контекстное меню виджета (Гл. 1.34): настройка и дубликаты
  const [duplicates, setDuplicates] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("travelhub:dashboard:duplicates:v1") ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const [configureFor, setConfigureFor] = useState<string | null>(null);
  const [configurePeriod, setConfigurePeriod] = useState<PeriodKey>("month");
  const [configureCountry, setConfigureCountry] = useState("");
  const [configureType, setConfigureType] = useState("");
  // Совместный доступ (Гл. 1.40): выбор получателей + ссылка-макет
  const [shareOpen, setShareOpen] = useState(false);
  const [staff, setStaff] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [shareSelected, setShareSelected] = useState<string[]>([]);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [incomingShare, setIncomingShare] = useState<{ layout: LayoutState; workspace?: string; from: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<"ok" | "error" | null>(null);
  const [defaultMsg, setDefaultMsg] = useState<"ok" | "error" | null>(null);
  const wsMenuRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const defaultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = (p: PeriodKey = period, country = widgetCountry, type = widgetType) => {
    setError(null);
    const params = new URLSearchParams({ period: p });
    if (country) params.set("country", country);
    if (type) params.set("type", type);
    fetch(`/api/admin/dashboard?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await describeApiError(r, "Ошибка загрузки данных"));
        return r.json();
      })
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Неизвестная ошибка"));
  };

  useEffect(() => {
    void Promise.resolve().then(() => load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Авто-применение шаблона роли при первом заходе (Гл. 1.36): если для роли
  // есть сохранённый шаблон, а у пользователя ещё нет собственного макета,
  // применяем шаблон. Повторно не применяем — только при первом заходе.
  useEffect(() => {
    try {
      const appliedKey = `travelhub:dashboard:template-applied:${role}`;
      if (localStorage.getItem(appliedKey)) return;
      fetch(`/api/admin/dashboard-templates?role=${encodeURIComponent(role)}`)
        .then(async (r) => (r.ok ? (r.json() as Promise<{ items: { id: string; role: string; name: string; layout: string }[] }>) : Promise.reject(new Error("templates failed"))))
        .then((j) => {
          const t = j.items[0];
          if (!t) return;
          const parsed = parseWorkspaceJSON(t.layout);
          logDashboardAction("template", `Авто-применён шаблон «${t.name}» для роли ${role}`);
          setLayouts((prev) => ({ ...prev, [parsed.workspace ?? "main"]: parsed.layout }));
          if (parsed.workspace) setActiveWs(parsed.workspace);
          // Флаг ставим только после успешного применения — при сбое сети
          // шаблон применится при следующем заходе
          try {
            localStorage.setItem(appliedKey, "1");
          } catch {
            /* localStorage недоступен */
          }
        })
        .catch(() => {
          /* тихо: шаблон недоступен — оставляем макет по умолчанию */
        });
    } catch {
      /* localStorage недоступен */
    }
  }, [role]);

  // Текущий макет активного пространства (или макет по умолчанию)
  const layout = layouts[activeWs] ?? defaultLayoutFor(activeWs);
  // Изменение макета активного пространства
  const updateLayout = (fn: (l: LayoutState) => LayoutState) =>
    setLayouts((prev) => ({ ...prev, [activeWs]: fn(prev[activeWs] ?? defaultLayoutFor(activeWs)) }));

  // Сохранение всех рабочих пространств в localStorage
  useEffect(() => {
    saveWorkspacesState(activeWs, layouts);
  }, [activeWs, layouts]);

  // Закрытие меню настроек пространства по клику вне его (Гл. 1.44)
  useEffect(() => {
    if (!wsMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!wsMenuRef.current?.contains(e.target as Node)) setWsMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [wsMenuOpen]);

  // Очистка таймеров сообщений при размонтировании
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (defaultTimerRef.current) clearTimeout(defaultTimerRef.current);
      if (aiApplyTimerRef.current) clearTimeout(aiApplyTimerRef.current);
      if (templatesTimerRef.current) clearTimeout(templatesTimerRef.current);
    };
  }, []);

  // Совместный доступ (Гл. 1.40): при открытии модалки загружаем сотрудников
  const openShare = () => {
    setShareOpen(true);
    setShareLink(null);
    setShareCopied(false);
    fetch("/api/admin/dashboard-share")
      .then(async (r) => (r.ok ? (r.json() as Promise<{ items: { id: string; name: string; email: string; role: string }[] }>) : Promise.reject(new Error("staff failed"))))
      .then((j) => setStaff(j.items))
      .catch(() => {
        /* тихо: список недоступен */
      });
  };
  // Генерация ссылки с закодированным макетом текущего пространства
  const buildShareLink = () => {
    const payload = {
      app: "travelhub-admin",
      version: 1,
      workspace: activeWs,
      layout: layouts[activeWs] ?? defaultLayoutFor(activeWs),
      from: userName,
    };
    // base64url — безопасно для URL
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const url = `${window.location.origin}/admin?share=${b64}`;
    setShareLink(url);
    return url;
  };
  // Обработка входящей ссылки ?share=…: предлагаем применить чужой макет
  useEffect(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get("share");
      if (!raw) return;
      const json = decodeURIComponent(escape(atob(raw.replace(/-/g, "+").replace(/_/g, "/"))));
      const data = JSON.parse(json) as { app?: string; workspace?: string; layout?: LayoutState; from?: string };
      if (data.app !== "travelhub-admin" || !data.layout) return;
      const shared = data.layout as LayoutState;
      // setState откладываем на микротаск — вызов в теле эффекта напрямую
      // вызывает предупреждение react-hooks/set-state-in-effect
      setTimeout(() => {
        setIncomingShare({
          layout: {
            hidden: shared.hidden ?? [],
            order: shared.order ?? [],
            stars: shared.stars ?? [],
            sizes: shared.sizes ?? {},
          },
          workspace: data.workspace,
          from: data.from ?? "",
        });
      }, 0);
    } catch {
      /* повреждённая ссылка — игнорируем */
    }
  }, []);
  // Применение полученного макета
  const applyIncomingShare = () => {
    if (!incomingShare) return;
    const target = incomingShare.workspace ?? activeWs;
    logDashboardAction("share", `Применён макет, полученный по ссылке${incomingShare.from ? ` от ${incomingShare.from}` : ""}`);
    setLayouts((prev) => ({ ...prev, [target]: incomingShare.layout }));
    if (incomingShare.workspace) setActiveWs(incomingShare.workspace);
    setIncomingShare(null);
    // Убираем share из URL, чтобы не применять повторно
    window.history.replaceState({}, "", window.location.pathname);
  };
  // Персист дубликатов виджетов (Гл. 1.34)
  useEffect(() => {
    try {
      localStorage.setItem("travelhub:dashboard:duplicates:v1", JSON.stringify(duplicates));
    } catch {
      /* localStorage недоступен */
    }
  }, [duplicates]);
  // Персист назначений и отложенных задач (Гл. 1.8)
  useEffect(() => {
    try {
      localStorage.setItem("travelhub:tasks:assignments:v1", JSON.stringify(taskAssignments));
    } catch {
      /* localStorage недоступен */
    }
  }, [taskAssignments]);
  useEffect(() => {
    try {
      localStorage.setItem("travelhub:tasks:snoozed:v1", JSON.stringify(snoozedTasks));
    } catch {
      /* localStorage недоступен */
    }
  }, [snoozedTasks]);
  // Закрытие выпадающего списка назначения по клику вне (Гл. 1.8)
  useEffect(() => {
    if (!assignOpenFor) return;
    const onClick = (e: MouseEvent) => {
      const el = assignRefs.current.get(assignOpenFor);
      if (el && !el.contains(e.target as Node)) setAssignOpenFor(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [assignOpenFor]);

  // Фоновое обновление счётчика «N новых» в виджете «Сообщения» (Гл. 1.24):
  // раз в минуту опрашиваем лёгкий эндпоинт и тихо подменяем только блок
  // messages — без перезагрузки дашборда. Сбой сети игнорируем: показываем
  // последние успешно полученные значения.
  useEffect(() => {
    const refresh = () => {
      fetch("/api/admin/dashboard/messages")
        .then(async (r) => {
          if (!r.ok) throw new Error("poll failed");
          return r.json();
        })
        .then((messages: DashData["messages"]) => {
          setData((prev) => (prev ? { ...prev, messages } : prev));
        })
        .catch(() => {
          /* тихо: оставляем предыдущие значения */
        });
    };
    const timer = setInterval(refresh, 60_000);
    // Плюс мгновенное обновление при возврате на вкладку/окно: если менеджер
    // прочитал сообщения в реестре заказов и вернулся на дашборд раньше тика,
    // счётчик не должен устаревать до конца минуты.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  /* ─── Виджет-система (Гл. 1.17, 1.30–1.37): видимость, избранное, порядок ─── */
  const isVisible = (key: string) => !layout.hidden.includes(key);
  const isStar = (key: string) => layout.stars.includes(key);
  const toggleStar = (key: string) => {
    const w = WIDGET_META.find((x) => x.key === key);
    const adding = !layout.stars.includes(key);
    logDashboardAction("star", `${adding ? "Закреплён в избранном" : "Снят из избранного"} виджет «${w?.title ?? key}»`);
    updateLayout((l) => ({
      ...l,
      stars: l.stars.includes(key) ? l.stars.filter((k) => k !== key) : [...l.stars, key],
    }));
  };
  const hideWidget = (key: string) => {
    const w = WIDGET_META.find((x) => x.key === key);
    logDashboardAction("hide", `Скрыт виджет «${w?.title ?? key}»`);
    updateLayout((l) => (l.hidden.includes(key) ? l : { ...l, hidden: [...l.hidden, key] }));
  };
  const showWidget = (key: string) => {
    const w = WIDGET_META.find((x) => x.key === key);
    logDashboardAction("show", `Возвращён виджет «${w?.title ?? key}»`);
    updateLayout((l) => ({ ...l, hidden: l.hidden.filter((k) => k !== key) }));
  };

  /* ── Рабочие пространства: экспорт / импорт / сброс (Гл. 1.44) ── */
  const resetWorkspace = () => {
    logDashboardAction("reset", `Пространство «${WORKSPACES.find((w) => w.key === activeWs)?.label}» сброшено к настройкам по умолчанию`);
    setLayouts((prev) => ({ ...prev, [activeWs]: defaultLayoutFor(activeWs) }));
    setWsMenuOpen(false);
    setConfirmReset(false);
  };
  const handleExport = () => {
    exportWorkspaceJSON(activeWs, layouts);
    setWsMenuOpen(false);
  };
  const handleCopy = async () => {
    const ok = await copyWorkspaceJSON(activeWs, layouts);
    setCopyMsg(ok ? "ok" : "error");
    setWsMenuOpen(false);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyMsg(null), 3000);
  };
  const applyImport = (text: string) => {
    try {
      const { layout, workspace } = parseWorkspaceJSON(text);
      // Если в JSON указано пространство — применяем к нему, иначе к активному
      const target = workspace ?? activeWs;
      logDashboardAction("import", `Импортирован макет в пространство «${WORKSPACES.find((w) => w.key === target)?.label ?? target}»`);
      setLayouts((prev) => ({ ...prev, [target]: layout }));
      setActiveWs(target);
      setImportOpen(false);
      setImportText("");
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Ошибка импорта");
    }
  };

  /* ── Шаблоны Dashboard (Гл. 1.36) ── */
  const loadTemplates = () => {
    fetch("/api/admin/dashboard-templates")
      .then(async (r) => (r.ok ? (r.json() as Promise<{ items: typeof templates }>) : Promise.reject(new Error("templates failed"))))
      .then((j) => setTemplates(j.items))
      .catch(() => {
        /* тихо */
      });
  };
  // Сохранить текущий макет активного пространства как шаблон для роли
  const saveTemplate = async (name: string, role: string) => {
    try {
      const r = await fetch("/api/admin/dashboard-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, name, layout: JSON.stringify(layouts[activeWs] ?? defaultLayoutFor(activeWs)) }),
      });
      if (!r.ok) throw new Error("save failed");
      setTemplatesMsg({ ok: true, text: `Шаблон «${name}» сохранён для роли ${role}` });
      logDashboardAction("template", `Создан шаблон «${name}» для роли ${role}`);
      loadTemplates();
    } catch {
      setTemplatesMsg({ ok: false, text: "Не удалось сохранить шаблон" });
    }
    if (templatesTimerRef.current) clearTimeout(templatesTimerRef.current);
    templatesTimerRef.current = setTimeout(() => setTemplatesMsg(null), 3000);
  };
  // Применить шаблон к текущему пространству (layout хранит LayoutState)
  const applyTemplate = (t: { id: string; role: string; name: string; layout: string }) => {
    try {
      const parsed = parseWorkspaceJSON(t.layout);
      logDashboardAction("template", `Применён шаблон «${t.name}» (роль ${t.role})`);
      setLayouts((prev) => ({ ...prev, [activeWs]: parsed.layout }));
      if (parsed.workspace) setActiveWs(parsed.workspace);
      setTemplatesMsg({ ok: true, text: `Шаблон «${t.name}» применён` });
    } catch {
      setTemplatesMsg({ ok: false, text: "Не удалось применить шаблон: повреждённый макет" });
    }
    if (templatesTimerRef.current) clearTimeout(templatesTimerRef.current);
    templatesTimerRef.current = setTimeout(() => setTemplatesMsg(null), 3000);
  };
  const deleteTemplate = async (id: string, name: string) => {
    try {
      await fetch(`/api/admin/dashboard-templates?id=${id}`, { method: "DELETE" });
      logDashboardAction("template", `Удалён шаблон «${name}»`);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setTemplatesMsg({ ok: true, text: `Шаблон «${name}» удалён` });
    } catch {
      setTemplatesMsg({ ok: false, text: "Не удалось удалить шаблон" });
    }
    if (templatesTimerRef.current) clearTimeout(templatesTimerRef.current);
    templatesTimerRef.current = setTimeout(() => setTemplatesMsg(null), 3000);
  };
  const onImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImportText(typeof reader.result === "string" ? reader.result : "");
      setImportError(null);
    };
    reader.readAsText(file);
  };
  // «Сделать стартовым» (Гл. 1.2): закрепляет пространство по умолчанию
  // в настройках пользователя через PATCH /api/auth/me.
  const makeDefaultWorkspace = async () => {
    setWsMenuOpen(false);
    try {
      const r = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultWorkspace: activeWs }),
      });
      if (!r.ok) throw new Error("patch failed");
      setUserDefaultWs(activeWs);
      setDefaultMsg("ok");
    } catch {
      setDefaultMsg("error");
    }
    if (defaultTimerRef.current) clearTimeout(defaultTimerRef.current);
    defaultTimerRef.current = setTimeout(() => setDefaultMsg(null), 3000);
  };

  // Верхнеуровневые секции дашборда — их порядок меняется Drag & Drop (Гл. 1.35)
  const SECTION_KEYS = ["kpi", "workarea", "sales-row", "map-row", "decision", "departments", "events", "health", "footer"];
  const sectionOrder = (() => {
    const saved = layout.order.filter((k) => SECTION_KEYS.includes(k));
    return [...saved, ...SECTION_KEYS.filter((k) => !saved.includes(k))];
  })();
  const moveSection = (from: string, to: string) => {
    if (from === to) return;
    const labelOf = (k: string) => WIDGET_META.find((w) => w.key === k)?.title ?? k;
    logDashboardAction("move", `Секция «${labelOf(from)}» перемещена после «${labelOf(to)}»`);
    updateLayout((l) => {
      const order = sectionOrder.slice();
      const i = order.indexOf(from);
      const j = order.indexOf(to);
      if (i < 0 || j < 0) return l;
      order.splice(i, 1);
      order.splice(j, 0, from);
      return { ...l, order };
    });
  };
  const sectionVisible = (key: string): boolean => {
    switch (key) {
      case "kpi":
        return isVisible("kpi");
      case "workarea":
        return ["tasks", "queues", "quick", "ai", "notifications", "messages", "calendar"].some(isVisible);
      case "sales-row":
        return ["sales", "execution", "finance"].some(isVisible);
      case "map-row":
        return ["map", "activity"].some(isVisible);
      default:
        return isVisible(key);
    }
  };
  const resetDrag = () => {
    setDragKey(null);
    setDragOverKey(null);
  };

  // Обёртка верхнеуровневой секции (Гл. 1.31, 1.35): панель «перетащить / размер»
  // над контентом + подсветка цели при Drag & Drop.
  const sectionWrap = (key: string, children: React.ReactNode) => {
    const size = layout.sizes[key] ?? "lg";
    const widthCls = size === "sm" ? "max-w-2xl mx-auto" : size === "md" ? "max-w-4xl mx-auto" : "";
    return (
      <div
        className={`group relative rounded-2xl ${widthCls} ${dragOverKey === key && dragKey && dragKey !== key ? "ring-2 ring-primary/70" : ""}`}
        onDragOver={(e) => {
          if (dragKey && dragKey !== key) {
            e.preventDefault();
            setDragOverKey(key);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragKey) moveSection(dragKey, key);
          resetDrag();
        }}
        onDragEnd={resetDrag}
      >
        {/* Панель управления секцией: появляется при наведении */}
        <div className="flex items-center justify-center gap-1.5 h-0 overflow-hidden opacity-0 group-hover:h-7 group-hover:opacity-100 transition-all duration-150">
          <span
            draggable
            onDragStart={() => {
              setDragKey(key);
              setDragOverKey(null);
            }}
            title="Перетащите, чтобы изменить порядок секций"
            className="w-6 h-6 rounded-lg flex items-center justify-center text-sm text-[var(--admin-muted)] hover:bg-[var(--admin-bg)] cursor-grab active:cursor-grabbing select-none"
          >
            ⠿
          </span>
          <span className="w-px h-4 bg-[var(--admin-border)]" />
          {(
            [
              ["sm", "Малый"],
              ["md", "Средний"],
              ["lg", "Полный"],
            ] as const
          ).map(([s, label]) => (
            <button
              key={s}
              onClick={() => {
                logDashboardAction("size", `Размер секции «${WIDGET_META.find((w) => w.key === key)?.title ?? key}» → ${label}`);
                updateLayout((l) => ({ ...l, sizes: { ...l.sizes, [key]: s } }));
              }}
              className={`px-2 h-6 rounded-lg text-[10px] font-medium transition-colors ${
                size === s ? "bg-secondary text-white" : "text-[var(--admin-muted)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-text)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {children}
      </div>
    );
  };

  /* ── Экспорт виджета в CSV (Гл. 1.39) ── */
  const exportWidget = (key: string) => {
    if (!data) return;
    switch (key) {
      case "kpi":
        exportCSV("dashboard-kpi.csv", [
          ["Показатель", "Значение", "Изменение"],
          ["Заказы за период", data.kpi.ordersToday.value, `${data.kpi.ordersToday.change}%`],
          ["Заказы в работе", data.kpi.ordersInWork.value, `${data.kpi.ordersInWork.change}%`],
          ["Ожидают подтверждения", data.kpi.awaitingConfirmation.value, `${data.kpi.awaitingConfirmation.change}%`],
          ["Ожидают оплаты", data.kpi.awaitingPayment.value, `${data.kpi.awaitingPayment.change}%`],
          ["Выполненные", data.kpi.completed.value, `${data.kpi.completed.change}%`],
          ["Доход за период", fmtMoney(data.kpi.revenueToday.value), `${data.kpi.revenueToday.change}%`],
          ["Доход за период (прогноз)", fmtMoney(data.kpi.revenueMonth.value), `${data.kpi.revenueMonth.change}%`],
          ["Комиссия платформы", fmtMoney(data.kpi.commission.value), `${data.kpi.commission.change}%`],
          ["Новые пользователи", data.kpi.newUsers.value, `${data.kpi.newUsers.change}%`],
          ["Новые партнёры", data.kpi.newPartners.value, `${data.kpi.newPartners.change}%`],
        ]);
        break;
      case "sales":
        exportCSV("dashboard-sales.csv", [
          ["Метрика", "Значение"],
          ["Новые заявки", data.sales.newRequests],
          ["Оплаченные заказы", data.sales.paidOrders],
          ["Выручка", fmtMoney(data.sales.paidAmount)],
          ["Средний чек", fmtMoney(data.sales.avgCheck)],
          ["Конверсия", `${data.sales.conversion}%`],
          ...data.sales.topManagers.map((m) => ["Менеджер: " + m.name, `${m.orders} заказов, ${fmtMoney(m.amount)}`] as (string | number)[]),
        ]);
        break;
      case "execution":
        exportCSV("dashboard-execution.csv", [
          ["Метрика", "Значение"],
          ["В обработке", data.execution.inProcessing],
          ["Ждут ответа поставщика", data.execution.awaitingSupplier],
          ["Готовы документы", data.execution.docsReady],
          ["Просроченные", data.execution.overdue],
          ["Среднее время обработки", data.execution.avgTime],
        ]);
        break;
      case "finance":
        exportCSV("dashboard-finance.csv", [
          ["Метрика", "Значение"],
          ["Доход месяца", fmtMoney(data.finance.revenueMonth)],
          ["Комиссия", fmtMoney(data.finance.commission)],
          ["Выплаты партнёрам", fmtMoney(data.finance.partnerPayouts)],
          ["Задолженности", fmtMoney(data.finance.debtTotal)],
          ["Возвраты", `${data.finance.refundsCount} · ${fmtMoney(data.finance.refunds)}`],
          ["Ожидаемые поступления", fmtMoney(data.finance.expectedInflow)],
          ["Доход сегодня", fmtMoney(data.finance.revenueToday)],
        ]);
        break;
      case "tasks":
        exportCSV("dashboard-tasks.csv", [
          ["Заказ", "Задача", "Клиент", "Приоритет", "Срок"],
          ...data.tasks.map((t) => [t.orderNumber, t.title, t.client, t.priority, fmtDateTime(t.deadline)] as (string | number)[]),
        ]);
        break;
      case "queues":
        exportCSV("dashboard-queues.csv", [["Очередь", "Количество"], ...data.queues.map((q) => [q.label, q.count])]);
        break;
      case "notifications":
        exportCSV("dashboard-notifications.csv", [
          ["Событие", "Детали", "Время"],
          ...data.notifications.map((n) => [n.title, n.detail, fmtDateTime(n.at)] as (string | number)[]),
        ]);
        break;
      case "messages":
        exportCSV("dashboard-messages.csv", [
          ["Отправитель", "Сообщение", "Время"],
          ...data.messages.items.map((m) => [m.senderName, m.text, fmtDateTime(m.createdAt)] as (string | number)[]),
        ]);
        break;
      case "calendar":
        exportCSV("dashboard-calendar.csv", [
          ["Группа", "Заказ", "Клиент", "Дата"],
          ...([
            ["Сегодня", data.calendar.today],
            ["Завтра", data.calendar.tomorrow],
            ["Просроченные", data.calendar.overdue],
            ["Предстоящие", data.calendar.upcoming],
          ] as [string, typeof data.calendar.today][]).flatMap(([g, items]) =>
            items.map((o) => [g, `№${o.orderNumber}`, `${o.user.firstName} ${o.user.lastName ?? ""}`, fmtDateTime(o.serviceDate)] as (string | number)[])
          ),
        ]);
        break;
      case "map":
        exportCSV("dashboard-map.csv", [
          ["Страна", "Код", "Продажи", "Выручка"],
          ...data.popularDestinations.map((d) => [d.name, d.code ?? "", d.sales, fmtMoney(d.revenue)] as (string | number)[]),
        ]);
        break;
      case "activity":
        exportCSV("dashboard-activity.csv", [
          ["Метрика", "Значение"],
          ["Онлайн сейчас", data.userActivity.online],
          ["Действий менеджеров за месяц", data.userActivity.managerActions],
          ["Неактивных 30+ дней", data.userActivity.inactive],
          ...data.userActivity.lastLogins.map((u) => ["Вход: " + (u.name || u.email), fmtDateTime(u.at)] as (string | number)[]),
        ]);
        break;
      case "decision":
        exportCSV("dashboard-decision.csv", [
          ["Уровень", "Проблема", "Влияние", "Действие"],
          ...data.decisionFeed.map((d) => [d.level, d.title, d.impact, d.action] as (string | number)[]),
        ]);
        break;
      case "departments":
        exportCSV("dashboard-departments.csv", [
          ["Подразделение", "Метрика", "Значение"],
          ["Продажи", "Получено", data.departments.sales.received],
          ["Продажи", "Передано", data.departments.sales.transferred],
          ["Продажи", "Конверсия", `${data.departments.sales.conversion}%`],
          ["Операционный отдел", "Получено", data.departments.operations.received],
          ["Операционный отдел", "Подтверждено", data.departments.operations.confirmed],
          ["Операционный отдел", "Нет мест", data.departments.operations.noAvailability],
          ["Операционный отдел", "Цена изменилась", data.departments.operations.priceChanged],
          ["Операционный отдел", "Среднее время", data.departments.operations.avgTime],
          ["Поддержка", "Обращений", data.departments.support.tickets],
          ["Поддержка", "Среднее время ответа", data.departments.support.avgResponse],
          ["Модерация", "Новых услуг", data.departments.moderation.newServices],
          ["Модерация", "Отклонено", data.departments.moderation.rejected],
        ]);
        break;
      case "events":
        exportCSV("dashboard-events.csv", [
          ["Событие", "Детали", "Время"],
          ...data.events.map((e) => [e.title, e.detail, fmtDateTime(e.at)] as (string | number)[]),
        ]);
        break;
      case "health":
        exportCSV("dashboard-health.csv", [
          ["Сервис", "Статус", "Детали"],
          ...Object.entries(data.health).map(([k, v]) => [k, v.status, v.detail ?? v.latency ?? ""] as (string | number)[]),
        ]);
        break;
    }
  };

  /* ── Экспорт виджета в других форматах (Гл. 1.39): Excel/PDF/PNG ── */
  const exportWidgetMore = (key: string, format: "xls" | "pdf" | "png") => {
    if (!data) return;
    const title = WIDGET_META.find((w) => w.key === key)?.title ?? key;
    const rowsFor = (): (string | number)[][] => {
      switch (key) {
        case "kpi":
          return [
            ["Показатель", "Значение", "Изменение"],
            ["Заказы за период", data.kpi.ordersToday.value, `${data.kpi.ordersToday.change}%`],
            ["Заказы в работе", data.kpi.ordersInWork.value, `${data.kpi.ordersInWork.change}%`],
            ["Ожидают подтверждения", data.kpi.awaitingConfirmation.value, `${data.kpi.awaitingConfirmation.change}%`],
            ["Ожидают оплаты", data.kpi.awaitingPayment.value, `${data.kpi.awaitingPayment.change}%`],
            ["Выполненные", data.kpi.completed.value, `${data.kpi.completed.change}%`],
            ["Доход за период", fmtMoney(data.kpi.revenueToday.value), `${data.kpi.revenueToday.change}%`],
            ["Комиссия платформы", fmtMoney(data.kpi.commission.value), `${data.kpi.commission.change}%`],
            ["Новые пользователи", data.kpi.newUsers.value, `${data.kpi.newUsers.change}%`],
            ["Новые партнёры", data.kpi.newPartners.value, `${data.kpi.newPartners.change}%`],
          ];
        case "tasks":
          return [
            ["Заказ", "Задача", "Клиент", "Приоритет"],
            ...data.tasks.map((t) => [t.orderNumber, t.title, t.client, t.priority]),
          ];
        case "queues":
          return [["Очередь", "Количество"], ...data.queues.map((q) => [q.label, q.count])];
        case "sales":
          return [
            ["Метрика", "Значение"],
            ["Новые заявки", data.sales.newRequests],
            ["Оплаченные заказы", data.sales.paidOrders],
            ["Выручка", fmtMoney(data.sales.paidAmount)],
            ["Средний чек", fmtMoney(data.sales.avgCheck)],
            ["Конверсия", `${data.sales.conversion}%`],
            ...data.sales.topManagers.map((m) => ["Менеджер: " + m.name, `${m.orders} заказов, ${fmtMoney(m.amount)}`]),
          ];
        case "execution":
          return [
            ["Метрика", "Значение"],
            ["В обработке", data.execution.inProcessing],
            ["Ждут ответа поставщика", data.execution.awaitingSupplier],
            ["Готовы документы", data.execution.docsReady],
            ["Просроченные", data.execution.overdue],
            ["Среднее время обработки", data.execution.avgTime],
          ];
        case "finance":
          return [
            ["Метрика", "Значение"],
            ["Доход месяца", fmtMoney(data.finance.revenueMonth)],
            ["Комиссия", fmtMoney(data.finance.commission)],
            ["Выплаты партнёрам", fmtMoney(data.finance.partnerPayouts)],
            ["Задолженности", fmtMoney(data.finance.debtTotal)],
            ["Возвраты", `${data.finance.refundsCount} · ${fmtMoney(data.finance.refunds)}`],
          ];
        case "notifications":
          return [
            ["Событие", "Детали", "Время"],
            ...data.notifications.map((n) => [n.title, n.detail, fmtDateTime(n.at)]),
          ];
        case "map":
          return [
            ["Страна", "Продажи", "Выручка"],
            ...data.popularDestinations.map((d) => [d.name, d.sales, fmtMoney(d.revenue)]),
          ];
        case "departments":
          return [
            ["Подразделение", "Метрика", "Значение"],
            ["Продажи", "Конверсия", `${data.departments.sales.conversion}%`],
            ["Операционный отдел", "Подтверждено", data.departments.operations.confirmed],
            ["Операционный отдел", "Нет мест", data.departments.operations.noAvailability],
            ["Поддержка", "Обращений", data.departments.support.tickets],
            ["Модерация", "Новых услуг", data.departments.moderation.newServices],
          ];
        case "events":
          return [
            ["Событие", "Детали", "Время"],
            ...data.events.map((e) => [e.title, e.detail, fmtDateTime(e.at)]),
          ];
        default:
          return [["Показатель", "Значение"], ["Период", data.periodLabel]];
      }
    };
    const rows = rowsFor();
    const base = `dashboard-${key}`;
    if (format === "xls") exportExcel(`${base}.xls`, title, rows);
    else if (format === "pdf") exportPDF(`${base}.pdf`, title, rows);
    else exportPNG(`${base}.png`, title, rows);
  };

  /* ── Полноэкранный режим (Гл. 1.38): укрупнённый вид виджета ── */
  const fullscreenView = (key: string) => {
    if (!data) return null;
    switch (key) {
      case "kpi":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {kpiCards.map((c) => (
              <div key={c.key} className="bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-2xl p-4">
                <div className="text-sm text-[var(--admin-muted)] font-medium mb-2">{c.title}</div>
                {c.body}
              </div>
            ))}
          </div>
        );
      case "sales":
        return <SalesWidget data={data} />;
      case "execution":
        return <ExecutionWidget data={data} />;
      case "finance":
        return <FinanceWidget data={data} />;
      case "map":
        return <ActivityMap destinations={data.popularDestinations} periodLabel={data.periodLabel} />;
      case "activity":
        return <ActivityWidget data={data} />;
      case "tasks":
        return (
          <div className="space-y-2">
            {data.tasks.map((t) => (
              <div key={t.id} className="p-3 rounded-xl bg-[var(--admin-bg)] flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{t.title}</div>
                  <div className="text-xs text-[var(--admin-muted)]">Заказ №{t.orderNumber} · {t.client}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${t.priority === "high" ? "bg-danger/15 text-danger" : "bg-[#f59e0b]/15 text-[#f59e0b]"}`}>
                    {t.priority === "high" ? "Высокий" : "Средний"}
                  </span>
                  <span className="text-xs text-[var(--admin-muted)]">⏰ {fmtDateTime(t.deadline)}</span>
                  <Link href={`/admin/sales-execution?open=${t.id}&tab=overview`} className="text-xs text-primary font-medium hover:underline">Открыть</Link>
                </div>
              </div>
            ))}
          </div>
        );
      case "queues":
        return (
          <div className="space-y-2">
            {data.queues.map((q) => (
              <Link key={q.key} href={`/admin/sales-execution?status=${q.statuses.join(",")}`} className="flex items-center justify-between p-3 rounded-xl bg-[var(--admin-bg)] hover:border-primary border border-transparent transition-colors">
                <span className="text-sm">{q.label}</span>
                <span className="text-lg font-bold text-primary">{q.count}</span>
              </Link>
            ))}
          </div>
        );
      case "ai":
        return (
          <div className="space-y-4">
            <AiBlock data={data} tab="summary" />
            <AiBlock data={data} tab="recs" />
            <AiBlock data={data} tab="warnings" />
            <AiBlock data={data} tab="forecast" />
          </div>
        );
      case "notifications":
        return (
          <div className="space-y-2">
            {data.notifications.map((n) => (
              <Link key={n.id} href={n.href} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--admin-bg)] hover:border-primary border border-transparent transition-colors">
                <span className="text-lg shrink-0">{NOTIFY_ICONS[n.type] ?? "🔔"}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{n.title}</div>
                  <div className="text-xs text-[var(--admin-muted)]">{n.detail} · {fmtDateTime(n.at)}</div>
                </div>
              </Link>
            ))}
          </div>
        );
      case "messages":
        return (
          <div className="space-y-2">
            {data.messages.items.map((m) => (
              <Link key={m.id} href={m.href} className="block p-3 rounded-xl bg-[var(--admin-bg)] hover:border-primary border border-transparent transition-colors">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{m.senderName}</span>
                  <span className="text-[var(--admin-muted)]">{fmtDateTime(m.createdAt)}</span>
                </div>
                <div className="text-sm mt-1">{m.text}</div>
                <div className="text-[11px] text-primary font-medium mt-1">Заказ №{m.order.orderNumber} →</div>
              </Link>
            ))}
          </div>
        );
      case "calendar":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Просроченные", items: data.calendar.overdue, color: "text-danger" },
              { label: "Сегодня", items: data.calendar.today, color: "text-primary" },
              { label: "Завтра", items: data.calendar.tomorrow, color: "text-[var(--admin-muted)]" },
              { label: "Предстоящие", items: data.calendar.upcoming, color: "text-[var(--admin-muted)]" },
            ].map((g) => (
              <div key={g.label} className="p-3 rounded-xl bg-[var(--admin-bg)]">
                <div className={`text-xs font-semibold uppercase tracking-wide ${g.color} mb-2`}>{g.label} · {g.items.length}</div>
                {g.items.map((o) => (
                  <Link key={o.id} href={o.href} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-[var(--admin-card)]">
                    <span>№{o.orderNumber} · {o.user.firstName} {o.user.lastName ?? ""}</span>
                    <span className="text-[var(--admin-muted)]">{fmtDateTime(o.serviceDate)}</span>
                  </Link>
                ))}
                {!g.items.length && <div className="text-xs text-[var(--admin-muted)]">—</div>}
              </div>
            ))}
          </div>
        );
      case "decision":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.decisionFeed.map((d, i) => (
              <Link key={i} href={d.href} className="p-4 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] hover:border-primary/40 transition-colors">
                <div className="font-semibold text-sm">
                  {d.level === "high" ? "⚠️" : d.level === "medium" ? "🟡" : d.level === "info" ? "ℹ️" : "✅"} {d.title}
                </div>
                <div className="text-xs text-[var(--admin-muted)] mt-1"><span className="font-medium">Влияние:</span> {d.impact}</div>
                <div className="text-xs text-primary font-medium mt-2">▶ {d.action}</div>
              </Link>
            ))}
          </div>
        );
      case "departments":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <DeptCard title="🏢 Продажи" rows={[["Получено", String(data.departments.sales.received)], ["Передано", String(data.departments.sales.transferred)], ["Конверсия", `${data.departments.sales.conversion}%`]]} />
            <DeptCard title="⚙️ Операционный отдел" rows={[["Получено", String(data.departments.operations.received)], ["Подтверждено", String(data.departments.operations.confirmed)], ["Нет мест", String(data.departments.operations.noAvailability)], ["Цена изменилась", String(data.departments.operations.priceChanged)], ["Среднее время", data.departments.operations.avgTime]]} />
            <DeptCard title="🎧 Поддержка" rows={[["Обращений", String(data.departments.support.tickets)], ["Среднее время ответа", data.departments.support.avgResponse]]} />
            <DeptCard title="🛡 Модерация" rows={[["Новых услуг", String(data.departments.moderation.newServices)], ["Отклонено", String(data.departments.moderation.rejected)]]} />
          </div>
        );
      case "events":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {data.events.map((e) => (
              <div key={e.id} className="flex items-start gap-2 text-sm p-3 rounded-xl bg-[var(--admin-bg)]">
                <span className="text-base shrink-0">{e.type === "order" ? "📦" : e.type === "user" ? "👤" : "⭐"}</span>
                <div className="min-w-0">
                  <div className="truncate">{e.title}</div>
                  <div className="text-[11px] text-[var(--admin-muted)]">{e.detail} · {fmtDateTime(e.at)}</div>
                </div>
              </div>
            ))}
          </div>
        );
      case "health":
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
              {Object.entries(data.health).map(([key, v]) => (
                <div key={key} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-[var(--admin-bg)]">
                  <span className={`w-2.5 h-2.5 rounded-full ${v.status === "green" ? "bg-success" : v.status === "yellow" ? "bg-[#f59e0b]" : v.status === "red" ? "bg-danger" : "bg-gray-400"}`} />
                  <span className="capitalize">{key}</span>
                  <span className="ml-auto text-xs text-[var(--admin-muted)]">{v.latency ?? v.detail}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { label: "CPU", value: `${data.system.cpu}%` },
                { label: "Память", value: `${data.system.memory}%` },
                { label: "API", value: `${data.system.apiMs}ms` },
                { label: "БД", value: `${data.system.dbMs}ms` },
                { label: "Uptime", value: `${data.system.uptime} мин` },
              ].map((m) => (
                <div key={m.label} className="p-3 rounded-lg bg-[var(--admin-bg)] text-center">
                  <div className="text-[10px] text-[var(--admin-muted)] uppercase tracking-wide">{m.label}</div>
                  <div className="text-lg font-semibold">{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return <div className="text-sm text-[var(--admin-muted)]">Полноэкранный вид недоступен для этого виджета.</div>;
    }
  };

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-[var(--admin-card)] border border-red-200 rounded-2xl p-8 text-center max-w-md mx-auto">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-lg font-bold text-[var(--admin-text)] mb-2">Ошибка загрузки</h2>
          <p className="text-sm text-[var(--admin-muted)] mb-1">{error}</p>
          <p className="text-[11px] text-[var(--admin-muted)]/70 mb-4">Подробности — в консоли браузера (F12)</p>
          <button
            onClick={() => load()}
            className="ac-btn ac-btn-primary"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="h-11 bg-[var(--admin-border)]/40 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-32 bg-[var(--admin-border)]/40 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const { kpi, greeting } = data;

  /* ── KPI-карточки (Гл. 1.7) ── */
  const kpiCards = buildKpiCards(kpi, period);

  const quickActions = [
    { icon: "➕", label: "Новый заказ", href: "/admin/sales-execution?open=new" },
    { icon: "➕", label: "Новый партнер", href: "/admin/crm" },
    { icon: "➕", label: "Новая услуга", href: "/admin/catalog" },
    { icon: "📄", label: "Создать счет", href: "/admin/finance" },
    { icon: "📧", label: "Отправить письмо", href: "/admin/support" },
    { icon: "📊", label: "Новый отчет", href: "/admin/reports" },
    { icon: "🤖", label: "Запустить AI анализ", href: "/admin/ai-center" },
  ];

  const capFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

  return (
    <WidgetActionsContext.Provider
      value={{
        // «Настроить» (Гл. 1.34, 1.33): открывает настройки виджета с периодом,
        // страной и типом услуги — фильтры применяются к данным дашборда.
        onConfigure: (key) => {
          setConfigureFor(key);
          setConfigurePeriod(period);
          setConfigureCountry(widgetCountry);
          setConfigureType(widgetType);
        },
        // «Дублировать» (Гл. 1.34): показывает копию виджета в секции «Дубликаты»
        onDuplicate: (key) => {
          if (duplicates.includes(key)) return; // повторное дублирование не нужно
          logDashboardAction("duplicate", `Виджет «${WIDGET_META.find((w) => w.key === key)?.title ?? key}» продублирован`);
          setDuplicates((prev) => (prev.includes(key) ? prev : [...prev, key]));
        },
      }}
    >
    <div className="space-y-6">
      {/* ── Заголовок страницы (Гл. 1.6): приветствие + быстрые действия ── */}
      <div className="bg-gradient-to-br from-primary to-primary-dark text-white rounded-2xl p-5 lg:p-6 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-48 h-48 bg-white/10 rounded-full" />
        <div className="absolute right-16 bottom-0 w-24 h-24 bg-white/5 rounded-full" />
        <div className="relative">
          <h1 className="text-xl lg:text-2xl font-bold">
            {greeting.timeOfDay}, {greeting.name}!
          </h1>
          <p className="text-white/80 text-sm mt-1">
            Сегодня {capFirst(greeting.dateText)}. На платформе сейчас {fmtNumber(greeting.activeUsers)} активных пользователей.
            Есть {greeting.attentionTasks} {ruPlural(greeting.attentionTasks, "задача", "задачи", "задач")}, требующих внимания.
          </p>
          <div className="flex gap-2 mt-4 flex-wrap">
            <Link
              href="/admin/catalog"
              className="ac-btn ac-btn-glass"
            >
              ➕ Добавить услугу
            </Link>
            <Link
              href="/admin/crm"
              className="ac-btn ac-btn-glass"
            >
              ➕ Добавить партнера
            </Link>
            <Link
              href="/admin/analytics"
              className="ac-btn ac-btn-glass"
            >
              📊 Открыть аналитику
            </Link>
            <Link
              href="/admin/reports"
              className="ac-btn ac-btn-glass"
            >
              📑 Создать отчет
            </Link>
          </div>
        </div>
      </div>

      {/* ── Рабочие пространства (Гл. 1.44): переключение одним кликом ── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="ac-tabs flex-wrap">
        {WORKSPACES.map((ws) => {
          const active = activeWs === ws.key;
          return (
            <button
              key={ws.key}
              onClick={() => setActiveWs(ws.key)}
              title={ws.description}
              className={`ac-tab ${active ? "ac-tab-active" : ""}`}
            >
              {ws.icon} {ws.label}
            </button>
          );
        })}
        </div>
        {/* Меню настроек пространства: экспорт, импорт, обмен, сброс (Гл. 1.44) */}
        <div ref={wsMenuRef} className="relative">
          <button
            onClick={() => {
              setWsMenuOpen((v) => !v);
              if (!wsMenuOpen) setConfirmReset(false);
            }}
            title="Настройки пространства: экспорт, импорт, сброс"
            className={`ac-btn ac-btn-sm ac-btn-icon ${wsMenuOpen ? "ac-btn-primary" : "ac-btn-secondary"}`}
          >
            ⚙️
          </button>
          {wsMenuOpen && (
            <div className="absolute left-0 top-10 w-72 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-xl shadow-xl z-40 py-1.5 text-xs">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-[var(--admin-muted)] font-semibold flex items-center gap-1.5">
                {WORKSPACES.find((w) => w.key === activeWs)?.icon}{" "}
                {WORKSPACES.find((w) => w.key === activeWs)?.label}
                <span className="normal-case font-normal">— макет пространства</span>
              </div>
              <button
                onClick={handleExport}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--admin-bg)] transition-colors"
              >
                📤 Экспорт макета (JSON)
              </button>
              <button
                onClick={() => {
                  setImportOpen(true);
                  setWsMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--admin-bg)] transition-colors"
              >
                📥 Импорт макета
              </button>
              <button
                onClick={handleCopy}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--admin-bg)] transition-colors"
              >
                🔗 Скопировать JSON для обмена
              </button>
              <button
                onClick={makeDefaultWorkspace}
                disabled={activeWs === userDefaultWs}
                title={
                  activeWs === userDefaultWs
                    ? "Это стартовое пространство вашего аккаунта"
                    : "Закрепить в настройках пользователя как стартовое"
                }
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--admin-bg)] transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
              >
                {activeWs === userDefaultWs ? "✅ Стартовое пространство" : "⭐ Сделать стартовым"}
              </button>
              <button
                onClick={() => {
                  setHistoryItems(loadDashboardHistory());
                  setHistoryOpen(true);
                  setWsMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--admin-bg)] transition-colors"
              >
                🕘 История изменений
              </button>
              <button
                onClick={() => {
                  loadTemplates();
                  setTemplatesOpen(true);
                  setWsMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--admin-bg)] transition-colors"
              >
                📐 Шаблоны Dashboard
              </button>
              <button
                onClick={() => {
                  openShare();
                  setWsMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--admin-bg)] transition-colors"
              >
                🔗 Поделиться дашбордом
              </button>
              <div className="border-t border-[var(--admin-border)] my-1" />
              <button
                onClick={() => (confirmReset ? resetWorkspace() : setConfirmReset(true))}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--admin-bg)] transition-colors text-danger"
              >
                {confirmReset ? "⚠️ Нажмите ещё раз для сброса" : "🔄 Сбросить к настройкам по умолчанию"}
              </button>
            </div>
          )}
        </div>
        {copyMsg && (
          <span className={`text-[10px] font-medium ${copyMsg === "ok" ? "text-success" : "text-danger"}`}>
            {copyMsg === "ok"
              ? "✓ JSON скопирован в буфер обмена"
              : "⚠️ Не удалось скопировать: буфер обмена недоступен"}
          </span>
        )}
        {defaultMsg && (
          <span className={`text-[10px] font-medium ${defaultMsg === "ok" ? "text-success" : "text-danger"}`}>
            {defaultMsg === "ok"
              ? "✓ Пространство закреплено стартовым для вашего аккаунта"
              : "⚠️ Не удалось сохранить настройку"}
          </span>
        )}
        <span className="text-[10px] text-[var(--admin-muted)]">— у каждого пространства свой набор виджетов и настроек</span>
      </div>

      {/* ── Панель инструментов: период данных + библиотека виджетов (Гл. 1.17, 1.32, 1.33) ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="ac-tabs">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setPeriod(p.key);
                  load(p.key);
                }}
                disabled={p.key === period}
                className={`ac-tab ${p.key === period ? "ac-tab-active" : ""}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Настройка виджета (Гл. 1.33): страна и тип услуги фильтруют данные */}
          <div className="flex items-center gap-1.5">
            <select
              value={widgetCountry}
              onChange={(e) => {
                const v = e.target.value;
                setWidgetCountry(v);
                logDashboardAction("filter", `Фильтр по стране: ${v || "все"}`);
                load(period, v, widgetType);
              }}
              className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-xl px-2 h-8 text-[11px] outline-none focus:border-primary transition-colors"
              title="Фильтр по стране (Гл. 1.33)"
            >
              <option value="">🌍 Все страны</option>
              {(data?.popularDestinations ?? []).map((d) => (
                <option key={d.code ?? d.name} value={d.code ?? ""}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              value={widgetType}
              onChange={(e) => {
                const v = e.target.value;
                setWidgetType(v);
                logDashboardAction("filter", `Фильтр по услуге: ${v || "все"}`);
                load(period, widgetCountry, v);
              }}
              className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-xl px-2 h-8 text-[11px] outline-none focus:border-primary transition-colors"
              title="Фильтр по типу услуги (Гл. 1.33)"
            >
              <option value="">🧩 Все услуги</option>
              {(data?.salesByCategory ?? []).map((s) => (
                <option key={s.type} value={s.type}>
                  {s.icon} {s.label}
                </option>
              ))}
            </select>
            {(widgetCountry || widgetType) && (
              <button
                onClick={() => {
                  setWidgetCountry("");
                  setWidgetType("");
                  logDashboardAction("filter", "Фильтры виджета сброшены");
                  load(period, "", "");
                }}
                className="px-2 h-8 rounded-xl text-[11px] text-danger hover:bg-danger/10 transition-colors"
                title="Сбросить фильтры"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setAiBuilderOpen(true);
              setAiCompose(null);
              setAiApplyMsg(null);
            }}
            className="ac-btn ac-btn-primary ac-btn-sm"
            title="Опишите словами, что хотите видеть — AI соберёт дашборд (Гл. 1.42)"
          >
            ✨ AI-конструктор
          </button>
          <button
            onClick={() => setLibOpen(true)}
            className="ac-btn ac-btn-secondary ac-btn-sm"
          >
            ➕ Добавить виджет
          </button>
        </div>
      </div>

      {/* Избранные виджеты (Гл. 1.37) */}
      {layout.stars.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--admin-muted)] font-semibold uppercase tracking-wide">⭐ Избранное:</span>
          {layout.stars.map((key) => {
            const m = WIDGET_META.find((w) => w.key === key);
            if (!m) return null;
            return (
              <button
                key={key}
                onClick={() => setFullscreen(key)}
                className="ac-btn ac-btn-secondary ac-btn-sm"
                title="Открыть в полноэкранном режиме"
              >
                {m.icon} {m.title}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Входящий общий доступ (Гл. 1.40): баннер применения чужого макета ── */}
      {incomingShare && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <span className="font-semibold">🔗 Вам открыли доступ к макету дашборда</span>
            <div className="text-xs text-[var(--admin-muted)] mt-0.5">
              {incomingShare.from ? `От: ${incomingShare.from} · ` : ""}
              пространство «{WORKSPACES.find((w) => w.key === incomingShare.workspace)?.label ?? "Главный"}»
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setIncomingShare(null);
                window.history.replaceState({}, "", window.location.pathname);
              }}
              className="px-3 h-9 rounded-xl text-xs text-[var(--admin-muted)] hover:bg-[var(--admin-card)] transition-colors"
            >
              Отклонить
            </button>
            <button
              onClick={applyIncomingShare}
              className="px-4 h-9 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-dark transition-colors"
            >
              Применить макет
            </button>
          </div>
        </div>
      )}

      {/* ── KPI-панель (Гл. 1.7) ── */}
      {isVisible("kpi") &&
        sectionWrap(
          "kpi",
          <WidgetFrame
            title="Ключевые показатели"
            icon="📊"
            widgetKey="kpi"
            subtitle={`за ${data.periodLabel}`}
            starred={isStar("kpi")}
            onStar={() => toggleStar("kpi")}
            onHide={() => hideWidget("kpi")}
            onFullscreen={() => setFullscreen("kpi")}
            onExport={() => exportWidget("kpi")}
            onExportMore={(f) => exportWidgetMore("kpi", f)}
            onRefresh={() => load()}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              {kpiCards.map((card) => {
                const color = CARD_COLORS[card.key] ?? "#94a3b8";
                return (
                  <Link
                    key={card.key}
                    href={card.href}
                    className="ac-card ac-card-hover p-3.5 group flex flex-col"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="ac-kpi-icon shrink-0" style={{ background: `${color}1a` }}>
                        <span style={{ color }}>{card.key.includes("revenue") || card.key === "commission" ? "💰" : "📊"}</span>
                      </span>
                      <span className="text-[11px] font-medium text-[var(--admin-muted)] leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                        {card.title}
                      </span>
                    </div>
                    <div className="mt-2.5 flex-1">{card.body}</div>
                  </Link>
                );
              })}
            </div>
          </WidgetFrame>
        )}

      {/* ── Рабочая область: 3 колонки (Гл. 1.18) ── */}
      {sectionVisible("workarea") &&
        sectionWrap(
          "workarea",
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Левая колонка: Задачи · Очереди · Быстрые действия */}
        <div className="space-y-4">
          {/* Мои задачи (Гл. 1.19) */}
          {isVisible("tasks") && (
            <WidgetFrame
              title="Мои задачи"
              icon="🎯"
              widgetKey="tasks"
              starred={isStar("tasks")}
              onStar={() => toggleStar("tasks")}
              onHide={() => hideWidget("tasks")}
              onFullscreen={() => setFullscreen("tasks")}
              onExport={() => exportWidget("tasks")}
              onExportMore={(f) => exportWidgetMore("tasks", f)}
            >
            {/* Счётчики по типам задач: общее число проблем каждого типа.
                У оплатных типов — подпись «из них напомнено N» (заказы, по которым
                менеджер уже отправлял сообщение-напоминание). Тултип (title) чипа
                перечисляет заказы, по которым напоминание ещё НЕ отправлено. */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {data.taskCounts.map((t) => {
                const notReminded = t.notReminded ?? [];
                // Точное число «не напомнено» = count − reminded (some/none — точные
                // дополнения), не зависит от take:20 в API. В тултип попадают первые 6
                // номеров из списка, остаток — числом.
                const totalNotReminded = Math.max(0, t.count - t.reminded);
                const tip =
                  notReminded.length > 0
                    ? `Напоминание не отправлено: ${notReminded
                        .slice(0, 6)
                        .map((o) => `${o.orderNumber}${o.client ? ` (${o.client})` : ""}`)
                        .join(", ")}${totalNotReminded > 6 ? ` и ещё ${totalNotReminded - 6}` : ""}`
                    : undefined;
                return (
                  <Link
                    key={t.status}
                    href={`/admin/sales-execution?status=${t.status}`}
                    title={tip}
                    className="ac-chip"
                  >
                    {t.label} <b className="text-[var(--admin-text)]">{t.count}</b>
                    {t.reminded > 0 && (
                      <span className="block text-[10px] text-success/90 mt-0.5">из них напомнено {t.reminded}</span>
                    )}
                  </Link>
                );
              })}
            </div>
            <div className="space-y-2">
              {data.tasks
                .filter((t) => !snoozedTasks.includes(t.id))
                .slice(0, 5)
                .map((t) => (
                  <div key={t.id} className="p-2.5 rounded-xl bg-[var(--admin-bg)]">
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${t.priority === "high" ? "bg-danger" : "bg-[#f59e0b]"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate">{t.title}</div>
                        <div className="text-[11px] text-[var(--admin-muted)] mt-0.5">
                          Заказ №{t.orderNumber} · {t.client}
                          {taskAssignments[t.id] && (
                            <span className="ml-1.5 text-primary">· ответственный: {taskAssignments[t.id]}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1.5 gap-2">
                          <span className="text-[10px] text-[var(--admin-muted)]">⏰ {fmtDateTime(t.deadline)}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Назначить ответственного (Гл. 1.8) */}
                            <div
                              ref={(el) => {
                                if (el) assignRefs.current.set(t.id, el);
                                else assignRefs.current.delete(t.id);
                              }}
                              className="relative"
                            >
                              <button
                                onClick={() => setAssignOpenFor((v) => (v === t.id ? null : t.id))}
                                className="text-[11px] px-1.5 py-0.5 rounded text-[var(--admin-muted)] hover:text-primary hover:bg-[var(--admin-card)] transition-colors"
                                title="Назначить ответственного"
                              >
                                👤
                              </button>
                              {assignOpenFor === t.id && (
                                <div className="absolute right-0 top-6 w-48 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-xl shadow-xl z-40 py-1 text-xs">
                                  {MANAGERS.map((m) => (
                                    <button
                                      key={m}
                                      onClick={() => {
                                        logDashboardAction("task", `Задача №${t.orderNumber} назначена на ${m}`);
                                        setTaskAssignments((prev) => ({ ...prev, [t.id]: m }));
                                        setAssignOpenFor(null);
                                      }}
                                      className="w-full text-left px-3 py-1.5 hover:bg-[var(--admin-bg)] transition-colors"
                                    >
                                      {taskAssignments[t.id] === m ? "✓ " : ""}
                                      {m}
                                    </button>
                                  ))}
                                  {taskAssignments[t.id] && (
                                    <button
                                      onClick={() => {
                                        setTaskAssignments((prev) => {
                                          const next = { ...prev };
                                          delete next[t.id];
                                          return next;
                                        });
                                        setAssignOpenFor(null);
                                      }}
                                      className="w-full text-left px-3 py-1.5 text-danger hover:bg-danger/5 transition-colors"
                                    >
                                      Снять назначение
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* Отложить (Гл. 1.8) */}
                            <button
                              onClick={() => {
                                logDashboardAction("task", `Задача №${t.orderNumber} отложена`);
                                setSnoozedTasks((prev) => (prev.includes(t.id) ? prev : [...prev, t.id]));
                              }}
                              className="text-[11px] px-1.5 py-0.5 rounded text-[var(--admin-muted)] hover:text-[#f59e0b] hover:bg-[var(--admin-card)] transition-colors"
                              title="Отложить"
                            >
                              ⏸
                            </button>
                            <Link
                              href={`/admin/sales-execution?open=${t.id}&tab=overview`}
                              className="text-[11px] text-primary font-medium hover:underline"
                            >
                              Открыть
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              {!data.tasks.length && <div className="text-sm text-[var(--admin-muted)]">Нет задач, требующих внимания ✅</div>}
              {snoozedTasks.length > 0 && (
                <button
                  onClick={() => setSnoozedTasks([])}
                  className="w-full text-[11px] text-[var(--admin-muted)] hover:text-[var(--admin-text)] py-1.5 transition-colors"
                >
                  ⏸ Вернуть {snoozedTasks.length} отложенную(ых) задачу(и)
                </button>
              )}
            </div>
            </WidgetFrame>
          )}

          {/* Очереди (Гл. 1.21) */}
          {isVisible("queues") && (
            <WidgetFrame
              title="Очереди"
              icon="📥"
              widgetKey="queues"
              starred={isStar("queues")}
              onStar={() => toggleStar("queues")}
              onHide={() => hideWidget("queues")}
              onFullscreen={() => setFullscreen("queues")}
              onExport={() => exportWidget("queues")}
              onExportMore={(f) => exportWidgetMore("queues", f)}
            >
              <div className="space-y-1.5">
                {data.queues.map((q) => (
                  <Link
                    key={q.key}
                    href={`/admin/sales-execution?status=${q.statuses.join(",")}`}
                    title={QUEUE_HINTS[q.key]}
                    className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-[var(--admin-bg)] transition-colors group"
                  >
                    <span className="text-sm text-[var(--admin-muted)] group-hover:text-[var(--admin-text)]">{q.label}</span>
                    <span className="text-sm font-bold text-[var(--admin-text)] group-hover:text-primary transition-colors">{q.count}</span>
                  </Link>
                ))}
              </div>
            </WidgetFrame>
          )}

          {/* Быстрые действия (Гл. 1.20) */}
          {isVisible("quick") && (
            <WidgetFrame title="Быстрые действия" icon="⚡" widgetKey="quick" starred={isStar("quick")} onStar={() => toggleStar("quick")} onHide={() => hideWidget("quick")}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {quickActions.map((a) => (
                  <Link
                    key={a.label}
                    href={a.href}
                    className="ac-chip justify-start w-full"
                  >
                    <span>{a.icon}</span>
                    <span className="truncate">{a.label}</span>
                  </Link>
                ))}
              </div>
            </WidgetFrame>
          )}
        </div>

        {/* Центральная колонка: AI Центр (Гл. 1.22) */}
        <div className="space-y-4 lg:col-span-2">
          {isVisible("ai") && (
            <WidgetFrame
              title="AI Центр"
              icon="🤖"
              widgetKey="ai"
              starred={isStar("ai")}
              onStar={() => toggleStar("ai")}
              onHide={() => hideWidget("ai")}
              onFullscreen={() => setFullscreen("ai")}
              onExport={() => exportWidget("ai")}
              onExportMore={(f) => exportWidgetMore("ai", f)}
            >
              <div className="ac-tabs flex-wrap mb-3">
                {(
                  [
                    ["summary", "Сводка"],
                    ["recs", "Рекомендации"],
                    ["warnings", "Предупреждения"],
                    ["forecast", "Прогноз"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setAiTab(key)}
                    className={`ac-tab ${aiTab === key ? "ac-tab-active" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

            {aiTab === "summary" && (
              <div className="space-y-2">
                {data.ai.summary.map((s, i) => {
                  const icon = i === 0 ? "📌" : i === 1 ? "💰" : i === 2 ? "⚠️" : "✅";
                  const inner = (
                    <>
                      <span className="text-base">{icon}</span>
                      <span className="flex-1">{s.text}</span>
                      {s.href && (
                        <span className="text-[11px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                      )}
                    </>
                  );
                  // Пункт со ссылкой открывает отфильтрованный реестр заказов
                  return s.href ? (
                    <Link
                      key={i}
                      href={s.href}
                      className="group flex items-center gap-2 text-sm p-2.5 rounded-xl bg-[var(--admin-bg)] hover:bg-primary/10 transition-colors"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div key={i} className="flex items-center gap-2 text-sm p-2.5 rounded-xl bg-[var(--admin-bg)]">
                      {inner}
                    </div>
                  );
                })}
              </div>
            )}

            {aiTab === "recs" && (
              <div className="space-y-2">
                {data.ai.recommendations.map((r, i) => (
                  <div key={i} className="p-3 rounded-xl border border-[var(--admin-border)]">
                    <div className="flex items-start gap-2">
                      <span className="text-base">{r.level === "high" ? "🔴" : r.level === "positive" ? "🟢" : r.level === "medium" ? "🟡" : "🔵"}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{r.title}</div>
                        <div className="text-[11px] text-[var(--admin-muted)] mt-0.5">{r.effect}</div>
                        <button className="mt-1.5 text-[11px] text-primary font-medium hover:underline">▶ {r.action}</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {aiTab === "warnings" && (
              <div className="space-y-2">
                {data.ai.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-danger/5 border border-danger/20 text-sm">
                    <span className="text-base">⚠️</span>
                    <div>
                      <div className="font-medium">{w.title}</div>
                      <div className="text-[11px] text-[var(--admin-muted)] mt-0.5">{w.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {aiTab === "forecast" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {data.ai.forecast.map((f) => (
                  <div key={f.label} className="p-3 rounded-xl bg-[var(--admin-bg)] text-center">
                    <div className="text-xs text-[var(--admin-muted)]">{f.label}</div>
                    <div className={`text-2xl font-bold mt-1 ${f.change >= 0 ? "text-success" : "text-danger"}`}>
                      {f.change >= 0 ? "+" : ""}
                      {f.change}%
                    </div>
                    <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">прогноз на следующий период</div>
                  </div>
                ))}
              </div>
            )}
            </WidgetFrame>
          )}

          {/* Продажи по категориям + направления (компактно) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="font-semibold text-sm mb-3">
                🍩 Продажи по категориям{" "}
                <span className="font-normal text-[var(--admin-muted)]">· за {data.periodLabel}</span>
              </h3>
              {data.salesByCategory.length ? (
                <DonutChart
                  data={data.salesByCategory.slice(0, 6).map((s, i) => ({
                    label: s.label,
                    value: s.revenue,
                    color: CHART_COLORS[i % CHART_COLORS.length],
                  }))}
                />
              ) : (
                <div className="text-sm text-[var(--admin-muted)]">Продаж за период нет</div>
              )}
            </div>
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
              <h3 className="font-semibold text-sm mb-3">
                📈 Популярные направления{" "}
                <span className="font-normal text-[var(--admin-muted)]">· за {data.periodLabel}</span>
              </h3>
              <div className="space-y-2">
                {data.popularDestinations.length ? (
                  data.popularDestinations.slice(0, 6).map((d, i) => (
                    <div key={d.name} className="text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--admin-muted)] truncate">
                          {flagEmoji(d.code)} {d.name}
                        </span>
                        <span className="font-semibold shrink-0">
                          {d.sales} {ruPlural(d.sales, "продажа", "продажи", "продаж")} · {fmtMoney(d.revenue)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-[var(--admin-bg)] rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(d.sales / Math.max(1, data.popularDestinations[0]?.sales ?? 1)) * 100}%`,
                            background: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-[var(--admin-muted)]">Продаж за период нет</div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Правая колонка: Уведомления · Сообщения · Календарь */}
        <div className="space-y-4">
          {/* Уведомления (Гл. 1.23) */}
          {isVisible("notifications") && (
            <WidgetFrame
              title="Уведомления"
              icon="🔔"
              widgetKey="notifications"
              starred={isStar("notifications")}
              onStar={() => toggleStar("notifications")}
              onHide={() => hideWidget("notifications")}
              onFullscreen={() => setFullscreen("notifications")}
              onExport={() => exportWidget("notifications")}
              onExportMore={(f) => exportWidgetMore("notifications", f)}
            >
              <div className="space-y-2">
                {data.notifications.slice(0, 6).map((n) => (
                  <Link
                    key={n.id}
                    href={n.href}
                    title="Перейти к объекту уведомления"
                    className="group flex items-start gap-2 text-sm p-2 rounded-xl border border-transparent hover:bg-[var(--admin-bg)] hover:border-primary/40 transition-colors"
                  >
                    <span className="text-base shrink-0">{NOTIFY_ICONS[n.type] ?? "🔔"}</span>
                    <div className="min-w-0">
                      <div className="truncate">{n.title}</div>
                      <div className="text-[11px] text-[var(--admin-muted)]">
                        {n.detail} · {fmtDateTime(n.at)}
                      </div>
                    </div>
                    <span className="text-[11px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0">→</span>
                  </Link>
                ))}
              </div>
            </WidgetFrame>
          )}

          {/* Сообщения (Гл. 1.24) */}
          {isVisible("messages") && (
            <WidgetFrame
              title="Сообщения"
              icon="💬"
              widgetKey="messages"
              starred={isStar("messages")}
              onStar={() => toggleStar("messages")}
              onHide={() => hideWidget("messages")}
              onFullscreen={() => setFullscreen("messages")}
              onExport={() => exportWidget("messages")}
              onExportMore={(f) => exportWidgetMore("messages", f)}
            >
              <div className="flex items-center gap-2 mb-3">
                {/* Счётчик обновляется в фоне раз в минуту без перезагрузки дашборда */}
                <span
                  className="text-[10px] text-[var(--admin-muted)]"
                  title="Счётчик и список обновляются автоматически раз в минуту"
                >
                  🔄 1 мин
                </span>
                {data.messages.unread > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-danger text-white text-[10px] font-bold">{data.messages.unread} новых</span>
                )}
              </div>
            <div className="space-y-2">
              {/* Вся строка сообщения кликабельна: открывает карточку заказа
                  в реестре сразу на вкладке «Коммуникации» (фокус по назначению). */}
              {data.messages.items.slice(0, 5).map((m) => (
                <Link
                  key={m.id}
                  href={m.href}
                  title={`Открыть заказ №${m.order.orderNumber} — Коммуникации`}
                  className="group block text-sm p-2 rounded-xl bg-[var(--admin-bg)] border border-transparent hover:border-primary/40 hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs">{m.senderName}</span>
                    <span className="text-[10px] text-[var(--admin-muted)]">{fmtDateTime(m.createdAt)}</span>
                  </div>
                  <div className="text-[var(--admin-muted)] truncate mt-0.5">{m.text}</div>
                  <div className="text-[10px] text-primary font-medium mt-1 group-hover:underline">
                    Заказ №{m.order.orderNumber} →
                  </div>
                </Link>
              ))}
              {!data.messages.items.length && <div className="text-sm text-[var(--admin-muted)]">Нет непрочитанных сообщений</div>}
              </div>
            </WidgetFrame>
          )}

          {/* Календарь (Гл. 1.25) */}
          {isVisible("calendar") && (
            <WidgetFrame
              title="Календарь"
              icon="📅"
              widgetKey="calendar"
              starred={isStar("calendar")}
              onStar={() => toggleStar("calendar")}
              onHide={() => hideWidget("calendar")}
              onFullscreen={() => setFullscreen("calendar")}
              onExport={() => exportWidget("calendar")}
              onExportMore={(f) => exportWidgetMore("calendar", f)}
            >
            {[
              { label: "Просроченные", items: data.calendar.overdue, color: "text-danger" },
              { label: "Сегодня", items: data.calendar.today, color: "text-primary" },
              { label: "Завтра", items: data.calendar.tomorrow, color: "text-[var(--admin-muted)]" },
              { label: "Предстоящие", items: data.calendar.upcoming, color: "text-[var(--admin-muted)]" },
            ].map((g) => (
              <div key={g.label} className="mb-2.5">
                <div className={`text-[11px] font-semibold uppercase tracking-wide ${g.color} mb-1`}>
                  {g.label} · {g.items.length}
                </div>
                {g.items.slice(0, 2).map((o) => (
                  <Link
                    key={o.id}
                    href={o.href}
                    title={`Открыть заказ №${o.orderNumber}`}
                    className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-[var(--admin-bg)] mb-1 hover:border-primary border border-transparent transition-colors group"
                  >
                    <span className="truncate">
                      №{o.orderNumber} · {o.user.firstName} {o.user.lastName ?? ""}
                    </span>
                    <span className="flex items-center gap-1 text-[var(--admin-muted)] shrink-0 ml-2">
                      {fmtDateTime(o.serviceDate)}
                      <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    </span>
                  </Link>
                ))}
                {!g.items.length && <div className="text-[11px] text-[var(--admin-muted)] px-1 pb-1">—</div>}
              </div>
            ))}
            </WidgetFrame>
          )}
        </div>
        </div>
        )}

      {/* ── Ряд: Продажи · Исполнение · Финансы (Гл. 1.11–1.13) ── */}
      {sectionVisible("sales-row") &&
        sectionWrap(
          "sales-row",
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {isVisible("sales") && (
              <WidgetFrame
                title="Продажи"
                icon="🧮"
                widgetKey="sales"
                subtitle={`за ${data.periodLabel}`}
                starred={isStar("sales")}
                onStar={() => toggleStar("sales")}
                onHide={() => hideWidget("sales")}
                onFullscreen={() => setFullscreen("sales")}
                onExport={() => exportWidget("sales")}
                onExportMore={(f) => exportWidgetMore("sales", f)}
              >
                <SalesWidget data={data} />
              </WidgetFrame>
            )}
            {isVisible("execution") && (
              <WidgetFrame
                title="Исполнение"
                icon="⚙️"
                widgetKey="execution"
                starred={isStar("execution")}
                onStar={() => toggleStar("execution")}
                onHide={() => hideWidget("execution")}
                onFullscreen={() => setFullscreen("execution")}
                onExport={() => exportWidget("execution")}
                onExportMore={(f) => exportWidgetMore("execution", f)}
              >
                <ExecutionWidget data={data} />
              </WidgetFrame>
            )}
            {isVisible("finance") && (
              <div className="lg:col-span-2">
                <WidgetFrame
                  title="Финансы"
                  icon="💰"
                  widgetKey="finance"
                  starred={isStar("finance")}
                  onStar={() => toggleStar("finance")}
                  onHide={() => hideWidget("finance")}
                  onFullscreen={() => setFullscreen("finance")}
                  onExport={() => exportWidget("finance")}
                  onExportMore={(f) => exportWidgetMore("finance", f)}
                >
                  <FinanceWidget data={data} />
                </WidgetFrame>
              </div>
            )}
          </div>
        )}

      {/* ── Ряд: Карта активности · Активность пользователей (Гл. 1.14, 1.16) ── */}
      {sectionVisible("map-row") &&
        sectionWrap(
          "map-row",
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {isVisible("map") && (
              <div className="lg:col-span-2">
                <WidgetFrame
                  title="Карта активности"
                  icon="🗺️"
                  widgetKey="map"
                  subtitle="продажи по странам"
                  starred={isStar("map")}
                  onStar={() => toggleStar("map")}
                  onHide={() => hideWidget("map")}
                  onFullscreen={() => setFullscreen("map")}
                  onExport={() => exportWidget("map")}
                  onExportMore={(f) => exportWidgetMore("map", f)}
                >
                  <ActivityMap destinations={data.popularDestinations} periodLabel={data.periodLabel} />
                </WidgetFrame>
              </div>
            )}
            {isVisible("activity") && (
              <WidgetFrame
                title="Активность пользователей"
                icon="👥"
                widgetKey="activity"
                starred={isStar("activity")}
                onStar={() => toggleStar("activity")}
                onHide={() => hideWidget("activity")}
                onFullscreen={() => setFullscreen("activity")}
                onExport={() => exportWidget("activity")}
                onExportMore={(f) => exportWidgetMore("activity", f)}
              >
                <ActivityWidget data={data} />
              </WidgetFrame>
            )}
          </div>
        )}

      {/* ── Decision Feed — Лента решений (Гл. 1.29) ── */}
      {isVisible("decision") &&
        sectionWrap(
          "decision",
          <WidgetFrame
            title="Decision Feed — Лента решений"
            icon="🧭"
            widgetKey="decision"
            subtitle="проблема → влияние → рекомендуемое действие"
            starred={isStar("decision")}
            onStar={() => toggleStar("decision")}
            onHide={() => hideWidget("decision")}
            onFullscreen={() => setFullscreen("decision")}
            onExport={() => exportWidget("decision")}
            onExportMore={(f) => exportWidgetMore("decision", f)}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {data.decisionFeed.map((d, i) => (
            <Link
              key={i}
              href={d.href}
              className={`p-3 rounded-xl border transition-colors ${
                d.level === "high"
                  ? "bg-danger/5 border-danger/25 hover:bg-danger/10"
                  : d.level === "medium"
                    ? "bg-[#f59e0b]/5 border-[#f59e0b]/25 hover:bg-[#f59e0b]/10"
                    : d.level === "info"
                      ? "bg-primary/5 border-primary/20 hover:bg-primary/10"
                      : "bg-[var(--admin-bg)] border-[var(--admin-border)] hover:border-primary/40"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-base">
                  {d.level === "high" ? "⚠️" : d.level === "medium" ? "🟡" : d.level === "info" ? "ℹ️" : "✅"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{d.title}</div>
                  <div className="text-[11px] text-[var(--admin-muted)] mt-1">
                    <span className="font-medium">Влияние:</span> {d.impact}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <span className="text-[11px] text-primary font-medium">▶ {d.action}</span>
                    <span className="text-[10px] text-[var(--admin-muted)] opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
          </div>
          </WidgetFrame>
        )}

      {/* ── Производительность подразделений (Гл. 1.26) ── */}
      {isVisible("departments") &&
        sectionWrap(
          "departments",
          <WidgetFrame
            title="Производительность подразделений"
            icon="🏢"
            starred={isStar("departments")}
            onStar={() => toggleStar("departments")}
            onHide={() => hideWidget("departments")}
            onFullscreen={() => setFullscreen("departments")}
            onExport={() => exportWidget("departments")}
            onExportMore={(f) => exportWidgetMore("departments", f)}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <DeptCard
          title="🏢 Продажи"
          rows={[
            ["Получено", String(data.departments.sales.received)],
            ["Передано", String(data.departments.sales.transferred)],
            ["Конверсия", `${data.departments.sales.conversion}%`],
          ]}
        />
        <DeptCard
          title="⚙️ Операционный отдел"
          rows={[
            ["Получено", String(data.departments.operations.received)],
            ["Подтверждено", String(data.departments.operations.confirmed)],
            ["Нет мест", String(data.departments.operations.noAvailability)],
            ["Цена изменилась", String(data.departments.operations.priceChanged)],
            ["Среднее время", data.departments.operations.avgTime],
          ]}
        />
        <DeptCard
          title="🎧 Поддержка"
          rows={[
            ["Обращений", String(data.departments.support.tickets)],
            ["Среднее время ответа", data.departments.support.avgResponse],
          ]}
        />
        <DeptCard
          title="🛡 Модерация"
          rows={[
            ["Новых услуг", String(data.departments.moderation.newServices)],
            ["Отклонено", String(data.departments.moderation.rejected)],
          ]}
        />
            </div>
          </WidgetFrame>
        )}

      {/* ── Последние события платформы (Гл. 1.27) ── */}
      {isVisible("events") &&
        sectionWrap(
          "events",
          <WidgetFrame title="Последние события платформы" icon="🕒" widgetKey="events" starred={isStar("events")} onStar={() => toggleStar("events")} onHide={() => hideWidget("events")} onFullscreen={() => setFullscreen("events")} onExport={() => exportWidget("events")} onExportMore={(f) => exportWidgetMore("events", f)}>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {data.events.slice(0, 9).map((e) => {
            const icon = e.type === "order" ? "📦" : e.type === "user" ? "👤" : "⭐";
            const body = (
              <>
                <span className="text-base shrink-0">{icon}</span>
                <div className="min-w-0">
                  <div className="truncate">{e.title}</div>
                  <div className="text-[11px] text-[var(--admin-muted)]">
                    {e.detail} · {fmtDateTime(e.at)}
                  </div>
                </div>
                {e.href && (
                  <span className="text-[11px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0">→</span>
                )}
              </>
            );
            // События-заказы ведут на карточку заказа, регистрации — в список пользователей,
            // отзывы — в модерацию контента.
            return e.href ? (
              <Link
                key={e.id}
                href={e.href}
                title="Перейти к объекту события"
                className="group flex items-start gap-2 text-sm p-2 rounded-xl bg-[var(--admin-bg)] border border-transparent hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                {body}
              </Link>
            ) : (
              <div key={e.id} className="flex items-start gap-2 text-sm p-2 rounded-xl bg-[var(--admin-bg)]">
                {body}
              </div>
            );
          })}
          </div>
          </WidgetFrame>
        )}

      {/* ── Панель здоровья платформы (Гл. 1.29) ── */}
      {isVisible("health") &&
        sectionWrap(
          "health",
          <WidgetFrame title="Панель здоровья платформы" icon="🖥" widgetKey="health" starred={isStar("health")} onStar={() => toggleStar("health")} onHide={() => hideWidget("health")} onFullscreen={() => setFullscreen("health")} onExport={() => exportWidget("health")} onExportMore={(f) => exportWidgetMore("health", f)}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
          {Object.entries(data.health).map(([key, v]) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  v.status === "green" ? "bg-success" : v.status === "yellow" ? "bg-[#f59e0b]" : v.status === "red" ? "bg-danger" : "bg-gray-400"
                }`}
              />
              <span className="text-[var(--admin-muted)] capitalize">{key}</span>
              <span className="ml-auto text-[var(--admin-text)]/70 text-xs">{v.latency ?? v.detail}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 pt-3 border-t border-[var(--admin-border)]">
          {[
            { label: "CPU", value: `${data.system.cpu}%` },
            { label: "Память", value: `${data.system.memory}%` },
            { label: "API", value: `${data.system.apiMs}ms` },
            { label: "БД", value: `${data.system.dbMs}ms` },
            { label: "Uptime", value: `${data.system.uptime} мин` },
          ].map((m) => (
            <div key={m.label} className="p-2 rounded-lg bg-[var(--admin-bg)] text-center">
              <div className="text-[10px] text-[var(--admin-muted)] uppercase tracking-wide">{m.label}</div>
              <div className="text-sm font-semibold mt-0.5">{m.value}</div>
            </div>
          ))}
          </div>
          </WidgetFrame>
        )}

      {/* ── Нижняя панель Dashboard (Гл. 1.28): версия, интеграции, документация ── */}
      {isVisible("footer") &&
        sectionWrap(
          "footer",
          <WidgetFrame title="Нижняя панель Dashboard" icon="ℹ️" widgetKey="footer" starred={isStar("footer")} onStar={() => toggleStar("footer")} onHide={() => hideWidget("footer")}>
            <div className="text-xs text-[var(--admin-muted)] flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="font-semibold text-[var(--admin-text)]">
          TravelHub {data.footer.version}
        </span>
        <span>Обновлено: {fmtDateTime(data.footer.lastUpdate)}</span>
        <span className="flex items-center gap-1">
          Очередь обработки:
          <span className={data.footer.queue > 0 ? "text-[#f59e0b] font-semibold" : "text-success font-semibold"}>
            {data.footer.queue}
          </span>
        </span>
        <span className="flex items-center gap-2">
          Интеграции:
          {Object.entries(data.footer.integrations).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1" title={v.detail}>
              <span
                className={`w-2 h-2 rounded-full ${
                  v.status === "green" ? "bg-success" : v.status === "yellow" ? "bg-[#f59e0b]" : "bg-gray-400"
                }`}
              />
              {k}
            </span>
          ))}
        </span>
        <span className="flex items-center gap-1.5 ml-auto">
          Документация:
          {data.footer.docs.map((d) => (
            <a
              key={d.href}
              href={d.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {d.label}
            </a>
          ))}
        </span>
        </div>
        </WidgetFrame>
        )}

      {/* ── Дубликаты виджетов (Гл. 1.34): копии, созданные через контекстное меню ── */}
      {duplicates.length > 0 && (
        <section className="rounded-2xl border border-dashed border-[var(--admin-border)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-[var(--admin-muted)]">📑 Дубликаты виджетов</h3>
            <button
              onClick={() => setDuplicates([])}
              className="text-[11px] text-[var(--admin-muted)] hover:text-danger transition-colors"
            >
              Убрать все
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {duplicates.map((key) => (
              <div key={key} className="relative">
                <button
                  onClick={() => setDuplicates((prev) => prev.filter((k) => k !== key))}
                  className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-danger text-white text-xs flex items-center justify-center shadow-lg hover:bg-danger-dark transition-colors"
                  title="Убрать дубликат"
                >
                  ✕
                </button>
                <WidgetFrame
                  title={WIDGET_META.find((w) => w.key === key)?.title ?? key}
                  icon={WIDGET_META.find((w) => w.key === key)?.icon ?? "📊"}
                >
                  {fullscreenView(key)}
                </WidgetFrame>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Настройка виджета (Гл. 1.33, 1.34): период, страна, тип услуги ── */}
      {configureFor && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfigureFor(null)}
        >
          <div
            className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--admin-border)] flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                ⚙️ Настройка виджета «{WIDGET_META.find((w) => w.key === configureFor)?.title ?? configureFor}»
              </h3>
              <button onClick={() => setConfigureFor(null)} className="text-[var(--admin-muted)] hover:text-[var(--admin-text)]">
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)] block mb-1.5">Период</label>
                <div className="ac-tabs flex-wrap">
                  {PERIOD_OPTIONS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setConfigurePeriod(p.key)}
                      className={`ac-tab ${configurePeriod === p.key ? "ac-tab-active" : ""}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)] block mb-1.5">Страна</label>
                <select
                  value={configureCountry}
                  onChange={(e) => setConfigureCountry(e.target.value)}
                  className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl px-3 h-10 text-sm outline-none focus:border-primary transition-colors"
                >
                  <option value="">🌍 Все страны</option>
                  {(data?.popularDestinations ?? []).map((d) => (
                    <option key={d.code ?? d.name} value={d.code ?? ""}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)] block mb-1.5">Тип услуги</label>
                <select
                  value={configureType}
                  onChange={(e) => setConfigureType(e.target.value)}
                  className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl px-3 h-10 text-sm outline-none focus:border-primary transition-colors"
                >
                  <option value="">🧩 Все услуги</option>
                  {(data?.salesByCategory ?? []).map((s) => (
                    <option key={s.type} value={s.type}>
                      {s.icon} {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-[var(--admin-border)] flex items-center justify-end gap-2">
              <button
                onClick={() => setConfigureFor(null)}
                className="px-3 h-9 rounded-xl text-xs text-[var(--admin-muted)] hover:bg-[var(--admin-bg)] transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  setWidgetCountry(configureCountry);
                  setWidgetType(configureType);
                  const nextPeriod = configurePeriod !== period ? configurePeriod : period;
                  if (configurePeriod !== period) setPeriod(configurePeriod);
                  load(nextPeriod, configureCountry, configureType);
                  logDashboardAction(
                    "configure",
                    `Виджет настроен: ${configurePeriod}, страна ${configureCountry || "все"}, услуга ${configureType || "все"}`
                  );
                  setConfigureFor(null);
                }}
                className="px-4 h-9 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-dark transition-colors"
              >
                Применить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Совместный доступ (Гл. 1.40): выбор получателей и ссылка-макет ── */}
      {shareOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShareOpen(false)}
        >
          <div
            className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--admin-border)] flex items-center justify-between">
              <h3 className="font-semibold text-sm">🔗 Поделиться дашбордом</h3>
              <button onClick={() => setShareOpen(false)} className="text-[var(--admin-muted)] hover:text-[var(--admin-text)]">
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-[var(--admin-muted)]">
                Выберите сотрудников — они получат ссылку на макет пространства «
                {WORKSPACES.find((w) => w.key === activeWs)?.label}». Получатель применит его одним кликом.
              </p>
              {/* Список получателей */}
              <div className="max-h-52 overflow-y-auto border border-[var(--admin-border)] rounded-xl divide-y divide-[var(--admin-border)]">
                {staff.length === 0 && (
                  <div className="text-xs text-[var(--admin-muted)] py-4 text-center">Загрузка сотрудников…</div>
                )}
                {staff.map((s) => {
                  const checked = shareSelected.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer transition-colors ${checked ? "bg-primary/5" : "hover:bg-[var(--admin-bg)]"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setShareSelected((prev) => (checked ? prev.filter((x) => x !== s.id) : [...prev, s.id]))
                        }
                        className="accent-[var(--primary)]"
                      />
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      <span className="text-[10px] text-[var(--admin-muted)] capitalize shrink-0">{s.role.toLowerCase()}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShareSelected(staff.map((s) => s.id))}
                  className="text-[11px] text-primary hover:underline"
                >
                  Выбрать всех
                </button>
                <button
                  onClick={() => setShareSelected([])}
                  className="text-[11px] text-[var(--admin-muted)] hover:text-[var(--admin-text)] hover:underline"
                >
                  Сбросить
                </button>
              </div>
              {shareLink && (
                <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3 space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Ссылка-макет для {shareSelected.length} {ruPlural(shareSelected.length, "получателя", "получателей", "получателей")}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={shareLink}
                      onFocus={(e) => e.target.select()}
                      className="flex-1 min-w-0 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-lg px-2.5 h-9 text-[10px] font-mono outline-none focus:border-primary transition-colors"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard
                          .writeText(shareLink)
                          .then(() => {
                            setShareCopied(true);
                            setTimeout(() => setShareCopied(false), 2000);
                          })
                          .catch(() => {
                            /* clipboard недоступен */
                          });
                      }}
                      className="px-3 h-9 rounded-lg bg-secondary text-white text-[11px] font-medium hover:opacity-90 transition-opacity shrink-0"
                    >
                      {shareCopied ? "✓ Скопировано" : "Копировать"}
                    </button>
                  </div>
                  <div className="text-[10px] text-[var(--admin-muted)]">
                    Ссылка содержит сам макет (не привязана к аккаунту) — её можно отправить в чат или по почте.
                  </div>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-[var(--admin-border)] flex items-center justify-end gap-2">
              <button
                onClick={() => setShareOpen(false)}
                className="px-3 h-9 rounded-xl text-xs text-[var(--admin-muted)] hover:bg-[var(--admin-bg)] transition-colors"
              >
                Закрыть
              </button>
              <button
                onClick={() => {
                  if (shareSelected.length === 0) return;
                  buildShareLink();
                  logDashboardAction("share", `Создана ссылка-макет для ${shareSelected.length} получателей`);
                }}
                disabled={shareSelected.length === 0}
                className="px-4 h-9 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-dark transition-colors disabled:opacity-40"
              >
                Создать ссылку
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Библиотека виджетов (Гл. 1.32) ── */}
      {libOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLibOpen(false)}
        >
          <div
            className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--admin-border)] flex items-center justify-between">
              <h3 className="font-semibold text-sm">🧩 Библиотека виджетов</h3>
              <button onClick={() => setLibOpen(false)} className="text-[var(--admin-muted)] hover:text-[var(--admin-text)]">
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4">
              {(["kpi", "work", "data", "system"] as const).map((group) => {
                const items = WIDGET_META.filter((w) => w.group === group);
                if (!items.length) return null;
                return (
                  <div key={group}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)] mb-2">
                      {WIDGET_GROUP_LABELS[group]}
                    </div>
                    <div className="space-y-1">
                      {items.map((w) => {
                        const visible = isVisible(w.key);
                        return (
                          <div key={w.key} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--admin-bg)]">
                            <span className="text-sm flex items-center gap-2 min-w-0">
                              <span className="shrink-0">{w.icon}</span>
                              <span className="truncate">{w.title}</span>
                            </span>
                            <button
                              onClick={() => (visible ? hideWidget(w.key) : showWidget(w.key))}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors shrink-0 ${
                                visible
                                  ? "bg-secondary text-white"
                                  : "bg-[var(--admin-card)] border border-[var(--admin-border)] text-[var(--admin-muted)] hover:border-primary"
                              }`}
                            >
                              {visible ? "Показан" : "Скрыт"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-[var(--admin-border)] text-[11px] text-[var(--admin-muted)]">
              Скрытые виджеты возвращаются отсюда. Порядок секций меняется перетаскиванием за значок ⠿.
            </div>
          </div>
        </div>
      )}

      {/* ── Импорт макета пространства (Гл. 1.44) ── */}
      {importOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            setImportOpen(false);
            setImportError(null);
          }}
        >
          <div
            className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--admin-border)] flex items-center justify-between">
              <h3 className="font-semibold text-sm">📥 Импорт макета пространства</h3>
              <button
                onClick={() => {
                  setImportOpen(false);
                  setImportError(null);
                }}
                className="text-[var(--admin-muted)] hover:text-[var(--admin-text)]"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-[var(--admin-muted)]">
                Вставьте JSON, скопированный в другом аккаунте через «Скопировать JSON для обмена», или выберите
                файл <code className="bg-[var(--admin-bg)] px-1 rounded">.json</code> из «Экспорт макета». Если в JSON
                указано пространство, макет применится к нему, иначе — к текущему
                («{WORKSPACES.find((w) => w.key === activeWs)?.label}»).
              </p>
              <textarea
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setImportError(null);
                }}
                placeholder={'{"version":1,"workspace":"sales","layout":{...}}'}
                rows={7}
                className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-primary transition-colors resize-y"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => importFileRef.current?.click()}
                  className="px-3 h-9 rounded-xl bg-[var(--admin-card)] border border-[var(--admin-border)] text-xs text-[var(--admin-muted)] hover:text-[var(--admin-text)] hover:border-primary transition-colors"
                >
                  📂 Выбрать файл…
                </button>
                <input
                  ref={importFileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImportFile(f);
                  }}
                />
                <span className="text-[11px] text-[var(--admin-muted)] truncate">
                  {importText ? `${importText.length} симв. — нажмите «Импортировать»` : ""}
                </span>
              </div>
              {importError && (
                <div className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">
                  ⚠️ {importError}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-[var(--admin-border)] flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setImportOpen(false);
                  setImportError(null);
                }}
                className="px-3 h-9 rounded-xl text-xs text-[var(--admin-muted)] hover:bg-[var(--admin-bg)] transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => applyImport(importText)}
                disabled={!importText.trim()}
                className="px-4 h-9 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-dark transition-colors disabled:opacity-40"
              >
                Импортировать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI-конструктор Dashboard (Гл. 1.42): сборка макета по текстовому запросу ── */}
      {aiBuilderOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setAiBuilderOpen(false)}
        >
          <div
            className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--admin-border)] flex items-center justify-between">
              <h3 className="font-semibold text-sm">✨ AI-конструктор Dashboard</h3>
              <button onClick={() => setAiBuilderOpen(false)} className="text-[var(--admin-muted)] hover:text-[var(--admin-text)]">
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-[var(--admin-muted)]">
                Опишите словами, что хотите видеть на дашборде — AI соберёт нужные виджеты, период и рабочее
                пространство. Без ручной настройки.
              </p>
              <textarea
                value={aiBuilderQuery}
                onChange={(e) => {
                  setAiBuilderQuery(e.target.value);
                  setAiCompose(null);
                  setAiApplyMsg(null);
                }}
                placeholder="Например: хочу видеть продажи туров в Турцию, доход по отелям и проблемные бронирования"
                rows={3}
                className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-sm outline-none focus:border-primary transition-colors resize-y"
              />
              {/* Примеры запросов */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Продажи и конверсия за неделю",
                  "Доход, комиссии и возвраты за месяц",
                  "Исполнение: документы, поставщики, просроченные",
                  "Прогноз продаж и риски по Турции",
                  "Активность пользователей и подразделения",
                ].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => {
                      setAiBuilderQuery(ex);
                      setAiCompose(null);
                      setAiApplyMsg(null);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[var(--admin-bg)] text-[11px] text-[var(--admin-muted)] hover:text-primary hover:border-primary border border-transparent transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAiCompose(aiComposeDashboard(aiBuilderQuery))}
                  disabled={!aiBuilderQuery.trim()}
                  className="px-4 h-9 rounded-xl bg-secondary text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  🤖 Собрать дашборд
                </button>
                {aiApplyMsg && (
                  <span className="text-[11px] font-medium text-success">✓ Макет применён к дашборду</span>
                )}
              </div>
              {/* Предпросмотр собранного макета */}
              {aiCompose && (
                <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3 space-y-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Собранный макет
                  </div>
                  <div className="text-xs text-[var(--admin-text)]">{aiCompose.summary}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {aiCompose.widgets.map((key) => {
                      const m = WIDGET_META.find((w) => w.key === key);
                      if (!m) return null;
                      return (
                        <span key={key} className="px-2 py-1 rounded-lg bg-[var(--admin-card)] border border-[var(--admin-border)] text-[11px]">
                          {m.icon} {m.title}
                        </span>
                      );
                    })}
                  </div>
                  {aiCompose.country && (
                    <div className="text-[11px] text-[var(--admin-muted)]">
                      🧭 Направление: {flagEmoji(aiCompose.country.code)} {aiCompose.country.name} — откроет карту и
                      заказы по стране
                    </div>
                  )}
                  <button
                    onClick={() => {
                      const res = aiCompose;
                      // Применяем собранный макет: показываем только выбранные виджеты
                      logDashboardAction("ai", `AI-конструктор: ${res.summary}`);
                      updateLayout((l) => ({
                        ...l,
                        hidden: WIDGET_META.map((w) => w.key).filter((k) => !res.widgets.includes(k)),
                        order: l.order,
                      }));
                      if (res.workspace && WORKSPACES.some((w) => w.key === res.workspace)) setActiveWs(res.workspace);
                      if (res.period) {
                        setPeriod(res.period);
                        load(res.period);
                      }
                      setAiApplyMsg("ok");
                      if (aiApplyTimerRef.current) clearTimeout(aiApplyTimerRef.current);
                      aiApplyTimerRef.current = setTimeout(() => setAiApplyMsg(null), 3000);
                    }}
                    className="w-full px-4 h-9 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-dark transition-colors"
                  >
                    ✨ Применить к дашборду
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── История изменений Dashboard (Гл. 1.41) ── */}
      {historyOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--admin-border)] flex items-center justify-between">
              <h3 className="font-semibold text-sm">🕘 История изменений Dashboard</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    clearDashboardHistory();
                    setHistoryItems([]);
                  }}
                  className="text-[11px] text-danger hover:underline"
                >
                  Очистить
                </button>
                <button onClick={() => setHistoryOpen(false)} className="text-[var(--admin-muted)] hover:text-[var(--admin-text)]">
                  ✕
                </button>
              </div>
            </div>
            <div className="p-3 overflow-y-auto max-h-[60vh] space-y-1">
              {historyItems.length === 0 && (
                <div className="text-sm text-[var(--admin-muted)] py-6 text-center">
                  Изменений пока не было. Скрывайте виджеты, переставляйте секции, применяйте AI-конструктор — всё
                  попадёт в этот журнал.
                </div>
              )}
              {historyItems.map((h, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[var(--admin-bg)]">
                  <span className="text-base shrink-0">
                    {h.action === "ai" ? "✨" : h.action === "template" ? "📐" : h.action === "import" ? "📥" : h.action === "reset" ? "🔄" : "🖱"}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px]">{h.label}</div>
                    <div className="text-[10px] text-[var(--admin-muted)]">{fmtDateTime(h.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Шаблоны Dashboard (Гл. 1.36): макеты для ролей ── */}
      {templatesOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setTemplatesOpen(false)}
        >
          <div
            className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--admin-border)] flex items-center justify-between">
              <h3 className="font-semibold text-sm">📐 Шаблоны Dashboard</h3>
              <button onClick={() => setTemplatesOpen(false)} className="text-[var(--admin-muted)] hover:text-[var(--admin-text)]">
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
              <p className="text-xs text-[var(--admin-muted)]">
                Шаблон — сохранённый макет для роли. Новый сотрудник этой роли получит его как стартовый автоматически
                (Гл. 1.36). Текущий макет пространства «{WORKSPACES.find((w) => w.key === activeWs)?.label}» можно
                сохранить как шаблон.
              </p>
              {/* Сохранение текущего макета */}
              <TemplateSaveRow onSave={saveTemplate} defaultRole="SALES_MANAGER" />
              {templatesMsg && (
                <div className={`text-xs rounded-xl px-3 py-2 ${templatesMsg.ok ? "text-success bg-success/5" : "text-danger bg-danger/5"}`}>
                  {templatesMsg.ok ? "✓ " : "⚠️ "}
                  {templatesMsg.text}
                </div>
              )}
              {/* Список шаблонов */}
              {templates.length === 0 && (
                <div className="text-xs text-[var(--admin-muted)] py-4 text-center border border-dashed border-[var(--admin-border)] rounded-xl">
                  Шаблонов пока нет — создайте первый из текущего макета
                </div>
              )}
              {templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[var(--admin-bg)]">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {t.name} <span className="text-[10px] text-[var(--admin-muted)] ml-1 capitalize">({t.role.toLowerCase()})</span>
                    </div>
                    <div className="text-[10px] text-[var(--admin-muted)]">Создан {fmtDateTime(t.createdAt)}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => applyTemplate(t)}
                      className="px-2.5 py-1 rounded-lg bg-primary text-white text-[11px] font-medium hover:bg-primary-dark transition-colors"
                    >
                      Применить
                    </button>
                    <button
                      onClick={() => deleteTemplate(t.id, t.name)}
                      className="px-2 py-1 rounded-lg text-[11px] text-danger hover:bg-danger/10 transition-colors"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Полноэкранный режим виджета (Гл. 1.38) ── */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-[var(--admin-bg)]/95 backdrop-blur-sm p-4 lg:p-8 overflow-y-auto"
          onClick={() => setFullscreen(null)}
        >
          <div className="max-w-6xl mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--admin-text)]">
                {(() => {
                  const m = WIDGET_META.find((w) => w.key === fullscreen);
                  return m ? `${m.icon} ${m.title}` : "Виджет";
                })()}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportWidget(fullscreen)}
                  className="px-3 h-9 rounded-xl bg-[var(--admin-card)] border border-[var(--admin-border)] text-sm text-[var(--admin-muted)] hover:text-[var(--admin-text)]"
                >
                  ⬇️ CSV
                </button>
                <button
                  onClick={() => setFullscreen(null)}
                  className="w-9 h-9 rounded-xl bg-[var(--admin-card)] border border-[var(--admin-border)] flex items-center justify-center text-[var(--admin-muted)] hover:text-[var(--admin-text)]"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-5">
              {fullscreenView(fullscreen)}
            </div>
          </div>
        </div>
      )}
    </div>
    </WidgetActionsContext.Provider>
  );
}

/* ─── Вспомогательные компоненты ─── */

function KpiValue({ kpi, format, spark }: { kpi: KpiCard; format: (v: number) => string; spark?: boolean }) {
  return (
    <div>
      <div className="text-2xl font-bold">{format(kpi.value)}</div>
      <div className="flex items-center gap-2 text-xs mt-1">
        <ChangeBadge change={kpi.change} />
      </div>
      {spark && kpi.spark && kpi.spark.length > 1 && kpi.spark.some((v) => v !== 0) && (
        <div className="mt-2 h-9">
          <Sparkline data={kpi.spark} color="#22c55e" />
        </div>
      )}
    </div>
  );
}

function ChangeBadge({ change, suffix = "" }: { change: number; suffix?: string }) {
  return (
    <span className={change >= 0 ? "text-success" : "text-danger"}>
      {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(change % 1 === 0 ? 0 : 1)}%
      {suffix && <span className="text-[var(--admin-muted)] font-normal"> {suffix}</span>}
    </span>
  );
}

function DeptCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
      <h3 className="font-semibold text-sm mb-3">{title}</h3>
      <div className="space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-[var(--admin-muted)]">{label}</span>
            <span className="font-semibold">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── KPI-карточки (Гл. 1.7): общий билдер для страницы и полноэкранного вида ───
 * Все карточки считаются за выбранный период (Dashboard API), поэтому заголовки
 * и переходы включают метку периода — цифры меняются вместе с переключателем. */
function buildKpiCards(kpi: DashData["kpi"], period: PeriodKey): { key: string; title: string; href: string; body: React.ReactNode }[] {
  const periodLabel = PERIOD_OPTIONS.find((p) => p.key === period)?.label ?? "период";
  return [
    {
      key: "ordersToday",
      title: `Заказы за ${periodLabel.toLowerCase()}`,
      href: `/admin/sales-execution?period=${period}`,
      body: <KpiValue kpi={kpi.ordersToday} format={(v) => fmtNumber(v)} />,
    },
    {
      key: "ordersInWork",
      title: "Заказы в работе",
      href: `/admin/sales-execution?period=${period}&status=DRAFT,CREATED,PROCESSING,AWAITING_CONFIRMATION,CONFIRMED,AWAITING_PAYMENT,PARTIALLY_PAID,PAID,DOCUMENT_PREP,READY,CHANGED,OVERDUE`,
      body: <KpiValue kpi={kpi.ordersInWork} format={(v) => fmtNumber(v)} />,
    },
    {
      key: "awaitingConfirmation",
      title: "Ожидают подтверждения",
      href: `/admin/sales-execution?period=${period}&status=AWAITING_CONFIRMATION`,
      body: <KpiValue kpi={kpi.awaitingConfirmation} format={(v) => fmtNumber(v)} />,
    },
    {
      key: "awaitingPayment",
      title: "Ожидают оплаты",
      href: `/admin/sales-execution?period=${period}&status=AWAITING_PAYMENT,PARTIALLY_PAID,OVERDUE`,
      body: <KpiValue kpi={kpi.awaitingPayment} format={(v) => fmtNumber(v)} />,
    },
    {
      key: "completed",
      title: "Выполненные",
      href: `/admin/sales-execution?period=${period}&status=COMPLETED`,
      body: <KpiValue kpi={kpi.completed} format={(v) => fmtNumber(v)} />,
    },
    {
      key: "revenueToday",
      title: `Доход за ${periodLabel.toLowerCase()}`,
      href: `/admin/sales-execution?period=${period}`,
      body: <KpiValue kpi={kpi.revenueToday} format={(v) => fmtMoney(v)} spark />,
    },
    {
      key: "revenueMonth",
      title: `Доход за ${periodLabel.toLowerCase()} (прогноз)`,
      href: `/admin/sales-execution?period=${period}`,
      body: (
        <div>
          <div className="text-2xl font-bold">{fmtMoney(kpi.revenueMonth.value)}</div>
          <div className="flex items-center gap-2 text-xs mt-1">
            <ChangeBadge change={kpi.revenueMonth.change} suffix=" к прошлому периоду" />
          </div>
          <div className="mt-2">
            <div className="h-1.5 bg-[var(--admin-bg)] rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, kpi.revenueMonth.planPct ?? 0)}%` }} />
            </div>
            <div className="text-[11px] text-[var(--admin-muted)] mt-1">
              {kpi.revenueMonth.planPct}% к прошлому периоду · прогноз {fmtMoney(kpi.revenueMonth.forecast ?? 0)}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "commission",
      title: "Комиссия платформы",
      href: "/admin/finance",
      body: (
        <div>
          <div className="text-2xl font-bold">{fmtMoney(kpi.commission.value)}</div>
          <div className="text-xs text-[var(--admin-muted)] mt-1">12% от дохода за период</div>
        </div>
      ),
    },
    {
      key: "newUsers",
      title: "Новые пользователи",
      href: "/admin/users",
      body: <KpiValue kpi={kpi.newUsers} format={(v) => fmtNumber(v)} spark />,
    },
    {
      key: "newPartners",
      title: "Новые партнеры",
      href: "/admin/crm",
      body: <KpiValue kpi={kpi.newPartners} format={(v) => fmtNumber(v)} spark />,
    },
  ];
}

/* ─── AI-центр (Гл. 1.22): контент вкладки по tab — для страницы и полноэкранного вида ─── */
function AiBlock({ data, tab }: { data: DashData; tab: "summary" | "recs" | "warnings" | "forecast" }) {
  if (tab === "summary") {
    return (
      <div className="space-y-2">
        {data.ai.summary.map((s, i) => {
          const icon = i === 0 ? "📌" : i === 1 ? "💰" : i === 2 ? "⚠️" : "✅";
          const inner = (
            <>
              <span className="text-base">{icon}</span>
              <span className="flex-1">{s.text}</span>
              {s.href && <span className="text-[11px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">→</span>}
            </>
          );
          return s.href ? (
            <Link key={i} href={s.href} className="group flex items-center gap-2 text-sm p-2.5 rounded-xl bg-[var(--admin-bg)] hover:bg-primary/10 transition-colors">
              {inner}
            </Link>
          ) : (
            <div key={i} className="flex items-center gap-2 text-sm p-2.5 rounded-xl bg-[var(--admin-bg)]">
              {inner}
            </div>
          );
        })}
      </div>
    );
  }
  if (tab === "recs") {
    return (
      <div className="space-y-2">
        {data.ai.recommendations.map((r, i) => (
          <div key={i} className="p-3 rounded-xl border border-[var(--admin-border)]">
            <div className="flex items-start gap-2">
              <span className="text-base">{r.level === "high" ? "🔴" : r.level === "positive" ? "🟢" : r.level === "medium" ? "🟡" : "🔵"}</span>
              <div className="min-w-0">
                <div className="text-sm font-medium">{r.title}</div>
                <div className="text-[11px] text-[var(--admin-muted)] mt-0.5">{r.effect}</div>
                <button className="mt-1.5 text-[11px] text-primary font-medium hover:underline">▶ {r.action}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (tab === "warnings") {
    return (
      <div className="space-y-2">
        {data.ai.warnings.map((w, i) => (
          <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-danger/5 border border-danger/20 text-sm">
            <span className="text-base">⚠️</span>
            <div>
              <div className="font-medium">{w.title}</div>
              <div className="text-[11px] text-[var(--admin-muted)] mt-0.5">{w.detail}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {data.ai.forecast.map((f) => (
        <div key={f.label} className="p-3 rounded-xl bg-[var(--admin-bg)] text-center">
          <div className="text-xs text-[var(--admin-muted)]">{f.label}</div>
          <div className={`text-2xl font-bold mt-1 ${f.change >= 0 ? "text-success" : "text-danger"}`}>
            {f.change >= 0 ? "+" : ""}
            {f.change}%
          </div>
          <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">прогноз на следующий период</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Блок «Продажи» (Гл. 1.11) ─── */
function SalesWidget({ data }: { data: DashData }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-[var(--admin-bg)]">
          <div className="text-[11px] text-[var(--admin-muted)] uppercase tracking-wide">Новые заявки</div>
          <div className="text-lg font-bold mt-0.5">{fmtNumber(data.sales.newRequests)}</div>
          <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">за {data.periodLabel}</div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--admin-bg)]">
          <div className="text-[11px] text-[var(--admin-muted)] uppercase tracking-wide">Оплаченные заказы</div>
          <div className="text-lg font-bold mt-0.5">{fmtNumber(data.sales.paidOrders)}</div>
          <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">{fmtMoney(data.sales.paidAmount)}</div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--admin-bg)]">
          <div className="text-[11px] text-[var(--admin-muted)] uppercase tracking-wide">Средний чек</div>
          <div className="text-lg font-bold mt-0.5">{fmtMoney(data.sales.avgCheck)}</div>
          <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">по оплаченным</div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--admin-bg)]">
          <div className="text-[11px] text-[var(--admin-muted)] uppercase tracking-wide">Конверсия</div>
          <div className="text-lg font-bold mt-0.5 text-success">{data.sales.conversion}%</div>
          <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">оплачено от заявок</div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--admin-border)]">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)] mb-1.5">Лучшие менеджеры</div>
        {data.sales.topManagers.length ? (
          <div className="space-y-1.5">
            {data.sales.topManagers.map((m, i) => (
              <div key={m.name} className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-lg bg-[var(--admin-bg)]">
                <span className="truncate min-w-0">
                  {["🥇", "🥈", "🥉"][i] ?? "🏅"} 👤 {m.name}
                </span>
                <span className="text-[var(--admin-muted)] shrink-0">
                  {m.orders} {ruPlural(m.orders, "заказ", "заказа", "заказов")} · {fmtMoney(m.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-[var(--admin-muted)]">Нет оплаченных заказов за период</div>
        )}
        <div className="mt-2">
          <Link href="/admin/sales-execution" className="text-[11px] text-primary font-medium hover:underline">
            Открыть реестр заказов →
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Блок «Исполнение» (Гл. 1.12) ─── */
function ExecutionWidget({ data }: { data: DashData }) {
  const rows: [string, string | number, string][] = [
    ["В обработке", data.execution.inProcessing, "PROCESSING,CONFIRMED"],
    ["Ждут ответа поставщика", data.execution.awaitingSupplier, "AWAITING_CONFIRMATION"],
    ["Готовы документы", data.execution.docsReady, "DOCUMENT_PREP,READY"],
    ["Просроченные", data.execution.overdue, "OVERDUE"],
    ["Среднее время обработки", data.execution.avgTime, ""],
  ];
  return (
    <div>
      <div className="space-y-1.5">
        {rows.map(([label, value, statuses]) =>
          statuses ? (
            <Link
              key={label}
              href={`/admin/sales-execution?status=${statuses}`}
              className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-[var(--admin-bg)] transition-colors group"
            >
              <span className="text-sm text-[var(--admin-muted)] group-hover:text-[var(--admin-text)]">{label}</span>
              <span className={`text-sm font-bold ${label === "Просроченные" ? "text-danger" : label === "Ждут ответа поставщика" ? "text-[#f59e0b]" : "text-[var(--admin-text)]"}`}>
                {value}
              </span>
            </Link>
          ) : (
            <div key={label} className="flex items-center justify-between px-2.5 py-2">
              <span className="text-sm text-[var(--admin-muted)]">{label}</span>
              <span className="text-sm font-bold text-[var(--admin-text)]">{value}</span>
            </div>
          )
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--admin-border)]">
        <Link href="/admin/sales-execution" className="text-[11px] text-primary font-medium hover:underline">
          Открыть реестр заказов →
        </Link>
      </div>
    </div>
  );
}

/* ─── Блок «Финансы» (Гл. 1.13) ─── */
function FinanceWidget({ data }: { data: DashData }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <div className="p-3 rounded-xl bg-[var(--admin-bg)]">
        <div className="text-[11px] text-[var(--admin-muted)] uppercase tracking-wide">Доход месяца</div>
        <div className="text-lg font-bold mt-0.5">{fmtMoney(data.finance.revenueMonth)}</div>
        <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">комиссия {fmtMoney(data.finance.commission)}</div>
      </div>
      <div className="p-3 rounded-xl bg-[var(--admin-bg)]">
        <div className="text-[11px] text-[var(--admin-muted)] uppercase tracking-wide">Выплаты партнёрам</div>
        <div className="text-lg font-bold mt-0.5">{fmtMoney(data.finance.partnerPayouts)}</div>
        <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">за месяц</div>
      </div>
      <div className="p-3 rounded-xl bg-[var(--admin-bg)]">
        <div className="text-[11px] text-[var(--admin-muted)] uppercase tracking-wide">Задолженности</div>
        <div className="text-lg font-bold mt-0.5 text-danger">{fmtMoney(data.finance.debtTotal)}</div>
        <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">остаток по частичным оплатам</div>
      </div>
      <div className="p-3 rounded-xl bg-[var(--admin-bg)]">
        <div className="text-[11px] text-[var(--admin-muted)] uppercase tracking-wide">Возвраты</div>
        <div className="text-lg font-bold mt-0.5">{fmtMoney(data.finance.refunds)}</div>
        <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">
          {data.finance.refundsCount} {ruPlural(data.finance.refundsCount, "возврат", "возврата", "возвратов")}
        </div>
      </div>
      <div className="p-3 rounded-xl bg-[var(--admin-bg)]">
        <div className="text-[11px] text-[var(--admin-muted)] uppercase tracking-wide">Ожидаемые поступления</div>
        <div className="text-lg font-bold mt-0.5 text-success">{fmtMoney(data.finance.expectedInflow)}</div>
        <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">
          {data.finance.awaitingCount} {ruPlural(data.finance.awaitingCount, "заказ ждёт", "заказа ждут", "заказов ждут")} оплаты
        </div>
      </div>
      <div className="p-3 rounded-xl bg-[var(--admin-bg)]">
        <div className="text-[11px] text-[var(--admin-muted)] uppercase tracking-wide">Доход сегодня</div>
        <div className="text-lg font-bold mt-0.5">{fmtMoney(data.finance.revenueToday)}</div>
        <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">поступления за сутки</div>
      </div>
    </div>
  );
}

/* ─── Активность пользователей (Гл. 1.16) ─── */
function ActivityWidget({ data }: { data: DashData }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="p-3 rounded-xl bg-[var(--admin-bg)] text-center">
          <div className="text-2xl font-bold text-success">{data.userActivity.online}</div>
          <div className="text-[11px] text-[var(--admin-muted)]">онлайн сейчас</div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--admin-bg)] text-center">
          <div className="text-2xl font-bold">{data.userActivity.managerActions}</div>
          <div className="text-[11px] text-[var(--admin-muted)]">действий менеджеров за месяц</div>
        </div>
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)] mb-1.5">Последние входы</div>
      <div className="space-y-1.5">
        {data.userActivity.lastLogins.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-lg bg-[var(--admin-bg)]">
            <span className="truncate min-w-0">
              <span className="font-medium">{u.name || u.email}</span>                  <span className="text-[var(--admin-muted)] ml-1.5 capitalize">
                    {u.role === "PARTNER"
                      ? "🤝"
                      : u.role === "ADMIN"
                        ? "🛡"
                        : u.role === "SALES_MANAGER"
                          ? "💼"
                          : u.role === "OPERATOR"
                            ? "⚙️"
                            : "👤"}
                  </span>
            </span>
            <span className="text-[10px] text-[var(--admin-muted)] shrink-0">{fmtDateTime(u.at)}</span>
          </div>
        ))}
        {!data.userActivity.lastLogins.length && <div className="text-xs text-[var(--admin-muted)]">Входов пока не было</div>}
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--admin-border)] flex items-center justify-between text-xs">
        <span className="text-[var(--admin-muted)]">
          {data.userActivity.inactive} {ruPlural(data.userActivity.inactive, "пользователь без", "пользователя без", "пользователей без")} активности 30+ дней
        </span>
        <Link href="/admin/users" className="text-primary font-medium hover:underline">
          Пользователи →
        </Link>
      </div>
    </div>
  );
}

/** Роли, для которых можно создавать шаблоны Dashboard (Гл. 1.36). */
const TEMPLATE_ROLES = ["ADMIN", "DIRECTOR", "SALES_MANAGER", "OPERATOR", "MODERATOR", "FINANCE", "MARKETER", "ANALYST"];

/** Строка сохранения текущего макета как шаблона для роли (Гл. 1.36). */
function TemplateSaveRow({ onSave, defaultRole }: { onSave: (name: string, role: string) => void; defaultRole: string }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState(defaultRole);
  return (
    <div className="rounded-xl border border-[var(--admin-border)] p-3 space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
        Сохранить текущий макет как шаблон
      </div>
      <div className="flex gap-2 flex-wrap">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название, напр. «Dashboard менеджера»"
          className="flex-1 min-w-[180px] bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl px-3 h-9 text-xs outline-none focus:border-primary transition-colors"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl px-2 h-9 text-xs outline-none focus:border-primary transition-colors"
        >
          {TEMPLATE_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            if (!name.trim()) return;
            onSave(name.trim(), role);
            setName("");
          }}
          disabled={!name.trim()}
          className="px-3 h-9 rounded-xl bg-secondary text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          💾 Сохранить
        </button>
      </div>
    </div>
  );
}
