"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { api, type PlatformUser } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Kpi from "@/components/Kpi";
import PanelFrame from "@/components/PanelFrame";
import Pagination from "@/components/Pagination";
import { useLocale, t } from "@/lib/i18n";
import SortableHeader, { type SortDirection } from "@/components/SortableHeader";

const ROLES: { code: string; titleKey: string }[] = [
  { code: "ADMIN", titleKey: "user.role.ADMIN" },
  { code: "DIRECTOR", titleKey: "user.role.DIRECTOR" },
  { code: "FINANCE", titleKey: "user.role.FINANCE" },
  { code: "MARKETER", titleKey: "user.role.MARKETER" },
  { code: "ANALYST", titleKey: "user.role.ANALYST" },
  { code: "MODERATOR", titleKey: "user.role.MODERATOR" },
  { code: "SALES_MANAGER", titleKey: "user.role.SALES_MANAGER" },
  { code: "OPERATOR", titleKey: "user.role.OPERATOR" },
  { code: "PARTNER", titleKey: "user.role.PARTNER" },
  { code: "BUYER", titleKey: "user.role.BUYER" },
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
  const [search, setSearch] = useState(initialSearch ?? "");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const handleSearchChange = (value: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
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
          title={t("nav.users", locale)}
          breadcrumbs={["TravelHub", t("nav.users", locale)]}
          actions={
            <button
              onClick={() => void load(page, search, sortBy, sortDirection, statusFilter, roleFilter, dateFrom, dateTo)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              {t("admin.table.refresh", locale)}
            </button>
          }
        />

        <div className="space-y-4 p-6">
          <Kpi
            items={[
              { label: t("admin.kpi.total_users", locale), value: total, icon: "👥" },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2">
            <input
              defaultValue={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t("admin.search.placeholder_users", locale)}
              className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <select
              value={statusFilter ?? ''}
              onChange={(e) => { setStatusFilter(e.target.value || undefined); setPage(1); }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400"
            >
              <option value="">{t("admin.filter.all_statuses", locale)}</option>
              <option value="ACTIVE">{t("user.status.ACTIVE", locale)}</option>
              <option value="INACTIVE">{t("user.status.INACTIVE", locale)}</option>
              <option value="LOCKED">{t("user.status.LOCKED", locale)}</option>
            </select>
            <select
              value={roleFilter ?? ''}
              onChange={(e) => { setRoleFilter(e.target.value || undefined); setPage(1); }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400"
            >
              <option value="">{t("admin.filter.all_roles", locale)}</option>
              <option value="ADMIN">{t("user.role.ADMIN", locale)}</option>
              <option value="DIRECTOR">{t("user.role.DIRECTOR", locale)}</option>
              <option value="SALES_MANAGER">{t("user.role.SALES_MANAGER", locale)}</option>
              <option value="OPERATOR">{t("user.role.OPERATOR", locale)}</option>
              <option value="FINANCE">{t("user.role.FINANCE", locale)}</option>
              <option value="ANALYST">{t("user.role.ANALYST", locale)}</option>
              <option value="MODERATOR">{t("user.role.MODERATOR", locale)}</option>
              <option value="PARTNER">{t("user.role.PARTNER", locale)}</option>
              <option value="BUYER">{t("user.role.BUYER", locale)}</option>
              <option value="MARKETER">{t("user.role.MARKETER", locale)}</option>
            </select>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">{t("admin.filter.date_from", locale)}</span>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400" />
              <span className="text-xs text-slate-400">{t("admin.filter.date_to", locale)}</span>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400" />
            </div>
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
            >
              {t("admin.table.create_user", locale)}
            </button>              {busy && <span className="text-xs text-slate-400">{t("admin.table.loading", locale)}</span>}
          </div>

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
                  <SortableHeader field="code" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.code", locale)}</SortableHeader>
                  <SortableHeader field="fullName" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.user", locale)}</SortableHeader>
                  <th className="px-4 py-2.5 font-medium">{t("admin.table.col.role", locale)}</th>
                  <SortableHeader field="status" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.status", locale)}</SortableHeader>
                  <SortableHeader field="lastLoginAt" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.last_login", locale)}</SortableHeader>
                  <SortableHeader field="createdAt" currentSort={sortBy ? { sortBy, sortDirection: sortDirection ?? 'desc' } : null} onSort={handleSort}>{t("admin.table.col.created_at", locale)}</SortableHeader>
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
                            {t(r.titleKey, locale)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={u.status} />
                        <button
                          onClick={() => void setStatus(u.id, nextStatus(u.status))}
                          title={`${t("admin.status.change_title", locale)}${u.status})`}
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
                      {t("admin.table.empty_users", locale)}
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
          title={t("admin.form.panel_title", locale)}
          subtitle={t("admin.form.panel_subtitle", locale)}
          onClose={() => setShowCreate(false)}
        >
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("admin.form.username_label", locale)}</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                placeholder={t("admin.form.username_placeholder", locale)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("admin.form.password_label", locale)}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("admin.form.fullName_label", locale)}</label>
              <input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                placeholder={t("admin.form.fullName_placeholder", locale)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("admin.form.email_label", locale)}</label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                placeholder={t("admin.form.email_placeholder", locale)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("admin.form.role_label", locale)}</label>
              <select
                value={form.roleCode}
                onChange={(e) => setForm({ ...form, roleCode: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
              >
                {ROLES.map((r) => (
                  <option key={r.code} value={r.code}>
                    {t(r.titleKey, locale)}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => void createUser()}
              disabled={creating || form.username.length < 3 || form.password.length < 8}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? t("admin.form.creating", locale) : t("admin.form.create", locale)}
            </button>

            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-700">
              {t("admin.form.audit_note", locale)}
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