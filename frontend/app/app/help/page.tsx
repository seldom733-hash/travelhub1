"use client";

/**
 * UI-C1.2H.2 — Global Help Center / Business Dictionary.
 *
 * Route: /app/help (+ deep links /app/help?topic={stable-id})
 *
 * Consumers-only page: all content flows Help Registry → localizationKeys →
 * i18n. It never computes KPIs and never changes business semantics.
 *
 * The page is the global Business Dictionary container:
 *  - taxonomy source is the canonical Registry (HELP_AREAS / HELP_CONTENT_AREAS /
 *    HELP_AREA_BY_DOMAIN) — no second hardcoded taxonomy;
 *  - URL-deterministic navigation state (?topic / ?type / ?area / ?q) is parsed
 *    and canonicalized by lib/help-search.ts;
 *  - current content (operations → requests/orders/bookings; finance → payments)
 *    is browsable; future areas are shown as explicit NOT-STARTED states without
 *    invented content or fake counts;
 *  - Finance is never presented as an implemented Finance Center: Payments is the
 *    CURRENT financial capability with Finance ownership.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, t, type Locale } from "@/lib/i18n";
import { helpT } from "@/lib/help-i18n";
import {
  getHelpEntry,
  helpDescription,
  helpEntriesByArea,
  helpEntriesByDomain,
  helpShort,
  helpTitle,
  HELP_AREAS,
  HELP_CONTENT_AREAS,
  HELP_DOMAINS,
  HELP_REGISTRY,
  type HelpDomain,
  type HelpEntry,
  type HelpEntryType,
} from "@/lib/help-registry";
import {
  buildHelpQueryString,
  countByType,
  domainArea,
  filterHelpEntries,
  HELP_TYPE_FILTERS,
  parseHelpQuery,
  type HelpQuery,
} from "@/lib/help-search";

const DOMAIN_LABEL_KEY: Record<HelpDomain, string> = {
  requests: "nav.requests",
  orders: "nav.orders",
  bookings: "nav.bookings",
  payments: "nav.payments",
};

const areaLabelKey = (area: string) => `help.area.${area}` as const;

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

function TopicCard({ entry, locale, activeTopic }: { entry: HelpEntry; locale: Locale; activeTopic: string | null }) {
  const active = entry.id === activeTopic;
  return (
    <li key={entry.id}>
      <Link
        href={`/app/help?topic=${encodeURIComponent(entry.id)}`}
        aria-current={active ? "true" : undefined}
        className={`flex h-full flex-col rounded-xl border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
          active ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
        }`}
      >
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{helpTitle(entry, locale)}</span>
          <EntryTypeBadge type={entry.type} locale={locale} />
        </span>
        <span className="mt-1 font-mono text-[10px] text-slate-400">{entry.id}</span>
        <span className="mt-1.5 text-xs leading-relaxed text-slate-600">{helpShort(entry, locale)}</span>
      </Link>
    </li>
  );
}

function ChipButton({
  label,
  count,
  pressed,
  onClick,
}: {
  label: string;
  count?: number;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
        pressed
          ? "border-blue-400 bg-blue-600 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {label}
      {typeof count === "number" && <span aria-hidden="true">({count})</span>}
    </button>
  );
}

function HelpCenterContent() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawTopic = searchParams.get("topic");
  const activeTopic = rawTopic ? decodeURIComponent(rawTopic) : null;
  const query = parseHelpQuery({
    type: searchParams.get("type"),
    area: searchParams.get("area"),
    q: searchParams.get("q"),
  });

  const selected = activeTopic ? getHelpEntry(activeTopic) : undefined;
  const unknownTopic = activeTopic !== null && !selected;

  // Search draft — synced from the URL so back/forward/reload keep the input state.
  const [qDraft, setQDraft] = useState(query.q ?? "");
  useEffect(() => {
    setQDraft(query.q ?? "");
  }, [query.q]);

  const go = useCallback(
    (next: HelpQuery) => {
      router.replace(`${pathname}${buildHelpQueryString(next, activeTopic)}`, { scroll: false });
    },
    [router, pathname, activeTopic],
  );

  // Counts for the type chips ignore ?q (they describe the section scope).
  const typeBase = useMemo(
    () => (query.area ? helpEntriesByArea(query.area) : HELP_REGISTRY),
    [query.area],
  );
  const typeCounts = useMemo(() => countByType(typeBase), [typeBase]);

  // Content areas shown: the active one only, or both content areas.
  const visibleAreas = query.area ? [query.area] : [...HELP_CONTENT_AREAS];
  const futureAreas = HELP_AREAS.filter((a) => !HELP_CONTENT_AREAS.includes(a));

  // Domains visible under each area after type/search filtering.
  const areaDomains = (area: string) =>
    HELP_DOMAINS.filter((d) => domainArea(d) === area).map((domain) => ({
      domain,
      entries: filterHelpEntries(helpEntriesByDomain(domain), query, locale),
    }));

  const totalVisible = visibleAreas.reduce(
    (sum, area) => sum + areaDomains(area).reduce((s, d) => s + d.entries.length, 0),
    0,
  );
  const showEmptyState = totalVisible === 0 && (query.q !== undefined || query.type !== undefined);

  const backHref = buildHelpQueryString(query);
  const resetFilters = () => {
    setQDraft("");
    router.replace(`${pathname}${buildHelpQueryString({}, activeTopic)}`, { scroll: false });
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{helpT("help.title", locale)}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">{helpT("help.intro", locale)}</p>
      </header>

      {/* Search — Registry metadata only (lib/help-search.ts), never business data. */}
      <div className="mb-4 max-w-xl">
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
          <input
            type="search"
            value={qDraft}
            aria-label={helpT("help.search_aria", locale)}
            placeholder={helpT("help.search_placeholder", locale)}
            onChange={(e) => {
              const v = e.target.value;
              setQDraft(v);
              go({ ...query, q: v.trim() ? v : undefined });
            }}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          {qDraft && (
            <button
              type="button"
              aria-label={helpT("help.search_clear", locale)}
              onClick={() => {
                setQDraft("");
                go({ ...query, q: undefined });
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-xs text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Type filters — only types that carry content (kpi/status). */}
      <div role="group" aria-label={helpT("help.filter_type_aria", locale)} className="mb-2 flex flex-wrap items-center gap-2">
        <ChipButton
          label={helpT("help.filter_all_topics", locale)}
          count={typeBase.length}
          pressed={!query.type}
          onClick={() => go({ ...query, type: undefined })}
        />
        {HELP_TYPE_FILTERS.map((type) => (
          <ChipButton
            key={type}
            label={type === "kpi" ? helpT("help.filter_metrics", locale) : helpT("help.filter_statuses", locale)}
            count={typeCounts[type] ?? 0}
            pressed={query.type === type}
            onClick={() => go({ ...query, type: query.type === type ? undefined : type })}
          />
        ))}
      </div>

      {/* Section filters — content areas only (operations/finance); counts derived from the Registry. */}
      <div role="group" aria-label={helpT("help.filter_section_aria", locale)} className="mb-6 flex flex-wrap items-center gap-2">
        <ChipButton
          label={helpT("help.filter_all_sections", locale)}
          pressed={!query.area}
          onClick={() => go({ ...query, area: undefined })}
        />
        {HELP_CONTENT_AREAS.map((area) => (
          <ChipButton
            key={area}
            label={helpT(areaLabelKey(area), locale)}
            count={helpEntriesByArea(area).length}
            pressed={query.area === area}
            onClick={() => go({ ...query, area: query.area === area ? undefined : area })}
          />
        ))}
      </div>

      {selected && (
        <>
          <Link
            href={backHref}
            className="mb-3 inline-block text-xs font-medium text-slate-500 transition-colors hover:text-blue-600"
          >
            {helpT("help.back_topics", locale)}
          </Link>
          <TopicDetail entry={selected} locale={locale} />
        </>
      )}

      {unknownTopic && (
        <div role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="font-semibold">{helpT("help.topic_not_found", locale)}</div>
          <p className="mt-0.5 text-xs">{helpT("help.topic_not_found_hint", locale)}</p>
          <p className="mt-1 font-mono text-xs opacity-70">{activeTopic}</p>
        </div>
      )}

      {showEmptyState ? (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center">
          <div className="text-sm font-semibold text-slate-700">{helpT("help.search_no_results", locale)}</div>
          <p className="mt-1 text-xs text-slate-500">{helpT("help.search_no_results_hint", locale)}</p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {helpT("help.filter_all_topics", locale)}
          </button>
        </div>
      ) : (
        <section aria-label={helpT("help.domains_title", locale)}>
          <h2 className="mb-3 text-base font-bold uppercase tracking-wide text-slate-400">
            {helpT("help.domains_title", locale)}
          </h2>

          {visibleAreas.map((area) => {
            const domains = areaDomains(area);
            if (domains.every((d) => d.entries.length === 0)) return null;
            return (
              <section key={area} aria-label={helpT(areaLabelKey(area), locale)} className="mb-6">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="text-base font-bold tracking-tight text-slate-900">
                    {helpT(areaLabelKey(area), locale)}
                  </h3>
                  <span className="text-xs text-slate-400">{domains.reduce((s, d) => s + d.entries.length, 0)}</span>
                </div>

                {/* Finance special rule: Payments is CURRENT capability with Finance ownership,
                    never an implemented Finance Center. */}
                {area === "finance" && (
                  <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                    <p className="font-medium text-slate-700">{helpT("help.finance_center_status", locale)}</p>
                    <p className="mt-0.5">{helpT("help.payments_finance_ownership", locale)}</p>
                  </div>
                )}

                {domains.map(({ domain, entries }) => (
                  <section key={domain} aria-label={t(DOMAIN_LABEL_KEY[domain], locale)} className="mb-4">
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <h4 className="text-sm font-bold tracking-tight text-slate-700">
                        {t(DOMAIN_LABEL_KEY[domain], locale)}
                      </h4>
                      <span className="text-xs text-slate-400">{entries.length}</span>
                    </div>
                    {entries.length > 0 ? (
                      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {entries.map((entry) => (
                          <TopicCard key={entry.id} entry={entry} locale={locale} activeTopic={activeTopic} />
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-400">{helpT("help.search_no_results", locale)}</p>
                    )}
                  </section>
                ))}
              </section>
            );
          })}
        </section>
      )}

      {/* Future areas — explicit NOT STARTED states, never fake content or counts. */}
      {futureAreas.length > 0 && (
        <section aria-label={helpT("help.future_sections", locale)} className="mt-8 border-t border-slate-100 pt-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
            {helpT("help.future_sections", locale)}
          </h2>
          <p className="mt-1 text-xs text-slate-400">{helpT("help.future_area_note", locale)}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {futureAreas.map((area) => (
              <li
                key={area}
                className="inline-flex items-center rounded-full border border-dashed border-slate-200 px-3 py-1.5 text-xs text-slate-400"
              >
                {helpT(areaLabelKey(area), locale)}
              </li>
            ))}
          </ul>
        </section>
      )}
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
