"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import PanelFrame from "@/components/PanelFrame";
import Pagination from "@/components/Pagination";
import { useLocale, t } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";
import {
  geoApi,
  geoDisplayName,
  type GeoAirport,
  type GeoCity,
  type GeoCountry,
  type GeoResort,
} from "@/lib/geo-api";

type Tab = "countries" | "cities" | "resorts" | "airports";

type Row =
  | ({ kind: "country" } & GeoCountry)
  | ({ kind: "city" } & GeoCity)
  | ({ kind: "resort" } & GeoResort)
  | ({ kind: "airport" } & GeoAirport);

interface FormState {
  id?: string;
  code: string;
  ru: string;
  en: string;
  az: string;
  parentId: string;
  latitude: string;
  longitude: string;
  timeZone: string;
  status: string;
}

const EMPTY_FORM: FormState = {
  code: "",
  ru: "",
  en: "",
  az: "",
  parentId: "",
  latitude: "",
  longitude: "",
  timeZone: "",
  status: "ACTIVE",
};

const PAGE_SIZE = 20;

function GeographyContent() {
  const locale = useLocale();
  const canCreate = useCan("geography.create");
  const canUpdate = useCan("geography.update");
  const canDelete = useCan("geography.delete");

  const [tab, setTab] = useState<Tab>("countries");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [parentFilter, setParentFilter] = useState("");
  const [parents, setParents] = useState<{ id: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadParents = useCallback(
    async (forTab: Tab) => {
      try {
        if (forTab === "cities") {
          const list = await geoApi.countries.list();
          setParents(
            list.map((c) => ({ id: c.id, label: `${c.code} — ${geoDisplayName(c.names)}` })),
          );
        } else if (forTab === "resorts" || forTab === "airports") {
          const list = await geoApi.cities.list();
          setParents(
            list.map((c) => ({ id: c.id, label: `${c.code} — ${geoDisplayName(c.names)}` })),
          );
        } else {
          setParents([]);
        }
      } catch {
        setParents([]);
      }
    },
    [],
  );

  const load = useCallback(
    async (forTab: Tab, q: string, status: string, parentId: string) => {
      setBusy(true);
      setError("");
      try {
        let items: Row[];
        if (q.trim().length >= 2) {
          const res = await geoApi.search(
            q.trim(),
            forTab === "countries"
              ? "country"
              : forTab === "cities"
                ? "city"
                : forTab === "resorts"
                  ? "resort"
                  : "airport",
          );
          const bucket =
            forTab === "countries"
              ? res.countries
              : forTab === "cities"
                ? res.cities
                : forTab === "resorts"
                  ? res.resorts
                  : res.airports;
          items = (bucket as (GeoCountry | GeoCity | GeoResort | GeoAirport)[]).map(
            (item) => ({ ...item, kind: forTab.slice(0, -1) }) as Row,
          );
        } else if (forTab === "countries") {
          items = (await geoApi.countries.list(status || undefined)).map((c) => ({
            ...c,
            kind: "country",
          }));
        } else if (forTab === "cities") {
          items = (await geoApi.cities.list(parentId || undefined, status || undefined)).map(
            (c) => ({ ...c, kind: "city" }),
          );
        } else if (forTab === "resorts") {
          items = (await geoApi.resorts.list(parentId || undefined, status || undefined)).map(
            (r) => ({ ...r, kind: "resort" }),
          );
        } else {
          items = (await geoApi.airports.list(parentId || undefined, status || undefined)).map(
            (a) => ({ ...a, kind: "airport" }),
          );
        }
        const filtered = status
          ? items.filter((r) => (r as { status: string }).status === status)
          : items;
        setRows(filtered);
        setTotal(filtered.length);
      } catch (e) {
        setError((e as Error).message);
        setRows([]);
        setTotal(0);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    setPage(1);
    setParentFilter("");
    void loadParents(tab);
    void load(tab, search, statusFilter, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    void load(tab, search, statusFilter, parentFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSearchChange = (value: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
      void load(tab, value, statusFilter, parentFilter);
    }, 300);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, parentId: parentFilter });
    setShowForm(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    const r = row as unknown as Record<string, unknown>;
    const names = (r.names ?? {}) as { ru?: string; en?: string; az?: string };
    setForm({
      id: row.id,
      code: (r.code as string) ?? "",
      ru: names.ru ?? "",
      en: names.en ?? "",
      az: names.az ?? "",
      parentId:
        ((r.countryId as string) ?? (r.cityId as string) ?? "") as string,
      latitude: r.latitude != null ? String(r.latitude) : "",
      longitude: r.longitude != null ? String(r.longitude) : "",
      timeZone: (r.timeZone as string) ?? "",
      status: (r.status as string) ?? "ACTIVE",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.ru.trim() || !form.en.trim() || !form.az.trim()) {
      setError(t("geo.form.required", locale) ?? "Заполните код и названия (ru/en/az)");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const names = { ru: form.ru.trim(), en: form.en.trim(), az: form.az.trim() };
      const lat = form.latitude.trim() ? Number(form.latitude) : undefined;
      const lng = form.longitude.trim() ? Number(form.longitude) : undefined;
      if (tab === "countries") {
        if (editing) {
          await geoApi.countries.update(editing.id, { names, status: form.status });
        } else {
          await geoApi.countries.create({ code: form.code.trim().toUpperCase(), names, status: form.status });
        }
      } else if (tab === "cities") {
        if (!form.parentId && !editing) {
          setError(t("geo.form.need_country", locale) ?? "Выберите страну");
          setSaving(false);
          return;
        }
        if (editing) {
          await geoApi.cities.update(editing.id, {
            names,
            status: form.status,
            ...(lat !== undefined ? { latitude: lat } : {}),
            ...(lng !== undefined ? { longitude: lng } : {}),
          });
        } else {
          await geoApi.cities.create({
            countryId: form.parentId,
            code: form.code.trim().toUpperCase(),
            names,
            status: form.status,
            ...(lat !== undefined ? { latitude: lat } : {}),
            ...(lng !== undefined ? { longitude: lng } : {}),
          });
        }
      } else if (tab === "resorts") {
        if (!form.parentId && !editing) {
          setError(t("geo.form.need_city", locale) ?? "Выберите город");
          setSaving(false);
          return;
        }
        if (editing) {
          await geoApi.resorts.update(editing.id, {
            names,
            status: form.status,
            ...(lat !== undefined ? { latitude: lat } : {}),
            ...(lng !== undefined ? { longitude: lng } : {}),
          });
        } else {
          await geoApi.resorts.create({
            cityId: form.parentId,
            code: form.code.trim().toUpperCase(),
            names,
            status: form.status,
            ...(lat !== undefined ? { latitude: lat } : {}),
            ...(lng !== undefined ? { longitude: lng } : {}),
          });
        }
      } else {
        if (!form.parentId && !editing) {
          setError(t("geo.form.need_city", locale) ?? "Выберите город");
          setSaving(false);
          return;
        }
        if (editing) {
          await geoApi.airports.update(editing.id, {
            names,
            status: form.status,
            ...(lat !== undefined ? { latitude: lat } : {}),
            ...(lng !== undefined ? { longitude: lng } : {}),
            ...(form.timeZone.trim() ? { timeZone: form.timeZone.trim() } : {}),
          });
        } else {
          await geoApi.airports.create({
            cityId: form.parentId,
            code: form.code.trim().toUpperCase(),
            names,
            status: form.status,
            ...(lat !== undefined ? { latitude: lat } : {}),
            ...(lng !== undefined ? { longitude: lng } : {}),
            ...(form.timeZone.trim() ? { timeZone: form.timeZone.trim() } : {}),
          });
        }
      }
      setShowForm(false);
      setEditing(null);
      await load(tab, search, statusFilter, parentFilter);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: Row) => {
    const name = geoDisplayName((row as unknown as { names: { ru: string; en: string; az: string } }).names, row.id);
    if (!window.confirm(`${t("geo.delete.confirm", locale) ?? "Удалить"} ${name}?`)) return;
    setError("");
    try {
      if (row.kind === "country") await geoApi.countries.remove(row.id);
      else if (row.kind === "city") await geoApi.cities.remove(row.id);
      else if (row.kind === "resort") await geoApi.resorts.remove(row.id);
      else await geoApi.airports.remove(row.id);
      await load(tab, search, statusFilter, parentFilter);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tabs: { key: Tab; label: string }[] = [
    { key: "countries", label: t("geo.tabs.countries", locale) ?? "Страны" },
    { key: "cities", label: t("geo.tabs.cities", locale) ?? "Города" },
    { key: "resorts", label: t("geo.tabs.resorts", locale) ?? "Курорты" },
    { key: "airports", label: t("geo.tabs.airports", locale) ?? "Аэропорты" },
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHeader
        title={t("nav.geography", locale)}
        breadcrumbs={["TravelHub", t("nav.geography", locale)]}
        actions={
          <button
            onClick={() => void load(tab, search, statusFilter, parentFilter)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            {t("admin.table.refresh", locale)}
          </button>
        }
      />

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === item.key
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            defaultValue={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t("geo.filter.search", locale) ?? "Поиск по коду или названию…"}
            className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400"
          >
            <option value="">{t("admin.filter.all_statuses", locale)}</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
          {tab !== "countries" && (
            <select
              value={parentFilter}
              onChange={(e) => {
                setParentFilter(e.target.value);
                void load(tab, search, statusFilter, e.target.value);
              }}
              className="max-w-64 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400"
            >
              <option value="">
                {tab === "cities"
                  ? (t("geo.filter.all_countries", locale) ?? "Все страны")
                  : (t("geo.filter.all_cities", locale) ?? "Все города")}
              </option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
            >
              {t("geo.actions.create", locale) ?? "Создать"}
            </button>
          )}
          {busy && <span className="text-xs text-slate-400">{t("admin.table.loading", locale)}</span>}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "12%" }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t("geo.table.code", locale) ?? "Код"}</th>
                <th className="px-4 py-2.5 font-medium">{t("geo.table.name", locale) ?? "Название"}</th>
                <th className="px-4 py-2.5 font-medium">{t("geo.table.names_alt", locale) ?? "EN / AZ"}</th>
                <th className="px-4 py-2.5 font-medium">{t("geo.table.parent", locale) ?? "Родитель"}</th>
                <th className="px-4 py-2.5 font-medium">{t("geo.table.status", locale) ?? "Статус"}</th>
                <th className="px-4 py-2.5 font-medium">{t("geo.table.actions", locale) ?? "Действия"}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const r = row as unknown as Record<string, unknown>;
                const names = (r.names ?? {}) as { ru?: string; en?: string; az?: string };
                const parent =
                  row.kind === "city"
                    ? parents.find((p) => p.id === (r.countryId as string))?.label ?? (r.countryId as string) ?? ""
                    : row.kind === "country"
                      ? "—"
                      : parents.find((p) => p.id === (r.cityId as string))?.label ?? (r.cityId as string) ?? "";
                return (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold">{r.code as string}</td>
                    <td className="truncate px-4 py-2.5 font-medium">{names.ru ?? ""}</td>
                    <td className="truncate px-4 py-2.5 text-xs text-slate-500">
                      {[names.en, names.az].filter(Boolean).join(" / ")}
                    </td>
                    <td className="truncate px-4 py-2.5 text-xs text-slate-500">{parent}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={(r.status as string) ?? ""} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800"
                          >
                            {t("geo.actions.edit", locale) ?? "Изм."}
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(row)}
                            className="text-xs font-medium text-red-600 hover:text-red-800"
                          >
                            {t("geo.actions.delete", locale) ?? "Удал."}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && !busy && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                    {t("ops.empty_no_data", locale)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>

      {showForm && (
        <PanelFrame
          title={editing ? (t("geo.form.edit_title", locale) ?? "Редактировать") : (t("geo.form.create_title", locale) ?? "Создать")}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        >
          <div className="space-y-3 p-4">
            {!editing && (
              <label className="block text-xs font-medium text-slate-600">
                {t("geo.table.code", locale) ?? "Код"}
                <input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder={tab === "countries" ? "GR" : "ATH"}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm outline-none focus:border-blue-400"
                />
              </label>
            )}
            {(["ru", "en", "az"] as const).map((lng) => (
              <label key={lng} className="block text-xs font-medium text-slate-600">
                {t("geo.form.name", locale) ?? "Название"} ({lng.toUpperCase()})
                <input
                  value={form[lng]}
                  onChange={(e) => setForm((f) => ({ ...f, [lng]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
                />
              </label>
            ))}
            {tab !== "countries" && !editing && (
              <label className="block text-xs font-medium text-slate-600">
                {tab === "cities"
                  ? (t("geo.form.country", locale) ?? "Страна")
                  : (t("geo.form.city", locale) ?? "Город")}
                <select
                  value={form.parentId}
                  onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400"
                >
                  <option value="">—</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {tab !== "countries" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-medium text-slate-600">
                  Lat
                  <input
                    value={form.latitude}
                    onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                    placeholder="37.98"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  Lng
                  <input
                    value={form.longitude}
                    onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                    placeholder="23.73"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
                  />
                </label>
              </div>
            )}
            {tab === "airports" && (
              <label className="block text-xs font-medium text-slate-600">
                TimeZone
                <input
                  value={form.timeZone}
                  onChange={(e) => setForm((f) => ({ ...f, timeZone: e.target.value }))}
                  placeholder="Europe/Athens"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
                />
              </label>
            )}
            <label className="block text-xs font-medium text-slate-600">
              Status
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {saving
                ? (t("admin.table.loading", locale) ?? "…")
                : (t("geo.actions.save", locale) ?? "Сохранить")}
            </button>
          </div>
        </PanelFrame>
      )}
    </div>
  );
}

export default function GeographyPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-400">…</div>}>
      <GeographyContent />
    </Suspense>
  );
}
