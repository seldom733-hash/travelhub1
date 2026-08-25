"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, type Page, type Product } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Kpi from "@/components/Kpi";
import PanelFrame from "@/components/PanelFrame";
import TariffEditor, { newTariffDraft, tariffDraftsFrom, type TariffDraft } from "@/components/TariffEditor";
import { useCan } from "@/lib/use-can";

const PRODUCT_TYPES = [
  { code: "TOUR", title: "Тур" },
  { code: "HOTEL", title: "Отель" },
  { code: "SANATORIUM", title: "Санаторий" },
  { code: "FLIGHT", title: "Авиаперелёт" },
  { code: "TRAIN", title: "Ж/д" },
  { code: "EXCURSION", title: "Экскурсия" },
  { code: "GUIDE", title: "Гид" },
  { code: "TRANSFER", title: "Трансфер" },
  { code: "PHOTOGRAPHER", title: "Фотограф" },
];

export default function CatalogPage() {
  const [data, setData] = useState<Page<Product> | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Ролевой UI: публикация — catalog.product.publish; создание — catalog.product.write (матрица: ADMIN/MODERATOR).
  const canPublish = useCan("catalog.product.publish");
  const canWrite = useCan("catalog.product.write");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ type: "TOUR", title: "", slug: "", description: "" });
  const [tariffs, setTariffs] = useState<TariffDraft[]>([newTariffDraft()]);
  // Ролевой UI: редактирование продукта — catalog.product.write (PATCH /products/:id).
  // UpdateProductDto поддерживает только title/description/tariffs (slug — только при создании).
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "" });

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
    setShowCreate(false);
    setEditing(false);
    const detail = await api.get<Product>(`/products/${id}`);
    setSelected(detail);
  };

  const openEdit = () => {
    if (!selected) return;
    setEditing(true);
    setEditForm({ title: selected.title, description: selected.description ?? "" });
    setTariffs(tariffDraftsFrom(selected.tariffs ?? []));
  };

  const saveEdit = async () => {
    if (!selected) return;
    if (!editForm.title.trim()) {
      setError("Укажите название продукта");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.patch(`/products/${selected.id}`, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        tariffs: tariffs
          .filter((t) => t.name.trim() && t.price !== "" && !Number.isNaN(Number(t.price)))
          .map((t) => ({ name: t.name.trim(), price: Number(t.price), currency: t.currency || "RUB" })),
      });
      setEditing(false);
      await openDetail(selected.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const publish = async (id: string) => {
    setError("");
    try {
      await api.post(`/products/${id}/publish`);
      await openDetail(id);
      await load();
    } catch (e) {
      // 403 при смене роли на лету → баннер вместо тихого сбоя
      setError((e as Error).message);
    }
  };

  const archive = async (id: string) => {
    setError("");
    try {
      await api.post(`/products/${id}/archive`);
      await openDetail(id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const createProduct = async () => {
    if (!form.title.trim()) {
      setError("Укажите название продукта");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const created = await api.post<Product>("/products", {
        type: form.type,
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        description: form.description.trim() || undefined,
        tariffs: tariffs
          .filter((t) => t.name.trim() && t.price !== "" && !Number.isNaN(Number(t.price)))
          .map((t) => ({ name: t.name.trim(), price: Number(t.price), currency: t.currency || "RUB" })),
      });
      setShowCreate(false);
      setForm({ type: "TOUR", title: "", slug: "", description: "" });
      setTariffs([newTariffDraft()]);
      await load();
      setSelected(created);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
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
            <div className="flex items-center gap-2">
              {canWrite && (
                <button
                  onClick={() => {
                    setEditing(false);
                    setShowCreate((v) => !v);
                  }}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  ＋ Создать продукт
                </button>
              )}
              <button
                onClick={() => void load()}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                ⟳ Обновить
              </button>
            </div>
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

      {/* Side Panel: создание продукта (catalog.product.write) */}
      {showCreate && (
        <PanelFrame title="Создать продукт" subtitle="Каталог услуг TravelHub" onClose={() => setShowCreate(false)}>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Тип *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
              >
                {PRODUCT_TYPES.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Название *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                placeholder="Тур «Золотое кольцо»"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Slug (URL)</label>
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                placeholder="golden-ring-tour"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Описание</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                placeholder="Краткое описание услуги…"
              />
            </div>

            {/* Тарифы */}
            <TariffEditor value={tariffs} onChange={setTariffs} />

            <button
              onClick={() => void createProduct()}
              disabled={creating || !form.title.trim()}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Создание…" : "Создать продукт"}
            </button>

            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-700">
              🔐 Требуется право <b>catalog.product.write</b> (матрица: ADMIN, MODERATOR). Публикация — отдельным шагом.
            </div>
        </PanelFrame>
      )}

      {/* Side Panel: детали продукта */}
      {!showCreate && selected && (
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

          {editing ? (
            <div className="space-y-4 p-5 text-sm">
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                ✏️ Редактирование: PATCH /products/:id — требуется право catalog.product.write
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Название *</label>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Описание</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <TariffEditor value={tariffs} onChange={setTariffs} />
              <div className="flex gap-2">
                <button
                  onClick={() => void saveEdit()}
                  disabled={busy || !editForm.title.trim()}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Сохранение…" : "💾 Сохранить"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5 p-5 text-sm">
              {canWrite && (
                <button
                  onClick={openEdit}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-600"
                >
                  ✏️ Редактировать
                </button>
              )}
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
                {selected.status !== "PUBLISHED" && canPublish && (
                  <button
                    onClick={() => void publish(selected.id)}
                    className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    ✅ Опубликовать
                  </button>
                )}
                {selected.status === "PUBLISHED" && canPublish && (
                  <button
                    onClick={() => void archive(selected.id)}
                    className="flex-1 rounded-lg bg-slate-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
                  >
                    🗄 В архив
                  </button>
                )}
                {!canPublish && !canWrite && (
                  <div className="w-full rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-400">
                    Изменение продукта недоступно для вашей роли
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
