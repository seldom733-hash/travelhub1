"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Badge,
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
import { fmtDateTime } from "@/lib/admin-data";
import { describeApiError } from "@/lib/api-error";
import {
  AUDIT_CATEGORIES,
  AUDIT_CATEGORY_ICONS,
  AUDIT_ACTION_LABELS,
  AUDIT_CRITICALITY,
  AUDIT_SOURCES,
  auditCriticalityColor,
} from "@/lib/audit-meta";

/** Разбор ошибки API с дефолтным текстом (см. lib/api-error.ts). */
async function apiError(res: Response, fallback: string): Promise<string> {
  return describeApiError(res, fallback);
}

/**
 * Журнал аудита (Гл. 3.18) — раздел «Система».
 *
 * Централизованная регистрация всех значимых действий пользователей,
 * автоматических процессов и внешних интеграций. Страница предоставляет:
 * KPI-панель (всего / сегодня / критические / по категориям), фильтрацию по
 * категории, действию, критичности, источнику, исполнителю и периоду, реестр
 * событий с детализацией (изменённые поля, IP, User-Agent) и экспорт в CSV.
 */

interface AuditRow {
  id: string;
  eventId: string;
  actorName: string;
  actorRole: string | null;
  department: string | null;
  category: string;
  action: string;
  actionLabel: string;
  objectType: string | null;
  objectId: string | null;
  objectNumber: string | null;
  fromData: Record<string, unknown> | null;
  toData: Record<string, unknown> | null;
  comment: string | null;
  source: string;
  ip: string | null;
  userAgent: string | null;
  criticality: string;
  createdAt: string;
}

interface AuditResponse {
  kpi: {
    total: { value: number; detail: string };
    today: { value: number; detail: string };
    critical: { value: number; detail: string };
    byCategory: { category: string; count: number }[];
  };
  list: AuditRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: {
    categories: { value: string; label: string }[];
    actions: { value: string; label: string }[];
    criticality: { value: string; label: string }[];
    sources: { value: string; label: string }[];
    actors: string[];
  };
}

const PERIODS = [
  { key: "today", label: "Сегодня" },
  { key: "yesterday", label: "Вчера" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "quarter", label: "Квартал" },
  { key: "year", label: "Год" },
];

export default function AuditCenter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [period, setPeriod] = useState(searchParams.get("period") || "month");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [action, setAction] = useState(searchParams.get("action") || "");
  const [criticality, setCriticality] = useState(searchParams.get("criticality") || "");
  const [source, setSource] = useState(searchParams.get("source") || "");
  const [actorName, setActorName] = useState(searchParams.get("actorName") || "");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Раскрытая строка с деталями события (Гл. 3.18 «Просмотр изменений»)
  const [detailId, setDetailId] = useState<string | null>(null);

  const buildParams = useCallback(
    (pageNum: number) => {
      const params = new URLSearchParams({ period, page: String(pageNum), limit: String(limit) });
      if (category) params.set("category", category);
      if (action) params.set("action", action);
      if (criticality) params.set("criticality", criticality);
      if (source) params.set("source", source);
      if (actorName) params.set("actorName", actorName);
      if (search) params.set("search", search);
      return params;
    },
    [period, category, action, criticality, source, actorName, search, limit]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/audit?${buildParams(page).toString()}`);
      if (!r.ok) throw new Error(await apiError(r, "Ошибка загрузки журнала аудита"));
      setData(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [buildParams, page]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadData();
    }, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [loadData, search]);

  const syncFilter = useCallback(
    (key: string, value: string) => {
      const p = new URLSearchParams(searchParams.toString());
      if (value) p.set(key, value);
      else p.delete(key);
      p.delete("open");
      router.replace(`/admin/system?${p.toString()}`);
    },
    [router, searchParams]
  );

  const setAndSync = useCallback(
    (setter: (v: string) => void, key: string, value: string) => {
      setter(value);
      setPage(1);
      syncFilter(key, value);
    },
    [syncFilter]
  );

  const resetFilters = () => {
    setPeriod("month");
    setCategory("");
    setAction("");
    setCriticality("");
    setSource("");
    setActorName("");
    setSearch("");
    setPage(1);
    router.replace("/admin/system");
  };

  // Поиск синхронизируется с URL (как остальные фильтры): с задержкой, чтобы
  // не переписывать историю на каждый символ. Первый рендер (инициализация из
  // URL) не перезаписывает адрес.
  const searchSyncedRef = useRef(false);
  useEffect(() => {
    if (!searchSyncedRef.current) {
      searchSyncedRef.current = true;
      return;
    }
    const t = setTimeout(() => syncFilter("search", search), 400);
    return () => clearTimeout(t);
  }, [search, syncFilter]);

  // Экспорт текущей страницы в CSV (Гл. 3.18 «Экспорт журнала»)
  const exportCsv = () => {
    if (!data?.list.length) return;
    const header = ["Событие", "Дата", "Категория", "Действие", "Исполнитель", "Роль", "Подразделение", "Объект", "Номер", "Комментарий", "Источник", "IP", "Критичность"];
    const body = data.list.map((r) => [
      r.eventId,
      fmtDateTime(r.createdAt),
      r.category,
      r.actionLabel,
      r.actorName,
      r.actorRole ?? "—",
      r.department ?? "—",
      r.objectType ?? "—",
      r.objectNumber ?? "—",
      r.comment ?? "—",
      r.source,
      r.ip ?? "—",
      r.criticality,
    ]);
    const csv = [header, ...body]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const kpi = data?.kpi;
  const pagination = data?.pagination;

  // KPI-карточки (Гл. 3.18): всего / сегодня / критические + по категориям
  const kpiCards = useMemo(() => {
    if (!kpi) return [];
    return [
      {
        key: "total",
        icon: "📋",
        title: "Всего событий",
        value: kpi.total.value,
        detail: kpi.total.detail,
        color: "#3b82f6",
        onClick: () => setAndSync(setCategory, "category", ""),
      },
      {
        key: "today",
        icon: "🗓",
        title: "За сегодня",
        value: kpi.today.value,
        detail: "События текущего дня",
        color: "#06b6d4",
        onClick: () => setAndSync(setPeriod, "period", "today"),
      },
      {
        key: "critical",
        icon: "⛔",
        title: "Ошибки и критические",
        value: kpi.critical.value,
        detail: "Требуют внимания",
        color: "#dc2626",
        onClick: () => setAndSync(setCriticality, "criticality", ""),
      },
    ];
  }, [kpi, setAndSync]);

  const categoryCards = useMemo(
    () =>
      (data?.kpi?.byCategory ?? []).map((c) => ({
        key: c.category,
        icon: AUDIT_CATEGORY_ICONS[c.category] ?? "📄",
        title: c.category,
        value: c.count,
        detail: c.category,
        color: "#64748b",
        onClick: () => setAndSync(setCategory, "category", c.category),
      })),
    [data, setAndSync]
  );

  const activeFiltersCount = [category, action, criticality, source, actorName, search].filter(Boolean).length;

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-4">
          Ошибка загрузки: {error}
        </div>
      )}

      {/* ── Заголовок раздела ── */}
      <PageHeader
        title="🖥 Система · Журнал аудита"
        subtitle="Централизованная регистрация действий пользователей, автоматических процессов и интеграций (Гл. 3.18)"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!data?.list.length}>
              ⬇ Экспорт CSV
            </Button>
            <Button size="sm" onClick={() => loadData()}>
              ↺ Обновить
            </Button>
          </>
        }
      />

      {/* ── KPI-панель (Гл. 3.18) ── */}
      <SectionCard
        icon="📊"
        title="KPI журнала"
        subtitle={`Период: ${PERIODS.find((p) => p.key === period)?.label ?? period}`}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {loading && !data
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
            : [...kpiCards, ...categoryCards].map((c) => (
                <KpiCard
                  key={c.key}
                  icon={c.icon}
                  title={c.title}
                  value={c.value}
                  detail={c.detail}
                  color={c.color}
                  onClick={c.onClick}
                  isActive={category === c.key || (c.key === "today" && period === "today")}
                />
              ))}
        </div>
      </SectionCard>

      {/* ── Период-табы ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Tabs
          options={PERIODS.map((p) => ({ key: p.key, label: p.label }))}
          value={period}
          onChange={(k) => setAndSync(setPeriod, "period", k)}
        />
        {activeFiltersCount > 0 && (
          <button onClick={resetFilters} className="text-xs text-primary hover:underline">
            ✕ Сбросить фильтры ({activeFiltersCount})
          </button>
        )}
      </div>

      {/* ── Панель фильтрации (Гл. 3.18 «Поиск по журналу») ── */}
      <SectionCard
        icon="🔍"
        title="Фильтрация событий"
        bodyClassName="space-y-3"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Поиск: номер события (AUD-…), номер объекта, комментарий, исполнитель…"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <FilterSelect
              label="Категория"
              value={category}
              onChange={(v) => setAndSync(setCategory, "category", v)}
              options={data?.filters?.categories ?? AUDIT_CATEGORIES.map((c) => ({ value: c, label: c }))}
              placeholder="Все категории"
              className="min-w-[180px]"
            />
            <FilterSelect
              label="Действие"
              value={action}
              onChange={(v) => setAndSync(setAction, "action", v)}
              options={data?.filters?.actions ?? Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({ value, label }))}
              placeholder="Все действия"
              className="min-w-[180px]"
            />
            <FilterSelect
              label="Критичность"
              value={criticality}
              onChange={(v) => setAndSync(setCriticality, "criticality", v)}
              options={data?.filters?.criticality ?? AUDIT_CRITICALITY.map((c) => ({ value: c.key, label: c.label }))}
              placeholder="Любая"
              className="min-w-[140px]"
            />
            <FilterSelect
              label="Источник"
              value={source}
              onChange={(v) => setAndSync(setSource, "source", v)}
              options={data?.filters?.sources ?? AUDIT_SOURCES.map((s) => ({ value: s, label: s }))}
              placeholder="Все источники"
              className="min-w-[140px]"
            />
            <FilterSelect
              label="Исполнитель"
              value={actorName}
              onChange={(v) => setAndSync(setActorName, "actorName", v)}
              options={(data?.filters?.actors ?? []).map((a) => ({ value: a, label: a }))}
              placeholder="Все исполнители"
              className="min-w-[160px]"
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-[var(--admin-muted)]">Категории:</span>
          {AUDIT_CATEGORIES.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setAndSync(setCategory, "category", category === c ? "" : c)}>
              {AUDIT_CATEGORY_ICONS[c]} {c}
            </Chip>
          ))}
        </div>
      </SectionCard>

      {/* ── Реестр событий (Гл. 3.18) ── */}
      <SectionCard
        icon="🗂"
        title={
          <span>
            Реестр событий{" "}
            {pagination && <span className="text-[var(--admin-muted)] font-normal">· {pagination.total} записей</span>}
          </span>
        }
        subtitle="Журнал неизменяем: записи не редактируются и не удаляются пользователями"
        bodyClassName="space-y-3"
      >
        {loading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : !data?.list.length ? (
          <EmptyState icon="🗂" text="Событий за период не найдено — измените фильтры или период" />
        ) : (
          <>
            <TableShell
              columns={[
                "Событие",
                "Дата",
                "Категория",
                "Действие",
                "Исполнитель",
                "Объект",
                "Комментарий",
                "Источник",
                "IP",
                "Критичность",
              ]}
              minWidth="min-w-[1100px]"
            >
              {data.list.map((r) => {
                const critColor = auditCriticalityColor(r.criticality);
                const isDetail = detailId === r.id;
                return (
                  <TableRow
                    key={r.id}
                    className={`cursor-pointer transition-colors ${isDetail ? "bg-primary/5" : "hover:bg-[var(--admin-bg)]"}`}
                    onClick={() => setDetailId(isDetail ? null : r.id)}
                    title="Кликните для деталей события"
                  >
                    <Td>
                      <div className="text-xs font-bold text-primary">{r.eventId}</div>
                      <div className="text-[10px] text-[var(--admin-muted)]">{r.category}</div>
                    </Td>
                    <Td className="whitespace-nowrap text-[var(--admin-muted)]">{fmtDateTime(r.createdAt)}</Td>
                    <Td>
                      <span className="text-xs inline-flex items-center gap-1">
                        {AUDIT_CATEGORY_ICONS[r.category] ?? "📄"} {r.category}
                      </span>
                    </Td>
                    <Td>
                      <Badge style={{ background: "var(--admin-bg)", color: "var(--admin-text)" }}>{r.actionLabel}</Badge>
                    </Td>
                    <Td>
                      <div className="text-xs font-semibold">{r.actorName}</div>
                      {r.actorRole && <div className="text-[10px] text-[var(--admin-muted)]">{r.actorRole}{r.department ? ` · ${r.department}` : ""}</div>}
                    </Td>
                    <Td>
                      {r.objectType ? (
                        <>
                          <div className="text-xs">{r.objectType}</div>
                          {r.objectNumber && <div className="text-[10px] text-primary font-medium">{r.objectNumber}</div>}
                        </>
                      ) : (
                        <span className="text-[var(--admin-muted)] text-xs">—</span>
                      )}
                    </Td>
                    <Td className="text-xs text-[var(--admin-muted)] max-w-[260px]">
                      <div className="line-clamp-2">{r.comment ?? "—"}</div>
                    </Td>
                    <Td>
                      <Badge style={{ background: "var(--admin-bg)", color: "var(--admin-muted)" }}>{r.source}</Badge>
                    </Td>
                    <Td className="text-[11px] text-[var(--admin-muted)] whitespace-nowrap">{r.ip ?? "—"}</Td>
                    <Td>
                      <Badge style={{ background: `${critColor}1a`, color: critColor }}>
                        {AUDIT_CRITICALITY.find((c) => c.key === r.criticality)?.label ?? r.criticality}
                      </Badge>
                    </Td>
                  </TableRow>
                );
              })}
            </TableShell>

            {/* Детальная информация о событии (Гл. 3.18 «Просмотр изменений») */}
            {detailId && data.list.some((r) => r.id === detailId) && (
              <AuditDetail row={data.list.find((r) => r.id === detailId)!} onClose={() => setDetailId(null)} />
            )}

            {/* Пагинация */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div className="text-[11px] text-[var(--admin-muted)]">
                  Страница {pagination.page} из {pagination.totalPages} · {pagination.total} записей
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="secondary" size="sm" disabled={pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    ←
                  </Button>
                  <Button variant="secondary" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}>
                    →
                  </Button>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className="ac-select h-9 w-20"
                  >
                    {[10, 20, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}

/** Раскрываемая детальная карточка события (Гл. 3.18 «Просмотр изменений»). */
function AuditDetail({ row, onClose }: { row: AuditRow; onClose: () => void }) {
  const critColor = auditCriticalityColor(row.criticality);
  const meta: [string, string][] = [
    ["Событие", row.eventId],
    ["Дата и время", fmtDateTime(row.createdAt)],
    ["Категория", row.category],
    ["Действие", row.actionLabel],
    ["Исполнитель", `${row.actorName}${row.actorRole ? ` (${row.actorRole})` : ""}`],
    ["Подразделение", row.department ?? "—"],
    ["Объект", row.objectType ? `${row.objectType}${row.objectNumber ? ` · ${row.objectNumber}` : ""}` : "—"],
    ["Источник", row.source],
    ["IP-адрес", row.ip ?? "—"],
    ["Критичность", AUDIT_CRITICALITY.find((c) => c.key === row.criticality)?.label ?? row.criticality],
  ];
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-bg)]/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{AUDIT_CATEGORY_ICONS[row.category] ?? "📄"}</span>
          <div>
            <div className="text-sm font-bold">{row.eventId}</div>
            <div className="text-[11px] text-[var(--admin-muted)]">{row.comment ?? "Без комментария"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge style={{ background: `${critColor}1a`, color: critColor }}>
            {AUDIT_CRITICALITY.find((c) => c.key === row.criticality)?.label ?? row.criticality}
          </Badge>
          <button onClick={onClose} className="ac-btn ac-btn-ghost ac-btn-sm ac-btn-icon" title="Закрыть">
            ✕
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {meta.map(([label, value]) => (
          <div key={label} className="bg-[var(--admin-card)] rounded-xl p-2.5">
            <div className="text-[10px] uppercase tracking-wide text-[var(--admin-muted)]">{label}</div>
            <div className="text-xs font-semibold mt-0.5 break-words">{value}</div>
          </div>
        ))}
      </div>

      {(row.fromData || row.toData) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {row.fromData && (
            <div className="rounded-xl border border-[var(--admin-border)] p-3">
              <div className="text-[10px] uppercase text-[var(--admin-muted)] mb-1">Было</div>
              <pre className="text-[11px] font-mono text-red-600 whitespace-pre-wrap break-words">{JSON.stringify(row.fromData, null, 2)}</pre>
            </div>
          )}
          {row.toData && (
            <div className="rounded-xl border border-[var(--admin-border)] p-3">
              <div className="text-[10px] uppercase text-[var(--admin-muted)] mb-1">Стало</div>
              <pre className="text-[11px] font-mono text-emerald-600 whitespace-pre-wrap break-words">{JSON.stringify(row.toData, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {row.userAgent && (
        <div className="text-[10px] text-[var(--admin-muted)]">
          User Agent: <span className="break-all">{row.userAgent}</span>
        </div>
      )}
    </div>
  );
}
