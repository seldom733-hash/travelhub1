"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";

type Manager = { userId: string; name: string; availability: string; participates: boolean; new: number; processing: number; overdue: number; slaSoon: number; openedNotStarted: number; active: number; total: number; maxActiveRequests?: number | null };
type Unassigned = { id: string; referenceNumber: string; status: string; assignmentState: string; createdAt: string };

export default function AssignmentPage() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [unassigned, setUnassigned] = useState<Unassigned[]>([]);
  const [mode, setMode] = useState("AUTO");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [load, queue, settings] = await Promise.all([
        api.get<Manager[] | { value: Manager[] }>("/sales/assignment/load"),
        api.get<Unassigned[]>("/sales/assignment/unassigned"),
        api.get<{ mode: string }>("/sales/assignment/settings"),
      ]);
      setManagers(Array.isArray(load) ? load : load.value);
      setUnassigned(queue);
      setMode(settings.mode);
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { void load(); }, []);

  async function assign(id: string, managerId: string) {
    if (!managerId) return;
    await api.post(`/sales/assignment/${id}/reassign`, { managerId, reason: "Manual distribution" });
    await load();
  }

  async function settings(id: string, patch: { availability?: string; participates?: boolean; maxActiveRequests?: number | null }) {
    await api.post(`/sales/assignment/managers/${id}/settings`, patch);
    await load();
  }

  async function updateMode(next: string) {
    setMode(next);
    await api.post("/sales/assignment/settings", { mode: next });
  }

  return <div><PageHeader title="Загрузка менеджеров" breadcrumbs={["Navitravel", "Продажи", "Распределение заявок"]} />
    <div className="space-y-4 p-6">
      {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm">
        <span className="font-medium">Режим распределения:</span>
        <button type="button" onClick={() => void updateMode("AUTO")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${mode === "AUTO" ? "bg-blue-600 text-white" : "border border-line text-slate-600"}`}>Автоматический</button>
        <button type="button" onClick={() => void updateMode("MANUAL")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${mode === "MANUAL" ? "bg-amber-500 text-white" : "border border-line text-slate-600"}`}>Ручной</button>
      </div>
      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Менеджер</th><th>Новые</th><th>Прочитано, не взято</th><th>В обработке</th><th>Скоро SLA</th><th>Просрочено</th><th>Всего</th><th>Доступность</th><th>Участие</th><th>Лимит</th></tr></thead>
          <tbody>{managers.map((m) => <tr key={m.userId} className="border-t border-line/60"><td className="px-3 py-2 font-medium">{m.name}</td><td className="font-mono">{m.new}</td><td className={`font-mono ${m.openedNotStarted > 0 ? "font-semibold text-amber-700" : ""}`}>{m.openedNotStarted}</td><td className="font-mono">{m.processing}</td><td className={`font-mono ${m.slaSoon > 0 ? "font-semibold text-amber-700" : ""}`}>{m.slaSoon}</td><td className={`font-mono ${m.overdue > 0 ? "font-semibold text-rose-700" : ""}`}>{m.overdue}</td><td className="font-mono">{m.active}</td><td><select value={m.availability} onChange={(e) => void settings(m.userId, { availability: e.target.value })} className="rounded border border-line px-1 py-0.5 text-[11px]"><option value="FREE">Свободен</option><option value="BUSY">Занят</option><option value="ABSENT">Отсутствую</option></select></td><td><input type="checkbox" checked={m.participates} onChange={(e) => void settings(m.userId, { participates: e.target.checked })} /></td><td><input defaultValue={m.maxActiveRequests ?? ""} onBlur={(e) => void settings(m.userId, { maxActiveRequests: e.target.value ? Number(e.target.value) : null })} className="w-14 rounded border border-line px-1 py-0.5 text-[11px]" inputMode="numeric" /></td></tr>)}</tbody>
        </table>
      </section>
      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="border-b border-line px-3 py-2 text-sm font-semibold">Неназначенные заявки ({unassigned.length})</div>
        {unassigned.length === 0 ? <p className="p-4 text-sm text-slate-500">Очередь пуста</p> : <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Заявка</th><th>Статус</th><th>Создана</th><th>Назначить</th></tr></thead><tbody>{unassigned.map((r) => <tr key={r.id} className="border-t border-line/60"><td className="px-3 py-2 font-mono">{r.referenceNumber}</td><td>{r.status}</td><td>{new Date(r.createdAt).toLocaleString("ru-RU")}</td><td><select onChange={(e) => void assign(r.id, e.target.value)} defaultValue="" className="rounded border border-line px-2 py-1 text-xs"><option value="">Выбрать</option>{managers.filter((m) => m.availability !== "ABSENT").map((m) => <option key={m.userId} value={m.userId}>{m.name} ({m.active})</option>)}</select></td></tr>)}</tbody></table>}
      </section>
    </div>
  </div>;
}
