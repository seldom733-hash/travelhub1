"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import SortableHeader, { type SortDirection, type SortState } from "@/components/SortableHeader";

interface HotelRow { id: string; name: string; suppliers: string[]; countryCode?: string; countryName?: string; cityName?: string; resortName?: string; stars?: number | null; categoryLabel?: string | null }

export default function HotelsReferencePage() {
  const locale = useLocale();
  const [rows, setRows] = useState<HotelRow[]>([]);
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sort, setSort] = useState<SortState | null>({ sortBy: "name", sortDirection: "asc" });
  const tr = (ru: string, az: string, en: string) => (locale === "az" ? az : locale === "en" ? en : ru);

  useEffect(() => {
    api.get<HotelRow[]>(`/hotel-directory/hotels?limit=2000`)
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError((e as Error).message));
  }, []);

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
  const onSort = (field: string, direction: SortDirection) => setSort({ sortBy: field, sortDirection: direction });

  function exportXls() {
    const head = ["ID", tr("Наименование", "Ad", "Name"), tr("Страна", "Ölkə", "Country"), tr("Город/курорт", "Şəhər/kurort", "City/resort"), tr("Категория", "Kateqoriya", "Category"), tr("Поставщики", "Təchizatçılar", "Suppliers")];
    const body = sorted.map((r) => [r.id, r.name, r.countryName ?? "", r.cityName ?? "", r.categoryLabel ?? (r.stars ? String(r.stars) : ""), (r.suppliers ?? []).join(", ")]);
    const html = `<table><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr>${body.map((row) => `<tr>${row.map((c) => `<td>${String(c).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</td>`).join("")}</tr>`).join("")}</table>`;
    const url = URL.createObjectURL(new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "hotels.xls"; a.click(); URL.revokeObjectURL(url);
  }

  function importFile(file: File) {
    setNotice(tr("Файл выбран: ", "Fayl seçildi: ", "File selected: ") + file.name + ". " + tr("Импорт ожидает серверную обработку.", "İdxal server emalını gözləyir.", "Import awaits server processing."));
  }

  return <div className="space-y-4 p-4 lg:p-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">{tr("Отели", "Otellər", "Hotels")}</h1><p className="mt-1 text-sm text-slate-500">{tr("Справочник отелей поставщиков Anex, Kompas, Summer, Kazunion и Voyager.", "Anex, Kompas, Summer, Kazunion və Voyager təchizatçılarının otel lüğəti.", "Hotel directory of Anex, Kompas, Summer, Kazunion and Voyager.")}</p></div>
      <div className="flex gap-2"><button type="button" onClick={exportXls} className="rounded-lg border px-3 py-2 text-xs font-medium">{tr("Экспорт XLS", "XLS ixracı", "Export XLS")}</button><label className="cursor-pointer rounded-lg bg-[#0f6b5f] px-3 py-2 text-xs font-semibold text-white">{tr("Импорт XLS", "XLS idxalı", "Import XLS")}<input type="file" accept=".xls,.xlsx,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); }} /></label></div>
    </div>
    {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
    {notice && <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</div>}
    <div className="flex flex-wrap gap-2 rounded-xl border bg-white p-3">
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Поиск по названию отеля", "Otel adına görə axtar", "Search by hotel name")} className="min-w-64 flex-1 rounded-lg border px-3 py-2 text-sm" />
      <select value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="">{tr("Все страны", "Bütün ölkələr", "All countries")}</option>{countries.map((c) => <option key={c}>{c}</option>)}</select>
      <span className="self-center text-xs text-slate-500">{filtered.length}</span>
    </div>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[820px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>
      <SortableHeader field="id" currentSort={sort} onSort={onSort} padX="px-3">ID</SortableHeader>
      <SortableHeader field="name" currentSort={sort} onSort={onSort} padX="px-3">{tr("Наименование", "Ad", "Name")}</SortableHeader>
      <SortableHeader field="country" currentSort={sort} onSort={onSort} padX="px-3">{tr("Страна", "Ölkə", "Country")}</SortableHeader>
      <SortableHeader field="city" currentSort={sort} onSort={onSort} padX="px-3">{tr("Город/курорт", "Şəhər/kurort", "City/resort")}</SortableHeader>
      <SortableHeader field="category" currentSort={sort} onSort={onSort} padX="px-3">{tr("Категория", "Kateqoriya", "Category")}</SortableHeader>
      <th className="px-3 py-2 font-medium">{tr("Поставщики", "Təchizatçılar", "Suppliers")}</th>
    </tr></thead><tbody>{sorted.map((r) => <tr key={r.id} className="border-t"><td className="px-3 py-2 font-mono text-slate-500">{r.id}</td><td className="px-3 py-2 font-medium">{r.name}</td><td className="px-3 py-2">{r.countryName ?? "—"}</td><td className="px-3 py-2">{r.cityName ?? "—"}</td><td className="px-3 py-2">{r.categoryLabel ?? (r.stars != null ? `${r.stars}*` : "—")}</td><td className="px-3 py-2">{r.suppliers.join(", ") || "—"}</td></tr>)}</tbody></table></div>
  </div>;
}
