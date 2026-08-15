/**
 * PHASE 2 STEP 2.12A — FakePaymentProvider (TEST-ONLY).
 *
 * Requirements (§20): deterministic; configurable; NO network; NO secrets;
 * simulates success / terminal decline / temporary-unavailable / timeout /
 * unsupported-capability outcomes; simulates same-operation replay and
 * divergent operation params; must NOT be selectable in production by accident
 * (never registered by production FinanceModule; TEST code registers it
 * explicitly; `has("FAKE")` is false on a production-built registry).
 *
 * The fake's `executeOperation` is a contract-level exercise point ONLY (no
 * network, no side effects outside its own recorded map). The minimal
 * `PaymentProvider` interface itself stays `code` + `getCapabilities`.
 */
import { ConflictError } from "../../../shared/errors";
import { assertProviderOperationParamsConsistent, type ProviderOperationParams } from "./provider-operation-id";
import type {
  PaymentProvider,
  PaymentProviderCapabilities,
  PaymentProviderOperation,
  ProviderOperationOutcome,
  ProviderPaymentRequest,
} from "./provider.types";
import { PaymentProviderCapability, TEST_PAYMENT_PROVIDER_CODE } from "./provider.types";

export interface FakePaymentProviderOptions {
  /** Capability set; defaults to the full Roadmap-justified set. */
  readonly capabilities?: readonly PaymentProviderCapability[];
  /** Deterministic default outcome for every operation. */
  readonly defaultOutcome?: ProviderOperationOutcome;
  /** Per-operation deterministic outcomes. */
  readonly outcomeByOperation?: Partial<Record<PaymentProviderOperation, ProviderOperationOutcome>>;
}

export class FakePaymentProvider implements PaymentProvider {
  readonly code: string = TEST_PAYMENT_PROVIDER_CODE;

  private readonly capabilities: ReadonlySet<PaymentProviderCapability>;
  private readonly defaultOutcome: ProviderOperationOutcome | undefined;
  private readonly outcomeByOperation: Partial<Record<PaymentProviderOperation, ProviderOperationOutcome>>;

  /** providerOperationKey → recorded params (divergence detection). */
  private readonly recordedParams = new Map<string, ProviderOperationParams>();

  constructor(options: FakePaymentProviderOptions = {}) {
    this.capabilities = new Set(options.capabilities ?? [
      PaymentProviderCapability.AUTHORIZE,
      PaymentProviderCapability.CAPTURE,
      PaymentProviderCapability.DIRECT_CAPTURE,
      PaymentProviderCapability.CANCEL,
      PaymentProviderCapability.REFUND,
      PaymentProviderCapability.WEBHOOKS,
    ]);
    this.defaultOutcome = options.defaultOutcome;
    this.outcomeByOperation = options.outcomeByOperation ?? {};
  }

  getCapabilities(): PaymentProviderCapabilities {
    return { capabilities: this.capabilities };
  }

  /**
   * Deterministic contract-level execution (TEST-ONLY, NO network).
   *  - same providerOperationKey + same params → same outcome (replay-safe);
   *  - same key + DIVERGENT params → controlled ConflictError;
   *  - configured per-operation outcome wins over default;
   *  - default success echoes frozen amount/currency.
   */
  executeOperation(
    request: ProviderPaymentRequest,
    params: ProviderOperationParams,
  ): ProviderOperationOutcome {
    const recorded = this.recordedParams.get(request.providerOperationKey) ?? null;
    assertProviderOperationParamsConsistent(recorded, params);
    if (recorded === null) {
      this.recordedParams.set(request.providerOperationKey, params);
    }
    const outcome = this.outcomeByOperation[request.operation] ?? this.defaultOutcome;
    if (outcome) return outcome;
    return {
      ok: true,
      providerCode: this.code,
      providerPaymentId: `FAKE-${request.paymentCode}`,
      normalizedStatus: "SUCCESS",
      echoedAmount: params.amount,
      echoedCurrency: params.currency,
    };
  }

  /** Test introspection: whether a key has been recorded (replay proof). */
  hasRecorded(key: string): boolean {
    return this.recordedParams.has(key);
  }

  /** Re-simulate the replay check without executing (test helper). */
  assertReplayConsistent(key: string, params: ProviderOperationParams): void {
    const recorded = this.recordedParams.get(key) ?? null;
    if (recorded === null) {
      throw new ConflictError(`No recorded params for ${key}`);
    }
    assertProviderOperationParamsConsistent(recorded, params);
  }
}
