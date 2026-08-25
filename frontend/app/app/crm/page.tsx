"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Customer, type CustomerDetail, type Partner, type PartnerDetail, type Page } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Kpi from "@/components/Kpi";
import Pagination from "@/components/Pagination";
import PanelFrame from "@/components/PanelFrame";
import { useCan } from "@/lib/use-can";
import { useLocale, t } from "@/lib/i18n";

type Tab = "customers" | "partners";

/** Step 3.5 — CRM Completion: Production workspace with Customers + Partners tabs. */
export default function CrmPage() {
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>("customers");
  const canWrite = useCan("crm.customer.write");
  const canPartnerWrite = useCan("crm.partner.write");

  // ── Customer state ──
  const [customerData, setCustomerData] = useState<Page<Customer> | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPage, setCustomerPage] = useState(1);
  const [customerDetailTab, setCustomerDetailTab] = useState<"overview" | "orders" | "bookings" | "payments" | "relations">("overview");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ type: "PERSON", firstName: "", lastName: "", companyName: "", email: "", phone: "" });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", companyName: "", phone: "" });
  const [error, setError] = useState("");

  // ── Partner state ──
  const [partnerData, setPartnerData] = useState<Page<Partner> | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<PartnerDetail | null>(null);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerPage, setPartnerPage] = useState(1);

  // ── Customer loading ──
  const loadCustomers = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (customerSearch) qs.set("search", customerSearch);
      qs.set("page", String(customerPage));
      qs.set("pageSize", "20");
      const res = await api.get<Page<Customer>>(`/customers?${qs.toString()}`);
      setCustomerData(res);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [customerSearch, customerPage]);

  // ── Partner loading ──
  const loadPartners = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (partnerSearch) qs.set("search", partnerSearch);
      qs.set("page", String(partnerPage));
      qs.set("pageSize", "20");
      const res = await api.get<Page<Partner>>(`/partners?${qs.toString()}`);
      setPartnerData(res);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [partnerSearch, partnerPage]);

  useEffect(() => { void loadCustomers(); }, [loadCustomers]);
  useEffect(() => { if (tab === "partners") void loadPartners(); }, [tab, loadPartners]);

  // ── Customer actions ──
  const openCustomerDetail = async (id: string) => {
    setShowCreate(false);
    setEditing(false);
    setCustomerDetailTab("overview");
    try {
      const detail = await api.get<CustomerDetail>(`/customers/${id}/detail`);
      setSelectedCustomer(detail);
    } catch {
      // Fallback to basic detail
      const detail = await api.get<Customer>(`/customers/${id}`);
      setSelectedCustomer({ ...detail, contacts: [], history: [], partnerRelations: [], orders: [], bookings: [], payments: [], summary: { totalOrders: 0, totalBookings: 0, totalPayments: 0 } } as CustomerDetail);
    }
  };

  const openEdit = () => {
    if (!selectedCustomer) return;
    setEditing(true);
    setEditForm({
      firstName: selectedCustomer.firstName ?? "",
      lastName: selectedCustomer.lastName ?? "",
      companyName: selectedCustomer.companyName ?? "",
      phone: selectedCustomer.phone ?? "",
    });
  };

  const saveEdit = async () => {
    if (!selectedCustomer) return;
    setSaving(true);
    setError("");
    try {
      await api.patch(`/customers/${selectedCustomer.id}`, {
        firstName: editForm.firstName.trim() || undefined,
        lastName: editForm.lastName.trim() || undefined,
        companyName: editForm.companyName.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
      });
      setEditing(false);
      await openCustomerDetail(selectedCustomer.id);
      await loadCustomers();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const createCustomer = async () => {
    if (!form.email.trim() || !/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(form.email.trim())) {
      setError("Укажите корректный email");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const created = await api.post<Customer>("/customers", {
        type: form.type,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        companyName: form.companyName.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
      });
      setShowCreate(false);
      setForm({ type: "PERSON", firstName: "", lastName: "", companyName: "", email: "", phone: "" });
      await loadCustomers();
      await openCustomerDetail(created.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  // ── Partner actions ──
  const openPartnerDetail = async (id: string) => {
    try {
      const detail = await api.get<PartnerDetail>(`/partners/${id}`);
      setSelectedPartner(detail);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // ── Derived data ──
  const customerCounts = {
    total: customerData?.total ?? 0,
    persons: customerData?.items.filter((c) => c.type === "PERSON").length ?? 0,
    companies: customerData?.items.filter((c) => c.type === "COMPANY").length ?? 0,
  };

  const partnerCounts = {
    total: partnerData?.total ?? 0,
    active: partnerData?.items.filter((p) => p.status === "ACTIVE").length ?? 0,
  };

  const displayName = (c: { firstName?: string | null; lastName?: string | null; companyName?: string | null }) =>
    c.companyName ?? (`${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—");

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          title={t("crm.title", locale)}
          breadcrumbs={["TravelHub", t("crm.title", locale)]}
          actions={
            <div className="flex items-center gap-2">
              {tab === "customers" && canWrite && (
                <button
                  onClick={() => { setEditing(false); setShowCreate((v) => !v); }}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  ＋ {t("crm.create_customer", locale)}
                </button>
              )}
              <button
                onClick={() => { if (tab === "customers") void loadCustomers(); else void loadPartners(); }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                ⟳
              </button>
            </div>
          }
        />

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 bg-slate-50 px-6 pt-2">
          <button
            onClick={() => { setTab("customers"); setSelectedCustomer(null); }}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === "customers" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t("crm.tab.customers", locale)}
          </button>
          <button
            onClick={() => { setTab("partners"); setSelectedPartner(null); }}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === "partners" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t("crm.tab.partners", locale)}
          </button>
        </div>

        <div className="space-y-4 p-6">
          {/* KPIs */}
          {tab === "customers" && (
            <Kpi
              items={[
                { label: t("crm.total_customers", locale), value: customerCounts.total, icon: "👥" },
                { label: t("crm.persons", locale), value: customerCounts.persons, icon: "👤", accent: "#059669" },
                { label: t("crm.companies", locale), value: customerCounts.companies, icon: "🏢", accent: "#7c3aed" },
              ]}
            />
          )}
          {tab === "partners" && (
            <Kpi
              items={[
                { label: t("crm.total_partners", locale), value: partnerCounts.total, icon: "🤝" },
                { label: t("crm.active_partners", locale), value: partnerCounts.active, icon: "✅", accent: "#059669" },
              ]}
            />
          )}

          {/* Search */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={tab === "customers" ? customerSearch : partnerSearch}
              onChange={(e) => tab === "customers" ? setCustomerSearch(e.target.value) : setPartnerSearch(e.target.value)}
              placeholder={t("crm.search.placeholder", locale)}
              className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

          {/* Customer Table */}
          {tab === "customers" && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{t("crm.col.code", locale)}</th>
                    <th className="px-4 py-2.5 font-medium">{t("crm.col.name", locale)}</th>
                    <th className="px-4 py-2.5 font-medium">{t("crm.col.email", locale)}</th>
                    <th className="px-4 py-2.5 font-medium">{t("crm.col.type", locale)}</th>
                    <th className="px-4 py-2.5 font-medium">{t("crm.col.status", locale)}</th>
                  </tr>
                </thead>
                <tbody>
                  {(customerData?.items ?? []).map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => void openCustomerDetail(c.id)}
                      className={`cursor-pointer border-b border-slate-50 transition-colors hover:bg-blue-50/50 ${selectedCustomer?.id === c.id ? "bg-blue-50/60" : ""}`}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-blue-600">{c.code}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{displayName(c)}</td>
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
                <Pagination page={customerPage} pageSize={20} total={customerData.total} onPageChange={(p) => { setCustomerPage(p); setSelectedCustomer(null); }} />
              )}
            </div>
          )}

          {/* Partner Table */}
          {tab === "partners" && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{t("crm.col.code", locale)}</th>
                    <th className="px-4 py-2.5 font-medium">{t("crm.col.name", locale)}</th>
                    <th className="px-4 py-2.5 font-medium">{t("crm.col.email", locale)}</th>
                    <th className="px-4 py-2.5 font-medium">{t("crm.col.country", locale)}</th>
                    <th className="px-4 py-2.5 font-medium">{t("crm.col.status", locale)}</th>
                  </tr>
                </thead>
                <tbody>
                  {(partnerData?.items ?? []).map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => void openPartnerDetail(p.id)}
                      className={`cursor-pointer border-b border-slate-50 transition-colors hover:bg-blue-50/50 ${selectedPartner?.id === p.id ? "bg-blue-50/60" : ""}`}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-blue-600">{p.code}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{p.name}</td>
                      <td className="px-4 py-2.5 text-slate-500">{p.contactEmail ?? "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500">{p.countryCode ?? "—"}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                  {(partnerData?.items ?? []).length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">{t("crm.partners_empty", locale)}</td></tr>
                  )}
                </tbody>
              </table>
              {partnerData && partnerData.total > 0 && (
                <Pagination page={partnerPage} pageSize={20} total={partnerData.total} onPageChange={(p) => { setPartnerPage(p); setSelectedPartner(null); }} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Create Customer Panel ── */}
      {showCreate && (
        <PanelFrame title={t("crm.create_customer", locale)} subtitle="CRM" onClose={() => setShowCreate(false)}>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.type", locale)}</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400">
              <option value="PERSON">{t("crm.type.person", locale)}</option>
              <option value="COMPANY">{t("crm.type.company", locale)}</option>
            </select>
          </div>
          {form.type === "PERSON" ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.firstName", locale)}</label>
                <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.lastName", locale)}</label>
                <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.companyName", locale)}</label>
              <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.email", locale)}</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.phone", locale)}</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
          </div>
          <button onClick={() => void createCustomer()} disabled={creating || !form.email.trim()} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {creating ? t("crm.detail.creating", locale) : t("crm.create.form.submit", locale)}
          </button>
        </PanelFrame>
      )}

      {/* ── Customer Detail Panel ── */}
      {!showCreate && selectedCustomer && (
        <aside className="thin-scroll fade-in-up w-96 shrink-0 overflow-y-auto border-l border-slate-200 bg-white">
          <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <div className="font-mono text-xs text-blue-600">{selectedCustomer.code}</div>
              <div className="text-lg font-bold text-slate-900">{displayName(selectedCustomer)}</div>
              <StatusBadge status={selectedCustomer.status} />
            </div>
            <button onClick={() => setSelectedCustomer(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">✕</button>
          </div>

          {/* Detail tabs */}
          <div className="flex gap-1 border-b border-slate-100 px-4 pt-2">
            {(["overview", "orders", "bookings", "payments", "relations"] as const).map((dt) => (
              <button key={dt} onClick={() => setCustomerDetailTab(dt)} className={`rounded-t-lg px-3 py-1.5 text-xs font-medium transition-colors ${customerDetailTab === dt ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:text-slate-600"}`}>
                {t(`crm.detail.${dt}`, locale)}
              </button>
            ))}
          </div>

          <div className="space-y-3 p-5 text-sm">
            {/* Overview */}
            {customerDetailTab === "overview" && (
              <>
                {canWrite && (
                  <button onClick={editing ? () => setEditing(false) : openEdit} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-600">
                    ✏️ {t("crm.detail.edit", locale)}
                  </button>
                )}
                {editing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.firstName", locale)}</label>
                        <input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.lastName", locale)}</label>
                        <input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.companyName", locale)}</label>
                      <input value={editForm.companyName} onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.create.form.phone", locale)}</label>
                      <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    </div>
                    <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">{t("crm.detail.uneditable", locale)}</div>
                    <div className="flex gap-2">
                      <button onClick={() => void saveEdit()} disabled={saving} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                        {saving ? t("crm.detail.saving", locale) : `💾 ${t("crm.detail.save", locale)}`}
                      </button>
                      <button onClick={() => setEditing(false)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50">
                        {t("crm.detail.cancel", locale)}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-slate-400">{t("crm.col.email", locale)}</div><div className="break-all font-medium text-slate-700">{selectedCustomer.email}</div></div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-slate-400">{t("crm.create.form.phone", locale)}</div><div className="font-medium text-slate-700">{selectedCustomer.phone ?? "—"}</div></div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-slate-400">{t("crm.col.type", locale)}</div><div className="font-medium text-slate-700">{selectedCustomer.type === "COMPANY" ? t("crm.type.company", locale) : t("crm.type.person", locale)}</div></div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-slate-400">ID</div><div className="font-mono text-xs text-slate-700">{selectedCustomer.id.slice(0, 8)}…</div></div>
                  </div>
                )}
                {/* Summary counts */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-blue-50 px-3 py-2 text-center"><div className="font-bold text-blue-700">{selectedCustomer.summary.totalOrders}</div><div className="text-blue-500">{t("crm.detail.total_orders", locale)}</div></div>
                  <div className="rounded-lg bg-green-50 px-3 py-2 text-center"><div className="font-bold text-green-700">{selectedCustomer.summary.totalBookings}</div><div className="text-green-500">{t("crm.detail.total_bookings", locale)}</div></div>
                  <div className="rounded-lg bg-purple-50 px-3 py-2 text-center"><div className="font-bold text-purple-700">{selectedCustomer.summary.totalPayments}</div><div className="text-purple-500">{t("crm.detail.total_payments", locale)}</div></div>
                </div>
              </>
            )}

            {/* Orders */}
            {customerDetailTab === "orders" && (
              selectedCustomer.orders.length > 0 ? (
                <div className="space-y-2">
                  {selectedCustomer.orders.map((o) => (
                    <div key={o.id} className="rounded-lg border border-slate-100 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-blue-600">{o.code}</span>
                        <StatusBadge status={o.status} />
                      </div>
                      <div className="mt-1 text-slate-500">{o.number} · {o.amount} {o.currency}</div>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center text-sm text-slate-400 py-4">{t("crm.detail.orders_empty", locale)}</div>
            )}

            {/* Bookings */}
            {customerDetailTab === "bookings" && (
              selectedCustomer.bookings.length > 0 ? (
                <div className="space-y-2">
                  {selectedCustomer.bookings.map((b) => (
                    <div key={b.id} className="rounded-lg border border-slate-100 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-blue-600">{b.code}</span>
                        <StatusBadge status={b.status} />
                      </div>
                      <div className="mt-1 text-slate-500">{b.amount} {b.currency}</div>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center text-sm text-slate-400 py-4">{t("crm.detail.bookings_empty", locale)}</div>
            )}

            {/* Payments */}
            {customerDetailTab === "payments" && (
              selectedCustomer.payments.length > 0 ? (
                <div className="space-y-2">
                  {selectedCustomer.payments.map((p) => (
                    <div key={p.id} className="rounded-lg border border-slate-100 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-blue-600">{p.code}</span>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="mt-1 text-slate-500">{p.amount} {p.currency}</div>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center text-sm text-slate-400 py-4">{t("crm.detail.payments_empty", locale)}</div>
            )}

            {/* Relations */}
            {customerDetailTab === "relations" && (
              selectedCustomer.partnerRelations.length > 0 ? (
                <div className="space-y-2">
                  {selectedCustomer.partnerRelations.map((r) => (
                    <div key={r.id} className="rounded-lg border border-slate-100 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700">{r.partner?.name ?? r.partnerId}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      {r.lifecycle && <div className="mt-1 text-slate-500">{r.lifecycle}</div>}
                      {r.leadSource && <div className="text-slate-400">Source: {r.leadSource}</div>}
                    </div>
                  ))}
                </div>
              ) : <div className="text-center text-sm text-slate-400 py-4">{t("crm.detail.relations", locale)}</div>
            )}
          </div>
        </aside>
      )}

      {/* ── Partner Detail Panel ── */}
      {tab === "partners" && selectedPartner && (
        <aside className="thin-scroll fade-in-up w-96 shrink-0 overflow-y-auto border-l border-slate-200 bg-white">
          <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <div className="font-mono text-xs text-blue-600">{selectedPartner.code}</div>
              <div className="text-lg font-bold text-slate-900">{selectedPartner.name}</div>
              <StatusBadge status={selectedPartner.status} />
            </div>
            <button onClick={() => setSelectedPartner(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">✕</button>
          </div>
          <div className="space-y-3 p-5 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-slate-400">{t("crm.col.email", locale)}</div><div className="break-all font-medium text-slate-700">{selectedPartner.contactEmail ?? "—"}</div></div>
              <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-slate-400">{t("crm.col.country", locale)}</div><div className="font-medium text-slate-700">{selectedPartner.countryCode ?? "—"}</div></div>
              <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-slate-400">REG #</div><div className="font-medium text-slate-700">{selectedPartner.registrationNumber ?? "—"}</div></div>
            </div>
            {selectedPartner.customerRelations.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{t("crm.detail.relations", locale)} ({selectedPartner.customerRelations.length})</div>
                <div className="space-y-2">
                  {selectedPartner.customerRelations.map((r) => (
                    <div key={r.id} className="rounded-lg border border-slate-100 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700">{r.customer ? displayName(r.customer) : r.customerId}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      {r.lifecycle && <div className="mt-1 text-slate-500">{r.lifecycle}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
