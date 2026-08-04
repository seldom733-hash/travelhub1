"use client";

import { useEffect, useRef, useState } from "react";
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

/* ─── Экспорт виджета (Гл. 1.39): CSV из любых строк ─── */
export function exportCSV(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '"')}"`;
  const csv = rows.map((r) => r.map(esc).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
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

/* ─── Каркас виджета с контекстным меню (Гл. 1.34): ───
   Обновить · Развернуть · Экспорт CSV · Избранное · Скрыть */
export function WidgetFrame({
  title,
  icon,
  subtitle,
  menu = true,
  starred = false,
  onStar,
  onHide,
  onFullscreen,
  onExport,
  onRefresh,
  children,
}: {
  title: string;
  icon: string;
  subtitle?: string;
  menu?: boolean;
  starred?: boolean;
  onStar?: () => void;
  onHide?: () => void;
  onFullscreen?: () => void;
  onExport?: () => void;
  onRefresh?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
                  {onFullscreen && menuItem("Развернуть на весь экран", "⛶", onFullscreen)}
                  {onExport && menuItem("Экспорт CSV", "⬇️", onExport)}
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
              <Link href={`/admin/orders?country=${selected.code}`} className="text-[11px] text-primary font-medium hover:underline">
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
