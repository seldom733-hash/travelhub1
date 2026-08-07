"use client";

import { useEffect, useState } from "react";
import { api, type Page, type Product } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Kpi from "@/components/Kpi";

export default function CatalogPage() {
  const [data, setData] = useState<Page<Product> | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (status) qs.set("status", status);
      const res = await api.get<Page<Product>>(`/products?${qs.toString()}`);
      setData(res);
      if (selected && !res.items.some((p) => p.id === selected.id)) setSelected(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  const openDetail = async (id: string) => {
    const detail = await api.get<Product>(`/products/${id}`);
    setSelected(detail);
  };

  const publish = async (id: string) => {
    await api.post(`/products/${id}/publish`);
    await openDetail(id);
    await load();
  };

  const counts = {
    total: data?.total ?? 0,
    published: data?.items.filter((p) => p.status === "PUBLISHED").length ?? 0,
    drafts: data?.items.filter((p) => p.status === "DRAFT").length ?? 0,
    archived: data?.items.filter((p) => p.status === "ARCHIVED").length ?? 0,
  };

  return (
    <div className="flex h-full">
      {/* Workspace */}
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          title="Catalog Center"
          breadcrumbs={["TravelHub", "Catalog Center"]}
          actions={
            <button
              onClick={() => void load()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              ⟳ Обновить
            </button>
          }
        />

        <div className="space-y-4 p-6">
          <Kpi
            items={[
              { label: "Всего продуктов", value: counts.total, icon: "📦" },
              { label: "Опубликовано", value: counts.published, icon: "✅", accent: "#059669" },
              { label: "Черновики", value: counts.drafts, icon: "📝", accent: "#64748b" },
              { label: "В архиве", value: counts.archived, icon: "🗄", accent: "#94a3b8" },
            ]}
          />

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию или коду…"
              className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 outline-none focus:border-blue-400"
            >
              <option value="">Все статусы</option>
              <option value="DRAFT">Черновик</option>
              <option value="COMPLETE">Заполнен</option>
              <option value="REVIEWED">Проверен</option>
              <option value="PUBLISHED">Опубликован</option>
              <option value="ARCHIVED">Архивирован</option>
            </select>
            {busy && <span className="text-xs text-slate-400">загрузка…</span>}
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Код</th>
                  <th className="px-4 py-2.5 font-medium">Название</th>
                  <th className="px-4 py-2.5 font-medium">Тип</th>
                  <th className="px-4 py-2.5 font-medium">Тарифы</th>
                  <th className="px-4 py-2.5 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => void openDetail(p.id)}
                    className={`cursor-pointer border-b border-slate-50 transition-colors hover:bg-blue-50/50 ${
                      selected?.id === p.id ? "bg-blue-50/60" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-blue-600">{p.code}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{p.title}</td>
                    <td className="px-4 py-2.5 text-slate-500">{p.type}</td>
                    <td className="px-4 py-2.5 text-slate-500">{p.tariffs?.length ?? 0}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
                {(data?.items ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                      Продуктов пока нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Side Panel */}
      {selected && (
        <aside className="thin-scroll fade-in-up w-96 shrink-0 overflow-y-auto border-l border-slate-200 bg-white">
          <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <div className="font-mono text-xs text-blue-600">{selected.code}</div>
              <div className="text-lg font-bold text-slate-900">{selected.title}</div>
              <StatusBadge status={selected.status} />
            </div>
            <button onClick={() => setSelected(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
              ✕
            </button>
          </div>

          <div className="space-y-5 p-5 text-sm">
            {selected.status === "PUBLISHED" && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                ✅ Опубликован — доступен для заказов
              </div>
            )}

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">О продукте</div>
              <p className="text-slate-600">{selected.description ?? "Без описания"}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-slate-400">Тип</div>
                  <div className="font-medium text-slate-700">{selected.type}</div>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-slate-400">Версия</div>
                  <div className="font-medium text-slate-700">v{selected.version}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Тарифы</div>
              {(selected.tariffs ?? []).length === 0 && <div className="text-slate-400">Тарифы не заданы</div>}
              <div className="space-y-1.5">
                {(selected.tariffs ?? []).map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <span className="font-mono text-xs text-slate-500">{t.code}</span>
                    <span className="font-medium text-slate-700">
                      {Number(t.price).toFixed(2)} {t.currency}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">История (audit)</div>
              <div className="space-y-1.5">
                {(selected.history ?? []).slice(0, 6).map((h) => (
                  <div key={h.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <div className="font-medium text-slate-600">
                      {h.action} {h.to && <span className="text-slate-400">→ {h.to}</span>}
                    </div>
                    <div className="text-slate-400">{h.comment}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              {selected.status !== "PUBLISHED" && (
                <button
                  onClick={() => void publish(selected.id)}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  ✅ Опубликовать
                </button>
              )}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
