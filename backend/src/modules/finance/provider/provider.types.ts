/**
 * PHASE 2 STEP 2.12A — Payment Provider Abstraction — canonical types.
 *
 * Provider-neutral, NO real network, no webhooks, no SPLIT_AT_PAYMENT, no
 * Ledger/ProviderFee/Settlement/Payout/Invoice runtime (boundaries per
 * reconciliation 2026-08-15 and hardened 2.12A prompt).
 *
 * Ownership: the abstraction owns provider identity, capability discovery,
 * request/result/error normalization and provider-operation identity. It does
 * NOT own the canonical Payment business lifecycle (PaymentService), nor
 * Commission/Refund/Dispute/Ledger/Settlement/Payout/Invoice.
 */

/**
 * Production-known provider codes. EMPTY: no production PSP has been selected
 * yet (reconciliation-verified: 0 active provider integration in repository).
 * Step 2.12B registers real adapters here (per Roadmap capability matrix).
 * Registry never falls back to a first/default provider.
 */
export const KNOWN_PAYMENT_PROVIDER_CODES = [] as const satisfies readonly string[];

/** Test-only fake provider code. Never registered in production FinanceModule. */
export const TEST_PAYMENT_PROVIDER_CODE = "FAKE";

/**
 * Capabilities justified by the canonical Roadmap only:
 *  - AUTHORIZE / CAPTURE / DIRECT_CAPTURE / CANCEL / WEBHOOKS — Step 2.12B
 *    (Buyer Card/Wallet Payment: authorize/capture/fail/cancel, webhook
 *    signature, idempotency);
 *  - REFUND — Step 2.13 (Refund Flow);
 *  - NATIVE_SPLIT — Step 2.12C (SPLIT_AT_PAYMENT).
 *
 * HARD RULES:
 *  - a capability does NOT activate behavior;
 *  - a capability does NOT define the business lifecycle;
 *  - NATIVE_SPLIT does NOT define commission rate/base (ADR-0013);
 *  - declaring a capability does NOT make the future step implemented.
 */
export enum PaymentProviderCapability {
  AUTHORIZE = "AUTHORIZE",
  CAPTURE = "CAPTURE",
  DIRECT_CAPTURE = "DIRECT_CAPTURE",
  CANCEL = "CANCEL",
  REFUND = "REFUND",
  WEBHOOKS = "WEBHOOKS",
  NATIVE_SPLIT = "NATIVE_SPLIT",
}

export interface PaymentProviderCapabilities {
  /** Immutable capability set of the provider. */
  readonly capabilities: ReadonlySet<PaymentProviderCapability>;
}

/**
 * Minimal provider interface. Do NOT add authorize/capture/refund/split/webhook
 * methods merely for completeness: they belong to 2.12B/2.12C/2.13 and must
 * remain transport-neutral there. The transport boundary is a FUTURE adapter
 * concern (2.12B).
 */
export interface PaymentProvider {
  /** Canonical provider code (server-owned, deterministic, validated). */
  readonly code: string;
  getCapabilities(): PaymentProviderCapabilities;
}

/**
 * Frozen request contract (design-time; executed by future adapters only).
 * Authorities: frozen Order/Quote facts verbatim. FORBIDDEN authorities:
 * mutable Catalog, mutable Tax/FX, frontend amount/currency/commission, live
 * CommissionPolicy resolution (ADR-0013 freeze boundary). No unnecessary PII.
 */
export interface ProviderPaymentRequest {
  /** TravelHub Payment aggregate id (finance.Payment). */
  readonly paymentId: string;
  /** TravelHub Payment code (PAY-*). */
  readonly paymentCode: string;
  /** Provider-side operation (authorize/capture/cancel/refund). */
  readonly operation: PaymentProviderOperation;
  /** Order reference (code) for provider-side reconciliation. */
  readonly orderRef: string;
  /** Frozen amount — Decimal string (never JS float), verbatim from Order snapshot. */
  readonly amount: string;
  /** Frozen ISO 4217 currency code. */
  readonly currency: string;
  /** Stable provider-operation idempotency identity (deriveProviderOperationKey). */
  readonly providerOperationKey: string;
  /** Correlation lineage reference (ADR-0009). */
  readonly correlationRef: string;
}

/** Normalized provider-side operation result (external fact, NOT a domain transition). */
export interface ProviderOperationResult {
  readonly ok: true;
  readonly providerCode: string;
  /** External provider transaction/reference id (server-provided). */
  readonly providerPaymentId: string;
  readonly normalizedStatus: "SUCCESS";
  /** Echoed amount/currency — useful ONLY for invariant verification, nullable. */
  readonly echoedAmount: string | null;
  readonly echoedCurrency: string | null;
}

export type ProviderFailureCategory =
  | "UNAVAILABLE" // temporary upstream unavailability — retryable
  | "TIMEOUT" // provider timeout — retryable
  | "AUTH_CONFIGURATION" // authentication/configuration — NOT retryable by client
  | "INVALID_REQUEST" // malformed/unsupported request to provider
  | "DECLINED" // business decline — terminal, NOT retryable
  | "UNSUPPORTED_CAPABILITY" // capability not supported by provider
  | "CONFLICT_IDEMPOTENCY" // provider-side idempotency conflict
  | "MALFORMED_RESPONSE"; // provider returned unparseable response

export interface ProviderFailure {
  readonly ok: false;
  readonly providerCode: string;
  readonly category: ProviderFailureCategory;
  /** Explicit retryability — NEVER inferred from message strings. */
  readonly retryable: boolean;
  /** Provider error code — safe, no secrets/PII. Null when unavailable. */
  readonly code: string | null;
  /** Safe message — no raw provider payload, no secrets, no PII. */
  readonly message: string;
}

export type ProviderOperationOutcome = ProviderOperationResult | ProviderFailure;

/** Normalized provider-side status vocabulary (external fact, not domain status). */
export type ProviderNormalizedStatus = "SUCCESS" | "DECLINED" | "FAILED";

/** Provider-side operation vocabulary — defined here to avoid a circular
 *  import between provider.types and provider-operation-id. */
export type PaymentProviderOperation = "AUTHORIZE" | "CAPTURE" | "CANCEL" | "REFUND";
