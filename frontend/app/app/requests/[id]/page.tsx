"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useLocale, t, ti, LOCALE_TAGS } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";
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
import EntityTimeline from "@/components/commerce/EntityTimeline";

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
}

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return <EntityField label={label} value={value} mono={mono} />;
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

function btn(base: string, tone: string) {
  return `rounded-lg px-3 py-1.5 text-xs font-medium ${base} ${tone}`;
}

const TONES = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
  danger: "bg-red-600 text-white hover:bg-red-700",
  neutral: "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50",
};

export default function RequestDetailPage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposePrice, setProposePrice] = useState("");
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const canEdit = useCan("order.edit_noncritical");

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

  async function runPost(path: string, body?: Record<string, unknown>) {
    setBusy(path);
    setActionMsg(null);
    try {
      await api.post(path, body ?? {});
      await loadRequest();
    } catch (err: any) {
      setActionMsg(err.message || t("requests.action_error", locale));
    } finally {
      setBusy(null);
    }
  }

  async function propose() {
    const price = Number(proposePrice);
    if (!proposePrice || !Number.isFinite(price) || price <= 0) {
      setActionMsg(t("requests.price_invalid", locale));
      return;
    }
    await runPost(`/requests/${id}/propose-price`, { price });
    setProposeOpen(false);
    setProposePrice("");
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-gray-500">{t("common.loading", locale)}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6">
        <div className="text-gray-500">{t("crm.not_found", locale)}</div>
      </div>
    );
  }

  const r = request;
  const showSupplier = canEdit && ["NEW", "CHECKING", "PRICE_CHANGED"].includes(r.status);
  const showCustomer = canEdit && ["CONFIRMED", "PRICE_CHANGED"].includes(r.status);
  const showConvert = canEdit && r.status === "CUSTOMER_ACCEPTED" && !r.convertedOrderId;
  const progress = r.convertedOrder?.travelerProgress ?? null;
  const timeline = (r as any).timeline as Array<{ label: string; timestamp: string | null }> | undefined;
  const fmtDate = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString(LOCALE_TAGS[locale]) : null);
  const fmtTs = (v: string | null | undefined) => (v ? new Date(v).toLocaleString(LOCALE_TAGS[locale]) : null);

  return (
    <EntityDetailShell
      header={
        <EntityDetailHeader
          breadcrumbs={["TravelHub", t("requests.title", locale) || "Заявки", r.referenceNumber]}
          reference={r.referenceNumber}
          secondary={r.code}
          backHref="/app/requests"
          lifecycleStatus={<StatusBadge status={r.status} />}
        />
      }
    >
      <EntityDetailLayout>
        {/* MAIN — primary + secondary business content */}
        <EntityDetailMain>
          {/* PRIMARY: Обзор заявки */}
          <EntitySectionCard title={t("detail.sections.overview", locale)}>
            <EntityFieldGrid>
              <InfoRow label={t("requests.customer", locale)} value={
                r.customerName ? (
                  <>
                    <span className="font-medium">{r.customerName}</span>
                    {r.customerCode && <span className="ml-2 text-xs text-gray-500">{r.customerCode}</span>}
                  </>
                ) : r.customerCode ? (
                  <span className="font-mono text-xs">{r.customerCode}</span>
                ) : null
              } />
              <InfoRow label={t("requests.product", locale)} value={
                r.productName ? (
                  <>
                    <span className="font-medium">{r.productName}</span>
                    {r.productCode && <span className="ml-2 text-xs text-gray-500">{r.productCode}</span>}
                  </>
                ) : r.productCode ? (
                  <span className="font-mono text-xs">{r.productCode}</span>
                ) : null
              } />
              <InfoRow label={t("requests.supplier", locale)} value={
                r.partnerName ? (
                  <>
                    <span className="font-medium">{r.partnerName}</span>
                    {r.partnerCode && <span className="ml-2 text-xs text-gray-500">{r.partnerCode}</span>}
                  </>
                ) : r.partnerCode ? (
                  <span className="font-mono text-xs">{r.partnerCode}</span>
                ) : null
              } />

              <InfoRow label={t("requests.displayed_price", locale)} value={
                r.displayedPrice ? `${r.displayedPrice} ${r.displayedCurrency ?? ""}` : null
              } />
              <InfoRow label={t("requests.confirmed_price", locale)} value={
                r.confirmedPrice ? `${r.confirmedPrice} ${r.confirmedCurrency ?? ""}` : null
              } />
              <InfoRow label={t("requests.quantity", locale)} value={r.quantity} />

              <InfoRow label={t("reqflow.party_size", locale)} value={r.travelerCount ?? null} />
              <InfoRow label={t("requests.service_date", locale)} value={
                r.requestedServiceDate ? fmtDate(r.requestedServiceDate) : null
              } />
              <InfoRow label={t("requests.supplier_responded_date", locale)} value={
                r.supplierRespondedAt ? fmtDate(r.supplierRespondedAt) : null
              } />
            </EntityFieldGrid>
          </EntitySectionCard>

          {/* Actions — business-specific flow */}
          {(showSupplier || showCustomer || showConvert) && (
            <EntitySectionCard title={t("detail.sections.actions", locale)}>
              {actionMsg && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">{actionMsg}</div>
              )}
              {showSupplier && (
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase text-gray-500">{t("reqflow.supplier_actions", locale)}</div>
                  <div className="flex flex-wrap gap-2">
                    <button disabled={busy !== null} onClick={() => runPost(`/requests/${id}/confirm-price`)} className={btn("", TONES.success)}>{busy === `/requests/${id}/confirm-price` ? t("reqflow.busy", locale) : t("reqflow.confirm_price", locale)}</button>
                    {!proposeOpen ? (
                      <button disabled={busy !== null} onClick={() => setProposeOpen(true)} className={btn("", TONES.primary)}>{t("reqflow.propose_price", locale)}</button>
                    ) : (
                      <span className="flex items-center gap-2">
                        <input
                          value={proposePrice}
                          onChange={(e) => setProposePrice(e.target.value)}
                          placeholder={t("requests.price_proposal_placeholder", locale)}
                          className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400"
                        />
                        <button onClick={() => void propose()} className={btn("", TONES.primary)}>OK</button>
                        <button onClick={() => { setProposeOpen(false); setProposePrice(""); }} className={btn("", TONES.neutral)}>✕</button>
                      </span>
                    )}
                    <button disabled={busy !== null} onClick={() => runPost(`/requests/${id}/reject`, { reason: "rejected" })} className={btn("", TONES.danger)}>{t("reqflow.reject", locale)}</button>
                    <button disabled={busy !== null} onClick={() => runPost(`/requests/${id}/unavailable`, { reason: "unavailable" })} className={btn("", TONES.neutral)}>{t("reqflow.unavailable", locale)}</button>
                  </div>
                </div>
              )}
              {showCustomer && (
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase text-gray-500">{t("reqflow.customer_actions", locale)}</div>
                  <div className="flex flex-wrap gap-2">
                    <button disabled={busy !== null} onClick={() => runPost(`/requests/${id}/customer-accept`)} className={btn("", TONES.success)}>{t("reqflow.customer_accept", locale)}</button>
                    <button disabled={busy !== null} onClick={() => runPost(`/requests/${id}/customer-decline`)} className={btn("", TONES.danger)}>{t("reqflow.customer_decline", locale)}</button>
                  </div>
                </div>
              )}
              {showConvert && (
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase text-slate-400">{t("reqflow.converted_hint", locale)}</div>
                  <button disabled={busy !== null} onClick={() => runPost(`/requests/${id}/convert`)} className={btn("", TONES.primary)}>
                    {busy === `/requests/${id}/convert` ? t("reqflow.busy", locale) : t("reqflow.convert_action", locale)}
                  </button>
                </div>
              )}
            </EntitySectionCard>
          )}

          {/* SECONDARY: supplier / proposal / decision */}
          <EntitySectionCard title={t("requests.supplier", locale)}>
            <EntityFieldGrid>
              <InfoRow label={t("requests.supplier_deadline", locale)} value={
                r.supplierResponseDeadline ? fmtTs(r.supplierResponseDeadline) : null
              } />
              <InfoRow label={t("requests.supplier_responded", locale)} value={
                r.supplierRespondedAt ? fmtTs(r.supplierRespondedAt) : null
              } />
              <InfoRow label={t("requests.decision", locale)} value={
                r.supplierDecision ? <StatusBadge status={r.supplierDecision} /> : null
              } />
            </EntityFieldGrid>
            {(r.supplierPriceProposal || r.supplierNote) && (
              <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
                {r.supplierPriceProposal && (
                  <InfoRow label={t("requests.proposed_price", locale)} value={`${r.supplierPriceProposal} ${r.displayedCurrency ?? ""}`} />
                )}
                {r.supplierNote && (
                  <InfoRow label={t("requests.supplier_note", locale)} value={r.supplierNote} />
                )}
              </div>
            )}
          </EntitySectionCard>

          <EntitySectionCard title={t("requests.customer", locale)}>
            <EntityFieldGrid>
              <InfoRow label={t("requests.customer_deadline", locale)} value={
                r.customerActionDeadline ? fmtTs(r.customerActionDeadline) : null
              } />
              <InfoRow label={t("reqflow.accepted_at", locale)} value={
                r.customerAcceptedAt ? fmtTs(r.customerAcceptedAt) : null
              } />
              <InfoRow label={t("requests.decision", locale)} value={
                r.customerDecision ? <StatusBadge status={r.customerDecision} /> : null
              } />
            </EntityFieldGrid>
          </EntitySectionCard>

          {(r.rejectedAt || r.rejectionReason) && (
            <EntitySectionCard title={t("requests.rejection", locale)}>
              <EntityFieldGrid>
                <InfoRow label={t("requests.rejection_date", locale)} value={
                  r.rejectedAt ? fmtTs(r.rejectedAt) : null
                } />
                <InfoRow label={t("requests.rejected_by", locale)} value={r.rejectedBy || null} />
                <InfoRow label={t("crm.col.reason", locale)} value={r.rejectionReason || null} />
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
              <InfoRow label={t("admin.table.col.code", locale)} value={r.code} mono />
              <InfoRow label={t("detail.details.sequence", locale)} value={r.commerceSequence} mono />
              <InfoRow label={t("crm.col.created", locale)} value={fmtTs(r.createdAt)} />
              <InfoRow label={t("crm.col.updated", locale)} value={fmtTs(r.updatedAt)} />
            </div>
          </EntitySectionCard>
        </EntityDetailAside>

        {/* WIDE — relations lower slot (UI-C2 not started) */}
        <EntityDetailWide>
          <EntitySectionCard title={t("detail.sections.relations", locale)}>
            {r.convertedOrder ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <EntityLink
                    href={`/app/orders/${r.convertedOrder!.id}`}
                    className="font-mono text-xs font-semibold"
                  >
                    {r.convertedOrder.referenceNumber}
                  </EntityLink>
                  <ProgressBadge progress={r.convertedOrder.travelerProgress ?? null} locale={locale} />
                  {r.convertedOrder.travelerCount != null && (
                    <span className="text-xs text-gray-500">{r.convertedOrder.travelerCount} {t("reqflow.travelers", locale).toLowerCase()}</span>
                  )}
                </div>
                {r.convertedOrder.travelerProgress !== "FINAL_CONFIRMED" && (
                  <button
                    onClick={() => router.push(`/app/orders/${r.convertedOrder!.id}`)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${TONES.primary}`}
                  >
                    {t("reqflow.continue_order", locale)} →
                  </button>
                )}
                <div className="border-t border-slate-100 pt-4">
                  <EntityFieldGrid>
                    <InfoRow label={t("crm.col.created", locale)} value={
                      r.convertedOrder.createdAt ? fmtTs(r.convertedOrder.createdAt) : null
                    } />
                    <InfoRow label={t("detail.relation.order_status", locale)} value={<StatusBadge status={r.convertedOrder.status} />} />
                    {r.convertedOrder.amount && (
                      <InfoRow label={t("crm.col.amount", locale)} value={`${r.convertedOrder.amount} ${r.convertedOrder.currency ?? ""}`} />
                    )}
                  </EntityFieldGrid>
                </div>
                {r.convertedBooking && (
                  <div className="border-t border-slate-100 pt-4">
                    <EntityFieldGrid>
                      <InfoRow label={t("detail.relation.booking", locale)} value={
                        <EntityLink
                          href={`/app/bookings/${r.convertedBooking.id}`}
                          className="font-mono text-xs"
                        >
                          {r.convertedBooking.referenceNumber}
                        </EntityLink>
                      } />
                      <InfoRow label={t("detail.relation.booking_status", locale)} value={<StatusBadge status={r.convertedBooking.status} />} />
                    </EntityFieldGrid>
                  </div>
                )}
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
      </EntityDetailLayout>
    </EntityDetailShell>
  );
}