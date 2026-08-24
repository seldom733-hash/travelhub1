/**
 * Stage F — Evidence-Based Action Contract
 *
 * Canonical action definitions for Decision Queue.
 * Actions are derived on read from DecisionSignal + evidence + entity state.
 * Same inputs → same actions (deterministic).
 *
 * SAFETY:
 * - No fabricated financial claims
 * - No LLM-generated actions
 * - No opaque priority scoring
 * - Navigation-only actions by default
 * - Mutating actions only with proven safe command
 */

// ── Action Types ────────────────────────────────────────────────────────────

/** What kind of action this is */
export type ActionType =
  | "NAVIGATE"       // Navigate to a filtered list/page
  | "OPEN_ENTITY"    // Open a specific entity detail
  | "REVIEW"         // Open entity for review
  | "RETRY"          // Retry a failed operation (only if safe command exists)
  | "PROCESS";       // Process a pending operation (only if safe command exists)

/** Where the action leads */
export type ActionTargetType =
  | "BOOKING"
  | "ORDER"
  | "PAYMENT"
  | "REFUND"
  | "PRODUCT"
  | "LIST"
  | "WORKSPACE";

/** How the action is executed */
export type ExecutionMode =
  | "NAVIGATION_ONLY"    // Frontend navigation, no server mutation
  | "SERVER_COMMAND";    // Server-side mutation with audit

// ── Action Definition ───────────────────────────────────────────────────────

export interface ActionTarget {
  type: ActionTargetType;
  /** Specific entity ID, if targeting a single entity */
  entityId?: string;
  /** Navigation context: route + query params for filtered list */
  route?: string;
  filters?: Record<string, string | number>;
}

export interface ActionDefinition {
  /** Stable action code for identification */
  actionCode: string;
  /** Source signal code this action relates to */
  signalCode: string;
  /** i18n key for action title */
  titleKey: string;
  /** i18n key for optional description/rationale */
  descriptionKey?: string;
  /** Structured params for i18n interpolation */
  params?: Record<string, string | number>;
  /** Action classification */
  actionType: ActionType;
  /** Where this action leads */
  target: ActionTarget;
  /** Required permission to see/execute this action */
  requiredPermission: string;
  /** How this action is executed */
  executionMode: ExecutionMode;
  /** Whether confirmation dialog is needed before execution */
  confirmationRequired: boolean;
  /** Whether this action is currently eligible (may be false if state changed) */
  eligible: boolean;
  /** Reason why action is not eligible, if applicable */
  ineligibleReasonKey?: string;
}

// ── Action Matrix ───────────────────────────────────────────────────────────

export interface SignalActionMatrix {
  signalCode: string;
  actions: ActionDefinition[];
}
