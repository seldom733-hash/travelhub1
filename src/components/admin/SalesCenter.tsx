"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/** Sales Center (Phase 2, Baseline §0.7): Lead → Opportunity → Quote → Sale. */
export default function SalesCenter() {
  const [data, setData] = useState<{
    kpi: {
      newLeads: number;
      activeOpportunities: number;
      quotesPending: number;
      sales: number;
      conversion: number;
      avgCheck: number;
      forecast: number;
      overdueNextActions: number;
    };
    leads: LeadRow[];
    opportunities: OpportunityRow[];
    quotes: QuoteRow[];
    sales: SaleRow[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"leads" | "opportunities" | "quotes" | "sales">("leads");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch("/api/admin/sales");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // setState в микротаске — синхронный вызов ловит react-hooks/set-state-in-effect
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      try {
        setBusy(true);
        const res = await fetch("/api/admin/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Ошибка");
        await load();
        return j;
      } catch (e) {
        alert(String((e as Error).message ?? e));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const actId = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      try {
        setBusy(true);
        const res = await fetch(`/api/admin/sales/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Ошибка");
        await load();
        return j;
      } catch (e) {
        alert(String((e as Error).message ?? e));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const filtered = useMemo(() => {
    if (!data) return { leads: [], opportunities: [], quotes: [], sales: [] };
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return {
      leads: data.leads.filter((l) => l.customerName.toLowerCase().includes(q) || l.code.toLowerCase().includes(q)),
      opportunities: data.opportunities.filter(
        (o) => o.customerName.toLowerCase().includes(q) || o.code.toLowerCase().includes(q)
      ),
      quotes: data.quotes.filter((c) => c.customerName.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)),
      sales: data.sales.filter((s) => s.customerName.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)),
    };
  }, [data, search]);

  const kpi = data?.kpi;

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-lg font-bold" style={{ color: "var(--admin-text)" }}>
            Sales Center
          </div>
          <div className="text-xs" style={{ color: "var(--admin-muted)" }}>
            Воронка: Lead → Opportunity → Quote → Sale → Order (Phase 2)
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по клиенту или коду…"
            className="h-9 px-3 rounded-xl text-xs outline-none w-56"
            style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "var(--admin-text)" }}
          />
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-500 p-3 rounded-xl" style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)" }}>
          {error}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
        <KpiCard label="Новые лиды" value={kpi?.newLeads ?? 0} icon="🎯" />
        <KpiCard label="Активные возможности" value={kpi?.activeOpportunities ?? 0} icon="💡" />
        <KpiCard label="Предложения в работе" value={kpi?.quotesPending ?? 0} icon="📄" />
        <KpiCard label="Сделки" value={kpi?.sales ?? 0} icon="🏆" />
        <KpiCard label="Конверсия" value={`${kpi?.conversion ?? 0}%`} icon="📈" />
        <KpiCard label="Средний чек" value={fmtMoney(kpi?.avgCheck ?? 0)} icon="🧾" />
        <KpiCard label="Прогноз (воронка)" value={fmtMoney(kpi?.forecast ?? 0)} icon="🔮" />
        <KpiCard label="Просроченные действия" value={kpi?.overdueNextActions ?? 0} icon="⏰" danger={(kpi?.overdueNextActions ?? 0) > 0} />
      </div>

      {/* Вкладки */}
      <div className="flex items-center gap-1 flex-wrap">
        {(
          [
            ["leads", `🎯 Лиды · ${data?.leads.length ?? 0}`],
            ["opportunities", `💡 Возможности · ${data?.opportunities.length ?? 0}`],
            ["quotes", `📄 Предложения · ${data?.quotes.length ?? 0}`],
            ["sales", `🏆 Сделки · ${data?.sales.length ?? 0}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-3.5 h-9 rounded-xl text-xs font-semibold transition-all"
            style={
              tab === key
                ? { background: "#f97316", color: "#fff" }
                : { background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Содержимое */}
      {loading && !data ? (
        <div className="text-center text-xs py-16" style={{ color: "var(--admin-muted)" }}>
          Загрузка…
        </div>
      ) : (
        <>
          {tab === "leads" && <LeadsTable leads={filtered.leads} onAction={actId} busy={busy} onCreate={() => promptLead(act)} />}
          {tab === "opportunities" && <OpportunitiesTable opps={filtered.opportunities} onAction={actId} busy={busy} onCreate={() => promptOpportunity(act)} />}
          {tab === "quotes" && <QuotesTable quotes={filtered.quotes} onAction={actId} busy={busy} onCreate={async () => promptQuote(act, filtered.opportunities)} />}
          {tab === "sales" && <SalesTable sales={filtered.sales} onAction={actId} busy={busy} />}
        </>
      )}
    </div>
  );
}

/* ── Типы ── */

interface LeadRow {
  id: string; code: string; source: string; customerName: string; contactEmail: string | null;
  contactPhone: string | null; interest: string | null; ownerName: string | null;
  qualification: string; status: string; nextAction: string | null; nextActionAt: string | null;
  slaDueAt: string | null; createdAt: string;
}
interface OpportunityRow {
  id: string; code: string; customerName: string; ownerName: string | null; need: string | null;
  budget: number | null; currency: string; expectedCloseDate: string | null; probability: number;
  stage: string; nextAction: string | null; nextActionAt: string | null; risks: string | null; updatedAt: string;
}
interface QuoteRow {
  id: string; code: string; opportunityId: string; customerName: string; currency: string; version: number;
  discount: number; fees: number; validUntil: string | null; status: string; approval: string;
  approvedBy: string | null; acceptedAt: string | null; createdAt: string; updatedAt: string;
}
interface SaleRow {
  id: string; code: string; quoteId: string; customerName: string; amount: number; currency: string;
  status: string; closedAt: string | null; orderId: string | null; createdAt: string;
}

/* ── UI-хелперы ── */

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " $";

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) : "—");

function KpiCard({ label, value, icon, danger }: { label: string; value: string | number; icon: string; danger?: boolean }) {
  return (
    <div
      className="rounded-2xl p-3 transition-all hover:-translate-y-0.5"
      style={{ background: "var(--admin-bg)", border: danger ? "1px solid rgba(239,68,68,.4)" : "1px solid var(--admin-border)" }}
    >
      <div className="text-base">{icon}</div>
      <div className="text-lg font-bold mt-1" style={{ color: danger ? "#ef4444" : "var(--admin-text)" }}>
        {value}
      </div>
      <div className="text-[10px] mt-0.5" style={{ color: "var(--admin-muted)" }}>
        {label}
      </div>
    </div>
  );
}

function Badge({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
      style={{ color, background: bg }}
    >
      {text}
    </span>
  );
}

const LEAD_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  NEW: { label: "Новый", color: "#3b82f6", bg: "rgba(59,130,246,.12)" },
  QUALIFIED: { label: "Квалифицирован", color: "#8b5cf6", bg: "rgba(139,92,246,.12)" },
  CONVERTED: { label: "Конвертирован", color: "#22c55e", bg: "rgba(34,197,94,.12)" },
  DISQUALIFIED: { label: "Отклонён", color: "#f43f5e", bg: "rgba(244,63,94,.12)" },
};

const OPP_STAGE: Record<string, { label: string; color: string }> = {
  QUALIFICATION: { label: "Квалификация", color: "#3b82f6" },
  NEED_ANALYSIS: { label: "Анализ потребности", color: "#8b5cf6" },
  QUOTE: { label: "Предложение", color: "#f59e0b" },
  NEGOTIATION: { label: "Переговоры", color: "#f97316" },
  WON: { label: "Выиграна", color: "#22c55e" },
  LOST: { label: "Проиграна", color: "#f43f5e" },
};

const QUOTE_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Черновик", color: "#94a3b8" },
  SENT: { label: "Отправлено", color: "#3b82f6" },
  ACCEPTED: { label: "Принято", color: "#22c55e" },
  REJECTED: { label: "Отклонено", color: "#f43f5e" },
};

/* ── Lead ── */

function LeadsTable({
  leads,
  onAction,
  busy,
  onCreate,
}: {
  leads: LeadRow[];
  onAction: (id: string, body: Record<string, unknown>) => Promise<unknown>;
  busy: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-xs font-semibold" style={{ color: "var(--admin-text)" }}>
          Реестр лидов
        </div>
        <button
          onClick={onCreate}
          className="px-3 h-8 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
          style={{ background: "#f97316", color: "#fff" }}
        >
          + Новый лид
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr style={{ color: "var(--admin-muted)", borderBottom: "1px solid var(--admin-border)" }}>
              <th className="px-4 py-2 font-medium">Лид</th>
              <th className="px-4 py-2 font-medium">Контакты</th>
              <th className="px-4 py-2 font-medium">Интерес</th>
              <th className="px-4 py-2 font-medium">Квалификация</th>
              <th className="px-4 py-2 font-medium">Статус</th>
              <th className="px-4 py-2 font-medium">Следующее действие</th>
              <th className="px-4 py-2 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center" style={{ color: "var(--admin-muted)" }}>
                  Лидов нет
                </td>
              </tr>
            )}
            {leads.map((l) => {
              const st = LEAD_STATUS[l.status] ?? { label: l.status, color: "#94a3b8", bg: "rgba(148,163,184,.12)" };
              return (
                <tr key={l.id} className="border-t transition-colors hover:bg-white/40" style={{ borderColor: "var(--admin-border)" }}>
                  <td className="px-4 py-3">
                    <div className="font-semibold" style={{ color: "var(--admin-text)" }}>
                      {l.customerName}
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--admin-muted)" }}>
                      {l.code} · {l.source} · {l.ownerName ?? "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--admin-muted)" }}>
                    <div>{l.contactEmail ?? "—"}</div>
                    <div className="text-[10px]">{l.contactPhone ?? ""}</div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--admin-text)" }}>
                    {l.interest ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      text={l.qualification === "hot" ? "Горячий" : l.qualification === "warm" ? "Тёплый" : "Холодный"}
                      color={l.qualification === "hot" ? "#ef4444" : l.qualification === "warm" ? "#f59e0b" : "#64748b"}
                      bg={l.qualification === "hot" ? "rgba(239,68,68,.12)" : l.qualification === "warm" ? "rgba(245,158,11,.12)" : "rgba(100,116,139,.12)"}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Badge text={st.label} color={st.color} bg={st.bg} />
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--admin-muted)" }}>
                    <div>{l.nextAction ?? "—"}</div>
                    <div className="text-[10px]">{l.nextActionAt ? fmtDate(l.nextActionAt) : ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {l.status === "NEW" && (
                        <button
                          disabled={busy}
                          onClick={() => onAction(l.id, { entity: "lead", action: "qualify" })}
                          className="px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                          style={{ background: "rgba(139,92,246,.15)", color: "#8b5cf6" }}
                        >
                          Квалифицировать
                        </button>
                      )}
                      {l.status === "NEW" && (
                        <button
                          disabled={busy}
                          onClick={() => onAction(l.id, { entity: "lead", action: "disqualify" })}
                          className="px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                          style={{ background: "rgba(244,63,94,.12)", color: "#f43f5e" }}
                        >
                          Отклонить
                        </button>
                      )}
                      {l.status === "QUALIFIED" && (
                        <button
                          disabled={busy}
                          onClick={() => onAction(l.id, { entity: "lead", action: "convert" })}
                          className="px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                          style={{ background: "rgba(34,197,94,.12)", color: "#22c55e" }}
                        >
                          Конвертировать
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Opportunity ── */

function OpportunitiesTable({
  opps,
  onAction,
  busy,
  onCreate,
}: {
  opps: OpportunityRow[];
  onAction: (id: string, body: Record<string, unknown>) => Promise<unknown>;
  busy: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-xs font-semibold" style={{ color: "var(--admin-text)" }}>
          Реестр возможностей
        </div>
        <button
          onClick={onCreate}
          className="px-3 h-8 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
          style={{ background: "#f97316", color: "#fff" }}
        >
          + Возможность
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr style={{ color: "var(--admin-muted)", borderBottom: "1px solid var(--admin-border)" }}>
              <th className="px-4 py-2 font-medium">Возможность</th>
              <th className="px-4 py-2 font-medium">Стадия</th>
              <th className="px-4 py-2 font-medium">Бюджет</th>
              <th className="px-4 py-2 font-medium">Вероятность</th>
              <th className="px-4 py-2 font-medium">Закрытие</th>
              <th className="px-4 py-2 font-medium">Следующее действие</th>
              <th className="px-4 py-2 font-medium">Переход</th>
            </tr>
          </thead>
          <tbody>
            {opps.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center" style={{ color: "var(--admin-muted)" }}>
                  Возможностей нет
                </td>
              </tr>
            )}
            {opps.map((o) => {
              const st = OPP_STAGE[o.stage] ?? { label: o.stage, color: "#94a3b8" };
              const next = STAGE_NEXT[o.stage];
              return (
                <tr key={o.id} className="border-t transition-colors hover:bg-white/40" style={{ borderColor: "var(--admin-border)" }}>
                  <td className="px-4 py-3">
                    <div className="font-semibold" style={{ color: "var(--admin-text)" }}>
                      {o.customerName}
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--admin-muted)" }}>
                      {o.code} · {o.ownerName ?? "—"} {o.need ? `· ${o.need}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge text={st.label} color={st.color} bg={`${st.color}1f`} />
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--admin-text)" }}>
                    {o.budget ? `${fmtMoney(o.budget)} ${o.currency}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-14 h-1.5 rounded-full" style={{ background: "var(--admin-border)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${o.probability}%`, background: o.probability >= 70 ? "#22c55e" : o.probability >= 40 ? "#f59e0b" : "#f43f5e" }}
                        />
                      </div>
                      <span className="text-[10px]" style={{ color: "var(--admin-muted)" }}>
                        {o.probability}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--admin-muted)" }}>
                    {fmtDate(o.expectedCloseDate)}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--admin-muted)" }}>
                    <div>{o.nextAction ?? "—"}</div>
                    <div className="text-[10px]">{o.nextActionAt ? fmtDate(o.nextActionAt) : ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {next && (
                        <button
                          disabled={busy}
                          onClick={() => onAction(o.id, { entity: "opportunity", action: "stage", to: next })}
                          className="px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                          style={{ background: "rgba(59,130,246,.12)", color: "#3b82f6" }}
                        >
                          → {STAGE_NEXT_LABEL[next]}
                        </button>
                      )}
                      {o.stage === "NEGOTIATION" && (
                        <button
                          disabled={busy}
                          onClick={() => onAction(o.id, { entity: "opportunity", action: "stage", to: "WON", probability: 100 })}
                          className="px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                          style={{ background: "rgba(34,197,94,.12)", color: "#22c55e" }}
                        >
                          Выиграна
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const STAGE_NEXT: Record<string, string> = {
  QUALIFICATION: "NEED_ANALYSIS",
  NEED_ANALYSIS: "QUOTE",
  QUOTE: "NEGOTIATION",
};
const STAGE_NEXT_LABEL: Record<string, string> = {
  NEED_ANALYSIS: "Анализ",
  QUOTE: "Предложение",
  NEGOTIATION: "Переговоры",
};

/* ── Quote ── */

function QuotesTable({
  quotes,
  onAction,
  busy,
  onCreate,
}: {
  quotes: QuoteRow[];
  onAction: (id: string, body: Record<string, unknown>) => Promise<unknown>;
  busy: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-xs font-semibold" style={{ color: "var(--admin-text)" }}>
          Коммерческие предложения (версионируемые)
        </div>
        <button
          onClick={onCreate}
          className="px-3 h-8 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
          style={{ background: "#f97316", color: "#fff" }}
        >
          + Предложение
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr style={{ color: "var(--admin-muted)", borderBottom: "1px solid var(--admin-border)" }}>
              <th className="px-4 py-2 font-medium">Предложение</th>
              <th className="px-4 py-2 font-medium">Статус</th>
              <th className="px-4 py-2 font-medium">Версия</th>
              <th className="px-4 py-2 font-medium">Согласование</th>
              <th className="px-4 py-2 font-medium">Действует до</th>
              <th className="px-4 py-2 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center" style={{ color: "var(--admin-muted)" }}>
                  Предложений нет
                </td>
              </tr>
            )}
            {quotes.map((q) => {
              const st = QUOTE_STATUS[q.status] ?? { label: q.status, color: "#94a3b8" };
              return (
                <tr key={q.id} className="border-t transition-colors hover:bg-white/40" style={{ borderColor: "var(--admin-border)" }}>
                  <td className="px-4 py-3">
                    <div className="font-semibold" style={{ color: "var(--admin-text)" }}>
                      {q.customerName}
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--admin-muted)" }}>
                      {q.code} · в.{q.version}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge text={st.label} color={st.color} bg={`${st.color}1f`} />
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--admin-text)" }}>
                    v{q.version}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--admin-muted)" }}>
                    {q.approval === "approved" ? `✓ ${q.approvedBy ?? ""}`.trim() : q.approval === "rejected" ? "Отклонено" : "На согласовании"}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--admin-muted)" }}>
                    {fmtDate(q.validUntil)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {q.status === "DRAFT" && (
                        <button
                          disabled={busy}
                          onClick={() => onAction(q.id, { entity: "quote", action: "send" })}
                          className="px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                          style={{ background: "rgba(59,130,246,.12)", color: "#3b82f6" }}
                        >
                          Отправить
                        </button>
                      )}
                      {q.status === "SENT" && (
                        <>
                          <button
                            disabled={busy}
                            onClick={() => onAction(q.id, { entity: "quote", action: "accept" })}
                            className="px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                            style={{ background: "rgba(34,197,94,.12)", color: "#22c55e" }}
                          >
                            Принять → сделка
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => onAction(q.id, { entity: "quote", action: "reject" })}
                            className="px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                            style={{ background: "rgba(244,63,94,.12)", color: "#f43f5e" }}
                          >
                            Отклонить
                          </button>
                        </>
                      )}
                      {(q.status === "DRAFT" || q.status === "REJECTED") && (
                        <button
                          disabled={busy}
                          onClick={() => onAction(q.id, { entity: "quote", action: "version" })}
                          className="px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                          style={{ background: "rgba(139,92,246,.12)", color: "#8b5cf6" }}
                        >
                          + Версия
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Sale ── */

function SalesTable({
  sales,
  onAction,
  busy,
}: {
  sales: SaleRow[];
  onAction: (id: string, body: Record<string, unknown>) => Promise<unknown>;
  busy: boolean;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
      <div className="px-4 py-3 text-xs font-semibold" style={{ color: "var(--admin-text)" }}>
        Реестр сделок
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr style={{ color: "var(--admin-muted)", borderBottom: "1px solid var(--admin-border)" }}>
              <th className="px-4 py-2 font-medium">Сделка</th>
              <th className="px-4 py-2 font-medium">Сумма</th>
              <th className="px-4 py-2 font-medium">Дата закрытия</th>
              <th className="px-4 py-2 font-medium">Заказ</th>
              <th className="px-4 py-2 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center" style={{ color: "var(--admin-muted)" }}>
                  Сделок нет
                </td>
              </tr>
            )}
            {sales.map((s) => (
              <tr key={s.id} className="border-t transition-colors hover:bg-white/40" style={{ borderColor: "var(--admin-border)" }}>
                <td className="px-4 py-3">
                  <div className="font-semibold" style={{ color: "var(--admin-text)" }}>
                    {s.customerName}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--admin-muted)" }}>
                    {s.code}
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold" style={{ color: "var(--admin-text)" }}>
                  {fmtMoney(s.amount)} {s.currency}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--admin-muted)" }}>
                  {fmtDate(s.closedAt)}
                </td>
                <td className="px-4 py-3">
                  {s.orderId ? (
                    <a
                      href={`/admin/sales-execution?open=${s.orderId}&tab=overview`}
                      className="px-2.5 h-7 rounded-lg inline-flex items-center text-[11px] font-semibold transition-all hover:opacity-80"
                      style={{ background: "rgba(34,197,94,.12)", color: "#22c55e" }}
                    >
                      Открыть заказ ↗
                    </a>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => onAction(s.id, { entity: "sale", action: "complete" })}
                      className="px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                      style={{ background: "#f97316", color: "#fff" }}
                    >
                      Завершить → OrderRequested
                    </button>
                  )}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--admin-muted)" }}>
                  {s.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Создание ── */

async function promptLead(act: (body: Record<string, unknown>) => Promise<unknown>) {
  const name = prompt("Имя клиента:");
  if (!name) return;
  const interest = prompt("Интерес (услуги/направление):", "Тур в Турцию") ?? "";
  const qualification = prompt("Квалификация (cold/warm/hot):", "warm") || "cold";
  await act({
    entity: "lead",
    customerName: name,
    interest: interest || null,
    qualification: ["cold", "warm", "hot"].includes(qualification) ? qualification : "cold",
    source: "Sales Center",
  });
}

async function promptOpportunity(act: (body: Record<string, unknown>) => Promise<unknown>) {
  const name = prompt("Имя клиента:");
  if (!name) return;
  const budget = prompt("Бюджет ($):", "2000");
  const need = prompt("Потребность:", "") ?? "";
  await act({
    entity: "opportunity",
    customerName: name,
    budget: budget ? Number(budget) : null,
    need: need || null,
  });
}

async function promptQuote(act: (body: Record<string, unknown>) => Promise<unknown>, opps: OpportunityRow[]) {
  const open = opps.filter((o) => !["WON", "LOST"].includes(o.stage));
  if (open.length === 0) {
    alert("Сначала создайте возможность");
    return;
  }
  const list = open.map((o, i) => `${i + 1}. ${o.customerName} (${o.code})`).join("\n");
  const pick = prompt(`Выберите возможность:\n${list}`);
  if (!pick) return;
  const idx = parseInt(pick, 10) - 1;
  const opp = open[idx];
  if (!opp) return;
  const svcRaw = prompt("ServiceId (PRD-код или id):");
  if (!svcRaw) return;
  // Ищем услугу по коду или id
  const r = await fetch(`/api/admin/catalog?search=${encodeURIComponent(svcRaw)}&limit=1`);
  const j = await r.json();
  const svc = j?.services?.[0];
  if (!svc) {
    alert("Услуга не найдена");
    return;
  }
  await act({
    entity: "quote",
    opportunityId: opp.id,
    items: [{ serviceId: svc.id, quantity: 1 }],
  });
}
