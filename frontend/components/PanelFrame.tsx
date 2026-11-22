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
  overlay = false,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  overlay?: boolean;
  children: ReactNode;
}) {
  if (overlay) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={onClose}>
        <div className="fade-in-up flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between border-b border-line px-5 py-4">
            <div>
              <div className="text-lg font-bold text-ink">{title}</div>
              {subtitle && <div className="text-xs text-ink/60">{subtitle}</div>}
            </div>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-ink/60 hover:bg-panel" aria-label="Закрыть">✕</button>
          </div>
          <div className="thin-scroll space-y-4 overflow-y-auto p-5 text-sm text-ink">{children}</div>
        </div>
      </div>
    );
  }
  return (
    <aside className="thin-scroll fade-in-up w-96 shrink-0 overflow-y-auto border-l border-line bg-white">
      <div className="flex items-start justify-between border-b border-line px-5 py-4">
        <div>
          <div className="text-lg font-bold text-ink">{title}</div>
          {subtitle && <div className="text-xs text-ink/60">{subtitle}</div>}
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-ink/60 hover:bg-panel" aria-label="Закрыть">
          ✕
        </button>
      </div>
      <div className="space-y-4 p-5 text-sm text-ink">{children}</div>
    </aside>
  );
}
