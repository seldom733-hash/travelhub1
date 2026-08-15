/**
 * PHASE 2 STEP 2.12A — Normalized provider error model.
 *
 * Rules (hard gate §15):
 *  - expected provider error ≠ raw 500 by accident: typed classes with
 *    explicit categories and HTTP statuses, caught by the global filter;
 *  - unknown internal error must NOT become a fake decline: DECLINED is a
 *    business outcome produced only from a normalized provider result, never
 *    from an internal exception;
 *  - retryability is EXPLICIT (class-level flag), never inferred from message
 *    strings;
 *  - messages never contain provider secrets, card data, Authorization
 *    headers, raw provider payloads or PII.
 *
 * No background retry worker in this step (Step 2.17 owns durable retry).
 */
import { DomainError } from "../../../shared/errors";
import type { ProviderFailureCategory } from "./provider.types";

export abstract class ProviderError extends DomainError {
  constructor(
    message: string,
    httpStatus: number,
    readonly category: ProviderFailureCategory,
    readonly retryable: boolean,
  ) {
    super(message, httpStatus);
    this.name = "ProviderError";
  }
}

/** Temporary upstream unavailability — retryable. */
export class ProviderUnavailableError extends ProviderError {
  constructor(message: string) {
    super(message, 502, "UNAVAILABLE", true);
    this.name = "ProviderUnavailableError";
  }
}

/** Provider timeout — retryable. */
export class ProviderTimeoutError extends ProviderError {
  constructor(message: string) {
    super(message, 502, "TIMEOUT", true);
    this.name = "ProviderTimeoutError";
  }
}

/** Authentication/configuration failure — NOT retryable by the client. */
export class ProviderConfigurationError extends ProviderError {
  constructor(message: string) {
    super(message, 500, "AUTH_CONFIGURATION", false);
    this.name = "ProviderConfigurationError";
  }
}

/** Request invalid for this provider — NOT retryable as-is. */
export class ProviderInvalidRequestError extends ProviderError {
  constructor(message: string) {
    super(message, 400, "INVALID_REQUEST", false);
    this.name = "ProviderInvalidRequestError";
  }
}

/** Capability not supported by the selected provider — NOT retryable. */
export class ProviderUnsupportedCapabilityError extends ProviderError {
  constructor(message: string) {
    super(message, 422, "UNSUPPORTED_CAPABILITY", false);
    this.name = "ProviderUnsupportedCapabilityError";
  }
}

/** Provider-side idempotency conflict — retryable only with same identity. */
export class ProviderIdempotencyConflictError extends ProviderError {
  constructor(message: string) {
    super(message, 409, "CONFLICT_IDEMPOTENCY", true);
    this.name = "ProviderIdempotencyConflictError";
  }
}

/** Provider returned an unparseable response — NOT retryable blindly. */
export class ProviderMalformedResponseError extends ProviderError {
  constructor(message: string) {
    super(message, 502, "MALFORMED_RESPONSE", false);
    this.name = "ProviderMalformedResponseError";
  }
}
