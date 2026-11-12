"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { dealText } from "@/lib/deals-i18n";

type Row = {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  title: string;
  body: string | null;
  payload: { conversationId?: string; phone?: string | null; linked?: boolean; referenceNumber?: string; sequence?: string } | null;
  createdAt: string;
};

const META: Record<string, { icon: string; tone: string; label: string }> = {
  DEAL_CREATED: { icon: "🏷", tone: "border-sky-200 bg-sky-50 text-sky-800", label: "Новая сделка" },
  WHATSAPP_MESSAGE_LINKED: { icon: "💬", tone: "border-emerald-200 bg-emerald-50 text-emerald-800", label: "Сообщение клиента" },
  WHATSAPP_MESSAGE_UNLINKED: { icon: "👤", tone: "border-amber-200 bg-amber-50 text-amber-800", label: "Неизвестный номер" },
  ORDER_PROBLEM: { icon: "⚠", tone: "border-amber-300 bg-amber-50 text-amber-900", label: "Проблема" },
  ORDER_SUSPENDED: { icon: "⏸", tone: "border-slate-300 bg-slate-50 text-slate-700", label: "Приостановлена" },
  ORDER_RESUMED: { icon: "▶", tone: "border-sky-200 bg-sky-50 text-sky-800", label: "Возобновлена" },
  ORDER_CANCELLATION_REQUESTED: { icon: "🛑", tone: "border-rose-200 bg-rose-50 text-rose-800", label: "Запрошена отмена" },
  ORDER_CANCELLATION_APPROVED: { icon: "✔", tone: "border-violet-200 bg-violet-50 text-violet-800", label: "Отмена согласована" },
  ORDER_CANCELLED: { icon: "✖", tone: "border-red-300 bg-red-50 text-red-800", label: "Отменена" },
  ORDER_FULFILLED: { icon: "✅", tone: "border-emerald-200 bg-emerald-50 text-emerald-800", label: "Выполнена" },
  ORDER_CLOSED: { icon: "🔒", tone: "border-slate-300 bg-slate-100 text-slate-700", label: "Закрыта" },
};

export default function NotificationStrip({ scope }: { scope: "sales" | "whatsapp" }) {
  const router = useRouter();
  const locale = useLocale();
  const [rows, setRows] = React.useState<Row[]>([]);

  const allowed = scope === "sales"
    ? ["DEAL_CREATED", "WHATSAPP_MESSAGE_LINKED"]
    : ["WHATSAPP_MESSAGE_LINKED", "WHATSAPP_MESSAGE_UNLINKED"];

  React.useEffect(() => {
    let alive = true;
    const load = () => api.get<Row[]>("/sales/assignment/notifications?unread=true")
      .then((data) => { if (alive) setRows((data ?? []).filter((r) => allowed.includes(r.type) || (scope === "sales" && r.type.startsWith("ORDER_"))).slice(0, 6)); })
      .catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 30000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [scope]);

  if (rows.length === 0) return null;

  async function open(row: Row) {
    await api.post("/sales/assignment/notifications/read-entity", { entityType: row.entityType, entityId: row.entityId }).catch(() => undefined);
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    if (row.type.startsWith("WHATSAPP") && row.entityId) {
      router.push(`/app/whatsapp?conversation=${encodeURIComponent(row.entityId)}`);
    } else if (row.type.startsWith("ORDER_") && row.payload?.sequence) {
      router.push(`/app/finance/deals/${row.payload.sequence}`);
    } else {
      router.push("/app/finance/deals");
    }
  }

  return <div className="rounded-xl border border-[#e5e2da] bg-white p-2 shadow-sm">
    <div className="mb-1.5 flex items-center justify-between px-1">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#667085]">{dealText(locale, "Оповещения")}</div>
      <span className="rounded-full bg-[#f0eee8] px-2 py-0.5 text-[9px] font-semibold text-[#667085]">{rows.length}</span>
    </div>
    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
      {rows.map((row) => {
        const meta = META[row.type] ?? META.DEAL_CREATED;
        const label = dealText(locale, meta.label);
        const reference = row.title.split(":")[0]?.trim();
        const title = row.type.startsWith("ORDER_") && reference ? `${reference}: ${label}` : row.type === "DEAL_CREATED" && reference ? `${dealText(locale, "Новая сделка")} ${reference}` : row.title;
        const body = row.type.startsWith("ORDER_") ? label : row.body ?? label;
        return <button key={row.id} type="button" onClick={() => void open(row)} className={`flex min-w-[190px] max-w-[260px] items-start gap-2 rounded-lg border px-2 py-1.5 text-left transition hover:shadow-sm ${meta.tone}`}>
          <span className="text-sm leading-5">{meta.icon}</span>
          <span className="min-w-0">
            <span className="block truncate text-[10px] font-semibold">{title}</span>
            <span className="block truncate text-[9px] opacity-80">{body}</span>
          </span>
        </button>;
      })}
    </div>
  </div>;
}
