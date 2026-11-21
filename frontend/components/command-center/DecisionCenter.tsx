"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useLocale, type Locale } from "@/lib/i18n";
import { saReconciliationKind } from "@/lib/sales-analytics-i18n";

/**
 * Decision Center — replaces the old Command Center dashboard.
 *
 * The screen is intentionally action-oriented: it does not duplicate the
 * reporting KPI cards from Analytics/Sales Analytics. Each block answers
 * "what needs a decision now?" and links to the records behind the signal.
 */

type Copy = {
  title: string;
  subtitle: string;
  loading: string;
  error: string;
  attention: string;
  overdue: string;
  cancellations: string;
  reconciliation: string;
  receivable: string;
  critical: string;
  criticalHint: string;
  money: string;
  received: string;
  paidSuppliers: string;
  clientDebt: string;
  supplierDebt: string;
  accumulated: string;
  commercial: string;
  expectedGmv: string;
  actualGmv: string;
  executedGmv: string;
  lostGmv: string;
  dataQuality: string;
  noSignals: string;
  open: string;
  deals: string;
  bookings: string;
  analytics: string;
  period: string;
};

const COPY: Record<Locale, Copy> = {
  ru: {
    title: "Центр принятия решений",
    subtitle: "Сигналы, риски и решения на сегодня",
    loading: "Загрузка сигналов…",
    error: "Не удалось загрузить сигналы.",
    attention: "Требуют внимания",
    overdue: "Просроченные заявки",
    cancellations: "Отмены",
    reconciliation: "Расхождения",
    receivable: "Долг клиентов",
    critical: "Критические сигналы",
    criticalHint: "Сначала — то, что требует действия, а не просто цифра.",
    money: "Деньги и долги",
    received: "Поступления от клиентов",
    paidSuppliers: "Оплачено поставщикам",
    clientDebt: "Дебиторская задолженность",
    supplierDebt: "Кредиторская задолженность",
    accumulated: "Накопленные средства по сделкам",
    commercial: "Коммерческая сводка",
    expectedGmv: "Ожидаемое GMV",
    actualGmv: "Фактическое GMV",
    executedGmv: "Поступило денег",
    lostGmv: "Упущенный GMV",
    dataQuality: "Качество данных",
    noSignals: "Критических сигналов нет.",
    open: "Открыть",
    deals: "Сделки",
    bookings: "Брони",
    analytics: "Аналитика",
    period: "Период",
  },
  az: {
    title: "Qərar Mərkəzi",
    subtitle: "Bugün üçün siqnallar, risklər və qərarlar",
    loading: "Siqnallar yüklənir…",
    error: "Siqnalları yükləmək mümkün olmadı.",
    attention: "Diqqət tələb edir",
    overdue: "Gecikmiş müraciətlər",
    cancellations: "Ləğvlər",
    reconciliation: "Fərqlər",
    receivable: "Müştəri borcu",
    critical: "Kritik siqnallar",
    criticalHint: "Əvvəlcə hərəkət tələb edənlər, sadəcə rəqəm deyil.",
    money: "Pul və borclar",
    received: "Müştərilərdən daxilolmalar",
    paidSuppliers: "Təchizatçılara ödənilib",
    clientDebt: "Debitor borcu",
    supplierDebt: "Kreditor borcu",
    accumulated: "Sövdələr üzrə yığılmış vəsaitlər",
    commercial: "Kommersiya icmalı",
    expectedGmv: "Gözlənilən GMV",
    actualGmv: "Faktiki GMV",
    executedGmv: "Daxil olan pul",
    lostGmv: "İtirilmiş GMV",
    dataQuality: "Məlumat keyfiyyəti",
    noSignals: "Kritik siqnal yoxdur.",
    open: "Aç",
    deals: "Sövdələr",
    bookings: "Rezervasiyalar",
    analytics: "Analitika",
    period: "Dövr",
  },
  en: {
    title: "Decision Center",
    subtitle: "Signals, risks and decisions for today",
    loading: "Loading signals…",
    error: "Failed to load signals.",
    attention: "Needs attention",
    overdue: "Overdue requests",
    cancellations: "Cancellations",
    reconciliation: "Variances",
    receivable: "Client debt",
    critical: "Critical signals",
    criticalHint: "Action first — not just another number.",
    money: "Cash and debts",
    received: "Client receipts",
    paidSuppliers: "Paid to suppliers",
    clientDebt: "Accounts receivable",
    supplierDebt: "Accounts payable",
    accumulated: "Accumulated cash on deals",
    commercial: "Commercial summary",
    expectedGmv: "Expected GMV",
    actualGmv: "Actual GMV",
    executedGmv: "Cash received",
    lostGmv: "Lost GMV",
    dataQuality: "Data quality",
    noSignals: "No critical signals.",
    open: "Open",
    deals: "Deals",
    bookings: "Bookings",
    analytics: "Analytics",
    period: "Period",
  },
};


const EXTRA: Record<Locale, Record<string, string>> = {
  ru: {
    approvals: "Согласования", pendingApprovals: "Ожидают решения", noApprovals: "Нет ожидающих согласований",
    bottlenecks: "Операционные узкие места", noFirstResponse: "Без первого ответа", overdueRequests: "Просроченные заявки",
    waitingCustomer: "Ожидают клиента", waitingSupplier: "Ожидают поставщика", awaitingConfirmation: "Брони без подтверждения",
    readyForBooking: "Готовы к брони, не отправлены", problemBookings: "Проблемные брони",
    marginRisks: "Риски маржи", negativeMargin: "Отрицательная маржа", lowMargin: "Маржа ниже 5%", missingCost: "Без себестоимости",
    noMarginRisks: "Рисков маржи нет", journal: "Журнал решений", noDecisions: "Решений пока нет",
  },
  az: {
    approvals: "Təsdiqlər", pendingApprovals: "Qərar gözləyir", noApprovals: "Gözləyən təsdiq yoxdur",
    bottlenecks: "Əməliyyat darboğazları", noFirstResponse: "İlk cavabsız", overdueRequests: "Gecikmiş müraciətlər",
    waitingCustomer: "Müştəri gözləyir", waitingSupplier: "Təchizatçı gözləyir", awaitingConfirmation: "Təsdiqsiz rezervasiyalar",
    readyForBooking: "Rezervasiyaya hazır, göndərilməyib", problemBookings: "Problemli rezervasiyalar",
    marginRisks: "Marja riskləri", negativeMargin: "Mənfi marja", lowMargin: "Marja 5%-dən aşağı", missingCost: "Maya dəyəri yoxdur",
    noMarginRisks: "Marja riski yoxdur", journal: "Qərarlar jurnalı", noDecisions: "Hələ qərar yoxdur",
  },
  en: {
    approvals: "Approvals", pendingApprovals: "Pending decisions", noApprovals: "No pending approvals",
    bottlenecks: "Operational bottlenecks", noFirstResponse: "No first response", overdueRequests: "Overdue requests",
    waitingCustomer: "Waiting for customer", waitingSupplier: "Waiting for supplier", awaitingConfirmation: "Awaiting confirmation",
    readyForBooking: "Ready for booking, not sent", problemBookings: "Problem bookings",
    marginRisks: "Margin risks", negativeMargin: "Negative margin", lowMargin: "Margin below 5%", missingCost: "Missing cost",
    noMarginRisks: "No margin risks", journal: "Decision log", noDecisions: "No decisions yet",
  },
};

const PRESET_QUERY = "preset=CURRENT_MONTH&timezone=Asia%2FBaku";

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function DecisionCenter() {
  const locale = useLocale();
  const c = COPY[locale] ?? COPY.ru;
  const x = EXTRA[locale] ?? EXTRA.ru;
  const [data, setData] = useState<any>(null);
  const [finance, setFinance] = useState<any>(null);
  const [context, setContext] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const summary = await api.get<any>(`/sales-analytics/dashboard?${PRESET_QUERY}`);
        if (!alive) return;
        setData(summary);
        const start = String(summary.period?.start ?? "").slice(0, 10);
        const end = summary.period?.end
          ? new Date(new Date(summary.period.end).getTime() - 1).toISOString().slice(0, 10)
          : start;
        if (start && end) {
          const deals = await api.get<any>(`/finance/deals?pageSize=1&dateFrom=${start}&dateTo=${end}`);
          if (alive) setFinance(deals.kpi ?? null);
          const ctx = await api.get<any>("/finance/deals/decision-context");
          if (alive) setContext(ctx);
        }
      } catch (e) {
        if (alive) setError((e as Error).message || c.error);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [c.error]);

  const view = useMemo(() => {
    const k = data?.kpis ?? {};
    const issues: any[] = data?.reconciliation?.issues ?? [];
    const lost = num(k.lostRequests?.value);
    const overdue = num(k.overdueRequests?.value);
    const cancelledOrders = num(k.cancelledOrders?.value);
    const cancelledBookings = num(k.cancelledBookings?.value);
    const clientDebt = num(finance?.clientDebt);
    const supplierDebt = num(finance?.supplierDebt);
    const signalCount = overdue + lost + issues.length;
    const money = (v: unknown) => `${num(v).toLocaleString(locale === "az" ? "az-AZ" : locale === "en" ? "en-GB" : "ru-RU", { maximumFractionDigits: 2 })} ${finance?.currency ?? "AZN"}`;
    const activityBaseHref = `/app/analytics/sales/activity?${PRESET_QUERY}`;
    const activityHref = `${activityBaseHref}&activityFilter=overdue`;
    const signals = [
      { title: c.overdue, count: overdue, href: activityHref, tone: "amber" },
      { title: c.cancellations + " · " + c.deals, count: cancelledOrders, href: "/app/finance/deals?statusGroup=cancelled", tone: "rose" },
      { title: c.cancellations + " · " + c.bookings, count: cancelledBookings, href: "/app/finance/deals?statusGroup=cancelled", tone: "rose" },
      { title: c.reconciliation, count: issues.length, href: "#data-quality", tone: "rose" },
    ].filter((s) => s.count > 0);
    return { k, issues, lost, overdue, cancelledOrders, cancelledBookings, clientDebt, supplierDebt, signalCount, money, signals, activityBaseHref, activityHref };
  }, [data, finance, locale, c]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f4ef] p-6 lg:p-10">
        <h1 className="text-2xl font-bold text-ink">{c.title}</h1>
        <p className="mt-2 text-sm text-ink/60">{c.loading}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f6f4ef] p-6 lg:p-10">
        <h1 className="text-2xl font-bold text-ink">{c.title}</h1>
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      </div>
    );
  }

  const periodLabel = data?.period
    ? `${new Date(data.period.start).toLocaleDateString(locale === "az" ? "az-AZ" : locale === "en" ? "en-GB" : "ru-RU")} — ${new Date(new Date(data.period.end).getTime() - 1).toLocaleDateString(locale === "az" ? "az-AZ" : locale === "en" ? "en-GB" : "ru-RU")}`
    : "";

  return (
    <div className="min-h-screen bg-[#f6f4ef] p-4 text-ink lg:p-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{c.title}</h1>
          <p className="mt-1 text-sm text-ink/60">{c.subtitle} · {c.period}: {periodLabel}</p>
        </div>
        <Link href={`/app/analytics/sales?${PRESET_QUERY}`} className="rounded-lg border border-[#e5e2da] bg-white px-3 py-1.5 text-xs hover:bg-panel">{c.analytics} →</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: c.attention, value: view.signalCount, tone: "border-amber-200 bg-amber-50 text-amber-800", href: view.activityHref },
          { label: c.overdue, value: view.overdue, tone: "border-rose-200 bg-rose-50 text-rose-800", href: `/app/analytics/sales/activity?${PRESET_QUERY}&activityFilter=overdue` },
          { label: c.reconciliation, value: view.issues.length, tone: "border-rose-200 bg-rose-50 text-rose-800", href: "#data-quality" },
          { label: c.receivable, value: view.money(view.clientDebt), tone: "border-[#e5e2da] bg-white text-ink", href: "/app/finance/deals?hasClientDebt=1" },
        ].map((card) => (
          <Link key={card.label} href={card.href} className={`rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${card.tone}`}>
            <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{card.label}</div>
            <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">{card.value}</div>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[#e5e2da] bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">{c.critical}</h2>
            <p className="text-[11px] text-ink/50">{c.criticalHint}</p>
          </div>
          {view.signals.length === 0 ? <div className="text-xs text-ink/60">{c.noSignals}</div> : (
            <div className="space-y-2">
              {view.signals.map((s) => (
                <Link key={s.title} href={s.href} className="flex items-center justify-between gap-3 rounded-lg border border-[#ece9e2] px-3 py-2 text-xs transition hover:bg-[#f8f7f3]">
                  <span className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${s.tone === "rose" ? "bg-rose-500" : "bg-amber-500"}`} />
                    <span>{s.title}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <b className="font-mono">{s.count}</b>
                    <span className="text-ink/40">→</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#e5e2da] bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">{c.money}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              [c.received, finance?.clientReceived],
              [c.paidSuppliers, finance?.supplierPaid],
              [c.clientDebt, finance?.clientDebt],
              [c.supplierDebt, finance?.supplierDebt],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-[#ece9e2] p-3">
                <div className="text-[10px] uppercase tracking-wide text-ink/50">{label}</div>
                <div className="mt-1 font-mono text-lg font-semibold">{view.money(value)}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-[#cfe5dc] bg-[#f2faf7] p-3">
            <div className="text-[10px] uppercase tracking-wide text-ink/50">{c.accumulated}</div>
            <div className="mt-1 font-mono text-xl font-semibold text-[#0f6b5f]">{view.money(num(finance?.clientReceived) - num(finance?.clientRefunded) - num(finance?.supplierPaid) + num(finance?.supplierRefunded))}</div>
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[#e5e2da] bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">{c.commercial}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              [c.expectedGmv, finance?.expectedGmv],
              [c.actualGmv, finance?.actualGmv],
              [c.executedGmv, finance?.executedGmv],
              [c.lostGmv, finance?.lostGmv],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-[#ece9e2] p-3">
                <div className="text-[10px] uppercase tracking-wide text-ink/50">{label}</div>
                <div className="mt-1 font-mono text-lg font-semibold">{view.money(value)}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="data-quality" className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-rose-800">{c.dataQuality}</h2>
          {view.issues.length === 0 ? <div className="text-xs text-rose-700/70">{c.noSignals}</div> : (
            <div className="space-y-1.5">
              {view.issues.slice(0, 8).map((x, i) => (
                <div key={i} className="flex items-center justify-between gap-2 border-t border-rose-100 py-1 text-[11px] text-rose-900/80">
                  <span className="font-mono">{x.orderCode}</span>
                  <span className="truncate">{saReconciliationKind(locale, String(x.kind))}</span>
                  <b className="font-mono">{view.money(x.amount)}</b>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-[#e5e2da] bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">{x.approvals}</h2>
          <div className="rounded-lg border border-[#ece9e2] p-3">
            <div className="text-[10px] uppercase tracking-wide text-ink/50">{x.pendingApprovals}</div>
            <div className="mt-1 font-mono text-2xl font-semibold">{context?.approvals?.pending ?? 0}</div>
          </div>
          {(context?.approvals?.pending ?? 0) === 0 && <div className="mt-2 text-[11px] text-ink/50">{x.noApprovals}</div>}
        </section>

        <section className="rounded-xl border border-[#e5e2da] bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">{x.bottlenecks}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              [x.noFirstResponse, context?.bottlenecks?.noFirstResponse, `${view.activityBaseHref}&activityFilter=no_response`],
              [x.overdueRequests, context?.bottlenecks?.overdueRequests, view.activityHref],
              [x.waitingCustomer, context?.bottlenecks?.waitingCustomer, `${view.activityBaseHref}&activityFilter=waiting_customer`],
              [x.waitingSupplier, context?.bottlenecks?.waitingSupplier, `${view.activityBaseHref}&activityFilter=waiting_supplier`],
              [x.awaitingConfirmation, context?.bottlenecks?.awaitingConfirmation, "/app/finance/deals?status=AWAITING_CONFIRMATION"],
              [x.readyForBooking, context?.bottlenecks?.readyForBooking, "/app/finance/deals?status=READY_FOR_BOOKING"],
              [x.problemBookings, context?.bottlenecks?.problemBookings, "/app/finance/deals?status=PROBLEM"],
            ].map(([label, value, href]) => (
              <Link key={String(label)} href={String(href)} className="flex items-center justify-between rounded-lg border border-[#ece9e2] px-3 py-2 text-xs transition hover:bg-[#f8f7f3]">
                <span className="text-ink/60">{label}</span><b className="font-mono">{num(value)}</b>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[#e5e2da] bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">{x.marginRisks}</h2>
          <div className="space-y-1.5">
            {[
              [x.negativeMargin, context?.margin?.negativeCount],
              [x.lowMargin, context?.margin?.lowMarginCount],
              [x.missingCost, context?.margin?.missingCostCount],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between border-t border-[#f0eee8] py-1.5 text-xs">
                <span className="text-ink/60">{label}</span><b className="font-mono">{num(value)}</b>
              </div>
            ))}
          </div>
          {num(context?.margin?.negativeCount) + num(context?.margin?.lowMarginCount) + num(context?.margin?.missingCostCount) === 0 && <div className="mt-2 text-[11px] text-ink/50">{x.noMarginRisks}</div>}
        </section>

        <section className="rounded-xl border border-[#e5e2da] bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">{x.journal}</h2>
          {(context?.recentDecisions ?? []).length === 0 ? <div className="text-[11px] text-ink/50">{x.noDecisions}</div> : (
            <div className="space-y-1.5">
              {(context.recentDecisions ?? []).slice(0, 8).map((d: any) => (
                <div key={d.id} className="flex items-center justify-between gap-2 border-t border-[#f0eee8] py-1.5 text-[11px]">
                  <span className="truncate">{d.action} · {d.username ?? "—"}</span>
                  <span className="shrink-0 text-ink/50">{new Date(d.createdAt).toLocaleDateString(locale === "az" ? "az-AZ" : locale === "en" ? "en-GB" : "ru-RU")}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
