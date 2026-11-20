"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useCan } from "@/lib/use-can";
import { hotelDirectoryApi } from "@/lib/hotel-directory-api";
import { useLocale } from "@/lib/i18n";
import SortableHeader, { type SortDirection, type SortState } from "@/components/SortableHeader";

interface HotelRow {
  id: string;
  name: string;
  countryCode?: string;
  countryName?: string;
  cityName?: string;
  resortName?: string;
  stars?: number | null;
  categoryLabel?: string | null;
}

export default function HotelCatalogueTab() {
  const locale = useLocale();
  const canCreate = useCan("hotel_directory.create");
  const [rows, setRows] = useState<HotelRow[]>([]);
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", countryName: "", cityName: "", stars: "" });
  const [sort, setSort] = useState<SortState | null>({ sortBy: "name", sortDirection: "asc" });
  const tr = (ru: string, az: string, en: string) => (locale === "az" ? az : locale === "en" ? en : ru);

  const loadHotels = () => {
    api.get<HotelRow[]>("/hotel-directory/hotels?limit=2000")
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError((e as Error).message));
  };

  useEffect(() => { loadHotels(); }, []);

  async function createHotel() {
    if (!form.name.trim()) { setError(tr("Укажите название отеля", "Otel adını daxil edin", "Enter hotel name")); return; }
    setSaving(true); setError("");
    try {
      await hotelDirectoryApi.createHotel({
        name: form.name.trim(),
        countryName: form.countryName.trim() || undefined,
        countryCode: form.countryName.trim().slice(0, 2).toUpperCase() || undefined,
        cityName: form.cityName.trim() || undefined,
        stars: form.stars ? Number(form.stars) : null,
      });
      setShowForm(false);
      setForm({ name: "", countryName: "", cityName: "", stars: "" });
      loadHotels();
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }

  const countries = useMemo(() => [...new Set(rows.map((r) => r.countryName).filter(Boolean))].sort() as string[], [rows]);
  const filtered = useMemo(() => rows.filter((r) => (!country || r.countryName === country) && (!search.trim() || r.name.toLowerCase().includes(search.trim().toLowerCase()))), [rows, country, search]);
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const dir = sort.sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const value = (row: HotelRow) => sort.sortBy === "id" ? row.id : sort.sortBy === "country" ? row.countryName ?? "" : sort.sortBy === "city" ? row.cityName ?? "" : sort.sortBy === "category" ? (row.categoryLabel ?? (row.stars != null ? String(row.stars) : "")) : row.name;
      return String(value(a)).localeCompare(String(value(b)), undefined, { numeric: true, sensitivity: "base" }) * dir;
    });
  }, [filtered, sort]);

  function exportXls() {
    const head = ["ID", tr("Наименование", "Ad", "Name"), tr("Страна", "Ölkə", "Country"), tr("Город/курорт", "Şəhər/kurort", "City/resort"), tr("Категория", "Kateqoriya", "Category")];
    const body = sorted.map((r) => [r.id, r.name, r.countryName ?? "", r.cityName ?? "", r.categoryLabel ?? (r.stars != null ? String(r.stars) : "")]);
    const html = `<table><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr>${body.map((row) => `<tr>${row.map((c) => `<td>${String(c).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</td>`).join("")}</tr>`).join("")}</table>`;
    const url = URL.createObjectURL(new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "hotels.xls"; a.click(); URL.revokeObjectURL(url);
  }

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Поиск по названию отеля", "Otel adına görə axtar", "Search by hotel name")} className="w-72 rounded-lg border bg-white px-3 py-1.5 text-sm" />
        <select value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-lg border bg-white px-3 py-1.5 text-sm"><option value="">{tr("Все страны", "Bütün ölkələr", "All countries")}</option>{countries.map((c) => <option key={c}>{c}</option>)}</select>
        <span className="self-center text-xs text-ink/60">{sorted.length}</span>
      </div>
      <div className="flex items-center gap-2">
        {canCreate && (
          <button type="button" onClick={() => setShowForm(true)} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark">
            + {tr("Добавить отель", "Otel əlavə et", "Add hotel")}
          </button>
        )}
        <button type="button" onClick={exportXls} className="rounded-lg border px-3 py-1.5 text-xs font-medium">{tr("Экспорт XLS", "XLS ixracı", "Export XLS")}</button>
      </div>
    </div>
    <label className="inline-flex cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium">{tr("Импорт XLS", "XLS idxalı", "Import XLS")}<input type="file" accept=".xls,.xlsx,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setNotice(tr("Файл выбран: ", "Fayl seçildi: ", "File selected: ") + f.name); }} /></label>
    {notice && <div className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">{notice}</div>}
    {error && <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[820px] text-left text-xs"><thead className="bg-panel text-ink/60"><tr>
      <SortableHeader field="id" currentSort={sort} onSort={(field: string, direction: SortDirection) => setSort({ sortBy: field, sortDirection: direction })} padX="px-3">ID</SortableHeader>
      <SortableHeader field="name" currentSort={sort} onSort={(field: string, direction: SortDirection) => setSort({ sortBy: field, sortDirection: direction })} padX="px-3">{tr("Наименование", "Ad", "Name")}</SortableHeader>
      <SortableHeader field="country" currentSort={sort} onSort={(field: string, direction: SortDirection) => setSort({ sortBy: field, sortDirection: direction })} padX="px-3">{tr("Страна", "Ölkə", "Country")}</SortableHeader>
      <SortableHeader field="city" currentSort={sort} onSort={(field: string, direction: SortDirection) => setSort({ sortBy: field, sortDirection: direction })} padX="px-3">{tr("Город/курорт", "Şəhər/kurort", "City/resort")}</SortableHeader>
      <SortableHeader field="category" currentSort={sort} onSort={(field: string, direction: SortDirection) => setSort({ sortBy: field, sortDirection: direction })} padX="px-3">{tr("Категория", "Kateqoriya", "Category")}</SortableHeader>
    </tr></thead><tbody>{sorted.map((r) => <tr key={r.id} className="border-t"><td className="px-3 py-2 font-mono text-ink/60">{r.id}</td><td className="px-3 py-2 font-medium">{r.name}</td><td className="px-3 py-2">{r.countryName ?? "—"}</td><td className="px-3 py-2">{r.cityName ?? "—"}</td><td className="px-3 py-2">{r.categoryLabel ?? (r.stars != null ? `${r.stars}*` : "—")}</td></tr>)}</tbody></table></div>

    {showForm && (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
        <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="mb-3 text-base font-semibold">{tr("Добавить отель", "Otel əlavə et", "Add hotel")}</h3>
          <div className="grid gap-2">
            <label className="grid gap-1 text-xs">{tr("Название", "Ad", "Name")}<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" /></label>
            <label className="grid gap-1 text-xs">{tr("Страна", "Ölkə", "Country")}<input value={form.countryName} onChange={(e) => setForm({ ...form, countryName: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" /></label>
            <label className="grid gap-1 text-xs">{tr("Город", "Şəhər", "City")}<input value={form.cityName} onChange={(e) => setForm({ ...form, cityName: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" /></label>
            <label className="grid gap-1 text-xs">{tr("Звёзды", "Ulduzlar", "Stars")}<input type="number" min="1" max="5" value={form.stars} onChange={(e) => setForm({ ...form, stars: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" /></label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-3 py-2 text-xs">{tr("Отмена", "Ləğv et", "Cancel")}</button>
            <button type="button" disabled={saving} onClick={() => void createHotel()} className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? tr("Сохранение…", "Yadda saxlanılır…", "Saving…") : tr("Сохранить", "Yadda saxla", "Save")}</button>
          </div>
        </div>
      </div>
    )}
  </div>;
}
