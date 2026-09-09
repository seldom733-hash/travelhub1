"use client";

import { t, useLocale } from "@/lib/i18n";

/**
 * UI-C9 — единый action area для Booking Detail (header actions slot).
 *
 * Action availability НЕ вычисляется здесь: приходит готовым списком
 * `actions` из server-authoritative projection (GET /bookings/:id →
 * `availableActions` = state machine + RBAC + Order terminal guard).
 * Этот компонент — только render-маппинг (label/цвет/busy); никаких
 * status-матриц, permission-проверок или lifecycle-правил.
 *
 * Канонические 13 BookingAction-идентификаторов (backend Step 2.9):
 * prepare, send, requestClarification, resume, confirm, reject, service,
 * requestChange, resolveChange, requestCancellation, complete, cancel, problem.
 */
const ACTION_UI: Record<string, { labelKey: string; cls: string }> = {
  prepare: { labelKey: "booking.action_short.prepare", cls: "bg-sky-600 hover:bg-sky-700" },
  send: { labelKey: "booking.action_short.send", cls: "bg-blue-600 hover:bg-blue-700" },
  requestClarification: { labelKey: "booking.action_short.requestClarification", cls: "bg-slate-500 hover:bg-slate-600" },
  resume: { labelKey: "booking.action_short.resume", cls: "bg-sky-600 hover:bg-sky-700" },
  confirm: { labelKey: "booking.action_short.confirm", cls: "bg-emerald-600 hover:bg-emerald-700" },
  reject: { labelKey: "booking.action_short.reject", cls: "bg-red-500 hover:bg-red-600" },
  service: { labelKey: "booking.action_short.service", cls: "bg-indigo-600 hover:bg-indigo-700" },
  requestChange: { labelKey: "booking.action_short.requestChange", cls: "bg-orange-500 hover:bg-orange-600" },
  resolveChange: { labelKey: "booking.action_short.resolveChange", cls: "bg-emerald-500 hover:bg-emerald-600" },
  requestCancellation: { labelKey: "booking.action_short.requestCancellation", cls: "bg-red-400 hover:bg-red-500" },
  complete: { labelKey: "booking.action_short.complete", cls: "bg-green-700 hover:bg-green-800" },
  cancel: { labelKey: "booking.action_short.cancel", cls: "bg-red-600 hover:bg-red-700" },
  problem: { labelKey: "booking.action_short.problem", cls: "bg-amber-600 hover:bg-amber-700" },
};

export default function BookingActionBar({
  actions,
  onRun,
  busyAction,
}: {
  actions: string[];
  onRun: (action: string) => void;
  busyAction: string | null;
}) {
  const locale = useLocale();

  if (actions.length === 0) {
    // UI-C9 — omit empty action area (no technical placeholder text).
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => {
        const ui = ACTION_UI[action] ?? { labelKey: action, cls: "bg-slate-600 hover:bg-slate-700" };
        const busy = busyAction === action;
        return (
          <button
            key={action}
            disabled={busyAction !== null}
            aria-busy={busy}
            onClick={() => onRun(action)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${ui.cls}`}
          >
            {busy ? t("booking.action.busy", locale) : t(ui.labelKey, locale)}
          </button>
        );
      })}
    </div>
  );
}
