"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Row = {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  title: string;
  body: string | null;
  payload: { conversationId?: string; phone?: string | null; linked?: boolean; referenceNumber?: string } | null;
  createdAt: string;
};

const META: Record<string, { icon: string; tone: string; label: string }> = {
  DEAL_CREATED: { icon: "🏷", tone: "border-sky-200 bg-sky-50 text-sky-800", label: "Новая сделка" },
  WHATSAPP_MESSAGE_LINKED: { icon: "💬", tone: "border-emerald-200 bg-emerald-50 text-emerald-800", label: "Сообщение клиента" },
  WHATSAPP_MESSAGE_UNLINKED: { icon: "👤", tone: "border-amber-200 bg-amber-50 text-amber-800", label: "Неизвестный номер" },
};

export default function NotificationStrip({ scope }: { scope: "sales" | "whatsapp" }) {
  const router = useRouter();
  const [rows, setRows] = React.useState<Row[]>([]);

  const allowed = scope === "sales"
    ? ["DEAL_CREATED", "WHATSAPP_MESSAGE_LINKED"]
    : ["WHATSAPP_MESSAGE_LINKED", "WHATSAPP_MESSAGE_UNLINKED"];

  React.useEffect(() => {
    let alive = true;
    const load = () => api.get<Row[]>("/sales/assignment/notifications?unread=true")
      .then((data) => { if (alive) setRows((data ?? []).filter((r) => allowed.includes(r.type)).slice(0, 6)); })
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
    } else {
      router.push("/app/finance/deals");
    }
  }

  return <div className="rounded-xl border border-[#e5e2da] bg-white p-2 shadow-sm">
    <div className="mb-1.5 flex items-center justify-between px-1">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#667085]">Оповещения</div>
      <span className="rounded-full bg-[#f0eee8] px-2 py-0.5 text-[9px] font-semibold text-[#667085]">{rows.length}</span>
    </div>
    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
      {rows.map((row) => {
        const meta = META[row.type] ?? META.DEAL_CREATED;
        return <button key={row.id} type="button" onClick={() => void open(row)} className={`flex min-w-[190px] max-w-[260px] items-start gap-2 rounded-lg border px-2 py-1.5 text-left transition hover:shadow-sm ${meta.tone}`}>
          <span className="text-sm leading-5">{meta.icon}</span>
          <span className="min-w-0">
            <span className="block truncate text-[10px] font-semibold">{row.title}</span>
            <span className="block truncate text-[9px] opacity-80">{row.body ?? meta.label}</span>
          </span>
        </button>;
      })}
    </div>
  </div>;
}
