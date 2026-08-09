"use client";

import { useEffect, useState } from "react";
import { api, type Customer, type Page } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Kpi from "@/components/Kpi";
import PanelFrame from "@/components/PanelFrame";
import { useCan } from "@/lib/use-can";

export default function CustomersPage() {
  const [data, setData] = useState<Page<Customer> | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  // Ролевой UI: создание клиента — crm.customer.write (матрица: ADMIN, SALES_MANAGER, OPERATOR).
  const canWrite = useCan("crm.customer.write");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    type: "PERSON",
    firstName: "",
    lastName: "",
    companyName: "",
    email: "",
    phone: "",
  });
  // Ролевой UI: редактирование клиента — crm.customer.write (PATCH /customers/:id).
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", companyName: "", phone: "" });

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
    setShowCreate(false);
    setEditing(false);
    const detail = await api.get<Customer>(`/customers/${id}`);
    setSelected(detail);
  };

  const openEdit = () => {
    if (!selected) return;
    setEditing(true);
    setEditForm({
      firstName: selected.firstName ?? "",
      lastName: selected.lastName ?? "",
      companyName: selected.companyName ?? "",
      phone: selected.phone ?? "",
    });
  };

  const saveEdit = async () => {
    if (!selected) return;
    if (selected.type === "COMPANY" && !editForm.companyName.trim()) {
      setError("Укажите название компании");
      return;
    }
    if (selected.type === "PERSON" && !editForm.firstName.trim() && !editForm.lastName.trim()) {
      setError("Укажите имя или фамилию");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.patch(`/customers/${selected.id}`, {
        firstName: editForm.firstName.trim() || undefined,
        lastName: editForm.lastName.trim() || undefined,
        companyName: editForm.companyName.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
      });
      setEditing(false);
      await openDetail(selected.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const createCustomer = async () => {
    if (!form.email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
      setError("Укажите корректный email");
      return;
    }
    if (form.type === "COMPANY" && !form.companyName.trim()) {
      setError("Укажите название компании");
      return;
    }
    if (form.type === "PERSON" && !form.firstName.trim() && !form.lastName.trim()) {
      setError("Укажите имя или фамилию");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const created = await api.post<Customer>("/customers", {
        type: form.type,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        companyName: form.companyName.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
      });
      setShowCreate(false);
      setForm({ type: "PERSON", firstName: "", lastName: "", companyName: "", email: "", phone: "" });
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
            <div className="flex items-center gap-2">
              {canWrite && (
                <button
                  onClick={() => {
                    setEditing(false);
                    setShowCreate((v) => !v);
                  }}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  ＋ Создать клиента
                </button>
              )}
              <button
                onClick={() => void load()}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                ⟳ Обновить
              </button>
            </div>
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

      {/* Side Panel: создание клиента (crm.customer.write) */}
      {showCreate && (
        <PanelFrame title="Создать клиента" subtitle="SSOT клиентских мастер-данных CRM" onClose={() => setShowCreate(false)}>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Тип *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
              >
                <option value="PERSON">Физлицо</option>
                <option value="COMPANY">Компания</option>
              </select>
            </div>

            {form.type === "PERSON" ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Имя</label>
                  <input
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                    placeholder="Иван"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Фамилия</label>
                  <input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                    placeholder="Петров"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Компания *</label>
                <input
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  placeholder="ООО «Ромашка»"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Email *</label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                placeholder="ivan@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Телефон</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                placeholder="+7 900 000-00-00"
              />
            </div>

            <button
              onClick={() => void createCustomer()}
              disabled={creating || !form.email.trim()}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Создание…" : "Создать клиента"}
            </button>

            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-700">
              🔐 Требуется право <b>crm.customer.write</b> (матрица: ADMIN, SALES_MANAGER, OPERATOR).
            </div>
        </PanelFrame>
      )}

      {!showCreate && selected && (
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

          {editing ? (
            <div className="space-y-4 p-5 text-sm">
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                ✏️ Редактирование: PATCH /customers/:id — требуется право crm.customer.write
              </div>
              {selected.type === "PERSON" ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Имя</label>
                    <input
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Фамилия</label>
                    <input
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Компания *</label>
                  <input
                    value={editForm.companyName}
                    onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Телефон</label>
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  placeholder="+7 900 000-00-00"
                />
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Email и тип клиента не редактируются (SSOT мастер-данных).
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void saveEdit()}
                  disabled={saving}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Сохранение…" : "💾 Сохранить"}
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
            <div className="space-y-4 p-5 text-sm">
              {canWrite && (
                <button
                  onClick={openEdit}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-600"
                >
                  ✏️ Редактировать
                </button>
              )}
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
          )}
        </aside>
      )}
    </div>
  );
}
