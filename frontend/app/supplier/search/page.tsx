"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";
import {
  searchSupplierOffers,
  listSupplierAdapters,
  type SupplierOffer,
  type SupplierAdapterInfo,
  type SupplierSearchParams,
} from "@/lib/supplier-api";

const COUNTRIES = [
  { value: "turkey", label: "Турция" },
  { value: "georgia", label: "Грузия" },
  { value: "uae", label: "ОАЭ" },
  { value: "egypt", label: "Египет" },
];

const MEALS = [
  { value: "bb", label: "BB (Завтрак)" },
  { value: "hb", label: "HB (Полупансион)" },
  { value: "fb", label: "FB (Полный пансион)" },
  { value: "ai", label: "AI (Всё включено)" },
  { value: "uai", label: "UAI (Ультра All Inclusive)" },
];

const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm";
const labelCls = "block text-sm font-medium text-slate-700 mb-1";
const btnCls = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";

export default function SupplierSearchPage() {
  const locale = useLocale();
  const [adapters, setAdapters] = useState<SupplierAdapterInfo[]>([]);
  const [supplier, setSupplier] = useState("SUMMERTOUR");
  const [country, setCountry] = useState("turkey");
  const [departureCity, setDepartureCity] = useState("baku");
  const [departureDateFrom, setDepartureDateFrom] = useState("");
  const [departureDateTo, setDepartureDateTo] = useState("");
  const [nightsFrom, setNightsFrom] = useState("7");
  const [nightsTo, setNightsTo] = useState("10");
  const [adults, setAdults] = useState("2");
  const [children, setChildren] = useState("0");
  const [meal, setMeal] = useState("");
  const [page, setPage] = useState(1);

  const [offers, setOffers] = useState<SupplierOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTime, setSearchTime] = useState(0);

  useEffect(() => {
    listSupplierAdapters().then(setAdapters).catch(() => {});
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setOffers([]);
    setPage(1);

    const params: SupplierSearchParams = {
      supplier,
      country,
      departureCity,
      departureDateFrom: departureDateFrom || undefined,
      departureDateTo: departureDateTo || undefined,
      nightsFrom: nightsFrom ? parseInt(nightsFrom, 10) : undefined,
      nightsTo: nightsTo ? parseInt(nightsTo, 10) : undefined,
      adults: adults ? parseInt(adults, 10) : 2,
      children: children ? parseInt(children, 10) : 0,
      meal: meal || undefined,
      page: 1,
    };

    try {
      const start = Date.now();
      const results = await searchSupplierOffers(params);
      setSearchTime(Date.now() - start);
      setOffers(results);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPage(newPage: number) {
    setPage(newPage);
    setLoading(true);
    try {
      const params: SupplierSearchParams = {
        supplier,
        country,
        departureCity,
        departureDateFrom: departureDateFrom || undefined,
        departureDateTo: departureDateTo || undefined,
        nightsFrom: nightsFrom ? parseInt(nightsFrom, 10) : undefined,
        nightsTo: nightsTo ? parseInt(nightsTo, 10) : undefined,
        adults: adults ? parseInt(adults, 10) : 2,
        children: children ? parseInt(children, 10) : 0,
        meal: meal || undefined,
        page: newPage,
      };
      const results = await searchSupplierOffers(params);
      setOffers(results);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">
          {locale === "ru" ? "Поиск туров у поставщика" : locale === "az" ? "Təchizatçıda tur axtarışı" : "Supplier Tour Search"}
        </h1>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Поставщик</label>
              <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputCls}>
                {adapters.map((a) => (
                  <option key={a.code} value={a.code} disabled={!a.enabled}>
                    {a.name}
                  </option>
                ))}
                {adapters.length === 0 && <option value="SUMMERTOUR">Summertour</option>}
              </select>
            </div>

            <div>
              <label className={labelCls}>Страна</label>
              <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls}>
                {COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Город вылета</label>
              <input type="text" value={departureCity} onChange={(e) => setDepartureCity(e.target.value)} className={inputCls} placeholder="baku" />
            </div>

            <div>
              <label className={labelCls}>Питание</label>
              <select value={meal} onChange={(e) => setMeal(e.target.value)} className={inputCls}>
                <option value="">Любое</option>
                {MEALS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Дата вылета от</label>
              <input type="date" value={departureDateFrom} onChange={(e) => setDepartureDateFrom(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Дата вылета до</label>
              <input type="date" value={departureDateTo} onChange={(e) => setDepartureDateTo(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Ночей от</label>
              <input type="number" min="1" max="30" value={nightsFrom} onChange={(e) => setNightsFrom(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Ночей до</label>
              <input type="number" min="1" max="30" value={nightsTo} onChange={(e) => setNightsTo(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Взрослые</label>
              <input type="number" min="1" max="8" value={adults} onChange={(e) => setAdults(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Дети</label>
              <input type="number" min="0" max="4" value={children} onChange={(e) => setChildren(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={loading} className={btnCls}>
              {loading ? "Поиск..." : "Найти туры"}
            </button>
            {searchTime > 0 && (
              <span className="self-center text-sm text-slate-500">
                {searchTime}мс • {offers.length} офферов
              </span>
            )}
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {offers.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Отель</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Вылет</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Ночей</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Питание</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Номер</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-700">Цена</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-700">Места</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Транспорт</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {offers.map((o) => (
                    <tr key={`${o.externalOfferId}-${o.departureDate}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{o.hotel}</div>
                        {o.tour && <div className="text-xs text-slate-500">{o.tour}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{o.departureDate}</td>
                      <td className="px-4 py-3 text-slate-700">{o.nights}</td>
                      <td className="px-4 py-3 text-slate-700">{o.meal ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{o.room ?? "-"}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {o.price.amount.toLocaleString()} {o.price.currency}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            o.availability === "AVAILABLE"
                              ? "bg-green-50 text-green-700"
                              : o.availability === "NOT_AVAILABLE"
                                ? "bg-red-50 text-red-700"
                                : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {o.availability === "AVAILABLE" ? "Есть" : o.availability === "NOT_AVAILABLE" ? "Нет" : "?"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 text-xs">{o.transport ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-center gap-2 p-4 border-t border-slate-200">
              <button disabled={page <= 1} onClick={() => loadPage(page - 1)} className={btnCls + " text-xs"}>
                Назад
              </button>
              <span className="self-center text-sm text-slate-600">Стр. {page}</span>
              <button disabled={offers.length < 100} onClick={() => loadPage(page + 1)} className={btnCls + " text-xs"}>
                Далее
              </button>
            </div>
          </div>
        )}

        {!loading && offers.length === 0 && !error && (
          <div className="text-center text-slate-500 py-12">
            Укажите параметры поиска и нажмите «Найти туры»
          </div>
        )}
      </div>
    </div>
  );
}
