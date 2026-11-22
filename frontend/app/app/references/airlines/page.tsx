"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";

interface Entry {
  id: string;
  code: string;
  names: Record<string, string>;
  status?: string;
}

interface Dictionaries {
  airlineClasses: Entry[];
  baggageAllowances: Entry[];
}

export default function AirlineReferencesPage() {
  const locale = useLocale();
  const canManage = useCan("catalog.dictionary.manage");
  const [data, setData] = useState<Dictionaries>({ airlineClasses: [], baggageAllowances: [] });
  const [error, setError] = useState("");
  const [type, setType] = useState<"airline-classes" | "baggage-allowances">("airline-classes");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const tr = (ru: string, az: string, en: string) => (locale === "az" ? az : locale === "en" ? en : ru);

  async function load() {
    try {
      const dict = await api.get<Dictionaries>("/tour-builder/dictionaries");
      setData({ airlineClasses: dict.airlineClasses ?? [], baggageAllowances: dict.baggageAllowances ?? [] });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => { void load(); }, []);

  const label = (row: Entry) => row.names[locale] ?? row.names.ru ?? row.names.en ?? row.code;

  async function add() {
    if (!code.trim() || !name.trim()) {
      setError(tr("Укажите код и название", "Kod və ad daxil edin", "Enter code and name"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const lang = locale === "az" ? "az" : locale === "en" ? "en" : "ru";
      await api.post("/tour-builder/dictionaries/entries", { type, code: code.trim().toUpperCase(), name: name.trim(), lang });
      setCode("");
      setName("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function edit(current: Entry) {
    const next = window.prompt(tr("Новое название", "Yeni ad", "New name"), label(current));
    if (!next?.trim()) return;
    try {
      await api.patch(`/tour-builder/dictionaries/${current.id ? (data.airlineClasses.includes(current) ? "airline-classes" : "baggage-allowances") : type}/${current.id}`, { name: next.trim(), lang: locale === "az" ? "az" : locale === "en" ? "en" : "ru" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(current: Entry, entryType: "airline-classes" | "baggage-allowances") {
    if (!window.confirm(tr("Удалить запись?", "Qeydi silmək?", "Delete this entry?"))) return;
    try {
      await api.del(`/tour-builder/dictionaries/${entryType}/${current.id}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const table = (title: string, rows: Entry[], entryType: "airline-classes" | "baggage-allowances") => (
    <section className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      <div className="border-b border-line px-4 py-3 text-sm font-semibold">{title}</div>
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-panel text-ink/60">
            <tr><th className="px-4 py-2">Код</th><th className="px-4 py-2">{tr("Название", "Ad", "Name")}</th><th className="px-4 py-2">{tr("Статус", "Status", "Status")}</th>{canManage && <th className="px-4 py-2">{tr("Действия", "Əməliyyatlar", "Actions")}</th>}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-4 py-2 font-mono">{row.code}</td>
                <td className="px-4 py-2">{label(row)}</td>
                <td className="px-4 py-2">{row.status ?? "ACTIVE"}</td>
                {canManage && <td className="px-4 py-2"><div className="flex gap-2"><button type="button" onClick={() => void edit(row)} className="text-brand" title={tr("Редактировать", "Redaktə et", "Edit")}>✎</button><button type="button" onClick={() => void remove(row, entryType)} className="text-rose-600" title={tr("Удалить", "Sil", "Delete")}>✕</button></div></td>}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={canManage ? 4 : 3} className="px-4 py-8 text-center text-ink/60">{tr("Записей нет", "Qeyd yoxdur", "No records")}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );

  return <div className="space-y-4 p-4 lg:p-6">
    <PageHeader title={tr("Авиабилеты", "Aviabiletlər", "Airline tickets")} breadcrumbs={["Navitravel", tr("Справочники", "Lüğətlər", "Dictionaries"), tr("Авиабилеты", "Aviabiletlər", "Airline tickets")]} />
    {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
    {canManage && <section className="rounded-xl border border-line bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold">{tr("Добавить элемент", "Element əlavə et", "Add element")}</h2>
      <div className="grid gap-2 sm:grid-cols-[220px_140px_1fr_auto]">
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="rounded-lg border px-3 py-2 text-sm">
          <option value="airline-classes">{tr("Классы авиабилетов", "Aviabilet sinifləri", "Airline classes")}</option>
          <option value="baggage-allowances">{tr("Нормы багажа", "Baqaj normaları", "Baggage allowances")}</option>
        </select>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={tr("Код", "Kod", "Code")} className="rounded-lg border px-3 py-2 font-mono text-sm" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Название", "Ad", "Name")} className="rounded-lg border px-3 py-2 text-sm" />
        <button type="button" disabled={busy} onClick={() => void add()} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{tr("Добавить", "Əlavə et", "Add")}</button>
      </div>
    </section>}
    <div className="grid gap-4 xl:grid-cols-2">
      {table(tr("Классы авиабилетов", "Aviabilet sinifləri", "Airline classes"), data.airlineClasses, "airline-classes")}
      {table(tr("Нормы багажа", "Baqaj normaları", "Baggage allowances"), data.baggageAllowances, "baggage-allowances")}
    </div>
  </div>;
}
