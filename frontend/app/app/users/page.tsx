"use client";

import { useEffect, useState } from "react";
import { api, type PlatformUser } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Kpi from "@/components/Kpi";
import PanelFrame from "@/components/PanelFrame";

const ROLES: { code: string; title: string }[] = [
  { code: "ADMIN", title: "Администратор" },
  { code: "DIRECTOR", title: "Директор" },
  { code: "FINANCE", title: "Финансы" },
  { code: "MARKETER", title: "Маркетолог" },
  { code: "ANALYST", title: "Аналитик" },
  { code: "MODERATOR", title: "Модератор" },
  { code: "SALES_MANAGER", title: "Менеджер продаж" },
  { code: "OPERATOR", title: "Оператор" },
  { code: "PARTNER", title: "Партнёр" },
  { code: "BUYER", title: "Покупатель" },
];

export default function UsersPage() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", fullName: "", email: "", roleCode: "OPERATOR" });

  const load = async () => {
    setBusy(true);
    try {
      const qs = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await api.get<PlatformUser[]>(`/users${qs}`);
      setUsers(res);
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

  const assignRole = async (id: string, roleCode: string) => {
    setError("");
    try {
      await api.patch(`/users/${id}/role`, { roleCode });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const setStatus = async (id: string, status: string) => {
    setError("");
    try {
      await api.patch(`/users/${id}/status`, { status });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  /** Цикл статуса: ACTIVE → INACTIVE → LOCKED → ACTIVE (backend поддерживает LOCKED). */
  const nextStatus = (s: string): string => (s === "ACTIVE" ? "INACTIVE" : s === "INACTIVE" ? "LOCKED" : "ACTIVE");

  const createUser = async () => {
    setCreating(true);
    setError("");
    try {
      await api.post("/users", {
        username: form.username,
        password: form.password,
        fullName: form.fullName || undefined,
        email: form.email || undefined,
        roleCode: form.roleCode,
      });
      setShowCreate(false);
      setForm({ username: "", password: "", fullName: "", email: "", roleCode: "OPERATOR" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const counts = {
    total: users.length,
    active: users.filter((u) => u.status === "ACTIVE").length,
    inactive: users.filter((u) => u.status === "INACTIVE").length,
  };

  return (
    <div className="flex h-full">
      {/* Workspace */}
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          title="Пользователи"
          breadcrumbs={["TravelHub", "Пользователи"]}
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
              { label: "Всего пользователей", value: counts.total, icon: "👥" },
              { label: "Активные", value: counts.active, icon: "✅", accent: "#059669" },
              { label: "Неактивные", value: counts.inactive, icon: "⏸", accent: "#94a3b8" },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск: username, email, имя…"
              className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
            >
              ＋ Создать пользователя
            </button>
            {busy && <span className="text-xs text-slate-400">загрузка…</span>}
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Код</th>
                  <th className="px-4 py-2.5 font-medium">Пользователь</th>
                  <th className="px-4 py-2.5 font-medium">Роль</th>
                  <th className="px-4 py-2.5 font-medium">Статус</th>
                  <th className="px-4 py-2.5 font-medium">Последний вход</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 transition-colors hover:bg-blue-50/40">
                    <td className="px-4 py-2.5 font-mono text-xs text-blue-600">{u.code}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{u.fullName ?? u.username}</div>
                      <div className="text-xs text-slate-400">
                        @{u.username}
                        {u.email ? ` · ${u.email}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={u.role.code}
                        onChange={(e) => void assignRole(u.id, e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-400"
                      >
                        {ROLES.map((r) => (
                          <option key={r.code} value={r.code}>
                            {r.title}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={u.status} />
                        <button
                          onClick={() => void setStatus(u.id, nextStatus(u.status))}
                          title={`Сменить статус (сейчас: ${u.status})`}
                          className="rounded-md px-1.5 py-0.5 text-xs text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        >
                          ↻
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("ru") : "—"}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                      Пользователей не найдено
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Side Panel: создание пользователя */}
      {showCreate && (
        <PanelFrame
          title="Создать пользователя"
          subtitle="Персонал платформы (роль из матрицы RBAC)"
          onClose={() => setShowCreate(false)}
        >
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Логин *</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                placeholder="operator1"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Пароль * (мин. 8)</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Имя</label>
              <input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                placeholder="Оператор Иванов"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                placeholder="user@travelhub.local"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Роль *</label>
              <select
                value={form.roleCode}
                onChange={(e) => setForm({ ...form, roleCode: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
              >
                {ROLES.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => void createUser()}
              disabled={creating || form.username.length < 3 || form.password.length < 8}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Создание…" : "Создать"}
            </button>

            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-700">
              🔐 Смена роли и статуса аудитируется в security.AuditLog. Новые роли не создаются — только канонические из RBAC Matrix.
            </div>
        </PanelFrame>
      )}
    </div>
  );
}
