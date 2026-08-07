"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fmtMoney, ruPlural } from "@/lib/admin-data";

/* Вспомогательные компоненты виджет-системы Dashboard (Гл. 1.14, 1.17, 1.30–1.39). */

/** Флаг страны из ISO-кода (TR → 🇹🇷). */
export function flagEmoji(code: string | null): string {
  return code
    ? code
        .toUpperCase()
        .split("")
        .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
        .join("")
    : "📍";
}

/* ─── Экспорт виджета (Гл. 1.39) ─── */

/** CSV из любых строк. */
export function exportCSV(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '"')}"`;
  const csv = rows.map((r) => r.map(esc).join(";")).join("\r\n");
  downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }), filename);
}

/** Excel (.xls) — HTML-таблица с объявлением mime Excel. */
export function exportExcel(filename: string, title: string, rows: (string | number)[][]) {
  const esc = (v: string | number) =>
    String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head><meta charset="utf-8"><title>${esc(title)}</title></head>
    <body>
      <h2>${esc(title)}</h2>
      <table border="1">
        ${rows
          .map(
            (r) =>
              "<tr>" + r.map((c) => `<td>${esc(c)}</td>`).join("") + "</tr>"
          )
          .join("\n")}
      </table>
    </body>
    </html>`;
  downloadBlob(new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8" }), filename);
}

/** PDF — HTML с CSS для печати, открывается в диалоге печати (сохранить как PDF). */
export function exportPDF(filename: string, title: string, rows: (string | number)[][]) {
  const esc = (v: string | number) =>
    String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `
    <!doctype html>
    <html><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; }
      h2 { margin: 0 0 8px; font-size: 18px; }
      .sub { color: #666; font-size: 11px; margin-bottom: 12px; }
      table { border-collapse: collapse; width: 100%; font-size: 11px; }
      th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; }
      th { background: #f1f5f9; font-weight: 600; }
      tr:nth-child(even) td { background: #fafafa; }
    </style></head>
    <body>
      <h2>${esc(title)}</h2>
      <div class="sub">TravelHub Admin · экспортировано ${new Date().toLocaleString("ru-RU")}</div>
      <table>
        <thead><tr>${rows[0]?.map((c) => `<th>${esc(c)}</th>`).join("") ?? ""}</tr></thead>
        <tbody>
          ${rows
            .slice(1)
            .map((r) => "<tr>" + r.map((c) => `<td>${esc(c)}</td>`).join("") + "</tr>")
            .join("\n")}
        </tbody>
      </table>
      <script>window.onload = () => setTimeout(() => window.print(), 250);</script>
    </body></html>`;
  const win = window.open("", "_blank", "width=900,height=650");
  if (!win) {
    // Блокировка всплывающих окон: скачиваем HTML-версию как fallback
    downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), filename.replace(/\.pdf$/i, ".html"));
    return;
  }
  win.document.write(html);
  win.document.close();
}

/** PNG — рисует простую таблицу на canvas и сохраняет изображение. */
export function exportPNG(filename: string, title: string, rows: (string | number)[][]) {
  const pad = 24;
  const colW = 220;
  const rowH = 26;
  const headerH = 64;
  const h = Math.max(4, rows.length) * rowH + headerH + pad * 2;
  const canvas = document.createElement("canvas");
  canvas.width = 4 * colW + pad * 2;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  // Фон
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Заголовок
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 16px Segoe UI, Arial";
  ctx.fillText(title, pad, pad + 16);
  ctx.fillStyle = "#64748b";
  ctx.font = "11px Segoe UI, Arial";
  ctx.fillText(new Date().toLocaleString("ru-RU"), pad, pad + 34);
  // Шапка таблицы
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(pad, headerH, colW * 4, rowH);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px Segoe UI, Arial";
  rows[0]?.forEach((c, i) => ctx.fillText(String(c).slice(0, 28), pad + 8 + i * colW, headerH + 17));
  // Строки
  ctx.font = "12px Segoe UI, Arial";
  rows.slice(1, 25).forEach((r, ri) => {
    const y = headerH + rowH + ri * rowH;
    if (ri % 2 === 1) {
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(pad, y, colW * 4, rowH);
    }
    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(pad + colW * 4, y);
    ctx.stroke();
    ctx.fillStyle = "#1e293b";
    r.slice(0, 4).forEach((c, ci) => ctx.fillText(String(c).slice(0, 28), pad + 8 + ci * colW, y + 17));
  });
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename);
  }, "image/png");
}

/** Скачивание Blob-файла (общий хелпер экспорта). */
export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/* ─── Период данных дашборда (Гл. 1.33) ─── */
export type PeriodKey = "today" | "week" | "month" | "quarter" | "year";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Сегодня" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "quarter", label: "Квартал" },
  { key: "year", label: "Год" },
];

/* ─── Настройка Dashboard (Гл. 1.17, 1.30–1.37): скрытые виджеты, порядок, размеры, избранное ─── */
export interface LayoutState {
  hidden: string[];
  order: string[];
  stars: string[];
  /** Размер секции: sm — узкая, md — средняя, lg — полная ширина (Гл. 1.31). */
  sizes: Record<string, "sm" | "md" | "lg">;
}

const LS_KEY = "travelhub:dashboard:layout:v1";

export function loadLayout(): LayoutState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<LayoutState>;
      return {
        hidden: p.hidden ?? [],
        order: p.order ?? [],
        stars: p.stars ?? [],
        sizes: p.sizes ?? {},
      };
    }
  } catch {
    /* повреждённый макет — сбрасываем */
  }
  return { hidden: [], order: [], stars: [], sizes: {} };
}

export function saveLayout(l: LayoutState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(l));
  } catch {
    /* localStorage недоступен — игнорируем */
  }
}

/* ─── Библиотека виджетов (Гл. 1.32) ─── */
export interface WidgetMeta {
  key: string;
  title: string;
  icon: string;
  group: "kpi" | "work" | "data" | "system";
}

export const WIDGET_META: WidgetMeta[] = [
  { key: "kpi", title: "KPI — ключевые показатели", icon: "📊", group: "kpi" },
  { key: "tasks", title: "Мои задачи", icon: "🎯", group: "work" },
  { key: "queues", title: "Очереди", icon: "📥", group: "work" },
  { key: "quick", title: "Быстрые действия", icon: "⚡", group: "work" },
  { key: "ai", title: "AI Центр", icon: "🤖", group: "kpi" },
  { key: "notifications", title: "Уведомления", icon: "🔔", group: "work" },
  { key: "messages", title: "Сообщения", icon: "💬", group: "work" },
  { key: "calendar", title: "Календарь", icon: "📅", group: "work" },
  { key: "sales", title: "Продажи", icon: "🧮", group: "data" },
  { key: "execution", title: "Исполнение", icon: "⚙️", group: "data" },
  { key: "finance", title: "Финансы", icon: "💰", group: "data" },
  { key: "map", title: "Карта активности", icon: "🗺️", group: "data" },
  { key: "activity", title: "Активность пользователей", icon: "👥", group: "data" },
  { key: "decision", title: "Decision Feed", icon: "🧭", group: "data" },
  { key: "departments", title: "Подразделения", icon: "🏢", group: "data" },
  { key: "events", title: "Последние события", icon: "🕒", group: "data" },
  { key: "health", title: "Панель здоровья", icon: "🖥", group: "system" },
  { key: "footer", title: "Нижняя панель", icon: "ℹ️", group: "system" },
];

export const WIDGET_GROUP_LABELS: Record<WidgetMeta["group"], string> = {
  kpi: "KPI",
  work: "Рабочая область",
  data: "Данные",
  system: "Система",
};

/* ─── Рабочие пространства (Гл. 1.44): несколько макетов Dashboard ───
   У каждого пространства свой набор виджетов, порядок секций и настройки. */
export interface WorkspaceDef {
  key: string;
  label: string;
  icon: string;
  description: string;
  /** Виджеты, видимые по умолчанию (остальные скрыты). */
  widgets: string[];
  /** Порядок верхнеуровневых секций по умолчанию. */
  sections: string[];
}

const ALL_WIDGETS = WIDGET_META.map((w) => w.key);

export const WORKSPACES: WorkspaceDef[] = [
  {
    key: "main",
    label: "Главный",
    icon: "🏠",
    description: "Общая сводка по платформе: все виджеты и разделы",
    widgets: ALL_WIDGETS,
    sections: ["kpi", "workarea", "sales-row", "map-row", "decision", "departments", "events", "health", "footer"],
  },
  {
    key: "sales",
    label: "Продажи",
    icon: "🧮",
    description: "Заявки, конверсия, менеджеры, направления",
    widgets: ["kpi", "sales", "queues", "tasks", "notifications", "messages", "map", "departments", "events"],
    sections: ["kpi", "sales-row", "workarea", "map-row", "departments", "events"],
  },
  {
    key: "execution",
    label: "Исполнение",
    icon: "⚙️",
    description: "Очередь, подтверждения, документы, календарь",
    widgets: ["execution", "queues", "tasks", "calendar", "messages", "notifications", "decision", "health"],
    sections: ["workarea", "sales-row", "decision", "health", "events"],
  },
  {
    key: "finance",
    label: "Финансы",
    icon: "💰",
    description: "Платежи, комиссии, выплаты, возвраты",
    widgets: ["finance", "kpi", "sales", "activity", "decision", "events", "footer"],
    sections: ["kpi", "sales-row", "map-row", "decision", "events", "footer"],
  },
  {
    key: "marketing",
    label: "Маркетинг",
    icon: "📢",
    description: "Направления, спрос, конверсия, активность",
    widgets: ["kpi", "sales", "map", "ai", "notifications", "events", "activity"],
    sections: ["kpi", "sales-row", "workarea", "map-row", "events"],
  },
  {
    key: "ai",
    label: "AI",
    icon: "🤖",
    description: "Прогнозы, риски, рекомендации, аномалии",
    widgets: ["ai", "kpi", "decision", "sales", "map", "events", "health"],
    sections: ["kpi", "workarea", "sales-row", "map-row", "decision", "events", "health"],
  },
];

export const LS_WORKSPACES_KEY = "travelhub:dashboard:workspaces:v1";

/** Макет по умолчанию для пространства: скрыто всё, что не в списке виджетов. */
export function defaultLayoutFor(workspaceKey: string): LayoutState {
  const ws = WORKSPACES.find((w) => w.key === workspaceKey);
  if (!ws) return { hidden: [], order: [], stars: [], sizes: {} };
  return {
    hidden: ALL_WIDGETS.filter((k) => !ws.widgets.includes(k)),
    order: ws.sections,
    stars: [],
    sizes: {},
  };
}

/**
 * Загружает состояние пространств из localStorage (с миграцией старого макета).
 * Если у пользователя ещё нет сохранённого выбора, стартовое пространство берётся
 * из настроек пользователя/роли (defaultActive, Гл. 1.2, 1.44).
 */
export function loadWorkspacesState(defaultActive = "main"): { active: string; layouts: Record<string, LayoutState> } {
  try {
    const raw = localStorage.getItem(LS_WORKSPACES_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { active?: string; layouts?: Record<string, LayoutState> };
      return { active: p.active ?? defaultActive, layouts: p.layouts ?? {} };
    }
  } catch {
    /* повреждённые данные — сбрасываем */
  }
  // Миграция: старый единый макет (Гл. 1.17) → в пространство «Главный»
  try {
    const old = localStorage.getItem(LS_KEY);
    if (old) {
      const p = JSON.parse(old) as Partial<LayoutState>;
      const migrated: LayoutState = {
        hidden: p.hidden ?? [],
        order: p.order ?? [],
        stars: p.stars ?? [],
        sizes: p.sizes ?? {},
      };
      localStorage.removeItem(LS_KEY);
      return { active: defaultActive, layouts: { main: migrated } };
    }
  } catch {
    /* игнорируем */
  }
  return { active: defaultActive, layouts: {} };
}

export function saveWorkspacesState(active: string, layouts: Record<string, LayoutState>) {
  try {
    localStorage.setItem(LS_WORKSPACES_KEY, JSON.stringify({ active, layouts }));
  } catch {
    /* localStorage недоступен — игнорируем */
  }
}

/* ─── История изменений Dashboard (Гл. 1.41) ───
   Все изменения макета записываются в журнал (localStorage): кто, когда и что
   изменил (скрыл виджет, переставил секцию, применил AI-макет и т.д.). */

export interface DashboardHistoryEntry {
  at: string;
  action: string;
  label: string;
}

const HISTORY_KEY = "travelhub:dashboard:history:v1";
const HISTORY_LIMIT = 60;

export function loadDashboardHistory(): DashboardHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p)) {
        return p.filter(
          (x): x is DashboardHistoryEntry =>
            Boolean(x) && typeof (x as DashboardHistoryEntry).at === "string" && typeof (x as DashboardHistoryEntry).label === "string"
        );
      }
    }
  } catch {
    /* повреждённый журнал — начинаем заново */
  }
  return [];
}

/** Добавляет запись в журнал изменений Dashboard (свежие сверху). */
export function logDashboardAction(action: string, label: string) {
  try {
    const prev = loadDashboardHistory();
    const next = [{ at: new Date().toISOString(), action, label }, ...prev].slice(0, HISTORY_LIMIT);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* localStorage недоступен — историю не ведём */
  }
}

export function clearDashboardHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* localStorage недоступен */
  }
}

/* ─── AI-конструктор Dashboard (Гл. 1.42) ───
   Пользователь описывает, что хочет видеть, — по ключевым словам система
   собирает макет: нужные виджеты, период и рабочее пространство. */

/** Результат сборки дашборда по текстовому запросу. */
export interface AiComposeResult {
  widgets: string[];
  period?: PeriodKey;
  workspace?: string;
  country?: { name: string; code: string };
  summary: string;
}

/** Ключевые слова → виджеты (Гл. 1.32 «Библиотека виджетов»). */
const AI_WIDGET_KEYWORDS: { widget: string; keywords: string[] }[] = [
  { widget: "sales", keywords: ["продаж", "заявк", "конверси", "менеджер", "воронк", "чек", "лучшие"] },
  { widget: "finance", keywords: ["финанс", "доход", "выручк", "комисси", "выплат", "задолжен", "возврат", "деньг", "платеж", "прибыл"] },
  { widget: "execution", keywords: ["исполнен", "документ", "поставщик", "подтвержден", "обработк", "срок"] },
  { widget: "tasks", keywords: ["задач", "просрочен", "дедлайн", "внимани", "напоминани"] },
  { widget: "queues", keywords: ["очеред", "queue"] },
  { widget: "kpi", keywords: ["kpi", "показател", "метрик", "сводк"] },
  { widget: "ai", keywords: ["прогноз", "риск", "рекомендац", "аномали", "ии", "ai", "инсайт", "тренд"] },
  { widget: "map", keywords: ["карт", "направлен", "стран", "географ", "локац"] },
  { widget: "notifications", keywords: ["уведомлен", "событи", "лент", "новост"] },
  { widget: "messages", keywords: ["сообщени", "чат", "переписк"] },
  { widget: "calendar", keywords: ["календар", "расписан", "встреч"] },
  { widget: "departments", keywords: ["подразделен", "отдел", "эффективност", "производител"] },
  { widget: "activity", keywords: ["активност", "пользовател", "онлайн", "вход"] },
  { widget: "decision", keywords: ["решен", "проблем", "влияние", "feed"] },
  { widget: "health", keywords: ["здоров", "статус сервис", "техническ", "интеграц"] },
];

/** Ключевые слова → период (Гл. 1.33). */
const AI_PERIOD_KEYWORDS: { period: PeriodKey; keywords: string[] }[] = [
  { period: "today", keywords: ["сегодня", "за день", "за сутки"] },
  { period: "week", keywords: ["недел", "7 дней", "за 7"] },
  { period: "quarter", keywords: ["квартал", "3 месяц"] },
  { period: "year", keywords: ["год", "годовой"] },
  { period: "month", keywords: ["месяц", "за 30", "текущ"] },
];

/** Ключевые слова → направление (страна) для подсказки-фильтра. */
const AI_COUNTRY_KEYWORDS: { name: string; code: string; keywords: string[] }[] = [
  { name: "Турция", code: "TR", keywords: ["турци", "антали", "стамбул"] },
  { name: "Египет", code: "EG", keywords: ["египет", "шарм", "хургад"] },
  { name: "Грузия", code: "GE", keywords: ["грузи", "тбилиси", "батум"] },
  { name: "Азербайджан", code: "AZ", keywords: ["азербайджан", "баку"] },
  { name: "Таиланд", code: "TH", keywords: ["таиланд", "паттай", "пхукет", "бангкок"] },
  { name: "ОАЭ", code: "AE", keywords: ["оаэ", "эмират", "дуба"] },
  { name: "Россия", code: "RU", keywords: ["росси", "сочи", "москв", "крым"] },
  { name: "Италия", code: "IT", keywords: ["итали", "рим", "милан"] },
  { name: "Испания", code: "ES", keywords: ["испани", "барселон", "мадрид"] },
  { name: "Греция", code: "GR", keywords: ["греци", "крит", "родос"] },
];

/**
 * Собирает макет Dashboard по текстовому запросу (Гл. 1.42).
 * Чистая функция без состояния — легко тестировать и переиспользовать.
 */
export function aiComposeDashboard(query: string): AiComposeResult {
  const q = query.toLowerCase();
  const widgets = new Set<string>();

  for (const { widget, keywords } of AI_WIDGET_KEYWORDS) {
    if (keywords.some((k) => q.includes(k))) widgets.add(widget);
  }

  let period: PeriodKey | undefined;
  for (const { period: p, keywords } of AI_PERIOD_KEYWORDS) {
    if (keywords.some((k) => q.includes(k))) {
      period = p;
      break;
    }
  }

  let country: { name: string; code: string } | undefined;
  for (const c of AI_COUNTRY_KEYWORDS) {
    if (c.keywords.some((k) => q.includes(k))) {
      country = c;
      break;
    }
  }

  // Рабочее пространство — по доминирующей теме запроса
  let workspace = "main";
  if (["finance", "sales", "execution", "ai", "marketing"].some((w) => widgets.has(w))) {
    if (widgets.has("finance") && !widgets.has("sales")) workspace = "finance";
    else if (widgets.has("execution") && !widgets.has("finance") && !widgets.has("sales")) workspace = "execution";
    else if (widgets.has("ai") && !widgets.has("sales") && !widgets.has("finance") && !widgets.has("execution")) workspace = "ai";
    else if (widgets.has("marketing") && !widgets.has("sales") && !widgets.has("finance")) workspace = "marketing";
    else if (widgets.has("sales") && !widgets.has("finance") && !widgets.has("execution")) workspace = "sales";
  }

  // Если ничего не распознано — главное пространство целиком
  const all = WIDGET_META.map((w) => w.key);
  const selected = widgets.size ? all.filter((k) => widgets.has(k)) : all;

  const parts: string[] = [];
  parts.push(`Показано ${selected.length} ${ruPlural(selected.length, "виджет", "виджета", "виджетов")}`);
  if (period) parts.push(`период «${PERIOD_OPTIONS.find((p) => p.key === period)?.label.toLowerCase()}»`);
  if (country) parts.push(`направление ${country.name}`);
  if (workspace !== "main") parts.push(`пространство «${WORKSPACES.find((w) => w.key === workspace)?.label}»`);

  return { widgets: selected, period, workspace, country, summary: parts.join(" · ") };
}

/* ─── Экспорт/импорт макета пространства (Гл. 1.44): обмен настройками ─── */
const WS_EXPORT_VERSION = 1;

/** Структура экспортируемого JSON макета пространства. */
export interface WorkspaceExport {
  app: "travelhub-admin";
  version: number;
  workspace: string;
  label?: string;
  exportedAt: string;
  layout: LayoutState;
}

/** Сериализует макет активного пространства в читаемый JSON (с метаданными). */
export function serializeWorkspace(activeKey: string, layouts: Record<string, LayoutState>): string {
  const ws = WORKSPACES.find((w) => w.key === activeKey);
  const payload: WorkspaceExport = {
    app: "travelhub-admin",
    version: WS_EXPORT_VERSION,
    workspace: activeKey,
    label: ws?.label,
    exportedAt: new Date().toISOString(),
    layout: layouts[activeKey] ?? defaultLayoutFor(activeKey),
  };
  return JSON.stringify(payload, null, 2);
}

/** Скачивает макет пространства в JSON-файл (BOM для корректного открытия в Excel/Блокноте). */
export function exportWorkspaceJSON(activeKey: string, layouts: Record<string, LayoutState>) {
  const ws = WORKSPACES.find((w) => w.key === activeKey);
  const blob = new Blob(["\uFEFF" + serializeWorkspace(activeKey, layouts)], {
    type: "application/json;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `workspace-${activeKey}${ws ? `-${ws.label.toLowerCase()}` : ""}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/** Копирует JSON макета в буфер обмена — для обмена через чат/почту между аккаунтами. */
export async function copyWorkspaceJSON(activeKey: string, layouts: Record<string, LayoutState>): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(serializeWorkspace(activeKey, layouts));
    return true;
  } catch {
    return false;
  }
}

/**
 * Разбирает и валидирует JSON макета пространства.
 * Принимает полный экспорт (WorkspaceExport) либо «голый» LayoutState.
 * Бросает Error с понятным сообщением при повреждённом JSON/неверной структуре.
 */
export function parseWorkspaceJSON(raw: string): { layout: LayoutState; workspace?: string } {
  // Убираем возможный BOM (экспорт добавляет его для совместимости)
  let data: unknown;
  try {
    data = JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("Не удалось прочитать JSON: файл повреждён или это не JSON.");
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("Ожидается объект с настройками макета.");
  }
  const record = data as Record<string, unknown>;
  // Полный экспорт содержит layout: {...}; «голый» макет — сам объект.
  // Если поле layout присутствует, но это не объект — это повреждённый экспорт.
  let source: Record<string, unknown>;
  if (record.layout !== undefined) {
    if (typeof record.layout !== "object" || record.layout === null || Array.isArray(record.layout)) {
      throw new Error("Поле «layout» должно быть объектом с настройками макета.");
    }
    source = record.layout as Record<string, unknown>;
  } else {
    source = record;
  }
  const widgetKeys = new Set(WIDGET_META.map((w) => w.key));
  const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  // Отбрасываем неизвестные виджеты — будущие/чужие версии не ломают макет
  const hidden = strArr(source.hidden).filter((k) => widgetKeys.has(k));
  const stars = strArr(source.stars).filter((k) => widgetKeys.has(k));
  const order = strArr(source.order);
  const sizes: Record<string, "sm" | "md" | "lg"> = {};
  if (source.sizes && typeof source.sizes === "object" && !Array.isArray(source.sizes)) {
    for (const [k, v] of Object.entries(source.sizes as Record<string, unknown>)) {
      if (v === "sm" || v === "md" || v === "lg") sizes[k] = v;
    }
  }
  const workspace =
    typeof record.workspace === "string" && WORKSPACES.some((w) => w.key === record.workspace) ? record.workspace : undefined;
  return { layout: { hidden, order, stars, sizes }, workspace };
}

/* ─── Контекст меню виджета (Гл. 1.34): ───
   Провайдер в CommandCenter даёт каждому WidgetFrame обработчики
   «Настроить» и «Дублировать» — без пробрасывания пропсов в 37 мест. */

export interface WidgetActions {
  onConfigure?: (key: string) => void;
  onDuplicate?: (key: string) => void;
}

export const WidgetActionsContext = createContext<WidgetActions>({});

/** Хук: действия виджета (настройка / дублирование), если провайдер задан. */
export function useWidgetActions(): WidgetActions {
  return useContext(WidgetActionsContext);
}

/* ─── Каркас виджета с контекстным меню (Гл. 1.34): ───
   Обновить · Настроить · Развернуть · Дублировать · Экспорт · Избранное · Скрыть */
export function WidgetFrame({
  title,
  icon,
  subtitle,
  menu = true,
  starred = false,
  widgetKey,
  onStar,
  onHide,
  onFullscreen,
  onExport,
  onExportMore,
  onRefresh,
  children,
}: {
  title: string;
  icon: string;
  subtitle?: string;
  menu?: boolean;
  starred?: boolean;
  /** Ключ виджета для «Настроить»/«Дублировать» (Гл. 1.34); без него
      определяется по title из WIDGET_META. */
  widgetKey?: string;
  onStar?: () => void;
  onHide?: () => void;
  onFullscreen?: () => void;
  onExport?: () => void;
  /** Дополнительные форматы экспорта (Гл. 1.39): xls | pdf | png */
  onExportMore?: (format: "xls" | "pdf" | "png") => void;
  onRefresh?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Действия из контекста (Гл. 1.34): «Настроить» и «Дублировать» доступны
  // каждому виджету, если CommandCenter предоставил обработчики.
  const actions = useWidgetActions();
  const resolvedKey = widgetKey ?? WIDGET_META.find((w) => w.title === title)?.key ?? title;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const menuItem = (label: string, icon: string, onClick: () => void, danger?: boolean) => (
    <button
      onClick={() => {
        setOpen(false);
        onClick();
      }}
      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-[var(--admin-bg)] transition-colors ${
        danger ? "text-danger" : "text-[var(--admin-text)]"
      }`}
    >
      <span className="w-4 text-center shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <div ref={ref} className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl relative">
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-0">
        <h3 className="font-semibold text-sm flex items-center gap-1.5 min-w-0">
          <span className="shrink-0">{icon}</span>
          <span className="truncate">{title}</span>
          {subtitle && (
            <span className="hidden md:inline font-normal text-[var(--admin-muted)] text-[11px] truncate">{subtitle}</span>
          )}
        </h3>
        <div className="flex items-center gap-0.5 shrink-0">
          {onStar && (
            <button
              onClick={onStar}
              title={starred ? "Снять из избранного" : "Закрепить в избранном"}
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${
                starred
                  ? "text-[#f59e0b]"
                  : "text-[var(--admin-muted)] hover:text-[#f59e0b] hover:bg-[var(--admin-bg)]"
              }`}
            >
              {starred ? "★" : "☆"}
            </button>
          )}
          {menu && (
            <div className="relative">
              <button
                onClick={() => setOpen((v) => !v)}
                title="Меню виджета"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--admin-muted)] hover:text-[var(--admin-text)] hover:bg-[var(--admin-bg)] transition-colors"
              >
                ⋮
              </button>
              {open && (
                <div className="absolute right-0 top-8 w-52 bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-xl shadow-xl z-40 py-1.5">
                  {onRefresh && menuItem("Обновить", "🔄", onRefresh)}
                  {actions.onConfigure && menuItem("Настроить", "⚙️", () => actions.onConfigure!(resolvedKey))}
                  {onFullscreen && menuItem("Развернуть на весь экран", "⛶", onFullscreen)}
                  {actions.onDuplicate && menuItem("Дублировать", "📑", () => actions.onDuplicate!(resolvedKey))}
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-[var(--admin-muted)] font-semibold">Экспорт (Гл. 1.39)</div>
                  {onExport && menuItem("CSV", "⬇️", onExport)}
                  {onExportMore && menuItem("Excel", "📊", () => onExportMore("xls"))}
                  {onExportMore && menuItem("PDF", "📄", () => onExportMore("pdf"))}
                  {onExportMore && menuItem("PNG", "🖼", () => onExportMore("png"))}
                  {onStar && menuItem(starred ? "Снять из избранного" : "В избранное", "⭐", onStar)}
                  {onHide && menuItem("Скрыть виджет", "🚫", onHide, true)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="p-4 pt-3">{children}</div>
    </div>
  );
}

/* ─── Карта активности (Гл. 1.14): точки направлений на проекции мира ───
   Координаты [lng, lat] для популярных направлений платформы. */
export const MAP_POINTS: Record<string, [number, number]> = {
  TR: [35.2, 39.0], AE: [54.4, 24.0], EG: [30.0, 26.8], TH: [100.5, 15.0],
  GE: [43.4, 42.3], AZ: [47.6, 40.4], RU: [40.0, 55.0], IT: [12.5, 42.8],
  ES: [-3.7, 40.4], FR: [2.2, 46.6], DE: [10.4, 51.2], GB: [-1.5, 52.5],
  GR: [23.7, 39.1], PT: [-8.2, 39.6], NL: [5.3, 52.1], CH: [8.2, 46.8],
  AT: [14.5, 47.5], CZ: [15.5, 49.8], PL: [19.1, 51.9], HU: [19.0, 47.2],
  HR: [15.2, 45.1], BG: [25.5, 42.7], ME: [19.3, 42.7], CY: [33.4, 35.2],
  KZ: [66.9, 48.0], UZ: [64.6, 41.4], SA: [45.0, 24.0], IL: [34.9, 31.0],
  JO: [36.2, 31.9], MA: [-7.1, 31.8], TN: [9.6, 33.9], US: [-98.5, 39.8],
  CA: [-106.0, 56.1], MX: [-102.6, 23.6], CU: [-79.5, 21.5], DO: [-70.0, 18.7],
  BR: [-51.9, -14.2], AR: [-63.6, -38.4], CL: [-71.5, -35.7], PE: [-75.0, -9.2],
  CO: [-74.0, 4.6], AU: [134.0, -25.3], NZ: [174.0, -41.3], ID: [113.9, -0.8],
  MY: [101.9, 4.2], SG: [103.8, 1.35], PH: [122.0, 12.9], VN: [108.3, 14.0],
  CN: [104.2, 35.9], JP: [138.0, 37.0], KR: [127.8, 36.5], IN: [78.9, 20.6],
  LK: [80.8, 7.9], MV: [73.5, 3.2], NP: [84.1, 28.4], UA: [31.2, 49.0],
  BY: [27.9, 53.9], AM: [45.0, 40.2], LV: [24.6, 56.9], LT: [23.9, 55.2],
  EE: [25.7, 58.6], PK: [69.3, 30.4], BD: [90.4, 23.7], QA: [51.2, 25.3],
  BH: [50.6, 26.0], KW: [47.8, 29.3], OM: [56.0, 21.5], IR: [53.7, 32.4],
};

export interface MapDest {
  name: string;
  code: string | null;
  revenue: number;
  sales: number;
}

export function ActivityMap({ destinations, periodLabel }: { destinations: MapDest[]; periodLabel: string }) {
  const [hover, setHover] = useState<{ name: string; code: string | null; sales: number; revenue: number; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<MapDest | null>(null);

  const W = 1000;
  const H = 500;
  const px = (lng: number) => ((lng + 180) / 360) * W;
  const py = (lat: number) => ((90 - lat) / 180) * H;
  const maxSales = Math.max(1, ...destinations.map((d) => d.sales));
  const totalRevenue = destinations.reduce((a, d) => a + d.revenue, 0);

  const points = destinations
    .map((d) => ({ d, c: d.code ? MAP_POINTS[d.code] : undefined }))
    .filter((p): p is { d: MapDest; c: [number, number] } => Boolean(p.c));

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-[var(--admin-border)] bg-gradient-to-b from-[#0b1a33] to-[#0a1428]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label="Карта активности">
          {Array.from({ length: 12 }).map((_, i) => {
            const x = (i / 12) * W;
            return <line key={`v${i}`} x1={x} y1={0} x2={x} y2={H} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />;
          })}
          {Array.from({ length: 6 }).map((_, i) => {
            const y = (i / 6) * H;
            return <line key={`h${i}`} x1={0} y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />;
          })}
          {points.map(({ d, c }) => {
            const x = px(c[0]);
            const y = py(c[1]);
            const r = 6 + (d.sales / maxSales) * 15;
            const active = selected?.code === d.code || hover?.code === d.code;
            return (
              <g
                key={d.code}
                className="cursor-pointer"
                onMouseEnter={() => setHover({ name: d.name, code: d.code, sales: d.sales, revenue: d.revenue, x, y })}
                onMouseLeave={() => setHover(null)}
                onClick={() => setSelected(active ? null : d)}
              >
                <circle cx={x} cy={y} r={r + 5} fill={active ? "rgba(249,115,22,0.35)" : "transparent"} />
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill="rgba(249,115,22,0.85)"
                  stroke={active ? "#fff" : "rgba(255,255,255,0.35)"}
                  strokeWidth={active ? 2 : 1}
                />
              </g>
            );
          })}
          {!points.length && (
            <text x={W / 2} y={H / 2} fill="rgba(255,255,255,0.45)" textAnchor="middle" fontSize="18">
              Нет продаж по направлениям за период
            </text>
          )}
        </svg>
        {hover && (
          <div
            className="absolute pointer-events-none z-10 -translate-x-1/2 -translate-y-full bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-lg shadow-xl px-3 py-2 text-xs"
            style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%` }}
          >
            <div className="font-semibold">
              {flagEmoji(hover.code)} {hover.name}
            </div>
            <div className="text-[var(--admin-muted)]">
              {hover.sales} {ruPlural(hover.sales, "продажа", "продажи", "продаж")} · {fmtMoney(hover.revenue)}
            </div>
          </div>
        )}
      </div>
      {selected ? (
        <div className="mt-3 p-3 rounded-xl bg-[var(--admin-bg)] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl shrink-0">{flagEmoji(selected.code)}</span>
            <div className="min-w-0">
              <div className="font-semibold text-sm">{selected.name}</div>
              <div className="text-[11px] text-[var(--admin-muted)]">
                {selected.sales} {ruPlural(selected.sales, "продажа", "продажи", "продаж")} · {fmtMoney(selected.revenue)} ·
                {totalRevenue ? ` ${Math.round((selected.revenue / totalRevenue) * 100)}% выручки за ${periodLabel}` : ""}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selected.code && (
              <Link href={`/admin/sales-execution?country=${selected.code}`} className="text-[11px] text-primary font-medium hover:underline">
                Открыть заказы →
              </Link>
            )}
            <button onClick={() => setSelected(null)} className="text-[11px] text-[var(--admin-muted)] hover:text-[var(--admin-text)]">
              ✕
            </button>
          </div>
        </div>
      ) : (
        destinations.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {destinations.slice(0, 8).map((d) => (
              <button
                key={d.code ?? d.name}
                onClick={() => setSelected(d)}
                className="px-2 py-1 rounded-lg bg-[var(--admin-bg)] text-xs hover:border-primary border border-transparent transition-colors"
              >
                {flagEmoji(d.code)} {d.name} · {d.sales}
              </button>
            ))}
            <span className="text-[10px] text-[var(--admin-muted)] self-center">— нажмите на точку или страну</span>
          </div>
        )
      )}
    </div>
  );
}
