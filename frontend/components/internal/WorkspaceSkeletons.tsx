"use client";

import type { ReactNode } from "react";
import { t, useLocale } from "@/lib/i18n";

/**
 * §SKELETON-PARITY (2026-10-16) — каркасы загрузки внутреннего контура `/app/*`.
 *
 * Зачем: до этой правки весь сегмент `/app` (42 страницы) обслуживал ОДИН
 * скелетон `app/app/loading.tsx` формы «плавающий заголовок + 4 KPI-плитки
 * `h-24` + белая карточка-реестр». Реальных внешних раскладок — 16 (Operations
 * Center с таб-полосой, detail-страницы с двумя полосами-шапками, формы
 * `max-w-3xl`, очереди `lg:grid-cols-2`, канвас конструктора и т.д.), поэтому
 * переход из левого меню показывал «чужую» страницу-призрак.
 *
 * Правило: каждый каркас повторяет ТОЛЬКО внешнюю геометрию реальной страницы —
 * отступы, полосы-шапки, сетки, радиусы, тему — и не содержит цифр и текстов
 * (аудит: `docs/audit/FRONTEND_RENDERING_CLEANUP_PLAN.md`, раздел «SKELETON-PARITY»).
 * Источник истины указан в комментарии к каждому каркасу (`file:line`).
 */

/** Общая обёртка: статус загрузки + скрытая подпись (тот же контракт, что у старых loading.tsx). */
function SkeletonFrame({ className = "", children }: { className?: string; children: ReactNode }) {
  const locale = useLocale();
  return (
    <div className={className} role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t("state.loading", locale)}</span>
      {children}
    </div>
  );
}

/** N пульсирующих блоков заданной формы (используется внутри `space-y-*`/`divide-y`). */
function Blocks({ count, className }: { count: number; className: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`animate-pulse ${className}`} />
      ))}
    </>
  );
}

/**
 * Полоса-шапка страницы = `components/PageHeader.tsx:20`
 * (`flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4`,
 * хлебные крошки `text-xs` :22, h1 `mt-0.5 text-lg font-bold` :30).
 */
function HeaderStrip({ actions = true }: { actions?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
      <div>
        <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
        <div className="mt-1 h-6 w-48 animate-pulse rounded bg-slate-200" />
      </div>
      {actions && <div className="h-9 w-28 animate-pulse rounded-lg bg-slate-100" />}
    </div>
  );
}

/**
 * KPI-строка = `components/Kpi.tsx:25` (`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6`)
 * + карточка :66 (`flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm`,
 * высота ≈ 62px: `py-3`×2 + иконка `size-9`). Не `h-24`/`rounded-2xl`, как было в прежнем скелетоне.
 */
function KpiRow({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      <Blocks count={count} className="h-[62px] rounded-xl border border-slate-200 bg-white" />
    </div>
  );
}

/** Панель-реестр = `OperationsRegistrySlot` (`OperationsCenterShell.tsx:279`). */
function RegistryPanel({ rows = 5, header = true }: { rows?: number; header?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {header && (
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
        </div>
      )}
      <div className="space-y-2 p-4">
        <Blocks count={rows} className="h-10 rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}

/** Строка-фильтр/тулбар = `flex flex-wrap items-center gap-2` (`users/page.tsx:204`, `finance/obligations/page.tsx:131`). */
function ToolbarRow() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="h-9 w-56 animate-pulse rounded-lg border border-slate-200 bg-white" />
      <div className="h-9 w-32 animate-pulse rounded-lg border border-slate-200 bg-white" />
    </div>
  );
}

/* ── Сегментный скелетон по умолчанию ─────────────────────────────────────── */

/**
 * Нейтральный каркас `/app/*` по умолчанию — самая частая форма (10+ разделов:
 * `catalog`, `marketing`, `geography`, `hotel-directory`, `finance/*`,
 * `pricing/markup`): полоса-шапка `PageHeader` + контент `space-y-4 p-6`.
 * Без KPI-строки — её нет у большинства разделов (для страниц с KPI есть
 * `WorkspaceKpiPageSkeleton`).
 *
 * `toolbar` добавляет строку фильтров `flex flex-wrap items-center gap-2` —
 * она есть у реестров с фильтрами (`finance/obligations/page.tsx:131`), но не у всех.
 */
export function WorkspacePageSkeleton({ toolbar = false }: { toolbar?: boolean } = {}) {
  return (
    <SkeletonFrame className="flex min-w-0 flex-1 flex-col">
      <HeaderStrip />
      <div className="space-y-4 p-6">
        {toolbar && <ToolbarRow />}
        <RegistryPanel rows={6} />
      </div>
    </SkeletonFrame>
  );
}

/** То же, но с KPI-строкой: `users`, `catalog`, `marketing`, `support` (`Kpi` + `space-y-4 p-6`). */
export function WorkspaceKpiPageSkeleton() {
  return (
    <SkeletonFrame className="flex min-w-0 flex-1 flex-col">
      <HeaderStrip />
      <div className="space-y-4 p-6">
        <KpiRow />
        <ToolbarRow />
        <RegistryPanel rows={6} />
      </div>
    </SkeletonFrame>
  );
}

/* ── Дашборд финансов (finance/overview) ─────────────────────────────────── */

/**
 * `finance/overview/page.tsx:187-205` — под полосой `PageHeader` контент
 * `space-y-6 p-6`: сетка метрик `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` (:193)
 * и две сетки по две карточки `grid gap-4 sm:grid-cols-2` (:198, :202);
 * карточка — `rounded-xl border border-slate-200 bg-white p-4 shadow-sm`
 * (`AznCard` :47, `CurrencyBreakdown` :78, `ObligationsCard` :102).
 * Отличие от `WorkspacePageSkeleton`: там `space-y-4` + панель-реестр (таблица),
 * здесь `space-y-6` + сетки карточек — до этой правки у страницы вообще не было
 * fallback (`<Suspense>` без `fallback`), то есть при пререндере контент был ПУСТ.
 */
export function MetricsPageSkeleton() {
  return (
    <SkeletonFrame className="flex min-w-0 flex-1 flex-col">
      <HeaderStrip />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Blocks count={3} className="h-32 rounded-xl border border-slate-200 bg-white shadow-sm" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Blocks count={2} className="h-32 rounded-xl border border-slate-200 bg-white shadow-sm" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Blocks count={2} className="h-32 rounded-xl border border-slate-200 bg-white shadow-sm" />
        </div>
      </div>
    </SkeletonFrame>
  );
}

/* ── Центр операций (requests / orders / bookings / payments / documents) ─── */

/**
 * Полный каркас `OperationsCenterShell.tsx:230-263`: полоса-шапка `border-b bg-white`
 * с хлебными крошками (:233), h1 `text-2xl` (:247), глобальным периодом и
 * таб-полосой (:88-119), затем контент `mx-auto max-w-[1440px] px-6 py-5` (:263)
 * с KPI (`CommerceKpiCard`), тулбаром (:274) и реестром (:279).
 */
export function OperationsPageSkeleton() {
  return (
    <SkeletonFrame className="flex h-full flex-col">
      <div className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-[1440px] px-6 pt-5">
          <div className="mb-2 h-3 w-56 animate-pulse rounded bg-slate-100" />
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
            <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
            <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-100" />
          </div>
          <div className="-mb-px flex items-center gap-1 overflow-x-auto pb-px">
            <Blocks count={5} className="h-9 w-28 shrink-0 rounded-t-lg bg-slate-100" />
          </div>
        </div>
      </div>
      <div className="thin-scroll flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1440px] px-6 py-5">
          <div className="space-y-4">
            <KpiRow />
            <ToolbarRow />
            <RegistryPanel rows={5} />
          </div>
        </div>
      </div>
    </SkeletonFrame>
  );
}

/* ── Detail-страницы (две полосы-шапки + сетка) ───────────────────────────── */

/**
 * Каркас detail-страницы: `EntityDetailShell.tsx:17,19` / свой каркас
 * (`catalog/[id]/page.tsx:67,74,87`) — `flex h-full flex-col` + `PageHeader`
 * (h1 `text-lg`) + вторичная полоса `border-b bg-white px-6 py-4` +
 * `flex-1 overflow-y-auto p-6` с сеткой `EntityDetailLayout.tsx:21`
 * (`grid grid-cols-1 gap-4 lg:grid-cols-3`) и карточками
 * `EntitySectionCard.tsx:19` (`rounded-xl border border-slate-200 bg-white p-4`).
 */
export function EntityDetailSkeleton() {
  return (
    <SkeletonFrame className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <div className="h-3 w-44 animate-pulse rounded bg-slate-100" />
          <div className="mt-1 h-6 w-56 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="flex items-center gap-2">
          <Blocks count={2} className="h-9 w-24 rounded-lg bg-slate-100" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-6 border-b border-slate-200 bg-white px-6 py-4">
        <Blocks count={4} className="h-4 w-28 rounded bg-slate-100" />
      </div>
      <div className="thin-scroll flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <Blocks count={2} className="h-48 rounded-xl border border-slate-200 bg-white" />
          </div>
          <div className="min-w-0 space-y-4 lg:col-span-1">
            <Blocks count={2} className="h-32 rounded-xl border border-slate-200 bg-white" />
          </div>
        </div>
      </div>
    </SkeletonFrame>
  );
}

/* ── Дашборд / аналитика / командный центр ───────────────────────────────── */

/**
 * `p-6 lg:p-10` + h1 `text-2xl` (`dashboard/page.tsx:114-115`) + сетка карточек
 * `mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3` (:117), карточка
 * `rounded-2xl border border-slate-200 bg-white p-5 shadow-sm` (:122).
 */
export function DashboardPageSkeleton() {
  return (
    <SkeletonFrame className="p-6 lg:p-10">
      <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Blocks count={6} className="h-40 rounded-2xl border border-slate-200 bg-white" />
      </div>
    </SkeletonFrame>
  );
}

/* ── Формы создания (requests/new, orders/new, bookings/new, support/new) ─── */

/**
 * `ManualCreateForm.tsx:219` — `mx-auto max-w-3xl space-y-4 p-6`, h1 `text-xl` (:221),
 * карточка :267 (`space-y-4 rounded-xl border border-slate-200 bg-white p-6`) с сеткой
 * полей :268 (`grid grid-cols-1 gap-4 sm:grid-cols-2`).
 * `support/new` (`page.tsx:38,42,50`) — `PageHeader` + `max-w-xl space-y-5 p-6` + карточка.
 */
export function FormPageSkeleton({
  maxWidth = "max-w-3xl",
  header = false,
}: {
  maxWidth?: string;
  header?: boolean;
}) {
  return (
    <SkeletonFrame className="flex min-w-0 flex-1 flex-col">
      {header && <HeaderStrip />}
      <div className={`mx-auto w-full ${maxWidth} space-y-4 p-6`}>
        <div>
          <div className="h-7 w-56 animate-pulse rounded bg-slate-200" />
          <div className="mt-1.5 h-4 w-72 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                <div className="h-10 w-full animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
              </div>
            ))}
          </div>
          <div className="h-10 w-40 animate-pulse rounded-lg bg-blue-100" />
        </div>
      </div>
    </SkeletonFrame>
  );
}

/* ── Очереди без PageHeader (partners/onboarding, seller-profiles) ────────── */

/**
 * `partners/onboarding/page.tsx:96` / `seller-profiles/page.tsx:129` —
 * корень `space-y-4` БЕЗ page-padding и БЕЗ `PageHeader`, h1 `text-xl`,
 * сетка `grid gap-4 lg:grid-cols-2` (:119) с карточками
 * `rounded-2xl border border-slate-200 bg-white shadow-sm` (:121).
 */
export function QueuePageSkeleton() {
  return (
    <SkeletonFrame className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="h-6 w-56 animate-pulse rounded bg-slate-200" />
          <div className="mt-1 h-3 w-40 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="flex items-center gap-2">
          <Blocks count={2} className="h-8 w-32 rounded-lg border border-slate-200 bg-white" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <section key={i} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-2.5">
              <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 5 }, (_, j) => (
                <div key={j} className="px-4 py-3">
                  <div className="h-4 w-3/5 animate-pulse rounded bg-slate-100" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </SkeletonFrame>
  );
}

/* ── crm: таб-панель под PageHeader ──────────────────────────────────────── */

/**
 * `crm/page.tsx:264-310` — `flex h-full` → `flex min-w-0 flex-1 flex-col` →
 * `PageHeader` → табы `flex gap-1 border-b border-slate-200 bg-slate-50 px-6 pt-2` (:295)
 * → `space-y-4 p-6` (:307) с `Kpi` (:310).
 */
export function TabsPageSkeleton() {
  return (
    <SkeletonFrame className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <HeaderStrip />
        <div className="flex gap-1 border-b border-slate-200 bg-slate-50 px-6 pt-2">
          <Blocks count={3} className="h-9 w-28 rounded-t-lg bg-slate-100" />
        </div>
        <div className="space-y-4 p-6">
          <KpiRow />
          <RegistryPanel rows={6} />
        </div>
      </div>
    </SkeletonFrame>
  );
}

/* ── Конструктор страниц (page-builder) ──────────────────────────────────── */

/**
 * `page-builder/page.tsx:12-17` (`flex min-w-0 flex-1 flex-col` + `PageHeader` + `flex-1 p-6`)
 * и `ConstructorCanvas.tsx:69-132` — заголовок с описанием + табы + две колонки
 * `grid gap-6 lg:grid-cols-[280px_1fr]` (список блоков + канвас).
 */
export function CanvasPageSkeleton() {
  return (
    <SkeletonFrame className="flex min-w-0 flex-1 flex-col">
      <HeaderStrip />
      <div className="flex-1 p-6">
        <div className="flex items-center justify-between pb-4">
          <div>
            <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
            <div className="mt-1 h-4 w-72 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-9 w-32 animate-pulse rounded-lg bg-slate-100" />
        </div>
        <div className="flex gap-1 border-b border-slate-200 pb-2">
          <Blocks count={4} className="h-8 w-24 rounded-t-lg bg-slate-100" />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            <Blocks count={5} className="h-12 rounded-lg border border-slate-200 bg-white" />
          </div>
          <div className="h-80 animate-pulse rounded-lg border border-slate-200 bg-white" />
        </div>
      </div>
    </SkeletonFrame>
  );
}

/* ── Центр помощи (help) ─────────────────────────────────────────────────── */

/**
 * `help/page.tsx:254-329` — `mx-auto w-full max-w-[1200px] px-6 py-6`, h1 `text-2xl` (:256),
 * поиск `max-w-xl` (:261), две строки чипов-фильтров (:295, :314) и контент ниже.
 */
export function HelpPageSkeleton() {
  return (
    <SkeletonFrame className="mx-auto w-full max-w-[1200px] px-6 py-6">
      <div className="mb-5">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-full max-w-3xl animate-pulse rounded bg-slate-100" />
      </div>
      <div className="mb-4 max-w-xl">
        <div className="h-10 w-full animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm" />
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Blocks count={3} className="h-8 w-28 rounded-full bg-slate-100" />
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Blocks count={4} className="h-8 w-24 rounded-full bg-slate-100" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Blocks count={6} className="h-32 rounded-xl border border-slate-200 bg-white" />
      </div>
    </SkeletonFrame>
  );
}

/* ── WhatsApp-центр (whatsapp) ───────────────────────────────────────────── */

/**
 * `whatsapp/page.tsx:330-350` — `space-y-4 p-6`, h1 `text-lg` (:333) + кнопка обновления,
 * затем `grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]` (:348)
 * и три панели `rounded-xl border border-slate-200 bg-white` (:350).
 */
export function WhatsappPageSkeleton() {
  return (
    <SkeletonFrame className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-1 h-3 w-56 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-lg border border-slate-200 bg-white" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        <div className="h-[420px] animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="h-[420px] animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="h-[420px] animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    </SkeletonFrame>
  );
}

/* ── Настройки интеграции (settings/integrations/whatsapp) ───────────────── */

/**
 * `settings/integrations/whatsapp/page.tsx:246` — `space-y-4 px-6 py-4` под `PageHeader`.
 */
export function SettingsPageSkeleton() {
  return (
    <SkeletonFrame className="flex min-w-0 flex-1 flex-col">
      <HeaderStrip />
      <div className="space-y-4 px-6 py-4">
        <RegistryPanel rows={4} />
        <RegistryPanel rows={3} />
      </div>
    </SkeletonFrame>
  );
}

/* ── Документ (documents/[id]) ──────────────────────────────────────────── */

/**
 * `documents/[id]/page.tsx:87-149` — `mx-auto max-w-4xl space-y-6 p-6`,
 * хлебные крошки (:89), h1 `text-2xl` (:107), карточки
 * `rounded-lg border border-slate-200 bg-white p-4` (:134, :149).
 */
export function DocumentPageSkeleton() {
  return (
    <SkeletonFrame className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <div className="h-3 w-48 animate-pulse rounded bg-slate-100" />
      <div className="h-8 w-72 animate-pulse rounded bg-slate-200" />
      <div className="space-y-4">
        <Blocks count={3} className="h-28 rounded-lg border border-slate-200 bg-white" />
      </div>
    </SkeletonFrame>
  );
}
