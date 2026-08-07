"use client";

/**
 * Конструктор отчётов (Гл. 2.3, 2.6 «Создать отчёт»).
 *
 * Пользователь выбирает разделы BI Center и период — система собирает KPI
 * и AI-инсайты выбранных разделов в единую сводную таблицу с экспортом
 * в CSV и JSON. Позволяет сохранять шаблон выбора в localStorage.
 */

import { useCallback, useEffect, useState } from "react";
import { describeApiError } from "@/lib/api-error";
import { fmtNumber } from "@/lib/admin-data";

const SECTIONS = [
  { key: "overview", title: "Общая аналитика", icon: "🏛️" },
  { key: "sales", title: "Продажи", icon: "💼" },
  { key: "orders", title: "Заказы", icon: "📦" },
  { key: "bookings", title: "Бронирования", icon: "📑" },
  { key: "finance", title: "Финансы", icon: "💰" },
  { key: "crm", title: "Клиенты (CRM)", icon: "👥" },
  { key: "partners", title: "Партнёры", icon: "🤝" },
  { key: "catalog", title: "Каталог услуг", icon: "🗂️" },
  { key: "marketing", title: "Маркетинг", icon: "📣" },
  { key: "departments", title: "Подразделения", icon: "🏢" },
];

const PERIODS = [
  { key: "today", label: "Сегодня" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "quarter", label: "Квартал" },
  { key: "year", label: "Год" },
];

interface ReportRow {
  section: string;
  icon: string;
  kpis: { title: string; value: number; unit?: string; change?: number }[];
  aiTitles: string[];
  errors?: string;
}

export default function ReportBuilder() {
  const [selected, setSelected] = useState<string[]>(["overview", "sales", "orders", "finance"]);
  const [period, setPeriod] = useState("month");
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTemplate, setSavedTemplate] = useState(false);

  // Восстановление сохранённого шаблона выбора
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem("bi-report-template");
        if (raw) {
          const t = JSON.parse(raw) as { selected?: string[]; period?: string };
          if (t.selected?.length) setSelected(t.selected);
          if (t.period) setPeriod(t.period);
        }
      } catch {
        /* ignore */
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggle = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const saveTemplate = () => {
    try {
      localStorage.setItem("bi-report-template", JSON.stringify({ selected, period }));
      setSavedTemplate(true);
      setTimeout(() => setSavedTemplate(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const build = useCallback(async () => {
    if (!selected.length) {
      setError("Выберите хотя бы один раздел");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        selected.map(async (key) => {
          const res = await fetch(`/api/admin/analytics/${key}?period=${period}`, { credentials: "include" });
          if (!res.ok) {
            const msg = await describeApiError(res, "Ошибка загрузки раздела");
            return { section: key, icon: "❌", kpis: [], aiTitles: [], errors: msg } as ReportRow;
          }
          const d = (await res.json()) as {
            title: string;
            kpis: { title: string; value: number; unit?: string; change?: number }[];
            ai: { title: string }[];
          };
          const meta = SECTIONS.find((s) => s.key === key);
          return {
            section: d.title,
            icon: meta?.icon ?? "📊",
            kpis: d.kpis.slice(0, 6),
            aiTitles: d.ai.slice(0, 4).map((a) => a.title),
          } as ReportRow;
        })
      );
      setRows(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  }, [selected, period]);

  // ── Экспорт в CSV ──
  const exportCsv = () => {
    if (!rows) return;
    const header = ["Раздел", ...Array.from(new Set(rows.flatMap((r) => r.kpis.map((k) => k.title)))), "AI-инсайты"];
    const lines = rows.map((r) => {
      const titles = header.slice(1, -1);
      const cells = titles.map((t) => {
        const k = r.kpis.find((kk) => kk.title === t);
        return k ? (k.unit === "%" ? `${k.value.toFixed(1)}%` : fmtNumber(k.value)) : "";
      });
      return [r.section, ...cells, r.aiTitles.join("; ")].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";");
    });
    const csv = "\uFEFF" + [header.join(";"), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportJson = () => {
    if (!rows) return;
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5">
      {/* Конфигуратор скрыт в печатной версии — печатаются только карточки отчёта */}
      <div className="no-print bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div>
            <h2 className="font-semibold text-sm">🧾 Конструктор отчётов</h2>
            <p className="text-[11px] text-[var(--admin-muted)] mt-0.5">
              Выберите разделы и период — получите сводный отчёт с экспортом в CSV/JSON (Гл. 2.3, 2.6)
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveTemplate}
              className="px-3 h-9 rounded-xl bg-[var(--admin-card)] border border-[var(--admin-border)] text-xs font-medium hover:border-primary transition-colors"
            >
              {savedTemplate ? "✓ Шаблон сохранён" : "💾 Сохранить шаблон"}
            </button>
            <button
              onClick={() => void build()}
              disabled={loading}
              className="px-4 h-9 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              {loading ? "Собираю…" : "📊 Сформировать отчёт"}
            </button>
          </div>
        </div>

        {/* Период */}
        <div className="flex items-center gap-1 flex-wrap mb-3">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 h-8 rounded-lg text-xs font-medium transition-colors ${
                period === p.key ? "bg-secondary text-white" : "text-[var(--admin-muted)] hover:bg-[var(--admin-bg)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Выбор разделов */}
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => toggle(s.key)}
              className={`px-3 h-8 rounded-xl text-xs font-medium transition-all border ${
                selected.includes(s.key)
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "bg-[var(--admin-bg)] border-[var(--admin-border)] text-[var(--admin-muted)] hover:border-primary/40"
              }`}
            >
              {s.icon} {s.title}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-2xl p-4 text-sm text-danger">{error}</div>
      )}

      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 bg-[var(--admin-border)]/40 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {rows && !loading && (
        <>
          {/* Печатный заголовок сводного отчёта (Гл. 2.6) */}
          <div className="print-only">
            <div className="text-xl font-bold">Сводный отчёт TravelHub</div>
            <div className="text-xs text-[var(--admin-muted)] mt-1">
              Разделы: {rows.map((r) => r.section).join(", ")} · Период:{" "}
              {PERIODS.find((p) => p.key === period)?.label} · Сформирован:{" "}
              {new Date().toLocaleString("ru-RU")}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-[var(--admin-muted)]">
              Отчёт по {rows.length} разделам · период: {PERIODS.find((p) => p.key === period)?.label}
            </div>
            <div className="no-print flex gap-2">
              <button
                onClick={exportCsv}
                className="px-3 h-8 rounded-lg bg-[var(--admin-card)] border border-[var(--admin-border)] text-xs font-medium hover:border-primary transition-colors"
              >
                ⬇ CSV
              </button>
              <button
                onClick={exportJson}
                className="px-3 h-8 rounded-lg bg-[var(--admin-card)] border border-[var(--admin-border)] text-xs font-medium hover:border-primary transition-colors"
              >
                ⬇ JSON
              </button>
              <button
                onClick={() => window.print()}
                title="Экспорт в PDF — печатная версия отчёта"
                className="px-3 h-8 rounded-lg bg-secondary text-white text-xs font-medium hover:bg-secondary/90 transition-colors"
              >
                🖨 Печать / PDF
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((r) => (
              <div key={r.section} className="bg-[var(--admin-card)] border border-[var(--admin-border)] rounded-2xl p-4">
                <h3 className="font-semibold text-sm mb-3">
                  {r.icon} {r.section}
                </h3>
                {r.errors ? (
                  <div className="text-xs text-danger">{r.errors}</div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {r.kpis.map((k) => (
                        <div key={k.title} className="bg-[var(--admin-bg)] rounded-xl p-2.5">
                          <div className="text-[10px] text-[var(--admin-muted)] truncate">{k.title}</div>
                          <div className="text-lg font-bold mt-0.5">
                            {k.unit === "%" ? `${k.value.toFixed(1)}%` : fmtNumber(k.value)}
                          </div>
                          {k.change !== undefined && (
                            <div className={`text-[10px] ${k.change >= 0 ? "text-success" : "text-danger"}`}>
                              {k.change >= 0 ? "▲" : "▼"} {Math.abs(k.change).toFixed(1)}%
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {r.aiTitles.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {r.aiTitles.map((t, i) => (
                          <div key={i} className="text-[11px] text-[var(--admin-muted)] flex items-start gap-1.5">
                            <span className="text-primary">🤖</span> {t}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
