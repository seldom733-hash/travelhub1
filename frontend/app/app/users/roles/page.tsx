"use client";

/**
 * Users → «Роли и права доступа» (hybrid RBAC).
 *
 * Permissions are stored centrally on RolePermission; editing a role applies to
 * every user with that role immediately (JwtAuthGuard reloads DB per request).
 * Unsaved changes are local to this screen until Save.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import PermissionLabel from "@/components/rbac/PermissionLabel";
import { useCan } from "@/lib/use-can";
import { permissionGroupLabel } from "@/lib/permission-labels";
import { useLocale, t } from "@/lib/i18n";
import { api } from "@/lib/api";

interface RoleRow {
  code: string;
  title: string;
  description: string;
  userCount: number;
  permissions: string[];
}
interface PermissionRow {
  code: string;
  description: string | null;
}
interface RolesResponse {
  roles: RoleRow[];
  permissions: PermissionRow[];
}
interface HistoryRow {
  id: string;
  actor: string | null;
  createdAt: string;
  details: { before?: string[]; after?: string[]; added?: string[]; removed?: string[] } | null;
}

const groupOf = (code: string): string => code.split(".")[0] || "other";

export default function RolesPermissionsPage() {
  const locale = useLocale();
  const canManage = useCan("settings.write");
  const [data, setData] = useState<RolesResponse | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [original, setOriginal] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async (keepSelection = false) => {
    setBusy(true);
    try {
      const res = await api.get<RolesResponse>("/users/roles");
      setData(res);
      const code = keepSelection && selected ? selected : res.roles[0]?.code ?? "";
      setSelected(code);
      const role = res.roles.find((r) => r.code === code);
      setDraft(new Set(role?.permissions ?? []));
      setOriginal(new Set(role?.permissions ?? []));
      if (code) await loadHistory(code);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const loadHistory = async (code: string) => {
    try {
      setHistory(await api.get<HistoryRow[]>(`/users/roles/${encodeURIComponent(code)}/history`));
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRole = useMemo(() => data?.roles.find((r) => r.code === selected), [data, selected]);
  const dirty = useMemo(() => {
    if (draft.size !== original.size) return true;
    for (const p of draft) if (!original.has(p)) return true;
    return false;
  }, [draft, original]);

  const groups = useMemo(() => {
    const map = new Map<string, PermissionRow[]>();
    for (const p of data?.permissions ?? []) {
      const g = groupOf(p.code);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(p);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  const selectRole = async (code: string) => {
    if (dirty && !window.confirm(t("rbac.discard_confirm", locale))) return;
    setSelected(code);
    const role = data?.roles.find((r) => r.code === code);
    setDraft(new Set(role?.permissions ?? []));
    setOriginal(new Set(role?.permissions ?? []));
    setNotice("");
    await loadHistory(code);
  };

  const toggle = (code: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleGroup = (group: string, enabled: boolean) => {
    const codes = groups.find(([g]) => g === group)?.[1].map((p) => p.code) ?? [];
    setDraft((prev) => {
      const next = new Set(prev);
      for (const code of codes) {
        if (enabled) next.add(code);
        else next.delete(code);
      }
      return next;
    });
  };

  const save = async () => {
    if (!selectedRole) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.put(`/users/roles/${encodeURIComponent(selectedRole.code)}/permissions`, {
        permissions: [...draft].sort(),
      });
      setOriginal(new Set(draft));
      setNotice(t("rbac.saved", locale));
      await load(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!canManage) {
    return (
      <div>
        <PageHeader title={t("rbac.title", locale)} breadcrumbs={["Navitravel", t("nav.users", locale), t("rbac.title", locale)]} />
        <div className="p-6 text-sm text-slate-600">{t("rbac.no_access", locale)}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t("rbac.title", locale)}
        breadcrumbs={["Navitravel", t("nav.users", locale), t("rbac.title", locale)]}
        actions={
          <Link href="/app/users" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            {t("rbac.back_to_users", locale)}
          </Link>
        }
      />
      <div className="space-y-4 p-6">
        {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}
        {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</div>}

        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <section className="rounded-xl border border-line bg-white">
            <div className="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("rbac.roles", locale)}
            </div>
            <ul className="max-h-[70vh] divide-y divide-line overflow-auto">
              {data?.roles.map((role) => (
                <li key={role.code}>
                  <button
                    type="button"
                    onClick={() => void selectRole(role.code)}
                    className={`w-full px-3 py-2 text-left hover:bg-slate-50 ${selected === role.code ? "bg-blue-50" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800">{role.title}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{role.userCount}</span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">{role.code}</div>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-line bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">{selectedRole?.title ?? "—"}</h2>
                <p className="text-xs text-slate-500">{selectedRole?.description}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!dirty || busy}
                  onClick={() => {
                    setDraft(new Set(original));
                    setNotice("");
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-50"
                >
                  {t("rbac.cancel", locale)}
                </button>
                <button
                  type="button"
                  disabled={!dirty || busy}
                  onClick={() => void save()}
                  className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {busy ? t("rbac.saving", locale) : t("common.save", locale)}
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto p-4">
              {groups.map(([group, permissions]) => {
                const allOn = permissions.every((p) => draft.has(p.code));
                return (
                  <div key={group} className="mb-4 rounded-lg border border-line">
                    <div className="flex items-center justify-between border-b border-line bg-slate-50 px-3 py-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {permissionGroupLabel(group, locale)}
                      </span>
                      <label className="flex items-center gap-1 text-[11px] text-slate-500">
                        <input
                          type="checkbox"
                          checked={allOn}
                          onChange={(e) => toggleGroup(group, e.target.checked)}
                          className="size-3.5"
                        />
                        {t("rbac.select_all", locale)}
                      </label>
                    </div>
                    <div className="grid gap-1 p-2 sm:grid-cols-2">
                      {permissions.map((p) => (
                        <label key={p.code} className="flex items-start gap-2 rounded px-2 py-1 text-xs hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={draft.has(p.code)}
                            onChange={() => toggle(p.code)}
                            className="mt-0.5 size-3.5"
                          />
                          <span>
                            <PermissionLabel code={p.code} locale={locale} className="text-[12px] font-medium text-slate-700" />
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {dirty && <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">{t("rbac.unsaved", locale)}</div>}
          </section>

          <section className="rounded-xl border border-line bg-white">
            <div className="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("rbac.history", locale)}
            </div>
            <ul className="max-h-[70vh] divide-y divide-line overflow-auto">
              {history.map((h) => (
                <li key={h.id} className="px-3 py-2 text-xs">
                  <div className="font-medium text-slate-700">{h.actor ?? "—"}</div>
                  <div className="text-slate-400">{h.createdAt.slice(0, 19).replace("T", " ")}</div>
                  {h.details?.added?.length ? <div className="mt-1 text-emerald-700">+{h.details.added.join(", ")}</div> : null}
                  {h.details?.removed?.length ? <div className="text-rose-700">−{h.details.removed.join(", ")}</div> : null}
                </li>
              ))}
              {history.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-500">{t("rbac.no_history", locale)}</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
