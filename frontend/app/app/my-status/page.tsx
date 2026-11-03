"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";

const OPTIONS = [
  { value: "FREE", label: "Свободен", hint: "Можно автоматически назначать заявки" },
  { value: "BUSY", label: "Занят", hint: "Автоназначение не выполняется, вручную назначить можно" },
  { value: "ABSENT", label: "Отсутствую", hint: "Не назначается ни автоматически, ни вручную" },
];

export default function MyStatusPage() {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.get<{ availability: string }>("/sales/assignment/me/status")
      .then((res) => setStatus(res.availability))
      .catch(() => undefined);
  }, []);

  async function set(next: string) {
    setBusy(true);
    try {
      await api.post("/sales/assignment/me/status", { status: next });
      setStatus(next);
    } finally {
      setBusy(false);
    }
  }

  return <div><PageHeader title="Мой статус" breadcrumbs={["Navitravel", "Продажи", "Мой статус"]} />
    <div className="max-w-xl space-y-3 p-6">
      <p className="text-sm text-slate-600">Статус влияет на автоматическое и ручное распределение заявок.</p>
      {OPTIONS.map((o) => <button key={o.value} type="button" disabled={busy} onClick={() => void set(o.value)} className={`w-full rounded-xl border p-4 text-left ${status === o.value ? "border-blue-500 bg-blue-50" : "border-line bg-white"}`}><div className="font-semibold">{o.label}</div><div className="text-xs text-slate-500">{o.hint}</div></button>)}
    </div>
  </div>;
}
