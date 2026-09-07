"use client";

/**
 * UI-C1.2H — Help Center / Business Dictionary.
 *
 * Route: /app/help  (+ deep links /app/help?topic={stable-id})
 *
 * Consumers-only page: all content flows Help Registry → localizationKeys →
 * i18n. It never computes KPIs and never changes business semantics.
 *
 * - shows the full list of Help topics grouped by Commerce Center domain;
 * - renders a full definition panel for a valid ?topic= stable id;
 * - renders a localized "topic not found" state for unknown ids (the raw id
 *   is shown as metadata for support, never as a business definition).
 */
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, t, type Locale } from "@/lib/i18n";
import { helpT } from "@/lib/help-i18n";
import {
  getHelpEntry,
  helpDescription,
  helpEntriesByDomain,
  helpShort,
  helpTitle,
  HELP_DOMAINS,
  type HelpDomain,
  type HelpEntry,
  type HelpEntryType,
} from "@/lib/help-registry";

const DOMAIN_LABEL_KEY: Record<HelpDomain, string> = {
  requests: "nav.requests",
  orders: "nav.orders",
  bookings: "nav.bookings",
  payments: "nav.payments",
};

function typeBadge(type: HelpEntryType, locale: Locale): string {
  if (type === "kpi") return helpT("help.type.kpi", locale);
  if (type === "status") return helpT("help.type.status", locale);
  return helpT("help.type.group", locale);
}

function EntryTypeBadge({ type, locale }: { type: HelpEntryType; locale: Locale }) {
  const label = typeBadge(type, locale);
  const cls =
    type === "kpi"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : type === "status"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function scopeLabel(entry: HelpEntry, locale: Locale): string {
  if (entry.scope === "global") return helpT("help.scope.global", locale);
  return helpT("help.scope.table", locale);
}

function TopicDetail({ entry, locale }: { entry: HelpEntry; locale: Locale }) {
  const groupEntry = entry.group ? getHelpEntry(entry.group) : undefined;
  const groupTitle = groupEntry ? helpTitle(groupEntry, locale) : undefined;
  return (
    <section
      aria-label={helpTitle(entry, locale)}
      className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <EntryTypeBadge type={entry.type} locale={locale} />
        {groupTitle && (
          <span className="text-xs text-slate-500">
            {helpT("help.metadata.group", locale)}: {groupTitle}
          </span>
        )}
      </div>
      <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-900">{helpTitle(entry, locale)}</h2>
      <p className="mt-1 font-mono text-xs text-slate-400">{entry.id}</p>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">{helpDescription(entry, locale)}</p>

      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-slate-500">{helpT("help.metadata.source", locale)}</dt>
          <dd className="mt-0.5 font-mono text-slate-700">{entry.source}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">{helpT("help.metadata.scope", locale)}</dt>
          <dd className="mt-0.5 text-slate-700">{scopeLabel(entry, locale)}</dd>
        </div>
        {entry.period === "global" && (
          <div>
            <dt className="font-semibold text-slate-500">{helpT("help.metadata.period", locale)}</dt>
            <dd className="mt-0.5 text-slate-700">{helpT("help.period.global", locale)}</dd>
          </div>
        )}
        {entry.formula && (
          <div className="sm:col-span-2">
            <dt className="font-semibold text-slate-500">{helpT("help.metadata.formula", locale)}</dt>
            <dd className="mt-0.5 font-mono text-slate-700">{entry.formula}</dd>
          </div>
        )}
        {entry.inclusions && (
          <div className="sm:col-span-2">
            <dt className="font-semibold text-slate-500">{helpT("help.metadata.inclusions", locale)}</dt>
            <dd className="mt-0.5 text-slate-700">{entry.inclusions}</dd>
          </div>
        )}
        <div>
          <dt className="font-semibold text-slate-500">{helpT("help.metadata.contract", locale)}</dt>
          <dd className="mt-0.5 text-slate-700">{entry.contractVersion}</dd>
        </div>
      </dl>
    </section>
  );
}

function DomainSection({ domain, locale, activeTopic }: { domain: HelpDomain; locale: Locale; activeTopic: string | null }) {
  const entries = helpEntriesByDomain(domain);
  return (
    <section aria-label={t(DOMAIN_LABEL_KEY[domain], locale)} className="mb-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-base font-bold tracking-tight text-slate-900">{t(DOMAIN_LABEL_KEY[domain], locale)}</h3>
        <span className="text-xs text-slate-400">{entries.length}</span>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map((entry) => {
          const title = helpTitle(entry, locale);
          const active = entry.id === activeTopic;
          return (
            <li key={entry.id}>
              <Link
                href={`/app/help?topic=${encodeURIComponent(entry.id)}`}
                aria-current={active ? "true" : undefined}
                className={`flex h-full flex-col rounded-xl border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  active
                    ? "border-blue-300 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{title}</span>
                  <EntryTypeBadge type={entry.type} locale={locale} />
                </span>
                <span className="mt-1 font-mono text-[10px] text-slate-400">{entry.id}</span>
                <span className="mt-1.5 text-xs leading-relaxed text-slate-600">{helpShort(entry, locale)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function HelpCenterContent() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic");
  const activeTopic = topic ? decodeURIComponent(topic) : null;
  const selected = activeTopic ? getHelpEntry(activeTopic) : undefined;
  const unknownTopic = activeTopic !== null && !selected;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{helpT("help.title", locale)}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">{helpT("help.intro", locale)}</p>
      </header>

      {selected && (
        <>
          <Link
            href="/app/help"
            className="mb-3 inline-block text-xs font-medium text-slate-500 transition-colors hover:text-blue-600"
          >
            {helpT("help.back_topics", locale)}
          </Link>
          <TopicDetail entry={selected} locale={locale} />
        </>
      )}

      {unknownTopic && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <div className="font-semibold">{helpT("help.topic_not_found", locale)}</div>
          <p className="mt-0.5 text-xs">{helpT("help.topic_not_found_hint", locale)}</p>
          <p className="mt-1 font-mono text-xs opacity-70">{activeTopic}</p>
        </div>
      )}

      <h2 className="mb-3 text-base font-bold uppercase tracking-wide text-slate-400">
        {helpT("help.domains_title", locale)}
      </h2>
      {HELP_DOMAINS.map((domain) => (
        <DomainSection key={domain} domain={domain} locale={locale} activeTopic={activeTopic} />
      ))}
    </div>
  );
}

export default function HelpCenterPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-8 w-56 animate-pulse rounded bg-slate-100" /></div>}>
      <HelpCenterContent />
    </Suspense>
  );
}
