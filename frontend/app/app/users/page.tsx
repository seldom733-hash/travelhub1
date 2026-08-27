"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { api, type PlatformUser } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Kpi from "@/components/Kpi";
import PanelFrame from "@/components/PanelFrame";
import Pagination from "@/components/Pagination";
import { useLocale } from "@/lib/i18n";
import SortableHeader, { type SortDirection } from "@/components/SortableHeader";

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

interface UsersResult {
  items: PlatformUser[];
  total: number;
  page: number;
  pageSize: number;
}

function UsersContent({ initialSearch, initialStatus, initialRole, initialSortBy, initialSortDirection, initialPage }: { initialSearch?: string; initialStatus?: string; initialRole?: string; initialSortBy?: string; initialSortDirection?: string; initialPage?: number }) {
  const locale = useLocale();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialPage ?? 1);
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortDirection, setSortDirection] = useState<SortDirection | undefined>(initialSortDirection as SortDirection | undefined);
  // search already initialized above
  const [draftSearch, setDraftSearch] = useState(initialSearch ?? "");
  const [search, setSearch] = useState(initialSearch ?? "");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(initialStatus || undefined);
  const [roleFilter, setRoleFilter] = useState<string | undefined>(initialRole || undefined);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", fullName: "", email: "", roleCode: "OPERATOR" });

  const router = useRouter();
  const isInitialMount = useRef(true);
  const handleSort = (field: string, direction: SortDirection) => {
    setSortBy(field);
    setSortDirection(direction);
    setPage(1);
  };

  const load = async (p: number, q: string, sortField?: string, sortDir?: SortDirection, status?: string, roleCode?: string, df?: string, dt?: string) => {
    setBusy(true);
    try {
      const sp = new URLSearchParams();
      sp.set("page", String(p));
      sp.set("pageSize", "20");
      if (q) sp.set("search", q);
      if (sortField) sp.set("sortBy", sortField);
      if (sortDir) sp.set("sortDirection", sortDir);
      if (status) sp.set("status", status);
      if (roleCode) sp.set("roleCode", roleCode);
      if (df) sp.set("dateFrom", df);
      if (dt) sp.set("dateTo", dt);
      const res = await api.get<UsersResult>(`/users?${sp.toString()}`);
      setUsers(res.items);
      setTotal(res.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load(page, search, sortBy, sortDirection, statusFilter, roleFilter, dateFrom, dateTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, sortBy, sortDirection, statusFilter, roleFilter, dateFrom, dateTo]);

  // URL sync
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (roleFilter) params.set("role", roleFilter);
    if (sortBy) params.set("sortBy", sortBy);
    if (sortDirection) params.set("sortDirection", sortDirection);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `/app/users?${qs}` : "/app/users", { scroll: false });
  }, [search, statusFilter, roleFilter, sortBy, sortDirection, page, dateFrom, dateTo]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(draftSearch);
    setPage(1);
  };

  const assignRole = async (id: string, roleCode: string) => {
    setError("");
    try {
      await api.patch(`/users/${id}/role`, { roleCode });
      await load(page, search, sortBy, sortDirection, statusFilter, roleFilter, dateFrom, dateTo);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const setStatus = async (id: string, status: string) => {
    setError("");
    try {
      await api.patch(`/users/${id}/status`, { status });
      await load(page, search, sortBy, sortDirection, statusFilter, roleFilter, dateFrom, dateTo);
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
      await load(1, search, sortBy, sortDirection, statusFilter, roleFilter, dateFrom, dateTo);
      setPage(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
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
              onClick={() => void load(page, search, sortBy, sortDirection, statusFilter, roleFilter, dateFrom, dateTo)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              ⟳ Обновить
            </button>
          }
        />

        <div className="space-y-4 p-6">
          <Kpi
            items={[
              { label: "Всего пользователей", value: total, icon: "👥" },
            ]}
          />

          <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
            <input
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              placeholder="Поиск: username, email, имя…"
              className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="submit"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Найти
            </button>
            <select
              value={statusFilter ?? ''}
              onChange={(e) => { setStatusFilter(e.target.value || undefined); setPage(1); }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400"
            >
              <option value="">Все статусы</option>
              <option value="ACTIVE">Активен</option>
              <option value="INACTIVE">Неактивен</option>
              <option value="LOCKED">Заблокирован</option>
            </select>
            <select
              value={roleFilter ?? ''}
              onChange={(e) => { setRoleFilter(e.target.value || undefined); setPage(1); }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400"
            >
              <option value="">Все роли</option>
              <option value="ADMIN">Администратор</option>
              <option value="DIRECTOR">Директор</option>
              <option value="SALES_MANAGER">Менеджер продаж</option>
              <option value="OPERATOR">Оператор</option>
              <option value="FINANCE">Финансы</option>
              <option value="ANALYST">Аналитик</option>
              <option value="MODERATOR">Модератор</option>
              <option value="PARTNER">Партнёр</option>
              <option value="BUYER">Покупатель</option>
              <option value="MARKETER">Маркетолог</option>
            </select>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">С</span>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400" />
              <span className="text-xs text-slate-400">По</span>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400" />
            </div>
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
            >
              ＋ Создать пользователя
            </button>
            {busy && <span className="text-xs text-slate-400">загрузка…</span>}
          </form>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "10%" }} />
                <col style={{ width: "28%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "12%" }} />
              </colgroup>
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <SortableHeader field="code" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>Код</SortableHeader>
                  <SortableHeader field="fullName" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>Пользователь</SortableHeader>
                  <th className="px-4 py-2.5 font-medium">Роль</th>
                  <SortableHeader field="status" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>Статус</SortableHeader>
                  <SortableHeader field="lastLoginAt" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>Последний вход</SortableHeader>
                  <SortableHeader field="createdAt" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>Дата регистрации</SortableHeader>
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
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString("ru-RU") : "—"}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                      Пользователей не найдено
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {total > 0 && (
              <Pagination page={page} pageSize={20} total={total} locale={locale} onPageChange={setPage} />
            )}
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

function UsersWithParams() {
  const sp = useSearchParams();
  return (
    <UsersContent
      initialSearch={sp.get("search") ?? undefined}
      initialStatus={sp.get("status") ?? undefined}
      initialRole={sp.get("role") ?? undefined}
      initialSortBy={sp.get("sortBy") ?? undefined}
      initialSortDirection={sp.get("sortDirection") ?? undefined}
      initialPage={sp.get("page") ? parseInt(sp.get("page")!, 10) : undefined}
    />
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-8 w-48 animate-pulse rounded bg-slate-100" /></div>}>
      <UsersWithParams />
    </Suspense>
  );
}