"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";

type Manager = { userId: string; name: string; availability: string; participates: boolean; new: number; processing: number; overdue: number; openedNotStarted: number; active: number; total: number };
type Unassigned = { id: string; referenceNumber: string; status: string; assignmentState: string; createdAt: string };

export default function AssignmentPage() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [unassigned, setUnassigned] = useState<Unassigned[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [load, queue] = await Promise.all([
        api.get<Manager[] | { value: Manager[] }>("/sales/assignment/load"),
        api.get<Unassigned[]>("/sales/assignment/unassigned"),
      ]);
      setManagers(Array.isArray(load) ? load : load.value);
      setUnassigned(queue);
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { void load(); }, []);

  async function assign(id: string, managerId: string) {
    if (!managerId) return;
    await api.post(`/sales/assignment/${id}/assign`, {});
    await load();
  }

  return <div><PageHeader title="Загрузка менеджеров" breadcrumbs={["Navitravel", "Продажи", "Распределение заявок"]} />
    <div className="space-y-4 p-6">
      {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Менеджер</th><th>Новые</th><th>Прочитано, не взято</th><th>В обработке</th><th>Просрочено</th><th>Всего активных</th><th>Доступность</th><th>Участие</th></tr></thead>
          <tbody>{managers.map((m) => <tr key={m.userId} className="border-t border-line/60"><td className="px-3 py-2 font-medium">{m.name}</td><td className="font-mono">{m.new}</td><td className={`font-mono ${m.openedNotStarted > 0 ? "font-semibold text-amber-700" : ""}`}>{m.openedNotStarted}</td><td className="font-mono">{m.processing}</td><td className={`font-mono ${m.overdue > 0 ? "font-semibold text-rose-700" : ""}`}>{m.overdue}</td><td className="font-mono">{m.active}</td><td>{m.availability}</td><td>{m.participates ? "Да" : "Нет"}</td></tr>)}</tbody>
        </table>
      </section>
      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="border-b border-line px-3 py-2 text-sm font-semibold">Неназначенные заявки ({unassigned.length})</div>
        {unassigned.length === 0 ? <p className="p-4 text-sm text-slate-500">Очередь пуста</p> : <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Заявка</th><th>Статус</th><th>Создана</th><th>Назначить</th></tr></thead><tbody>{unassigned.map((r) => <tr key={r.id} className="border-t border-line/60"><td className="px-3 py-2 font-mono">{r.referenceNumber}</td><td>{r.status}</td><td>{new Date(r.createdAt).toLocaleString("ru-RU")}</td><td><select onChange={(e) => void assign(r.id, e.target.value)} defaultValue="" className="rounded border border-line px-2 py-1 text-xs"><option value="">Выбрать</option>{managers.map((m) => <option key={m.userId} value={m.userId}>{m.name} ({m.active})</option>)}</select></td></tr>)}</tbody></table>}
      </section>
    </div>
  </div>;
}
