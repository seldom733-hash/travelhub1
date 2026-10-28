"use client";

import Link from "next/link";
import { WorkspaceKpiPageSkeleton } from "@/components/internal/WorkspaceSkeletons";
import { Suspense, useEffect, useRef, useState } from "react";
import { api, type PlatformUser } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Kpi from "@/components/Kpi";
import PanelFrame from "@/components/PanelFrame";
import Pagination from "@/components/Pagination";
import { useLocale, t } from "@/lib/i18n";
import TableExportButton from "@/components/TableExportButton";
import SortableHeader, { type SortDirection } from "@/components/SortableHeader";
import { permissionLabel } from "@/lib/permission-labels";

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

interface UserRoleAssignment {
  id: string;
  roleCode: string;
  roleTitle: string;
  startAt: string;
  endAt: string | null;
  reason: string | null;
  assignedByName: string | null;
  assignedAt: string;
  status: string;
}
interface UserRolesData {
  userId: string;
  username: string;
  fullName: string | null;
  primaryRole: { code: string; title: string };
  assignments: UserRoleAssignment[];
  effectivePermissions: string[];
  availableRoles: Array<{ code: string; title: string }>;
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
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", fullName: "", email: "", roleCode: "OPERATOR" });
  const [pwdUser, setPwdUser] = useState<PlatformUser | null>(null);
  const [pwdValue, setPwdValue] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [rolesUser, setRolesUser] = useState<PlatformUser | null>(null);
  const [rolesData, setRolesData] = useState<UserRolesData | null>(null);
  const [rolesBusy, setRolesBusy] = useState(false);
  const [rolesError, setRolesError] = useState("");
  const [newRole, setNewRole] = useState({ roleCode: "", startAt: "", endAt: "", reason: "" });

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

  /** Role assignments panel (hybrid RBAC). */
  const openRoles = async (u: PlatformUser) => {
    setRolesUser(u);
    setRolesData(null);
    setRolesError("");
    setNewRole({ roleCode: "", startAt: "", endAt: "", reason: "" });
    try {
      setRolesData(await api.get<UserRolesData>(`/users/${u.id}/roles`));
    } catch (e) {
      setRolesError((e as Error).message);
    }
  };

  const addRole = async () => {
    if (!rolesUser || !newRole.roleCode) return;
    setRolesBusy(true);
    setRolesError("");
    try {
      const data = await api.post<UserRolesData>(`/users/${rolesUser.id}/roles`, {
        roleCode: newRole.roleCode,
        startAt: newRole.startAt ? new Date(newRole.startAt).toISOString() : undefined,
        endAt: newRole.endAt ? new Date(newRole.endAt).toISOString() : undefined,
        reason: newRole.reason || undefined,
      });
      setRolesData(data);
      setNewRole({ roleCode: "", startAt: "", endAt: "", reason: "" });
      setNotice(t("rbac.assigned", locale));
    } catch (e) {
      setRolesError((e as Error).message);
    } finally {
      setRolesBusy(false);
    }
  };

  const revokeRole = async (assignmentId: string) => {
    if (!rolesUser) return;
    setRolesBusy(true);
    setRolesError("");
    try {
      setRolesData(await api.del<UserRolesData>(`/users/${rolesUser.id}/roles/${assignmentId}`));
      setNotice(t("rbac.revoked", locale));
    } catch (e) {
      setRolesError((e as Error).message);
    } finally {
      setRolesBusy(false);
    }
  };

  /** Смена пароля любому пользователю (settings.write): PATCH /users/:id/password. */
  const resetPassword = async () => {
    if (!pwdUser || pwdValue.length < 8) return;
    setPwdBusy(true);
    setError("");
    setNotice("");
    try {
      await api.patch(`/users/${pwdUser.id}/password`, { password: pwdValue });
      setNotice(t("admin.form.reset_done", locale));
      setPwdUser(null);
      setPwdValue("");
      await load(page, search, sortBy, sortDirection, statusFilter, roleFilter, dateFrom, dateTo);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPwdBusy(false);
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
            <div className="flex items-center gap-2">
              <Link
                href="/app/users/roles"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                {t("rbac.title", locale)}
              </Link>
              <button
                onClick={() => void load(page, search, sortBy, sortDirection, statusFilter, roleFilter, dateFrom, dateTo)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                {t("admin.table.refresh", locale)}
              </button>
            </div>
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
              <TableExportButton exportUrl="/api/v1/users/export" extraParams={{
                ...(statusFilter ? { status: statusFilter } : {}),
                ...(roleFilter ? { role: roleFilter } : {}),
                ...(search ? { search } : {}),
                ...(dateFrom ? { dateFrom } : {}),
                ...(dateTo ? { dateTo } : {}),
              }} />
            </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
          {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</div>}

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
                      <div className="flex flex-wrap items-center gap-1">
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
                        {u.roleAssignments && u.roleAssignments.length > 0 && (
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                            +{u.roleAssignments.length}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => void openRoles(u)}
                          className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50"
                          title={t("rbac.manage_user", locale)}
                        >
                          {t("rbac.roles_short", locale)}
                        </button>
                      </div>
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
                        <button
                          onClick={() => { setPwdUser(u); setPwdValue(""); setNotice(""); setError(""); }}
                          title={t("admin.table.reset_password", locale)}
                          className="rounded-md px-1.5 py-0.5 text-xs text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        >
                          🔑
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

      {/* Side Panel: смена пароля пользователя */}
      {pwdUser && (
        <PanelFrame
          title={t("admin.form.reset_title", locale)}
          subtitle={`@${pwdUser.username} · ${t("admin.form.reset_subtitle", locale)}`}
          onClose={() => { setPwdUser(null); setPwdValue(""); }}
        >
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("admin.form.password_label", locale)}</label>
              <input
                type="password"
                autoFocus
                value={pwdValue}
                onChange={(e) => setPwdValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void resetPassword(); }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                placeholder="••••••••"
              />
              {pwdValue.length > 0 && pwdValue.length < 8 && (
                <div className="mt-1 text-xs text-red-500">{t("admin.form.reset_short", locale)}</div>
              )}
            </div>

            <button
              onClick={() => void resetPassword()}
              disabled={pwdBusy || pwdValue.length < 8}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pwdBusy ? t("admin.form.creating", locale) : t("admin.form.reset_submit", locale)}
            </button>

            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-700">
              {t("admin.form.reset_subtitle", locale)}
            </div>
        </PanelFrame>
      )}
      {rolesUser && (
        <PanelFrame
          title={t("rbac.user_roles", locale)}
          subtitle={`@${rolesUser.username} · ${rolesUser.fullName ?? ""}`}
          onClose={() => { setRolesUser(null); setRolesData(null); setRolesError(""); }}
        >
          {rolesError && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{rolesError}</div>}
          {!rolesData ? (
            <div className="py-8 text-center text-sm text-slate-500">{t("common.loading", locale)}</div>
          ) : (
            <>
              <div className="rounded-lg border border-line p-3">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{t("rbac.primary", locale)}</div>
                <div className="mt-1 text-sm font-semibold text-slate-800">
                  {rolesData.primaryRole.title} <span className="font-mono text-xs text-slate-400">{rolesData.primaryRole.code}</span>
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{t("rbac.additional", locale)}</div>
                {rolesData.assignments.length === 0 ? (
                  <p className="text-xs text-slate-500">{t("rbac.no_additional", locale)}</p>
                ) : (
                  <ul className="space-y-2">
                    {rolesData.assignments.map((a) => (
                      <li key={a.id} className="rounded-lg border border-line p-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-slate-800">
                              {a.roleTitle} <span className="font-mono text-[10px] text-slate-400">{a.roleCode}</span>
                            </div>
                            <div className="text-slate-500">
                              {a.startAt.slice(0, 10)} → {a.endAt ? a.endAt.slice(0, 10) : t("rbac.permanent", locale)}
                              {" · "}
                              <span className={a.status === "ACTIVE" ? "text-emerald-700" : "text-amber-700"}>{a.status}</span>
                            </div>
                            {a.reason ? <div className="text-slate-500">{a.reason}</div> : null}
                            {a.assignedByName ? <div className="text-slate-400">{t("rbac.assigned_by", locale)}: {a.assignedByName} · {a.assignedAt.slice(0, 10)}</div> : null}
                          </div>
                          <button
                            type="button"
                            disabled={rolesBusy || a.status === "REVOKED"}
                            onClick={() => void revokeRole(a.id)}
                            className="rounded border border-rose-200 px-2 py-0.5 text-[11px] text-rose-600 disabled:opacity-40"
                          >
                            {t("rbac.revoke", locale)}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{t("rbac.add_role", locale)}</div>
                <div className="grid gap-2">
                  <select
                    value={newRole.roleCode}
                    onChange={(e) => setNewRole({ ...newRole, roleCode: e.target.value })}
                    className="rounded-lg border border-line px-2 py-1.5 text-sm"
                  >
                    <option value="">{t("rbac.select_role", locale)}</option>
                    {rolesData.availableRoles
                      .filter((r) => r.code !== rolesData.primaryRole.code && !rolesData.assignments.some((a) => a.roleCode === r.code && (a.status === "ACTIVE" || a.status === "SCHEDULED")))
                      .map((r) => (
                        <option key={r.code} value={r.code}>{r.title} ({r.code})</option>
                      ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] text-slate-500">
                      {t("rbac.start", locale)}
                      <input type="datetime-local" value={newRole.startAt} onChange={(e) => setNewRole({ ...newRole, startAt: e.target.value })} className="mt-1 w-full rounded border border-line px-2 py-1 text-xs" />
                    </label>
                    <label className="text-[11px] text-slate-500">
                      {t("rbac.end", locale)}
                      <input type="datetime-local" value={newRole.endAt} onChange={(e) => setNewRole({ ...newRole, endAt: e.target.value })} className="mt-1 w-full rounded border border-line px-2 py-1 text-xs" />
                    </label>
                  </div>
                  <input
                    value={newRole.reason}
                    onChange={(e) => setNewRole({ ...newRole, reason: e.target.value })}
                    placeholder={t("rbac.reason", locale)}
                    className="rounded-lg border border-line px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    disabled={rolesBusy || !newRole.roleCode}
                    onClick={() => void addRole()}
                    className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {t("rbac.assign", locale)}
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {t("rbac.effective", locale)} ({rolesData.effectivePermissions.length})
                </div>
                <div className="flex max-h-40 flex-wrap gap-1 overflow-auto">
                  {rolesData.effectivePermissions.sort().map((p) => (
                    <span key={p} className="rounded border border-line bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">
                      {permissionLabel(p, locale)}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
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
    <Suspense fallback={<WorkspaceKpiPageSkeleton />}>
      <UsersWithParams />
    </Suspense>
  );
}