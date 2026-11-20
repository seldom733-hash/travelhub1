"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useLocale } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";
import { hotelDirectoryApi } from "@/lib/hotel-directory-api";

interface Airport { id: string; code: string; name: string; countryCode: string; countryName: string; cityName: string; countryNameRu: string; countryNameEn: string; cityNameRu: string; cityNameEn: string; status: string }

export default function AirportsPage() {
  const locale = useLocale();
  const canCreate = useCan("hotel_directory.create");
  const [rows, setRows] = useState<Airport[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ code: "", name: "", countryCode: "", countryName: "", cityName: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const tr = (ru: string, az: string, en: string) => (locale === "az" ? az : locale === "en" ? en : ru);
  const city = (row: Airport) => locale === "ru" ? (row.cityNameRu || row.cityName) : locale === "en" ? (row.cityNameEn || row.cityName) : row.cityName;
  const country = (row: Airport) => locale === "ru" ? (row.countryNameRu || row.countryName) : locale === "en" ? (row.countryNameEn || row.countryName) : row.countryName;

  async function load() { try { setRows(await hotelDirectoryApi.airports()); } catch (e) { setError((e as Error).message); } }
  useEffect(() => { void load(); }, []);

  async function add() {
    if (!form.code.trim()) { setError(tr("Укажите код аэропорта", "Aeroport kodunu daxil edin", "Enter airport code")); return; }
    setBusy(true); setError("");
    try {
      await hotelDirectoryApi.createAirport({
        code: form.code.trim().toUpperCase(),
        name: form.name.trim() || form.code.trim().toUpperCase(),
        countryCode: form.countryCode.trim().toUpperCase(),
        countryName: form.countryName.trim(),
        cityName: form.cityName.trim(),
      });
      setForm({ code: "", name: "", countryCode: "", countryName: "", cityName: "" });
      await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const filtered = rows.filter((row) => !search.trim() || `${row.code} ${row.name} ${city(row)} ${country(row)}`.toLowerCase().includes(search.trim().toLowerCase()));

  return <div>
    <PageHeader title={tr("Аэропорты", "Aeroportlar", "Airports")} breadcrumbs={["Navitravel", tr("Справочники", "Lüğətlər", "Dictionaries"), tr("Аэропорты", "Aeroportlar", "Airports")]} />
    <div className="space-y-4 p-4 lg:p-6">
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {canCreate && <div className="rounded-xl border border-line bg-white p-3">
        <div className="grid gap-2 sm:grid-cols-6">
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder={tr("Код (IATA)", "Kod (IATA)", "Code (IATA)")} className="rounded-lg border px-3 py-2 text-sm font-mono" />
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={tr("Название аэропорта", "Aeroportun adı", "Airport name")} className="rounded-lg border px-3 py-2 text-sm sm:col-span-2" />
          <input value={form.cityName} onChange={(e) => setForm({ ...form, cityName: e.target.value })} placeholder={tr("Город", "Şəhər", "City")} className="rounded-lg border px-3 py-2 text-sm" />
          <input value={form.countryName} onChange={(e) => setForm({ ...form, countryName: e.target.value })} placeholder={tr("Страна", "Ölkə", "Country")} className="rounded-lg border px-3 py-2 text-sm" />
          <input value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })} placeholder={tr("Код страны", "Ölkə kodu", "Country code")} className="rounded-lg border px-3 py-2 text-sm" />
        </div>
        <button type="button" disabled={busy} onClick={() => void add()} className="mt-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{tr("Добавить", "Əlavə et", "Add")}</button>
      </div>}
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Поиск по коду, городу, стране", "Kod, şəhər, ölkə üzrə axtar", "Search by code, city, country")} className="w-full max-w-md rounded-lg border bg-white px-3 py-2 text-sm" />
      <div className="overflow-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-panel text-ink/60"><tr><th className="px-4 py-2">Code</th><th className="px-4 py-2">{tr("Аэропорт", "Aeroport", "Airport")}</th><th className="px-4 py-2">{tr("Город", "Şəhər", "City")}</th><th className="px-4 py-2">{tr("Страна", "Ölkə", "Country")}</th><th className="px-4 py-2">Status</th></tr></thead>
          <tbody>{filtered.map((row) => <tr key={row.id} className="border-t"><td className="px-4 py-2 font-mono font-semibold">{row.code}</td><td className="px-4 py-2">{row.name}</td><td className="px-4 py-2">{city(row) || "—"}</td><td className="px-4 py-2">{country(row)} {row.countryCode ? `(${row.countryCode})` : ""}</td><td className="px-4 py-2">{row.status}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  </div>;
}
