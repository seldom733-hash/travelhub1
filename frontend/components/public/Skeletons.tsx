"use client";

/** Skeleton карточки продукта (публичный, без реальных данных). */
export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-hidden="true">
      <div className="aspect-[16/9] animate-pulse bg-slate-200" />
      <div className="space-y-2 p-4">
        <div className="h-2.5 w-1/3 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
        <div className="h-5 w-1/2 animate-pulse rounded bg-slate-200 pt-1" />
      </div>
    </div>
  );
}

/** Сетка скелетонов (используется Home/Search/Category). */
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="loading">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Скелетон страницы категории (§SKELETON-PARITY, 2026-10-16): повторяет каркас
 * `app/categories/[slug]/page.tsx:131-204` — хлебные крошки, h1, тулбар-сортировка
 * и сетку `mt-6 grid gap-6 lg:grid-cols-[260px_1fr]` (сайдбар фильтров + сетка карточек).
 * Раньше вместо этой формы рисовалась «голая» сетка на всю ширину, и после загрузки
 * появлялись сайдбар и тулбар — контент «прыгал» вправо и сужался.
 */
export function CategoryPageSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="loading">
      <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
      <div className="mt-2 h-7 w-56 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="h-9 w-40 animate-pulse rounded-lg border border-slate-200 bg-white" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </aside>
        <div>
          <ProductGridSkeleton count={count} />
        </div>
      </div>
    </div>
  );
}

/**
 * Скелетон деталей PDP (breadcrumbs + заголовок + «панель подбора слева / медиа справа»).
 *
 * §PDP-SKELETON-PARITY (2026-10-16): геометрия обязана повторять РЕАЛЬНУЮ карточку
 * тура/отеля (`components/supplier/TourDetail.tsx:131` и `HotelDetail.tsx` —
 * `grid gap-6 lg:grid-cols-[340px_1fr]`: слева панель подбора + «как подать заявку»
 * + календарь цен, справа медиа + панель подачи заявки + описания).
 *
 * До этой правки скелетон оставался от доравенства-раскладки (крупное медиа слева,
 * `h-64` aside справа), и переход на карточку показывал «тень старой карточки»:
 * серые блоки стояли зеркально к финальному виду. Товары TOUR/HOTEL — подавляющее
 * большинство PDP (5478 + 2857), поэтому по умолчанию скелетон повторяет их.
 *
 * §SKELETON-PARITY (2026-10-16, второй проход): три расхождения с живой карточкой —
 * (1) в карточке подбора 4 поля (город/взрослые/дети/ночи, `TourDetail.tsx:141-250`),
 *     а не 3; (2) у синей карточки «Как подать заявку» есть `border-blue-100`
 *     (`:255`); (3) календарь цен — это БЕЛАЯ карточка `rounded-2xl border bg-white p-5`
 *     с навигацией по месяцам и сеткой `grid-cols-7` из дней `h-16`
 *     (`TourDetail.tsx:267-282` + `MonthlyCalendar.tsx:455-483`), а не серый блок `h-64`
 *     (разница по высоте ≈ 400px).
 */
export function PdpSkeleton() {
  return (
    <div aria-busy="true" aria-label="loading">
      {/* Breadcrumbs — `nav.mb-3 text-xs` */}
      <div className="mb-3 h-3 w-2/3 max-w-xs animate-pulse rounded bg-slate-100" />
      {/* H1 `text-2xl sm:text-3xl` + чип категории в `div.mb-6` */}
      <div className="mb-6">
        <div className="h-7 w-3/5 animate-pulse rounded bg-slate-200 sm:h-8" />
        <div className="mt-2 h-5 w-28 animate-pulse rounded-full bg-slate-100" />
      </div>
      <section className="mt-8">
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* ── Слева: панель подбора ── */}
          <div className="space-y-4">
            <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
            {/* карточка фильтров: 4 поля `label + select` (город/взрослые/дети/ночи) */}
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                  <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100" />
                </div>
              ))}
            </div>
            {/* «Как подать заявку» — синяя карточка `border-blue-100 bg-blue-50/70 p-5` */}
            <div className="h-32 animate-pulse rounded-2xl border border-blue-100 bg-blue-50/70" />
            {/* «Календарь цен» — белая карточка: заголовок + навигация + дни недели + сетка 7×6 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 h-4 w-32 animate-pulse rounded bg-slate-100" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 animate-pulse rounded-lg border border-slate-200" />
                  <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
                  <div className="h-8 w-8 animate-pulse rounded-lg border border-slate-200" />
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="py-1 text-center">
                      <div className="mx-auto h-3 w-6 animate-pulse rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 42 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Справа: медиа + панель подачи заявки + описания ── */}
          <div className="space-y-4">
            {/* MediaGallery: `aspect-[16/9] rounded-xl` */}
            <div className="aspect-[16/9] w-full animate-pulse rounded-xl bg-slate-200" />
            {/* «Подать заявку» + «Варианты размещения и цены» */}
            <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        </div>
      </section>
    </div>
  );
}
