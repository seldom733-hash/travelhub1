/**
 * Общие типы и хелперы Центра бизнес-аналитики (Гл. 2).
 *
 * Единая система фильтрации (2.4, 2.7): период, страна, город, услуга,
 * партнёр, менеджер, статус, валюта. Все модули аналитики используют один
 * набор фильтров и один формат KPI/серий (Принцип 2).
 */

import { periodRange, type PeriodKey } from "@/lib/admin-data";

export type AnalyticsSection =
  | "overview"
  | "sales"
  | "orders"
  | "bookings"
  | "finance"
  | "crm"
  | "partners"
  | "catalog"
  | "marketing";

export interface AnalyticsFilters {
  period: PeriodKey;
  from?: string;
  to?: string;
  country?: string;
  city?: string;
  type?: string;
  partnerId?: string;
  manager?: string;
  status?: string;
  currency?: string;
}

/** Карточка KPI (2.8): текущее значение, изменение к прошлому периоду, мини-график, прогноз. */
export interface KpiCard {
  key: string;
  title: string;
  value: number;
  /** Строка-подпись для денег/процентов (например, "$", "%"). */
  unit?: string;
  change?: number;
  spark?: number[];
  forecast?: number;
  /** Цветовой индикатор: positive / negative / medium / neutral. */
  tone?: "positive" | "negative" | "medium" | "neutral";
  detail?: string;
}

export interface SeriesData {
  labels: string[];
  values: number[];
}

export interface AiInsight {
  level: "positive" | "medium" | "high" | "info";
  title: string;
  detail: string;
}

/** Разбор общих фильтров из query string. */
export function parseAnalyticsFilters(searchParams: URLSearchParams): AnalyticsFilters {
  const period = (searchParams.get("period") || "month") as PeriodKey;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const country = searchParams.get("country") || undefined;
  const city = searchParams.get("city") || undefined;
  const type = searchParams.get("type") || undefined;
  const partnerId = searchParams.get("partnerId") || undefined;
  const manager = searchParams.get("manager") || undefined;
  const status = searchParams.get("status") || undefined;
  const currency = searchParams.get("currency") || undefined;
  return { period, from, to, country, city, type, partnerId, manager, status, currency };
}

/** Границы выбранного и предыдущего периода (для сравнения). */
export function analyticsRange(f: AnalyticsFilters) {
  return periodRange(f.period, f.from, f.to);
}

/** Детерминированная оценка ряда на основе реального ряда (для прогнозов/мин-графиков). */
export function estimateSeries(real: number[], factor = 1): number[] {
  return real.map((v) => Math.round(v * factor));
}

/** Доля (0..1) от суммы. */
export function share(value: number, total: number): number {
  return total > 0 ? value / total : 0;
}

/* ─── Единая схема ответа модуля (2.4, 2.5 «Единая логика страниц») ─── */

/** График: серия точек с режимом отображения. */
export interface SeriesBlock {
  key: string;
  title: string;
  icon: string;
  mode: "line" | "bar" | "area";
  data: SeriesData;
  color?: string;
}

/** Кольцевая диаграмма. */
export interface DonutBlock {
  key: string;
  title: string;
  icon: string;
  data: { label: string; value: number; color?: string }[];
}

/** Список с барами (рейтинги, воронка-список). */
export interface BarListBlock {
  key: string;
  title: string;
  icon: string;
  rows: { label: string; value: number; sub?: string; href?: string }[];
  maxValue?: number;
}

/** Таблица. */
export interface TableBlock {
  key: string;
  title: string;
  icon: string;
  /** align: "left" | "right" — выравнивание колонки; тип расширен строкой,
   *  чтобы литералы "right" в данных модулей не требовали as const. */
  columns: { key: string; label: string; align?: "left" | "right" | string }[];
  rows: Record<string, string | number>[];
}

/** Воронка (2.10.5, 2.11.5, 2.12.5). */
export interface FunnelBlock {
  key: string;
  title: string;
  steps: { label: string; value: number; detail?: string }[];
}

/** Индекс здоровья бизнеса (2.9.7). */
export interface HealthBlock {
  value: number; // 0..100
  label: string; // «Отличное состояние»
  factors: { label: string; effect: "up" | "down"; weight: number }[];
}

/** Пульс компании (2.9.11, 24 часа). */
export interface PulseItem {
  time: string;
  title: string;
  type: "sales" | "alert" | "partner" | "system" | "support";
}

/** Полный ответ одного модуля аналитики. */
export interface AnalyticsSectionData {
  section: AnalyticsSection;
  title: string;
  subtitle?: string;
  periodLabel: string;
  kpis: KpiCard[];
  health?: HealthBlock;
  pulse?: PulseItem[];
  funnels: FunnelBlock[];
  series: SeriesBlock[];
  donuts: DonutBlock[];
  barLists: BarListBlock[];
  tables: TableBlock[];
  ai: AiInsight[];
}
