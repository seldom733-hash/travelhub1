"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { WorkspacePageSkeleton } from "@/components/internal/WorkspaceSkeletons";
import PageHeader from "@/components/PageHeader";
import PanelFrame from "@/components/PanelFrame";
import { api } from "@/lib/api";
import { useCan } from "@/lib/use-can";
import { useLocale } from "@/lib/i18n";

type ServiceType = string;

interface MarkupCell {
  supplierCode: string;
  serviceType: string;
  state: "CONFIGURED" | "NOT_CONFIGURED";
  rate: string;
  ruleCode: string | null;
  ruleVersion: number | null;
}
interface MarkupMatrix {
  services: string[];
  suppliers: Array<{ code: string; name: string; enabled: boolean }>;
  cells: MarkupCell[];
}
interface CommissionCell {
  supplierCode: string;
  serviceType: string;
  state: string;
  commissionType: string;
  rate: string | null;
  fixedAmount: string | null;
  calculationBase: string;
  ruleCode: string | null;
}
interface CommissionMatrix {
  services: string[];
  suppliers: Array<{ code: string; name: string; enabled: boolean }>;
  cells: CommissionCell[];
}
interface MarkupRule {
  id: string;
  code: string;
  supplierCode: string;
  serviceType: string;
  rate: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  version: number;
}
interface CommissionRule {
  id: string;
  code: string;
  supplierCode: string;
  serviceType: string;
  commissionType: string;
  rate: string | null;
  fixedAmount: string | null;
  fixedCurrency: string | null;
  calculationBase: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  version: number;
}
interface PricingRow {
  key: string;
  supplierCode: string;
  supplierName: string;
  serviceType: string;
  markup: MarkupCell | undefined;
  commission: CommissionCell | undefined;
  markupRule: MarkupRule | undefined;
  commissionRule: CommissionRule | undefined;
}
interface SupplierOption {
  code: string;
  name: string;
}
interface FormState {
  key?: string;
  supplierCode: string;
  serviceType: string;
  markupPercent: string;
  commissionPercent: string;
}

const EMPTY: FormState = { supplierCode: "", serviceType: "", markupPercent: "0", commissionPercent: "0" };
const LABELS: Record<string, { az: string; en: string }> = {
  "Наценки и комиссионные": { az: "Marjalar və komissiyalar", en: "Markups and commissions" },
  "Цены и правила": { az: "Qiymətlər və qaydalar", en: "Prices and rules" },
  "Обновить": { az: "Yenilə", en: "Refresh" },
  "Добавить правило": { az: "Qayda əlavə et", en: "Add rule" },
  "Услуга": { az: "Xidmət", en: "Service" },
  "Поставщик": { az: "Təchizatçı", en: "Supplier" },
  "Поиск": { az: "Axtarış", en: "Search" },
  "Все услуги": { az: "Bütün xidmətlər", en: "All services" },
  "Все поставщики": { az: "Bütün təchizatçılar", en: "All suppliers" },
  "Поиск по поставщику / услуге / стране": { az: "Təchizatçı / xidmət / ölkə üzrə axtar", en: "Search by supplier / service / country" },
  "Всего правил": { az: "Ümumi qaydalar", en: "Total rules" },
  "Страна / Регион": { az: "Ölkə / Region", en: "Country / Region" },
  "Наценка (Markup)": { az: "Əlavə (Markup)", en: "Markup" },
  "Комиссия (Commission)": { az: "Komissiya (Commission)", en: "Commission" },
  "Итоговое правило": { az: "Yekun qayda", en: "Final rule" },
  "Статус": { az: "Status", en: "Status" },
  "Все страны": { az: "Bütün ölkələr", en: "All countries" },
  "Активно": { az: "Aktiv", en: "Active" },
  "Черновик": { az: "Qaralama", en: "Draft" },
  "Не настроено": { az: "Qurulmayıb", en: "Not configured" },
  "Изменить": { az: "Dəyişdir", en: "Edit" },
  "Правил не найдено": { az: "Qayda tapılmadı", en: "No rules found" },
  "Как работает правило": { az: "Qayda necə işləyir", en: "How the rule works" },
  "Итоговая цена = цена поставщика × (1 + наценка). Комиссия — доход платформы, она не увеличивает цену для клиента.": { az: "Yekun qiymət = təchizatçı qiyməti × (1 + əlavə). Komissiya platformanın gəliridir və müştəri qiymətini artırmır.", en: "Final price = supplier price × (1 + markup). Commission is platform income and does not increase the client price." },
  "Пример: поставщик 1 000 AZN, наценка 2,50% → клиент 1 025 AZN; комиссия 7% → доход платформы 70 AZN.": { az: "Nümunə: təchizatçı 1 000 AZN, əlavə 2,50% → müştəri 1 025 AZN; komissiya 7% → platforma gəliri 70 AZN.", en: "Example: supplier 1,000 AZN, markup 2.50% → client 1,025 AZN; commission 7% → platform income 70 AZN." },
  "Изменить правило": { az: "Qaydanı dəyişdir", en: "Edit rule" },
  "Новое правило": { az: "Yeni qayda", en: "New rule" },
  "Выберите поставщика": { az: "Təchizatçı seçin", en: "Select supplier" },
  "Выберите услугу": { az: "Xidmət seçin", en: "Select service" },
  "Наценка (Markup), %": { az: "Əlavə (Markup), %", en: "Markup, %" },
  "Комиссия (Commission), %": { az: "Komissiya (Commission), %", en: "Commission, %" },
  "Увеличивает цену для клиента.": { az: "Müştəri qiymətini artırır.", en: "Increases the client price." },
  "Доход платформы, не увеличивает цену.": { az: "Platforma gəliri, qiyməti artırmır.", en: "Platform income, does not increase price." },
  "Отмена": { az: "Ləğv et", en: "Cancel" },
  "Сохранить": { az: "Saxla", en: "Save" },
  "Сохраняем…": { az: "Saxlanılır…", en: "Saving…" },
  "Наценка": { az: "Əlavə", en: "Markup" },
  "Комиссия": { az: "Komissiya", en: "Commission" },
  "Туры": { az: "Turlar", en: "Tours" },
  "Отели": { az: "Otellər", en: "Hotels" },
  "Авиабилеты": { az: "Aviabiletlər", en: "Flights" },
  "Санатории": { az: "Sanatoriyalar", en: "Sanatoriums" },
  "Визы": { az: "Vizalar", en: "Visas" },
  "Трансферы": { az: "Transferlər", en: "Transfers" },
  "Страхование": { az: "Sığorta", en: "Insurance" },
  "Экскурсии": { az: "Ekskursiyalar", en: "Excursions" },
};
function labelFor(locale: string, ru: string): string {
  if (locale === "az") return LABELS[ru]?.az ?? ru;
  if (locale === "en") return LABELS[ru]?.en ?? ru;
  return ru;
}
const SERVICE_LABELS: Record<string, string> = {
  tours: "Туры",
  hotels: "Отели",
  flights: "Авиабилеты",
  sanatoriums: "Санатории",
  visas: "Визы",
  transfers: "Трансферы",
  insurance: "Страхование",
  excursions: "Экскурсии",
};

const serviceLabel = (service: string, locale: string) => labelFor(locale, SERVICE_LABELS[service] ?? service);
const num = (value: string | null | undefined) => Number(value ?? 0);
const percent = (rate: string | null | undefined) => {
  const n = num(rate) * 100;
  if (!Number.isFinite(n)) return "0,00 %";
  return `${n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
};
const percentValue = (value: string) => {
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const rateToInput = (rate: string | null | undefined) =>
  String(Number((num(rate) * 100).toFixed(2)));
const decimalRate = (value: string) => String(percentValue(value) / 100);

function statusOf(row: PricingRow): "ACTIVE" | "DRAFT" | "EMPTY" {
  if (row.markupRule?.status === "ACTIVE" || row.commissionRule?.status === "ACTIVE") return "ACTIVE";
  if (row.markupRule?.status === "DRAFT" || row.commissionRule?.status === "DRAFT") return "DRAFT";
  return "EMPTY";
}

export default function MarkupAdminPage() {
  const locale = useLocale();
  const tr = (value: string) => labelFor(locale, value);
  const canManage = useCan("pricing.markup.manage");
  const [markupMatrix, setMarkupMatrix] = useState<MarkupMatrix | null>(null);
  const [commissionMatrix, setCommissionMatrix] = useState<CommissionMatrix | null>(null);
  const [markupRules, setMarkupRules] = useState<MarkupRule[]>([]);
  const [commissionRules, setCommissionRules] = useState<CommissionRule[]>([]);
  const [allowedSuppliers, setAllowedSuppliers] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [markup, commission, mr, cr, tourSuppliers, hotelSuppliers, flightSuppliers] = await Promise.all([
        api.get<MarkupMatrix>("/pricing/markup-matrix"),
        api.get<CommissionMatrix>("/pricing/commission-matrix"),
        api.get<{ items: MarkupRule[] }>("/pricing/markup-rules?pageSize=100"),
        api.get<{ items: CommissionRule[] }>("/pricing/commission-rules?pageSize=100"),
        api.get<SupplierOption[]>("/public/supplier/suppliers?service=tours"),
        api.get<SupplierOption[]>("/public/supplier/suppliers?service=hotels"),
        api.get<SupplierOption[]>("/public/supplier/suppliers?service=flights"),
      ]);
      setMarkupMatrix(markup);
      setCommissionMatrix(commission);
      setMarkupRules(mr.items ?? []);
      setCommissionRules(cr.items ?? []);
      setAllowedSuppliers({
        tours: new Set(tourSuppliers.map((s) => s.code)),
        hotels: new Set(hotelSuppliers.map((s) => s.code)),
        flights: new Set(flightSuppliers.map((s) => s.code)),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo<PricingRow[]>(() => {
    const suppliers = new Map<string, string>();
    for (const supplier of [...(markupMatrix?.suppliers ?? []), ...(commissionMatrix?.suppliers ?? [])]) {
      if (!suppliers.has(supplier.code)) suppliers.set(supplier.code, supplier.name);
    }
    const services = new Set<string>([...(markupMatrix?.services ?? []), ...(commissionMatrix?.services ?? [])]);
    const activeFor = <T extends { supplierCode: string; serviceType: string; status: string }>(rules: T[], supplier: string, service: string) =>
      rules.find((r) => r.supplierCode === supplier && r.serviceType === service && r.status === "ACTIVE") ??
      rules.find((r) => r.supplierCode === supplier && r.serviceType === service && r.status === "DRAFT");

    const result: PricingRow[] = [];
    for (const [supplierCode, supplierName] of suppliers) {
      for (const serviceType of services) {
        // Aviation suppliers (AZAL/Aviasales) must not appear for tours/hotels,
        // and tour/hotel suppliers must not appear for flights. The registry
        // of enabled suppliers is authoritative per service.
        const allowed = allowedSuppliers[serviceType];
        if (allowed && !allowed.has(supplierCode)) continue;
        const markup = markupMatrix?.cells.find((c) => c.supplierCode === supplierCode && c.serviceType === serviceType);
        const commission = commissionMatrix?.cells.find((c) => c.supplierCode === supplierCode && c.serviceType === serviceType);
        result.push({
          key: `${supplierCode}:${serviceType}`,
          supplierCode,
          supplierName,
          serviceType,
          markup,
          commission,
          markupRule: activeFor(markupRules, supplierCode, serviceType),
          commissionRule: activeFor(commissionRules, supplierCode, serviceType),
        });
      }
    }
    return result.sort((a, b) => a.serviceType.localeCompare(b.serviceType) || a.supplierName.localeCompare(b.supplierName));
  }, [markupMatrix, commissionMatrix, markupRules, commissionRules, allowedSuppliers]);

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (serviceFilter && row.serviceType !== serviceFilter) return false;
      if (supplierFilter && row.supplierCode !== supplierFilter) return false;
      if (!needle) return true;
      return `${row.supplierCode} ${row.supplierName} ${row.serviceType} ${serviceLabel(row.serviceType, locale)}`.toLowerCase().includes(needle);
    });
  }, [rows, serviceFilter, supplierFilter, search]);

  const openRow = (row: PricingRow) => {
    if (!canManage) return;
    setError("");
    setForm({
      key: row.key,
      supplierCode: row.supplierCode,
      serviceType: row.serviceType,
      markupPercent: rateToInput(row.markup?.rate),
      commissionPercent: rateToInput(row.commission?.rate),
    });
  };

  const save = async () => {
    if (!form) return;
    if (!form.supplierCode || !form.serviceType) {
      setError(tr("Выберите поставщика и услугу."));
      return;
    }
    const markupPercent = percentValue(form.markupPercent);
    const commissionPercent = percentValue(form.commissionPercent);
    if (markupPercent < 0 || markupPercent > 100 || commissionPercent < 0 || commissionPercent > 100) {
      setError(tr("Наценка и комиссия должны быть в диапазоне 0–100%."));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveMarkupRule(form.supplierCode, form.serviceType, markupPercent);
      await saveCommissionRule(form.supplierCode, form.serviceType, commissionPercent);
      setForm(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const saveMarkupRule = async (supplierCode: string, serviceType: string, markupPercent: number) => {
    const existing = markupRules.find((r) => r.supplierCode === supplierCode && r.serviceType === serviceType && r.status !== "ARCHIVED");
    const targetRate = decimalRate(String(markupPercent));
    if (markupPercent <= 0) {
      if (existing) await api.post(`/pricing/markup-rules/${existing.code}/archive`, {});
      return;
    }
    if (existing?.status === "DRAFT") {
      await api.patch(`/pricing/markup-rules/${existing.code}`, { rate: targetRate, expectedVersion: existing.version });
      await api.post(`/pricing/markup-rules/${existing.code}/activate`, {});
      return;
    }
    if (existing?.status === "ACTIVE" && num(existing.rate) === Number(targetRate)) return;
    if (existing) await api.post(`/pricing/markup-rules/${existing.code}/archive`, {});
    const created = await api.post<MarkupRule>("/pricing/markup-rules", { supplierCode, serviceType, rate: targetRate });
    await api.post(`/pricing/markup-rules/${created.code}/activate`, {});
  };

  const saveCommissionRule = async (supplierCode: string, serviceType: string, commissionPercent: number) => {
    const existing = commissionRules.find((r) => r.supplierCode === supplierCode && r.serviceType === serviceType && r.status !== "ARCHIVED");
    const targetRate = decimalRate(String(commissionPercent));
    if (commissionPercent <= 0) {
      if (existing) await api.post(`/pricing/commission-rules/${existing.code}/archive`, {});
      return;
    }
    if (existing?.status === "DRAFT") {
      await api.patch(`/pricing/commission-rules/${existing.code}`, {
        rate: targetRate,
        commissionType: "PERCENT",
        calculationBase: "SUPPLIER_BASE",
        expectedVersion: existing.version,
      });
      await api.post(`/pricing/commission-rules/${existing.code}/activate`, {});
      return;
    }
    if (existing?.status === "ACTIVE" && num(existing.rate) === Number(targetRate)) return;
    if (existing) await api.post(`/pricing/commission-rules/${existing.code}/archive`, {});
    const created = await api.post<CommissionRule>("/pricing/commission-rules", {
      supplierCode,
      serviceType,
      commissionType: "PERCENT",
      rate: targetRate,
      calculationBase: "SUPPLIER_BASE",
    });
    await api.post(`/pricing/commission-rules/${created.code}/activate`, {});
  };

  const suppliers = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) map.set(row.supplierCode, row.supplierName);
    return [...map.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);
  const services = useMemo(() => [...new Set(rows.map((r) => r.serviceType))].sort(), [rows]);

  if (loading) return <WorkspacePageSkeleton />;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHeader
        title={tr("Наценки и комиссионные")}
        breadcrumbs={["TravelHub", tr("Цены и правила"), tr("Наценки и комиссионные")]}
        actions={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              {tr("Обновить")}
            </button>
            {canManage && (
              <button type="button" onClick={() => setForm({ ...EMPTY })} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                + {tr("Добавить правило")}
              </button>
            )}
          </div>
        }
      />

      <div className="space-y-4 p-6">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="text-xs font-medium text-slate-600">
            <span className="mb-1 block">{tr("Услуга")}</span>
            <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="min-w-44 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
              <option value="">{tr("Все услуги")}</option>
              {services.map((service) => <option key={service} value={service}>{serviceLabel(service, locale)}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            <span className="mb-1 block">{tr("Поставщик")}</span>
            <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="min-w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
              <option value="">{tr("Все поставщики")}</option>
              {suppliers.map((supplier) => <option key={supplier.code} value={supplier.code}>{supplier.name}</option>)}
            </select>
          </label>
          <label className="min-w-64 flex-1 text-xs font-medium text-slate-600">
            <span className="mb-1 block">{tr("Поиск")}</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Поиск по поставщику / услуге / стране")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400" />
          </label>
          <span className="ml-auto text-xs text-slate-500">{tr("Всего правил")}: {visibleRows.length}</span>
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">№</th>
                  <th className="px-4 py-3 font-semibold">{tr("Услуга")}</th>
                  <th className="px-4 py-3 font-semibold">{tr("Поставщик")}</th>
                  <th className="px-4 py-3 font-semibold">{tr("Страна / Регион")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{tr("Наценка (Markup)")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{tr("Комиссия (Commission)")}</th>
                  <th className="px-4 py-3 font-semibold">{tr("Итоговое правило")}</th>
                  <th className="px-4 py-3 font-semibold">{tr("Статус")}</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => {
                  const status = statusOf(row);
                  const markup = num(row.markup?.rate) > 0 ? percent(row.markup?.rate) : "0,00 %";
                  const commission = num(row.commission?.rate) > 0 ? percent(row.commission?.rate) : "0,00 %";
                  const finalRule = num(row.markup?.rate) > 0 && num(row.commission?.rate) > 0
                    ? `${tr("Наценка")} ${markup} + ${tr("Комиссия")} ${commission}`
                    : num(row.markup?.rate) > 0
                      ? `${tr("Наценка")} ${markup}`
                      : num(row.commission?.rate) > 0
                        ? `${tr("Комиссия")} ${commission}`
                        : tr("Не настроено");
                  return (
                    <tr key={row.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80">
                      <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{serviceLabel(row.serviceType, locale)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{row.supplierName}</div>
                        <div className="font-mono text-[11px] text-slate-400">{row.supplierCode}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{tr("Все страны")}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => openRow(row)} disabled={!canManage} className="rounded-lg px-2 py-1 font-semibold text-slate-900 enabled:hover:bg-blue-50 disabled:cursor-default">
                          {markup}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => openRow(row)} disabled={!canManage} className="rounded-lg px-2 py-1 font-semibold text-slate-900 enabled:hover:bg-blue-50 disabled:cursor-default">
                          {commission}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          num(row.markup?.rate) > 0 || num(row.commission?.rate) > 0
                            ? "bg-amber-50 text-amber-800"
                            : "bg-slate-100 text-slate-500"
                        }`}>{finalRule}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                          status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700"
                            : status === "DRAFT"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-500"
                        }`}>
                          <span className={`size-1.5 rounded-full ${status === "ACTIVE" ? "bg-emerald-500" : status === "DRAFT" ? "bg-amber-500" : "bg-slate-400"}`} />
                          {status === "ACTIVE" ? tr("Активно") : status === "DRAFT" ? tr("Черновик") : tr("Не настроено")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManage && (
                          <button type="button" onClick={() => openRow(row)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                            {tr("Изменить")}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {visibleRows.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">{tr("Правил не найдено")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-4 text-sm text-slate-700">
          <div className="font-semibold text-slate-900">{tr("Как работает правило")}</div>
          <p className="mt-1 leading-6">
            {tr("Итоговая цена = цена поставщика × (1 + наценка). Комиссия — доход платформы, она не увеличивает цену для клиента.")}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {tr("Пример: поставщик 1 000 AZN, наценка 2,50% → клиент 1 025 AZN; комиссия 7% → доход платформы 70 AZN.")}
          </p>
        </section>
      </div>

      {form && (
        <PanelFrame title={form.key ? tr("Изменить правило") : tr("Новое правило")} subtitle={form.key ? `${form.supplierCode} · ${serviceLabel(form.serviceType, locale)}` : undefined} onClose={() => setForm(null)}>
          <div className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">
                <span className="mb-1 block">{tr("Поставщик")}</span>
                <select value={form.supplierCode} disabled={Boolean(form.key)} onChange={(e) => setForm({ ...form, supplierCode: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50">
                  <option value="">{tr("Выберите поставщика")}</option>
                  {suppliers.map((supplier) => <option key={supplier.code} value={supplier.code}>{supplier.name}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                <span className="mb-1 block">{tr("Услуга")}</span>
                <select value={form.serviceType} disabled={Boolean(form.key)} onChange={(e) => setForm({ ...form, serviceType: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50">
                  <option value="">{tr("Выберите услугу")}</option>
                  {services.map((service) => <option key={service} value={service}>{serviceLabel(service, locale)}</option>)}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">
                <span className="mb-1 block">{tr("Наценка (Markup), %")}</span>
                <input type="number" min="0" max="100" step="0.01" value={form.markupPercent} onChange={(e) => setForm({ ...form, markupPercent: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400" />
                <span className="mt-1 block text-[11px] text-slate-400">{tr("Увеличивает цену для клиента.")}</span>
              </label>
              <label className="text-xs font-medium text-slate-600">
                <span className="mb-1 block">{tr("Комиссия (Commission), %")}</span>
                <input type="number" min="0" max="100" step="0.01" value={form.commissionPercent} onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400" />
                <span className="mt-1 block text-[11px] text-slate-400">{tr("Доход платформы, не увеличивает цену.")}</span>
              </label>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {tr("Итоговое правило")}: {tr("Наценка")} {percentValue(form.markupPercent).toLocaleString("ru-RU")}% + {tr("Комиссия")} {percentValue(form.commissionPercent).toLocaleString("ru-RU")}%
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">{tr("Отмена")}</button>
              <button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? tr("Сохраняем…") : tr("Сохранить")}
              </button>
            </div>
          </div>
        </PanelFrame>
      )}
    </div>
  );
}
