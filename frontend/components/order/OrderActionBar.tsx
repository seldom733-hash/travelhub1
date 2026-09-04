"use client";

/**
 * D5 — единый action area для Order (full-page и Quick Preview).
 *
 * Action availability НЕ вычисляется здесь: приходит готовым списком
 * `actions` из server-authoritative projection (GET /orders/:id →
 * `availableActions` = state machine + gates + granular permissions).
 * Этот компонент — только render-маппинг (label/цвет/подтверждение),
 * никаких drawer/fullPage business-правил.
 */

const ACTION_UI: Record<string, { label: string; cls: string; confirm?: string }> = {
  process: { label: "Принять в работу", cls: "bg-sky-600 hover:bg-sky-700" },
  markWaitingData: { label: "Ожидание данных", cls: "bg-amber-500 hover:bg-amber-600" },
  resumeProcessing: { label: "Возобновить обработку", cls: "bg-teal-600 hover:bg-teal-700" },
  confirm: { label: "Готов к бронированию", cls: "bg-violet-600 hover:bg-violet-700" },
  send: { label: "Передать в Booking", cls: "bg-blue-600 hover:bg-blue-700" },
  complete: { label: "Исполнен", cls: "bg-emerald-600 hover:bg-emerald-700" },
  close: { label: "Закрыть", cls: "bg-slate-700 hover:bg-slate-800", confirm: "Закрыть заказ? Это терминальное действие." },
  cancel: { label: "Отменить", cls: "bg-red-600 hover:bg-red-700", confirm: "Отменить заказ? Действие терминально." },
  problem: { label: "Проблема", cls: "bg-orange-600 hover:bg-orange-700" },
  suspend: { label: "Приостановить", cls: "bg-slate-500 hover:bg-slate-600" },
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
  if (actions.length === 0) {
    // R2 — omit empty action area (no technical placeholder text).
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => {
        const ui = ACTION_UI[action] ?? { label: action, cls: "bg-slate-600 hover:bg-slate-700" };
        return (
          <button
            key={action}
            disabled={busyAction !== null}
            onClick={() => {
              if (ui.confirm && !window.confirm(ui.confirm)) return;
              onRun(action);
            }}
            className={`rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${ui.cls}`}
          >
            {busyAction === action ? "…" : ui.label}
          </button>
        );
      })}
    </div>
  );
}
