"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type PartnerCustomer, type PartnerCustomerDetail, type PartnerIntakeResult, type CrmTierResponse, type Page } from "@/lib/api";
import Kpi from "@/components/Kpi";
import Pagination from "@/components/Pagination";
import StatusBadge from "@/components/StatusBadge";
import PanelFrame from "@/components/PanelFrame";
import { useLocale } from "@/lib/i18n";
import { pt } from "@/lib/partner-i18n";
import { useCurrentUser } from "@/lib/use-user";

/**
 * Step 3.5C Remediation — Partner CRM page.
 *
 * Shared page for both MARKETPLACE BASIC and STOREFRONT PRO.
 * Tier-specific capabilities are resolved server-side via /partner/crm-tier.
 *
 * Basic: customer list from marketplace orders (read-only, no intake)
 * Pro:   full CRM from PartnerCustomerRelation (intake, lifecycle, tags, notes, assignedTo)
 */
export default function PartnerCustomersPage() {
  const locale = useLocale();
  const currentUser = useCurrentUser();
  const [tier, setTier] = useState<"BASIC" | "PRO" | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Data ──
  const [customerData, setCustomerData] = useState<Page<PartnerCustomer> | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<PartnerCustomerDetail | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detailTab, setDetailTab] = useState<"overview" | "orders" | "bookings" | "payments" | "relations">("overview");
  const [error, setError] = useState("");

  // ── Pro-only: intake ──
  const [showIntake, setShowIntake] = useState(false);
  const [intaking, setIntaking] = useState(false);
  const [intakeForm, setIntakeForm] = useState({ firstName: "", lastName: "", companyName: "", email: "", phone: "", leadSource: "DIRECT", notes: "" });

  // ── Pro-only: relation editing ──
  const [editingRelation, setEditingRelation] = useState(false);
  const [relationForm, setRelationForm] = useState({ lifecycle: "", tags: "", notes: "", assignedTo: "" });
  const [savingRelation, setSavingRelation] = useState(false);

  // ── Resolve tier ──
  useEffect(() => {
    if (!currentUser?.partnerId) return;
    api
      .get<CrmTierResponse>("/partner/crm-tier")
      .then((res) => setTier(res.tier))
      .catch(() => setTier("BASIC"))
      .finally(() => setLoading(false));
  }, [currentUser]);

  // ── Load customers ──
  const loadCustomers = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      qs.set("page", String(page));
      qs.set("pageSize", "20");
      const res = await api.get<Page<PartnerCustomer>>(`/partner/customers?${qs.toString()}`);
      setCustomerData(res);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [search, page]);

  useEffect(() => {
    if (tier) void loadCustomers();
  }, [tier, loadCustomers]);

  // ── Open detail ──
  const openDetail = async (id: string) => {
    setDetailTab("overview");
    setEditingRelation(false);
    try {
      const detail = await api.get<PartnerCustomerDetail>(`/partner/customers/${id}`);
      setSelectedCustomer(detail);
      if (tier === "PRO" && detail._relation) {
        setRelationForm({
          lifecycle: detail._relation.lifecycle ?? "",
          tags: (detail._relation.tags ?? []).join(", "),
          notes: detail._relation.notes ?? "",
          assignedTo: detail._relation.assignedTo ?? "",
        });
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // ── Intake (Pro only) ──
  const createIntake = async () => {
    if (!intakeForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(intakeForm.email.trim())) {
      setError("Укажите корректный email");
      return;
    }
    setIntaking(true);
    setError("");
    try {
      const result = await api.post<PartnerIntakeResult>("/partner/customers/intake", {
        firstName: intakeForm.firstName.trim() || undefined,
        lastName: intakeForm.lastName.trim() || undefined,
        companyName: intakeForm.companyName.trim() || undefined,
        email: intakeForm.email.trim(),
        phone: intakeForm.phone.trim() || undefined,
        leadSource: intakeForm.leadSource || undefined,
        notes: intakeForm.notes.trim() || undefined,
      });
      setShowIntake(false);
      setIntakeForm({ firstName: "", lastName: "", companyName: "", email: "", phone: "", leadSource: "DIRECT", notes: "" });
      await loadCustomers();
      await openDetail(result.customerId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIntaking(false);
    }
  };

  // ── Update relation (Pro only) ──
  const saveRelation = async () => {
    if (!selectedCustomer?._relation) return;
    setSavingRelation(true);
    try {
      await api.patch(`/partner/relations/${selectedCustomer._relation.id}`, {
        lifecycle: relationForm.lifecycle || undefined,
        tags: relationForm.tags ? relationForm.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
        notes: relationForm.notes || undefined,
        assignedTo: relationForm.assignedTo || undefined,
      });
      setEditingRelation(false);
      await openDetail(selectedCustomer.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingRelation(false);
    }
  };

  const displayName = (c: { firstName?: string | null; lastName?: string | null; companyName?: string | null }) =>
    c.companyName ?? (`${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—");

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400">
        {pt("partner.state.loading", locale)}
      </div>
    );
  }

  const isPro = tier === "PRO";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            {isPro ? "CRM" : pt("partner.nav.customers", locale)}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {isPro
              ? "Полное управление клиентской базой"
              : "Клиенты из ваших marketplace-заказов"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isPro && (
            <button
              onClick={() => setShowIntake((v) => !v)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              + {pt("partner.crm.add_customer", locale)}
            </button>
          )}
          <button
            onClick={() => void loadCustomers()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            ⟳
          </button>
        </div>
      </div>

      {/* Tier badge */}
      <div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isPro ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {isPro ? "STOREFRONT PRO — Full CRM" : "MARKETPLACE BASIC — Клиенты"}
        </span>
      </div>

      {/* KPI */}
      <Kpi
        items={[
          {
            label: isPro ? pt("partner.crm.total_customers", locale) : pt("partner.crm.my_customers", locale),
            value: customerData?.total ?? 0,
            icon: "👥",
          },
        ]}
      />

      {/* Search */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void loadCustomers()}
          placeholder={pt("partner.crm.search_placeholder", locale)}
          className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>
      )}

      {/* Customer Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Код</th>
              <th className="px-4 py-2.5 font-medium">Имя</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Тип</th>
              {isPro && <th className="px-4 py-2.5 font-medium">Лайфсайкл</th>}
              <th className="px-4 py-2.5 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody>
            {(customerData?.items ?? []).map((c) => (
              <tr
                key={c.id}
                onClick={() => void openDetail(c.id)}
                className={`cursor-pointer border-b border-slate-50 transition-colors hover:bg-emerald-50/50 ${
                  selectedCustomer?.id === c.id ? "bg-emerald-50/60" : ""
                }`}
              >
                <td className="px-4 py-2.5 font-mono text-xs text-emerald-600">{c.code}</td>
                <td className="px-4 py-2.5 font-medium text-slate-800">{displayName(c)}</td>
                <td className="px-4 py-2.5 text-slate-500">{c.email}</td>
                <td className="px-4 py-2.5 text-slate-500">{c.type === "COMPANY" ? "Компания" : "Физлицо"}</td>
                {isPro && <td className="px-4 py-2.5 text-slate-500">{(c as any)._relation?.lifecycle ?? "—"}</td>}
                <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
              </tr>
            ))}
            {(customerData?.items ?? []).length === 0 && (
              <tr>
                <td colSpan={isPro ? 6 : 5} className="px-4 py-8 text-center text-sm text-slate-400">
                  Клиентов пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {customerData && customerData.total > 0 && (
          <Pagination page={page} pageSize={20} total={customerData.total} onPageChange={(p) => { setPage(p); setSelectedCustomer(null); }} />
        )}
      </div>

      {/* ── Intake Panel (Pro only) ── */}
      {showIntake && isPro && (
        <PanelFrame title={pt("partner.crm.add_customer", locale)} subtitle="STOREFRONT PRO" onClose={() => setShowIntake(false)}>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Имя</label>
            <input value={intakeForm.firstName} onChange={(e) => setIntakeForm({ ...intakeForm, firstName: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-emerald-400" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Фамилия</label>
            <input value={intakeForm.lastName} onChange={(e) => setIntakeForm({ ...intakeForm, lastName: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-emerald-400" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Email *</label>
            <input value={intakeForm.email} onChange={(e) => setIntakeForm({ ...intakeForm, email: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-emerald-400" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Телефон</label>
            <input value={intakeForm.phone} onChange={(e) => setIntakeForm({ ...intakeForm, phone: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-emerald-400" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Источник лида</label>
            <select value={intakeForm.leadSource} onChange={(e) => setIntakeForm({ ...intakeForm, leadSource: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-emerald-400">
              <option value="DIRECT">Прямой</option>
              <option value="MARKETPLACE">Marketplace</option>
              <option value="REFERRAL">Рекомендация</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Заметки</label>
            <textarea value={intakeForm.notes} onChange={(e) => setIntakeForm({ ...intakeForm, notes: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-emerald-400" rows={3} />
          </div>
          <button
            onClick={() => void createIntake()}
            disabled={intaking || !intakeForm.email.trim()}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {intaking ? "Сохранение…" : "Добавить клиента"}
          </button>
        </PanelFrame>
      )}

      {/* ── Detail Panel ── */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-30 flex justify-end bg-black/20" onClick={() => setSelectedCustomer(null)}>
          <aside
            className="thin-scroll fade-in-up h-full w-[420px] overflow-y-auto border-l border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <div className="font-mono text-xs text-emerald-600">{selectedCustomer.code}</div>
                <div className="text-lg font-bold text-slate-900">{displayName(selectedCustomer)}</div>
                <StatusBadge status={selectedCustomer.status} />
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-100 px-4 pt-2">
              {(["overview", "orders", "bookings", "payments", "relations"] as const).map((dt) => (
                <button
                  key={dt}
                  onClick={() => { setDetailTab(dt); setEditingRelation(false); }}
                  className={`rounded-t-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    detailTab === dt ? "bg-emerald-50 text-emerald-600" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {dt === "overview" ? "Обзор" : dt === "orders" ? "Заказы" : dt === "bookings" ? "Брони" : dt === "payments" ? "Платежи" : "Отношения"}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="space-y-3 p-5 text-sm">
              {/* Overview */}
              {detailTab === "overview" && (
                <>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="text-slate-400">Email</div>
                      <div className="break-all font-medium text-slate-700">{selectedCustomer.email}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="text-slate-400">Телефон</div>
                      <div className="font-medium text-slate-700">{selectedCustomer.phone ?? "—"}</div>
                    </div>
                  </div>

                  {/* Pro: relation fields */}
                  {isPro && selectedCustomer._relation && (
                    <div className="space-y-2 text-xs">
                      <div className="rounded-lg bg-emerald-50 px-3 py-2">
                        <div className="text-emerald-400">Лайфсайкл</div>
                        <div className="font-medium text-emerald-700">{selectedCustomer._relation.lifecycle ?? "—"}</div>
                      </div>
                      {selectedCustomer._relation.leadSource && (
                        <div className="rounded-lg bg-blue-50 px-3 py-2">
                          <div className="text-blue-400">Источник лида</div>
                          <div className="font-medium text-blue-700">{selectedCustomer._relation.leadSource}</div>
                        </div>
                      )}
                      {selectedCustomer._relation.tags.length > 0 && (
                        <div className="rounded-lg bg-violet-50 px-3 py-2">
                          <div className="text-violet-400">Теги</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {selectedCustomer._relation.tags.map((tag) => (
                              <span key={tag} className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">{tag}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedCustomer._relation.notes && (
                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                          <div className="text-slate-400">Заметки</div>
                          <div className="whitespace-pre-wrap font-medium text-slate-700">{selectedCustomer._relation.notes}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Basic: simple info */}
                  {!isPro && (
                    <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      Marketplace Basic — показываются только данные из ваших заказов.
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-blue-50 px-3 py-2 text-center">
                      <div className="font-bold text-blue-700">{selectedCustomer.summary.totalOrders}</div>
                      <div className="text-blue-500">Заказы</div>
                    </div>
                    <div className="rounded-lg bg-green-50 px-3 py-2 text-center">
                      <div className="font-bold text-green-700">{selectedCustomer.summary.totalBookings}</div>
                      <div className="text-green-500">Брони</div>
                    </div>
                    <div className="rounded-lg bg-purple-50 px-3 py-2 text-center">
                      <div className="font-bold text-purple-700">{selectedCustomer.summary.totalPayments}</div>
                      <div className="text-purple-500">Платежи</div>
                    </div>
                  </div>
                </>
              )}

              {/* Orders */}
              {detailTab === "orders" && (
                <div className="space-y-2">
                  {selectedCustomer.orders.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400">Заказов нет</div>
                  ) : (
                    selectedCustomer.orders.map((o) => (
                      <div key={o.id} className="rounded-lg border border-slate-100 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-emerald-600">{o.code}</span>
                          <StatusBadge status={o.status} />
                        </div>
                        <div className="mt-1 text-slate-500">{o.number} · {o.amount} {o.currency}</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Bookings */}
              {detailTab === "bookings" && (
                <div className="space-y-2">
                  {selectedCustomer.bookings.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400">Бронирований нет</div>
                  ) : (
                    selectedCustomer.bookings.map((b) => (
                      <div key={b.id} className="rounded-lg border border-slate-100 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-emerald-600">{b.code}</span>
                          <StatusBadge status={b.status} />
                        </div>
                        <div className="mt-1 text-slate-500">{b.amount} {b.currency}</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Payments */}
              {detailTab === "payments" && (
                <div className="space-y-2">
                  {selectedCustomer.payments.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400">Платежей нет</div>
                  ) : (
                    selectedCustomer.payments.map((p) => (
                      <div key={p.id} className="rounded-lg border border-slate-100 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-emerald-600">{p.code}</span>
                          <StatusBadge status={p.status} />
                        </div>
                        <div className="mt-1 text-slate-500">{p.amount} {p.currency}</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Relations */}
              {detailTab === "relations" && (
                <>
                  {isPro && selectedCustomer._relation ? (
                    editingRelation ? (
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-400">Лайфсайкл</label>
                          <input value={relationForm.lifecycle} onChange={(e) => setRelationForm({ ...relationForm, lifecycle: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-400">Теги (через запятую)</label>
                          <input value={relationForm.tags} onChange={(e) => setRelationForm({ ...relationForm, tags: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-400">Заметки</label>
                          <textarea value={relationForm.notes} onChange={(e) => setRelationForm({ ...relationForm, notes: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" rows={3} />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => void saveRelation()} disabled={savingRelation} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                            {savingRelation ? "…" : "Сохранить"}
                          </button>
                          <button onClick={() => setEditingRelation(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50">
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="rounded-lg border border-slate-100 px-3 py-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-700">Ваше отношение</span>
                            <button onClick={() => setEditingRelation(true)} className="text-emerald-600 hover:text-emerald-700">Редактировать</button>
                          </div>
                          <div className="mt-1 text-slate-500">{selectedCustomer._relation.lifecycle ?? "—"}</div>
                          {selectedCustomer._relation.leadSource && (
                            <div className="mt-1 text-slate-400">Источник: {selectedCustomer._relation.leadSource}</div>
                          )}
                        </div>
                      </div>
                    )
                  ) : !isPro ? (
                    <div className="rounded-lg bg-amber-50 px-3 py-3 text-xs text-amber-700">
                      Управление отношениями доступно только для Storefront Pro.
                    </div>
                  ) : (
                    <div className="py-4 text-center text-xs text-slate-400">Отношений нет</div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
