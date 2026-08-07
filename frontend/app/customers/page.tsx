"use client";

import { useEffect, useState } from "react";
import { api, type Customer, type Page } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Kpi from "@/components/Kpi";

export default function CustomersPage() {
  const [data, setData] = useState<Page<Customer> | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      const res = await api.get<Page<Customer>>(`/customers?${qs.toString()}`);
      setData(res);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openDetail = async (id: string) => {
    const detail = await api.get<Customer>(`/customers/${id}`);
    setSelected(detail);
  };

  const counts = {
    total: data?.total ?? 0,
    persons: data?.items.filter((c) => c.type === "PERSON").length ?? 0,
    companies: data?.items.filter((c) => c.type === "COMPANY").length ?? 0,
  };

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          title="CRM mini"
          breadcrumbs={["TravelHub", "CRM mini"]}
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
              { label: "Всего клиентов", value: counts.total, icon: "👥" },
              { label: "Физлица", value: counts.persons, icon: "👤", accent: "#059669" },
              { label: "Компании", value: counts.companies, icon: "🏢", accent: "#7c3aed" },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по email, имени, коду…"
              className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Код</th>
                  <th className="px-4 py-2.5 font-medium">Имя</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Тип</th>
                  <th className="px-4 py-2.5 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => void openDetail(c.id)}
                    className={`cursor-pointer border-b border-slate-50 transition-colors hover:bg-blue-50/50 ${
                      selected?.id === c.id ? "bg-blue-50/60" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-blue-600">{c.code}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      {c.companyName ?? (`${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—")}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{c.email}</td>
                    <td className="px-4 py-2.5 text-slate-500">{c.type === "COMPANY" ? "Компания" : "Физлицо"}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
                {(data?.items ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                      Клиентов пока нет
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
              <div className="font-mono text-xs text-blue-600">{selected.code}</div>
              <div className="text-lg font-bold text-slate-900">
                {selected.companyName ?? (`${selected.firstName ?? ""} ${selected.lastName ?? ""}`.trim() || "—")}
              </div>
              <StatusBadge status={selected.status} />
            </div>
            <button onClick={() => setSelected(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
              ✕
            </button>
          </div>

          <div className="space-y-4 p-5 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="text-slate-400">Email</div>
                <div className="break-all font-medium text-slate-700">{selected.email}</div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="text-slate-400">Телефон</div>
                <div className="font-medium text-slate-700">{selected.phone ?? "—"}</div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="text-slate-400">Тип</div>
                <div className="font-medium text-slate-700">{selected.type === "COMPANY" ? "Компания" : "Физлицо"}</div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="text-slate-400">Создан</div>
                <div className="font-medium text-slate-700">{new Date(selected.createdAt).toLocaleDateString("ru")}</div>
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              📌 SSOT клиентских мастер-данных: Order/Booking ссылаются на этого клиента по ID, не дублируя данные.
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
