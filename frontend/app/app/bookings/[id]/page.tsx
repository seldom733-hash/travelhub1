"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import BookingActionBar from "@/components/booking/BookingActionBar";
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
import EntityAuditHistory from "@/components/commerce/EntityAuditHistory";
import CommerceRelationChain from "@/components/commerce/CommerceRelationChain";
import OperationalNotes from "@/components/OperationalNotes";
import { useLocale, t, formatPrice, LOCALE_TAGS, type Locale } from "@/lib/i18n";
import { bookingActionLabel } from "@/lib/commerce-history-labels";
import { useCurrentUser } from "@/lib/use-user";

interface BookingDetail {
  id: string;
  code: string;
  referenceNumber: string;
  commerceSequence: string | null;
  orderId: string;
  productId: string;
  status: string;
  amount: string;
  currency: string | null;
  serviceDate: string | null;
  serviceTimeType: string;
  serviceTime: string | null;
  serviceEndTime: string | null;
  acquisitionSource: string | null;
  orderCode: string;
  productTitle: string | null;
  requestedAt: string | null;
  confirmedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  availableActions?: string[];
  financialSummary?: FinancialSummaryView | null;
  activePayment?: ActivePaymentView | null;
  passengers?: PassengerRow[];
  supplierConfirmations?: SupplierConfirmationRow[];
  reservations?: Array<{
    id: string;
    status: string;
    heldAt?: string;
    confirmedAt?: string;
  }>;
  orderReference?: string | null;
  linkedOrder?: { id: string; referenceNumber: string; status: string } | null;
  linkedRequest?: { id: string; referenceNumber: string; status: string } | null;
}

// UI-C9 §11: narrow frontend views of server-provided finance objects (D7) —
// presentation typing only, no runtime/business change.
interface FinancialSummaryView {
  totalAmount?: string;
  paidAmount?: string;
  refundedAmount?: string;
  dueAmount?: string;
  refundableAmount?: string;
  currency?: string | null;
  paymentStatus?: string;
}

interface ActivePaymentView {
  paymentMethod?: string | null;
  status?: string;
}

interface PassengerRow {
  id: string;
  firstName: string;
  lastName: string;
  passportNumber?: string | null;
  dataCompleteness?: string;
}

interface SupplierConfirmationRow {
  id: string;
  receivedAt: string;
  rawPayload?: string;
}

interface HistoryRow {
  id: string;
  action: string;
  from: string | null;
  to: string | null;
  actorName: string | null;
  comment: string | null;
  createdAt: string;
}

// Business timeline — NOT audit history (milestones vs immutable who-what-when).
function buildMilestones(b: BookingDetail, locale: Locale): Array<{ key: string; label: string; timestamp: string | null }> {
  return [
    { key: "created", label: t("booking.milestone.created", locale), timestamp: b.createdAt },
    { key: "requestedAt", label: t("booking.milestone.requested", locale), timestamp: b.requestedAt },
    { key: "confirmedAt", label: t("booking.milestone.confirmed", locale), timestamp: b.confirmedAt },
    { key: "completedAt", label: t("booking.milestone.completed", locale), timestamp: b.completedAt },
    { key: "cancelledAt", label: t("booking.milestone.cancelled", locale), timestamp: b.cancelledAt },
    { key: "rejectedAt", label: t("booking.milestone.rejected", locale), timestamp: b.rejectedAt },
  ];
}

export default function BookingDetailPage() {
  const params = useParams();
  const locale = useLocale();
  const user = useCurrentUser();
  const id = params.id as string;

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadBooking = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const detail = await api.get<BookingDetail>(`/bookings/${id}`);
      setBooking(detail);
      // Load history (non-blocking — audit must not break the page)
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const hist = await api.get<{ items: HistoryRow[] }>(`/bookings/${id}/history`);
        setHistory(hist.items ?? []);
      } catch (e) {
        setHistoryError((e as Error).message ?? null);
      } finally {
        setHistoryLoading(false);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadBooking(); }, [loadBooking]);

  // UI-C9: action errors surface in an inline header banner — the page content
  // and its centered load/not-found state remain untouched.
  const executeAction = useCallback(async (action: string) => {
    if (!booking) return;
    setExecuting(action);
    setActionError(null);
    try {
      await api.patch(`/bookings/${booking.id}`, { action });
      await loadBooking();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setExecuting(null);
    }
  }, [booking, loadBooking]);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="text-sm text-slate-400">{t("crm.loading", locale)}</div></div>;
  }

  if (error || !booking) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-sm text-red-500">{error || t("crm.not_found", locale)}</div>
        <Link href="/app/bookings" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">← {t("crm.back_to_list", locale)}</Link>
      </div>
    );
  }

  const milestones = buildMilestones(booking, locale);
  const financialSummary = booking.financialSummary ?? null;
  const activePayment = booking.activePayment ?? null;
  const fmtTs = (v: string | null | undefined) => (v ? new Date(v).toLocaleString(LOCALE_TAGS[locale]) : null);

  return (
    <EntityDetailShell
      header={
        <EntityDetailHeader
          breadcrumbs={["TravelHub", t("bookings.title", locale), booking.referenceNumber]}
          reference={booking.referenceNumber}
          secondary={booking.code}
          backHref="/app/bookings"
          lifecycleStatus={<StatusBadge status={booking.status} />}
          actions={
            <BookingActionBar
              actions={booking.availableActions ?? []}
              onRun={(a) => void executeAction(a)}
              busyAction={executing}
            />
          }
        >
          {actionError && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{actionError}</div>}
        </EntityDetailHeader>
      }
    >
      <EntityDetailLayout>
        {/* MAIN — primary + secondary business content */}
        <EntityDetailMain>
          {/* PRIMARY: Услуга / Обзор бронирования */}
          <EntitySectionCard title={t("bookings.service", locale)}>
            <EntityFieldGrid>
              <EntityField label={t("crm.col.order", locale)} value={
                <EntityLink href={`/app/orders/${booking.orderId}`} className="font-mono text-xs">
                  {booking.orderReference ?? booking.orderCode ?? booking.orderId.slice(0, 8)}
                </EntityLink>
              } />
              <EntityField label={t("crm.col.service", locale)} value={
                <EntityLink href={`/app/catalog/${booking.productId}`} className="font-mono text-xs">
                  {booking.productTitle ?? booking.productId.slice(0, 8)}
                </EntityLink>
              } />
              {/* Service date is a service attribute — lives in Service, not Finance */}
              <EntityField label={t("crm.detail.service_date", locale)} value={fmtTs(booking.serviceDate)} />
              {booking.acquisitionSource && (
                <EntityField label={t("bookings.acquisition_source", locale)} value={booking.acquisitionSource} />
              )}
            </EntityFieldGrid>
          </EntitySectionCard>

          {/* SECONDARY: Finance — D7 linked Order finance authority; money/payment cells only */}
          <EntitySectionCard title={t("bookings.financial", locale)}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <EntityFinanceCell label={t("crm.detail.total_amount", locale)} value={formatPrice(booking.amount, booking.currency, locale)} tone="neutral" />
              {financialSummary && (
                <>
                  <EntityFinanceCell label={t("crm.detail.paid_amount", locale)} value={formatPrice(financialSummary.paidAmount, financialSummary.currency, locale)} tone="positive" />
                  <EntityFinanceCell label={t("finance.due_amount", locale)} value={formatPrice(financialSummary.dueAmount, financialSummary.currency, locale)} tone="warning" />
                  <EntityFinanceCell label={t("crm.detail.refunded_amount", locale)} value={formatPrice(financialSummary.refundedAmount, financialSummary.currency, locale)} tone="negative" />
                  <EntityFinanceCell label={t("finance.refundable_amount", locale)} value={formatPrice(financialSummary.refundableAmount, financialSummary.currency, locale)} tone="info" />
                  <EntityFinanceCell label={t("crm.detail.payment_status", locale)} value={<StatusBadge status={financialSummary.paymentStatus ?? ""} />} tone="neutral" />
                </>
              )}
            </div>
            {activePayment && (
              <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>{t("finance.payment_method", locale)}: {activePayment.paymentMethod ?? "—"}</span>
                <span>{t("crm.detail.payment_status", locale)}: <StatusBadge status={activePayment.status ?? ""} /></span>
              </div>
            )}
          </EntitySectionCard>

          {booking.passengers && booking.passengers.length > 0 && (
            <EntitySectionCard title={t("bookings.passengers", locale)}>
              <div className="space-y-2">
                {booking.passengers.map((p, i) => (
                  <EntityRow key={p.id}>
                    <span className="font-medium text-slate-700">{i + 1}.</span>
                    <span className="text-slate-700">{p.firstName} {p.lastName}</span>
                    {p.passportNumber && <span className="text-slate-400">••••{p.passportNumber.slice(-4)}</span>}
                    {p.dataCompleteness && <StatusBadge status={p.dataCompleteness === "COMPLETE" ? "CONFIRMED" : "WAITING_FOR_DATA"} />}
                  </EntityRow>
                ))}
              </div>
            </EntitySectionCard>
          )}

          {booking.supplierConfirmations && booking.supplierConfirmations.length > 0 && (
            <EntitySectionCard title={t("bookings.supplier_confirmations", locale)}>
              <div className="space-y-2">
                {booking.supplierConfirmations.map(sc => (
                  <EntityRow key={sc.id}>
                    <span className="text-slate-500">{fmtTs(sc.receivedAt)}</span>
                    {sc.rawPayload && <span className="truncate text-slate-400">{sc.rawPayload.slice(0, 120)}</span>}
                  </EntityRow>
                ))}
              </div>
            </EntitySectionCard>
          )}
        </EntityDetailMain>

        {/* ASIDE — context column: lifecycle timeline + compact details */}
        <EntityDetailAside>
          <EntitySectionCard title={t("detail.sections.timeline", locale)}>
            <EntityTimeline items={milestones} />
          </EntitySectionCard>

          <EntitySectionCard title={t("detail.sections.details", locale)}>
            <div className="grid grid-cols-1 gap-4">
              <EntityField label={t("admin.table.col.code", locale)} value={booking.code} mono />
              <EntityField label={t("crm.col.created", locale)} value={fmtTs(booking.createdAt)} />
              <EntityField label={t("crm.col.updated", locale)} value={fmtTs(booking.updatedAt)} />
              {booking.commerceSequence && (
                <EntityField label={t("detail.details.sequence", locale)} value={booking.commerceSequence} mono />
              )}
            </div>
          </EntitySectionCard>
        </EntityDetailAside>

        {/* WIDE — relations: canonical Commerce Relation Chain (UI-C2) */}
        <EntityDetailWide>
          <EntitySectionCard title={t("detail.sections.relations", locale)}>
            <CommerceRelationChain
              locale={locale}
              current="booking"
              request={booking.linkedRequest ?? null}
              order={booking.linkedOrder ?? null}
              booking={booking}
            />
          </EntitySectionCard>
        </EntityDetailWide>

        {/* WIDE — notes */}
        <EntityDetailWide>
          {user && (
            <OperationalNotes
              entityType="Booking"
              entityId={id}
              permissions={user.permissions}
              currentUserId={user.id}
              currentRole={user.role}
            />
          )}
        </EntityDetailWide>

        {/* WIDE — audit: immutable change history (UI-C4 shared presentation) */}
        <EntityDetailWide>
          <EntityAuditHistory
            items={history}
            loading={historyLoading}
            error={historyError}
            actionLabel={bookingActionLabel}
          />
        </EntityDetailWide>
      </EntityDetailLayout>
    </EntityDetailShell>
  );
}