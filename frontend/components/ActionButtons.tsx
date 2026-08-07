"use client";

export interface ActionDef {
  action: string;
  label: string;
  cls: string;
  only: string[];
}

/**
 * Ролевые кнопки команд (RBAC Matrix §4): фильтр по статусу сущности
 * и по granular permissions (передаются как готовые булевы из useCan-хуков).
 * Если ни одно действие недоступно — подсказка вместо кнопок.
 */
export default function ActionButtons({
  actions,
  status,
  permOf,
  onRun,
}: {
  actions: ActionDef[];
  status: string;
  permOf: Record<string, boolean>;
  onRun: (action: string) => void;
}) {
  // Команды, применимые к статусу, и из них — разрешённые ролью (RBAC Matrix §4).
  const forStatus = actions.filter((a) => a.only.includes(status));
  const available = forStatus.filter((a) => permOf[a.action]);

  if (available.length === 0) {
    if (forStatus.length === 0) {
      return <div className="text-xs text-slate-400">Для текущего статуса команд нет</div>;
    }
    return <div className="text-xs text-slate-400">Нет прав на команды для вашей роли</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {available.map((a) => (
        <button
          key={a.action}
          onClick={() => onRun(a.action)}
          className={`rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors ${a.cls}`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
