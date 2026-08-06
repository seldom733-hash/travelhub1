"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Chip,
  EmptyState,
  FilterSelect,
  KpiCard,
  PageHeader,
  SearchInput,
  SectionCard,
  Skeleton,
  TableRow,
  TableShell,
  Tabs,
  Td,
} from "@/components/admin/ui";
import {
  SERVICE_HISTORY_ACTION_LABELS,
  SERVICE_STATUS_LABELS,
  SERVICE_STATUS_COLORS,
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_ICONS,
  fmtDate,
  fmtMoney,
  ruPlural,
  serviceAvailabilityLabel,
  servicePublicationLabel,
} from "@/lib/admin-data";
import { describeApiError } from "@/lib/api-error";

/** Разбор ошибки API с дефолтным текстом (см. lib/api-error.ts). */
async function apiError(res: Response, fallback: string): Promise<string> {
  return describeApiError(res, fallback);
}

/**
 * Catalog Center (Гл. 4): единый реестр услуг платформы.
 * KPI-панель (4.2), поиск и фильтрация (4.11), таблица каталога (4.3),
 * карточка услуги со вкладками (4.4–4.10), версии и жизненный цикл (4.12),
 * AI-панель (4.13).
 */

interface CatalogRow {
  id: string;
  code: string;
  type: string;
  title: string;
  slug: string;
  shortDesc: string | null;
  price: number;
  discountPrice: number | null;
  currency: string;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  rating: number;
  reviewCount: number;
  images: unknown[];
  duration: string | null;
  status: string;
  version: number;
  category: string | null;
  quotaTotal: number | null;
  quotaBooked: number | null;
  quotaReserved: number | null;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
  isActive: boolean;
  managerName: string | null;
  providerName: string | null;
  statusLabel: string;
  bookingsCount: number;
}

interface FiltersData {
  providers: { id: string; name: string }[];
  managers: { id: string; name: string }[];
  countries: string[];
  statuses: { value: string; label: string }[];
}

interface ServiceDetail {
  id: string;
  code: string;
  type: string;
  title: string;
  slug: string;
  description: string | null;
  shortDesc: string | null;
  price: number;
  currency: string;
  discountPrice: number | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  duration: string | null;
  maxGuests: number | null;
  languages: string | null;
  rating: number;
  reviewCount: number;
  images: unknown[];
  isFeatured: boolean;
  isHot: boolean;
  hotDiscount: number | null;
  status: string;
  statusLabel: string;
  version: number;
  category: string | null;
  tags: unknown[];
  manager: { id: string; name: string } | null;
  provider: { id: string; name: string } | null;
  salesStart: string | null;
  salesEnd: string | null;
  serviceStart: string | null;
  serviceEnd: string | null;
  quota: { total: number; booked: number; reserved: number; available: number };
  seo: { title: string | null; description: string | null; keywords: string | null };
  channels: unknown[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  bookingsCount: number;
  reviewsCount: number;
  related: { id: string; code: string; title: string; type: string; price: number; currency: string; status: string }[];
  relatedIds: string[];
  history: {
    id: string;
    version: number;
    action: string;
    from: string | null;
    to: string | null;
    fields: Record<string, unknown> | null;
    actorName: string;
    comment: string | null;
    createdAt: string;
  }[];
  ai: {
    readiness: number;
    missing: string[];
    recommendations: { level: "positive" | "medium" | "high" | "info"; title: string; detail: string }[];
    priceInsight: { level: "positive" | "medium" | "high" | "info"; title: string; detail: string } | null;
    forecast: { attractiveness: number; sellProbability: number; competitiveness: string };
    checks: { ok: boolean; label: string }[];
  };
}

const TYPE_OPTIONS = Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = Object.entries(SERVICE_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const SORT_OPTIONS = [
  { value: "updated", label: "По изменению ↓" },
  { value: "created", label: "По созданию ↓" },
  { value: "title", label: "По алфавиту А→Я" },
  { value: "price", label: "По цене ↑" },
  { value: "price_desc", label: "По цене ↓" },
  { value: "rating", label: "По рейтингу ↓" },
];

export default function CatalogCenter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Состояние фильтров (Гл. 4.11): инициализируется из URL ──
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [type, setType] = useState(() => searchParams.get("type") || "");
  const [status, setStatus] = useState(() => searchParams.get("status") || "");
  const [country, setCountry] = useState(() => searchParams.get("country") || "");
  const [providerId, setProviderId] = useState(() => searchParams.get("providerId") || "");
  const [managerId, setManagerId] = useState(() => searchParams.get("managerId") || "");
  const [sort, setSort] = useState(() => searchParams.get("sort") || "updated");
  const [page, setPage] = useState(() => Number(searchParams.get("page")) || 1);
  const [limit, setLimit] = useState(15);

  const [kpi, setKpi] = useState<Record<string, { value: number; detail?: string }> | null>(null);
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [filters, setFilters] = useState<FiltersData | null>(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [typeBreakdown, setTypeBreakdown] = useState<{ type: string; label: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── Карточка услуги ──
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ServiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  // Массовые операции (Гл. 4.3)
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [busy, setBusy] = useState(false);

  // Быстрый просмотр (Гл. 4.3): панель справа при выборе строки
  const [quickId, setQuickId] = useState<string | null>(null);
  const [quick, setQuick] = useState<CatalogRow | null>(null);

  // Контекстное меню строки
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Загрузка списка ──
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams();
      if (search) p.set("q", search);
      if (type) p.set("type", type);
      if (status) p.set("status", status);
      if (country) p.set("country", country);
      if (providerId) p.set("providerId", providerId);
      if (managerId) p.set("managerId", managerId);
      if (sort) p.set("sort", sort);
      p.set("page", String(page));
      p.set("limit", String(limit));
      const res = await fetch(`/api/admin/catalog?${p.toString()}`);
      if (!res.ok) throw new Error(await apiError(res, "Ошибка загрузки каталога"));
      const data = await res.json();
      setKpi(data.kpi);
      setRows(data.services);
      setFilters(data.filters);
      setTypeBreakdown(data.typeBreakdown);
      setPagination(data.pagination);
      // Обновляем быстрый просмотр, если выбранная строка есть в новом списке
      if (quickId) {
        const found = data.services.find((s: CatalogRow) => s.id === quickId);
        setQuick(found ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки каталога");
    } finally {
      setLoading(false);
    }
  }, [search, type, status, country, providerId, managerId, sort, page, limit, quickId]);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  // Синхронизация фильтров с URL (deep-link, Гл. 4.11)
  useEffect(() => {
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (type) p.set("type", type);
    if (status) p.set("status", status);
    if (country) p.set("country", country);
    if (providerId) p.set("providerId", providerId);
    if (managerId) p.set("managerId", managerId);
    if (sort && sort !== "updated") p.set("sort", sort);
    if (page > 1) p.set("page", String(page));
    router.replace(`/admin/catalog${p.toString() ? `?${p.toString()}` : ""}`, { scroll: false });
  }, [search, type, status, country, providerId, managerId, sort, page, router]);

  // Поиск (Гл. 4.11): применяется сразу, инкрементально без перезагрузки
  const onSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  // Экспорт отфильтрованного каталога в CSV (Гл. 4.3): выгружаются все услуги
  // по текущим фильтрам (не только видимая страница).
  const exportCsv = async () => {
    setBusy(true);
    try {
      const p = new URLSearchParams({ sort: "updated", page: "1", limit: "5000" });
      if (search) p.set("q", search);
      if (type) p.set("type", type);
      if (status) p.set("status", status);
      if (country) p.set("country", country);
      if (providerId) p.set("providerId", providerId);
      if (managerId) p.set("managerId", managerId);
      const res = await fetch(`/api/admin/catalog?${p.toString()}`);
      if (!res.ok) throw new Error(await apiError(res, "Ошибка экспорта каталога"));
      const data = await res.json();
      const header = ["Код", "Тип", "Наименование", "Категория", "Страна", "Город", "Стоимость", "Валюта", "Со скидкой", "Статус", "Версия", "Поставщик", "Ответственный", "Рейтинг", "Продажи", "Создана", "Обновлена"];
      const body = (data.services as CatalogRow[]).map((r) => [
        r.code, r.type, r.title, r.category ?? "", r.country ?? "", r.city ?? "",
        String(r.price), r.currency, r.discountPrice != null ? String(r.discountPrice) : "",
        r.statusLabel, String(r.version), r.providerName ?? "", r.managerName ?? "",
        r.rating.toFixed(1), String(r.bookingsCount),
        new Date(r.createdAt).toLocaleDateString("ru-RU"), new Date(r.updatedAt).toLocaleDateString("ru-RU"),
      ]);
      const csv = [header, ...body]
        .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
        .join("\r\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `catalog-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка экспорта каталога");
    } finally {
      setBusy(false);
    }
  };

  const applyFilter = (setter: (v: string) => void, v: string) => {
    setter(v);
    setPage(1);
  };

  const resetFilters = () => {
    setSearch("");
    setType("");
    setStatus("");
    setCountry("");
    setProviderId("");
    setManagerId("");
    setPage(1);
  };

  const hasFilters = search || type || status || country || providerId || managerId;

  // Клик по KPI-карточке (Гл. 4.2): применяет фильтр
  const onKpiClick = (key: string) => {
    const map: Record<string, string> = {
      published: "PUBLISHED",
      drafts: "DRAFT",
      review: "REVIEW",
      ready: "READY",
      suspended: "SUSPENDED",
      archived: "ARCHIVED",
    };
    const s = map[key];
    if (s) {
      setStatus((cur) => (cur === s ? "" : s));
      setPage(1);
    }
  };

  // ── Массовые операции (Гл. 4.3) ──
  const runBulk = async () => {
    if (!selected.length || !bulkAction) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/catalog/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected, action: bulkAction }),
      });
      if (!res.ok) throw new Error(await apiError(res, "Ошибка массовой операции"));
      setBulkAction("");
      setSelected([]);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка массовой операции");
    } finally {
      setBusy(false);
    }
  };

  // ── Загрузка карточки ──
  const openDetail = useCallback(async (id: string) => {
    setOpenId(id);
    setDetail(null);
    setDetailLoading(true);
    setDetailError("");
    try {
      const res = await fetch(`/api/admin/catalog/${id}`);
      if (!res.ok) throw new Error(await apiError(res, "Ошибка загрузки карточки"));
      const data = await res.json();
      setDetail(data.service);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Ошибка загрузки карточки");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Закрытие контекстного меню по клику вне
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Глубокие ссылки: ?open=<id> открывает карточку (из контекстного меню «Редактировать»)
  const openParam = searchParams.get("open");
  useEffect(() => {
    if (openParam && openParam !== "new") {
      const t = setTimeout(() => openDetail(openParam), 0);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openParam]);

  const activeFilterCount = [search, type, status, country, providerId, managerId].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="📚 Каталог услуг"
        subtitle="Единый источник данных о продуктах платформы (Гл. 4): создание, редактирование, публикация и сопровождение услуг"
        actions={
          <>
            <Button variant="secondary" disabled={busy} onClick={exportCsv}>
              📥 Экспорт CSV
            </Button>
            <Button onClick={() => router.push("/admin/catalog?open=new")}>➕ Создать услугу</Button>
          </>
        }
      />

      {/* KPI-панель (Гл. 4.2) */}
      {kpi ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-9 gap-3">
          <KpiCard icon="🗂" title="Всего услуг" value={kpi.total.value} detail={kpi.total.detail} color="#0f172a" />
          <KpiCard icon="✅" title="Опубликованы" value={kpi.published.value} detail={kpi.published.detail} color="#22c55e" isActive={status === "PUBLISHED"} onClick={() => onKpiClick("published")} />
          <KpiCard icon="📝" title="Черновики" value={kpi.drafts.value} detail={kpi.drafts.detail} color="#94a3b8" isActive={status === "DRAFT"} onClick={() => onKpiClick("drafts")} />
          <KpiCard icon="🧾" title="На согласовании" value={kpi.review.value} detail={kpi.review.detail} color="#f59e0b" isActive={status === "REVIEW"} onClick={() => onKpiClick("review")} />
          <KpiCard icon="🚀" title="К публикации" value={kpi.ready.value} detail={kpi.ready.detail} color="#8b5cf6" isActive={status === "READY"} onClick={() => onKpiClick("ready")} />
          <KpiCard icon="⏸" title="Приостановлены" value={kpi.suspended.value} detail={kpi.suspended.detail} color="#f97316" isActive={status === "SUSPENDED"} onClick={() => onKpiClick("suspended")} />
          <KpiCard icon="📦" title="Архив" value={kpi.archived.value} detail={kpi.archived.detail} color="#6b7280" isActive={status === "ARCHIVED"} onClick={() => onKpiClick("archived")} />
          <KpiCard icon="🆕" title="Новые (7 дней)" value={kpi.new.value} detail={kpi.new.detail} color="#06b6d4" />
          <KpiCard icon="⚠️" title="Требуют обновления" value={kpi.needUpdate.value} detail={kpi.needUpdate.detail} color="#ef4444" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-9 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}

      {/* Поиск и фильтры (Гл. 4.11) */}
      <SectionCard
        title="Поиск и фильтрация"
        subtitle={`${activeFilterCount ? `${activeFilterCount} фильтра активно · ` : ""}${pagination.total ? `${ruPlural(pagination.total, "найдена услуга", "найдено услуги", "найдено услуг")}` : ""}`}
        actions={
          hasFilters ? (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              ✕ Сбросить фильтры
            </Button>
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <SearchInput value={search} onChange={onSearch} placeholder="Поиск: название, код, страна, город…" />
          <FilterSelect label="Тип услуги" value={type} onChange={(v) => applyFilter(setType, v)} options={TYPE_OPTIONS} placeholder="Все типы" />
          <FilterSelect label="Статус" value={status} onChange={(v) => applyFilter(setStatus, v)} options={STATUS_OPTIONS} placeholder="Все статусы" />
          <FilterSelect label="Страна" value={country} onChange={(v) => applyFilter(setCountry, v)} options={(filters?.countries ?? []).map((c) => ({ value: c, label: c }))} placeholder="Все страны" />
          <FilterSelect label="Поставщик" value={providerId} onChange={(v) => applyFilter(setProviderId, v)} options={(filters?.providers ?? []).map((p) => ({ value: p.id, label: p.name }))} placeholder="Все поставщики" />
          <FilterSelect label="Ответственный" value={managerId} onChange={(v) => applyFilter(setManagerId, v)} options={(filters?.managers ?? []).map((m) => ({ value: m.id, label: m.name }))} placeholder="Все менеджеры" />
          <FilterSelect label="Сортировка" value={sort} onChange={(v) => { setSort(v); setPage(1); }} options={SORT_OPTIONS} />
          <div className="flex items-end">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="ac-select w-full h-9"
              title="Записей на страницу"
            >
              <option value={10}>10 на страницу</option>
              <option value={15}>15 на страницу</option>
              <option value={25}>25 на страницу</option>
              <option value={50}>50 на страницу</option>
            </select>
          </div>
        </div>
        {/* Быстрые фильтры (Гл. 4.11): категории */}
        {typeBreakdown.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-3">
            <span className="text-[11px] text-[var(--admin-muted)]">Категории:</span>
            <Chip active={!type} onClick={() => applyFilter(setType, "")}>
              Все
            </Chip>
            {typeBreakdown.map((t) => (
              <Chip key={t.type} active={type === t.type} onClick={() => applyFilter(setType, type === t.type ? "" : t.type)}>
                {SERVICE_TYPE_ICONS[t.type] ?? "🧩"} {t.label} · {t.count}
              </Chip>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Массовые операции (Гл. 4.3) */}
      {selected.length > 0 && (
        <div className="ac-card px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            Выбрано <b>{selected.length}</b>{" "}
            {ruPlural(selected.length, "услуга", "услуги", "услуг")}
          </div>
          <div className="flex items-center gap-2">
            <FilterSelect
              value={bulkAction}
              onChange={setBulkAction}
              options={[
                { value: "publish", label: "Опубликовать" },
                { value: "unpublish", label: "Снять с публикации" },
                { value: "archive", label: "Архивировать" },
              ]}
              placeholder="Действие…"
            />
            <Button size="sm" disabled={!bulkAction || busy} onClick={runBulk}>
              {busy ? "Выполняется…" : "Применить"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              Отмена
            </Button>
          </div>
        </div>
      )}

      {/* Таблица каталога (Гл. 4.3) */}
      <SectionCard
        title="Реестр услуг"
        subtitle="Все карточки каталога: статус жизненного цикла, публикация, доступность"
        actions={<span className="text-xs text-[var(--admin-muted)]">{pagination.total} всего</span>}
      >
        {error && (
          <div className="mb-3 px-3 py-2 rounded-xl text-xs text-red-600" style={{ background: "rgba(239,68,68,.08)" }}>
            {error}
          </div>
        )}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon="🗂" text={hasFilters ? "По заданным условиям услуг не найдено. Измените параметры поиска или создайте новую услугу." : "Каталог пуст — создайте первую услугу"} />
        ) : (
          <>
            <TableShell
              minWidth="min-w-[1150px]"
              columns={[
                <span key="sel" className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    className="ac-check"
                    checked={selected.length === rows.length && rows.length > 0}
                    onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
                  />
                </span>,
                "Код",
                "Наименование",
                "Категория",
                "Направление",
                "Поставщик",
                "Стоимость",
                "Статус",
                "Публикация",
                "Доступность",
                "Изменено",
                "Ответственный",
                "",
              ]}
            >
              {rows.map((r) => {
                const avail = serviceAvailabilityLabel(r);
                const checked = selected.includes(r.id);
                return (
                  <TableRow
                    key={r.id}
                    className={checked ? "bg-[var(--admin-bg)]" : ""}
                    onClick={() => {
                      setQuickId(r.id);
                      setQuick(r);
                    }}
                  >
                    <Td>
                      <input
                        type="checkbox"
                        className="ac-check"
                        checked={checked}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => setSelected((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))}
                      />
                    </Td>
                    <Td>
                      <span className="font-mono text-[11px] text-[var(--admin-muted)]">{r.code}</span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="ac-kpi-icon" style={{ background: "#f973161a", color: "#f97316" }}>
                          {SERVICE_TYPE_ICONS[r.type] ?? "🧩"}
                        </span>
                        <div className="min-w-0">
                          <button
                            className="font-medium text-sm hover:text-primary truncate block max-w-[220px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetail(r.id);
                            }}
                          >
                            {r.title}
                          </button>
                          <span className="text-[10px] text-[var(--admin-muted)] block truncate max-w-[220px]">
                            {r.shortDesc ?? r.slug}
                          </span>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <span className="text-xs">{r.category ?? "—"}</span>
                    </Td>
                    <Td>
                      <span className="text-xs">{[r.country, r.city].filter(Boolean).join(" · ") || "—"}</span>
                    </Td>
                    <Td>
                      <span className="text-xs">{r.providerName ?? "—"}</span>
                    </Td>
                    <Td>
                      <div className="text-sm font-semibold">
                        {fmtMoney(r.discountPrice ?? r.price)}
                        {r.discountPrice && (
                          <span className="text-[10px] text-[var(--admin-muted)] font-normal line-through ml-1">
                            {fmtMoney(r.price)}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--admin-muted)]">⭐ {r.rating.toFixed(1)} · {r.bookingsCount} продаж</div>
                    </Td>
                    <Td>
                      <span className="ac-badge" style={{ background: `${SERVICE_STATUS_COLORS[r.status]}1a`, color: SERVICE_STATUS_COLORS[r.status] }}>
                        {r.statusLabel}
                      </span>
                    </Td>
                    <Td>
                      <span className="ac-badge" style={{ background: `${SERVICE_STATUS_COLORS[r.status]}0d`, color: SERVICE_STATUS_COLORS[r.status] }}>
                        {servicePublicationLabel(r.status)}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-xs" style={{ color: avail.color }}>
                        {avail.label}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-xs" title={new Date(r.updatedAt).toLocaleString("ru-RU")}>
                        {fmtDate(r.updatedAt)}
                      </span>
                      <div className="text-[10px] text-[var(--admin-muted)]">v{r.version}</div>
                    </Td>
                    <Td>
                      <span className="text-xs">{r.managerName ?? "—"}</span>
                    </Td>
                    <Td>
                      <div className="relative" ref={menuId === r.id ? menuRef : undefined}>
                        <button
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--admin-bg)] text-[var(--admin-muted)]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuId(menuId === r.id ? null : r.id);
                          }}
                        >
                          ⋮
                        </button>
                        {menuId === r.id && (
                          <div className="absolute right-0 top-9 z-30 w-56 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-card)] shadow-xl py-1 text-sm">
                            <MenuItem onClick={() => { openDetail(r.id); setMenuId(null); }}>📄 Открыть карточку</MenuItem>
                            <MenuItem onClick={() => { setQuickId(r.id); setQuick(r); setMenuId(null); }}>👁 Быстрый просмотр</MenuItem>
                            <MenuItem onClick={() => { router.push(`/admin/catalog?open=${r.id}`); setMenuId(null); }}>✏️ Редактировать</MenuItem>
                            {r.status !== "PUBLISHED" && (
                              <MenuItem onClick={() => { changeStatus(r, "publish"); setMenuId(null); }}>✅ Опубликовать</MenuItem>
                            )}
                            {r.status === "PUBLISHED" && (
                              <MenuItem onClick={() => { changeStatus(r, "unpublish"); setMenuId(null); }}>⏸ Снять с публикации</MenuItem>
                            )}
                            {r.status === "PUBLISHED" && (
                              <MenuItem onClick={() => { changeStatus(r, "suspend"); setMenuId(null); }}>⏯ Приостановить продажи</MenuItem>
                            )}
                            {r.status !== "ARCHIVED" && (
                              <MenuItem onClick={() => { changeStatus(r, "archive"); setMenuId(null); }}>📦 Архивировать</MenuItem>
                            )}
                            {r.status === "ARCHIVED" && (
                              <MenuItem onClick={() => { changeStatus(r, "restore"); setMenuId(null); }}>♻️ Восстановить из архива</MenuItem>
                            )}
                          </div>
                        )}
                      </div>
                    </Td>
                  </TableRow>
                );
              })}
            </TableShell>
            {/* Пагинация (Гл. 4.3) */}
            <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
              <span className="text-xs text-[var(--admin-muted)]">
                Страница {pagination.page} из {pagination.totalPages} · {pagination.total} всего
              </span>
              <div className="flex items-center gap-1.5">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  ← Назад
                </Button>
                <Button variant="secondary" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Вперёд →
                </Button>
              </div>
            </div>
          </>
        )}
      </SectionCard>

      {/* Быстрый просмотр (Гл. 4.3) */}
      {quick && (
        <QuickViewPanel row={quick} onClose={() => setQuick(null)} onOpen={() => openDetail(quick.id)} />
      )}

      {/* Карточка услуги */}
      {openId && (
        <ServiceCardModal
          key={openId}
          serviceId={openId}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={() => {
            setOpenId(null);
            const p = new URLSearchParams(searchParams.toString());
            p.delete("open");
            router.replace(`/admin/catalog${p.toString() ? `?${p.toString()}` : ""}`, { scroll: false });
          }}
          onChanged={load}
        />
      )}

      {/* Создание услуги (Гл. 4.5) */}
      {searchParams.get("open") === "new" && <CreateServiceModal onClose={() => router.replace("/admin/catalog")} onCreated={(id) => openDetail(id)} />}
    </div>
  );

  async function changeStatus(r: CatalogRow, action: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/catalog/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(await apiError(res, "Ошибка смены статуса"));
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка смены статуса");
    } finally {
      setBusy(false);
    }
  }
}

/* ── Пункт контекстного меню ── */
function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="w-full text-left px-3 py-2 hover:bg-[var(--admin-bg)] transition-colors flex items-center gap-2" onClick={onClick}>
      {children}
    </button>
  );
}

/* ── Панель быстрого просмотра (Гл. 4.3) ── */
function QuickViewPanel({ row, onClose, onOpen }: { row: CatalogRow; onClose: () => void; onOpen: () => void }) {
  const avail = serviceAvailabilityLabel(row);
  return (
    <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-[var(--admin-card)] border-l border-[var(--admin-border)] shadow-2xl h-full overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[var(--admin-border)] flex items-center justify-between sticky top-0 bg-[var(--admin-card)] z-10">
          <div className="text-sm font-bold flex items-center gap-2">
            <span>{SERVICE_TYPE_ICONS[row.type] ?? "🧩"}</span> Быстрый просмотр
          </div>
          <button className="w-8 h-8 rounded-lg hover:bg-[var(--admin-bg)] flex items-center justify-center" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="font-semibold text-sm leading-snug">{row.title}</div>
          <div className="font-mono text-[11px] text-[var(--admin-muted)]">{row.code}</div>
          <div className="flex items-center gap-2">
            <span className="ac-badge" style={{ background: `${SERVICE_STATUS_COLORS[row.status]}1a`, color: SERVICE_STATUS_COLORS[row.status] }}>
              {row.statusLabel}
            </span>
            <span className="text-xs" style={{ color: avail.color }}>{avail.label}</span>
          </div>
          <div className="text-xl font-bold">{fmtMoney(row.discountPrice ?? row.price)}</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <InfoBox label="Тип" value={SERVICE_TYPE_LABELS[row.type] ?? row.type} />
            <InfoBox label="Категория" value={row.category ?? "—"} />
            <InfoBox label="Направление" value={[row.country, row.city].filter(Boolean).join(" · ") || "—"} />
            <InfoBox label="Поставщик" value={row.providerName ?? "—"} />
            <InfoBox label="Длительность" value={row.duration ?? "—"} />
            <InfoBox label="Рейтинг" value={`⭐ ${row.rating.toFixed(1)} · ${row.reviewCount}`} />
            <InfoBox label="Продажи" value={String(row.bookingsCount)} />
            <InfoBox label="Версия" value={`v${row.version}`} />
          </div>
          <div className="text-xs text-[var(--admin-muted)] leading-relaxed">{row.shortDesc}</div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1" onClick={onOpen}>
              Открыть карточку
            </Button>
            <Button size="sm" variant="ghost" className="flex-1" onClick={onClose}>
              Закрыть
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
      <div className="text-[10px] text-[var(--admin-muted)]">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </div>
  );
}

/* ── Карточка услуги (Гл. 4.4–4.13) ── */
function ServiceCardModal({
  serviceId,
  detail,
  loading,
  error,
  onClose,
  onChanged,
}: {
  serviceId: string;
  detail: ServiceDetail | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState("info");
  const [toast, setToast] = useState("");
  const [restoreTo, setRestoreTo] = useState<number | null>(null);
  const [restoreComment, setRestoreComment] = useState("");
  const [restoreBusy, setRestoreBusy] = useState(false);
  // Локальное состояние карточки: перезапрашиваем детали после каждого
  // изменения (статус, поля, восстановление), чтобы вкладки и шапка не
  // показывали устаревшую версию (Гл. 4.12 «Текущая версия»).
  const [liveDetail, setLiveDetail] = useState<ServiceDetail | null>(detail);
  const [liveLoading, setLiveLoading] = useState(loading);
  const [liveError, setLiveError] = useState(error);

  const refetch = useCallback(async () => {
    setLiveLoading(true);
    try {
      const res = await fetch(`/api/admin/catalog/${serviceId}`);
      if (!res.ok) throw new Error(await apiError(res, "Ошибка загрузки карточки"));
      const data = await res.json();
      setLiveDetail(data.service);
      setLiveError("");
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : "Ошибка загрузки карточки");
    } finally {
      setLiveLoading(false);
    }
  }, [serviceId]);

  const applyAction = async (action: string) => {
    try {
      const res = await fetch(`/api/admin/catalog/${serviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(await apiError(res, "Ошибка обновления статуса"));
      setToast("Статус обновлён");
      onChanged();
      refetch();
      setTimeout(() => setToast(""), 2000);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Ошибка");
      setTimeout(() => setToast(""), 3000);
    }
  };

  const doRestore = async () => {
    if (restoreTo === null) return;
    setRestoreBusy(true);
    try {
      const res = await fetch(`/api/admin/catalog/${serviceId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: restoreTo, comment: restoreComment }),
      });
      if (!res.ok) throw new Error(await apiError(res, "Ошибка восстановления версии"));
      setToast(`Восстановлена редакция v${restoreTo}`);
      setRestoreTo(null);
      setRestoreComment("");
      onChanged();
      refetch();
      setTimeout(() => setToast(""), 2500);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Ошибка восстановления");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setRestoreBusy(false);
    }
  };

  // Текущие данные карточки: liveDetail, если загружены, иначе из пропов.
  const current = liveDetail ?? detail;
  const currentLoading = liveLoading && !current;
  const currentError = liveError || (!current && error ? error : "");

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto no-scrollbar">
      <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl w-full max-w-5xl my-6">
        {/* Шапка карточки (Гл. 4.4) */}
        {currentLoading && (
          <div className="p-8 flex items-center justify-center text-sm text-[var(--admin-muted)]">
            <span className="ac-skeleton h-4 w-40 inline-block" /> Загрузка карточки…
          </div>
        )}
        {!currentLoading && currentError && !current && (
          <div className="p-8 text-center">
            <div className="text-3xl mb-2">⚠️</div>
            <div className="text-sm text-[var(--admin-muted)]">{currentError}</div>
            <Button variant="secondary" className="mt-4" onClick={onClose}>Закрыть</Button>
          </div>
        )}
        {!currentLoading && current && (
          <>
            <div className="px-5 pt-4 pb-3 border-b border-[var(--admin-border)]">
              <nav className="text-[11px] text-[var(--admin-muted)] flex items-center gap-1.5 mb-2 flex-wrap">
                <span>Главная</span>
                <span>›</span>
                <button onClick={onClose} className="hover:text-primary">Каталог услуг</button>
                <span>›</span>
                <span className="text-[var(--admin-text)]">{current.code}</span>
              </nav>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-2xl">{SERVICE_TYPE_ICONS[current.type] ?? "🧩"}</span>
                    <h3 className="text-lg font-bold leading-tight">{current.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                    <span className="font-mono text-[var(--admin-muted)]">{current.code}</span>
                    <span className="ac-badge" style={{ background: `${SERVICE_STATUS_COLORS[current.status]}1a`, color: SERVICE_STATUS_COLORS[current.status] }}>
                      {current.statusLabel}
                    </span>
                    <span className="ac-badge" style={{ background: "#8b5cf61a", color: "#8b5cf6" }}>
                      v{current.version}
                    </span>
                    <span className="text-[var(--admin-muted)]">Изменено: {fmtDate(current.updatedAt)}</span>
                    <span className="text-[var(--admin-muted)]">Ответственный: {current.manager?.name ?? "—"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {current.status !== "PUBLISHED" && current.status !== "ARCHIVED" && (
                    <Button size="sm" variant="success" onClick={() => applyAction("publish")}>✅ Опубликовать</Button>
                  )}
                  {current.status === "PUBLISHED" && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => applyAction("unpublish")}>⏸ Снять</Button>
                      <Button size="sm" variant="secondary" onClick={() => applyAction("suspend")}>⏯ Приостановить</Button>
                    </>
                  )}
                  {current.status !== "ARCHIVED" && (
                    <Button size="sm" variant="ghost" onClick={() => applyAction("archive")}>📦 В архив</Button>
                  )}
                  {current.status === "ARCHIVED" && (
                    <Button size="sm" variant="success" onClick={() => applyAction("restore")}>♻️ Восстановить</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
                </div>
              </div>
            </div>

            {/* Вкладки (Гл. 4.4) */}
            <div className="px-5 pt-3">
              <Tabs
                value={tab}
                onChange={setTab}
                options={[
                  { key: "info", label: "📋 Общая информация" },
                  { key: "pricing", label: "💰 Цены" },
                  { key: "availability", label: "📆 Доступность и квоты" },
                  { key: "media", label: "🖼 Медиа и контент" },
                  { key: "related", label: "🔗 Связанные услуги" },
                  { key: "history", label: "🕘 История и версии" },
                  { key: "ai", label: "🤖 AI Insights" },
                ]}
              />
            </div>

            <div className="p-5">
              {tab === "info" && <InfoTab detail={current} onChanged={refetch} serviceId={serviceId} />}
              {tab === "pricing" && <PricingTab detail={current} onChanged={refetch} serviceId={serviceId} />}
              {tab === "availability" && <AvailabilityTab detail={current} onChanged={refetch} serviceId={serviceId} />}
              {tab === "media" && <MediaTab detail={current} onChanged={refetch} serviceId={serviceId} />}
              {tab === "related" && <RelatedTab detail={current} onChanged={refetch} serviceId={serviceId} />}
              {tab === "history" && (
                <HistoryTab
                  detail={current}
                  onRestore={(v) => setRestoreTo(v)}
                  onCancelRestore={() => setRestoreTo(null)}
                  restoreTo={restoreTo}
                  restoreComment={restoreComment}
                  setRestoreComment={setRestoreComment}
                  onDoRestore={doRestore}
                  restoreBusy={restoreBusy}
                />
              )}
              {tab === "ai" && <AiTab detail={current} />}
            </div>
          </>
        )}
      </div>
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] px-4 py-2.5 rounded-xl text-sm font-medium shadow-2xl" style={{ background: "#22c55e", color: "#fff" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

/* ── Вкладка «Общая информация» (Гл. 4.5) ── */
function InfoTab({ detail, onChanged, serviceId }: { detail: ServiceDetail; onChanged: () => void; serviceId: string }) {
  const [form, setForm] = useState({
    title: detail.title,
    shortDesc: detail.shortDesc ?? "",
    description: detail.description ?? "",
    city: detail.city ?? "",
    country: detail.country ?? "",
    countryCode: detail.countryCode ?? "",
    duration: detail.duration ?? "",
    maxGuests: detail.maxGuests ?? "",
    languages: detail.languages ?? "",
    category: detail.category ?? "",
    managerId: detail.manager?.id ?? "",
    isFeatured: detail.isFeatured,
    isHot: detail.isHot,
  });
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const res = await fetch(`/api/admin/catalog/${serviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        shortDesc: form.shortDesc,
        description: form.description,
        city: form.city,
        country: form.country,
        countryCode: form.countryCode,
        duration: form.duration,
        maxGuests: form.maxGuests ? Number(form.maxGuests) : null,
        languages: form.languages,
        category: form.category,
        managerId: form.managerId || null,
        isFeatured: form.isFeatured,
        isHot: form.isHot,
      }),
    });
    if (!res.ok) throw new Error(await apiError(res, "Ошибка сохранения карточки"));
    setSaved(true);
    onChanged();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-3">
        <Field label="Наименование услуги *">
          <input className="ac-input w-full" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Краткое описание (анонс)">
          <textarea className="ac-input w-full h-20" value={form.shortDesc} onChange={(e) => setForm({ ...form, shortDesc: e.target.value })} />
        </Field>
        <Field label="Подробное описание">
          <textarea className="ac-input w-full h-32" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Страна">
            <input className="ac-input w-full" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </Field>
          <Field label="Город">
            <input className="ac-input w-full" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="Длительность">
            <input className="ac-input w-full" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
          </Field>
          <Field label="Макс. участников">
            <input type="number" className="ac-input w-full" value={form.maxGuests} onChange={(e) => setForm({ ...form, maxGuests: e.target.value })} />
          </Field>
          <Field label="Языки (через запятую)">
            <input className="ac-input w-full" value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} />
          </Field>
          <Field label="Категория / классификация">
            <input className="ac-input w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </Field>
        </div>
        <div className="flex items-center gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="ac-check" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
            Рекомендуемая (featured)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="ac-check" checked={form.isHot} onChange={(e) => setForm({ ...form, isHot: e.target.checked })} />
            Горящее предложение
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={save}>{saved ? "✓ Сохранено" : "Сохранить изменения"}</Button>
          {saved && <span className="text-xs text-green-600">Изменения сохранены, версия обновлена</span>}
        </div>
      </div>
      <div className="space-y-3">
        <InfoBox label="Код услуги" value={detail.code} />
        <InfoBox label="Тип услуги" value={SERVICE_TYPE_LABELS[detail.type] ?? detail.type} />
        <InfoBox label="Поставщик" value={detail.provider?.name ?? "—"} />
        <InfoBox label="Статус" value={detail.statusLabel} />
        <InfoBox label="Создана" value={fmtDate(detail.createdAt)} />
        <InfoBox label="Продаж" value={String(detail.bookingsCount)} />
        <InfoBox label="Отзывов" value={String(detail.reviewsCount)} />
        <InfoBox label="Рейтинг" value={`⭐ ${detail.rating.toFixed(1)}`} />
      </div>
    </div>
  );
}

/* ── Вкладка «Цены» (Гл. 4.6) ── */
function PricingTab({ detail, onChanged, serviceId }: { detail: ServiceDetail; onChanged: () => void; serviceId: string }) {
  const [price, setPrice] = useState(detail.price);
  const [discount, setDiscount] = useState(detail.discountPrice ?? "");
  const [currency, setCurrency] = useState(detail.currency);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const res = await fetch(`/api/admin/catalog/${serviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: Number(price), discountPrice: discount === "" || discount === null ? null : Number(discount), currency }),
    });
    if (!res.ok) throw new Error(await apiError(res, "Ошибка сохранения цен"));
    setSaved(true);
    onChanged();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <Field label="Базовая стоимость *">
          <input type="number" className="ac-input w-full" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </Field>
        <Field label="Стоимость со скидкой (пусто — нет скидки)">
          <input type="number" className="ac-input w-full" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="—" />
        </Field>
        <Field label="Валюта">
          <select className="ac-select w-full" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {["USD", "AZN", "EUR", "RUB", "TRY", "GBP"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Button onClick={save}>{saved ? "✓ Сохранено" : "Сохранить цены"}</Button>
        <p className="text-[11px] text-[var(--admin-muted)]">Сезонные тарифы и специальные предложения (Гл. 4.6) управляются поставщиком и отображаются в момент расчёта стоимости заказа.</p>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-[var(--admin-muted)]">Стоимость</div>
        <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
          <span className="text-sm">Продажная цена</span>
          <span className="text-lg font-bold">{fmtMoney(discount === "" || discount === null ? price : Number(discount))}</span>
        </div>
        <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
          <span className="text-sm">Базовая стоимость</span>
          <span className="font-semibold">{fmtMoney(price)}</span>
        </div>
        {discount !== "" && discount !== null && Number(discount) < price && (
          <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.2)" }}>
            <span className="text-sm">Выгода клиента</span>
            <span className="font-semibold text-green-600">−{Math.round(((price - Number(discount)) / price) * 100)}%</span>
          </div>
        )}
        <div className="pt-2 text-[11px] text-[var(--admin-muted)]">
          Все изменения стоимости фиксируются в истории карточки (Гл. 4.6 «История изменения стоимости») и доступны в разделе «История и версии».
        </div>
      </div>
    </div>
  );
}

/* ── Вкладка «Доступность и квоты» (Гл. 4.7) ── */
function AvailabilityTab({ detail, onChanged, serviceId }: { detail: ServiceDetail; onChanged: () => void; serviceId: string }) {
  const [total, setTotal] = useState(detail.quota.total);
  const [booked, setBooked] = useState(detail.quota.booked);
  const [reserved, setReserved] = useState(detail.quota.reserved);
  const [salesStart, setSalesStart] = useState(detail.salesStart ? detail.salesStart.slice(0, 10) : "");
  const [salesEnd, setSalesEnd] = useState(detail.salesEnd ? detail.salesEnd.slice(0, 10) : "");
  const [serviceStart, setServiceStart] = useState(detail.serviceStart ? detail.serviceStart.slice(0, 10) : "");
  const [serviceEnd, setServiceEnd] = useState(detail.serviceEnd ? detail.serviceEnd.slice(0, 10) : "");
  const [saved, setSaved] = useState(false);
  const available = Math.max(0, total - booked - reserved);
  const usedPct = total > 0 ? Math.round(((booked + reserved) / total) * 100) : 0;

  const save = async () => {
    const res = await fetch(`/api/admin/catalog/${serviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quotaTotal: Number(total),
        quotaBooked: Number(booked),
        quotaReserved: Number(reserved),
        salesStart: salesStart || null,
        salesEnd: salesEnd || null,
        serviceStart: serviceStart || null,
        serviceEnd: serviceEnd || null,
      }),
    });
    if (!res.ok) throw new Error(await apiError(res, "Ошибка сохранения доступности"));
    setSaved(true);
    onChanged();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-[var(--admin-muted)]">Управление квотами (Гл. 4.7)</div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Общая квота">
            <input type="number" className="ac-input w-full" value={total} onChange={(e) => setTotal(Number(e.target.value))} />
          </Field>
          <Field label="Забронировано">
            <input type="number" className="ac-input w-full" value={booked} onChange={(e) => setBooked(Number(e.target.value))} />
          </Field>
          <Field label="В резерве">
            <input type="number" className="ac-input w-full" value={reserved} onChange={(e) => setReserved(Number(e.target.value))} />
          </Field>
        </div>
        <div className="text-xs font-semibold text-[var(--admin-muted)] pt-1">Период продажи</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Начало продаж">
            <input type="date" className="ac-input w-full" value={salesStart} onChange={(e) => setSalesStart(e.target.value)} />
          </Field>
          <Field label="Окончание продаж">
            <input type="date" className="ac-input w-full" value={salesEnd} onChange={(e) => setSalesEnd(e.target.value)} />
          </Field>
        </div>
        <div className="text-xs font-semibold text-[var(--admin-muted)] pt-1">Период оказания услуги</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Начало">
            <input type="date" className="ac-input w-full" value={serviceStart} onChange={(e) => setServiceStart(e.target.value)} />
          </Field>
          <Field label="Окончание">
            <input type="date" className="ac-input w-full" value={serviceEnd} onChange={(e) => setServiceEnd(e.target.value)} />
          </Field>
        </div>
        <Button onClick={save}>{saved ? "✓ Сохранено" : "Сохранить доступность"}</Button>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-[var(--admin-muted)]">Текущее состояние</div>
        <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
          <span className="text-sm">Доступно мест</span>
          <span className={`text-lg font-bold ${available === 0 ? "text-red-500" : available <= Math.ceil(total * 0.1) ? "text-amber-500" : "text-green-600"}`}>
            {available}
          </span>
        </div>
        {total > 0 && (
          <div className="rounded-xl px-4 py-3" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-[var(--admin-muted)]">Использовано квоты</span>
              <span className="font-medium">{usedPct}%</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: "var(--admin-border)" }}>
              <div className="h-2 rounded-full" style={{ width: `${Math.min(100, usedPct)}%`, background: usedPct > 90 ? "#ef4444" : usedPct > 60 ? "#f59e0b" : "#22c55e" }} />
            </div>
          </div>
        )}
        <div className="rounded-xl px-4 py-3 text-xs space-y-1.5" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
          <div className="flex justify-between"><span className="text-[var(--admin-muted)]">Общая квота</span><span>{total}</span></div>
          <div className="flex justify-between"><span className="text-[var(--admin-muted)]">Забронировано</span><span>{booked}</span></div>
          <div className="flex justify-between"><span className="text-[var(--admin-muted)]">В резерве</span><span>{reserved}</span></div>
          <div className="flex justify-between"><span className="text-[var(--admin-muted)]">Продажи</span><span>{salesStart ? `${salesStart} — ${salesEnd || "∞"}` : "не ограничены"}</span></div>
        </div>
      </div>
    </div>
  );
}

/* ── Вкладка «Медиа и контент» (Гл. 4.8) ── */
function MediaTab({ detail, onChanged, serviceId }: { detail: ServiceDetail; onChanged: () => void; serviceId: string }) {
  const [seoTitle, setSeoTitle] = useState(detail.seo.title ?? "");
  const [seoDesc, setSeoDesc] = useState(detail.seo.description ?? "");
  const [seoKeywords, setSeoKeywords] = useState(detail.seo.keywords ?? "");
  const [channels, setChannels] = useState<string[]>((detail.channels as string[]) ?? []);
  const [saved, setSaved] = useState(false);
  const CHANNEL_OPTIONS = ["Сайт", "Мобильное приложение", "B2B-портал", "Внутренний каталог", "API для партнёров"];

  const save = async () => {
    const res = await fetch(`/api/admin/catalog/${serviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seoTitle, seoDescription: seoDesc, seoKeywords, channels }),
    });
    if (!res.ok) throw new Error(await apiError(res, "Ошибка сохранения SEO"));
    setSaved(true);
    onChanged();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-[var(--admin-muted)]">SEO и публикация (Гл. 4.8)</div>
        <Field label="SEO-заголовок">
          <input className="ac-input w-full" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
        </Field>
        <Field label="SEO-описание">
          <textarea className="ac-input w-full h-20" value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} />
        </Field>
        <Field label="Ключевые слова">
          <input className="ac-input w-full" value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)} />
        </Field>
        <Button onClick={save}>{saved ? "✓ Сохранено" : "Сохранить SEO"}</Button>
      </div>
      <div className="space-y-3">
        <div className="text-xs font-semibold text-[var(--admin-muted)]">Галерея ({detail.images.length})</div>
        <div className="grid grid-cols-3 gap-2">
          {detail.images.slice(0, 6).map((img, i) => (
            <div key={i} className="aspect-[4/3] rounded-xl overflow-hidden border border-[var(--admin-border)]" style={{ background: "var(--admin-bg)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={String(img)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          ))}
          {detail.images.length === 0 && <div className="text-xs text-[var(--admin-muted)] col-span-3">Изображения не загружены</div>}
        </div>
        <div className="text-xs font-semibold text-[var(--admin-muted)] pt-2">Каналы распространения (Гл. 4.10)</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {CHANNEL_OPTIONS.map((ch) => {
            const on = channels.includes(ch);
            return (
              <Chip key={ch} active={on} onClick={() => setChannels((c) => (on ? c.filter((x) => x !== ch) : [...c, ch]))}>
                {ch}
              </Chip>
            );
          })}
        </div>
        <div className="text-[11px] text-[var(--admin-muted)] pt-1">Публикация в выбранных каналах управляется настройками отображения каждого канала (Гл. 4.10).</div>
      </div>
    </div>
  );
}

/* ── Вкладка «Связанные услуги» (Гл. 4.9) ── */
function RelatedTab({ detail, onChanged, serviceId }: { detail: ServiceDetail; onChanged: () => void; serviceId: string }) {
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<{ id: string; code: string; title: string; type: string; price: number; currency: string; status: string }[]>([]);
  const [saved, setSaved] = useState(false);
  const relatedIds = detail.relatedIds;

  const findCandidates = async () => {
    if (!search.trim()) return;
    const res = await fetch(`/api/admin/catalog?search=${encodeURIComponent(search.trim())}&limit=8`);
    if (!res.ok) return;
    const data = await res.json();
    setCandidates(data.services.filter((s: CatalogRow) => s.id !== serviceId));
  };

  const save = async (ids: string[]) => {
    const res = await fetch(`/api/admin/catalog/${serviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relatedIds: ids }),
    });
    if (!res.ok) throw new Error(await apiError(res, "Ошибка обновления связей"));
    setSaved(true);
    onChanged();
    setTimeout(() => setSaved(false), 2000);
  };

  const addCandidate = (id: string) => {
    const next = [...relatedIds, id];
    setCandidates([]);
    setSearch("");
    void save(next);
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-[var(--admin-muted)]">
        Обязательные и дополнительные услуги, пакеты и альтернативы (Гл. 4.9) формируют комплексные предложения и допродажи.
      </div>
      <div className="flex gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Найти услугу для связи…" />
        <Button variant="secondary" onClick={findCandidates}>Найти</Button>
      </div>
      {candidates.length > 0 && (
        <div className="rounded-xl border border-[var(--admin-border)] overflow-hidden">
          {candidates.map((c) => (
            <div key={c.id} className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-[var(--admin-bg)] border-b border-[var(--admin-border)] last:border-0">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{c.title}</div>
                <div className="text-[11px] text-[var(--admin-muted)]">{c.code} · {SERVICE_TYPE_LABELS[c.type] ?? c.type}</div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => addCandidate(c.id)}>+ Связать</Button>
            </div>
          ))}
        </div>
      )}
      <div>
        <div className="text-xs font-semibold text-[var(--admin-muted)] mb-1.5">Связанные услуги ({detail.related.length})</div>
        {detail.related.length === 0 && <div className="text-xs text-[var(--admin-muted)]">Связанных услуг пока нет</div>}
        <div className="space-y-1.5">
          {detail.related.map((r) => (
            <div key={r.id} className="px-3 py-2 rounded-xl flex items-center justify-between gap-2" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{r.title}</div>
                <div className="text-[11px] text-[var(--admin-muted)]">
                  {r.code} · {SERVICE_TYPE_LABELS[r.type] ?? r.type} · {fmtMoney(r.price)}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const next = relatedIds.filter((x) => x !== r.id);
                  void save(next);
                }}
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
      </div>
      {saved && <div className="text-xs text-green-600">Связи обновлены</div>}
    </div>
  );
}

/* ── Вкладка «История и версии» (Гл. 4.12) ── */
function HistoryTab({
  detail,
  onRestore,
  onCancelRestore,
  restoreTo,
  restoreComment,
  setRestoreComment,
  onDoRestore,
  restoreBusy,
}: {
  detail: ServiceDetail;
  onRestore: (v: number) => void;
  onCancelRestore: () => void;
  restoreTo: number | null;
  restoreComment: string;
  setRestoreComment: (v: string) => void;
  onDoRestore: () => void;
  restoreBusy: boolean;
}) {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const rows = [...detail.history].sort((a, b) => b.version - a.version);
  const selected = rows.find((r) => r.version === selectedVersion);
  const restoring = restoreTo !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-sm font-bold">Текущая версия: v{detail.version}</div>
          <div className="text-xs text-[var(--admin-muted)]">Каждое сохранение карточки создаёт новую редакцию (Гл. 4.12)</div>
        </div>
        {restoring && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              className="ac-input w-48"
              placeholder="Комментарий восстановления"
              value={restoreComment}
              onChange={(e) => setRestoreComment(e.target.value)}
            />
            <Button size="sm" onClick={onDoRestore} disabled={restoreBusy}>
              {restoreBusy ? "…" : `Восстановить v${restoreTo}`}
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelRestore}>
              Отмена
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <div className="text-xs font-semibold text-[var(--admin-muted)] mb-1.5">Хронология версий</div>
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto no-scrollbar pr-1">
            {rows.map((h) => (
              <button
                key={h.id}
                className={`w-full text-left px-3 py-2 rounded-xl border transition-colors ${
                  selectedVersion === h.version ? "border-primary" : "border-[var(--admin-border)] hover:bg-[var(--admin-bg)]"
                }`}
                onClick={() => setSelectedVersion(h.version)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">v{h.version}</span>
                  <span className="text-[10px] text-[var(--admin-muted)]">{fmtDate(h.createdAt)}</span>
                </div>
                <div className="text-xs mt-0.5">{h.comment ?? "Изменение карточки"}</div>
                <div className="text-[10px] text-[var(--admin-muted)] mt-0.5">{h.actorName}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-sm font-bold">Редакция v{selected.version}</div>
                  <div className="text-[11px] text-[var(--admin-muted)]">{new Date(selected.createdAt).toLocaleString("ru-RU")} · {selected.actorName}</div>
                </div>
                {selected.version < detail.version && (
                  <Button size="sm" variant="secondary" onClick={() => onRestore(selected.version)}>
                    ♻️ Восстановить эту версию
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-[var(--admin-muted)]">Действие:</span>
                <span className="ac-badge" style={{ background: "#8b5cf61a", color: "#8b5cf6" }}>
                  {historyActionLabel(selected.action)}
                </span>
                {selected.from && (
                  <>
                    <span className="text-[var(--admin-muted)]">из</span>
                    <span className="ac-badge" style={{ background: "#94a3b81a", color: "#94a3b8" }}>
                      {SERVICE_STATUS_LABELS[selected.from] ?? selected.from}
                    </span>
                  </>
                )}
                {selected.to && (
                  <>
                    <span className="text-[var(--admin-muted)]">в</span>
                    <span className="ac-badge" style={{ background: `${SERVICE_STATUS_COLORS[selected.to] ?? "#64748b"}1a`, color: SERVICE_STATUS_COLORS[selected.to] ?? "#64748b" }}>
                      {SERVICE_STATUS_LABELS[selected.to] ?? selected.to}
                    </span>
                  </>
                )}
              </div>
              {selected.fields && Array.isArray(selected.fields) ? (
                <div className="text-xs">
                  <div className="text-[var(--admin-muted)] mb-1">Изменённые разделы:</div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(selected.fields as string[]).map((f) => (
                      <span key={f} className="ac-badge" style={{ background: "#f973161a", color: "#f97316" }}>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[var(--admin-muted)]">{selected.comment ?? "Изменение карточки"}</div>
              )}
              {selected.version === detail.version && (
                <div className="text-[11px] text-green-600">← Текущая редакция</div>
              )}
            </div>
          ) : (
            <div className="rounded-xl px-4 py-8 text-center text-sm text-[var(--admin-muted)]" style={{ background: "var(--admin-bg)", border: "1px dashed var(--admin-border)" }}>
              Выберите версию слева, чтобы просмотреть детали редакции, изменённые разделы и восстановить её.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Вкладка «AI Insights» (Гл. 4.13) ── */
function AiTab({ detail }: { detail: ServiceDetail }) {
  const ai = detail.ai;
  if (!ai) return <EmptyState icon="🤖" text="AI-анализ недоступен" />;
  const readinessColor = ai.readiness >= 80 ? "#22c55e" : ai.readiness >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="space-y-3">
        <div className="rounded-xl p-4" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
          <div className="text-xs font-semibold text-[var(--admin-muted)] mb-2">Готовность услуги</div>
          <div className="text-3xl font-bold" style={{ color: readinessColor }}>{ai.readiness}%</div>
          <div className="h-2 rounded-full mt-2" style={{ background: "var(--admin-border)" }}>
            <div className="h-2 rounded-full" style={{ width: `${ai.readiness}%`, background: readinessColor }} />
          </div>
          <div className="text-[11px] text-[var(--admin-muted)] mt-2">
            {ai.missing.length ? `Необходимо заполнить: ${ai.missing.join(", ")}` : "Все разделы заполнены"}
          </div>
        </div>
        <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
          <div className="text-xs font-semibold text-[var(--admin-muted)]">Прогноз эффективности</div>
          <div className="flex justify-between text-sm"><span className="text-[var(--admin-muted)]">Привлекательность</span><b>{ai.forecast.attractiveness}%</b></div>
          <div className="flex justify-between text-sm"><span className="text-[var(--admin-muted)]">Вероятность продажи</span><b>{ai.forecast.sellProbability}%</b></div>
          <div className="flex justify-between text-sm"><span className="text-[var(--admin-muted)]">Конкурентоспособность</span><b>{ai.forecast.competitiveness}</b></div>
        </div>
      </div>
      <div className="lg:col-span-2 space-y-2">
        <div className="text-xs font-semibold text-[var(--admin-muted)] mb-1.5">Рекомендации AI (Гл. 4.13)</div>
        {ai.priceInsight && (
          <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "rgba(34,197,94,.06)", border: "1px solid rgba(34,197,94,.2)" }}>
            <span className="text-lg">💲</span>
            <div>
              <div className="text-sm font-semibold">{ai.priceInsight.title}</div>
              <div className="text-xs text-[var(--admin-muted)]">{ai.priceInsight.detail}</div>
            </div>
          </div>
        )}
        {ai.recommendations.map((r, i) => (
          <div key={i} className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
            <span className="text-lg">{r.level === "high" ? "🔴" : r.level === "medium" ? "🟡" : r.level === "positive" ? "🟢" : "🔵"}</span>
            <div>
              <div className="text-sm font-semibold">{r.title}</div>
              <div className="text-xs text-[var(--admin-muted)]">{r.detail}</div>
            </div>
          </div>
        ))}
        {ai.recommendations.length === 0 && !ai.priceInsight && (
          <div className="text-sm text-[var(--admin-muted)]">Замечаний нет — карточка полностью готова к публикации 🎉</div>
        )}
        <div className="text-xs font-semibold text-[var(--admin-muted)] mt-3 mb-1.5">Проверка заполненности</div>
        <div className="grid grid-cols-2 gap-1.5">
          {ai.checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-xs">
              <span className={`inline-flex w-4 h-4 rounded-full items-center justify-center text-[9px] ${c.ok ? "text-green-600" : "text-red-500"}`} style={{ background: c.ok ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)" }}>
                {c.ok ? "✓" : "✕"}
              </span>
              {c.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Модальное создание услуги (Гл. 4.5) ── */
function CreateServiceModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({ type: "TOUR", title: "", price: "", currency: "USD", shortDesc: "", description: "", city: "", country: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, price: Number(form.price) }),
      });
      if (!res.ok) throw new Error(await apiError(res, "Ошибка создания услуги"));
      const data = await res.json();
      onCreated(data.service.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка создания");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-5 py-4 border-b border-[var(--admin-border)] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">➕ Новая услуга</h3>
            <p className="text-xs text-[var(--admin-muted)] mt-0.5">Создание карточки каталога (Гл. 4.5)</p>
          </div>
          <button className="w-8 h-8 rounded-lg hover:bg-[var(--admin-bg)] flex items-center justify-center" onClick={onClose}>✕</button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Тип услуги">
            <select className="ac-select w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Наименование *">
            <input className="ac-input w-full" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Например: Тур в Анталию" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Стоимость *">
              <input type="number" className="ac-input w-full" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </Field>
            <Field label="Валюта">
              <select className="ac-select w-full" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                {["USD", "AZN", "EUR", "RUB"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Страна">
              <input className="ac-input w-full" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </Field>
            <Field label="Город">
              <input className="ac-input w-full" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
          </div>
          <Field label="Краткое описание">
            <textarea className="ac-input w-full h-16" value={form.shortDesc} onChange={(e) => setForm({ ...form, shortDesc: e.target.value })} />
          </Field>
          {err && <div className="text-xs text-red-500">{err}</div>}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose}>Отмена</Button>
            <Button onClick={submit} disabled={busy || !form.title || !form.price}>
              {busy ? "Создание…" : "Создать черновик"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Поле формы с подписью ── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-[var(--admin-muted)] block mb-1">{label}</span>
      {children}
    </label>
  );
}

function historyActionLabel(action: string): string {
  return SERVICE_HISTORY_ACTION_LABELS[action] ?? action;
}
