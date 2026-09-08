"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useLocale, t, ti, LOCALE_TAGS } from "@/lib/i18n";
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
import EntityRow from "@/components/commerce/EntityRow";
import EntityTimeline from "@/components/commerce/EntityTimeline";
import EntityAuditHistory from "@/components/commerce/EntityAuditHistory";
import CommerceRelationChain from "@/components/commerce/CommerceRelationChain";
import OperationalNotes from "@/components/OperationalNotes";
import RequestActionBar, {
  type RequestAvailableActions,
} from "@/components/request/RequestActionBar";
import { requestActionLabel } from "@/lib/commerce-history-labels";
import { useCurrentUser } from "@/lib/use-user";

interface RequestHistoryRow {
  id: string;
  action: string;
  from: string | null;
  to: string | null;
  actorName: string | null;
  comment: string | null;
  createdAt: string;
}

interface RequestDetail {
  id: string;
  code: string;
  commerceSequence: string;
  referenceNumber: string;
  customerId: string | null;
  customerName: string | null;
  customerCode: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  productId: string | null;
  productName: string | null;
  productCode: string | null;
  productType: string | null;
  partnerId: string | null;
  partnerName: string | null;
  partnerCode: string | null;
  partnerCountry: string | null;
  status: string;
  requestedServiceDate: string | null;
  quantity: number;
  travelerCount: number | null;
  displayedPrice: string | null;
  displayedCurrency: string | null;
  confirmedPrice: string | null;
  confirmedCurrency: string | null;
  supplierResponseDeadline: string | null;
  supplierRespondedAt: string | null;
  supplierDecision: string | null;
  supplierPriceProposal: string | null;
  supplierNote: string | null;
  customerActionDeadline: string | null;
  customerAcceptedAt: string | null;
  customerDecision: string | null;
  convertedOrderId: string | null;
  convertedAt: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  version: number;
  convertedOrder?: {
    id: string;
    referenceNumber: string;
    status: string;
    amount: string | null;
    currency: string | null;
    createdAt: string | null;
    travelerCount: number | null;
    travelerProgress: "AWAITING_TRAVELERS" | "DATA_FILLED" | "FINAL_CONFIRMED" | null;
    finalConfirmedAt: string | null;
  };
  convertedBooking?: {
    id: string;
    referenceNumber: string;
    status: string;
    createdAt: string | null;
  };
  convertedPayments?: Array<{
    id: string;
    referenceNumber: string;
    status: string;
    amount: string | null;
    currency: string | null;
    createdAt: string | null;
    paidAt: string | null;
  }>;
  availableActions?: {
    confirmPrice: boolean;
    proposePrice: boolean;
    reject: boolean;
    unavailable: boolean;
    customerAccept: boolean;
    customerDecline: boolean;
    convert: boolean;
  };
}

function ProgressBadge({ progress, locale }: { progress: "AWAITING_TRAVELERS" | "DATA_FILLED" | "FINAL_CONFIRMED" | null; locale: "ru" | "az" | "en" }) {
  if (!progress) return null;
  const key = progress === "FINAL_CONFIRMED" ? "reqflow.progress.final" : progress === "DATA_FILLED" ? "reqflow.progress.filled" : "reqflow.progress.awaiting";
  const cls = progress === "FINAL_CONFIRMED"
    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : progress === "DATA_FILLED"
      ? "bg-sky-100 text-sky-700 border-sky-200"
      : "bg-amber-100 text-amber-700 border-amber-200";
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>{t(key, locale)}</span>;
}

export default function RequestDetailPage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const user = useCurrentUser();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<RequestHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // UI-C4: immutable change history (server-authoritative /requests/:id/history).
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const rows = await api.get<RequestHistoryRow[]>(`/requests/${id}/history`);
      setHistory(rows ?? []);
    } catch (err: any) {
      // история не блокирует страницу
      setHistoryError(err.message || null);
    } finally {
      setHistoryLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const loadRequest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.get(`/requests/${id}`) as any;
      setRequest(d);
    } catch (err: any) {
      setError(err.message || "Error loading request");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadRequest(); }, [loadRequest]);

  async function runPost(path: string, body?: Record<string, unknown>): Promise<boolean> {
    setBusy(path);
    setActionMsg(null);
    try {
      await api.post(path, body ?? {});
      await loadRequest();
      return true;
    } catch (err: any) {
      setActionMsg(err.message || t("requests.action_error", locale));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function propose(price: number): Promise<boolean> {
    return runPost(`/requests/${id}/propose-price`, { price });
  }

  /** Canonical action path segment → full API path (existing UI-C6 contract). */
  const runAction = (action: string) => {
    void runPost(`/requests/${id}/${action}`);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-slate-400">{t("crm.loading", locale)}</div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-sm text-red-500">{error || t("crm.not_found", locale)}</div>
        <Link
          href="/app/requests"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          ← {t("crm.back_to_list", locale)}
        </Link>
      </div>
    );
  }

  const r = request;
  const actions: RequestAvailableActions = r.availableActions ?? {
    confirmPrice: false,
    proposePrice: false,
    reject: false,
    unavailable: false,
    customerAccept: false,
    customerDecline: false,
    convert: false,
  };

  // UI-C6: frontend may render only what the server projected.
  // Status arrays are no longer the authority.
  const progress = r.convertedOrder?.travelerProgress ?? null;
  const timeline = (r as any).timeline as Array<{ label: string; timestamp: string | null }> | undefined;
  const fmtDate = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString(LOCALE_TAGS[locale]) : null);
  const fmtTs = (v: string | null | undefined) => (v ? new Date(v).toLocaleString(LOCALE_TAGS[locale]) : null);

  return (
    <EntityDetailShell
      header={
        <EntityDetailHeader
          breadcrumbs={["TravelHub", t("requests.title", locale), r.referenceNumber]}
          reference={r.referenceNumber}
          secondary={r.code}
          backHref="/app/requests"
          lifecycleStatus={<StatusBadge status={r.status} />}
          actions={
            user ? (
              <RequestActionBar
                locale={locale}
                availableActions={actions}
                busyAction={busy === null ? null : (busy.split("/").pop() ?? null)}
                onRun={runAction}
                onPropose={propose}
                onValidationMessage={(m) => setActionMsg(m)}
              />
            ) : null
          }
        >
          {actionMsg && (
            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{actionMsg}</div>
          )}
        </EntityDetailHeader>
      }
    >
      <EntityDetailLayout>
        {/* MAIN — primary + secondary business content */}
        <EntityDetailMain>
          {/* PRIMARY: Обзор заявки */}
          <EntitySectionCard title={t("detail.sections.overview", locale)}>
            <EntityFieldGrid>
              <EntityField label={t("requests.customer", locale)} value={
                r.customerName ? (
                  <>
                    <span className="font-medium">{r.customerName}</span>
                    {r.customerCode && <span className="ml-2 text-xs text-gray-500">{r.customerCode}</span>}
                  </>
                ) : r.customerCode ? (
                  <span className="font-mono text-xs">{r.customerCode}</span>
                ) : null
              } />
              <EntityField label={t("requests.product", locale)} value={
                r.productName ? (
                  <>
                    <span className="font-medium">{r.productName}</span>
                    {r.productCode && <span className="ml-2 text-xs text-gray-500">{r.productCode}</span>}
                  </>
                ) : r.productCode ? (
                  <span className="font-mono text-xs">{r.productCode}</span>
                ) : null
              } />
              <EntityField label={t("requests.supplier", locale)} value={
                r.partnerName ? (
                  <>
                    <span className="font-medium">{r.partnerName}</span>
                    {r.partnerCode && <span className="ml-2 text-xs text-gray-500">{r.partnerCode}</span>}
                  </>
                ) : r.partnerCode ? (
                  <span className="font-mono text-xs">{r.partnerCode}</span>
                ) : null
              } />

              <EntityField label={t("requests.displayed_price", locale)} value={
                r.displayedPrice ? `${r.displayedPrice} ${r.displayedCurrency ?? ""}` : null
              } />
              <EntityField label={t("requests.confirmed_price", locale)} value={
                r.confirmedPrice ? `${r.confirmedPrice} ${r.confirmedCurrency ?? ""}` : null
              } />
              <EntityField label={t("requests.quantity", locale)} value={r.quantity} />

              <EntityField label={t("reqflow.party_size", locale)} value={r.travelerCount ?? null} />
              <EntityField label={t("requests.service_date", locale)} value={
                r.requestedServiceDate ? fmtDate(r.requestedServiceDate) : null
              } />
              <EntityField label={t("requests.supplier_responded_date", locale)} value={
                r.supplierRespondedAt ? fmtDate(r.supplierRespondedAt) : null
              } />
            </EntityFieldGrid>
          </EntitySectionCard>          {/* Actions moved to the canonical header actions slot (UI-C7 / RequestActionBar). */}

          {/* SECONDARY: supplier / proposal / decision */}
          <EntitySectionCard title={t("requests.supplier", locale)}>
            <EntityFieldGrid>
              <EntityField label={t("requests.supplier_deadline", locale)} value={
                r.supplierResponseDeadline ? fmtTs(r.supplierResponseDeadline) : null
              } />
              <EntityField label={t("requests.supplier_responded", locale)} value={
                r.supplierRespondedAt ? fmtTs(r.supplierRespondedAt) : null
              } />
              <EntityField label={t("requests.decision", locale)} value={
                r.supplierDecision ? <StatusBadge status={r.supplierDecision} /> : null
              } />
            </EntityFieldGrid>
            {(r.supplierPriceProposal || r.supplierNote) && (
              <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
                {r.supplierPriceProposal && (
                  <EntityField label={t("requests.proposed_price", locale)} value={`${r.supplierPriceProposal} ${r.displayedCurrency ?? ""}`} />
                )}
                {r.supplierNote && (
                  <EntityField label={t("requests.supplier_note", locale)} value={r.supplierNote} />
                )}
              </div>
            )}
          </EntitySectionCard>

          <EntitySectionCard title={t("requests.customer", locale)}>
            <EntityFieldGrid>
              <EntityField label={t("requests.customer_deadline", locale)} value={
                r.customerActionDeadline ? fmtTs(r.customerActionDeadline) : null
              } />
              <EntityField label={t("reqflow.accepted_at", locale)} value={
                r.customerAcceptedAt ? fmtTs(r.customerAcceptedAt) : null
              } />
              <EntityField label={t("requests.decision", locale)} value={
                r.customerDecision ? <StatusBadge status={r.customerDecision} /> : null
              } />
            </EntityFieldGrid>
          </EntitySectionCard>

          {(r.rejectedAt || r.rejectionReason) && (
            <EntitySectionCard title={t("requests.rejection", locale)}>
              <EntityFieldGrid>
                <EntityField label={t("requests.rejection_date", locale)} value={
                  r.rejectedAt ? fmtTs(r.rejectedAt) : null
                } />
                <EntityField label={t("requests.rejected_by", locale)} value={r.rejectedBy || null} />
                <EntityField label={t("crm.col.reason", locale)} value={r.rejectionReason || null} />
              </EntityFieldGrid>
            </EntitySectionCard>
          )}
        </EntityDetailMain>

        {/* ASIDE — context column: lifecycle timeline + compact details */}
        <EntityDetailAside>
          {timeline && timeline.length > 0 && (
            <EntitySectionCard title={t("detail.sections.timeline", locale)}>
              <EntityTimeline
                items={timeline.map((item, idx) => ({ key: String(idx), label: item.label, timestamp: item.timestamp }))}
              />
            </EntitySectionCard>
          )}

          <EntitySectionCard title={t("detail.sections.details", locale)}>
            <div className="grid grid-cols-1 gap-4">
              <EntityField label={t("admin.table.col.code", locale)} value={r.code} mono />
              <EntityField label={t("detail.details.sequence", locale)} value={r.commerceSequence} mono />
              <EntityField label={t("crm.col.created", locale)} value={fmtTs(r.createdAt)} />
              <EntityField label={t("crm.col.updated", locale)} value={fmtTs(r.updatedAt)} />
            </div>
          </EntitySectionCard>
        </EntityDetailAside>

        {/* WIDE — relations lower slot: canonical Commerce Relation Chain (UI-C2) */}
        <EntityDetailWide>
          <EntitySectionCard title={t("detail.sections.relations", locale)}>
            {r.convertedOrder ? (
              <div className="space-y-4">
                {/* UI-C2: entity identity + statuses live in the shared chain; below — D5 conversion flow context */}
                <CommerceRelationChain
                  locale={locale}
                  current="request"
                  request={r}
                  order={r.convertedOrder}
                  booking={r.convertedBooking ?? null}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <ProgressBadge progress={r.convertedOrder.travelerProgress ?? null} locale={locale} />
                  {r.convertedOrder.travelerCount != null && (
                    <span className="text-xs text-gray-500">{r.convertedOrder.travelerCount} {t("reqflow.travelers", locale).toLowerCase()}</span>
                  )}
                </div>
                {r.convertedOrder.travelerProgress !== "FINAL_CONFIRMED" && (
                  <button
                    onClick={() => router.push(`/app/orders/${r.convertedOrder!.id}`)}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    {t("reqflow.continue_order", locale)} →
                  </button>
                )}
                <div className="border-t border-slate-100 pt-4">
                  <EntityFieldGrid>
                    <EntityField label={t("crm.col.created", locale)} value={
                      r.convertedOrder.createdAt ? fmtTs(r.convertedOrder.createdAt) : null
                    } />
                    {r.convertedOrder.amount && (
                      <EntityField label={t("crm.col.amount", locale)} value={`${r.convertedOrder.amount} ${r.convertedOrder.currency ?? ""}`} />
                    )}
                  </EntityFieldGrid>
                </div>
                {r.convertedPayments && r.convertedPayments.length > 0 && (
                  <div className="border-t border-slate-100 pt-4">
                    <div className="mb-2 text-xs font-medium uppercase text-slate-400">{t("crm.detail.payments", locale)}</div>
                    <div className="space-y-2">
                      {r.convertedPayments.map((p) => (
                        <EntityRow key={p.id}>
                          <span className="font-mono text-[10px] text-slate-400">{p.referenceNumber}</span>
                          <StatusBadge status={p.status} />
                          <span className="text-sm text-gray-700">{p.amount} {p.currency}</span>
                          {p.paidAt && <span className="text-xs text-green-600">{ti("requests.paid_at", locale, { date: fmtDate(p.paidAt) ?? "" })}</span>}
                        </EntityRow>
                      ))}
                    </div>
                  </div>
                )}
                {(r as any).convertedRefund && (
                  <div className="border-t border-slate-100 pt-4">
                    <div className="mb-2 text-xs font-medium uppercase text-slate-400">{t("crm.detail.refunds", locale)}</div>
                    <EntityRow>
                      <span className="font-mono text-[10px] text-slate-400">{(r as any).convertedRefund.referenceNumber}</span>
                      <StatusBadge status={(r as any).convertedRefund.status} />
                      <span className="text-sm text-gray-700">{(r as any).convertedRefund.amount} {(r as any).convertedRefund.currency}</span>
                    </EntityRow>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-400">{t("reqflow.no_linked_order", locale)}</div>
            )}
          </EntitySectionCard>
        </EntityDetailWide>

        {/* WIDE — notes (UI-C5): operational notes, below main content, above audit */}
        <EntityDetailWide>
          {user && (
            <OperationalNotes
              entityType="Request"
              entityId={id}
              permissions={user.permissions}
              currentUserId={user.id}
              currentRole={user.role}
            />
          )}
        </EntityDetailWide>

        {/* WIDE — audit: immutable change history (UI-C4, server-authoritative) */}
        <EntityDetailWide>
          <EntityAuditHistory
            items={history}
            loading={historyLoading}
            error={historyError}
            actionLabel={requestActionLabel}
          />
        </EntityDetailWide>
      </EntityDetailLayout>
    </EntityDetailShell>
  );
}