"use client";

import type { ReactNode } from "react";

/**
 * Общая обёртка side-panel (правый aside): шапка с заголовком/подзаголовком
 * и кнопкой закрытия + тело. Используется формами создания (users/catalog/customers).
 */
export default function PanelFrame({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <aside className="thin-scroll fade-in-up w-96 shrink-0 overflow-y-auto border-l border-slate-200 bg-white">
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <div className="text-lg font-bold text-slate-900">{title}</div>
          {subtitle && <div className="text-xs text-slate-400">{subtitle}</div>}
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100" aria-label="Закрыть">
          ✕
        </button>
      </div>
      <div className="space-y-4 p-5 text-sm">{children}</div>
    </aside>
  );
}
