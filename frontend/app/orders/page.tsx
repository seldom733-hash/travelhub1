"use client";

import { useEffect, useState } from "react";
import { api, type Order, type Page } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Kpi from "@/components/Kpi";

const ACTIONS: { action: string; label: string; cls: string; only: string[] }[] = [
  { action: "process", label: "Принять в работу", cls: "bg-sky-600 hover:bg-sky-700", only: ["NEW"] },
  { action: "confirm", label: "Готов к бронированию", cls: "bg-violet-600 hover:bg-violet-700", only: ["IN_PROCESSING", "WAITING_FOR_DATA"] },
  { action: "send", label: "Передать в Booking", cls: "bg-blue-600 hover:bg-blue-700", only: ["READY_FOR_BOOKING"] },
  { action: "complete", label: "Исполнен", cls: "bg-emerald-600 hover:bg-emerald-700", only: ["SENT_TO_BOOKING", "PARTIALLY_FULFILLED"] },
  { action: "close", label: "Закрыть", cls: "bg-slate-700 hover:bg-slate-800", only: ["FULFILLED", "READY_TO_CLOSE"] },
  { action: "cancel", label: "Отменить", cls: "bg-red-600 hover:bg-red-700", only: ["NEW", "IN_PROCESSING", "WAITING_FOR_DATA", "READY_FOR_BOOKING", "SENT_TO_BOOKING", "PARTIALLY_FULFILLED", "PROBLEM", "SUSPENDED"] },
];

export default function OrdersPage() {
  const [data, setData] = useState<Page<Order> | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);
  const [bookings, setBookings] = useState<{ id: string; code: string; status: string }[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      const res = await api.get<Page<Order>>(`/orders?${qs.toString()}`);
      setData(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openDetail = async (id: string) => {
    const [order, bk] = await Promise.all([
      api.get<Order>(`/orders/${id}`),
      api.get<{ items: { id: string; code: string; status: string }[] }>(`/bookings?orderId=${id}`),
    ]);
    setSelected(order);
    setBookings(bk.items);
  };

  const runAction = async (action: string) => {
    if (!selected) return;
    await api.patch(`/orders/${selected.id}`, { action });
    await openDetail(selected.id);
    await load();
  };

  const counts = {
    total: data?.total ?? 0,
    active: data?.items.filter((o) => ["NEW", "IN_PROCESSING", "WAITING_FOR_DATA", "READY_FOR_BOOKING", "SENT_TO_BOOKING"].includes(o.status)).length ?? 0,
    ready: data?.items.filter((o) => o.status === "READY_FOR_BOOKING").length ?? 0,
    closed: data?.items.filter((o) => ["CLOSED", "CANCELLED"].includes(o.status)).length ?? 0,
  };

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          title="Order Center"
          breadcrumbs={["TravelHub", "Order Center"]}
          actions={
            <button
              onClick={() => void load()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              ⟳ Обновить
            </button>
          }
        />

        <div className="space-y-4 p-6">
          <Kpi
            items={[
              { label: "Всего заказов", value: counts.total, icon: "🧾" },
              { label: "Активные", value: counts.active, icon: "⚙️", accent: "#2563eb" },
              { label: "Готовы к бронированию", value: counts.ready, icon: "✅", accent: "#7c3aed" },
              { label: "Закрыто/отменено", value: counts.closed, icon: "🔒", accent: "#64748b" },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск: ORD-…, TH-…"
              className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            {busy && <span className="text-xs text-slate-400">загрузка…</span>}
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Заказ</th>
                  <th className="px-4 py-2.5 font-medium">Сумма</th>
                  <th className="px-4 py-2.5 font-medium">Позиции</th>
                  <th className="px-4 py-2.5 font-medium">Статус</th>
                  <th className="px-4 py-2.5 font-medium">Оплата</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => void openDetail(o.id)}
                    className={`cursor-pointer border-b border-slate-50 transition-colors hover:bg-blue-50/50 ${
                      selected?.id === o.id ? "bg-blue-50/60" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-mono text-xs text-blue-600">{o.code}</div>
                      <div className="text-xs text-slate-400">{o.number}</div>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      {Number(o.amount).toFixed(2)} {o.currency}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{o.items?.length ?? 0}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={o.paymentStatus} />
                    </td>
                  </tr>
                ))}
                {(data?.items ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                      Заказов пока нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected && (
        <aside className="thin-scroll fade-in-up w-96 shrink-0 overflow-y-auto border-l border-slate-200 bg-white">
          <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-blue-600">{selected.code}</span>
                <span className="font-mono text-xs text-slate-400">{selected.number}</span>
              </div>
              <div className="mt-1 flex gap-2">
                <StatusBadge status={selected.status} />
                <StatusBadge status={selected.paymentStatus} />
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
              ✕
            </button>
          </div>

          <div className="space-y-5 p-5 text-sm">
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Позиции заказа</div>
              <div className="space-y-1.5">
                {(selected.items ?? []).map((i) => (
                  <div key={i.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <div>
                      <div className="font-medium text-slate-700">{i.title}</div>
                      <div className="font-mono text-[11px] text-slate-400">{i.productCode}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-slate-700">
                        {i.quantity} × {Number(i.price).toFixed(2)}
                      </div>
                      <div className="text-xs text-slate-400">{Number(i.amount).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Туристы</div>
              {(selected.travelers ?? []).map((t) => (
                <div key={t.id} className="mb-1.5 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-700">
                    {t.firstName} {t.lastName}
                  </span>
                  <StatusBadge status={t.dataCompleteness === "COMPLETE" ? "CONFIRMED" : "WAITING_FOR_DATA"} />
                </div>
              ))}
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Связанные брони</div>
              {bookings.length === 0 && <div className="text-slate-400">Бронирований нет</div>}
              <div className="space-y-1.5">
                {bookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <span className="font-mono text-xs text-blue-600">{b.code}</span>
                    <StatusBadge status={b.status} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Команды (actions)</div>
              <div className="flex flex-wrap gap-2">
                {ACTIONS.filter((a) => a.only.includes(selected.status)).map((a) => (
                  <button
                    key={a.action}
                    onClick={() => void runAction(a.action)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors ${a.cls}`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">История (audit)</div>
              <div className="space-y-1.5">
                {(selected.history ?? []).slice(0, 8).map((h) => (
                  <div key={h.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <div className="font-medium text-slate-600">
                      {h.action}
                      {h.from && <span className="text-slate-400"> {h.from} → </span>}
                      {h.to && <span className="text-slate-700">{h.to}</span>}
                    </div>
                    <div className="text-slate-400">{h.comment}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
