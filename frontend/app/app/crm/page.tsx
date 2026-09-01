"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, type Customer, type Partner, type PartnerCustomer, type PartnerCustomerDetail, type CrmTierResponse, type PartnerIntakeResult, type Page } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Kpi from "@/components/Kpi";
import Pagination from "@/components/Pagination";
import PanelFrame from "@/components/PanelFrame";
import SortableHeader, { type SortState, type SortDirection } from "@/components/SortableHeader";
import { useRouter, useSearchParams } from "next/navigation";
import { useCan } from "@/lib/use-can";
import { useCurrentUser } from "@/lib/use-user";
import { useLocale, t, formatPrice } from "@/lib/i18n";

import CrmAnalytics from "@/components/CrmAnalytics";
import AggregateSummary from "@/components/AggregateSummary";
import TableExportButton from "@/components/TableExportButton";

type Tab = "customers" | "partners" | "analytics";
type CrmContext = "platform" | "basic" | "pro";

/**
 * Step 3.5C — Three-Context CRM:
 * 1. PLATFORM CRM — internal staff (ADMIN, SALES_MANAGER, OPERATOR)
 * 2. MARKETPLACE BASIC — limited customer management for marketplace partners
 * 3. STOREFRONT PRO — full CRM for partners with active Storefront
 */
function CrmContent({ initialTab, initialSortBy, initialSortDirection, initialCustomerSearch, initialCustomerStatus, initialCustomerType, initialCustomerPage, initialPartnerSearch, initialPartnerStatus, initialPartnerPage, initialDateFrom, initialDateTo, initialEntitled }: { initialTab?: string; initialSortBy?: string; initialSortDirection?: string; initialCustomerSearch?: string; initialCustomerStatus?: string; initialCustomerType?: string; initialCustomerPage?: number; initialPartnerSearch?: string; initialPartnerStatus?: string; initialPartnerPage?: number; initialDateFrom?: string; initialDateTo?: string; initialEntitled?: string }) {
  const locale = useLocale();
  const currentUser = useCurrentUser();
  const [crmContext, setCrmContext] = useState<CrmContext>("platform");
  const [crmTier, setCrmTier] = useState<"BASIC" | "PRO" | null>(null);
  const [tab, setTab] = useState<Tab>((initialTab === "partners" ? "partners" : initialTab === "analytics" ? "analytics" : "customers") as Tab);
  const [sortBy, setSortBy] = useState<string | null>(initialSortBy ?? null);
  const [sortDirection, setSortDirection] = useState<SortDirection>((initialSortDirection as SortDirection) || "desc");

  const router = useRouter();
  const isInitialMount = useRef(true);
  const sortState: SortState | null = sortBy ? { sortBy, sortDirection } : null;

  const handleSort = (field: string, direction: SortDirection) => {
    setSortBy(field);
    setSortDirection(direction);
    setCustomerPage(1);
    setPartnerPage(1);
  };

  // ── Permissions ──
  const canWrite = useCan("crm.customer.write");
  const canPartnerWrite = useCan("crm.partner.write");
  const canReadOwn = useCan("crm.customer.read_own");
  const canCreateOwn = useCan("crm.customer.create_own");

  // ── Detect CRM context ──
  useEffect(() => {
    if (currentUser?.role === "PARTNER" && currentUser?.partnerId) {
      // Partner: determine Basic vs Pro
      api.get<CrmTierResponse>("/partner/crm-tier")
        .then((res) => {
          setCrmTier(res.tier);
          setCrmContext(res.tier === "PRO" ? "pro" : "basic");
        })
        .catch(() => {
          setCrmTier("BASIC");
          setCrmContext("basic");
        });
    } else {
      setCrmContext("platform");
    }
  }, [currentUser]);

  // ── Period filter (SR-CRM-01/SR-CRM-02) ──
  const [dateFrom, setDateFrom] = useState(initialDateFrom ?? "");
  const [dateTo, setDateTo] = useState(initialDateTo ?? "");
  const [entitled, setEntitled] = useState(initialEntitled ?? "");

  // ── Platform CRM state ──
  const [customerData, setCustomerData] = useState<Page<Customer> | null>(null);
  // selectedCustomer removed — use dedicated /app/crm/customers/:id page
  const [customerSearch, setCustomerSearch] = useState(initialCustomerSearch ?? "");
  const [customerPage, setCustomerPage] = useState(initialCustomerPage ?? 1);
  const [customerStatusFilter, setCustomerStatusFilter] = useState<string | undefined>(initialCustomerStatus || undefined);
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string | undefined>(initialCustomerType || undefined);
  // customerDetailTab removed — use dedicated /app/crm/customers/:id page
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ type: "PERSON", firstName: "", lastName: "", companyName: "", email: "", phone: "" });
  const [initialNote, setInitialNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", companyName: "", phone: "" });
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(false);

  // ── Platform Partner CRM state ──
  const [partnerListData, setPartnerListData] = useState<Page<Partner> | null>(null);
  // selectedPartner removed — use dedicated /app/crm/partners/:id page
  const [partnerSearch, setPartnerSearch] = useState(initialPartnerSearch ?? "");
  const [partnerPage, setPartnerPage] = useState(initialPartnerPage ?? 1);
  const [partnerStatusFilter, setPartnerStatusFilter] = useState<string | undefined>(initialPartnerStatus || undefined);
  // partnerDetailTab removed — use dedicated /app/crm/partners/:id page
  const [partnerCustomerDetailTab, setPartnerCustomerDetailTab] = useState<"overview" | "orders" | "bookings" | "payments" | "relations">("overview");
  const [partnerError, setPartnerError] = useState("");
  const [partnerLoadError, setPartnerLoadError] = useState(false);

  // ── Partner Customer CRM state (3.5C partner context) ──
  const [partnerData, setPartnerData] = useState<Page<PartnerCustomer> | null>(null);
  const [selectedPartnerCustomer, setSelectedPartnerCustomer] = useState<PartnerCustomerDetail | null>(null);
  const [showIntake, setShowIntake] = useState(false);
  const [intaking, setIntaking] = useState(false);
  const [intakeForm, setIntakeForm] = useState({ firstName: "", lastName: "", companyName: "", email: "", phone: "", leadSource: "DIRECT", notes: "", initialNote: "" });

  // ── Platform Customer loading ──
  const loadCustomers = useCallback(async () => {
    try {
      setLoadError(false);
      const qs = new URLSearchParams();
      if (customerSearch) qs.set("search", customerSearch);
      if (customerStatusFilter) qs.set("status", customerStatusFilter);
      if (customerTypeFilter) qs.set("customerType", customerTypeFilter);
      if (dateFrom) qs.set("dateFrom", dateFrom);
      if (dateTo) qs.set("dateTo", dateTo);
      qs.set("page", String(customerPage));
      qs.set("pageSize", "20");
      if (sortBy) qs.set("sortBy", sortBy);
      if (sortBy) qs.set("sortDirection", sortDirection);
      const res = await api.get<Page<Customer>>(`/customers?${qs.toString()}`);
      setCustomerData(res);
    } catch (e) {
      setLoadError(true);
      setError((e as Error).message);
    }
  }, [customerSearch, customerPage, sortBy, sortDirection, customerStatusFilter, customerTypeFilter, dateFrom, dateTo]);

  // ── Platform Partner loading ──
  const loadPartners = useCallback(async () => {
    try {
      setPartnerLoadError(false);
      const qs = new URLSearchParams();
      if (partnerSearch) qs.set("search", partnerSearch);
      if (partnerStatusFilter) qs.set("status", partnerStatusFilter);
      if (dateFrom) qs.set("dateFrom", dateFrom);
      if (dateTo) qs.set("dateTo", dateTo);
      if (entitled) qs.set("entitled", entitled);
      qs.set("page", String(partnerPage));
      qs.set("pageSize", "20");
      if (sortBy) qs.set("sortBy", sortBy);
      if (sortBy) qs.set("sortDirection", sortDirection);
      const res = await api.get<Page<Partner>>(`/partners?${qs.toString()}`);
      setPartnerListData(res);
    } catch (e) {
      setPartnerLoadError(true);
      setPartnerError((e as Error).message);
    }
  }, [partnerSearch, partnerPage, sortBy, sortDirection, partnerStatusFilter, dateFrom, dateTo, entitled]);

  // ── Partner Customer loading (partner context) ──
  const loadPartnerCustomers = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (partnerSearch) qs.set("search", partnerSearch);
      qs.set("page", String(partnerPage));
      qs.set("pageSize", "20");
      const res = await api.get<Page<PartnerCustomer>>(`/partner/customers?${qs.toString()}`);
      setPartnerData(res);
    } catch (e) {
      setPartnerError((e as Error).message);
    }
  }, [partnerSearch, partnerPage]);

  useEffect(() => {
    if (crmContext === "platform") {
      if (tab === "customers") void loadCustomers();
      else if (tab === "partners") void loadPartners();
      // analytics tab has its own data loader (CrmAnalytics component)
    } else {
      void loadPartnerCustomers();
    }
  }, [crmContext, tab, loadCustomers, loadPartners, loadPartnerCustomers]);

  // ── Entity navigation now uses dedicated /app/crm/customers/:id and /app/crm/partners/:id pages ──

  // ── Partner Customer actions ──
  const openPartnerCustomerDetail = async (id: string) => {
    setPartnerCustomerDetailTab("overview");
    try {
      const detail = await api.get<PartnerCustomerDetail>(`/partner/customers/${id}`);
      setSelectedPartnerCustomer(detail);
    } catch (e) {
      setPartnerError((e as Error).message);
    }
  };

  const createIntake = async () => {
    if (!intakeForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(intakeForm.email.trim())) {
      setPartnerError("Укажите корректный email");
      return;
    }
    setIntaking(true);
    setPartnerError("");
    try {
      const result = await api.post<PartnerIntakeResult>("/partner/customers/intake", {
        firstName: intakeForm.firstName.trim() || undefined,
        lastName: intakeForm.lastName.trim() || undefined,
        companyName: intakeForm.companyName.trim() || undefined,
        email: intakeForm.email.trim(),
        phone: intakeForm.phone.trim() || undefined,
        leadSource: intakeForm.leadSource || undefined,
        notes: intakeForm.notes.trim() || undefined,
        initialNote: intakeForm.initialNote.trim() || undefined,
      });
      setShowIntake(false);
      setIntakeForm({ firstName: "", lastName: "", companyName: "", email: "", phone: "", leadSource: "DIRECT", notes: "", initialNote: "" });
      await loadPartnerCustomers();
      await openPartnerCustomerDetail(result.customerId);
    } catch (e) {
      setPartnerError((e as Error).message);
    } finally {
      setIntaking(false);
    }
  };

  const createCustomer = async () => {
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Укажите корректный email");
      return;
    }
    if (initialNote.trim().length > 5000) {
      setError("Примечание не может превышать 5000 символов");
      return;
    }
    setCreating(true);
    setError("");
    try {
      await api.post("/customers", {
        type: form.type,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        companyName: form.companyName.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        initialNote: initialNote.trim() || undefined,
      });
      setShowCreate(false);
      setForm({ type: "PERSON", firstName: "", lastName: "", companyName: "", email: "", phone: "" });
      setInitialNote("");
      await loadCustomers();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const displayName = (c: { firstName?: string | null; lastName?: string | null; companyName?: string | null }) =>
    c.companyName ?? (`${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—");

  // ── Platform CRM ──
  if (crmContext === "platform") {
    return (
      <div className="flex h-full">
        <div className="flex min-w-0 flex-1 flex-col">
          <PageHeader
            title={t("crm.title", locale)}
            breadcrumbs={["TravelHub", t("crm.title", locale)]}
            actions={
              <div className="flex items-center gap-2">
                {/* Step 3.6A: Platform CRM Create Customer removed — Platform manages identity, not sales CRM */}
                <button onClick={() => void loadCustomers()} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">⟳</button>
              </div>
            }
          />

          {/* Platform context badge */}
          <div className="px-6 pt-2 flex items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              {t("crm.context.platform", locale)}
            </span>
            {dateFrom && dateTo && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                📊 {dateFrom} → {dateTo}
              </span>
            )}
            {entitled === 'true' && !dateFrom && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                🏪 {t('crm.context.entitled_partners', locale) || 'Активные партнёры (marketplace)'}
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200 bg-slate-50 px-6 pt-2">
            <button onClick={() => setTab("customers")} className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "customers" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {t("crm.tab.customers", locale)}
            </button>
            <button onClick={() => { setTab("partners"); }} className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "partners" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {t("crm.tab.partners", locale)}
            </button>
            <button onClick={() => { setTab("analytics"); }} className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "analytics" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {t("crm.analytics.tab", locale)}
            </button>
          </div>

          <div className="space-y-4 p-6">
            {tab === "customers" && !loadError && (
              <>
                <Kpi items={[
                  { label: t("crm.total_customers", locale), value: customerData?.total ?? 0, icon: "👥" },
                ]} />
                <AggregateSummary totalRecords={customerData?.total ?? 0} fields={[]} loading={!customerData && !loadError} />
              </>
            )}
            {tab === "partners" && !partnerLoadError && (
              <>
                <Kpi items={[
                  { label: t("crm.total_partners", locale), value: partnerListData?.total ?? 0, icon: "🏢" },
                ]} />
                <AggregateSummary totalRecords={partnerListData?.total ?? 0} fields={[]} loading={!partnerListData && !partnerLoadError} />
              </>
            )}

            {/* Search + Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={tab === "customers" ? customerSearch : partnerSearch}
                onChange={(e) => tab === "customers" ? setCustomerSearch(e.target.value) : setPartnerSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { tab === "customers" ? void loadCustomers() : void loadPartners(); } }}
                placeholder={t("crm.search.placeholder", locale)}
                className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              {dateFrom && dateTo && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); setCustomerPage(1); setPartnerPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
                  ✕ {t('crm.filter.clear_dates', locale) || 'Период'}
                </button>
              )}
              {tab === 'customers' && (
                <>
                  <select value={customerTypeFilter ?? ''} onChange={(e) => { setCustomerTypeFilter(e.target.value || undefined); setCustomerPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400">
                    <option value="">{t('crm.filter.type.all', locale)}</option>
                    <option value="PERSON">{t('crm.type.person', locale)}</option>
                    <option value="COMPANY">{t('crm.type.company', locale)}</option>
                  </select>
                  <select value={customerStatusFilter ?? ''} onChange={(e) => { setCustomerStatusFilter(e.target.value || undefined); setCustomerPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400">
                    <option value="">{t('crm.filter.status.all', locale)}</option>
                    <option value="ACTIVE">{t('crm.status.active', locale)}</option>
                    <option value="INACTIVE">{t('crm.status.inactive', locale)}</option>
                    <option value="SUSPENDED">{t('crm.status.suspended', locale)}</option>
                  </select>
                  {(customerTypeFilter || customerStatusFilter) && (
                    <button onClick={() => { setCustomerTypeFilter(undefined); setCustomerStatusFilter(undefined); setCustomerPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
                      ✕ {t('crm.filter.clear', locale)}
                    </button>
                  )}
                </>
              )}
              {tab === 'partners' && (
                <>
                  <select value={partnerStatusFilter ?? ''} onChange={(e) => { setPartnerStatusFilter(e.target.value || undefined); setPartnerPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400">
                    <option value="">{t('crm.filter.status.all', locale)}</option>
                    <option value="ACTIVE">{t('crm.status.active', locale)}</option>
                    <option value="INACTIVE">{t('crm.status.inactive', locale)}</option>
                    <option value="SUSPENDED">{t('crm.status.suspended', locale)}</option>
                  </select>
                  {partnerStatusFilter && (
                    <button onClick={() => { setPartnerStatusFilter(undefined); setPartnerPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
                      ✕ {t('crm.filter.clear', locale)}
                    </button>
                  )}
                </>
              )}
              <TableExportButton
                exportUrl={tab === 'customers' ? '/api/v1/customers/export' : '/api/v1/partners/export'}
                extraParams={{
                  ...(tab === 'customers' && customerTypeFilter ? { customerType: customerTypeFilter } : {}),
                  ...(tab === 'customers' && customerStatusFilter ? { status: customerStatusFilter } : {}),
                  ...(tab === 'partners' && partnerStatusFilter ? { status: partnerStatusFilter } : {}),
                  ...((customerSearch || partnerSearch) ? { search: tab === 'customers' ? customerSearch : partnerSearch } : {}),
                  ...(dateFrom ? { dateFrom } : {}),
                  ...(dateTo ? { dateTo } : {}),
                }}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                <div className="font-medium">{t("crm.error.load_failed", locale)}</div>
                <div className="mt-1 text-xs text-red-500">{error}</div>
                <button onClick={() => tab === "customers" ? void loadCustomers() : void loadPartners()} className="mt-2 rounded border border-red-300 bg-white px-3 py-1 text-xs text-red-600 hover:bg-red-50">
                  {t("crm.error.retry", locale)}
                </button>
              </div>
            )}
            {partnerError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                <div className="font-medium">{t("crm.error.load_failed", locale)}</div>
                <div className="mt-1 text-xs text-red-500">{partnerError}</div>
                <button onClick={() => void loadPartners()} className="mt-2 rounded border border-red-300 bg-white px-3 py-1 text-xs text-red-600 hover:bg-red-50">
                  {t("crm.error.retry", locale)}
                </button>
              </div>
            )}

            {/* Customer Table */}
            {tab === "customers" && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <SortableHeader field="code" currentSort={sortState} onSort={handleSort}>{t("crm.col.code", locale)}</SortableHeader>
                      <SortableHeader field="name" currentSort={sortState} onSort={handleSort}>{t("crm.col.name", locale)}</SortableHeader>
                      <SortableHeader field="email" currentSort={sortState} onSort={handleSort}>{t("crm.col.email", locale)}</SortableHeader>
                      <SortableHeader field="type" currentSort={sortState} onSort={handleSort}>{t("crm.col.type", locale)}</SortableHeader>
                      <SortableHeader field="status" currentSort={sortState} onSort={handleSort}>{t("crm.col.status", locale)}</SortableHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {(customerData?.items ?? []).map((c) => (
                      <tr key={c.id} className="border-b border-slate-50 transition-colors hover:bg-blue-50/50">
                        <td className="px-4 py-2.5"><Link href={`/app/crm/customers/${c.id}`} className="font-mono text-xs text-blue-600 hover:underline">{c.code}</Link></td>
                        <td className="px-4 py-2.5"><Link href={`/app/crm/customers/${c.id}`} className="font-medium text-slate-800 hover:underline">{displayName(c)}</Link></td>
                        <td className="px-4 py-2.5 text-slate-500">{c.email}</td>
                        <td className="px-4 py-2.5 text-slate-500">{c.type === "COMPANY" ? t("crm.type.company", locale) : t("crm.type.person", locale)}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                      </tr>
                    ))}
                    {(customerData?.items ?? []).length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">{t("crm.customers_empty", locale)}</td></tr>
                    )}
                  </tbody>
                </table>
                {customerData && customerData.total > 0 && (
                  <Pagination page={customerPage} pageSize={20} total={customerData.total} onPageChange={(p) => setCustomerPage(p)} />
                )}
              </div>
            )}

            {/* Partner Table */}
            {tab === "partners" && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <SortableHeader field="code" currentSort={sortState} onSort={handleSort}>{t("crm.col.code", locale)}</SortableHeader>
                      <SortableHeader field="name" currentSort={sortState} onSort={handleSort}>{t("crm.col.name", locale)}</SortableHeader>
                      <SortableHeader field="email" currentSort={sortState} onSort={handleSort}>{t("crm.col.email", locale)}</SortableHeader>
                      <SortableHeader field="country" currentSort={sortState} onSort={handleSort}>{t("crm.col.country", locale)}</SortableHeader>
                      <SortableHeader field="status" currentSort={sortState} onSort={handleSort}>{t("crm.col.status", locale)}</SortableHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {(partnerListData?.items ?? []).map((p) => (
                      <tr key={p.id} className="border-b border-slate-50 transition-colors hover:bg-blue-50/50">
                        <td className="px-4 py-2.5"><Link href={`/app/crm/partners/${p.id}`} className="font-mono text-xs text-blue-600 hover:underline">{p.code}</Link></td>
                        <td className="px-4 py-2.5"><Link href={`/app/crm/partners/${p.id}`} className="font-medium text-slate-800 hover:underline">{p.name}</Link></td>
                        <td className="px-4 py-2.5 text-slate-500">{p.contactEmail ?? "—"}</td>
                        <td className="px-4 py-2.5 text-slate-500">{p.countryCode ?? "—"}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                      </tr>
                    ))}
                    {(partnerListData?.items ?? []).length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">{t("crm.partners_empty", locale)}</td></tr>
                    )}
                  </tbody>
                </table>
                {partnerListData && partnerListData.total > 0 && (
                  <Pagination page={partnerPage} pageSize={20} total={partnerListData.total} onPageChange={(p) => setPartnerPage(p)} />
                )}
              </div>
            )}

            {/* Analytics Tab */}
            {tab === "analytics" && (
              <CrmAnalytics />
            )}
          </div>
        </div>

      {/* Platform CRM: Create Customer Panel */}
      {showCreate && (
        <PanelFrame title={t("crm.create_customer", locale)} subtitle="Platform CRM" onClose={() => { setShowCreate(false); setInitialNote(""); }}>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.type", locale)}</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
            >
              <option value="PERSON">{t("crm.type.person", locale)}</option>
              <option value="COMPANY">{t("crm.type.company", locale)}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.firstName", locale)}</label>
            <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.lastName", locale)}</label>
            <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.companyName", locale)}</label>
            <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.email", locale)} *</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" placeholder="email@example.com" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.phone", locale)}</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("notes.initial_note", locale)}</label>
            <textarea
              value={initialNote}
              onChange={(e) => setInitialNote(e.target.value)}
              rows={3}
              maxLength={5000}
              aria-label={t("notes.initial_note", locale)}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              placeholder={t("notes.initial_note_helper", locale)}
            />
            <div className="mt-1 text-right text-xs text-slate-400">
              {initialNote.length}/5000 {t("notes.initial_note_max", locale)}
            </div>
          </div>
          <button
            onClick={() => void createCustomer()}
            disabled={creating || !form.email.trim()}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? t("crm.detail.creating", locale) : t("crm.create_customer", locale)}
          </button>
        </PanelFrame>
      )}
    </div>
    );
  }

  // ── Partner CRM (Basic or Pro) ──
  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          title={crmTier === "PRO" ? t("crm.title_pro", locale) : t("crm.title_basic", locale)}
          breadcrumbs={["TravelHub", crmTier === "PRO" ? t("crm.title_pro", locale) : t("crm.title_basic", locale)]}
          actions={
            <div className="flex items-center gap-2">
              {crmTier === "PRO" && canCreateOwn && (
                <button onClick={() => setShowIntake((v) => !v)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700">
                  ＋ {t("crm.add_customer", locale)}
                </button>
              )}
              <button onClick={() => void loadPartnerCustomers()} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">⟳</button>
            </div>
          }
        />

        {/* Tier badge */}
        <div className="px-6 pt-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${crmTier === "PRO" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {crmTier === "PRO" ? t("crm.context.storefront_pro", locale) : t("crm.context.marketplace_basic", locale)}
          </span>
        </div>

        <div className="space-y-4 p-6">
          <Kpi items={[
            { label: t("crm.my_customers", locale), value: partnerData?.total ?? 0, icon: "👥" },
          ]} />

          {/* Search */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={partnerSearch}
              onChange={(e) => setPartnerSearch(e.target.value)}
              placeholder={t("crm.search.placeholder", locale)}
              className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {partnerError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{partnerError}</div>}

          {/* Partner Customer Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <SortableHeader field="code" currentSort={sortState} onSort={handleSort}>{t("crm.col.code", locale)}</SortableHeader>
                  <SortableHeader field="name" currentSort={sortState} onSort={handleSort}>{t("crm.col.name", locale)}</SortableHeader>
                  <SortableHeader field="email" currentSort={sortState} onSort={handleSort}>{t("crm.col.email", locale)}</SortableHeader>
                  <SortableHeader field="status" currentSort={sortState} onSort={handleSort}>{t("crm.col.status", locale)}</SortableHeader>
                </tr>
              </thead>
              <tbody>
                {(partnerData?.items ?? []).map((c) => (
                  <tr key={c.id} onClick={() => void openPartnerCustomerDetail(c.id)} className={`cursor-pointer border-b border-slate-50 transition-colors hover:bg-blue-50/50 ${selectedPartnerCustomer?.id === c.id ? "bg-blue-50/60" : ""}`}>
                    <td className="px-4 py-2.5 font-mono text-xs text-blue-600">{c.code}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{displayName(c)}</td>
                    <td className="px-4 py-2.5 text-slate-500">{c.email}</td>
                    <td className="px-4 py-2.5 text-slate-500">{c.type === "COMPANY" ? t("crm.type.company", locale) : t("crm.type.person", locale)}</td>
                    {crmTier === "PRO" && <td className="px-4 py-2.5 text-slate-500">{c._relation?.lifecycle ?? "—"}</td>}
                    <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
                {(partnerData?.items ?? []).length === 0 && (
                  <tr><td colSpan={crmTier === "PRO" ? 6 : 5} className="px-4 py-8 text-center text-sm text-slate-400">{t("crm.customers_empty", locale)}</td></tr>
                )}
              </tbody>
            </table>
            {partnerData && partnerData.total > 0 && (
              <Pagination page={partnerPage} pageSize={20} total={partnerData.total} onPageChange={(p) => { setPartnerPage(p); setSelectedPartnerCustomer(null); }} />
            )}
          </div>
        </div>
      </div>

      {/* Intake Panel (Pro only) */}
      {showIntake && crmTier === "PRO" && (
        <PanelFrame title={t("crm.add_customer", locale)} subtitle={t("crm.title_pro", locale)} onClose={() => setShowIntake(false)}>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.firstName", locale)}</label>
            <input value={intakeForm.firstName} onChange={(e) => setIntakeForm({ ...intakeForm, firstName: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.lastName", locale)}</label>
            <input value={intakeForm.lastName} onChange={(e) => setIntakeForm({ ...intakeForm, lastName: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.email", locale)}</label>
            <input value={intakeForm.email} onChange={(e) => setIntakeForm({ ...intakeForm, email: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.phone", locale)}</label>
            <input value={intakeForm.phone} onChange={(e) => setIntakeForm({ ...intakeForm, phone: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.intake.lead_source", locale)}</label>
            <select value={intakeForm.leadSource} onChange={(e) => setIntakeForm({ ...intakeForm, leadSource: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400">
              <option value="DIRECT">{t("crm.lead_source.direct", locale)}</option>
              <option value="STOREFRONT">{t("crm.lead_source.storefront", locale)}</option>
              <option value="PHONE">{t("crm.lead_source.phone", locale)}</option>
              <option value="OFFICE">{t("crm.lead_source.office", locale)}</option>
              <option value="EMAIL">{t("crm.lead_source.email", locale)}</option>
              <option value="MARKETPLACE">{t("crm.lead_source.marketplace", locale)}</option>
              <option value="REFERRAL">{t("crm.lead_source.referral", locale)}</option>
              <option value="OTHER">{t("crm.lead_source.other", locale)}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.intake.notes", locale)}</label>
            <textarea value={intakeForm.notes} onChange={(e) => setIntakeForm({ ...intakeForm, notes: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" rows={3} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("notes.initial_note", locale)}</label>
            <textarea
              value={intakeForm.initialNote}
              onChange={(e) => setIntakeForm({ ...intakeForm, initialNote: e.target.value })}
              rows={3}
              maxLength={5000}
              aria-label={t("notes.initial_note", locale)}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              placeholder={t("notes.initial_note_helper", locale)}
            />
            <div className="mt-1 text-right text-xs text-slate-400">
              {intakeForm.initialNote.length}/5000
            </div>
          </div>
          <button onClick={() => void createIntake()} disabled={intaking || !intakeForm.email.trim()} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {intaking ? t("crm.detail.creating", locale) : t("crm.intake.submit", locale)}
          </button>
        </PanelFrame>
      )}

      {/* Partner Customer Detail Panel */}
      {selectedPartnerCustomer && (
        <aside className="thin-scroll fade-in-up w-96 shrink-0 overflow-y-auto border-l border-slate-200 bg-white">
          <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <div className="font-mono text-xs text-blue-600">{selectedPartnerCustomer.code}</div>
              <div className="text-lg font-bold text-slate-900">{displayName(selectedPartnerCustomer)}</div>
              <StatusBadge status={selectedPartnerCustomer.status} />
            </div>
            <button onClick={() => setSelectedPartnerCustomer(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">✕</button>
          </div>

          <div className="flex gap-1 border-b border-slate-100 px-4 pt-2">
            {(["overview", "orders", "bookings", "payments", "relations"] as const).map((dt) => (
              <button key={dt} onClick={() => setPartnerCustomerDetailTab(dt)} className={`rounded-t-lg px-3 py-1.5 text-xs font-medium transition-colors ${partnerCustomerDetailTab === dt ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:text-slate-600"}`}>
                {t(`crm.detail.${dt}`, locale)}
              </button>
            ))}
          </div>

          <div className="space-y-3 p-5 text-sm">
            {partnerCustomerDetailTab === "overview" && (
              <>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-slate-400">{t("crm.col.email", locale)}</div><div className="break-all font-medium text-slate-700">{selectedPartnerCustomer.email}</div></div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-slate-400">{t("crm.create.form.phone", locale)}</div><div className="font-medium text-slate-700">{selectedPartnerCustomer.phone ?? "—"}</div></div>
                </div>
                {crmTier === "PRO" && selectedPartnerCustomer._relation && (
                  <div className="space-y-2 text-xs">
                    <div className="rounded-lg bg-emerald-50 px-3 py-2"><div className="text-emerald-400">{t("crm.col.lifecycle", locale)}</div><div className="font-medium text-emerald-700">{selectedPartnerCustomer._relation.lifecycle ?? "—"}</div></div>
                    {selectedPartnerCustomer._relation.leadSource && (
                      <div className="rounded-lg bg-blue-50 px-3 py-2"><div className="text-blue-400">{t("crm.col.lead_source", locale)}</div><div className="font-medium text-blue-700">{selectedPartnerCustomer._relation.leadSource}</div></div>
                    )}
                    {selectedPartnerCustomer._relation.tags.length > 0 && (
                      <div className="rounded-lg bg-violet-50 px-3 py-2"><div className="text-violet-400">{t("crm.col.tags", locale)}</div><div className="flex flex-wrap gap-1 mt-1">{selectedPartnerCustomer._relation.tags.map((tag) => <span key={tag} className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">{tag}</span>)}</div></div>
                    )}
                    {selectedPartnerCustomer._relation.notes && (
                      <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-slate-400">{t("crm.col.notes", locale)}</div><div className="font-medium text-slate-700 whitespace-pre-wrap">{selectedPartnerCustomer._relation.notes}</div></div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-blue-50 px-3 py-2 text-center"><div className="font-bold text-blue-700">{selectedPartnerCustomer.summary.totalOrders}</div><div className="text-blue-500">{t("crm.detail.total_orders", locale)}</div></div>
                  <div className="rounded-lg bg-green-50 px-3 py-2 text-center"><div className="font-bold text-green-700">{selectedPartnerCustomer.summary.totalBookings}</div><div className="text-green-500">{t("crm.detail.total_bookings", locale)}</div></div>
                  <div className="rounded-lg bg-purple-50 px-3 py-2 text-center"><div className="font-bold text-purple-700">{selectedPartnerCustomer.summary.totalPayments}</div><div className="text-purple-500">{t("crm.detail.total_payments", locale)}</div></div>
                </div>
              </>
            )}              {partnerCustomerDetailTab === "orders" && selectedPartnerCustomer.orders.length > 0 && (
              <div className="space-y-2">
                {selectedPartnerCustomer.orders.map((o) => (
                  <div key={o.id} className="rounded-lg border border-slate-100 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between"><span className="font-mono text-blue-600">{o.code}</span><StatusBadge status={o.status} /></div>
                    <div className="mt-1 text-slate-500">{o.number} · {formatPrice(o.amount, o.currency, locale) ?? "—"}</div>
                  </div>
                ))}
              </div>
            )}              {partnerCustomerDetailTab === "bookings" && selectedPartnerCustomer.bookings.length > 0 && (
              <div className="space-y-2">
                {selectedPartnerCustomer.bookings.map((b) => (
                  <div key={b.id} className="rounded-lg border border-slate-100 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between"><span className="font-mono text-blue-600">{b.code}</span><StatusBadge status={b.status} /></div>
                    <div className="mt-1 text-slate-500">{formatPrice(b.amount, b.currency, locale) ?? "—"}</div>
                  </div>
                ))}
              </div>
            )}              {partnerCustomerDetailTab === "payments" && selectedPartnerCustomer.payments.length > 0 && (
              <div className="space-y-2">
                {selectedPartnerCustomer.payments.map((p) => (
                  <div key={p.id} className="rounded-lg border border-slate-100 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between"><span className="font-mono text-blue-600">{p.code}</span><StatusBadge status={p.status} /></div>
                    <div className="mt-1 text-slate-500">{formatPrice(p.amount, p.currency, locale) ?? "—"}</div>
                  </div>
                ))}
              </div>
            )}              {partnerCustomerDetailTab === "relations" && crmTier === "PRO" && selectedPartnerCustomer._relation && (
              <div className="rounded-lg border border-slate-100 px-3 py-2 text-xs">
                <div className="font-medium text-slate-700">{t("crm.detail.your_relation", locale)}</div>
                <div className="mt-1 text-slate-500">{selectedPartnerCustomer._relation.lifecycle ?? "—"}</div>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

function CrmWithParams() {
  const sp = useSearchParams();
  return (
    <CrmContent
      initialTab={sp.get("tab") ?? undefined}
      initialSortBy={sp.get("sortBy") ?? undefined}
      initialSortDirection={sp.get("sortDirection") ?? undefined}
      initialCustomerSearch={sp.get("search") ?? undefined}
      initialCustomerStatus={sp.get("status") ?? undefined}
      initialCustomerType={sp.get("type") ?? undefined}
      initialCustomerPage={sp.get("page") ? parseInt(sp.get("page")!, 10) : undefined}
      initialPartnerSearch={sp.get("pSearch") ?? undefined}
      initialPartnerStatus={sp.get("pStatus") ?? undefined}
      initialPartnerPage={sp.get("pPage") ? parseInt(sp.get("pPage")!, 10) : undefined}
      initialDateFrom={sp.get("from") ?? undefined}
      initialDateTo={sp.get("to") ?? undefined}
      initialEntitled={sp.get("entitled") ?? undefined}
    />
  );
}

export default function CrmPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-8 w-48 animate-pulse rounded bg-slate-100" /></div>}>
      <CrmWithParams />
    </Suspense>
  );
}