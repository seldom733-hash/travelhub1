/**
 * UI-C1.2C REMEDIATION R1 — Orders KPI overview scope helper.
 *
 * Requests is the KPI-click behavioral reference: a clicked KPI card becomes
 * SELECTED and filters the TABLE ONLY; the other KPI cards stay static within
 * the current overview (global) scope and never get re-scoped by the active
 * KPI-card dimension.
 *
 * For Orders the two KPI-card dimensions are `status` (lifecycle) and
 * `paymentStatus` (payment). This helper derives the OVERVIEW aggregate scope
 * from the full table `where` by dropping exactly those two dimensions —
 * global registry scope dimensions (search, period/dates, detector scope,
 * customerId, acquisitionSource/tenant) legitimately still scope the overview.
 */
import { Prisma } from "../../generated/prisma/client";

export function overviewOrderWhere(where: Prisma.OrderWhereInput): Prisma.OrderWhereInput {
  const overview: Prisma.OrderWhereInput = { ...where };
  delete (overview as { status?: unknown }).status;
  delete (overview as { paymentStatus?: unknown }).paymentStatus;
  return overview;
}
