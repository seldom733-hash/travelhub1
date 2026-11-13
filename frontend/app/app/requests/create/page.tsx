"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-user";

type RequestType =
  | "TOUR_PACKAGE"
  | "HOTEL"
  | "FLIGHT"
  | "TRANSFER"
  | "INSURANCE"
  | "VISA"
  | "FLIGHT_BOOKING"
  | "CRUISE"
  | "CUSTOM_PACKAGE"
  | "OTHER";

type ServiceKind = "HOTEL" | "FLIGHT" | "TRANSFER" | "INSURANCE" | "VISA" | "CRUISE" | "TOUR_PACKAGE" | "OTHER";

interface Customer {
  id: string;
  code?: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface Supplier {
  code: string;
  name: string;
}

interface Manager {
  userId: string;
  name: string;
  availability?: string;
  participates?: boolean;
  active?: number;
}

interface ProductOption {
  id: string;
  title: string;
  type?: string;
  country?: string | null;
  city?: string | null;
}

interface DictionaryEntry {
  id: string;
  code: string;
  names: Record<string, string>;
}

interface GeoCountry {
  id: string;
  code: string;
  names: Record<string, string>;
}

interface GeoCity {
  id: string;
  code: string;
  names: Record<string, string>;
}

interface Traveler {
  firstName: string;
  lastName: string;
  middleName: string;
  birthDate: string;
  citizenship: string;
  documentType: string;
  passportNumber: string;
  passportIssuedAt: string;
  passportExpiry: string;
}

interface ServiceDraft {
  key: string;
  kind: ServiceKind;
  enabled: boolean;
  supplierCode: string;
  supplierName: string;
  title: string;
  data: Record<string, string>;
}

const TYPES: Array<{ value: RequestType; ru: string; az: string; en: string }> = [
  { value: "TOUR_PACKAGE", ru: "Турпакет", az: "Tur paketi", en: "Tour package" },
  { value: "HOTEL", ru: "Отель", az: "Otel", en: "Hotel" },
  { value: "FLIGHT", ru: "Авиабилет", az: "Aviabilet", en: "Flight ticket" },
  { value: "TRANSFER", ru: "Трансфер", az: "Transfer", en: "Transfer" },
  { value: "INSURANCE", ru: "Страховка", az: "Sığorta", en: "Insurance" },
  { value: "VISA", ru: "Виза", az: "Viza", en: "Visa" },
  { value: "FLIGHT_BOOKING", ru: "Бронь авиабилета", az: "Aviabilet bronu", en: "Flight booking" },
  { value: "CRUISE", ru: "Круиз", az: "Kruiz", en: "Cruise" },
  { value: "CUSTOM_PACKAGE", ru: "Собрать турпакет", az: "Tur paketini yığ", en: "Build tour package" },
  { value: "OTHER", ru: "Другое", az: "Digər", en: "Other" },
];

const PACKAGE_KINDS: ServiceKind[] = ["HOTEL", "FLIGHT", "TRANSFER", "INSURANCE", "VISA"];

function typeLabel(locale: string, value: RequestType) {
  const row = TYPES.find((x) => x.value === value);
  return row ? (locale === "az" ? row.az : locale === "en" ? row.en : row.ru) : value;
}

function kindLabel(locale: string, kind: ServiceKind) {
  return typeLabel(locale, kind as RequestType);
}

function newTraveler(): Traveler {
  return { firstName: "", lastName: "", middleName: "", birthDate: "", citizenship: "", documentType: "PASSPORT", passportNumber: "", passportIssuedAt: "", passportExpiry: "" };
}

function newService(kind: ServiceKind): ServiceDraft {
  return { key: `${kind}-${Math.random().toString(36).slice(2, 9)}`, kind, enabled: true, supplierCode: "", supplierName: "", title: "", data: {} };
}

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#0f6b5f] focus:ring-2 focus:ring-[#0f6b5f]/10";
const label = "grid gap-1 text-[11px] font-medium text-slate-600";

export default function CreateRequestPage() {
  const locale = useLocale();
  const currentUser = useCurrentUser();
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [requestType, setRequestType] = useState<RequestType>("TOUR_PACKAGE");
  const [managerId, setManagerId] = useState("");
  const [managers, setManagers] = useState<Manager[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [primarySupplierCode, setPrimarySupplierCode] = useState("");
  const [travelers, setTravelers] = useState<Traveler[]>([newTraveler()]);
  const [services, setServices] = useState<ServiceDraft[]>([newService("TOUR_PACKAGE")]);
  const [salePrice, setSalePrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [currency, setCurrency] = useState("AZN");
  const [serviceStart, setServiceStart] = useState("");
  const [serviceEnd, setServiceEnd] = useState("");
  const [dictionary, setDictionary] = useState<{ mealTypes: DictionaryEntry[]; roomTypes: DictionaryEntry[]; placementTypes: DictionaryEntry[]; viewTypes: DictionaryEntry[]; airlineClasses: DictionaryEntry[]; baggageAllowances: DictionaryEntry[] }>({ mealTypes: [], roomTypes: [], placementTypes: [], viewTypes: [], airlineClasses: [], baggageAllowances: [] });
  const [countries, setCountries] = useState<GeoCountry[]>([]);
  const [cities, setCities] = useState<GeoCity[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState("");
  const [activePackageKind, setActivePackageKind] = useState<ServiceKind>("HOTEL");
  const [hotelQuery, setHotelQuery] = useState("");
  const [hotelOptions, setHotelOptions] = useState<ProductOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ id: string; referenceNumber: string; commerceSequence?: string } | null>(null);

  const tr = (ru: string, az: string, en: string) => (locale === "az" ? az : locale === "en" ? en : ru);

  useEffect(() => {
    Promise.all([
      api.get<{ items?: Customer[] } | Customer[]>(`/customers?pageSize=20${customerSearch ? `&search=${encodeURIComponent(customerSearch)}` : ""}`).catch(() => ({ items: [] })),
      api.get<Manager[]>("/sales/assignment/load").catch(() => []),
      api.get<{ value?: Supplier[] } | Supplier[]>(`/public/supplier/suppliers?service=tours`).catch(() => ({ value: [] })),
    ]).then(([customerData, managerData, supplierData]) => {
      setCustomers(Array.isArray(customerData) ? customerData : customerData.items ?? []);
      setManagers(Array.isArray(managerData) ? managerData : []);
      const supplierRows = Array.isArray(supplierData) ? supplierData : supplierData.value ?? [];
      setSuppliers(supplierRows);
      if (!primarySupplierCode && supplierRows[0]) setPrimarySupplierCode(supplierRows[0].code);
    }).catch((e) => setError((e as Error).message));
  }, [customerSearch, primarySupplierCode]);

  useEffect(() => {
    if (hotelQuery.trim().length < 2) { setHotelOptions([]); return; }
    const timer = window.setTimeout(() => {
      api.get<{ items?: ProductOption[] }>(`/products?pageSize=8&search=${encodeURIComponent(hotelQuery.trim())}`)
        .then((page) => setHotelOptions(page.items ?? [])).catch(() => setHotelOptions([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [hotelQuery]);

  useEffect(() => {
    if (currentUser && ["SALES_MANAGER", "SALES_HEAD"].includes(currentUser.role) && !managerId) {
      setManagerId(currentUser.id);
    }
  }, [currentUser, managerId]);

  useEffect(() => {
    Promise.all([
      api.get<any>("/tour-builder/dictionaries").catch(() => null),
      api.get<any>("/geo/countries").catch(() => null),
    ]).then(([dict, geo]) => {
      if (dict) setDictionary({ mealTypes: dict.mealTypes ?? [], roomTypes: dict.roomTypes ?? [], placementTypes: dict.placementTypes ?? [], viewTypes: dict.viewTypes ?? [], airlineClasses: dict.airlineClasses ?? [], baggageAllowances: dict.baggageAllowances ?? [] });
      const rows = Array.isArray(geo) ? geo : geo?.value ?? [];
      setCountries(rows);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedCountryId) { setCities([]); return; }
    api.get<any>(`/geo/cities?countryId=${encodeURIComponent(selectedCountryId)}`).then((geo) => setCities(Array.isArray(geo) ? geo : geo?.value ?? [])).catch(() => setCities([]));
  }, [selectedCountryId]);

  function ensureService(kind: ServiceKind): ServiceDraft {
    let existing = services.find((s) => s.kind === kind);
    if (!existing) {
      existing = newService(kind);
      setServices((prev) => [...prev, existing!]);
    }
    return existing;
  }

  function updateService(key: string, patch: Partial<ServiceDraft>) {
    setServices((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function updateData(key: string, field: string, value: string) {
    setServices((prev) => prev.map((s) => (s.key === key ? { ...s, data: { ...s.data, [field]: value } } : s)));
  }

  function primaryService(): ServiceDraft {
    if (requestType === "CUSTOM_PACKAGE") {
      return services.find((s) => s.kind === activePackageKind && s.enabled) ?? ensureService(activePackageKind);
    }
    const kind = requestType === "FLIGHT_BOOKING" ? "FLIGHT" : (requestType as ServiceKind);
    return ensureService(kind);
  }

  const visibleService = useMemo(() => {
    if (requestType === "CUSTOM_PACKAGE") return services.find((s) => s.kind === activePackageKind) ?? null;
    const kind = requestType === "FLIGHT_BOOKING" ? "FLIGHT" : (requestType as ServiceKind);
    return services.find((s) => s.kind === kind) ?? null;
  }, [requestType, services, activePackageKind]);

  const currentKind: ServiceKind = requestType === "CUSTOM_PACKAGE" ? activePackageKind : requestType === "FLIGHT_BOOKING" ? "FLIGHT" : (requestType as ServiceKind);

  async function createCustomerIfNeeded(): Promise<string | null> {
    if (customerMode === "existing") return selectedCustomer?.id ?? null;
    if (!newCustomer.email.trim() && !newCustomer.phone.trim()) throw new Error(tr("Укажите email или телефон покупателя", "Müştərinin e-poçtunu və ya telefonunu daxil edin", "Enter customer email or phone"));
    const created = await api.post<{ id?: string; customer?: { id: string } }>("/customers", {
      firstName: newCustomer.firstName.trim() || undefined,
      lastName: newCustomer.lastName.trim() || undefined,
      email: newCustomer.email.trim(),
      phone: newCustomer.phone.trim() || undefined,
      type: "PERSON",
    });
    return created.customer?.id ?? created.id ?? null;
  }

  async function submit() {
    setError("");
    if (customerMode === "existing" && !selectedCustomer) { setError(tr("Выберите покупателя", "Müştəri seçin", "Select a customer")); return; }
    const invalidTraveler = travelers.findIndex((t) => !t.firstName.trim() || !t.lastName.trim() || !t.birthDate);
    if (invalidTraveler >= 0) { setError(`${tr("Турист", "Turist", "Traveler")} ${invalidTraveler + 1}: ${tr("укажите имя, фамилию и дату рождения", "ad, soyad və doğum tarixini daxil edin", "enter first name, last name and birth date")}`); return; }
    const rows = requestType === "CUSTOM_PACKAGE"
      ? services.filter((s) => s.enabled)
      : [primaryService()];
    if (rows.length === 0) { setError(tr("Добавьте хотя бы одну услугу", "Ən azı bir xidmət əlavə edin", "Add at least one service")); return; }
    if (rows.some((s) => !s.supplierCode)) { setError(tr("Выберите поставщика для каждой услуги", "Hər xidmət üçün təchizatçı seçin", "Select a supplier for each service")); return; }
    setBusy(true);
    try {
      const customerId = await createCustomerIfNeeded();
      const firstDate = rows.map((s) => s.data.startDate || s.data.checkIn || s.data.departureDate || s.data.travelDate || "").find(Boolean) || undefined;
      const payload = {
        ...(customerId ? { customerId } : {}),
        ...(managerId ? { assignedManagerId: managerId } : {}),
        requestType,
        primarySupplierCode: primarySupplierCode || rows[0]?.supplierCode || undefined,
        requestedServiceDate: serviceStart || firstDate,
        ...(salePrice ? { displayedPrice: Number(salePrice), displayedCurrency: currency } : {}),
        quantity: travelers.length,
        travelerCount: travelers.length,
        travelers: travelers.map((t) => ({ firstName: t.firstName.trim(), lastName: t.lastName.trim(), birthDate: t.birthDate })),
        services: rows.map((s) => ({ serviceType: s.kind, supplierCode: s.supplierCode || undefined, supplierName: s.supplierName || undefined, title: s.title || s.data.hotelName || kindLabel(locale, s.kind), data: { ...s.data, salePrice, costPrice, currency, startDate: serviceStart, endDate: serviceEnd } })),
      };
      const created = await api.post<{ id: string; referenceNumber: string; commerceSequence?: string }>("/requests", payload);
      setResult(created);
      setServices([]);
      setTravelers([newTraveler()]);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  if (result) {
    return <div className="mx-auto max-w-3xl p-6">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
        <h1 className="text-xl font-semibold text-emerald-900">{tr("Запрос успешно создан", "Sorğu uğurla yaradıldı", "Request created successfully")}</h1>
        <p className="mt-2 text-sm text-emerald-800">{tr("Номер запроса", "Sorğu nömrəsi", "Request number")}: <span className="font-mono font-semibold">{result.referenceNumber}</span></p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={result.commerceSequence ? `/app/finance/deals/${result.commerceSequence}` : "/app/finance/deals"} className="rounded-lg bg-[#0f6b5f] px-4 py-2 text-sm font-semibold text-white">{tr("Открыть в Реестре продаж", "Satış reyestrində aç", "Open in Sales Register")}</Link>
          <button type="button" onClick={() => setResult(null)} className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-700">{tr("Создать ещё", "Yenə yarat", "Create another")}</button>
        </div>
      </div>
    </div>;
  }

  return <div className="mx-auto max-w-5xl space-y-4 p-4 lg:p-6">
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">{tr("Создание запроса", "Sorğu yaratma", "Create request")}</h1>
      <p className="mt-1 text-sm text-slate-500">{tr("Оформите запрос. После создания он появится в Реестре продаж.", "Sorğunu rəsmiləşdirin. Yaradıldıqdan sonra Satış reyestrində görünəcək.", "Create a request. It will appear in the Sales Register after saving.")}</p>
    </div>

    {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">{tr("Тип запроса", "Sorğu növü", "Request type")}</h2>
      <div className="flex flex-wrap gap-2">{TYPES.map((t) => <button key={t.value} type="button" onClick={() => { setRequestType(t.value); const kind: ServiceKind = t.value === "CUSTOM_PACKAGE" ? "HOTEL" : t.value === "FLIGHT_BOOKING" ? "FLIGHT" : (t.value as ServiceKind); setServices([newService(kind)]); }} className={`rounded-lg border px-3 py-2 text-xs font-medium ${requestType === t.value ? "border-[#0f6b5f] bg-[#eef8f3] text-[#0f6b5f]" : "border-slate-200 text-slate-600"}`}>{t[locale === "az" ? "az" : locale === "en" ? "en" : "ru"]}</button>)}</div>
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{tr("Покупатель", "Müştəri", "Customer")}</h2><div className="flex gap-1"><button type="button" onClick={() => setCustomerMode("existing")} className={`rounded px-2 py-1 text-[11px] ${customerMode === "existing" ? "bg-[#0f6b5f] text-white" : "border"}`}>{tr("Существующий", "Mövcud", "Existing")}</button><button type="button" onClick={() => setCustomerMode("new")} className={`rounded px-2 py-1 text-[11px] ${customerMode === "new" ? "bg-[#0f6b5f] text-white" : "border"}`}>{tr("Новый", "Yeni", "New")}</button></div></div>
      {customerMode === "existing" ? <div className="space-y-2">
        <input className={input} value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder={tr("Поиск по имени, телефону или email", "Ad, telefon və ya e-poçtla axtar", "Search by name, phone or email")} />
        {selectedCustomer && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">{selectedCustomer.firstName} {selectedCustomer.lastName} · {selectedCustomer.phone ?? selectedCustomer.email}</div>}
        <div className="max-h-40 divide-y overflow-auto rounded-lg border">{customers.map((c) => <button key={c.id} type="button" onClick={() => setSelectedCustomer(c)} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-slate-50"><span>{c.firstName} {c.lastName} {c.companyName ? `· ${c.companyName}` : ""}</span><span className="text-slate-400">{c.phone ?? c.email}</span></button>)}</div>
      </div> : <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>{tr("Фамилия", "Soyad", "Last name")}<input className={input} value={newCustomer.lastName} onChange={(e) => setNewCustomer({ ...newCustomer, lastName: e.target.value })} /></label>
        <label className={label}>{tr("Имя", "Ad", "First name")}<input className={input} value={newCustomer.firstName} onChange={(e) => setNewCustomer({ ...newCustomer, firstName: e.target.value })} /></label>
        <label className={label}>{tr("Телефон", "Telefon", "Phone")}<input className={input} value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="+994..." /></label>
        <label className={label}>Email<input className={input} value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} /></label>
      </div>}
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">{tr("Ответственный менеджер", "Məsul menecer", "Responsible manager")}</h2>
      <select className={input} value={managerId} onChange={(e) => setManagerId(e.target.value)}><option value="">{tr("Автоматическое распределение", "Avtomatik paylama", "Automatic distribution")}</option>{managers.map((m) => <option key={m.userId} value={m.userId}>{m.name} · {m.active ?? 0}</option>)}</select>
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">{tr("Цены и сроки услуги", "Qiymətlər və xidmət müddəti", "Prices and service dates")}</h2>
      <div className="grid gap-3 sm:grid-cols-5">
        <label className={label}>{tr("Себестоимость", "Maya dəyəri", "Cost")}<input className={input} inputMode="decimal" value={costPrice} onChange={(e) => setCostPrice(e.target.value.replace(",", "."))} /></label>
        <label className={label}>{tr("Цена продажи", "Satış qiyməti", "Sale price")}<input className={input} inputMode="decimal" value={salePrice} onChange={(e) => setSalePrice(e.target.value.replace(",", "."))} /></label>
        <label className={label}>{tr("Валюта", "Valyuta", "Currency")}<select className={input} value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="AZN">AZN</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
        <label className={label}>{tr("Начало услуги", "Xidmətin başlanğıcı", "Service start")}<input type="date" className={input} value={serviceStart} onChange={(e) => setServiceStart(e.target.value)} /></label>
        <label className={label}>{tr("Конец услуги", "Xidmətin sonu", "Service end")}<input type="date" className={input} value={serviceEnd} onChange={(e) => setServiceEnd(e.target.value)} /></label>
      </div>
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">{tr("Туристы", "Turistlər", "Travelers")}</h2>
      <div className="space-y-3">{travelers.map((t, index) => <div key={index} className="rounded-lg border border-slate-100 p-3">
        <div className="mb-2 flex justify-between text-xs font-semibold"><span>{tr("Турист", "Turist", "Traveler")} {index + 1}</span>{travelers.length > 1 && <button type="button" className="text-rose-600" onClick={() => setTravelers(travelers.filter((_, i) => i !== index))}>{tr("Удалить", "Sil", "Delete")}</button>}</div>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className={label}>{tr("Фамилия", "Soyad", "Last name")}<input className={input} value={t.lastName} onChange={(e) => setTravelers(travelers.map((x, i) => i === index ? { ...x, lastName: e.target.value } : x))} /></label>
          <label className={label}>{tr("Имя", "Ad", "First name")}<input className={input} value={t.firstName} onChange={(e) => setTravelers(travelers.map((x, i) => i === index ? { ...x, firstName: e.target.value } : x))} /></label>
          <label className={label}>{tr("Отчество", "Ata adı", "Middle name")}<input className={input} value={t.middleName} onChange={(e) => setTravelers(travelers.map((x, i) => i === index ? { ...x, middleName: e.target.value } : x))} /></label>
          <label className={label}>{tr("Дата рождения", "Doğum tarixi", "Date of birth")}<input type="date" className={input} value={t.birthDate} onChange={(e) => setTravelers(travelers.map((x, i) => i === index ? { ...x, birthDate: e.target.value } : x))} /></label>
          <label className={label}>{tr("Гражданство", "Vətəndaşlıq", "Citizenship")}<input className={input} value={t.citizenship} onChange={(e) => setTravelers(travelers.map((x, i) => i === index ? { ...x, citizenship: e.target.value } : x))} /></label>
          <label className={label}>{tr("Тип документа", "Sənəd növü", "Document type")}<select className={input} value={t.documentType} onChange={(e) => setTravelers(travelers.map((x, i) => i === index ? { ...x, documentType: e.target.value } : x))}><option value="PASSPORT">{tr("Паспорт", "Pasport", "Passport")}</option><option value="ID">ID</option></select></label>
          <label className={label}>{tr("Номер паспорта", "Pasport nömrəsi", "Passport number")}<input className={input} value={t.passportNumber} onChange={(e) => setTravelers(travelers.map((x, i) => i === index ? { ...x, passportNumber: e.target.value } : x))} /></label>
          <label className={label}>{tr("Дата выдачи", "Verilmə tarixi", "Issued at")}<input type="date" className={input} value={t.passportIssuedAt} onChange={(e) => setTravelers(travelers.map((x, i) => i === index ? { ...x, passportIssuedAt: e.target.value } : x))} /></label>
          <label className={label}>{tr("Срок действия", "Etibarlıdır", "Expiry")}<input type="date" className={input} value={t.passportExpiry} onChange={(e) => setTravelers(travelers.map((x, i) => i === index ? { ...x, passportExpiry: e.target.value } : x))} /></label>
        </div>
      </div>)}</div>
      <button type="button" onClick={() => setTravelers([...travelers, newTraveler()])} className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs">+ {tr("Добавить туриста", "Turist əlavə et", "Add traveler")}</button>
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">{tr("Поставщик", "Təchizatçı", "Supplier")}</h2><select className="rounded-lg border px-2 py-1.5 text-xs" value={primarySupplierCode} onChange={(e) => setPrimarySupplierCode(e.target.value)}><option value="">{tr("Основной поставщик", "Əsas təchizatçı", "Primary supplier")}</option>{suppliers.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></div>
      {requestType === "CUSTOM_PACKAGE" && <div className="mb-3 flex flex-wrap gap-1">{PACKAGE_KINDS.map((k) => <button key={k} type="button" onClick={() => { setActivePackageKind(k); ensureService(k); }} className={`rounded border px-2 py-1 text-[11px] ${activePackageKind === k ? "border-[#0f6b5f] bg-[#eef8f3] text-[#0f6b5f]" : ""}`}>{kindLabel(locale, k)}</button>)}</div>}
      {visibleService ? <ServiceFields service={visibleService} locale={locale} suppliers={suppliers} primarySupplierCode={primarySupplierCode} hotelQuery={hotelQuery} setHotelQuery={setHotelQuery} hotelOptions={hotelOptions} onSelectHotel={(p) => { updateService(visibleService.key, { title: p.title }); updateData(visibleService.key, "hotelName", p.title); }} onChange={(patch) => updateService(visibleService.key, patch)} onData={(field, value) => updateData(visibleService.key, field, value)} dictionary={dictionary} countries={countries} cities={cities} selectedCountryId={selectedCountryId} setSelectedCountryId={setSelectedCountryId} /> : <button type="button" className="rounded-lg border px-3 py-2 text-xs" onClick={() => setServices([...services, newService(currentKind)])}>+ {tr("Добавить услугу", "Xidmət əlavə et", "Add service")}</button>}
      {requestType === "CUSTOM_PACKAGE" && <div className="mt-3 space-y-2">{services.map((s) => <label key={s.key} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={s.enabled} onChange={(e) => updateService(s.key, { enabled: e.target.checked })} />{kindLabel(locale, s.kind)} · {s.supplierName || tr("поставщик не выбран", "təchizatçı seçilməyib", "supplier not selected")}</label>)}</div>}
    </section>

    <div className="flex justify-end gap-2 pb-8"><Link href="/app/finance/deals" className="rounded-lg border px-4 py-2 text-sm">{tr("Отмена", "Ləğv et", "Cancel")}</Link><button type="button" disabled={busy} onClick={() => void submit()} className="rounded-lg bg-[#0f6b5f] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? tr("Создание…", "Yaradılır…", "Creating…") : tr("Создать запрос", "Sorğu yarat", "Create request")}</button></div>
  </div>;
}

function ServiceFields({ service, locale, suppliers, primarySupplierCode, hotelQuery, setHotelQuery, hotelOptions, onSelectHotel, onChange, onData, dictionary, countries, cities, selectedCountryId, setSelectedCountryId }: {
  service: ServiceDraft; locale: string; suppliers: Supplier[]; primarySupplierCode: string;
  hotelQuery: string; setHotelQuery: (v: string) => void; hotelOptions: ProductOption[];
  onSelectHotel: (p: ProductOption) => void; onChange: (patch: Partial<ServiceDraft>) => void; onData: (field: string, value: string) => void;
  dictionary: { mealTypes: DictionaryEntry[]; roomTypes: DictionaryEntry[]; placementTypes: DictionaryEntry[]; viewTypes: DictionaryEntry[]; airlineClasses: DictionaryEntry[]; baggageAllowances: DictionaryEntry[] };
  countries: GeoCountry[]; cities: GeoCity[]; selectedCountryId: string; setSelectedCountryId: (v: string) => void;
}) {
  const tr = (ru: string, az: string, en: string) => (locale === "az" ? az : locale === "en" ? en : ru);
  const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";
  const label = "grid gap-1 text-[11px] font-medium text-slate-600";
  const d = service.data;
  const [hotelSearch, setHotelSearch] = useState(d.hotelName ?? service.title ?? "");
  const [hotelResults, setHotelResults] = useState<Array<{ id: string; name: string; suppliers?: string[] }>>([]);
  useEffect(() => {
    if (service.kind !== "HOTEL" && service.kind !== "TOUR_PACKAGE") return;
    const query = hotelSearch.trim();
    if (query.length < 2 && !d.country) { setHotelResults([]); return; }
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ limit: "20" });
      if (d.country) params.set("geoCountry", d.country);
      if (d.city) params.set("geoCity", d.city);
      if (query) params.set("q", query);
      api.get<Array<{ id: string; name: string; suppliers?: string[] }>>(`/geo/supplier-hotels?${params.toString()}`)
        .then((rows) => setHotelResults(Array.isArray(rows) ? rows : [])).catch(() => setHotelResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [hotelSearch, d.country, d.city, service.kind]);
  const chooseHotel = (hotel: { id: string; name: string; suppliers?: string[] }) => {
    setHotelSearch(hotel.name);
    onSelectHotel({ id: hotel.id, title: hotel.name });
    onData("hotelName", hotel.name);
    if (hotel.suppliers?.[0] && !service.supplierCode) onChange({ supplierCode: hotel.suppliers[0], supplierName: hotel.suppliers[0] });
  };
  const supplier = <label className={label}>{tr("Поставщик услуги", "Xidmət təchizatçısı", "Service supplier")}<select className={input} value={service.supplierCode} onChange={(e) => { const code = e.target.value; const row = suppliers.find((s) => s.code === code); onChange({ supplierCode: code, supplierName: row?.name ?? "" }); }}><option value="">{tr("Выберите", "Seçin", "Select")}</option>{suppliers.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>;

  if (service.kind === "HOTEL" || service.kind === "TOUR_PACKAGE") return <div className="grid gap-3 sm:grid-cols-2">
    {supplier}
    <label className={label}>{tr("Название отеля", "Otel adı", "Hotel name")}<input className={input} value={hotelSearch} onChange={(e) => { setHotelSearch(e.target.value); onData("hotelName", e.target.value); }} placeholder={tr("Начните вводить название отеля", "Otel adını yazmağa başlayın", "Start typing a hotel name")} /></label>
    <label className={label}>{tr("Страна", "Ölkə", "Country")}<select className={input} value={selectedCountryId} onChange={(e) => { setSelectedCountryId(e.target.value); const row = countries.find((c) => c.id === e.target.value); onData("country", row?.code ?? ""); }}><option value="">{tr("Выберите страну", "Ölkə seçin", "Select country")}</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.names[locale] ?? c.names.ru ?? c.code}</option>)}</select></label>
    <label className={label}>{tr("Город", "Şəhər", "City")}<select className={input} value={d.cityId ?? ""} onChange={(e) => { const row = cities.find((c) => c.id === e.target.value); onData("cityId", e.target.value); onData("city", row?.code ?? row?.names[locale] ?? ""); }}><option value="">{tr("Выберите город", "Şəhər seçin", "Select city")}</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.names[locale] ?? c.names.ru ?? c.code}</option>)}</select></label>
    <label className={label}>{tr("Заезд", "Giriş", "Check-in")}<input type="date" className={input} value={d.checkIn ?? ""} onChange={(e) => onData("checkIn", e.target.value)} /></label>
    <label className={label}>{tr("Выезд", "Çıxış", "Check-out")}<input type="date" className={input} value={d.checkOut ?? ""} onChange={(e) => onData("checkOut", e.target.value)} /></label>
    <label className={label}>{tr("Тип номера", "Otaq növü", "Room type")}<select className={input} value={d.roomType ?? ""} onChange={(e) => onData("roomType", e.target.value)}><option value="">{tr("Выберите", "Seçin", "Select")}</option>{dictionary.roomTypes.map((x) => <option key={x.code} value={x.code}>{x.names[locale] ?? x.names.ru ?? x.code}</option>)}</select></label>
    <label className={label}>{tr("Размещение", "Yerləşmə", "Accommodation")}<select className={input} value={d.accommodation ?? ""} onChange={(e) => onData("accommodation", e.target.value)}><option value="">{tr("Выберите", "Seçin", "Select")}</option>{dictionary.placementTypes.map((x) => <option key={x.code} value={x.code}>{x.names[locale] ?? x.names.ru ?? x.code}</option>)}</select></label>
    <label className={label}>{tr("Питание", "Qidalanma", "Meal")}<select className={input} value={d.meal ?? ""} onChange={(e) => onData("meal", e.target.value)}><option value="">{tr("Выберите", "Seçin", "Select")}</option>{dictionary.mealTypes.map((x) => <option key={x.code} value={x.code}>{x.names[locale] ?? x.names.ru ?? x.code}</option>)}</select></label>
    <label className={label}>{tr("Номеров", "Otaq sayı", "Rooms")}<input type="number" min="1" className={input} value={d.rooms ?? "1"} onChange={(e) => onData("rooms", e.target.value)} /></label>
    <label className={label}>{tr("Взрослых", "Böyüklər", "Adults")}<input type="number" min="1" className={input} value={d.adults ?? "2"} onChange={(e) => onData("adults", e.target.value)} /></label>
    <label className={label}>{tr("Детей", "Uşaqlar", "Children")}<input type="number" min="0" className={input} value={d.children ?? "0"} onChange={(e) => onData("children", e.target.value)} /></label>
    <label className={label}>{tr("Возраст детей", "Uşaqların yaşı", "Children ages")}<input className={input} value={d.childrenAges ?? ""} onChange={(e) => onData("childrenAges", e.target.value)} /></label>
    {hotelResults.length > 0 && <div className="sm:col-span-2"><div className="mb-1 text-[10px] text-slate-500">{tr("Найденные отели поставщиков", "Təchizatçı otelləri", "Supplier hotels")}</div><div className="max-h-48 overflow-auto rounded-lg border">{hotelResults.map((p) => <button key={p.id} type="button" onClick={() => chooseHotel(p)} className="flex w-full items-center justify-between border-b px-2 py-1.5 text-left text-[11px] last:border-0 hover:bg-slate-50"><span>{p.name}</span><span className="text-slate-400">{p.suppliers?.join(", ")}</span></button>)}</div></div>}
  </div>;

  if (service.kind === "FLIGHT") {
    const segments = JSON.parse(d.segments || '[{"from":"","to":"","departureDate":"","arrivalDate":"","airline":"","class":"","fare":"","baggage":"","carryOn":""}]');
    const saveSegments = (rows: any[]) => onData("segments", JSON.stringify(rows));
    return <div className="space-y-3">{supplier}{segments.map((seg: any, i: number) => <div key={i} className="rounded-lg border p-3"><div className="mb-2 text-[11px] font-semibold">{tr("Сегмент", "Seqment", "Segment")} {i + 1}</div><div className="grid gap-2 sm:grid-cols-3">
      <label className={label}>{tr("Откуда", "Haradan", "From")}<input className={input} value={seg.from} onChange={(e) => { const rows = [...segments]; rows[i] = { ...seg, from: e.target.value }; saveSegments(rows); }} /></label>
      <label className={label}>{tr("Куда", "Hara", "To")}<input className={input} value={seg.to} onChange={(e) => { const rows = [...segments]; rows[i] = { ...seg, to: e.target.value }; saveSegments(rows); }} /></label>
      <label className={label}>{tr("Вылет", "Uçuş", "Departure")}<input type="datetime-local" className={input} value={seg.departureDate} onChange={(e) => { const rows = [...segments]; rows[i] = { ...seg, departureDate: e.target.value }; saveSegments(rows); }} /></label>
      <label className={label}>{tr("Прибытие", "Gəliş", "Arrival")}<input type="datetime-local" className={input} value={seg.arrivalDate} onChange={(e) => { const rows = [...segments]; rows[i] = { ...seg, arrivalDate: e.target.value }; saveSegments(rows); }} /></label>
      <label className={label}>{tr("Авиакомпания", "Aviaşirkət", "Airline")}<input className={input} value={seg.airline ?? ""} onChange={(e) => { const rows = [...segments]; rows[i] = { ...seg, airline: e.target.value }; saveSegments(rows); }} /></label>
      <label className={label}>{tr("Класс", "Sinif", "Class")}<select className={input} value={seg.class ?? ""} onChange={(e) => { const rows = [...segments]; rows[i] = { ...seg, class: e.target.value }; saveSegments(rows); }}><option value="">{tr("Выберите", "Seçin", "Select")}</option>{dictionary.airlineClasses.map((x) => <option key={x.code} value={x.code}>{x.names[locale] ?? x.names.ru ?? x.code}</option>)}</select></label>
      <label className={label}>{tr("Багаж", "Baqaj", "Baggage")}<select className={input} value={seg.baggage ?? ""} onChange={(e) => { const rows = [...segments]; rows[i] = { ...seg, baggage: e.target.value }; saveSegments(rows); }}><option value="">{tr("Выберите", "Seçin", "Select")}</option>{dictionary.baggageAllowances.map((x) => <option key={x.code} value={x.code}>{x.names[locale] ?? x.names.ru ?? x.code}</option>)}</select></label>
      <label className={label}>{tr("Ручная кладь", "Əl yükü", "Carry-on")}<input className={input} value={seg.carryOn ?? ""} onChange={(e) => { const rows = [...segments]; rows[i] = { ...seg, carryOn: e.target.value }; saveSegments(rows); }} /></label>
    </div></div>)}<div className="flex gap-2"><button type="button" className="rounded border px-3 py-1.5 text-xs" onClick={() => { const reversed = { ...segments[0], from: segments[0]?.to ?? "", to: segments[0]?.from ?? "" }; saveSegments([...segments, reversed]); }}>+ {tr("Добавить обратный рейс", "Geri uçuş əlavə et", "Add return flight")}</button><button type="button" className="rounded border px-3 py-1.5 text-xs" onClick={() => saveSegments([...segments, { from: "", to: "", departureDate: "", arrivalDate: "", airline: "", class: "", baggage: "", carryOn: "" }])}>+ {tr("Добавить сегмент", "Seqment əlavə et", "Add segment")}</button></div></div>;
  }

  if (service.kind === "TRANSFER") return <div className="grid gap-3 sm:grid-cols-2">{supplier}<label className={label}>{tr("Место подачи", "Təqdim yeri", "Pickup")}<input className={input} value={d.from ?? ""} onChange={(e) => onData("from", e.target.value)} /></label><label className={label}>{tr("Назначение", "Təyinat", "Destination")}<input className={input} value={d.to ?? ""} onChange={(e) => onData("to", e.target.value)} /></label><label className={label}>{tr("Дата и время", "Tarix və vaxt", "Date/time")}<input type="datetime-local" className={input} value={d.datetime ?? ""} onChange={(e) => onData("datetime", e.target.value)} /></label><label className={label}>{tr("Пассажиры", "Sərnişinlər", "Passengers")}<input type="number" className={input} value={d.passengers ?? "1"} onChange={(e) => onData("passengers", e.target.value)} /></label><label className={label}>{tr("Транспорт", "Nəqliyyat", "Vehicle")}<input className={input} value={d.vehicle ?? ""} onChange={(e) => onData("vehicle", e.target.value)} /></label><label className={label}>{tr("Комментарий", "Şərh", "Comment")}<input className={input} value={d.comment ?? ""} onChange={(e) => onData("comment", e.target.value)} /></label></div>;

  if (service.kind === "INSURANCE") return <div className="grid gap-3 sm:grid-cols-2">{supplier}<label className={label}>{tr("Страна действия", "Qüvvədə olan ölkə", "Coverage country")}<input className={input} value={d.country ?? ""} onChange={(e) => onData("country", e.target.value)} /></label><label className={label}>{tr("Начало", "Başlanğıc", "Start")}<input type="date" className={input} value={d.startDate ?? ""} onChange={(e) => onData("startDate", e.target.value)} /></label><label className={label}>{tr("Окончание", "Son", "End")}<input type="date" className={input} value={d.endDate ?? ""} onChange={(e) => onData("endDate", e.target.value)} /></label><label className={label}>{tr("Застрахованных", "Sığortalananlar", "Insured")}<input type="number" className={input} value={d.insured ?? "1"} onChange={(e) => onData("insured", e.target.value)} /></label><label className={label}>{tr("Тип страхования", "Sığorta növü", "Insurance type")}<input className={input} value={d.insuranceType ?? ""} onChange={(e) => onData("insuranceType", e.target.value)} /></label></div>;

  if (service.kind === "VISA") return <div className="grid gap-3 sm:grid-cols-2">{supplier}<label className={label}>{tr("Страна назначения", "Təyinat ölkəsi", "Destination country")}<input className={input} value={d.country ?? ""} onChange={(e) => onData("country", e.target.value)} /></label><label className={label}>{tr("Тип визы", "Viza növü", "Visa type")}<input className={input} value={d.visaType ?? ""} onChange={(e) => onData("visaType", e.target.value)} /></label><label className={label}>{tr("Заявителей", "Müraciət edənlər", "Applicants")}<input type="number" className={input} value={d.applicants ?? "1"} onChange={(e) => onData("applicants", e.target.value)} /></label><label className={label}>{tr("Дата поездки", "Səfər tarixi", "Travel date")}<input type="date" className={input} value={d.travelDate ?? ""} onChange={(e) => onData("travelDate", e.target.value)} /></label></div>;

  if (service.kind === "CRUISE") return <div className="grid gap-3 sm:grid-cols-2">{supplier}<label className={label}>{tr("Название круиза", "Kruiz adı", "Cruise name")}<input className={input} value={d.cruiseName ?? ""} onChange={(e) => onData("cruiseName", e.target.value)} /></label><label className={label}>{tr("Судно", "Gəmi", "Ship")}<input className={input} value={d.ship ?? ""} onChange={(e) => onData("ship", e.target.value)} /></label><label className={label}>{tr("Маршрут", "Marşrut", "Route")}<input className={input} value={d.route ?? ""} onChange={(e) => onData("route", e.target.value)} /></label><label className={label}>{tr("Начало", "Başlanğıc", "Start")}<input type="date" className={input} value={d.startDate ?? ""} onChange={(e) => onData("startDate", e.target.value)} /></label><label className={label}>{tr("Окончание", "Son", "End")}<input type="date" className={input} value={d.endDate ?? ""} onChange={(e) => onData("endDate", e.target.value)} /></label><label className={label}>{tr("Каюта", "Kabina", "Cabin")}<input className={input} value={d.cabin ?? ""} onChange={(e) => onData("cabin", e.target.value)} /></label></div>;

  return <div className="grid gap-3 sm:grid-cols-2">{supplier}<label className={label}>{tr("Название услуги", "Xidmətin adı", "Service name")}<input className={input} value={service.title} onChange={(e) => onChange({ title: e.target.value })} /></label><label className={label}>{tr("Описание", "Təsvir", "Description")}<input className={input} value={d.description ?? ""} onChange={(e) => onData("description", e.target.value)} /></label><label className={label}>{tr("Дата оказания", "Göstərilmə tarixi", "Service date")}<input type="date" className={input} value={d.travelDate ?? ""} onChange={(e) => onData("travelDate", e.target.value)} /></label></div>;
}
