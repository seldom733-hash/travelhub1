// ─── Decision Queue — Stage C ────────────────────────────────────────────────
// Replaces raw Needs Attention counters with an actionable Decision Queue.
// DecisionSignal remains the single source of truth.
// No fake WHY/IMPACT/ACTION — only WHAT and lifecycle.

"use client";

import { useState, useCallback } from "react";
import { t, type Locale } from "../../lib/i18n";

// ── Types ────────────────────────────────────────────────────────────────────

interface QueueSignal {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  status: string;
  affectedCount: number;
  evidence: Array<{ key: string; value: string | number; unit?: string }>;
  firstDetectedAt: string;
  lastDetectedAt: string;
  observationCount: number;
  acknowledgedAt?: string;
  resolvedAt?: string;
  dismissedAt?: string;
  availableActions: string[];
}

interface QueueSummary {
  open: number;
  acknowledged: number;
  total: number;
  slaBreached: number;
}

interface DecisionQueueProps {
  signals: QueueSignal[];
  summary: QueueSummary;
  locale?: Locale;
  onAction?: (signalId: string, action: string) => Promise<void>;
}

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, slaBreached, locale = "ru" }: { status: string; slaBreached?: boolean; locale?: Locale }) {
  const statusKey = `cc.queue.${status.toLowerCase()}`;
  const label = t(statusKey, locale) || status;

  const colors: Record<string, string> = {
    OPEN: slaBreached
      ? "bg-red-100 text-red-800 border-red-200"
      : "bg-amber-100 text-amber-800 border-amber-200",
    ACKNOWLEDGED: "bg-blue-100 text-blue-800 border-blue-200",
    RESOLVED: "bg-green-100 text-green-800 border-green-200",
    DISMISSED: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors[status] ?? colors.OPEN}`}>
      {slaBreached && status === "OPEN" && (
        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
      )}
      {label}
    </span>
  );
}

// ── Category Badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category, locale = "ru" }: { category: string; locale?: Locale }) {
  const colors: Record<string, string> = {
    OPERATIONAL: "bg-slate-100 text-slate-700",
    FINANCIAL: "bg-emerald-50 text-emerald-700",
    CATALOG: "bg-violet-50 text-violet-700",
    CHANNEL: "bg-cyan-50 text-cyan-700",
  };

  const labels: Record<string, Record<string, string>> = {
    OPERATIONAL: { ru: "Операционный", az: "Əməliyyat", en: "Operational" },
    FINANCIAL: { ru: "Финансовый", az: "Maliyyə", en: "Financial" },
    CATALOG: { ru: "Каталог", az: "Katalog", en: "Catalog" },
    CHANNEL: { ru: "Канал", az: "Kanal", en: "Channel" },
  };

  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${colors[category] ?? colors.OPERATIONAL}`}>
      {labels[category]?.[locale] ?? category}
    </span>
  );
}

// ── Relative Time ────────────────────────────────────────────────────────────

function relativeTime(isoDate: string, locale = "ru"): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (locale === "ru") {
    if (minutes < 1) return "только что";
    if (minutes < 60) return `${minutes} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    return `${days} дн. назад`;
  }
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── Queue Item ───────────────────────────────────────────────────────────────

function QueueItem({
  signal,
  locale = "ru",
  onAction,
  isSlaBreached,
}: {
  signal: QueueSignal;
  locale?: Locale;
  onAction?: (id: string, action: string) => Promise<void>;
  isSlaBreached?: boolean;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = useCallback(
    async (action: string) => {
      if (!onAction) return;
      setLoading(action);
      try {
        await onAction(signal.id, action);
      } finally {
        setLoading(null);
      }
    },
    [onAction, signal.id],
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={signal.status} slaBreached={isSlaBreached} locale={locale} />
            <CategoryBadge category={signal.category} locale={locale} />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 truncate">
            {signal.title}
          </h3>
          <p className="mt-1 text-xs text-slate-600 line-clamp-2">
            {signal.description}
          </p>
        </div>
        <div className="text-right text-xs text-slate-500 whitespace-nowrap">
          <div>{t("cc.queue.entities", locale)}: {signal.affectedCount}</div>
          <div>{t("cc.queue.observations", locale)}: {signal.observationCount}</div>
        </div>
      </div>

      {/* Evidence chips */}
      {signal.evidence.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {signal.evidence.slice(0, 4).map((ev) => (
            <span
              key={ev.key}
              className="inline-flex items-center rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
            >
              {ev.key}: {ev.value}{ev.unit ? ` ${ev.unit}` : ""}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="text-xs text-slate-500">
          <span>{t("cc.queue.detected", locale)}: {relativeTime(signal.firstDetectedAt, locale)}</span>
          {signal.lastDetectedAt !== signal.firstDetectedAt && (
            <span className="ml-2">
              {t("cc.queue.lastObserved", locale)}: {relativeTime(signal.lastDetectedAt, locale)}
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          {signal.availableActions.includes("acknowledge") && (
            <button
              onClick={() => handleAction("acknowledge")}
              disabled={loading !== null}
              className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {loading === "acknowledge" ? "…" : t("cc.queue.acknowledge", locale)}
            </button>
          )}
          {signal.availableActions.includes("resolve") && (
            <button
              onClick={() => handleAction("resolve")}
              disabled={loading !== null}
              className="rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
            >
              {loading === "resolve" ? "…" : t("cc.queue.resolve", locale)}
            </button>
          )}
          {signal.availableActions.includes("dismiss") && (
            <button
              onClick={() => handleAction("dismiss")}
              disabled={loading !== null}
              className="rounded bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              {loading === "dismiss" ? "…" : t("cc.queue.dismiss", locale)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function DecisionQueue({
  signals,
  summary,
  locale = "ru",
  onAction,
}: DecisionQueueProps) {
  const [filter, setFilter] = useState<"active" | "history">("active");

  const activeSignals = signals.filter((s) => s.status === "OPEN" || s.status === "ACKNOWLEDGED");
  const historySignals = signals.filter((s) => s.status === "RESOLVED" || s.status === "DISMISSED");

  const displayedSignals = filter === "active" ? activeSignals : historySignals;

  return (
    <section aria-labelledby="decision-queue-heading">
      {/* Header + Summary */}
      <div className="mb-4 flex items-center justify-between">
        <h2
          id="decision-queue-heading"
          className="flex items-center gap-2 text-lg font-semibold text-slate-900"
        >
          ⚠️ {t("cc.queue.title", locale)}
        </h2>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            {t("cc.queue.open", locale)}: {summary.open}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
            {t("cc.queue.acknowledged", locale)}: {summary.acknowledged}
          </span>
          {summary.slaBreached > 0 && (
            <span className="flex items-center gap-1 text-red-600 font-medium">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              {t("cc.queue.slaBreached", locale)}: {summary.slaBreached}
            </span>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
        <button
          onClick={() => setFilter("active")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "active"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {t("cc.queue.active", locale)} ({activeSignals.length})
        </button>
        <button
          onClick={() => setFilter("history")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "history"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {t("cc.queue.history", locale)} ({historySignals.length})
        </button>
      </div>

      {/* Queue Items */}
      {displayedSignals.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <div className="text-sm text-slate-500">
            {t("cc.queue.empty", locale)}
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {displayedSignals.map((signal) => (
            <QueueItem
              key={signal.id}
              signal={signal}
              locale={locale}
              onAction={onAction}
              isSlaBreached={
                signal.status === "OPEN" &&
                summary.slaBreached > 0 &&
                new Date(signal.firstDetectedAt).getTime() < Date.now() - 240 * 60 * 1000
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
