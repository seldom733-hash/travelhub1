/**
 * PHASE 2 STEP 2.12A — Provider-operation idempotency identity.
 *
 * Even without the external HTTP Idempotency-Key contract (Step 2.12H) and
 * before provider execution (Step 2.12B), the abstraction defines STABLE
 * internal provider-operation identity:
 *  - server-derived (from TravelHub Payment aggregate identity);
 *  - stable across safe retry (NOT random per retry);
 *  - scoped to operation + TravelHub Payment;
 *  - not client-forgeable (client never supplies it);
 *  - future adapters can map it to provider-specific idempotency header/key;
 *  - divergent operation parameters are DETECTABLE at contract level.
 *
 * NO persistence in 2.12A. The external Idempotency-Key storage authority
 * belongs to Step 2.12H; provider-execution dedup/DB invariants to 2.12B.
 */
import { ConflictError } from "../../../shared/errors";
import type { PaymentProviderOperation } from "./provider.types";

export interface ProviderOperationRef {
  readonly paymentId: string;
  readonly paymentCode: string;
  readonly operation: PaymentProviderOperation;
}

/**
 * Deterministic provider-operation key: `PAY-<code>:<operation>`.
 * Same ref → same key (idempotency identity stability). Never random.
 */
export function deriveProviderOperationKey(ref: ProviderOperationRef): string {
  return `${ref.paymentCode}:${ref.operation}`;
}

/**
 * Frozen operation parameters used for divergence detection at the abstraction
 * contract level. Amount/currency come from the frozen Order snapshot
 * verbatim (money authority — never mutable Catalog/FX/frontend).
 */
export interface ProviderOperationParams {
  readonly amount: string;
  readonly currency: string;
}

/**
 * Divergence check: an identical provider-operation retry must carry identical
 * params. Divergent params → controlled ConflictError (detectable mismatch),
 * NOT silent acceptance and NOT raw 500.
 */
export function assertProviderOperationParamsConsistent(
  recorded: ProviderOperationParams | null | undefined,
  incoming: ProviderOperationParams,
): void {
  if (recorded === null || recorded === undefined) return;
  if (recorded.amount !== incoming.amount || recorded.currency !== incoming.currency) {
    throw new ConflictError(
      `Provider operation params diverge from recorded params (amount/currency mismatch)`,
    );
  }
}
