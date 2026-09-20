"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { t, useLocale } from "@/lib/i18n";
import Price from "@/components/public/Price";
import {
  getPriceCalendar,
  isCaptchaRequired,
  type SupplierPriceCalendarQuery,
  type SupplierPriceCalendarEntry,
  type SupplierPriceCalendarResult,
} from "@/lib/supplier-api";
import { useKompasCaptcha } from "@/lib/useKompasCaptcha";
import { KompasCaptchaModal } from "@/components/supplier/KompasCaptchaModal";

/**
 * MonthlyCalendar — помесячная загрузка календаря KOMPAS.
 *
 * - Загружает только текущий отображаемый месяц
 * - Кэширует успешные результаты по ключу (supplier + tour + hotel + passenger + month)
 * - Дедупликация и защита от stale-ответов
 * - Обновить цены — инвалидация только текущего месяца
 * - Состояния LOADING/SUCCESS/EMPTY/ERROR/CAPTCHA_REQUIRED
 */
type MonthlyCalendarQuery = Omit<SupplierPriceCalendarQuery, "dateFrom" | "dateTo">;

function buildCacheKey(base: MonthlyCalendarQuery, year: number, month: number): string {
  // month 0-based — includes all KOMPAS filters that affect price
  return JSON.stringify({
    supplier: base.supplierCode,
    tourIncValue: base.tourIncValue ?? null,
    tourIncValues: base.tourIncValues ?? null,
    tourIncName: base.tourIncName ?? null,
    tourIncNames: base.tourIncNames ?? null,
    hotelExternalId: base.hotelExternalId ?? null,
    hotel: base.hotel ?? null,
    destination: base.destination ?? null,
    departureCity: (base as any).departureCity ?? null,
    adults: base.adults,
    children: base.children ?? 0,
    childAges: base.childAges ?? [],
    nights: base.nights,
    room: base.room ?? null,
    meal: base.meal ?? null,
    // calendar month distinguishes cache entries
    month: `${year}-${String(month + 1).padStart(2, "0")}`,
  });
}

function formatLastUpdated(d: Date, locale: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yy = String(d.getFullYear()).slice(2, 4);
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${dd}.${mm}.${yy} ${hh}:${min}`;
}

function monthRange(year: number, month: number): { dateFrom: string; dateTo: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const first = `${year}-${pad(month + 1)}-01`;
  const lastDate = new Date(year, month + 1, 0).getDate();
  const last = `${year}-${pad(month + 1)}-${pad(lastDate)}`;
  return { dateFrom: first, dateTo: last };
}

// Global cache survives unmount / SPA navigation; sessionStorage survives full reload
const globalCalendarCache = new Map<string, { entries: SupplierPriceCalendarEntry[]; lastUpdated: Date }>();
const globalInflight = new Map<string, Promise<SupplierPriceCalendarResult>>();

function getSessionCache(key: string): { entries: SupplierPriceCalendarEntry[]; lastUpdated: Date } | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) {
      console.log("[MonthlyCalendar] getSessionCache no window");
      return null;
    }
    const raw = window.sessionStorage.getItem(`cal:${key}`);
    console.log(`[MonthlyCalendar] getSessionCache key=${key.slice(0,60)} found=${!!raw} len=${raw?.length ?? 0}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { entries: parsed.entries, lastUpdated: new Date(parsed.lastUpdated) };
  } catch (e) {
    console.log(`[MonthlyCalendar] getSessionCache error ${(e as Error).message}`);
    return null;
  }
}
function setSessionCache(key: string, entries: SupplierPriceCalendarEntry[], lastUpdated: Date) {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) {
      console.log("[MonthlyCalendar] setSessionCache no window");
      return;
    }
    const payload = JSON.stringify({ entries, lastUpdated: lastUpdated.toISOString() });
    console.log(`[MonthlyCalendar] setSessionCache key=${key.slice(0,60)} len=${payload.length}`);
    window.sessionStorage.setItem(`cal:${key}`, payload);
    console.log(`[MonthlyCalendar] setSessionCache done keys=${Object.keys(window.sessionStorage).filter(k=>k.startsWith('cal:')).length}`);
  } catch (e) {
    console.log(`[MonthlyCalendar] setSessionCache error ${(e as Error).message}`);
  }
}

export default function MonthlyCalendar({
  query: baseQuery,
  onSelect,
}: {
  query: MonthlyCalendarQuery;
  onSelect?: (entry: SupplierPriceCalendarEntry) => void;
}) {
  const locale = useLocale();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const [entries, setEntries] = useState<SupplierPriceCalendarEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"ERROR" | "EMPTY" | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { challenge, checkResponseForCaptcha, submit, refresh, cancel } = useKompasCaptcha();

  const cacheKey = useMemo(
    () => buildCacheKey(baseQuery, currentMonth.getFullYear(), currentMonth.getMonth()),
    [baseQuery, currentMonth],
  );

  const fetchMonth = useCallback(
    async (forceRefresh = false) => {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const key = buildCacheKey(baseQuery, year, month);
      console.log(`[MonthlyCalendar] fetch ${year}-${String(month+1).padStart(2,"0")} force=${forceRefresh} key=${key.slice(0,120)} query=`, baseQuery);

      // CACHE_HIT — global memory first, then sessionStorage (survives full reload)
      if (!forceRefresh) {
        const cached = globalCalendarCache.get(key);
        if (cached) {
          console.log(`[MonthlyCalendar] CACHE_HIT memory ${year}-${String(month+1).padStart(2,"0")}`);
          setEntries(cached.entries);
          setLastUpdated(cached.lastUpdated);
          setError(null);
          setErrorKind(null);
          setLoading(false);
          return;
        }
        const sess = getSessionCache(key);
        if (sess) {
          console.log(`[MonthlyCalendar] CACHE_HIT sessionStorage ${year}-${String(month+1).padStart(2,"0")} key=${key.slice(0,80)}`);
          globalCalendarCache.set(key, sess);
          setEntries(sess.entries);
          setLastUpdated(sess.lastUpdated);
          setError(null);
          setErrorKind(null);
          setLoading(false);
          return;
        } else {
          console.log(`[MonthlyCalendar] CACHE_MISS sessionStorage ${year}-${String(month+1).padStart(2,"0")} key=${key.slice(0,80)} sessKeys=${(() => { try { return Object.keys(window.sessionStorage).filter(k=>k.startsWith('cal:')).length; } catch { return -1; } })()}`);
        }
      } else {
        // Invalidate only current month
        globalCalendarCache.delete(key);
        try { window.sessionStorage.removeItem(`cal:${key}`); } catch {}
      }

      // Dedup: reuse in-flight request for same key
      const existing = globalInflight.get(key);
      if (existing && !forceRefresh) {
        setLoading(true);
        setError(null);
        try {
          const data = await existing;
          // stale guard: only apply if still same month/key
          if (buildCacheKey(baseQuery, currentMonth.getFullYear(), currentMonth.getMonth()) !== key) return;
          if (isCaptchaRequired(data as unknown)) {
            checkResponseForCaptcha(data as unknown as any);
            return;
          }
          const result = data as SupplierPriceCalendarResult;
          const isEmpty = result.entries.every((e) => e.price === null);
          if (isEmpty) {
            setErrorKind("EMPTY");
            setError(null);
          }
          globalCalendarCache.set(key, { entries: result.entries, lastUpdated: new Date(result.fetchedAt) });
          setSessionCache(key, result.entries, new Date(result.fetchedAt));
          setEntries(result.entries);
          setLastUpdated(new Date(result.fetchedAt));
          setError(null);
          setErrorKind(null);
        } catch (err: any) {
          if (err?.name === "AbortError" || String(err?.message).includes("aborted") || String(err?.message).includes("AbortError")) {
            console.log(`[MonthlyCalendar] abort dedup ignored ${year}-${String(month+1).padStart(2,"0")}`);
            return;
          }
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[MonthlyCalendar] ERROR dedup ${year}-${String(month+1).padStart(2,"0")} msg=${msg}`, err);
          if (msg.includes("CAPTCHA_REQUIRED")) return;
          if (msg.includes("503") || msg.includes("500") || msg.includes("Concurrency") || msg.includes("Rate limit") || msg.includes("circuit is OPEN") || msg.includes("Too Many") || msg.includes("Internal Server Error")) {
            console.log(`[MonthlyCalendar] 500/503 retry dedup ${year}-${String(month+1).padStart(2,"0")} in 1.2s msg=${msg.slice(0,80)}`);
            setTimeout(() => fetchMonth(forceRefresh), 1200);
            setError("Слишком много запросов, повторная попытка...");
            setErrorKind("ERROR");
            return;
          }
          setErrorKind("ERROR");
          if (msg.includes("supports nights") || msg.includes("UNSUPPORTED")) setError(t("supplier.error.unsupported", locale));
          else if (msg.includes("timeout") || msg.includes("TIMEOUT")) setError(t("supplier.error.timeout", locale));
          else setError(t("supplier.error.generic", locale));
        } finally {
          setLoading(false);
        }
        return;
      }

      const { dateFrom, dateTo } = monthRange(year, month);
      // Abort previous KOMPAS request if user switched month before it finished
      if (abortRef.current) {
        abortRef.current.abort();
        console.log(`[MonthlyCalendar] abort previous for ${year}-${String(month+1).padStart(2,"0")}`);
      }
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);
      setErrorKind(null);

      const promise = getPriceCalendar(
        {
          ...baseQuery,
          dateFrom,
          dateTo,
        } as SupplierPriceCalendarQuery,
        controller.signal,
      ) as Promise<SupplierPriceCalendarResult>;

      globalInflight.set(key, promise);

      try {
        const data: any = await promise;
        globalInflight.delete(key);
        // stale guard
        if (requestId !== requestIdRef.current) {
          console.log(`[MonthlyCalendar] stale response ignored ${key.slice(0,60)} req ${requestId} vs ${requestIdRef.current}`);
          return;
        }
        if (buildCacheKey(baseQuery, currentMonth.getFullYear(), currentMonth.getMonth()) !== key) {
          console.log(`[MonthlyCalendar] key changed, ignore ${key.slice(0,60)}`);
          return;
        }
        console.log(`[MonthlyCalendar] response ${year}-${String(month+1).padStart(2,"0")} entries=${(data as any)?.entries?.length} captcha=${isCaptchaRequired(data)}`, data);

        if (isCaptchaRequired(data)) {
          console.log(`[MonthlyCalendar] CAPTCHA_REQUIRED ${year}-${String(month+1).padStart(2,"0")}`);
          checkResponseForCaptcha(data);
          return;
        }

        const result = data as SupplierPriceCalendarResult;
        const isEmpty = result.entries.length > 0 && result.entries.every((e) => e.price === null);
        console.log(`[MonthlyCalendar] success ${year}-${String(month+1).padStart(2,"0")} isEmpty=${isEmpty} totalScanned=${result.totalOffersScanned}`);
        // SUCCESS vs EMPTY: if all null -> EMPTY, else SUCCESS
        if (isEmpty) {
          // Preserve EMPTY distinct from ERROR
          setErrorKind("EMPTY");
          // Still cache EMPTY? No — don't cache empty as success, but keep entries for display
        } else {
          setErrorKind(null);
        }
        // Cache only successful real result
        globalCalendarCache.set(key, { entries: result.entries, lastUpdated: new Date(result.fetchedAt) });
        setSessionCache(key, result.entries, new Date(result.fetchedAt));
        setEntries(result.entries);
        setLastUpdated(new Date(result.fetchedAt));
        setError(null);
      } catch (err: any) {
        globalInflight.delete(key);
        if (err?.name === "AbortError" || String(err?.message).includes("aborted") || String(err?.message).includes("AbortError")) {
          console.log(`[MonthlyCalendar] abort ignored ${year}-${String(month+1).padStart(2,"0")}`);
          return;
        }
        if (requestId !== requestIdRef.current) {
          console.log(`[MonthlyCalendar] catch stale ignored ${key.slice(0,60)}`);
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[MonthlyCalendar] ERROR ${year}-${String(month+1).padStart(2,"0")} msg=${msg}`, err);
        if (msg.includes("CAPTCHA_REQUIRED")) return;
        if (msg.includes("503") || msg.includes("500") || msg.includes("Concurrency") || msg.includes("Rate limit") || msg.includes("circuit is OPEN") || msg.includes("Too Many") || msg.includes("Internal Server Error")) {
          console.log(`[MonthlyCalendar] 500/503 retry ${year}-${String(month+1).padStart(2,"0")} in 1.2s msg=${msg.slice(0,120)}`);
          setTimeout(() => fetchMonth(forceRefresh), 1200);
          setError("Слишком много запросов, повторная попытка...");
          setErrorKind("ERROR");
          return;
        }
        // Distinguish EMPTY already handled above; here is ERROR
        setErrorKind("ERROR");
        if (msg.includes("supports nights") || msg.includes("UNSUPPORTED")) setError(t("supplier.error.unsupported", locale));
        else if (msg.includes("timeout") || msg.includes("TIMEOUT")) setError(t("supplier.error.timeout", locale));
        else if (msg.includes("no price_info") || msg.includes("NO_RESULT")) {
          setErrorKind("EMPTY");
          setError(null);
        } else setError(t("supplier.error.generic", locale));
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [baseQuery, currentMonth, locale, checkResponseForCaptcha],
  );

  // Trigger fetch on mount / month change / baseQuery change
  useEffect(() => {
    fetchMonth(false);
  }, [fetchMonth]);

  // Build entry map for current month grid (only entries of this month are in `entries`)
  const entryMap = useMemo(() => {
    const map = new Map<string, SupplierPriceCalendarEntry>();
    for (const e of entries) map.set(e.date.slice(0, 10), e);
    return map;
  }, [entries]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDow = (firstDay.getDay() + 6) % 7;
    const toLocalDateStr = (d: Date): string => {
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const day = d.getDate();
      return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    };
    const days: Array<{ date: Date; dateStr: string; isCurrentMonth: boolean; entry: SupplierPriceCalendarEntry | null }> = [];
    for (let i = 0; i < startDow; i++) {
      const d = new Date(year, month, -(startDow - 1 - i));
      days.push({ date: d, dateStr: toLocalDateStr(d), isCurrentMonth: false, entry: null });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dateStr = toLocalDateStr(d);
      days.push({ date: d, dateStr, isCurrentMonth: true, entry: entryMap.get(dateStr) ?? null });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, dateStr: toLocalDateStr(d), isCurrentMonth: false, entry: null });
    }
    return days;
  }, [currentMonth, entryMap]);

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const monthLabel = currentMonth.toLocaleDateString(locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US", {
    year: "numeric",
    month: "long",
  });
  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  const isEmptyState = !loading && !error && !challenge && entries.length > 0 && entries.every((e) => e.price === null);

  return (
    <div className="space-y-3">
      {challenge && (
        <KompasCaptchaModal
          challengeId={challenge.challengeId}
          captchaImage={challenge.captchaImage}
          status={challenge.status as any}
          onSubmit={async (answer) => {
            await submit(answer, (data) => {
              const result = data as SupplierPriceCalendarResult;
              const key = buildCacheKey(baseQuery, currentMonth.getFullYear(), currentMonth.getMonth());
              globalCalendarCache.set(key, { entries: result.entries, lastUpdated: new Date(result.fetchedAt) });
              setSessionCache(key, result.entries, new Date(result.fetchedAt));
              setEntries(result.entries);
              setLastUpdated(new Date(result.fetchedAt));
              setError(null);
              setErrorKind(null);
            });
          }}
          onRefresh={refresh}
          onCancel={cancel}
        />
      )}

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50" aria-label="Previous month">‹</button>
        <h4 className="text-sm font-semibold text-slate-800">{monthLabel}</h4>
        <button onClick={nextMonth} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50" aria-label="Next month">›</button>
      </div>

      {loading && (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && errorKind === "ERROR" && error && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">{error}</p>
          <button onClick={() => fetchMonth(true)} className="mt-2 text-sm text-amber-600 underline hover:text-amber-800">
            {t("supplier.retry", locale)}
          </button>
        </div>
      )}

      {!loading && isEmptyState && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-sm text-slate-500">{t("supplier.calendar.empty", locale) ?? "Нет предложений на этот месяц"}</p>
        </div>
      )}

      {!loading && !error && !isEmptyState && (
        <>
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => (
              <div key={day} className="py-1 text-center text-xs font-medium text-slate-500">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const isAvailable = day.isCurrentMonth && day.entry && day.entry.availability === "AVAILABLE" && day.entry.price !== null;
              const isToday = day.dateStr === new Date().toISOString().slice(0, 10);
              return (
                <button
                  key={day.dateStr}
                  onClick={() => isAvailable && onSelect?.(day.entry!)}
                  disabled={!isAvailable}
                  className={`relative h-16 rounded-lg border p-1.5 text-left transition-colors ${!day.isCurrentMonth ? "border-transparent bg-transparent" : isAvailable ? "border-green-200 bg-green-50 hover:bg-green-100 cursor-pointer" : day.entry?.absenceCode ? "border-amber-200 bg-amber-50 cursor-not-allowed" : "border-slate-100 bg-slate-50/50 cursor-not-allowed"} ${isToday ? "ring-2 ring-blue-400" : ""}`}
                >
                  <div className={`text-xs font-medium ${day.isCurrentMonth ? "text-slate-700" : "text-slate-300"}`}>{day.date.getDate()}</div>
                  {isAvailable && day.entry!.price !== null ? (
                    <div className="mt-0.5 text-[11px] font-bold text-green-700">
                      <Price amount={day.entry!.price} currency={day.entry!.currency} size="sm" withPrefix={false} />
                    </div>
                  ) : day.isCurrentMonth && day.entry?.absenceCode ? (
                    <div className="mt-0.5 text-[9px] text-amber-600 truncate">—</div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Last updated + refresh — only when we have successful data */}
      {lastUpdated && !loading && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-red-600">Последнее обновление цен: {formatLastUpdated(lastUpdated, locale)}</span>
          <button onClick={() => fetchMonth(true)} className="text-blue-600 underline hover:text-blue-800">
            Обновить цены
          </button>
        </div>
      )}
      {loading && lastUpdated && (
        <div className="text-xs text-slate-400">Обновление...</div>
      )}
    </div>
  );
}
