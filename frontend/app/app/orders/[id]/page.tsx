"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import EntityDetailShell from "@/components/EntityDetailShell";
import EntityDetailHeader from "@/components/EntityDetailHeader";
import EntityDetailLayout, {
  EntityDetailMain,
  EntityDetailAside,
  EntityDetailWide,
} from "@/components/commerce/EntityDetailLayout";
import EntitySectionCard from "@/components/commerce/EntitySectionCard";
import EntityField from "@/components/commerce/EntityField";
import EntityFieldGrid from "@/components/commerce/EntityFieldGrid";
import EntityLink from "@/components/commerce/EntityLink";
import EntityRow from "@/components/commerce/EntityRow";
import EntityFinanceCell from "@/components/commerce/EntityFinanceCell";
import EntityTimeline from "@/components/commerce/EntityTimeline";
import OperationalNotes from "@/components/OperationalNotes";
import TravelerCollectionPanel from "@/components/order/TravelerCollectionPanel";
import OrderActionBar from "@/components/order/OrderActionBar";
import { useLocale, t, ti, formatPrice, LOCALE_TAGS, type Locale } from "@/lib/i18n";
import { orderActionLabel } from "@/lib/commerce-history-labels";
import { useCurrentUser } from "@/lib/use-user";

interface OrderDetail {
  id: string;
  code: string;
  number: string;
  referenceNumber: string;
  status: string;
  paymentStatus: string;
  amount: string;
  paidAmount: string;
  refundedAmount: string;
  dueAmount: string;
  refundableAmount: string;
  currency: string;
  customerId: string | null;
  sellerPartnerId: string | null;
  customerDisplayName: string | null;
  partnerDisplayName: string | null;
  termsAcceptedAt: string | null;
  finalConfirmedAt: string | null;
  travelerDataCompletedAt: string | null;
  fulfilledAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  travelerCount: number | null;
  pinnedRequirements: unknown;
  availableActions?: string[];
  linkedRequest?: { id: string; referenceNumber: string; status: string } | null;
  linkedBooking?: { id: string; referenceNumber: string; status: string; code?: string } | null;
  items?: { id: string; title: string; type: string; quantity: number; price: string; amount: string; currency: string }[];
}

interface HistoryRow {
  id: string;
  action: string;
  from: string | null;
  to: string | null;
  actorName: string | null;
  comment: string | null;
  createdAt: string;
  fields?: Array<{ field: string; oldValue: string | null; newValue: string | null; redacted?: boolean }> | null;
}
interface HistoryPage {
  items: HistoryRow[];
  total: number;
  page: number;
  pageSize: number;
}

function formatTs(iso: string | null, locale: Locale): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString(LOCALE_TAGS[locale]);
}

function renderFieldValue(field: string, value: string | null): string {
  if (value === null) return "—";
  if (/birthDate|passportExpiry/.test(field)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString().slice(0, 10);
  }
  return value;
}

/** Traveler field label via canonical d3.field.* i18n keys. */
function fieldLabel(field: string, locale: Locale): string {
  const key = `d3.field.${field}`;
  const localized = t(key, locale);
  return localized !== key ? localized : field;
}

export default function OrderDetailPage() {
  const params = useParams();
  const locale = useLocale();
  const user = useCurrentUser();
  const id = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryPage>({ items: [], total: 0, page: 0, pageSize: 20 });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [finHistory, setFinHistory] = useState<{ payments: Array<{ id: string; code: string; status: string; amount: string; currency: string; paidAt: string | null; failedAt: string | null; cancelledAt: string | null; createdAt: string }>; refunds: Array<{ id: string; code: string; status: string; amount: string; currency: string; reason: string | null; requestedAt: string | null; approvedAt: string | null; processedAt: string | null; failedAt: string | null; createdAt: string }> }>({ payments: [], refunds: [] });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [finHistoryLoading, setFinHistoryLoading] = useState(false);

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const detail = await api.get<OrderDetail>(`/orders/${id}`);
      setOrder(detail);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadHistory = useCallback(async (page: number) => {
    setHistoryLoading(true);
    try {
      const res = await api.get<HistoryPage>(`/orders/${id}/history?page=${page}&pageSize=${history.pageSize}`);
      setHistory((prev) => ({
        items: page === 1 ? res.items : [...prev.items, ...res.items],
        total: res.total,
        page: res.page,
        pageSize: res.pageSize,
      }));
    } catch {
      // история не блокирует страницу
    } finally {
      setHistoryLoading(false);
    }
  }, [id, history.pageSize]);

  const loadFinHistory = useCallback(async () => {
    setFinHistoryLoading(true);
    try {
      const res = await api.get<{ payments: { payments: typeof finHistory.payments; history: unknown[] }; refunds: { refunds: typeof finHistory.refunds; history: unknown[] } }>(`/orders/${id}/financial-history`);
      setFinHistory({ payments: res.payments.payments ?? [], refunds: res.refunds.refunds ?? [] });
    } catch {
      // financial history does not block the page
    } finally {
      setFinHistoryLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadOrder();
    void loadHistory(1);
    void loadFinHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadOrder, id]);

  const runAction = async (action: string) => {
    if (!order) return;
    setBusyAction(action);
    try {
      await api.patch(`/orders/${order.id}`, { action });
      await loadOrder();
      await loadHistory(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="text-sm text-slate-400">{t("crm.loading", locale)}</div></div>;
  }

  if (error || !order) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-sm text-red-500">{error || t("crm.not_found", locale)}</div>
        <Link href="/app/orders" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">{t("crm.back_to_list", locale)}</Link>
      </div>
    );
  }

  const immutableTravelers = order.finalConfirmedAt != null;

  // Business lifecycle milestones — NOT audit history (who changed what when).
  const milestones: Array<{ key: string; label: string; timestamp: string | null }> = [
    { key: "created", label: t("crm.col.created", locale), timestamp: order.createdAt },
    { key: "termsAccepted", label: t("detail.dates.terms_accepted", locale), timestamp: order.termsAcceptedAt },
    { key: "finalConfirmed", label: t("detail.dates.final_confirmed", locale), timestamp: order.finalConfirmedAt },
    { key: "fulfilled", label: t("detail.dates.fulfilled", locale), timestamp: order.fulfilledAt },
    { key: "closed", label: t("detail.dates.closed", locale), timestamp: order.closedAt },
    { key: "cancelled", label: t("detail.dates.cancelled", locale), timestamp: order.cancelledAt },
  ];

  return (
    <EntityDetailShell
      header={
        <EntityDetailHeader
          breadcrumbs={["TravelHub", t("orders.title", locale), order.referenceNumber]}
          reference={order.referenceNumber}
          secondary={order.number}
          backHref="/app/orders"
          lifecycleStatus={<StatusBadge status={order.status} />}
          paymentStatus={<StatusBadge status={order.paymentStatus} />}
          actions={
            user ? (
              <OrderActionBar
                actions={order.availableActions ?? []}
                onRun={(a) => void runAction(a)}
                busyAction={busyAction}
              />
            ) : null
          }
        >
          {error && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}
        </EntityDetailHeader>
      }
    >
      <EntityDetailLayout>
        {/* MAIN — primary + secondary business content */}
        <EntityDetailMain>
          {/* PRIMARY: Обзор заказа — client / seller / core order facts */}
          <EntitySectionCard title={t("detail.sections.overview", locale)}>
            <EntityFieldGrid>
              {order.customerId && (
                <EntityField label={t("crm.col.customer", locale)} value={
                  <EntityLink href={`/app/crm/customers/${order.customerId}`}>{order.customerDisplayName ?? order.customerId}</EntityLink>
                } />
              )}
              {order.sellerPartnerId && (
                <EntityField label={t("crm.col.seller_partner", locale)} value={
                  <EntityLink href={`/app/crm/partners/${order.sellerPartnerId}`}>{order.partnerDisplayName ?? order.sellerPartnerId}</EntityLink>
                } />
              )}
              <EntityField label={t("reqflow.travelers", locale)} value={order.travelerCount ?? null} />
              <EntityField label={t("crm.col.created", locale)} value={formatTs(order.createdAt, locale)} />
            </EntityFieldGrid>
          </EntitySectionCard>

          {/* SECONDARY: Finance — D7 backend-authoritative */}
          <EntitySectionCard title={t("bookings.financial", locale)}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <EntityFinanceCell label={t("crm.detail.total_amount", locale)} value={formatPrice(order.amount, order.currency, locale)} tone="neutral" />
              <EntityFinanceCell label={t("crm.detail.paid_amount", locale)} value={formatPrice(order.paidAmount, order.currency, locale)} tone="positive" />
              <EntityFinanceCell label={t("crm.detail.refunded_amount", locale)} value={formatPrice(order.refundedAmount, order.currency, locale)} tone="negative" />
              <EntityFinanceCell label={t("finance.due_amount", locale)} value={formatPrice(order.dueAmount, order.currency, locale)} tone="warning" />
              <EntityFinanceCell label={t("finance.refundable_amount", locale)} value={formatPrice(order.refundableAmount, order.currency, locale)} tone="info" />
              <EntityFinanceCell label={t("crm.detail.payment_status", locale) || "Статус оплаты"} value={<StatusBadge status={order.paymentStatus} />} tone="neutral" />
            </div>
          </EntitySectionCard>

          {order.items && order.items.length > 0 && (
            <EntitySectionCard title={t("order.items", locale)}>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <EntityRow key={item.id} className="justify-between">
                    <div>
                      <EntityLink href={`/app/catalog/${item.id}`}>{item.title}</EntityLink>
                      <div className="mt-0.5 text-slate-400">{item.type} · ×{item.quantity}</div>
                    </div>
                    <span className="text-slate-500">{formatPrice(item.amount, item.currency, locale) ?? "—"}</span>
                  </EntityRow>
                ))}
              </div>
            </EntitySectionCard>
          )}

          {/* Туристы: до final-confirm — редактируемо (permissions); после — read-only */}
          <EntitySectionCard title={t("d3.travelers_title", locale)}>
            {immutableTravelers && (
              <div className="mb-3 text-xs text-slate-400">{t("d3.locked", locale)}</div>
            )}
            <TravelerCollectionPanel orderId={id} />
          </EntitySectionCard>
        </EntityDetailMain>

        {/* ASIDE — context column: lifecycle timeline + compact details */}
        <EntityDetailAside>
          <EntitySectionCard title={t("detail.sections.timeline", locale)}>
            <EntityTimeline items={milestones} />
          </EntitySectionCard>

          <EntitySectionCard title={t("detail.sections.details", locale)}>
            <div className="grid grid-cols-1 gap-4">
              <EntityField label={t("admin.table.col.code", locale)} value={order.code} mono />
              <EntityField label={t("crm.col.number", locale)} value={order.number} mono />
              <EntityField label={t("crm.col.created", locale)} value={formatTs(order.createdAt, locale)} />
              <EntityField label={t("crm.col.updated", locale)} value={formatTs(order.updatedAt, locale)} />
            </div>
          </EntitySectionCard>
        </EntityDetailAside>

        {/* WIDE — relations lower slot (UI-C2 not started) */}
        <EntityDetailWide>
          <EntitySectionCard title={t("detail.sections.relations", locale)}>
            <EntityFieldGrid>
              {order.linkedRequest && (
                <EntityField label={t("detail.relation.request", locale)} value={
                  <EntityStatusBadgesCell
                    link={<EntityLink href={`/app/requests/${order.linkedRequest.id}`} className="font-mono text-xs">{order.linkedRequest.referenceNumber}</EntityLink>}
                    badge={<StatusBadge status={order.linkedRequest.status} />}
                  />
                } />
              )}
              {order.linkedBooking && (
                <EntityField label={t("detail.relation.booking", locale)} value={
                  <EntityStatusBadgesCell
                    link={<EntityLink href={`/app/bookings/${order.linkedBooking.id}`} className="font-mono text-xs">{order.linkedBooking.referenceNumber}</EntityLink>}
                    badge={<StatusBadge status={order.linkedBooking.status} />}
                  />
                } />
              )}
              {!order.linkedBooking && (
                <EntityField label={t("detail.relation.booking", locale)} value={<span className="text-sm text-slate-400">{t("detail.relation.no_booking", locale)}</span>} />
              )}
            </EntityFieldGrid>
          </EntitySectionCard>
        </EntityDetailWide>

        {/* WIDE — notes */}
        <EntityDetailWide>
          {user && (
            <OperationalNotes
              entityType="Order"
              entityId={id}
              permissions={user.permissions}
              currentUserId={user.id}
              currentRole={user.role}
            />
          )}
        </EntityDetailWide>

        {/* WIDE — audit: change history + D7 financial history */}
        <EntityDetailWide>
          <EntitySectionCard title={t("bookings.change_history", locale)}>
            {history.total === 0 && !historyLoading && (
              <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-400">
                {t("bookings.history_disclaimer", locale)}
              </div>
            )}
            <div className="space-y-2">
              {history.items.map((h) => (
                <EntityRow key={h.id} className="items-start">
                  <div className="w-full">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700">{orderActionLabel(h.action, locale)}</span>
                      <span className="shrink-0 text-slate-400">{formatTs(h.createdAt, locale)}</span>
                    </div>
                    {(h.from || h.to) && (
                      <div className="mt-0.5 text-slate-500">
                        {h.from ? <StatusBadge status={h.from} /> : null}
                        {h.from && h.to ? <span className="mx-1 text-slate-400">→</span> : null}
                        {h.to ? <StatusBadge status={h.to} /> : null}
                      </div>
                    )}
                    {h.comment && <div className="mt-1 text-slate-500">{h.comment}</div>}
                    {Array.isArray(h.fields) && h.fields.length > 0 && (
                      <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2">
                        {h.fields.map((f, idx) => {
                          const labelBase = f.field.includes("traveler[") ? f.field.replace(/^traveler\[\d+\]\./, "") : f.field;
                          return (
                            <li key={idx} className="flex flex-wrap items-center gap-1 text-[11px] text-slate-600">
                              <span className="font-medium">{fieldLabel(labelBase, locale)}:</span>
                              <span className="text-slate-400 line-through">{renderFieldValue(labelBase, f.oldValue)}</span>
                              <span>→</span>
                              <span>{renderFieldValue(labelBase, f.newValue)}</span>
                              {f.redacted && <span className="text-amber-600">{t("order.history.redacted", locale)}</span>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {h.actorName && <div className="mt-1 text-slate-400">{ti("order.history.author", locale, { name: h.actorName })}</div>}
                  </div>
                </EntityRow>
              ))}
            </div>
            {history.items.length < history.total && (
              <button
                disabled={historyLoading}
                onClick={() => void loadHistory(history.page + 1)}
                className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {historyLoading ? "…" : ti("order.history.show_more", locale, { n: history.total - history.items.length })}
              </button>
            )}
          </EntitySectionCard>
        </EntityDetailWide>

        <EntityDetailWide>
          <EntitySectionCard title={t("finance.history", locale) || "Финансовая история"}>
            {finHistoryLoading && <div className="text-xs text-slate-400">{t("crm.loading", locale)}</div>}
            {!finHistoryLoading && finHistory.payments.length === 0 && finHistory.refunds.length === 0 && (
              <div className="text-xs text-slate-400">{t("finance.no_history", locale) || "Нет финансовых событий"}</div>
            )}
            <div className="space-y-2">
              {finHistory.payments.map((p) => (
                <EntityRow key={p.id} className="justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400">{p.code}</span>
                    <StatusBadge status={p.status} />
                    <span className="text-slate-600">{formatPrice(p.amount, p.currency, locale)}</span>
                  </div>
                  <span className="text-slate-400">{formatTs(p.paidAt ?? p.failedAt ?? p.cancelledAt ?? p.createdAt, locale)}</span>
                </EntityRow>
              ))}
              {finHistory.refunds.map((r) => (
                <EntityRow key={r.id} className="justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400">{r.code}</span>
                    <StatusBadge status={r.status} />
                    <span className="text-red-600">{formatPrice(r.amount, r.currency, locale)}</span>
                    {r.reason && <span className="text-slate-400">({r.reason})</span>}
                  </div>
                  <span className="text-slate-400">{formatTs(r.processedAt ?? r.approvedAt ?? r.requestedAt ?? r.createdAt, locale)}</span>
                </EntityRow>
              ))}
            </div>
          </EntitySectionCard>
        </EntityDetailWide>
      </EntityDetailLayout>
    </EntityDetailShell>
  );
}

/** Relation value: mono link + status badge on the same line. */
function EntityStatusBadgesCell({ link, badge }: { link: React.ReactNode; badge: React.ReactNode }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {link}
      {badge}
    </span>
  );
}