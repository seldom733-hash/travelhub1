"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import PanelFrame from "@/components/PanelFrame";
import Pagination from "@/components/Pagination";
import { useLocale, t } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";
import {
  hotelDirectoryApi,
  hotelDirectoryDisplayName,
  type HotelDirectoryEntry,
  type HotelDirectoryType,
} from "@/lib/hotel-directory-api";

interface FormState {
  id?: string;
  code: string;
  ru: string;
  en: string;
  az: string;
  sortOrder: string;
  status: string;
}

const EMPTY_FORM: FormState = {
  code: "",
  ru: "",
  en: "",
  az: "",
  sortOrder: "0",
  status: "ACTIVE",
};

const PAGE_SIZE = 20;

const TABS: { key: HotelDirectoryType; labelKey: string; fallback: string }[] = [
  { key: "categories", labelKey: "hd.tabs.categories", fallback: "Категории отелей" },
  { key: "room-types", labelKey: "hd.tabs.room_types", fallback: "Типы номеров" },
  { key: "placement-types", labelKey: "hd.tabs.placement_types", fallback: "Типы размещения" },
  { key: "meal-types", labelKey: "hd.tabs.meal_types", fallback: "Типы питания" },
];

function HotelDirectoryContent() {
  const locale = useLocale();
  const canCreate = useCan("hotel_directory.create");
  const canUpdate = useCan("hotel_directory.update");
  const canDelete = useCan("hotel_directory.delete");

  const [tab, setTab] = useState<HotelDirectoryType>("categories");
  const [rows, setRows] = useState<HotelDirectoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<HotelDirectoryEntry | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (forTab: HotelDirectoryType, q: string, status: string) => {
      setBusy(true);
      setError("");
      try {
        let items: HotelDirectoryEntry[];
        if (q.trim().length >= 2) {
          const res = await hotelDirectoryApi.search(q.trim(), forTab);
          items = res[forTab] ?? [];
        } else {
          items = await hotelDirectoryApi.list(forTab, status || undefined);
        }
        const filtered = status
          ? items.filter((r) => r.status === status)
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
    void load(tab, search, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    void load(tab, search, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSearchChange = (value: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
      void load(tab, value, statusFilter);
    }, 300);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (row: HotelDirectoryEntry) => {
    setEditing(row);
    setForm({
      id: row.id,
      code: row.code,
      ru: row.names?.ru ?? "",
      en: row.names?.en ?? "",
      az: row.names?.az ?? "",
      sortOrder: String(row.sortOrder ?? 0),
      status: row.status ?? "ACTIVE",
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
      const body = {
        names: { ru: form.ru.trim(), en: form.en.trim(), az: form.az.trim() },
        sortOrder: Number(form.sortOrder) || 0,
        status: form.status,
      };
      if (editing) {
        await hotelDirectoryApi.update(tab, editing.id, body);
      } else {
        await hotelDirectoryApi.create(tab, {
          code: form.code.trim().toUpperCase(),
          ...body,
        });
      }
      setShowForm(false);
      setEditing(null);
      await load(tab, search, statusFilter);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: HotelDirectoryEntry) => {
    const name = hotelDirectoryDisplayName(row.names, row.code);
    if (!window.confirm(`${t("geo.delete.confirm", locale) ?? "Удалить"} ${name}?`)) return;
    setError("");
    try {
      await hotelDirectoryApi.remove(tab, row.id);
      await load(tab, search, statusFilter);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHeader
        title={t("nav.hotels", locale)}
        breadcrumbs={["TravelHub", t("nav.hotels", locale)]}
        actions={
          <button
            onClick={() => void load(tab, search, statusFilter)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            {t("admin.table.refresh", locale)}
          </button>
        }
      />

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === item.key
                  ? "bg-blue-600 text-white"
                  : "text-slate-900 hover:bg-slate-100"
              }`}
            >
              {t(item.labelKey, locale) ?? item.fallback}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            defaultValue={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t("geo.filter.search", locale) ?? "Поиск по коду или названию…"}
            className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              void load(tab, search, e.target.value);
            }}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-400"
          >
            <option value="">{t("admin.filter.all_statuses", locale)}</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
          {canCreate && (
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
            >
              {t("geo.actions.create", locale) ?? "Создать"}
            </button>
          )}
          {busy && <span className="text-xs text-slate-900">{t("admin.table.loading", locale)}</span>}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "14%" }} />
              <col style={{ width: "28%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-900">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t("geo.table.code", locale) ?? "Код"}</th>
                <th className="px-4 py-2.5 font-medium">{t("geo.table.name", locale) ?? "Название"}</th>
                <th className="px-4 py-2.5 font-medium">{t("geo.table.names_alt", locale) ?? "EN / AZ"}</th>
                <th className="px-4 py-2.5 font-medium">Sort</th>
                <th className="px-4 py-2.5 font-medium">{t("geo.table.status", locale) ?? "Статус"}</th>
                <th className="px-4 py-2.5 font-medium">{t("geo.table.actions", locale) ?? "Действия"}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-900">{row.code}</td>
                  <td className="truncate px-4 py-2.5 font-medium text-slate-900">
                    {hotelDirectoryDisplayName(row.names)}
                  </td>
                  <td className="truncate px-4 py-2.5 text-xs text-slate-900">
                    {[row.names?.en, row.names?.az].filter(Boolean).join(" / ")}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-900">{row.sortOrder}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={row.status ?? ""} />
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
              ))}
              {pageRows.length === 0 && !busy && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-900">
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
              <label className="block text-xs font-medium text-slate-900">
                {t("geo.table.code", locale) ?? "Код"}
                <input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="5*"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-900 focus:border-blue-400"
                />
              </label>
            )}
            {(["ru", "en", "az"] as const).map((lng) => (
              <label key={lng} className="block text-xs font-medium text-slate-900">
                {t("geo.form.name", locale) ?? "Название"} ({lng.toUpperCase()})
                <input
                  value={form[lng]}
                  onChange={(e) => setForm((f) => ({ ...f, [lng]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-900 focus:border-blue-400"
                />
              </label>
            ))}
            <label className="block text-xs font-medium text-slate-900">
              Sort
              <input
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                placeholder="0"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-900 focus:border-blue-400"
              />
            </label>
            <label className="block text-xs font-medium text-slate-900">
              Status
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-400"
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

export default function HotelDirectoryPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-900">…</div>}>
      <HotelDirectoryContent />
    </Suspense>
  );
}
