"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-user";
import DateTextInput from "@/components/forms/DateTextInput";

type RequestType =
  | "TOUR_PACKAGE"
  | "HOTEL"
  | "FLIGHT"
  | "TRANSFER"
  | "INSURANCE"
  | "VISA"
  | "FLIGHT_BOOKING"
  | "CRUISE"
  | "GUIDE"
  | "EXCURSION"
  | "CUSTOM_PACKAGE"
  | "OTHER";

type ServiceKind = "HOTEL" | "FLIGHT" | "TRANSFER" | "INSURANCE" | "VISA" | "CRUISE" | "GUIDE" | "EXCURSION" | "TOUR_PACKAGE" | "OTHER";

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

interface AirportOption {
  code: string;
  name: string;
  countryCode: string;
  countryName: string;
  cityName: string;
  countryNameRu?: string;
  countryNameEn?: string;
  cityNameRu?: string;
  cityNameEn?: string;
}

interface Traveler {
  firstName: string;
  lastName: string;
  middleName: string;
  birthDate: string;
  citizenship: string;
  documentType: string;
  passportNumber: string;
  passportSeries: string;
  passportIssuedAt: string;
  passportExpiry: string;
}

interface ServiceDraft {
  key: string;
  kind: ServiceKind;
  requestTypeCode?: string;
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
  { value: "GUIDE", ru: "Гиды", az: "Bələdçilər", en: "Guides" },
  { value: "EXCURSION", ru: "Экскурсии", az: "Ekskursiyalar", en: "Excursions" },
  { value: "CUSTOM_PACKAGE", ru: "Собрать турпакет", az: "Tur paketini yığ", en: "Build tour package" },
  { value: "OTHER", ru: "Другое", az: "Digər", en: "Other" },
];

const PACKAGE_KINDS: ServiceKind[] = ["HOTEL", "FLIGHT", "TRANSFER", "INSURANCE", "VISA", "GUIDE", "EXCURSION"];
const SERVICE_TYPE_KIND: Record<string, ServiceKind> = {
  TOUR: "TOUR_PACKAGE",
  TOUR_PACKAGE: "TOUR_PACKAGE",
  CUSTOM_PACKAGE: "TOUR_PACKAGE",
  HOTEL: "HOTEL",
  FLIGHT: "FLIGHT",
  FLIGHT_BOOKING: "FLIGHT",
  CRUISE: "CRUISE",
  GUIDE: "GUIDE",
  EXCURSION: "EXCURSION",
  TRANSFER: "TRANSFER",
  INSURANCE: "INSURANCE",
  VISA: "VISA",
  OTHER: "OTHER",
};

const KIND_TO_SERVICE_TYPE: Partial<Record<ServiceKind, string>> = {
  TOUR_PACKAGE: "TOUR",
  HOTEL: "HOTEL",
  FLIGHT: "FLIGHT",
  CRUISE: "CRUISE",
  GUIDE: "GUIDE",
  EXCURSION: "EXCURSION",
  TRANSFER: "TRANSFER",
  INSURANCE: "INSURANCE",
  VISA: "VISA",
  OTHER: "OTHER",
};

function typeLabel(locale: string, value: RequestType) {
  const row = TYPES.find((x) => x.value === value);
  return row ? (locale === "az" ? row.az : locale === "en" ? row.en : row.ru) : value;
}

function kindLabel(locale: string, kind: ServiceKind) {
  return typeLabel(locale, kind as RequestType);
}

function newTraveler(): Traveler {
  return { firstName: "", lastName: "", middleName: "", birthDate: "", citizenship: "", documentType: "PASSPORT", passportSeries: "", passportNumber: "", passportIssuedAt: "", passportExpiry: "" };
}

function newService(kind: ServiceKind): ServiceDraft {
  return { key: `${kind}-${Math.random().toString(36).slice(2, 9)}`, kind, requestTypeCode: KIND_TO_SERVICE_TYPE[kind], enabled: true, supplierCode: "", supplierName: "", title: "", data: {} };
}

const input = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-[#0f6b5f] focus:ring-2 focus:ring-[#0f6b5f]/10";
const label = "grid gap-1 text-[11px] font-medium text-ink";

export default function CreateRequestPage() {
  const locale = useLocale();
  const currentUser = useCurrentUser();
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerIsTraveler, setCustomerIsTraveler] = useState(false);
  const [customerListOpen, setCustomerListOpen] = useState(true);
  const [newCustomer, setNewCustomer] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [requestType, setRequestType] = useState<RequestType>("TOUR_PACKAGE");
  const [managerId, setManagerId] = useState("");
  const [managers, setManagers] = useState<Manager[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [serviceTypes, setServiceTypes] = useState<Array<{ code: string; names: Record<string, string> }>>([]);
  const [primarySupplierCode, setPrimarySupplierCode] = useState("");
  const [travelers, setTravelers] = useState<Traveler[]>([newTraveler()]);
  const [services, setServices] = useState<ServiceDraft[]>([newService("TOUR_PACKAGE")]);
  const [savedServiceKeys, setSavedServiceKeys] = useState<string[]>([]);
  const [salePrice, setSalePrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [currency, setCurrency] = useState("AZN");
  const [serviceStart, setServiceStart] = useState("");
  const [serviceEnd, setServiceEnd] = useState("");
  const [dictionary, setDictionary] = useState<{ mealTypes: DictionaryEntry[]; roomTypes: DictionaryEntry[]; placementTypes: DictionaryEntry[]; viewTypes: DictionaryEntry[]; airlineClasses: DictionaryEntry[]; baggageAllowances: DictionaryEntry[] }>({ mealTypes: [], roomTypes: [], placementTypes: [], viewTypes: [], airlineClasses: [], baggageAllowances: [] });
  const [countries, setCountries] = useState<GeoCountry[]>([]);
  const [cities, setCities] = useState<GeoCity[]>([]);
  const [airports, setAirports] = useState<AirportOption[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState("");
  const [activePackageKind, setActivePackageKind] = useState<ServiceKind>("HOTEL");
  const [hotelQuery, setHotelQuery] = useState("");
  const [hotelOptions, setHotelOptions] = useState<ProductOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ id: string; referenceNumber: string; commerceSequence?: string } | null>(null);

  const tr = (ru: string, az: string, en: string) => (locale === "az" ? az : locale === "en" ? en : ru);

  const travelerStats = useMemo(() => {
    const today = new Date();
    let adults = 0;
    const childAges: number[] = [];
    for (const traveler of travelers) {
      if (!traveler.birthDate) {
        adults += 1;
        continue;
      }
      const birth = new Date(`${traveler.birthDate}T00:00:00`);
      if (Number.isNaN(birth.getTime())) {
        adults += 1;
        continue;
      }
      let age = today.getFullYear() - birth.getFullYear();
      const beforeBirthday =
        today.getMonth() < birth.getMonth() ||
        (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
      if (beforeBirthday) age -= 1;
      if (age < 18) childAges.push(Math.max(0, age));
      else adults += 1;
    }
    return { adults, children: childAges.length, childAges };
  }, [travelers]);

  useEffect(() => {
    const ages = travelerStats.childAges.join(", ");
    setServices((prev) =>
      prev.map((service) =>
        service.kind === "HOTEL" || service.kind === "TOUR_PACKAGE"
          ? {
              ...service,
              data: {
                ...service.data,
                adults: String(travelerStats.adults),
                children: String(travelerStats.children),
                childrenAges: ages,
              },
            }
          : service,
      ),
    );
  }, [travelerStats]);

  useEffect(() => {
    if (requestType !== "CUSTOM_PACKAGE") return;
    const totalCost = services.reduce((sum, service) => sum + Number(service.data.costPrice || 0), 0);
    const totalSale = services.reduce((sum, service) => sum + Number(service.data.salePrice || 0), 0);
    setCostPrice(totalCost > 0 ? totalCost.toFixed(2) : "");
    setSalePrice(totalSale > 0 ? totalSale.toFixed(2) : "");
  }, [services, requestType]);


  async function fillTravelerFromCustomer(customer: Customer | null) {
    if (!customer) return;
    let profile: {
      firstName?: string | null;
      lastName?: string | null;
      birthDate?: string | null;
      citizenship?: string | null;
      passportSeries?: string | null;
      passportNumber?: string | null;
      passportExpiry?: string | null;
    } | null = null;
    try {
      profile = await api.get<any>(`/customers/${customer.id}/travel-profile`);
    } catch {
      profile = null;
    }
    setTravelers((prev) => {
      if (prev.length === 0) return prev;
      const first = prev[0];
      return [{
        ...first,
        firstName: profile?.firstName || customer.firstName || first.firstName,
        lastName: profile?.lastName || customer.lastName || first.lastName,
        birthDate: profile?.birthDate || first.birthDate,
        citizenship: profile?.citizenship || first.citizenship,
        passportSeries: profile?.passportSeries || first.passportSeries,
        passportNumber: profile?.passportNumber || first.passportNumber,
        passportExpiry: profile?.passportExpiry || first.passportExpiry,
      }, ...prev.slice(1)];
    });
  }

  useEffect(() => {
    if (!customerIsTraveler) return;
    const firstName = customerMode === "existing" ? selectedCustomer?.firstName : newCustomer.firstName;
    const lastName = customerMode === "existing" ? selectedCustomer?.lastName : newCustomer.lastName;
    if (!firstName && !lastName) return;
    setTravelers((prev) => {
      if (prev.length === 0) return prev;
      const first = prev[0];
      if (first.firstName === (firstName ?? "") && first.lastName === (lastName ?? "")) return prev;
      return [{ ...first, firstName: firstName ?? first.firstName, lastName: lastName ?? first.lastName }, ...prev.slice(1)];
    });
  }, [customerIsTraveler, customerMode, selectedCustomer?.firstName, selectedCustomer?.lastName, newCustomer.firstName, newCustomer.lastName]);

  useEffect(() => {
    Promise.all([
      api.get<{ items?: Customer[] } | Customer[]>(`/customers?pageSize=20${customerSearch ? `&search=${encodeURIComponent(customerSearch)}` : ""}`).catch(() => ({ items: [] })),
      api.get<Manager[]>("/sales/assignment/load").catch(() => []),
      api.get<{ items?: Array<{ id: string; code: string; name: string }> }>(`/partners?pageSize=300`).catch(() => ({ items: [] })),
    ]).then(([customerData, managerData, partnerData]) => {
      setCustomers(Array.isArray(customerData) ? customerData : customerData.items ?? []);
      setManagers(Array.isArray(managerData) ? managerData : []);
      const supplierRows: Supplier[] = (partnerData.items ?? []).map((p) => ({ code: p.code, name: p.name }));
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
    api.get<Array<{ code: string; names: Record<string, string> }>>("/hotel-directory/service-types")
      .then((rows) => setServiceTypes(Array.isArray(rows) ? rows : []))
      .catch(() => setServiceTypes([]));
    api.get<AirportOption[]>("/hotel-directory/airports")
      .then((rows) => setAirports(Array.isArray(rows) ? rows : []))
      .catch(() => setAirports([]));
  }, []);

  useEffect(() => {
    if (currentUser && ["SALES_MANAGER", "SALES_HEAD"].includes(currentUser.role) && !managerId) {
      setManagerId(currentUser.id);
    }
  }, [currentUser, managerId]);

  useEffect(() => {
    Promise.all([
      api.get<any>("/tour-builder/dictionaries").catch(() => null),
      api.get<any>("/geo/directory").catch(() => null),
    ]).then(([dict, geo]) => {
      if (dict) setDictionary({ mealTypes: dict.mealTypes ?? [], roomTypes: dict.roomTypes ?? [], placementTypes: dict.placementTypes ?? [], viewTypes: dict.viewTypes ?? [], airlineClasses: dict.airlineClasses ?? [], baggageAllowances: dict.baggageAllowances ?? [] });
      const rows = Array.isArray(geo) ? geo : geo?.value ?? [];
      setCountries(rows);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedCountryId) { setCities([]); return; }
    api.get<any>(`/geo/cities?countryId=${encodeURIComponent(selectedCountryId)}&status=ACTIVE`).then((geo) => setCities(Array.isArray(geo) ? geo : geo?.value ?? [])).catch(() => setCities([]));
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
    if (field === "checkIn") setServiceStart(value);
    if (field === "checkOut") setServiceEnd(value);
    setServices((prev) => prev.map((s) => (s.key === key ? { ...s, data: { ...s.data, [field]: value } } : s)));
  }

  function saveService(key: string) {
    const service = services.find((s) => s.key === key);
    if (service) setActivePackageKind(service.kind);
    setRequestType("CUSTOM_PACKAGE");
    setSavedServiceKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  function deleteService(key: string) {
    setServices((prev) => prev.filter((s) => s.key !== key));
    setSavedServiceKeys((prev) => prev.filter((saved) => saved !== key));
  }

  function serviceDates(service: ServiceDraft): string {
    const d = service.data;
    const from = d.checkIn || d.startDate || d.departureDate || d.travelDate;
    const to = d.checkOut || d.endDate || d.arrivalDate;
    if (from && to) return `${from} — ${to}`;
    return from || "—";
  }

  const savedServices = services.filter((s) => savedServiceKeys.includes(s.key));
  const packageTotalCost = savedServices.reduce((sum, s) => sum + Number(s.data.costPrice || 0), 0);
  const packageTotalSale = savedServices.reduce((sum, s) => sum + Number(s.data.salePrice || 0), 0);

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
  const serviceTypeOptions = serviceTypes.length > 0
    ? serviceTypes.map((row) => ({ code: row.code, label: row.names?.[locale] ?? row.names?.ru ?? row.code }))
    : TYPES.map((row) => ({ code: row.value, label: row[locale === "az" ? "az" : locale === "en" ? "en" : "ru"] }));
  const visibleServiceType = visibleService ? KIND_TO_SERVICE_TYPE[visibleService.kind] ?? "OTHER" : "TOUR";

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
    if (rows.some((s) => !s.supplierCode && s.kind !== "VISA")) { setError(tr("Выберите поставщика для каждой услуги", "Hər xidmət üçün təchizatçı seçin", "Select a supplier for each service")); return; }
    setBusy(true);
    try {
      const customerId = await createCustomerIfNeeded();
      const firstDate = rows.map((s) => s.data.startDate || s.data.checkIn || s.data.departureDate || s.data.travelDate || "").find(Boolean) || undefined;
      const packageSaleTotal = rows.reduce((sum, s) => sum + Number(s.data.salePrice || 0), 0);
      const effectiveSalePrice = requestType === "CUSTOM_PACKAGE" ? packageSaleTotal : Number(salePrice || 0);
      const rawRequestType = rows.length > 1
        ? "CUSTOM_PACKAGE"
        : (rows[0]?.requestTypeCode ?? KIND_TO_SERVICE_TYPE[rows[0]?.kind ?? "TOUR_PACKAGE"] ?? requestType);
      const effectiveRequestType = rawRequestType === "TOUR" ? "TOUR_PACKAGE" : rawRequestType;
      const payload = {
        ...(customerId ? { customerId } : {}),
        ...(managerId ? { assignedManagerId: managerId } : {}),
        requestType: effectiveRequestType,
        primarySupplierCode: primarySupplierCode || rows[0]?.supplierCode || undefined,
        requestedServiceDate: serviceStart || firstDate,
        ...(effectiveSalePrice > 0 ? { displayedPrice: effectiveSalePrice, displayedCurrency: currency } : {}),
        quantity: travelers.length,
        travelerCount: travelers.length,
        travelers: travelers.map((t) => ({
          firstName: t.firstName.trim(),
          lastName: t.lastName.trim(),
          birthDate: t.birthDate,
          citizenship: t.citizenship || undefined,
          passportNumber: t.passportNumber || undefined,
          passportSeries: t.passportSeries || undefined,
          passportExpiry: t.passportExpiry || undefined,
        })),
        tripDetails: {
          ...(rows[0]?.data ?? {}),
          dateFrom: serviceStart || undefined,
          dateTo: serviceEnd || undefined,
          adults: travelerStats.adults,
          children: travelerStats.children,
          childAges: travelerStats.childAges,
        },
        services: rows.map((s) => {
          const lineCost = s.data.costPrice || (requestType === "CUSTOM_PACKAGE" ? "" : costPrice);
          const lineSale = s.data.salePrice || (requestType === "CUSTOM_PACKAGE" ? "" : salePrice);
          return {
            serviceType: s.kind,
            supplierCode: s.supplierCode === "NO_SUPPLIER" ? undefined : s.supplierCode || undefined,
            supplierName: s.supplierName || undefined,
            title: s.title || s.data.hotelName || kindLabel(locale, s.kind),
            data: { ...s.data, salePrice: lineSale, costPrice: lineCost, currency, startDate: serviceStart, endDate: serviceEnd },
          };
        }),
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
      <h1 className="text-2xl font-semibold text-ink">{tr("Создание заявки", "Müraciət yaratma", "Create request")}</h1>
      <p className="mt-1 text-sm text-ink/60">{tr("Оформите запрос. После создания он появится в Реестре продаж.", "Sorğunu rəsmiləşdirin. Yaradıldıqdan sonra Satış reyestrində görünəcək.", "Create a request. It will appear in the Sales Register after saving.")}</p>
    </div>

    {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

    <section className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{tr("Покупатель", "Müştəri", "Customer")}</h2><div className="flex gap-1"><button type="button" onClick={() => setCustomerMode("existing")} className={`rounded px-2 py-1 text-[11px] ${customerMode === "existing" ? "bg-[#0f6b5f] text-white" : "border"}`}>{tr("Существующий", "Mövcud", "Existing")}</button><button type="button" onClick={() => setCustomerMode("new")} className={`rounded px-2 py-1 text-[11px] ${customerMode === "new" ? "bg-[#0f6b5f] text-white" : "border"}`}>{tr("Новый", "Yeni", "New")}</button></div></div>
      {customerMode === "existing" ? <div className="space-y-2">
        <input className={input} value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setCustomerListOpen(true); }} onFocus={() => setCustomerListOpen(true)} placeholder={tr("Поиск по имени, телефону или email", "Ad, telefon və ya e-poçtla axtar", "Search by name, phone or email")} />
        {selectedCustomer && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">{selectedCustomer.firstName} {selectedCustomer.lastName} · {selectedCustomer.phone ?? selectedCustomer.email}</div>}
        {customerListOpen && customerSearch.trim().length > 0 && !selectedCustomer && (
          <div className="max-h-40 divide-y overflow-auto rounded-lg border">{customers.map((c) => <button key={c.id} type="button" onClick={() => { setSelectedCustomer(c); setCustomerSearch(`${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()); setCustomerListOpen(false); if (customerIsTraveler) fillTravelerFromCustomer(c); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-panel"><span>{c.firstName} {c.lastName} {c.companyName ? `· ${c.companyName}` : ""}</span><span className="text-ink/60">{c.phone ?? c.email}</span></button>)}</div>
        )}
      </div> : <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>{tr("Фамилия", "Soyad", "Last name")}<input className={input} value={newCustomer.lastName} onChange={(e) => setNewCustomer({ ...newCustomer, lastName: e.target.value })} /></label>
        <label className={label}>{tr("Имя", "Ad", "First name")}<input className={input} value={newCustomer.firstName} onChange={(e) => setNewCustomer({ ...newCustomer, firstName: e.target.value })} /></label>
        <label className={label}>{tr("Телефон", "Telefon", "Phone")}<input className={input} value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="+994..." /></label>
        <label className={label}>Email<input className={input} value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} /></label>
      </div>}
      <label className="mt-3 flex items-center gap-2 text-xs text-ink/70">
        <input
          type="checkbox"
          checked={customerIsTraveler}
          onChange={(e) => {
            const checked = e.target.checked;
            setCustomerIsTraveler(checked);
            if (!checked) return;
            if (customerMode === "existing") fillTravelerFromCustomer(selectedCustomer);
            else if (newCustomer.firstName.trim() || newCustomer.lastName.trim()) {
              setTravelers((prev) => [{ ...prev[0], firstName: newCustomer.firstName, lastName: newCustomer.lastName }, ...prev.slice(1)]);
            }
          }}
        />
        {tr("Клиент является туристом", "Müştəri turistdir", "Customer is a traveler")}
      </label>
    </section>

    <section className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">{tr("Ответственный менеджер", "Məsul menecer", "Responsible manager")}</h2>
      <select className={input} value={managerId} onChange={(e) => setManagerId(e.target.value)}><option value="">{tr("Автоматическое распределение", "Avtomatik paylama", "Automatic distribution")}</option>{managers.map((m) => <option key={m.userId} value={m.userId}>{m.name} · {m.active ?? 0}</option>)}</select>
    </section>


    <section className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">{tr("Туристы", "Turistlər", "Travelers")}</h2>
      <div className="space-y-3">{travelers.map((t, index) => <div key={index} className="rounded-lg border border-line p-3">
        <div className="mb-2 flex justify-between text-xs font-semibold"><span>{tr("Турист", "Turist", "Traveler")} {index + 1}</span>{travelers.length > 1 && <button type="button" className="text-rose-600" onClick={() => setTravelers(travelers.filter((_, i) => i !== index))}>{tr("Удалить", "Sil", "Delete")}</button>}</div>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className={label}>{tr("Фамилия", "Soyad", "Last name")}<input className={input} value={t.lastName} onChange={(e) => setTravelers(travelers.map((x, i) => i === index ? { ...x, lastName: e.target.value } : x))} /></label>
          <label className={label}>{tr("Имя", "Ad", "First name")}<input className={input} value={t.firstName} onChange={(e) => setTravelers(travelers.map((x, i) => i === index ? { ...x, firstName: e.target.value } : x))} /></label>
          <label className={label}>{tr("Отчество", "Ata adı", "Middle name")}<input className={input} value={t.middleName} onChange={(e) => setTravelers(travelers.map((x, i) => i === index ? { ...x, middleName: e.target.value } : x))} /></label>
          <label className={label}>{tr("Дата рождения", "Doğum tarixi", "Date of birth")}<DateTextInput className={input} value={t.birthDate} onChange={(v) => setTravelers(travelers.map((x, i) => i === index ? { ...x, birthDate: v } : x))} /></label>
          <label className={label}>{tr("Гражданство", "Vətəndaşlıq", "Citizenship")}<input className={input} value={t.citizenship} onChange={(e) => setTravelers(travelers.map((x, i) => i === index ? { ...x, citizenship: e.target.value } : x))} /></label>
          <label className={label}>{tr("Тип документа", "Sənəd növü", "Document type")}<select className={input} value={t.documentType} onChange={(e) => setTravelers(travelers.map((x, i) => i === index ? { ...x, documentType: e.target.value } : x))}><option value="PASSPORT">{tr("Паспорт", "Pasport", "Passport")}</option><option value="ID">ID</option></select></label>
          <label className={label}>{tr("Серия документа", "Sənəd seriyası", "Document series")}<input className={input} value={t.passportSeries} onChange={(e) => setTravelers(travelers.map((x, i) => i === index ? { ...x, passportSeries: e.target.value } : x))} /></label>
          <label className={label}>{tr("Номер паспорта", "Pasport nömrəsi", "Passport number")}<input className={input} value={t.passportNumber} onChange={(e) => setTravelers(travelers.map((x, i) => i === index ? { ...x, passportNumber: e.target.value } : x))} /></label>
          <label className={label}>{tr("Дата выдачи", "Verilmə tarixi", "Issued at")}<DateTextInput className={input} value={t.passportIssuedAt} onChange={(v) => setTravelers(travelers.map((x, i) => i === index ? { ...x, passportIssuedAt: v } : x))} /></label>
          <label className={label}>{tr("Срок действия", "Etibarlıdır", "Expiry")}<DateTextInput className={input} value={t.passportExpiry} onChange={(v) => setTravelers(travelers.map((x, i) => i === index ? { ...x, passportExpiry: v } : x))} /></label>
        </div>
      </div>)}</div>
      <button type="button" onClick={() => setTravelers([...travelers, newTraveler()])} className="mt-3 rounded-lg border border-line px-3 py-1.5 text-xs">+ {tr("Добавить туриста", "Turist əlavə et", "Add traveler")}</button>
    </section>

    <section className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">{tr("Услуги", "Xidmətlər", "Services")}</h2><label className="flex items-center gap-2 text-xs font-semibold text-ink">{tr("Тип услуги", "Xidmətin növü", "Service type")}<select className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs text-ink" value={visibleServiceType} onChange={(e) => {
        const code = e.target.value;
        const kind = SERVICE_TYPE_KIND[code] ?? "OTHER";
        setActivePackageKind(kind);
        setRequestType("CUSTOM_PACKAGE");
        if (visibleService) updateService(visibleService.key, { kind, requestTypeCode: code });
        else setServices([newService(kind)]);
      }}>{serviceTypeOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label></div>

      {visibleService ? <ServiceFields service={visibleService} locale={locale} suppliers={suppliers} primarySupplierCode={primarySupplierCode} hotelQuery={hotelQuery} setHotelQuery={setHotelQuery} hotelOptions={hotelOptions} onSelectHotel={(p) => { updateService(visibleService.key, { title: p.title }); updateData(visibleService.key, "hotelName", p.title); }} onChange={(patch) => updateService(visibleService.key, patch)} onData={(field, value) => updateData(visibleService.key, field, value)} dictionary={dictionary} countries={countries} cities={cities} airports={airports} selectedCountryId={selectedCountryId} setSelectedCountryId={setSelectedCountryId} /> : <button type="button" className="rounded-lg border px-3 py-2 text-xs" onClick={() => { setServices([...services, newService(currentKind)]); setRequestType("CUSTOM_PACKAGE"); }}>+ {tr("Добавить услугу", "Xidmət əlavə et", "Add service")}</button>}
      {visibleService && (
        <div className="mt-3">
          <button type="button" onClick={() => saveService(visibleService.key)} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark">
            {tr("Сохранить услугу", "Xidməti yadda saxla", "Save service")}
          </button>
        </div>
      )}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => {
            const kind = activePackageKind;
            setServices((prev) => [...prev, newService(kind)]);
            setRequestType("CUSTOM_PACKAGE");
          }}
          className="rounded-lg border border-[#0f6b5f] px-3 py-1.5 text-xs font-semibold text-[#0f6b5f]"
        >
          + {tr("Добавить услугу", "Xidmət əlavə et", "Add service")}
        </button>
      </div>
      {savedServiceKeys.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border border-line">
          <div className="border-b bg-panel px-3 py-2 text-xs font-semibold">
            {tr("Сохранённые услуги", "Yadda saxlanılan xidmətlər", "Saved services")}
          </div>
          {savedServices.map((s) => (
            <div key={s.key} className="flex flex-wrap items-center gap-3 border-b px-3 py-2 text-xs last:border-0">
              <span className="min-w-32 font-semibold">{kindLabel(locale, s.kind)}</span>
              <span className="text-ink">{s.supplierName || tr("Без поставщика", "Təchizatçı olmadan", "Without supplier")}</span>
              <span className="text-ink">{serviceDates(s)}</span>
              <span className="font-mono">{s.data.costPrice || "—"} / {s.data.salePrice || "—"} {currency}</span>
              <button type="button" onClick={() => deleteService(s.key)} className="ml-auto font-semibold text-rose-600 hover:text-rose-700">
                {tr("Удалить", "Sil", "Delete")}
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 bg-panel px-3 py-2 text-xs font-semibold">
            <span>{tr("Итого по пакету", "Paket üzrə cəmi", "Package total")}</span>
            <span className="ml-auto font-mono">{packageTotalCost.toFixed(2)} / {packageTotalSale.toFixed(2)} {currency}</span>
          </div>
        </div>
      )}
    </section>

    <section className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">{tr("Цены и сроки услуги", "Qiymətlər və xidmət müddəti", "Prices and service dates")}</h2>
      <div className="grid gap-3 sm:grid-cols-5">
        <label className={label}>{tr("Себестоимость", "Maya dəyəri", "Cost")}<input className={input} inputMode="decimal" value={costPrice} onChange={(e) => setCostPrice(e.target.value.replace(",", "."))} /></label>
        <label className={label}>{tr("Цена продажи", "Satış qiyməti", "Sale price")}<input className={input} inputMode="decimal" value={salePrice} onChange={(e) => setSalePrice(e.target.value.replace(",", "."))} /></label>
        <label className={label}>{tr("Валюта", "Valyuta", "Currency")}<select className={input} value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="AZN">AZN</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
        <label className={label}>{tr("Начало услуги", "Xidmətin başlanğıcı", "Service start")}<DateTextInput className={input} value={serviceStart} onChange={setServiceStart} /></label>
        <label className={label}>{tr("Конец услуги", "Xidmətin sonu", "Service end")}<DateTextInput className={input} value={serviceEnd} onChange={setServiceEnd} /></label>
      </div>
    </section>

    <div className="flex justify-end gap-2 pb-8"><Link href="/app/finance/deals" className="rounded-lg border px-4 py-2 text-sm">{tr("Отмена", "Ləğv et", "Cancel")}</Link><button type="button" disabled={busy} onClick={() => void submit()} className="rounded-lg bg-[#0f6b5f] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? tr("Создание…", "Yaradılır…", "Creating…") : tr("Создать заявку", "Müraciət yarat", "Create request")}</button></div>
  </div>;
}

function Combobox({ options, value, onChange, placeholder }: { options: Array<{ value: string; label: string }>; value: string; onChange: (value: string) => void; placeholder: string }) {
  const [query, setQuery] = useState(options.find((option) => option.value === value)?.label ?? "");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setQuery(options.find((option) => option.value === value)?.label ?? "");
  }, [value]);
  const filtered = options
    .filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 50);
  return (
    <div className="relative">
      <input
        className={input}
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          const match = options.find((option) => option.label.toLowerCase() === next.toLowerCase());
          onChange(match?.value ?? "");
        }}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-52 overflow-auto rounded-lg border border-line bg-white shadow-xl">
          {filtered.map((option) => (
            <button
              key={option.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery(option.label);
                setOpen(false);
                onChange(option.value);
              }}
              className="block w-full px-3 py-2 text-left text-[11px] hover:bg-panel"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceFields({ service, locale, suppliers, primarySupplierCode, hotelQuery, setHotelQuery, hotelOptions, onSelectHotel, onChange, onData, dictionary, countries, cities, airports, selectedCountryId, setSelectedCountryId }: {
  service: ServiceDraft; locale: string; suppliers: Supplier[]; primarySupplierCode: string;
  hotelQuery: string; setHotelQuery: (v: string) => void; hotelOptions: ProductOption[];
  onSelectHotel: (p: ProductOption) => void; onChange: (patch: Partial<ServiceDraft>) => void; onData: (field: string, value: string) => void;
  dictionary: { mealTypes: DictionaryEntry[]; roomTypes: DictionaryEntry[]; placementTypes: DictionaryEntry[]; viewTypes: DictionaryEntry[]; airlineClasses: DictionaryEntry[]; baggageAllowances: DictionaryEntry[] };
  countries: GeoCountry[]; cities: GeoCity[]; airports: AirportOption[]; selectedCountryId: string; setSelectedCountryId: (v: string) => void;
}) {
  const tr = (ru: string, az: string, en: string) => (locale === "az" ? az : locale === "en" ? en : ru);
  const input = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm";
  const label = "grid gap-1 text-[11px] font-medium text-ink";
  const d = service.data;
  const airportCity = (airport: AirportOption) => locale === "ru"
    ? (airport.cityNameRu || airport.cityName)
    : locale === "en" ? (airport.cityNameEn || airport.cityName) : airport.cityName;
  const [hotelSearch, setHotelSearch] = useState(d.hotelName ?? service.title ?? "");
  const [hotelOpen, setHotelOpen] = useState(false);
  const [hotelResults, setHotelResults] = useState<Array<{ id: string; name: string; suppliers?: string[]; countryCode?: string; cityName?: string; resortName?: string }>>([]);
  useEffect(() => {
    if (service.kind !== "HOTEL" && service.kind !== "TOUR_PACKAGE") return;
    const query = hotelSearch.trim();
    if (!hotelOpen && query.length < 2) { setHotelResults([]); return; }
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ limit: "20" });
      if (d.country) params.set("country", d.country);
      if (query) params.set("q", query);
      api.get<Array<{ id: string; name: string; suppliers?: string[]; countryCode?: string; cityName?: string; resortName?: string }>>(`/hotel-directory/hotels?${params.toString()}`)
        .then((rows) => setHotelResults(Array.isArray(rows) ? rows : [])).catch(() => setHotelResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [hotelSearch, d.country, d.city, service.kind, hotelOpen]);
  useEffect(() => {
    if (!d.city || d.cityId || cities.length === 0) return;
    const match = cities.find((city) => (city.names[locale] ?? city.names.ru ?? city.code).toLowerCase() === String(d.city).toLowerCase());
    if (match) onData("cityId", match.id);
  }, [cities, d.city, d.cityId, locale, onData]);

  useEffect(() => {
    if (service.kind !== "TOUR_PACKAGE") return;
    if (d.flightFromAirport && d.flightToAirport) {
      if (d.returnFromAirport !== d.flightToAirport) onData("returnFromAirport", d.flightToAirport);
      if (d.returnToAirport !== d.flightFromAirport) onData("returnToAirport", d.flightFromAirport);
    }
  }, [d.flightFromAirport, d.flightToAirport, d.returnFromAirport, d.returnToAirport, service.kind, onData]);

  const chooseHotel = (hotel: { id: string; name: string; suppliers?: string[]; countryCode?: string; cityName?: string; resortName?: string }) => {
    setHotelSearch(hotel.name);
    onSelectHotel({ id: hotel.id, title: hotel.name });
    onData("hotelName", hotel.name);
    if (hotel.countryCode) {
      const country = countries.find((c) => c.code === hotel.countryCode);
      if (country) {
        setSelectedCountryId(country.id);
        onData("country", country.code);
      }
    }
    const cityName = hotel.cityName || hotel.resortName;
    if (cityName) onData("city", cityName);
    if (hotel.suppliers?.[0] && !service.supplierCode) onChange({ supplierCode: hotel.suppliers[0], supplierName: hotel.suppliers[0] });
    setHotelOpen(false);
    setHotelResults([]);
  };
  const supplier = <label className={label}>{tr("Поставщик услуги", "Xidmət təchizatçısı", "Service supplier")}<select className={input} value={service.supplierCode} onChange={(e) => { const code = e.target.value; const row = suppliers.find((s) => s.code === code); onChange({ supplierCode: code, supplierName: code === "NO_SUPPLIER" ? "" : row?.name ?? "" }); }}><option value="">{tr("Выберите", "Seçin", "Select")}</option>{service.kind === "VISA" && <option value="NO_SUPPLIER">{tr("Без поставщика", "Təchizatçı olmadan", "Without supplier")}</option>}{suppliers.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>;
  const servicePriceFields = <div className="grid gap-3 sm:grid-cols-2 sm:col-span-2">
    <label className={label}>{tr("Себестоимость услуги", "Xidmətin maya dəyəri", "Service cost")}<input className={input} inputMode="decimal" value={d.costPrice ?? ""} onChange={(e) => onData("costPrice", e.target.value.replace(",", "."))} /></label>
    <label className={label}>{tr("Цена продажи", "Satış qiyməti", "Sale price")}<input className={input} inputMode="decimal" value={d.salePrice ?? ""} onChange={(e) => onData("salePrice", e.target.value.replace(",", "."))} /></label>
  </div>;

  if (service.kind === "HOTEL" || service.kind === "TOUR_PACKAGE") {
    const isTour = service.kind === "TOUR_PACKAGE";
    const airportField = (field: string, title: string) => (
      <label className={label}>{title}
        <select className={input} value={d[field] ?? ""} onChange={(e) => onData(field, e.target.value)}>
          <option value="">{tr("Выберите аэропорт", "Aeroport seçin", "Select airport")}</option>
          {airports.map((airport) => <option key={airport.code} value={airport.code}>{airport.code} — {airportCity(airport) || airport.name}</option>)}
        </select>
      </label>
    );
    return <div className="space-y-4">
      <div className="rounded-lg border border-line p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink">{tr("Общие данные", "Ümumi məlumatlar", "General")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {supplier}{servicePriceFields}
          <label className={label}>{tr("Страна", "Ölkə", "Country")}<Combobox options={countries.map((c) => ({ value: c.id, label: c.names[locale] ?? c.names.ru ?? c.code }))} value={selectedCountryId} onChange={(v) => { setSelectedCountryId(v); const row = countries.find((c) => c.id === v); onData("country", row?.code ?? ""); }} placeholder={tr("Начните вводить страну", "Ölkə adını yazın", "Start typing a country")} /></label>
          <label className={label}>{tr("Город", "Şəhər", "City")}<Combobox options={cities.map((c) => ({ value: c.id, label: c.names[locale] ?? c.names.ru ?? c.code }))} value={d.cityId ?? ""} onChange={(v) => { const row = cities.find((c) => c.id === v); onData("cityId", v); onData("city", row?.code ?? row?.names[locale] ?? ""); }} placeholder={tr("Начните вводить город", "Şəhər adını yazın", "Start typing a city")} /></label>
          <label className={label}>{tr("Начало тура", "Turun başlanğıcı", "Tour start")}<DateTextInput className={input} value={d.checkIn ?? ""} onChange={(v) => onData("checkIn", v)} /></label>
          <label className={label}>{tr("Конец тура", "Turun sonu", "Tour end")}<DateTextInput className={input} value={d.checkOut ?? ""} onChange={(v) => onData("checkOut", v)} /></label>
          <label className={label}>{tr("Номеров", "Otaq sayı", "Rooms")}<input type="number" min="1" className={input} value={d.rooms ?? "1"} onChange={(e) => onData("rooms", e.target.value)} /></label>
          <label className={label}>{tr("Взрослых", "Böyüklər", "Adults")}<input type="number" min="1" className={input} value={d.adults ?? "2"} onChange={(e) => onData("adults", e.target.value)} /></label>
          <label className={label}>{tr("Детей", "Uşaqlar", "Children")}<input type="number" min="0" className={input} value={d.children ?? "0"} onChange={(e) => onData("children", e.target.value)} /></label>
          <label className={label}>{tr("Возраст детей", "Uşaqların yaşı", "Children ages")}<input className={input} value={d.childrenAges ?? ""} onChange={(e) => onData("childrenAges", e.target.value)} /></label>
        </div>
      </div>
      <div className="rounded-lg border border-line p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink">{tr("Данные отеля", "Otel məlumatları", "Hotel data")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`${label} relative`}>{tr("Название отеля", "Otel adı", "Hotel name")}
            <input className={input} value={hotelSearch} onClick={() => setHotelOpen((open) => !open)} onBlur={() => window.setTimeout(() => setHotelOpen(false), 150)} onChange={(e) => { setHotelSearch(e.target.value); setHotelOpen(true); onData("hotelName", e.target.value); }} placeholder={tr("Начните вводить название отеля", "Otel adını yazmağa başlayın", "Start typing a hotel name")} />
            {hotelOpen && hotelResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-52 overflow-auto rounded-lg border border-line bg-white shadow-xl">
                {hotelResults.map((p) => (
                  <button key={p.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chooseHotel(p)} className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-[11px] last:border-0 hover:bg-panel">
                    <span>{p.name}</span><span className="text-ink/60">{p.resortName ?? p.cityName ?? p.suppliers?.join(", ")}</span>
                  </button>
                ))}
              </div>
            )}
          </label>
          <label className={label}>{tr("Тип номера", "Otaq növü", "Room type")}<select className={input} value={d.roomType ?? ""} onChange={(e) => onData("roomType", e.target.value)}><option value="">{tr("Выберите", "Seçin", "Select")}</option>{dictionary.roomTypes.map((x) => <option key={x.code} value={x.code}>{x.names[locale] ?? x.names.ru ?? x.code}</option>)}</select></label>
          <label className={label}>{tr("Тип размещения", "Yerləşmə növü", "Accommodation")}<select className={input} value={d.accommodation ?? ""} onChange={(e) => onData("accommodation", e.target.value)}><option value="">{tr("Выберите", "Seçin", "Select")}</option>{dictionary.placementTypes.map((x) => <option key={x.code} value={x.code}>{x.names[locale] ?? x.names.ru ?? x.code}</option>)}</select></label>
          <label className={label}>{tr("Тип питания", "Qidalanma növü", "Meal")}<select className={input} value={d.meal ?? ""} onChange={(e) => onData("meal", e.target.value)}><option value="">{tr("Выберите", "Seçin", "Select")}</option>{dictionary.mealTypes.map((x) => <option key={x.code} value={x.code}>{x.names[locale] ?? x.names.ru ?? x.code}</option>)}</select></label>
        </div>
      </div>
      {isTour && <div className="rounded-lg border border-line p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink">{tr("Данные авиа", "Avia məlumatları", "Flight data")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 text-[10px] font-semibold uppercase text-ink">{tr("Начало услуги", "Xidmətin başlanğıcı", "Service start")}</div>
          {airportField("flightFromAirport", tr("Аэропорт вылета", "Uçuş aeroportu", "Departure airport"))}
          {airportField("flightToAirport", tr("Аэропорт прилёта", "Gəliş aeroportu", "Arrival airport"))}
          <label className={label}>{tr("Время вылета", "Uçuş vaxtı", "Departure time")}<input type="time" className={input} value={d.flightDepartureTime ?? ""} onChange={(e) => onData("flightDepartureTime", e.target.value)} /></label>
          <label className={label}>{tr("Время прилёта", "Gəliş vaxtı", "Arrival time")}<input type="time" className={input} value={d.flightArrivalTime ?? ""} onChange={(e) => onData("flightArrivalTime", e.target.value)} /></label>
          <div className="sm:col-span-2 mt-2 text-[10px] font-semibold uppercase text-ink">{tr("Конец услуги", "Xidmətin sonu", "Service end")}</div>
          {airportField("returnFromAirport", tr("Аэропорт вылета (обратно)", "Uçuş aeroportu (geri)", "Return departure airport"))}
          {airportField("returnToAirport", tr("Аэропорт прилёта (обратно)", "Gəliş aeroportu (geri)", "Return arrival airport"))}
          <label className={label}>{tr("Время вылета (обратно)", "Uçuş vaxtı (geri)", "Return departure time")}<input type="time" className={input} value={d.returnDepartureTime ?? ""} onChange={(e) => onData("returnDepartureTime", e.target.value)} /></label>
          <label className={label}>{tr("Время прилёта (обратно)", "Gəliş vaxtı (geri)", "Return arrival time")}<input type="time" className={input} value={d.returnArrivalTime ?? ""} onChange={(e) => onData("returnArrivalTime", e.target.value)} /></label>
        </div>
      </div>}
    </div>;
  }

  if (service.kind === "FLIGHT") {
    const segments = JSON.parse(d.segments || '[{"from":"","to":"","departureDate":"","arrivalDate":"","airline":"","class":"","fare":"","baggage":"","carryOn":""}]');
    const saveSegments = (rows: any[]) => onData("segments", JSON.stringify(rows));
    return <div className="space-y-3">{supplier}{servicePriceFields}{segments.map((seg: any, i: number) => <div key={i} className="rounded-lg border p-3"><div className="mb-2 text-[11px] font-semibold">{tr("Сегмент", "Seqment", "Segment")} {i + 1}</div><div className="grid gap-2 sm:grid-cols-3">
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

  if (service.kind === "TRANSFER") return <div className="grid gap-3 sm:grid-cols-2">{supplier}{servicePriceFields}<label className={label}>{tr("Место подачи", "Təqdim yeri", "Pickup")}<input className={input} value={d.from ?? ""} onChange={(e) => onData("from", e.target.value)} /></label><label className={label}>{tr("Назначение", "Təyinat", "Destination")}<input className={input} value={d.to ?? ""} onChange={(e) => onData("to", e.target.value)} /></label><label className={label}>{tr("Дата и время", "Tarix və vaxt", "Date/time")}<input type="datetime-local" className={input} value={d.datetime ?? ""} onChange={(e) => onData("datetime", e.target.value)} /></label><label className={label}>{tr("Пассажиры", "Sərnişinlər", "Passengers")}<input type="number" className={input} value={d.passengers ?? "1"} onChange={(e) => onData("passengers", e.target.value)} /></label><label className={label}>{tr("Транспорт", "Nəqliyyat", "Vehicle")}<input className={input} value={d.vehicle ?? ""} onChange={(e) => onData("vehicle", e.target.value)} /></label><label className={label}>{tr("Комментарий", "Şərh", "Comment")}<input className={input} value={d.comment ?? ""} onChange={(e) => onData("comment", e.target.value)} /></label></div>;

  if (service.kind === "INSURANCE") return <div className="grid gap-3 sm:grid-cols-2">{supplier}{servicePriceFields}<label className={label}>{tr("Страна действия", "Qüvvədə olan ölkə", "Coverage country")}<select className={input} value={d.country ?? ""} onChange={(e) => { const row = countries.find((c) => c.code === e.target.value || c.id === e.target.value); onData("country", row?.code ?? e.target.value); }}><option value="">{tr("Выберите страну", "Ölkə seçin", "Select country")}</option>{countries.map((c) => <option key={c.id} value={c.code}>{c.names[locale] ?? c.names.ru ?? c.code}</option>)}</select></label><label className={label}>{tr("Начало", "Başlanğıc", "Start")}<DateTextInput className={input} value={d.startDate ?? ""} onChange={(v) => onData("startDate", v)} /></label><label className={label}>{tr("Окончание", "Son", "End")}<DateTextInput className={input} value={d.endDate ?? ""} onChange={(v) => onData("endDate", v)} /></label><label className={label}>{tr("Застрахованных", "Sığortalananlar", "Insured")}<input type="number" className={input} value={d.insured ?? "1"} onChange={(e) => onData("insured", e.target.value)} /></label><label className={label}>{tr("Тип страхования", "Sığorta növü", "Insurance type")}<input className={input} value={d.insuranceType ?? ""} onChange={(e) => onData("insuranceType", e.target.value)} /></label></div>;

  if (service.kind === "VISA") return <div className="grid gap-3 sm:grid-cols-2">{supplier}{servicePriceFields}<label className={label}>{tr("Страна назначения", "Təyinat ölkəsi", "Destination country")}<select className={input} value={d.country ?? ""} onChange={(e) => { const row = countries.find((c) => c.code === e.target.value || c.id === e.target.value); onData("country", row?.code ?? e.target.value); }}><option value="">{tr("Выберите страну", "Ölkə seçin", "Select country")}</option>{countries.map((c) => <option key={c.id} value={c.code}>{c.names[locale] ?? c.names.ru ?? c.code}</option>)}</select></label><label className={label}>{tr("Тип визы", "Viza növü", "Visa type")}<input className={input} value={d.visaType ?? ""} onChange={(e) => onData("visaType", e.target.value)} /></label><label className={label}>{tr("Заявителей", "Müraciət edənlər", "Applicants")}<input type="number" className={input} value={d.applicants ?? "1"} onChange={(e) => onData("applicants", e.target.value)} /></label><label className={label}>{tr("Дата поездки", "Səfər tarixi", "Travel date")}<DateTextInput className={input} value={d.travelDate ?? ""} onChange={(v) => onData("travelDate", v)} /></label></div>;

  if (service.kind === "CRUISE") return <div className="grid gap-3 sm:grid-cols-2">{supplier}{servicePriceFields}<label className={label}>{tr("Название круиза", "Kruiz adı", "Cruise name")}<input className={input} value={d.cruiseName ?? ""} onChange={(e) => onData("cruiseName", e.target.value)} /></label><label className={label}>{tr("Судно", "Gəmi", "Ship")}<input className={input} value={d.ship ?? ""} onChange={(e) => onData("ship", e.target.value)} /></label><label className={label}>{tr("Маршрут", "Marşrut", "Route")}<input className={input} value={d.route ?? ""} onChange={(e) => onData("route", e.target.value)} /></label><label className={label}>{tr("Начало", "Başlanğıc", "Start")}<DateTextInput className={input} value={d.startDate ?? ""} onChange={(v) => onData("startDate", v)} /></label><label className={label}>{tr("Окончание", "Son", "End")}<DateTextInput className={input} value={d.endDate ?? ""} onChange={(v) => onData("endDate", v)} /></label><label className={label}>{tr("Каюта", "Kabina", "Cabin")}<input className={input} value={d.cabin ?? ""} onChange={(e) => onData("cabin", e.target.value)} /></label></div>;

  if (service.kind === "GUIDE") return <div className="grid gap-3 sm:grid-cols-2">{supplier}{servicePriceFields}
    <label className={label}>{tr("ФИО гида", "Bələdçinin adı", "Guide name")}<input className={input} value={d.guideName ?? ""} onChange={(e) => { onData("guideName", e.target.value); onChange({ title: e.target.value }); }} /></label>
    <label className={label}>{tr("Язык", "Dil", "Language")}<select className={input} value={d.language ?? ""} onChange={(e) => onData("language", e.target.value)}><option value="">{tr("Выберите", "Seçin", "Select")}</option><option value="AZ">{tr("Азербайджанский", "Azərbaycan dili", "Azerbaijani")}</option><option value="RU">{tr("Русский", "Rus dili", "Russian")}</option><option value="EN">{tr("Английский", "İngilis dili", "English")}</option><option value="OTHER">{tr("Другой", "Digər", "Other")}</option></select></label>
    <label className={label}>{tr("Дата начала", "Başlanğıc tarixi", "Start date")}<DateTextInput className={input} value={d.startDate ?? ""} onChange={(v) => onData("startDate", v)} /></label>
    <label className={label}>{tr("Дата окончания", "Son tarix", "End date")}<DateTextInput className={input} value={d.endDate ?? ""} onChange={(v) => onData("endDate", v)} /></label>
    <label className={label}>{tr("Место встречи", "Görüş yeri", "Meeting point")}<input className={input} value={d.meetingPoint ?? ""} onChange={(e) => onData("meetingPoint", e.target.value)} /></label>
    <label className={label}>{tr("Длительность, ч", "Müddət, saat", "Duration, h")}<input type="number" min="0" step="0.5" className={input} value={d.durationHours ?? ""} onChange={(e) => onData("durationHours", e.target.value)} /></label>
    <label className={label}>{tr("Количество туристов", "Turist sayı", "Tourists")}<input type="number" min="1" className={input} value={d.touristsCount ?? "1"} onChange={(e) => onData("touristsCount", e.target.value)} /></label>
    <label className={`${label} sm:col-span-2`}>{tr("Примечание", "Qeyd", "Note")}<input className={input} value={d.description ?? ""} onChange={(e) => onData("description", e.target.value)} /></label>
  </div>;

  if (service.kind === "EXCURSION") return <div className="grid gap-3 sm:grid-cols-2">{supplier}{servicePriceFields}
    <label className={label}>{tr("Название экскурсии", "Ekskursiyanın adı", "Excursion name")}<input className={input} value={d.excursionName ?? ""} onChange={(e) => { onData("excursionName", e.target.value); onChange({ title: e.target.value }); }} /></label>
    <label className={label}>{tr("Страна", "Ölkə", "Country")}<select className={input} value={d.country ?? ""} onChange={(e) => onData("country", e.target.value)}><option value="">{tr("Выберите страну", "Ölkə seçin", "Select country")}</option>{countries.map((c) => <option key={c.id} value={c.code}>{c.names[locale] ?? c.names.ru ?? c.code}</option>)}</select></label>
    <label className={label}>{tr("Город", "Şəhər", "City")}<input className={input} value={d.city ?? ""} onChange={(e) => onData("city", e.target.value)} /></label>
    <label className={label}>{tr("Дата", "Tarix", "Date")}<DateTextInput className={input} value={d.startDate ?? ""} onChange={(v) => onData("startDate", v)} /></label>
    <label className={label}>{tr("Место встречи", "Görüş yeri", "Meeting point")}<input className={input} value={d.meetingPoint ?? ""} onChange={(e) => onData("meetingPoint", e.target.value)} /></label>
    <label className={label}>{tr("Длительность, ч", "Müddət, saat", "Duration, h")}<input type="number" min="0" step="0.5" className={input} value={d.durationHours ?? ""} onChange={(e) => onData("durationHours", e.target.value)} /></label>
    <label className={label}>{tr("Количество туристов", "Turist sayı", "Tourists")}<input type="number" min="1" className={input} value={d.touristsCount ?? "1"} onChange={(e) => onData("touristsCount", e.target.value)} /></label>
    <label className={label}>{tr("Билеты включены", "Biletlər daxildir", "Tickets included")}<select className={input} value={d.ticketsIncluded ?? ""} onChange={(e) => onData("ticketsIncluded", e.target.value)}><option value="">{tr("Не указано", "Göstərilməyib", "Not specified")}</option><option value="YES">{tr("Да", "Bəli", "Yes")}</option><option value="NO">{tr("Нет", "Xeyr", "No")}</option></select></label>
    <label className={`${label} sm:col-span-2`}>{tr("Описание", "Təsvir", "Description")}<input className={input} value={d.description ?? ""} onChange={(e) => onData("description", e.target.value)} /></label>
  </div>;

  return <div className="grid gap-3 sm:grid-cols-2">{supplier}{servicePriceFields}<label className={label}>{tr("Название услуги", "Xidmətin adı", "Service name")}<input className={input} value={service.title} onChange={(e) => onChange({ title: e.target.value })} /></label><label className={label}>{tr("Описание", "Təsvir", "Description")}<input className={input} value={d.description ?? ""} onChange={(e) => onData("description", e.target.value)} /></label><label className={label}>{tr("Дата оказания", "Göstərilmə tarixi", "Service date")}<DateTextInput className={input} value={d.travelDate ?? ""} onChange={(v) => onData("travelDate", v)} /></label></div>;
}
