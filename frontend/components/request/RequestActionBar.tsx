"use client";

import { useState } from "react";
import { t, type Locale } from "@/lib/i18n";

/**
 * UI-C7 — RequestActionBar (canonical header actions slot for Request Detail).
 *
 * Server-authoritative presentation only:
 *  - visibility of every action is determined EXCLUSIVELY by the corresponding
 *    boolean of the typed `availableActions` object (UI-C6 server projection);
 *  - no status inspection, no permission inspection, no client-side
 *    lifecycle/permission computation lives here;
 *  - every action round-trips to the server through the callbacks provided by
 *    the page (`runPost` semantics, paths and bodies unchanged);
 *  - propose-price keeps the existing inline toggle/input UX (no modal/drawer);
 *  - buttons are keyboard-accessible (native <button>), group labels are
 *    localized (`reqflow.*`), the propose input has an accessible name.
 */

export interface RequestAvailableActions {
  confirmPrice: boolean;
  proposePrice: boolean;
  reject: boolean;
  unavailable: boolean;
  customerAccept: boolean;
  customerDecline: boolean;
  convert: boolean;
}

/**
 * Canonical tone grammar (replaces the page-local TONES/btn primitives).
 * Pure Tailwind presentation — no new design system.
 */
const TONE_CLASSES = {
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  danger: "bg-red-600 text-white hover:bg-red-700",
  neutral: "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50",
} as const;

const BTN =
  "rounded-lg px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50";

export default function RequestActionBar({
  locale,
  availableActions,
  busyAction,
  onRun,
  onPropose,
  onValidationMessage,
}: {
  locale: Locale;
  /** Server projection — the ONLY visibility authority. */
  availableActions: RequestAvailableActions;
  /** Path currently executing (busy gating, mirrors existing page semantics). */
  busyAction: string | null;
  /** Fire a server action; `action` is the canonical API path segment. */
  onRun: (action: string) => void;
  /** Propose-price submission (keeps page-side validation/post semantics). */
  onPropose: (price: number) => Promise<boolean>;
  /** Client-side validation feedback (existing requests.price_invalid contract). */
  onValidationMessage: (message: string | null) => void;
}) {
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposePrice, setProposePrice] = useState("");

  const showSupplier =
    availableActions.confirmPrice ||
    availableActions.proposePrice ||
    availableActions.reject ||
    availableActions.unavailable;
  const showCustomer =
    availableActions.customerAccept || availableActions.customerDecline;
  const showConvert = availableActions.convert;

  if (!showSupplier && !showCustomer && !showConvert) {
    // Canonical R2 rule: omit the empty action area entirely (no placeholder).
    return null;
  }

  const closePropose = () => {
    setProposeOpen(false);
    setProposePrice("");
  };

  async function submitPropose() {
    const price = Number(proposePrice);
    if (!proposePrice || !Number.isFinite(price) || price <= 0) {
      onValidationMessage(t("requests.price_invalid", locale));
      return;
    }
    const ok = await onPropose(price);
    if (ok) closePropose();
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {showSupplier && (
        <div className="flex flex-col items-start gap-1">
          <span className="text-[10px] font-medium uppercase text-slate-400">
            {t("reqflow.supplier_actions", locale)}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {availableActions.confirmPrice && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => onRun("confirm-price")}
                className={`${BTN} ${TONE_CLASSES.success}`}
              >
                {busyAction === "confirm-price"
                  ? t("reqflow.busy", locale)
                  : t("reqflow.confirm_price", locale)}
              </button>
            )}
            {availableActions.proposePrice && !proposeOpen && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => setProposeOpen(true)}
                className={`${BTN} ${TONE_CLASSES.primary}`}
              >
                {t("reqflow.propose_price", locale)}
              </button>
            )}
            {availableActions.proposePrice && proposeOpen && (
              <span className="flex items-center gap-2">
                <input
                  value={proposePrice}
                  onChange={(e) => setProposePrice(e.target.value)}
                  placeholder={t("requests.price_proposal_placeholder", locale)}
                  aria-label={t("requests.price_proposal_placeholder", locale)}
                  inputMode="decimal"
                  className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void submitPropose()}
                  className={`${BTN} ${TONE_CLASSES.primary}`}
                >
                  OK
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={closePropose}
                  className={`${BTN} ${TONE_CLASSES.neutral}`}
                >
                  ✕
                </button>
              </span>
            )}
            {availableActions.reject && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => onRun("reject")}
                className={`${BTN} ${TONE_CLASSES.danger}`}
              >
                {t("reqflow.reject", locale)}
              </button>
            )}
            {availableActions.unavailable && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => onRun("unavailable")}
                className={`${BTN} ${TONE_CLASSES.neutral}`}
              >
                {t("reqflow.unavailable", locale)}
              </button>
            )}
          </div>
        </div>
      )}

      {showCustomer && (
        <div className="flex flex-col items-start gap-1">
          <span className="text-[10px] font-medium uppercase text-slate-400">
            {t("reqflow.customer_actions", locale)}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {availableActions.customerAccept && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => onRun("customer-accept")}
                className={`${BTN} ${TONE_CLASSES.success}`}
              >
                {t("reqflow.customer_accept", locale)}
              </button>
            )}
            {availableActions.customerDecline && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => onRun("customer-decline")}
                className={`${BTN} ${TONE_CLASSES.danger}`}
              >
                {t("reqflow.customer_decline", locale)}
              </button>
            )}
          </div>
        </div>
      )}

      {showConvert && (
        <div className="flex flex-col items-start gap-1">
          <span className="text-[10px] font-medium uppercase text-slate-400">
            {t("reqflow.converted_hint", locale)}
          </span>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => onRun("convert")}
            className={`${BTN} ${TONE_CLASSES.primary}`}
          >
            {busyAction === "convert"
              ? t("reqflow.busy", locale)
              : t("reqflow.convert_action", locale)}
          </button>
        </div>
      )}
    </div>
  );
}
