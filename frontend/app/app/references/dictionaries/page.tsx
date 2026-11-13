"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";

interface Entry { id: string; code: string; names: Record<string, string>; status?: string }
interface Data { mealTypes: Entry[]; roomTypes: Entry[]; placementTypes: Entry[]; viewTypes: Entry[]; airlineClasses: Entry[]; baggageAllowances: Entry[]; pendingRoomTypes?: Entry[] }

export default function DictionariesPage() {
  const locale = useLocale();
  const canManage = useCan("catalog.dictionary.manage");
  const [data, setData] = useState<Data>({ mealTypes: [], roomTypes: [], placementTypes: [], viewTypes: [], airlineClasses: [], baggageAllowances: [] });
  const [countries, setCountries] = useState<Entry[]>([]);
  const [cities, setCities] = useState<Entry[]>([]);
  const [countryId, setCountryId] = useState("");
  const [error, setError] = useState("");
  const [addType, setAddType] = useState("room-types");
  const [addName, setAddName] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addNotice, setAddNotice] = useState("");
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
  async function refresh() {
    const dict = await api.get<Data>("/tour-builder/dictionaries");
    setData(dict);
  }
  async function editEntry(type: string, entry: Entry) {
    const next = window.prompt(tr("Новое название", "Yeni ad", "New name"), name(entry));
    if (!next?.trim()) return;
    setError("");
    try {
      await api.patch(`/tour-builder/dictionaries/${type}/${entry.id}`, { name: next.trim(), lang: locale === "az" ? "az" : locale === "en" ? "en" : "ru" });
      await refresh();
    } catch (e) { setError((e as Error).message); }
  }
  async function removeEntry(type: string, entry: Entry) {
    if (!window.confirm(tr("Удалить запись?", "Qeydi silmək?", "Delete this entry?"))) return;
    setError("");
    try {
      await api.del(`/tour-builder/dictionaries/${type}/${entry.id}`);
      await refresh();
    } catch (e) { setError((e as Error).message); }
  }
  async function addEntry() {
    setAddNotice(""); setError("");
    if (addName.trim().length < 2) { setError(tr("Введите название (минимум 2 символа)", "Ad daxil edin (ən azı 2 simvol)", "Enter a name (at least 2 characters)")); return; }
    setAddBusy(true);
    try {
      await api.post("/tour-builder/dictionaries/entries", { type: addType, name: addName.trim(), lang: locale === "az" ? "az" : locale === "en" ? "en" : "ru" });
      setAddName("");
      setAddNotice(tr("Запись добавлена в базу", "Qeyd bazaya əlavə edildi", "Entry added to the database"));
      const dict = await api.get<Data>("/tour-builder/dictionaries");
      setData(dict);
    } catch (e) { setError((e as Error).message); } finally { setAddBusy(false); }
  }
  const table = (title: string, rows: Entry[], type: string) => <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b px-4 py-3 text-sm font-semibold">{title}</div><div className="max-h-80 overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="px-4 py-2">{tr("Код", "Kod", "Code")}</th><th className="px-4 py-2">{tr("Название", "Ad", "Name")}</th><th className="px-4 py-2">{tr("Статус", "Status", "Status")}</th>{canManage && <th className="px-4 py-2">{tr("Действия", "Əməliyyatlar", "Actions")}</th>}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t"><td className="px-4 py-2 font-mono">{row.code}</td><td className="px-4 py-2">{name(row)}</td><td className="px-4 py-2">{row.status ?? "ACTIVE"}</td>{canManage && <td className="px-4 py-2"><div className="flex gap-2"><button type="button" title={tr("Редактировать", "Redaktə et", "Edit")} onClick={() => void editEntry(type, row)} className="text-[#0f6b5f]">✎</button><button type="button" title={tr("Удалить", "Sil", "Delete")} onClick={() => void removeEntry(type, row)} className="text-rose-600">✕</button></div></td>}</tr>)}</tbody></table></div></section>;

  return <div className="space-y-4 p-4 lg:p-6">
    <div><h1 className="text-2xl font-semibold">{tr("Справочники", "Lüğətlər", "Dictionaries")}</h1><p className="mt-1 text-sm text-slate-500">{tr("Единые справочники платформы. Значения используются при создании запросов.", "Platformanın vahid lüğətləri. Sorğu yaradarkən istifadə olunur.", "Platform dictionaries used when creating requests.")}</p></div>
    {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
    {canManage && <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold">{tr("Добавить новый тип", "Yeni növ əlavə et", "Add a new type")}</h2>
      <p className="mb-3 text-xs text-slate-500">{tr("Запись сразу сохраняется в базе. Доступно только администратору. Дубли и опечатки проверяются автоматически.", "Qeyd dərhal bazada saxlanılır. Yalnız administrator üçün. Dublikatlar və yazı səhvləri avtomatik yoxlanılır.", "The entry is saved immediately. Admin only. Duplicates and typos are checked automatically.")}</p>
      <div className="grid gap-2 sm:grid-cols-[220px_1fr_auto]">
        <select className="rounded-lg border px-3 py-2 text-sm" value={addType} onChange={(e) => setAddType(e.target.value)}>
          <option value="room-types">{tr("Типы номеров", "Otaq növləri", "Room types")}</option>
          <option value="placement-types">{tr("Типы размещения", "Yerləşmə növləri", "Accommodation types")}</option>
          <option value="meal-types">{tr("Типы питания", "Qidalanma növləri", "Meal types")}</option>
          <option value="view-types">{tr("Виды из номера", "Mənzərə növləri", "View types")}</option>
          <option value="airline-classes">{tr("Классы авиабилетов", "Aviabilet sinifləri", "Airline classes")}</option>
          <option value="baggage-allowances">{tr("Нормы багажа", "Baqaj normaları", "Baggage allowances")}</option>
        </select>
        <input className="rounded-lg border px-3 py-2 text-sm" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder={tr("Название нового типа", "Yeni növün adı", "New type name")} />
        <button type="button" disabled={addBusy} onClick={() => void addEntry()} className="rounded-lg bg-[#0f6b5f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{addBusy ? tr("Проверка…", "Yoxlanılır…", "Checking…") : tr("Добавить", "Əlavə et", "Add")}</button>
      </div>
      {addNotice && <div className="mt-2 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{addNotice}</div>}
    </section>}
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold">{tr("Страны и города", "Ölkələr və şəhərlər", "Countries and cities")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs">{tr("Страна", "Ölkə", "Country")}<select className="rounded-lg border px-3 py-2" value={countryId} onChange={(e) => setCountryId(e.target.value)}><option value="">{tr("Все страны", "Bütün ölkələr", "All countries")}</option>{countries.map((c) => <option key={c.id} value={c.id}>{name(c)}</option>)}</select></label>
        <label className="grid gap-1 text-xs">{tr("Города", "Şəhərlər", "Cities")}<select className="rounded-lg border px-3 py-2" disabled={!countryId}><option>{countryId ? tr("Выберите город", "Şəhər seçin", "Select city") : tr("Сначала выберите страну", "Əvvəlcə ölkə seçin", "Select country first")}</option>{cities.map((c) => <option key={c.id}>{name(c)}</option>)}</select></label>
      </div>
    </section>
    <div className="grid gap-4 xl:grid-cols-2">
      {table(tr("Типы питания", "Qidalanma növləri", "Meal types"), data.mealTypes, "meal-types")}
      {table(tr("Типы размещения", "Yerləşmə növləri", "Accommodation types"), data.placementTypes, "placement-types")}
      {table(tr("Типы номеров", "Otaq növləri", "Room types"), data.roomTypes, "room-types")}
      {table(tr("Виды из номера", "Mənzərə növləri", "View types"), data.viewTypes, "view-types")}
      {table(tr("Классы авиабилетов", "Aviabilet sinifləri", "Airline classes"), data.airlineClasses, "airline-classes")}
      {table(tr("Нормы багажа", "Baqaj normaları", "Baggage allowances"), data.baggageAllowances, "baggage-allowances")}
    </div>
  </div>;
}
