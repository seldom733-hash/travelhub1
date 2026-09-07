"use client";

import StatusBadge from "@/components/StatusBadge";
import EntityLink from "@/components/commerce/EntityLink";
import { t, type Locale } from "@/lib/i18n";

/**
 * UI-C2 — Commerce Relation Chain (Request → Order → Booking).
 *
 * ONE business relation model → ONE UI relation chain. This component is a pure
 * presentation/navigation consumer: it never derives relation existence, computes
 * statuses, or invents lifecycle transitions. Nodes are fed from server-authoritative
 * detail DTOs (backend relation fields), so relation truth stays in the domain layer.
 *
 * Semantics:
 *  - The chain shows which commerce entities are RELATED (relation indicator only).
 *  - It is NOT a business timeline and NOT audit history.
 *  - Arrows are relation indicators — never a claim of a lifecycle transition.
 *  - An absent slot means "not created / not linked"; it is rendered muted and is
 *    never derived from a status.
 *
 * A11y:
 *  - Real links to canonical detail routes (no clickable divs).
 *  - Statuses render only through the canonical <StatusBadge>.
 *  - Current entity is announced via aria-current + a localized visible chip.
 */

export type RelationEntity = {
  id: string;
  referenceNumber: string;
  status: string;
};

export type RelationChainKind = "request" | "order" | "booking";

const KIND_META: Record<
  RelationChainKind,
  { labelKey: string; routePrefix: string; absentKey: string }
> = {
  request: {
    labelKey: "detail.relation.request",
    routePrefix: "/app/requests",
    absentKey: "detail.relation.no_request",
  },
  order: {
    labelKey: "detail.relation.order",
    routePrefix: "/app/orders",
    absentKey: "detail.relation.no_order",
  },
  booking: {
    labelKey: "detail.relation.booking",
    routePrefix: "/app/bookings",
    absentKey: "detail.relation.no_booking",
  },
};

export default function CommerceRelationChain({
  locale,
  current,
  request,
  order,
  booking,
  className,
}: {
  locale: Locale;
  current: RelationChainKind;
  request?: RelationEntity | null;
  order?: RelationEntity | null;
  booking?: RelationEntity | null;
  className?: string;
}) {
  const slots: Array<{ kind: RelationChainKind; entity?: RelationEntity | null }> = [
    { kind: "request", entity: request },
    { kind: "order", entity: order },
    { kind: "booking", entity: booking },
  ];

  return (
    <div
      className={`flex flex-col gap-1.5 md:flex-row md:items-stretch md:gap-0 ${className ?? ""}`}
    >
      {slots.map((slot, i) => {
        const meta = KIND_META[slot.kind];
        const isCurrent = slot.kind === current;
        const entity = slot.entity ?? null;
        return (
          <div key={slot.kind} className="contents">
            {i > 0 && (
              <span
                aria-hidden
                className="select-none self-center px-1 text-lg font-light text-slate-300"
              >
                <span className="md:hidden">↓</span>
                <span className="hidden md:inline">→</span>
              </span>
            )}
            <div
              aria-current={isCurrent ? "true" : undefined}
              className={`flex-1 min-w-0 rounded-xl border p-3 ${
                isCurrent
                  ? "border-blue-400 bg-blue-50/60 ring-1 ring-blue-200"
                  : entity
                    ? "border-slate-200 bg-white"
                    : "border-dashed border-slate-300 bg-slate-50"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {t(meta.labelKey, locale)}
                </span>
                {isCurrent && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                    {t("detail.chain.current", locale)}
                  </span>
                )}
              </div>
              {entity ? (
                <div className="flex flex-col items-start gap-1.5">
                  <EntityLink
                    href={`${meta.routePrefix}/${entity.id}`}
                    className="font-mono text-xs font-semibold"
                  >
                    {entity.referenceNumber}
                  </EntityLink>
                  <StatusBadge status={entity.status} />
                </div>
              ) : (
                <div className="text-xs text-slate-400">{t(meta.absentKey, locale)}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
