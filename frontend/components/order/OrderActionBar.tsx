"use client";

import { t, useLocale } from "@/lib/i18n";

/**
 * D5 — единый action area для Order (full-page и Quick Preview).
 *
 * Action availability НЕ вычисляется здесь: приходит готовым списком
 * `actions` из server-authoritative projection (GET /orders/:id →
 * `availableActions` = state machine + gates + granular permissions).
 * Этот компонент — только render-маппинг (label/цвет/подтверждение),
 * никаких drawer/fullPage business-правил.
 */

const ACTION_UI: Record<string, { labelKey: string; cls: string; confirmKey?: string }> = {
  process: { labelKey: "order.action_short.process", cls: "bg-sky-700 hover:bg-sky-800" },
  markWaitingData: { labelKey: "order.action_short.markWaitingData", cls: "bg-amber-700 hover:bg-amber-800" },
  resumeProcessing: { labelKey: "order.action_short.resumeProcessing", cls: "bg-teal-700 hover:bg-teal-800" },
  confirm: { labelKey: "order.action_short.confirm", cls: "bg-violet-700 hover:bg-violet-800" },
  send: { labelKey: "order.action_short.send", cls: "bg-blue-700 hover:bg-blue-800" },
  complete: { labelKey: "order.action_short.complete", cls: "bg-emerald-700 hover:bg-emerald-800" },
  close: { labelKey: "order.action_short.close", cls: "bg-slate-700 hover:bg-slate-800", confirmKey: "order.action_confirm.close" },
  cancel: { labelKey: "order.action_short.cancel", cls: "bg-red-600 hover:bg-red-700", confirmKey: "order.action_confirm.cancel" },
  problem: { labelKey: "order.action_short.problem", cls: "bg-orange-700 hover:bg-orange-800" },
  suspend: { labelKey: "order.action_short.suspend", cls: "bg-slate-700 hover:bg-slate-800" },
};

export default function OrderActionBar({
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
    // R2 — omit empty action area (no technical placeholder text).
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
            onClick={() => {
              if (ui.confirmKey && !window.confirm(t(ui.confirmKey, locale))) return;
              onRun(action);
            }}
            className={`rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${ui.cls}`}
          >
            {busy ? t("order.action.busy", locale) : t(ui.labelKey, locale)}
          </button>
        );
      })}
    </div>
  );
}
