/**
 * UI-C1.2D — Bookings KPI overview scope helper.
 *
 * Requests is the KPI-click behavioral reference: a clicked BookingStatus KPI
 * card becomes SELECTED and filters the TABLE ONLY; the other 12 KPI cards
 * stay static within the current overview (global registry) scope and are
 * never re-scoped by the active KPI-card dimension.
 *
 * The Booking registry has exactly ONE KPI-card dimension — `status`
 * (BookingStatus). This helper derives the OVERVIEW aggregate scope from the
 * full table `where` by dropping only that dimension while retaining every
 * global registry scope dimension (search, period/dates, channel scope,
 * upcoming/overdue detector temporal predicates, orderId).
 *
 * Detector semantics (upcoming/overdue) are preserved for the overview by
 * construction in booking.service.ts: detector status predicates are composed
 * with the explicit KPI status filter inside the AND/status layer that this
 * helper strips, while the detector temporal predicates (serviceDate /
 * createdAt thresholds) are expressed as separate top-level keys that the
 * overview keeps.
 */
import { Prisma } from "../../generated/prisma/client";

/** True when a where clause entry is a BookingStatus-dimension predicate. */
function isStatusPredicate(entry: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(entry, "status");
}

export function overviewBookingWhere(where: Prisma.BookingWhereInput): Prisma.BookingWhereInput {
  const overview: Prisma.BookingWhereInput = { ...where };
  delete (overview as { status?: unknown }).status;
  if (Array.isArray(overview.AND)) {
    const merged: Prisma.BookingWhereInput[] = [];
    for (const clause of overview.AND) {
      const obj = clause as Prisma.BookingWhereInput;
      if (isStatusPredicate(obj as unknown as Record<string, unknown>)) continue;
      merged.push(obj);
    }
    if (merged.length === 0) delete overview.AND;
    else if (merged.length === 1) overview.AND = merged[0];
    else overview.AND = merged;
  }
  return overview;
}
