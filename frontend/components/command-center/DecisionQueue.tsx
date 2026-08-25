// ─── Decision Queue — Stage C ────────────────────────────────────────────────
// Replaces raw Needs Attention counters with an actionable Decision Queue.
// DecisionSignal remains the single source of truth.
// No fake WHY/IMPACT/ACTION — only WHAT and lifecycle.

"use client";

import { useState, useCallback } from "react";
import { t, type Locale } from "../../lib/i18n";
import { presentEvidence, type EvidenceDisplay } from "./signal-evidence.presenter";

// Re-export formatters from evidence presenter for IMPACT rendering
const formatDuration = (minutes: number, locale: Locale): string => {
  if (minutes < 60) {
    return locale === "ru" ? `${minutes} мин` : locale === "az" ? `${minutes} dəq` : `${minutes}m`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) {
    const mPart = m > 0 ? ` ${m}${locale === "ru" ? " мин" : locale === "az" ? " dəq" : "m"}` : "";
    return `${h}${locale === "ru" ? " ч" : locale === "az" ? " saat" : "h"}${mPart}`;
  }
  const d = Math.floor(h / 24);
  const hRem = h % 24;
  const hPart = hRem > 0 ? ` ${hRem}${locale === "ru" ? " ч" : locale === "az" ? " saat" : "h"}` : "";
  return `${d}${locale === "ru" ? " дн" : locale === "az" ? " gün" : "d"}${hPart}`;
};

const formatMoney = (amount: number, locale: Locale): string => {
  const formatted = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(amount);
  return `${formatted} ₼`;
};

/** Interpolate {param} placeholders in a localized template string */
function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

// ── Types ────────────────────────────────────────────────────────────────────

interface WhyAttribution {
  status: string;
  primaryDriver?: {
    textKey: string;
    factualValue: string | number;
    evidenceRefs: string[];
  };
  contributingFactors: Array<{
    textKey: string;
    factualValue: string | number;
    evidenceRefs: string[];
  }>;
  evidenceStrength: string;
  evidenceRefs: string[];
  rule: { ruleId: string; ruleVersion: string };
}

interface QueueImpactDimension {
  type: string;
  label: string;
  labelKey?: string;
  params?: Record<string, string | number>;
  value: string | number;
  unit?: string;
  strength: string;
  evidenceRefs: string[];
}

interface QueueImpact {
  status: string;
  dimensions: QueueImpactDimension[];
  summary: { text: string; textKey: string };
  rule: { ruleId: string; ruleVersion: string };
}

interface QueueAction {
  actionCode: string;
  signalCode: string;
  titleKey: string;
  descriptionKey?: string;
  params?: Record<string, string | number>;
  actionType: string;
  target: { type: string; route?: string; filters?: Record<string, string | number> };
  requiredPermission: string;
  executionMode: string;
  confirmationRequired: boolean;
  eligible: boolean;
  ineligibleReasonKey?: string;
}

interface QueueSignal {
  id: string;
  code: string;
  titleKey: string;
  descriptionKey: string;
  descriptionParams: Record<string, string | number>;
  category: string;
  status: string;
  affectedCount: number;
  evidence: Array<{ key: string; value: string | number; unit?: string }>;
  why: WhyAttribution | null;
  impact: QueueImpact | null;
  actions: QueueAction[];
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
  if (locale === "az") {
    if (minutes < 1) return "indi";
    if (minutes < 60) return `${minutes} dəq. əvvəl`;
    if (hours < 24) return `${hours} saat əvvəl`;
    return `${days} gün əvvəl`;
  }
  // English
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
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAction = useCallback(
    async (action: string) => {
      if (!onAction) return;
      setLoading(action);
      setActionError(null);
      try {
        await onAction(signal.id, action);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setActionError(msg);
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
            {t(signal.titleKey, locale)}
          </h3>
          <p className="mt-1 text-xs text-slate-600 line-clamp-2">
            {interpolate(t(signal.descriptionKey, locale), signal.descriptionParams)}
          </p>
        </div>
        <div className="text-right text-xs text-slate-500 whitespace-nowrap">
          <div>{t("cc.queue.entities", locale)}: {signal.affectedCount}</div>
          <div>{t("cc.queue.observations", locale)}: {signal.observationCount}</div>
        </div>
      </div>

      {/* Evidence — typed presentation adapter (no raw keys) */}
      {signal.evidence.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {presentEvidence(signal.code, signal.evidence, locale).map((ev, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="shrink-0 text-slate-500 min-w-[120px]">{ev.label}</span>
              <span className={ev.highlight ? "font-semibold text-slate-900" : "text-slate-700"}>
                {ev.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Stage D: WHY Attribution Block */}
      {signal.why && (
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("cc.why.title", locale)}
          </div>
          <div className="space-y-1.5">
            {signal.why.status === "INSUFFICIENT_EVIDENCE" ? (
              <p className="text-xs text-slate-500 italic">
                {t("cc.why.insufficient", locale)}
              </p>
            ) : (
              <>
                {signal.why.primaryDriver && (
                  <div className="flex items-start gap-2">
                    <span className="inline-flex shrink-0 items-center rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                      {signal.why.status === "PROVEN_CAUSE"
                        ? t("cc.why.proven_cause", locale)
                        : t("cc.why.observed_driver", locale)}
                    </span>
                    <span className="text-xs text-slate-700">
                      {t(signal.why.primaryDriver.textKey, locale)}: {signal.why.primaryDriver.factualValue}
                    </span>
                  </div>
                )}
                {signal.why.contributingFactors.map((factor, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="inline-flex shrink-0 items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      {t("cc.why.contributing_factor", locale)}
                    </span>
                    <span className="text-xs text-slate-600">
                      {t(factor.textKey, locale)}: {factor.factualValue}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Stage E: IMPACT Block */}
      {signal.impact && (
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("cc.impact.title", locale)}
          </div>
          {signal.impact.status === "INSUFFICIENT_EVIDENCE" ? (
            <p className="text-xs text-slate-500 italic">
              {t("cc.impact.insufficient", locale)}
            </p>
          ) : (
            <div className="space-y-1.5">
              {signal.impact.dimensions.map((dim, i) => {
                // Resolve label: prefer i18n labelKey, fallback to label
                const dimLabel = dim.labelKey ? t(dim.labelKey, locale) : dim.label;
                const dimParams = dim.params ?? {};
                // Resolve summary text if present
                const resolvedLabel = dimParams.summaryTextKey
                  ? `${dimLabel}: ${t(dimParams.summaryTextKey as string, locale)}`
                  : interpolate(dimLabel, dimParams);
                // Format value by unit type
                let displayValue: string;
                if (dim.unit === "AZN" && typeof dim.value === "number") {
                  displayValue = formatMoney(dim.value, locale);
                } else if (dim.unit === "count" && typeof dim.value === "number") {
                  displayValue = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US", { style: "decimal", maximumFractionDigits: 0 }).format(dim.value);
                } else if (dim.unit === "minutes" && typeof dim.value === "number") {
                  displayValue = formatDuration(dim.value, locale);
                } else if (dim.unit === "days" && typeof dim.value === "number") {
                  displayValue = locale === "ru" ? `${dim.value} дн.` : locale === "az" ? `${dim.value} gün` : `${dim.value}d`;
                } else if (typeof dim.value === "number") {
                  displayValue = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US", { style: "decimal", maximumFractionDigits: 0 }).format(dim.value);
                } else if (typeof dim.value === "string" && dim.value.includes(":")) {
                  // Localize payment method distribution (e.g. "BANK_TRANSFER:3;CARD:3")
                  const paymentMethodLabels: Record<string, Record<string, string>> = {
                    BANK_TRANSFER: { ru: "Банковский перевод", az: "Bank köçürməsi", en: "Bank transfer" },
                    CARD: { ru: "Карта", az: "Kart", en: "Card" },
                    MOBILE_PAYMENT: { ru: "Мобильный платёж", az: "Mobil ödəniş", en: "Mobile payment" },
                  };
                  displayValue = String(dim.value).split(";").map((g) => {
                    const [method, cnt] = g.split(":");
                    const label = paymentMethodLabels[method]?.[locale] ?? method;
                    return `${label}: ${cnt}`;
                  }).join(", ");
                } else {
                  displayValue = String(dim.value);
                }
                return (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="shrink-0 text-slate-500 min-w-[120px]">{resolvedLabel}</span>
                    <span className={dim.strength === "FACTUAL" ? "text-slate-900 font-medium" : "text-slate-600"}>
                      {displayValue}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Stage F: ACTION Block */}
      {signal.actions && signal.actions.length > 0 && (
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("cc.action.title", locale)}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {signal.actions.map((action, i) => (
              <button
                key={i}
                onClick={() => {
                  if (action.executionMode === "NAVIGATION_ONLY" && action.target.route) {
                    const params = new URLSearchParams();
                    if (action.target.filters) {
                      for (const [k, v] of Object.entries(action.target.filters)) {
                        params.set(k, String(v));
                      }
                    }
                    const url = params.toString() ? `${action.target.route}?${params}` : action.target.route;
                    window.open(url, "_blank");
                  }
                }}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  action.eligible
                    ? "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                }`}
                disabled={!action.eligible}
                title={action.descriptionKey ? t(action.descriptionKey, locale) : undefined}
              >
                {t(action.titleKey, locale)}
              </button>
            ))}
          </div>
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
        {actionError && (
          <div className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600">
            {actionError}
          </div>
        )}
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
