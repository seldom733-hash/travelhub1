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
  countryCodes?: string[];
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
  countryCodes?: string[];
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  version: number;
}
interface PricingRow {
  key: string;
  supplierCode: string;
  supplierName: string;
  serviceType: string;
  countryCodes: string[];
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
  countryCodes: string[];
}

interface CountryOption {
  id: string;
  code: string;
  names: Record<string, string>;
}

const EMPTY: FormState = { supplierCode: "", serviceType: "", markupPercent: "0", commissionPercent: "0", countryCodes: [] };
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
  "Страны / группы стран": { az: "Ölkələr / ölkə qrupları", en: "Countries / country groups" },
  "Выберите страны": { az: "Ölkələri seçin", en: "Select countries" },
  "Если ничего не выбрано — правило действует для всех стран.": { az: "Heç nə seçilməyibsə, qayda bütün ölkələr üçün keçərlidir.", en: "If nothing is selected, the rule applies to all countries." },
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
  "Гиды": { az: "Bələdçilər", en: "Guides" },
  "Круизы": { az: "Kruizlər", en: "Cruises" },
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
  guides: "Гиды",
  cruises: "Круизы",
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

function countryLabel(codes: string[] | undefined, countries: CountryOption[], locale: string, allLabel: string): string {
  if (!codes || codes.length === 0) return allLabel;
  return codes.map((code) => countries.find((c) => c.code === code)?.names?.[locale] ?? countries.find((c) => c.code === code)?.names?.ru ?? code).join(", ");
}

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
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [partnerOptions, setPartnerOptions] = useState<SupplierOption[]>([]);
  const [serviceTypeDirectory, setServiceTypeDirectory] = useState<Array<{ code: string; names: Record<string, string> }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [countrySearch, setCountrySearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [markup, commission, mr, cr, tourSuppliers, hotelSuppliers, flightSuppliers, geo, partnerData, serviceTypesData] = await Promise.all([
        api.get<MarkupMatrix>("/pricing/markup-matrix"),
        api.get<CommissionMatrix>("/pricing/commission-matrix"),
        api.get<{ items: MarkupRule[] }>("/pricing/markup-rules?pageSize=100"),
        api.get<{ items: CommissionRule[] }>("/pricing/commission-rules?pageSize=100"),
        api.get<SupplierOption[]>("/public/supplier/suppliers?service=tours"),
        api.get<SupplierOption[]>("/public/supplier/suppliers?service=hotels"),
        api.get<SupplierOption[]>("/public/supplier/suppliers?service=flights"),
        api.get<CountryOption[] | { value: CountryOption[] }>("/geo/directory").catch(() => []),
        api.get<{ items?: SupplierOption[] }>("/partners?pageSize=300").catch(() => ({ items: [] })),
        api.get<Array<{ code: string; names: Record<string, string> }>>("/hotel-directory/service-types").catch(() => []),
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
      setCountries(Array.isArray(geo) ? geo : (geo.value ?? []));
      setPartnerOptions(partnerData.items ?? []);
      setServiceTypeDirectory(serviceTypesData ?? []);
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
    const partnerName = new Map(partnerOptions.map((p) => [p.code, p.name]));
    const suppliers = new Map<string, string>();
    for (const supplier of [...(markupMatrix?.suppliers ?? []), ...(commissionMatrix?.suppliers ?? [])]) {
      if (!suppliers.has(supplier.code)) suppliers.set(supplier.code, partnerName.get(supplier.code) ?? supplier.name);
    }
    for (const rule of [...markupRules, ...commissionRules]) {
      if (!suppliers.has(rule.supplierCode)) suppliers.set(rule.supplierCode, partnerName.get(rule.supplierCode) ?? rule.supplierCode);
    }
    const serviceToken: Record<string, string> = { TOUR: "tours", TOUR_PACKAGE: "tours", HOTEL: "hotels", FLIGHT: "flights", FLIGHT_BOOKING: "flights", TRANSFER: "transfers", INSURANCE: "insurance", VISA: "visas", CRUISE: "cruises", EXCURSION: "excursions", GUIDE: "guides" };
    const services = new Set<string>([
      ...(markupMatrix?.services ?? []),
      ...(commissionMatrix?.services ?? []),
      ...serviceTypeDirectory.map((t) => serviceToken[t.code]).filter((x): x is string => Boolean(x)),
    ]);
    const countryKey = (codes?: string[]) => [...new Set(codes ?? [])].sort().join("|") || "*";
    const activeFor = <T extends { supplierCode: string; serviceType: string; status: string; countryCodes?: string[] }>(rules: T[], supplier: string, service: string, countryCodes: string[]) => {
      const key = countryKey(countryCodes);
      return rules.find((r) => r.supplierCode === supplier && r.serviceType === service && countryKey(r.countryCodes) === key && r.status === "ACTIVE")
        ?? rules.find((r) => r.supplierCode === supplier && r.serviceType === service && countryKey(r.countryCodes) === key && r.status === "DRAFT");
    };

    const result: PricingRow[] = [];
    for (const [supplierCode, supplierName] of suppliers) {
      for (const serviceType of services) {
        // Aviation suppliers (AZAL/Aviasales) must not appear for tours/hotels,
        // and tour/hotel suppliers must not appear for flights. The registry
        // of enabled suppliers is authoritative per service.
        const scopes = new Map<string, string[]>();
        const addScope = (codes?: string[]) => scopes.set(countryKey(codes), [...new Set(codes ?? [])].sort());
        for (const r of markupRules) if (r.supplierCode === supplierCode && r.serviceType === serviceType && r.status !== "ARCHIVED") addScope(r.countryCodes);
        for (const r of commissionRules) if (r.supplierCode === supplierCode && r.serviceType === serviceType && r.status !== "ARCHIVED") addScope(r.countryCodes);
        if (scopes.size === 0) scopes.set("*", []);
        for (const countryCodes of scopes.values()) {
          const markup = markupMatrix?.cells.find((c) => c.supplierCode === supplierCode && c.serviceType === serviceType);
          const commission = commissionMatrix?.cells.find((c) => c.supplierCode === supplierCode && c.serviceType === serviceType);
          result.push({
            key: `${supplierCode}:${serviceType}:${countryKey(countryCodes)}`,
            supplierCode,
            supplierName,
            serviceType,
            countryCodes,
            markup,
            commission,
            markupRule: activeFor(markupRules, supplierCode, serviceType, countryCodes),
            commissionRule: activeFor(commissionRules, supplierCode, serviceType, countryCodes),
          });
        }
      }
    }
    return result.sort((a, b) => a.serviceType.localeCompare(b.serviceType) || a.supplierName.localeCompare(b.supplierName) || countryKey(a.countryCodes).localeCompare(countryKey(b.countryCodes)));
  }, [markupMatrix, commissionMatrix, markupRules, commissionRules, allowedSuppliers, partnerOptions, serviceTypeDirectory]);

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (serviceFilter && row.serviceType !== serviceFilter) return false;
      if (supplierFilter && row.supplierCode !== supplierFilter) return false;
      if (!needle) return true;
      return `${row.supplierCode} ${row.supplierName} ${row.serviceType} ${serviceLabel(row.serviceType, locale)} ${countryLabel(row.countryCodes, countries, locale, tr("Все страны"))}`.toLowerCase().includes(needle);
    });
  }, [rows, serviceFilter, supplierFilter, search, countries, locale]);

  const refreshCountries = () => {
    void api.get<CountryOption[] | { value: CountryOption[] }>("/geo/directory")
      .then((geo) => setCountries(Array.isArray(geo) ? geo : (geo.value ?? [])))
      .catch(() => undefined);
  };

  const openRow = (row: PricingRow) => {
    if (!canManage) return;
    setError("");
    setCountrySearch("");
    refreshCountries();
    setForm({
      key: row.key,
      supplierCode: row.supplierCode,
      serviceType: row.serviceType,
      markupPercent: rateToInput(row.markupRule?.rate ?? row.markup?.rate),
      commissionPercent: rateToInput(row.commissionRule?.rate ?? row.commission?.rate),
      countryCodes: row.countryCodes,
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
      await saveMarkupRule(form.supplierCode, form.serviceType, markupPercent, form.countryCodes);
      await saveCommissionRule(form.supplierCode, form.serviceType, commissionPercent, form.countryCodes);
      setForm(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const saveMarkupRule = async (supplierCode: string, serviceType: string, markupPercent: number, countryCodes: string[]) => {
    const scope = [...new Set(countryCodes)].sort().join("|");
    const existing = markupRules.filter((r) => r.supplierCode === supplierCode && r.serviceType === serviceType && [...new Set(r.countryCodes ?? [])].sort().join("|") === scope && r.status !== "ARCHIVED");
    const targetRate = decimalRate(String(markupPercent));
    if (markupPercent <= 0) {
      for (const rule of existing) await api.post(`/pricing/markup-rules/${rule.code}/archive`, {});
      return;
    }
    // Archive every non-archived version first. Keeping a DRAFT beside an
    // ACTIVE rule causes activate() to fail with an overlap conflict.
    for (const rule of existing) await api.post(`/pricing/markup-rules/${rule.code}/archive`, {});
    const created = await api.post<MarkupRule>("/pricing/markup-rules", { supplierCode, serviceType, rate: targetRate, countryCodes });
    await api.post(`/pricing/markup-rules/${created.code}/activate`, {});
  };

  const saveCommissionRule = async (supplierCode: string, serviceType: string, commissionPercent: number, countryCodes: string[]) => {
    const scope = [...new Set(countryCodes)].sort().join("|");
    const existing = commissionRules.filter((r) => r.supplierCode === supplierCode && r.serviceType === serviceType && [...new Set(r.countryCodes ?? [])].sort().join("|") === scope && r.status !== "ARCHIVED");
    const targetRate = decimalRate(String(commissionPercent));
    if (commissionPercent <= 0) {
      for (const rule of existing) await api.post(`/pricing/commission-rules/${rule.code}/archive`, {});
      return;
    }
    // A DRAFT plus an ACTIVE rule is a common legacy state. Archive all of
    // them before creating the new active rule, otherwise activation returns
    // 409 "Another active commission rule overlaps this period".
    for (const rule of existing) await api.post(`/pricing/commission-rules/${rule.code}/archive`, {});
    const created = await api.post<CommissionRule>("/pricing/commission-rules", {
      supplierCode,
      serviceType,
      commissionType: "PERCENT",
      rate: targetRate,
      calculationBase: "SUPPLIER_BASE",
      countryCodes,
    });
    await api.post(`/pricing/commission-rules/${created.code}/activate`, {});
  };

  const suppliers = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) map.set(row.supplierCode, row.supplierName);
    return [...map.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);
  const services = useMemo(() => [...new Set(rows.map((r) => r.serviceType))].sort(), [rows]);
  const countryOptions = useMemo(() => {
    const needle = countrySearch.trim().toLowerCase();
    if (!needle) return countries;
    return countries.filter((country) => `${country.code} ${country.names?.[locale] ?? ""} ${country.names?.ru ?? ""} ${country.names?.en ?? ""}`.toLowerCase().includes(needle));
  }, [countries, countrySearch, locale]);

  if (loading) return <WorkspacePageSkeleton />;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHeader
        title={tr("Наценки и комиссионные")}
        breadcrumbs={["TravelHub", tr("Цены и правила"), tr("Наценки и комиссионные")]}
        actions={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void load()} className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-panel">
              {tr("Обновить")}
            </button>
            {canManage && (
              <button type="button" onClick={() => { setCountrySearch(""); refreshCountries(); setForm({ ...EMPTY }); }} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
                + {tr("Добавить правило")}
              </button>
            )}
          </div>
        }
      />

      <div className="space-y-4 p-6">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4 shadow-sm">
          <label className="text-xs font-medium text-ink/60">
            <span className="mb-1 block">{tr("Услуга")}</span>
            <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="min-w-44 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink">
              <option value="">{tr("Все услуги")}</option>
              {services.map((service) => <option key={service} value={service}>{serviceLabel(service, locale)}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-ink/60">
            <span className="mb-1 block">{tr("Поставщик")}</span>
            <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="min-w-48 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink">
              <option value="">{tr("Все поставщики")}</option>
              {(partnerOptions.length > 0 ? partnerOptions : suppliers).map((supplier) => <option key={supplier.code} value={supplier.code}>{supplier.name}</option>)}
            </select>
          </label>
          <label className="min-w-64 flex-1 text-xs font-medium text-ink/60">
            <span className="mb-1 block">{tr("Поиск")}</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Поиск по поставщику / услуге / стране")} className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
          </label>
          <span className="ml-auto text-xs text-ink/60">{tr("Всего правил")}: {visibleRows.length}</span>
        </div>

        <section className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-panel text-xs text-ink">
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
                  const markupRate = row.markupRule?.rate ?? row.markup?.rate;
                  const commissionRate = row.commissionRule?.rate ?? row.commission?.rate;
                  const markup = num(markupRate) > 0 ? percent(markupRate) : "0,00 %";
                  const commission = num(commissionRate) > 0 ? percent(commissionRate) : "0,00 %";
                  const finalRule = num(markupRate) > 0 && num(commissionRate) > 0
                    ? `${tr("Наценка")} ${markup} + ${tr("Комиссия")} ${commission}`
                    : num(markupRate) > 0
                      ? `${tr("Наценка")} ${markup}`
                      : num(commissionRate) > 0
                        ? `${tr("Комиссия")} ${commission}`
                        : tr("Не настроено");
                  return (
                    <tr key={row.key} className="border-b border-line last:border-0 hover:bg-panel/80">
                      <td className="px-4 py-3 text-ink/60">{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-ink">{serviceLabel(row.serviceType, locale)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">{row.supplierName}</div>
                        <div className="font-mono text-[11px] text-ink/60">{row.supplierCode}</div>
                      </td>
                      <td className="px-4 py-3 text-ink/60">{countryLabel(row.countryCodes, countries, locale, tr("Все страны"))}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => openRow(row)} disabled={!canManage} className="rounded-lg px-2 py-1 font-semibold text-ink enabled:hover:bg-brand/10 disabled:cursor-default">
                          {markup}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => openRow(row)} disabled={!canManage} className="rounded-lg px-2 py-1 font-semibold text-ink enabled:hover:bg-brand/10 disabled:cursor-default">
                          {commission}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          num(markupRate) > 0 || num(commissionRate) > 0
                            ? "bg-amber-50 text-amber-800"
                            : "bg-panel text-ink/60"
                        }`}>{finalRule}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                          status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700"
                            : status === "DRAFT"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-panel text-ink/60"
                        }`}>
                          <span className={`size-1.5 rounded-full ${status === "ACTIVE" ? "bg-emerald-500" : status === "DRAFT" ? "bg-amber-500" : "bg-panel"}`} />
                          {status === "ACTIVE" ? tr("Активно") : status === "DRAFT" ? tr("Черновик") : tr("Не настроено")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManage && (
                          <button type="button" onClick={() => openRow(row)} className="rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink/60 hover:bg-panel">
                            {tr("Изменить")}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {visibleRows.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-ink/60">{tr("Правил не найдено")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-brand/15 bg-brand/60 px-5 py-4 text-sm text-ink">
          <div className="font-semibold text-ink">{tr("Как работает правило")}</div>
          <p className="mt-1 leading-6">
            {tr("Итоговая цена = цена поставщика × (1 + наценка). Комиссия — доход платформы, она не увеличивает цену для клиента.")}
          </p>
          <p className="mt-2 text-xs text-ink/60">
            {tr("Пример: поставщик 1 000 AZN, наценка 2,50% → клиент 1 025 AZN; комиссия 7% → доход платформы 70 AZN.")}
          </p>
        </section>
      </div>

      {form && (
        <PanelFrame overlay title={form.key ? tr("Изменить правило") : tr("Новое правило")} subtitle={form.key ? `${form.supplierCode} · ${serviceLabel(form.serviceType, locale)}` : undefined} onClose={() => setForm(null)}>
          <div className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-ink/60">
                <span className="mb-1 block">{tr("Поставщик")}</span>
                <select value={form.supplierCode} disabled={Boolean(form.key)} onChange={(e) => setForm({ ...form, supplierCode: e.target.value })} className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink disabled:bg-panel">
                  <option value="">{tr("Выберите поставщика")}</option>
                  {(partnerOptions.length > 0 ? partnerOptions : suppliers).map((supplier) => <option key={supplier.code} value={supplier.code}>{supplier.name}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-ink/60">
                <span className="mb-1 block">{tr("Услуга")}</span>
                <select value={form.serviceType} disabled={Boolean(form.key)} onChange={(e) => setForm({ ...form, serviceType: e.target.value })} className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink disabled:bg-panel">
                  <option value="">{tr("Выберите услугу")}</option>
                  {services.map((service) => <option key={service} value={service}>{serviceLabel(service, locale)}</option>)}
                </select>
              </label>
            </div>
            <div className="rounded-lg border border-line p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-ink/60">{tr("Страны / группы стран")}</span>
                <button type="button" onClick={() => setForm({ ...form, countryCodes: [] })} className="rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-ink/60 hover:bg-panel">{tr("Все страны")}</button>
              </div>
              <input value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} placeholder={tr("Поиск страны")} className="mb-2 w-full rounded-lg border border-line px-3 py-1.5 text-xs" />
              <div className="mb-1 text-[11px] text-ink/50">{tr("Выбрано")}: {form.countryCodes.length}</div>
              <div className="grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2">
                {countryOptions.map((country) => (
                  <label key={country.code} className="flex items-center gap-2 rounded px-1 py-0.5 text-xs text-ink hover:bg-panel">
                    <input
                      type="checkbox"
                      checked={form.countryCodes.includes(country.code)}
                      onChange={(e) => setForm({ ...form, countryCodes: e.target.checked ? [...form.countryCodes, country.code] : form.countryCodes.filter((c) => c !== country.code) })}
                    />
                    <span>{country.names?.[locale] ?? country.names?.ru ?? country.code}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink/50">{tr("Если ничего не выбрано — правило действует для всех стран.")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-ink/60">
                <span className="mb-1 block">{tr("Наценка (Markup), %")}</span>
                <input type="number" min="0" max="100" step="0.01" value={form.markupPercent} onChange={(e) => setForm({ ...form, markupPercent: e.target.value })} className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
                <span className="mt-1 block text-[11px] text-ink/60">{tr("Увеличивает цену для клиента.")}</span>
              </label>
              <label className="text-xs font-medium text-ink/60">
                <span className="mb-1 block">{tr("Комиссия (Commission), %")}</span>
                <input type="number" min="0" max="100" step="0.01" value={form.commissionPercent} onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })} className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
                <span className="mt-1 block text-[11px] text-ink/60">{tr("Доход платформы, не увеличивает цену.")}</span>
              </label>
            </div>
            <div className="rounded-lg bg-panel px-3 py-2 text-xs text-ink/60">
              {tr("Итоговое правило")}: {tr("Наценка")} {percentValue(form.markupPercent).toLocaleString("ru-RU")}% + {tr("Комиссия")} {percentValue(form.commissionPercent).toLocaleString("ru-RU")}%
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-line px-4 py-2 text-sm text-ink/60">{tr("Отмена")}</button>
              <button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? tr("Сохраняем…") : tr("Сохранить")}
              </button>
            </div>
          </div>
        </PanelFrame>
      )}
    </div>
  );
}
