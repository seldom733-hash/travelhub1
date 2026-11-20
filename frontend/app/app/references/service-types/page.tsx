"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useLocale } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";
import { hotelDirectoryApi } from "@/lib/hotel-directory-api";

interface ServiceType { id: string; code: string; names: Record<string, string>; sortOrder: number; status: string }

export default function ServiceTypesPage() {
  const locale = useLocale();
  const canCreate = useCan("hotel_directory.create");
  const [rows, setRows] = useState<ServiceType[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const tr = (ru: string, az: string, en: string) => (locale === "az" ? az : locale === "en" ? en : ru);

  async function load() {
    try {
      const data = await hotelDirectoryApi.serviceTypes();
      setRows(data);
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { void load(); }, []);

  async function add() {
    if (!name.trim()) return;
    setBusy(true); setError("");
    try {
      const lang = locale === "az" ? "az" : locale === "en" ? "en" : "ru";
      await hotelDirectoryApi.createServiceType({ names: { ru: lang === "ru" ? name.trim() : "", en: lang === "en" ? name.trim() : "", az: lang === "az" ? name.trim() : "" } });
      setName("");
      await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return <div>
    <PageHeader title={tr("Типы услуг", "Xidmət növləri", "Service types")} breadcrumbs={["Navitravel", tr("Справочники", "Lüğətlər", "Dictionaries"), tr("Типы услуг", "Xidmət növləri", "Service types")]} />
    <div className="space-y-4 p-4 lg:p-6">
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {canCreate && <div className="flex flex-wrap gap-2 rounded-xl border border-line bg-white p-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Название услуги", "Xidmətin adı", "Service name")} className="min-w-64 flex-1 rounded-lg border px-3 py-2 text-sm" />
        <button type="button" disabled={busy} onClick={() => void add()} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{tr("Добавить услугу", "Xidmət əlavə et", "Add service")}</button>
      </div>}
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <table className="w-full text-left text-xs"><thead className="bg-panel text-ink/60"><tr><th className="px-4 py-2">Код</th><th className="px-4 py-2">{tr("Название", "Ad", "Name")}</th><th className="px-4 py-2">Status</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id} className="border-t"><td className="px-4 py-2 font-mono">{row.code}</td><td className="px-4 py-2">{row.names?.[locale] ?? row.names?.ru ?? row.code}</td><td className="px-4 py-2">{row.status}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  </div>;
}
