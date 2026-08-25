/**
 * Stage F — Evidence-Based Action Derivation Service
 *
 * Derives available actions from DecisionSignal evidence + entity state.
 * Derived-on-read: same inputs → same actions (deterministic).
 * No persistence needed for action definitions (unlike executed actions).
 *
 * SAFETY:
 * - Navigation-only actions by default (no server mutations)
 * - Mutating actions only with proven safe command
 * - No fabricated financial claims
 * - No LLM-generated actions
 * - No opaque priority scoring
 *
 * ROUND 5 FIX: All destination filters now match detector predicates exactly.
 */

import { Injectable } from "@nestjs/common";
import type {
  ActionDefinition,
  ActionTarget,
  SignalActionMatrix,
} from "./action-contract.types";

// ── Per-Signal Action Derivation ────────────────────────────────────────────

/**
 * BOOKING_CONFIRMATION_DELAY detector:
 *   status = AWAITING_CONFIRMATION AND createdAt < (now - SLA minutes)
 *
 * Destination MUST match: bookings awaiting confirmation beyond SLA.
 */
function deriveBookingDelayActions(
  signalCode: string,
  evidence: Array<{ key: string; value: string | number }>,
): ActionDefinition[] {
  const slaMinutes = evidence.find((e) => e.key === "slaThresholdMinutes");
  const sla = slaMinutes ? Number(slaMinutes.value) : 240;

  return [
    {
      actionCode: "OPEN_DELAYED_BOOKINGS",
      signalCode,
      titleKey: "cc.action.openDelayedBookings",
      descriptionKey: "cc.action.openDelayedBookings.desc",
      actionType: "NAVIGATE",
      target: {
        type: "BOOKING",
        route: "/app/bookings",
        filters: { status: "AWAITING_CONFIRMATION", overdue: "true", slaMinutes: String(sla) },
      },
      requiredPermission: "booking.read",
      executionMode: "NAVIGATION_ONLY",
      confirmationRequired: false,
      eligible: true,
    },
  ];
}

/**
 * FAILED_PAYMENTS detector:
 *   Payment.status = FAILED
 *
 * Destination MUST map failed payments to affected orders.
 * Orders page can filter by orders that have at least one FAILED payment.
 */
function deriveFailedPaymentActions(
  signalCode: string,
  _evidence: Array<{ key: string; value: string | number }>,
): ActionDefinition[] {
  return [
    {
      actionCode: "OPEN_FAILED_PAYMENTS",
      signalCode,
      titleKey: "cc.action.openFailedPayments",
      descriptionKey: "cc.action.openFailedPayments.desc",
      actionType: "NAVIGATE",
      target: {
        type: "ORDER",
        route: "/app/orders",
        filters: { paymentFailed: "true" },
      },
      requiredPermission: "finance.payment.read",
      executionMode: "NAVIGATION_ONLY",
      confirmationRequired: false,
      eligible: true,
    },
  ];
}

/**
 * RECENT_CANCELLATIONS detector:
 *   Order.status = CANCELLED AND Order.createdAt > (now - 7 days)
 *
 * Destination MUST preserve the 7-day time window.
 */
function deriveCancellationActions(
  signalCode: string,
  evidence: Array<{ key: string; value: string | number }>,
): ActionDefinition[] {
  const periodDays = evidence.find((e) => e.key === "periodDays");
  const days = periodDays ? Number(periodDays.value) : 7;

  return [
    {
      actionCode: "OPEN_CANCELLED_ORDERS",
      signalCode,
      titleKey: "cc.action.openCancelledOrders",
      descriptionKey: "cc.action.openCancelledOrders.desc",
      actionType: "NAVIGATE",
      target: {
        type: "ORDER",
        route: "/app/orders",
        filters: { status: "CANCELLED", cancelledWithin: String(days) },
      },
      requiredPermission: "order.read",
      executionMode: "NAVIGATION_ONLY",
      confirmationRequired: false,
      eligible: true,
    },
  ];
}

/**
 * PENDING_REFUNDS detector:
 *   Refund.status = REQUESTED
 *
 * Destination MUST map pending refunds to affected orders.
 * Orders page can filter by orders that have at least one REQUESTED refund.
 */
function derivePendingRefundActions(
  signalCode: string,
  _evidence: Array<{ key: string; value: string | number }>,
): ActionDefinition[] {
  return [
    {
      actionCode: "OPEN_PENDING_REFUNDS",
      signalCode,
      titleKey: "cc.action.openPendingRefunds",
      descriptionKey: "cc.action.openPendingRefunds.desc",
      actionType: "NAVIGATE",
      target: {
        type: "ORDER",
        route: "/app/orders",
        filters: { pendingRefund: "true" },
      },
      requiredPermission: "finance.refund.read",
      executionMode: "NAVIGATION_ONLY",
      confirmationRequired: false,
      eligible: true,
    },
  ];
}

/**
 * UPCOMING_BOOKINGS detector:
 *   Booking.status IN (CONFIRMED, NEW) AND Booking.serviceDate > now()
 *
 * Destination MUST filter by same status set AND future serviceDate.
 */
function deriveUpcomingBookingActions(
  signalCode: string,
  _evidence: Array<{ key: string; value: string | number }>,
): ActionDefinition[] {
  return [
    {
      actionCode: "OPEN_UPCOMING_BOOKINGS",
      signalCode,
      titleKey: "cc.action.openUpcomingBookings",
      descriptionKey: "cc.action.openUpcomingBookings.desc",
      actionType: "NAVIGATE",
      target: {
        type: "BOOKING",
        route: "/app/bookings",
        filters: { upcoming: "true" },
      },
      requiredPermission: "booking.read",
      executionMode: "NAVIGATION_ONLY",
      confirmationRequired: false,
      eligible: true,
    },
  ];
}

/**
 * SERVICES_WITHOUT_SALES detector:
 *   Product.status = PUBLISHED AND NOT EXISTS (OrderItem WHERE productId = Product.id)
 *
 * Two actions:
 * 1. OPEN_UNSOLD_SERVICES — show PUBLISHED products without any orders
 * 2. REVIEW_AVAILABILITY — show PUBLISHED products without availability configured
 *
 * These are independent predicates even if they happen to return similar sets.
 */
function deriveServicesWithoutSalesActions(
  signalCode: string,
  evidence: Array<{ key: string; value: string | number }>,
): ActionDefinition[] {
  const withoutAvail = evidence.find((e) => e.key === "withoutAvailabilityCount");
  const noAvailCount = withoutAvail ? Number(withoutAvail.value) : 0;

  const actions: ActionDefinition[] = [
    {
      actionCode: "OPEN_UNSOLD_SERVICES",
      signalCode,
      titleKey: "cc.action.openUnsoldServices",
      descriptionKey: "cc.action.openUnsoldServices.desc",
      actionType: "NAVIGATE",
      target: {
        type: "PRODUCT",
        route: "/app/catalog",
        filters: { status: "PUBLISHED", unsold: "true" },
      },
      requiredPermission: "catalog.product.read",
      executionMode: "NAVIGATION_ONLY",
      confirmationRequired: false,
      eligible: true,
    },
  ];

  // If services have no availability, suggest reviewing availability
  if (noAvailCount > 0) {
    actions.push({
      actionCode: "REVIEW_AVAILABILITY",
      signalCode,
      titleKey: "cc.action.reviewAvailability",
      descriptionKey: "cc.action.reviewAvailability.desc",
      params: { count: noAvailCount },
      actionType: "REVIEW",
      target: {
        type: "PRODUCT",
        route: "/app/catalog",
        filters: { status: "PUBLISHED", availability: "missing" },
      },
      requiredPermission: "catalog.availability.write",
      executionMode: "NAVIGATION_ONLY",
      confirmationRequired: false,
      eligible: true,
    });
  }

  return actions;
}

// ── Main Service ────────────────────────────────────────────────────────────

@Injectable()
export class ActionDerivationService {
  private readonly derivors = new Map<
    string,
    (signalCode: string, evidence: Array<{ key: string; value: string | number }>) => ActionDefinition[]
  >();

  constructor() {
    this.derivors.set("BOOKING_CONFIRMATION_DELAY", deriveBookingDelayActions);
    this.derivors.set("FAILED_PAYMENTS", deriveFailedPaymentActions);
    this.derivors.set("RECENT_CANCELLATIONS", deriveCancellationActions);
    this.derivors.set("PENDING_REFUNDS", derivePendingRefundActions);
    this.derivors.set("UPCOMING_BOOKINGS", deriveUpcomingBookingActions);
    this.derivors.set("SERVICES_WITHOUT_SALES", deriveServicesWithoutSalesActions);
  }

  /**
   * Derive available actions for a given signal.
   * Returns empty array if signal code has no registered derivor.
   */
  deriveActions(
    signalCode: string,
    evidence: Array<{ key: string; value: string | number }>,
    userPermissions: string[],
  ): ActionDefinition[] {
    const derivor = this.derivors.get(signalCode);
    if (!derivor) return [];

    try {
      const actions = derivor(signalCode, evidence);
      // Filter by user permissions
      return actions.filter((a) => userPermissions.includes(a.requiredPermission));
    } catch {
      // Failure isolation: one signal's action derivation doesn't break others
      return [];
    }
  }

  /**
   * Check if a signal code has registered action derivations.
   */
  hasDerivations(signalCode: string): boolean {
    return this.derivors.has(signalCode);
  }
}
