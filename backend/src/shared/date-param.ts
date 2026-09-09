import { BadRequestException } from "@nestjs/common";

/**
 * D8 (B-06) — canonical registry query-param date validation.
 *
 * Contract (Final Correction Pass C2, Option A — accepted):
 *   malformed dateFrom/dateTo → BadRequestException → HTTP 400
 *   response shape: { statusCode: 400, message: "<paramName> must be a valid date", requestId? }
 *   (X-Request-Id header added by AppExceptionFilter as usual)
 *
 * Rules:
 *   - absent/empty param  → undefined (no filter)
 *   - valid value         → Date (only "YYYY-MM-DD" → UTC midnight)
 *   - unparseable value   → BadRequestException (400), never a silent `Invalid Date`
 *
 * dateFrom and dateTo are validated INDEPENDENTLY (call once per param, before
 * any Prisma where construction). One helper for all registry query-param date
 * filters — no second competing validation mechanism.
 *
 * Boundary (D8 MUST #2 / §7): this helper is for registry QUERY-PARAM date
 * filters only. It does NOT change the Finance ValidationDomainError (422)
 * contract for submitted financial payloads (e.g. LedgerTransaction.occurredAt).
 */
export function parseDateParam(value: string | undefined, paramName: string): Date | undefined {
  if (!value) return undefined;
  // Registry periods are date-only. `new Date(value)` is deliberately not used
  // as the validator: it accepts timestamps and silently normalizes impossible
  // calendar dates (for example, 2026-02-30). Both violate the D8 contract.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`${paramName} must be a valid date`);
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${paramName} must be a valid date`);
  }
  return d;
}
