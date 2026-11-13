"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";

interface Entry { id: string; code: string; names: Record<string, string>; status?: string }
interface Data { mealTypes: Entry[]; roomTypes: Entry[]; placementTypes: Entry[]; viewTypes: Entry[]; pendingRoomTypes?: Entry[] }

export default function DictionariesPage() {
  const locale = useLocale();
  const [data, setData] = useState<Data>({ mealTypes: [], roomTypes: [], placementTypes: [], viewTypes: [] });
  const [countries, setCountries] = useState<Entry[]>([]);
  const [cities, setCities] = useState<Entry[]>([]);
  const [countryId, setCountryId] = useState("");
  const [error, setError] = useState("");
  const tr = (ru: string, az: string, en: string) => (locale === "az" ? az : locale === "en" ? en : ru);

  useEffect(() => {
    Promise.all([
      api.get<Data>("/tour-builder/dictionaries"),
      api.get<any>("/geo/countries"),
    ]).then(([dict, geo]) => {
      setData(dict);
      setCountries(Array.isArray(geo) ? geo : geo?.value ?? []);
    }).catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    if (!countryId) { setCities([]); return; }
    api.get<any>(`/geo/cities?countryId=${countryId}`).then((geo) => setCities(Array.isArray(geo) ? geo : geo?.value ?? [])).catch(() => setCities([]));
  }, [countryId]);

  const name = (entry: Entry) => entry.names[locale] ?? entry.names.ru ?? entry.names.en ?? entry.code;
  const table = (title: string, rows: Entry[]) => <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b px-4 py-3 text-sm font-semibold">{title}</div><div className="max-h-80 overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="px-4 py-2">{tr("Код", "Kod", "Code")}</th><th className="px-4 py-2">{tr("Название", "Ad", "Name")}</th><th className="px-4 py-2">{tr("Статус", "Status", "Status")}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t"><td className="px-4 py-2 font-mono">{row.code}</td><td className="px-4 py-2">{name(row)}</td><td className="px-4 py-2">{row.status ?? "ACTIVE"}</td></tr>)}</tbody></table></div></section>;

  return <div className="space-y-4 p-4 lg:p-6">
    <div><h1 className="text-2xl font-semibold">{tr("Справочники", "Lüğətlər", "Dictionaries")}</h1><p className="mt-1 text-sm text-slate-500">{tr("Единые справочники платформы. Значения используются при создании запросов.", "Platformanın vahid lüğətləri. Sorğu yaradarkən istifadə olunur.", "Platform dictionaries used when creating requests.")}</p></div>
    {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold">{tr("Страны и города", "Ölkələr və şəhərlər", "Countries and cities")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs">{tr("Страна", "Ölkə", "Country")}<select className="rounded-lg border px-3 py-2" value={countryId} onChange={(e) => setCountryId(e.target.value)}><option value="">{tr("Все страны", "Bütün ölkələr", "All countries")}</option>{countries.map((c) => <option key={c.id} value={c.id}>{name(c)}</option>)}</select></label>
        <label className="grid gap-1 text-xs">{tr("Города", "Şəhərlər", "Cities")}<select className="rounded-lg border px-3 py-2" disabled={!countryId}><option>{countryId ? tr("Выберите город", "Şəhər seçin", "Select city") : tr("Сначала выберите страну", "Əvvəlcə ölkə seçin", "Select country first")}</option>{cities.map((c) => <option key={c.id}>{name(c)}</option>)}</select></label>
      </div>
    </section>
    <div className="grid gap-4 xl:grid-cols-2">
      {table(tr("Типы питания", "Qidalanma növləri", "Meal types"), data.mealTypes)}
      {table(tr("Типы размещения", "Yerləşmə növləri", "Accommodation types"), data.placementTypes)}
      {table(tr("Типы номеров", "Otaq növləri", "Room types"), data.roomTypes)}
      {table(tr("Виды из номера", "Mənzərə növləri", "View types"), data.viewTypes)}
    </div>
  </div>;
}
