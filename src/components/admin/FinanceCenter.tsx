"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/** Finance Center (Phase 2, Baseline §0.6): владелец финансовых сущностей. */
export default function FinanceCenter() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"payments" | "refunds" | "invoices" | "commissions" | "masters">("payments");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch("/api/admin/finance");
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
        const res = await fetch("/api/admin/finance", {
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
        const res = await fetch(`/api/admin/finance/${id}`, {
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

  const kpi = data?.kpi;

  const filtered = useMemo(() => {
    if (!data) return data;
    const q = search.trim().toLowerCase();
    if (!q) return data;
    const match = (code: string, num: string | null) =>
      code.toLowerCase().includes(q) || (num ?? "").toLowerCase().includes(q);
    return {
      ...data,
      payments: data.payments.filter((p) => match(p.code, p.orderNumber)),
      refunds: data.refunds.filter((r) => match(r.code, r.orderNumber)),
      invoices: data.invoices.filter((i) => match(i.code, i.orderNumber)),
      commissions: data.commissions.filter((c) => match(c.code, c.orderNumber)),
    };
  }, [data, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-lg font-bold" style={{ color: "var(--admin-text)" }}>
            Finance Center
          </div>
          <div className="text-xs" style={{ color: "var(--admin-muted)" }}>
            Платежи · возвраты · счета · комиссии · валюты/курсы/налоги (владелец — Finance, Phase 2)
          </div>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по коду или заказу…"
          className="h-9 px-3 rounded-xl text-xs outline-none w-56"
          style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "var(--admin-text)" }}
        />
      </div>

      {error && (
        <div className="text-xs text-red-500 p-3 rounded-xl" style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)" }}>
          {error}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
        <KpiCard label="Получено" value={fmtMoney(kpi?.totalReceived ?? 0)} icon="💳" />
        <KpiCard label="Возвращено" value={fmtMoney(kpi?.totalRefunded ?? 0)} icon="↩️" />
        <KpiCard label="Нетто" value={fmtMoney(kpi?.net ?? 0)} icon="💰" />
        <KpiCard label="Ожидают оплаты" value={kpi?.pendingPayments ?? 0} icon="⏳" />
        <KpiCard label="Запрошено возвратов" value={kpi?.pendingRefunds ?? 0} icon="📤" />
        <KpiCard label="Комиссии (всего)" value={fmtMoney(kpi?.totalCommissions ?? 0)} icon="🤝" />
        <KpiCard label="Невыплаченные комиссии" value={fmtMoney(kpi?.unpaidCommissions ?? 0)} icon="🧾" />
        <KpiCard label="Выставлено счетов" value={kpi?.invoicesIssued ?? 0} icon="📑" />
      </div>

      {/* Вкладки */}
      <div className="flex items-center gap-1 flex-wrap">
        {(
          [
            ["payments", `💳 Платежи · ${data?.payments.length ?? 0}`],
            ["refunds", `↩️ Возвраты · ${data?.refunds.length ?? 0}`],
            ["invoices", `📑 Счета · ${data?.invoices.length ?? 0}`],
            ["commissions", `🤝 Комиссии · ${data?.commissions.length ?? 0}`],
            ["masters", "🌐 Валюты/курсы/налоги"],
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

      {loading && !data ? (
        <div className="text-center text-xs py-16" style={{ color: "var(--admin-muted)" }}>
          Загрузка…
        </div>
      ) : (
        <>
          {tab === "payments" && <PaymentsTable rows={filtered?.payments ?? []} onAction={actId} onCreate={() => promptPayment(act)} busy={busy} />}
          {tab === "refunds" && <RefundsTable rows={filtered?.refunds ?? []} onAction={actId} onCreate={() => promptRefund(act)} busy={busy} />}
          {tab === "invoices" && <InvoicesTable rows={filtered?.invoices ?? []} onAction={actId} onCreate={() => promptInvoice(act)} busy={busy} />}
          {tab === "commissions" && <CommissionsTable rows={filtered?.commissions ?? []} onAction={actId} onCreate={() => promptCommission(act)} busy={busy} />}
          {tab === "masters" && (
            <MastersPanel data={data!} onCreate={async (entity, body) => act({ entity, ...body })} busy={busy} />
          )}
        </>
      )}
    </div>
  );
}

/* ── Типы ── */

interface PaymentRow {
  id: string; code: string; orderId: string | null; orderNumber: string | null; amount: number;
  currency: string; method: string; status: string; receivedAt: string | null; createdAt: string;
}
interface RefundRow {
  id: string; code: string; orderId: string | null; orderNumber: string | null; amount: number;
  currency: string; reason: string | null; status: string; completedAt: string | null; createdAt: string;
}
interface InvoiceRow {
  id: string; code: string; orderId: string | null; orderNumber: string | null; amount: number;
  currency: string; status: string; issuedAt: string | null; dueAt: string | null; createdAt: string;
}
interface CommissionRow {
  id: string; code: string; orderId: string | null; orderNumber: string | null; amount: number;
  currency: string; rate: number; status: string; paidAt: string | null; createdAt: string;
}
interface CurrencyRow { id: string; code: string; name: string; symbol: string; isBase: boolean; isActive: boolean }
interface RateRow { id: string; code: string; fromCode: string; toCode: string; rate: number; date: string }
interface TaxRow { id: string; code: string; name: string; rate: number; isActive: boolean }
interface TaxRuleRow { id: string; code: string; taxId: string; country: string | null; serviceType: string | null; isActive: boolean }

interface FinanceData {
  kpi: {
    totalReceived: number; totalRefunded: number; net: number; pendingPayments: number;
    pendingRefunds: number; totalCommissions: number; unpaidCommissions: number;
    invoicesIssued: number; currenciesCount: number;
  };
  payments: PaymentRow[];
  refunds: RefundRow[];
  invoices: InvoiceRow[];
  commissions: CommissionRow[];
  currencies: CurrencyRow[];
  rates: RateRow[];
  taxes: TaxRow[];
  taxRules: (TaxRuleRow & { tax: { name: string; rate: number } })[];
}

/* ── UI-хелперы ── */

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " $";

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) : "—");

function KpiCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div
      className="rounded-2xl p-3 transition-all hover:-translate-y-0.5"
      style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}
    >
      <div className="text-base">{icon}</div>
      <div className="text-lg font-bold mt-1" style={{ color: "var(--admin-text)" }}>
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

const PAY_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  CREATED: { label: "Создан", color: "#3b82f6", bg: "rgba(59,130,246,.12)" },
  RECEIVED: { label: "Получен", color: "#22c55e", bg: "rgba(34,197,94,.12)" },
  FAILED: { label: "Не прошёл", color: "#ef4444", bg: "rgba(239,68,68,.12)" },
};
const REFUND_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  REQUESTED: { label: "Запрошен", color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
  COMPLETED: { label: "Выполнен", color: "#22c55e", bg: "rgba(34,197,94,.12)" },
  FAILED: { label: "Ошибка", color: "#ef4444", bg: "rgba(239,68,68,.12)" },
};
const INV_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: "Черновик", color: "#94a3b8", bg: "rgba(148,163,184,.12)" },
  ISSUED: { label: "Выставлен", color: "#3b82f6", bg: "rgba(59,130,246,.12)" },
  PAID: { label: "Оплачен", color: "#22c55e", bg: "rgba(34,197,94,.12)" },
  VOID: { label: "Аннулирован", color: "#6b7280", bg: "rgba(107,114,128,.12)" },
};
const CMS_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Ожидает выплаты", color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
  PAID: { label: "Выплачена", color: "#22c55e", bg: "rgba(34,197,94,.12)" },
};

/* ── Таблицы ── */

function PaymentsTable({
  rows,
  onAction,
  onCreate,
  busy,
}: {
  rows: PaymentRow[];
  onAction: (id: string, body: Record<string, unknown>) => Promise<unknown>;
  onCreate: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-xs font-semibold" style={{ color: "var(--admin-text)" }}>
          Очередь платежей
        </div>
        <button
          onClick={onCreate}
          className="px-3 h-8 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
          style={{ background: "#f97316", color: "#fff" }}
        >
          + Платёж
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr style={{ color: "var(--admin-muted)", borderBottom: "1px solid var(--admin-border)" }}>
              <th className="px-4 py-2 font-medium">Платёж</th>
              <th className="px-4 py-2 font-medium">Заказ</th>
              <th className="px-4 py-2 font-medium">Сумма</th>
              <th className="px-4 py-2 font-medium">Способ</th>
              <th className="px-4 py-2 font-medium">Статус</th>
              <th className="px-4 py-2 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center" style={{ color: "var(--admin-muted)" }}>
                  Платежей нет
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const st = PAY_STATUS[p.status] ?? { label: p.status, color: "#94a3b8", bg: "rgba(148,163,184,.12)" };
              return (
                <tr key={p.id} className="border-t transition-colors hover:bg-white/40" style={{ borderColor: "var(--admin-border)" }}>
                  <td className="px-4 py-3">
                    <div className="font-semibold" style={{ color: "var(--admin-text)" }}>
                      {p.code}
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--admin-muted)" }}>
                      {fmtDate(p.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--admin-muted)" }}>
                    {p.orderNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--admin-text)" }}>
                    {fmtMoney(p.amount)} {p.currency}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--admin-muted)" }}>
                    {p.method}
                  </td>
                  <td className="px-4 py-3">
                    <Badge text={st.label} color={st.color} bg={st.bg} />
                  </td>
                  <td className="px-4 py-3">
                    {p.status === "CREATED" && (
                      <div className="flex items-center gap-1">
                        <button
                          disabled={busy}
                          onClick={() => onAction(p.id, { entity: "payment", action: "receive" })}
                          className="px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                          style={{ background: "rgba(34,197,94,.12)", color: "#22c55e" }}
                        >
                          Получить
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => onAction(p.id, { entity: "payment", action: "fail" })}
                          className="px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                          style={{ background: "rgba(239,68,68,.12)", color: "#ef4444" }}
                        >
                          Не прошёл
                        </button>
                      </div>
                    )}
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

function RefundsTable({
  rows,
  onAction,
  onCreate,
  busy,
}: {
  rows: RefundRow[];
  onAction: (id: string, body: Record<string, unknown>) => Promise<unknown>;
  onCreate: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-xs font-semibold" style={{ color: "var(--admin-text)" }}>
          Возвраты
        </div>
        <button
          onClick={onCreate}
          className="px-3 h-8 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
          style={{ background: "#f97316", color: "#fff" }}
        >
          + Возврат
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr style={{ color: "var(--admin-muted)", borderBottom: "1px solid var(--admin-border)" }}>
              <th className="px-4 py-2 font-medium">Возврат</th>
              <th className="px-4 py-2 font-medium">Заказ</th>
              <th className="px-4 py-2 font-medium">Сумма</th>
              <th className="px-4 py-2 font-medium">Причина</th>
              <th className="px-4 py-2 font-medium">Статус</th>
              <th className="px-4 py-2 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center" style={{ color: "var(--admin-muted)" }}>
                  Возвратов нет
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const st = REFUND_STATUS[r.status] ?? { label: r.status, color: "#94a3b8", bg: "rgba(148,163,184,.12)" };
              return (
                <tr key={r.id} className="border-t transition-colors hover:bg-white/40" style={{ borderColor: "var(--admin-border)" }}>
                  <td className="px-4 py-3">
                    <div className="font-semibold" style={{ color: "var(--admin-text)" }}>
                      {r.code}
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--admin-muted)" }}>
                      {fmtDate(r.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--admin-muted)" }}>
                    {r.orderNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--admin-text)" }}>
                    {fmtMoney(r.amount)} {r.currency}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--admin-muted)" }}>
                    {r.reason ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge text={st.label} color={st.color} bg={st.bg} />
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "REQUESTED" && (
                      <div className="flex items-center gap-1">
                        <button
                          disabled={busy}
                          onClick={() => onAction(r.id, { entity: "refund", action: "complete" })}
                          className="px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                          style={{ background: "rgba(34,197,94,.12)", color: "#22c55e" }}
                        >
                          Выполнить
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => onAction(r.id, { entity: "refund", action: "fail" })}
                          className="px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                          style={{ background: "rgba(239,68,68,.12)", color: "#ef4444" }}
                        >
                          Ошибка
                        </button>
                      </div>
                    )}
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

function InvoicesTable({
  rows,
  onAction,
  onCreate,
  busy,
}: {
  rows: InvoiceRow[];
  onAction: (id: string, body: Record<string, unknown>) => Promise<unknown>;
  onCreate: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-xs font-semibold" style={{ color: "var(--admin-text)" }}>
          Счета
        </div>
        <button
          onClick={onCreate}
          className="px-3 h-8 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
          style={{ background: "#f97316", color: "#fff" }}
        >
          + Счёт
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr style={{ color: "var(--admin-muted)", borderBottom: "1px solid var(--admin-border)" }}>
              <th className="px-4 py-2 font-medium">Счёт</th>
              <th className="px-4 py-2 font-medium">Заказ</th>
              <th className="px-4 py-2 font-medium">Сумма</th>
              <th className="px-4 py-2 font-medium">Срок оплаты</th>
              <th className="px-4 py-2 font-medium">Статус</th>
              <th className="px-4 py-2 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center" style={{ color: "var(--admin-muted)" }}>
                  Счетов нет
                </td>
              </tr>
            )}
            {rows.map((inv) => {
              const st = INV_STATUS[inv.status] ?? { label: inv.status, color: "#94a3b8", bg: "rgba(148,163,184,.12)" };
              return (
                <tr key={inv.id} className="border-t transition-colors hover:bg-white/40" style={{ borderColor: "var(--admin-border)" }}>
                  <td className="px-4 py-3">
                    <div className="font-semibold" style={{ color: "var(--admin-text)" }}>
                      {inv.code}
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--admin-muted)" }}>
                      {fmtDate(inv.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--admin-muted)" }}>
                    {inv.orderNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--admin-text)" }}>
                    {fmtMoney(inv.amount)} {inv.currency}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--admin-muted)" }}>
                    {fmtDate(inv.dueAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge text={st.label} color={st.color} bg={st.bg} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {inv.status === "DRAFT" && (
                        <button
                          disabled={busy}
                          onClick={() => onAction(inv.id, { entity: "invoice", action: "issue" })}
                          className="px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                          style={{ background: "rgba(59,130,246,.12)", color: "#3b82f6" }}
                        >
                          Выставить
                        </button>
                      )}
                      {inv.status === "ISSUED" && (
                        <button
                          disabled={busy}
                          onClick={() => onAction(inv.id, { entity: "invoice", action: "pay" })}
                          className="px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                          style={{ background: "rgba(34,197,94,.12)", color: "#22c55e" }}
                        >
                          Оплачен
                        </button>
                      )}
                      {(inv.status === "DRAFT" || inv.status === "ISSUED") && (
                        <button
                          disabled={busy}
                          onClick={() => onAction(inv.id, { entity: "invoice", action: "void" })}
                          className="px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                          style={{ background: "rgba(107,114,128,.12)", color: "#6b7280" }}
                        >
                          Аннулировать
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

function CommissionsTable({
  rows,
  onAction,
  onCreate,
  busy,
}: {
  rows: CommissionRow[];
  onAction: (id: string, body: Record<string, unknown>) => Promise<unknown>;
  onCreate: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-xs font-semibold" style={{ color: "var(--admin-text)" }}>
          Комиссии партнёров
        </div>
        <button
          onClick={onCreate}
          className="px-3 h-8 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
          style={{ background: "#f97316", color: "#fff" }}
        >
          + Комиссия
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr style={{ color: "var(--admin-muted)", borderBottom: "1px solid var(--admin-border)" }}>
              <th className="px-4 py-2 font-medium">Комиссия</th>
              <th className="px-4 py-2 font-medium">Заказ</th>
              <th className="px-4 py-2 font-medium">Сумма</th>
              <th className="px-4 py-2 font-medium">Ставка</th>
              <th className="px-4 py-2 font-medium">Статус</th>
              <th className="px-4 py-2 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center" style={{ color: "var(--admin-muted)" }}>
                  Комиссий нет
                </td>
              </tr>
            )}
            {rows.map((c) => {
              const st = CMS_STATUS[c.status] ?? { label: c.status, color: "#94a3b8", bg: "rgba(148,163,184,.12)" };
              return (
                <tr key={c.id} className="border-t transition-colors hover:bg-white/40" style={{ borderColor: "var(--admin-border)" }}>
                  <td className="px-4 py-3">
                    <div className="font-semibold" style={{ color: "var(--admin-text)" }}>
                      {c.code}
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--admin-muted)" }}>
                      {fmtDate(c.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--admin-muted)" }}>
                    {c.orderNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--admin-text)" }}>
                    {fmtMoney(c.amount)} {c.currency}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--admin-muted)" }}>
                    {c.rate ? `${Math.round(c.rate * 100)}%` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge text={st.label} color={st.color} bg={st.bg} />
                  </td>
                  <td className="px-4 py-3">
                    {c.status === "PENDING" && (
                      <button
                        disabled={busy}
                        onClick={() => onAction(c.id, { entity: "commission", action: "pay" })}
                        className="px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                        style={{ background: "rgba(34,197,94,.12)", color: "#22c55e" }}
                      >
                        Выплатить
                      </button>
                    )}
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

/* ── Справочники (Currency/Tax — владеет только Finance) ── */

function MastersPanel({
  data,
  onCreate,
  busy,
}: {
  data: FinanceData;
  onCreate: (entity: string, body: Record<string, unknown>) => Promise<unknown>;
  busy: boolean;
}) {
  return (
    <div className="grid md:grid-cols-3 gap-3">
      {/* Валюты */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-xs font-semibold" style={{ color: "var(--admin-text)" }}>
            🌐 Валюты ({data.currencies.length})
          </div>
          <button
            disabled={busy}
            onClick={() => {
              const code = prompt("Код валюты (USD, EUR…):");
              if (!code) return;
              const name = prompt("Название:", code) ?? code;
              onCreate("currency", { code, name });
            }}
            className="px-3 h-8 rounded-xl text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: "#f97316", color: "#fff" }}
          >
            + Валюта
          </button>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--admin-border)" }}>
          {data.currencies.map((c) => (
            <div key={c.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold" style={{ color: "var(--admin-text)" }}>
                  {c.code}
                </span>
                <span style={{ color: "var(--admin-muted)" }}>{c.name} {c.symbol}</span>
              </div>
              {c.isBase && <Badge text="Базовая" color="#22c55e" bg="rgba(34,197,94,.12)" />}
            </div>
          ))}
        </div>
      </div>

      {/* Курсы */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-xs font-semibold" style={{ color: "var(--admin-text)" }}>
            💱 Курсы (FXR)
          </div>
          <button
            disabled={busy}
            onClick={() => {
              const fromCode = prompt("Из валюты (USD):", "USD");
              if (!fromCode) return;
              const toCode = prompt("В валюту (EUR):", "EUR");
              if (!toCode) return;
              const rate = prompt("Курс:", "0.92");
              if (!rate) return;
              onCreate("rate", { fromCode, toCode, rate: Number(rate) });
            }}
            className="px-3 h-8 rounded-xl text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: "#f97316", color: "#fff" }}
          >
            + Курс
          </button>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--admin-border)" }}>
          {data.rates.slice(0, 10).map((r) => (
            <div key={r.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
              <span style={{ color: "var(--admin-text)" }}>
                {r.fromCode} → {r.toCode}
              </span>
              <span className="font-semibold" style={{ color: "var(--admin-text)" }}>
                {r.rate} <span style={{ color: "var(--admin-muted)", fontWeight: 400 }}>· {fmtDate(r.date)}</span>
              </span>
            </div>
          ))}
          {data.rates.length === 0 && (
            <div className="px-4 py-8 text-center text-xs" style={{ color: "var(--admin-muted)" }}>
              Курсов нет
            </div>
          )}
        </div>
      </div>

      {/* Налоги */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-xs font-semibold" style={{ color: "var(--admin-text)" }}>
            🧾 Налоги и правила (TAX/TXR)
          </div>
          <button
            disabled={busy}
            onClick={() => {
              const name = prompt("Название налога:", "НДС");
              if (!name) return;
              const rate = prompt("Ставка %:", "12");
              if (!rate) return;
              onCreate("tax", { name, rate: Number(rate) });
            }}
            className="px-3 h-8 rounded-xl text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: "#f97316", color: "#fff" }}
          >
            + Налог
          </button>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--admin-border)" }}>
          {data.taxes.map((t) => (
            <div key={t.id} className="px-4 py-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold" style={{ color: "var(--admin-text)" }}>
                  {t.name}
                </span>
                <span style={{ color: "var(--admin-muted)" }}>
                  {t.rate}% · {t.code}
                </span>
              </div>
              {data.taxRules.filter((r) => r.taxId === t.id).length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {data.taxRules
                    .filter((r) => r.taxId === t.id)
                    .map((r) => (
                      <div key={r.id} className="text-[10px]" style={{ color: "var(--admin-muted)" }}>
                        • {r.country ?? "Все страны"} {r.serviceType ? `· ${r.serviceType}` : ""} ({r.tax.name} {r.tax.rate}%)
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
          {data.taxes.length === 0 && (
            <div className="px-4 py-8 text-center text-xs" style={{ color: "var(--admin-muted)" }}>
              Налогов нет
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Создание ── */

async function promptPayment(act: (body: Record<string, unknown>) => Promise<unknown>) {
  const amount = prompt("Сумма ($):", "1000");
  if (!amount) return;
  const orderId = prompt("OrderId (необязательно):", "") ?? "";
  await act({ entity: "payment", amount: Number(amount), orderId: orderId || null });
}

async function promptRefund(act: (body: Record<string, unknown>) => Promise<unknown>) {
  const amount = prompt("Сумма возврата ($):", "500");
  if (!amount) return;
  const orderId = prompt("OrderId (необязательно):", "") ?? "";
  const reason = prompt("Причина:", "Отмена бронирования") ?? "";
  await act({ entity: "refund", amount: Number(amount), orderId: orderId || null, reason: reason || null });
}

async function promptInvoice(act: (body: Record<string, unknown>) => Promise<unknown>) {
  const amount = prompt("Сумма счёта ($):", "1000");
  if (!amount) return;
  const orderId = prompt("OrderId (необязательно):", "") ?? "";
  await act({ entity: "invoice", amount: Number(amount), orderId: orderId || null });
}

async function promptCommission(act: (body: Record<string, unknown>) => Promise<unknown>) {
  const amount = prompt("Сумма комиссии ($):", "120");
  if (!amount) return;
  const orderId = prompt("OrderId (необязательно):", "") ?? "";
  const rate = prompt("Ставка (0.12 = 12%):", "0.12") ?? "0.12";
  await act({ entity: "commission", amount: Number(amount), orderId: orderId || null, rate: Number(rate) });
}
