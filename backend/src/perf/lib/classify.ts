/**
 * Step 2.17B — HTTP outcome classification.
 *
 * Expected outcomes are declared per request template (e.g. [200, 201] for
 * payment.create, [200] for reads). Anything else is classified as
 * unexpected 4xx/409/429/5xx, timeout or transport failure — never collapsed
 * into a single «error rate».
 */

export type OutcomeClass =
  | "expected"
  | "unexpected4xx"
  | "unexpected409"
  | "unexpected429"
  | "unexpected5xx"
  | "timeout"
  | "transportError";

export interface ClassifyResult {
  outcome: OutcomeClass;
  expected: boolean;
}

/**
 * Classify an HTTP outcome.
 * @param status   response status code, or null when no response was received
 * @param timeout  true when the request aborted due to the configured timeout
 * @param expected expected status codes for this request template
 */
export function classifyOutcome(status: number | null, timeout: boolean, expected: number[]): ClassifyResult {
  if (timeout) return { outcome: "timeout", expected: false };
  if (status === null) return { outcome: "transportError", expected: false };
  if (expected.includes(status)) return { outcome: "expected", expected: true };
  if (status >= 500) return { outcome: "unexpected5xx", expected: false };
  if (status === 409) return { outcome: "unexpected409", expected: false };
  if (status === 429) return { outcome: "unexpected429", expected: false };
  if (status >= 400) return { outcome: "unexpected4xx", expected: false };
  // 3xx / other (no redirect following by default) — treat as unexpected.
  return { outcome: "unexpected4xx", expected: false };
}

/** Human-readable label for verdict messages. */
export function outcomeLabel(o: OutcomeClass): string {
  switch (o) {
    case "expected":
      return "expected";
    case "unexpected4xx":
      return "unexpected 4xx";
    case "unexpected409":
      return "unexpected 409";
    case "unexpected429":
      return "unexpected 429";
    case "unexpected5xx":
      return "unexpected 5xx";
    case "timeout":
      return "timeout";
    case "transportError":
      return "transport failure";
  }
}
