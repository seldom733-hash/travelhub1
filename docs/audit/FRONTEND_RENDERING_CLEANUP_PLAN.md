# План очистки и оптимизации рендеринга frontend

Основание: `docs/audit/FRONTEND_RENDERING_LEGACY_AUDIT.md`. Ветка: `audit/frontend-rendering-legacy`.
**Правило:** ни один пункт не выполняется в `master` и не коммитится без отдельного разрешения. Массовое удаление не начиналось.

Обозначения: **Ф** — файлы, **О** — основание (доказательство), **Р** — риск, **П** — порядок, **В** — способ проверки.

---

## Журнал решений и статус

| # | Пункт | Решение | Статус |
|---|---|---|---|
| P0-1 | Turbopack — основной режим разработки | Зафиксировано пользователем: Webpack (`--webpack`) ухудшает и скорость, и память (99–111 с / 1362–1750 МБ против 2.2–12.3 с / 592–831 МБ) | **принято 16.10.2026** |
| P0-2 | Не собирать при живом dev-сервере; чистить `.next` | Зафиксировано как правило | **принято 16.10.2026** (нарушение этого правила привело к инциденту 16.10 12:39 — см. ниже) |
| P1-1 | Удалить `components/marketplace/CompactSearch.tsx` | Согласовано как первая небольшая группа | **выполнено 16.10.2026** |
| P1-2 | Убрать 2 мёртвых импорта (`lib/behavioral-events.ts`) | Согласовано (та же группа) | **выполнено 16.10.2026** |
| P1-3 | `LEGACY_INTERNAL_REDIRECTS` | Оставить как документированный контракт | **принято** |
| P0-3 | Индекс вместо динамического паттерна `public/hotels` | — | следующий шаг (сохранить отдачу фото и 404) |
| P3-1 | Phosphor: A/B-замер точечных импортов | Сначала **только замер**, менять 11–19 файлов после подтверждения гипотезы | ожидает |
| P3-2…P3-5 | Объединение публичных layout, два `Pagination`, i18n, ленивые блоки | Отложено до результатов P0-3/P3-1 | отложено |
| — | Полные E2E, мобильная адаптация, сквозные сценарии конструктора/публикации | Не проверялись (см. границы покрытия в отчёте) | не покрыто |
| — | Skeleton-parity по всему сайту (workspace → публичная часть → кабинеты) | По запросу пользователя: убрать расхождение состояния загрузки и реальной раскладки, фичи не отключать | **выполнено 16.10.2026** — см. раздел «SKELETON-PARITY» ниже |

### Проверка группы P1 (выполнено 16.10.2026)

| Проверка | Команда/метод | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | **exit 0**, 31.1 с |
| Тесты (точечно) | `npx vitest run lib/behavioral-events.spec.tsx --no-file-parallelism` | **16 passed / 16**, exit 0 |
| Тесты (полный прогон) | `npx vitest run --no-file-parallelism` | см. §«Итоговый контроль» (известный исходный сбой `components/supplier/TourDetail.spec.tsx`) |
| Маршрут `/` | `GET /` на dev-сервере (Turbopack, чистый `.next`) | **200**, 12 510 байт; SSR-HTML совпадает с «до»-снимком байт-в-байт по размеру и содержимому, различается только случайный `self.__next_r="…"` |
| Маршрут `/search` | `GET /search` | **200**, 42 123 байта; маркеры панели поиска на месте (`search-glass`, `TravelHub`) |
| Маршрут `/app/dashboard` | `GET /app/dashboard` (с cookie) | **200**, 16 593 байта |
| Остаточные ссылки | полнотекстовый поиск `CompactSearch`, `useLocale`, `usePathname` в правленом файле | 0 |
| `git diff --check` | — | exit 0 |
| Удалённый файл | `components/marketplace/CompactSearch.tsx` | SHA1 до удаления: `53B4CF4F36637B7A79F9E778B015622B22C64996` (восстановимо через `git checkout`) |

**Инцидент 16.10.2026 12:39 (фиксирую честно, как и требует правило «факты отдельно от гипотез»):** во время проверки я очистил `frontend/.next`, не заметив, что на порту 3000 уже работает **пользовательский** dev-сервер (запущен 12:35:40). Это ровно тот сценарий, от которого предупреждает P0-2.

Факты:
- сразу после чистки сервер на 3000 отдавал **500** (453 байта) на всех маршрутах;
- я остановил свой второй dev-сервер (3001), чтобы два сервера не делили один `.next`;
- **повторная проверка того же сервера (без его перезапуска): `GET /app/dashboard` → 200 (16 593 байта), `GET /login` → 200 (15 413 байт)** — сервер пересобрал свои dev-артефакты и восстановился сам.

Итог: данные и код не пострадали, перезапуск не потребовался. Правило P0-2 остаётся обязательным: **перед чисткой `.next` проверять занятость портов 3000/3001 и не запускать второй dev-сервер при живом первом.** Отдельно: конфигурация `next dev` при занятом порте молча уходит на 3001 (`Port 3000 is in use by process … using available port 3001 instead`) — это и маскировало конфликт.

---

## P0 — блокирует запуск / рендеринг

### P0-1. Не использовать `--webpack` для dev; режим по умолчанию — Turbopack
- **Ф:** способ запуска (`npm run dev` без флагов). Кода не касается.
- **О:** Webpack `/` = 99–111 с времени компилятора и 1362–1750 МБ WS; Turbopack `/` = 2.2 с (прогретый) / 12.3 с (первый маршрут холодного сервера) и 592–831 МБ. Замеры — аудит §6.1.
- **Р:** нет.
- **П:** 1.
- **В:** `npm run dev`; `GET /` — ожидание ≤ ~15 с на первом холодном маршруте.

### P0-2. Не запускать `next build` при живом `next dev`; после сборки удалять `.next`
- **Ф:** регламент работ; при инциденте — `Remove-Item -Recurse -Force C:\Projects\Navitravel\frontend\.next` + перезапуск dev.
- **О:** аудит §6.3 H2: после `next build` при работающем dev-сервере `/app/*` перестают распознаваться (все пункты меню → «Страница не найдена»; `/`, `/login`, `/search` при этом 200). Лечится только чисткой `.next`.
- **Р:** нет (профилактика).
- **П:** 1.
- **В:** после любой сборки — зайти в 3–4 пункта левого меню; если 404 — чистка `.next`.

### P0-3. Убрать 2 предупреждения сборки: динамический паттерн `public/hotels` (4603 файла / 920 МБ)
- **Ф:** `frontend/app/hotels/[file]/route.ts` — строки **49:24** и **62:38** (`path.join(PUBLIC_HOTELS, safe)`).
- **О:** `next build` (Turbopack) печатает: `The file pattern ('/ROOT/public/hotels/' <dynamic> | '/ROOT/public/hotels' <dynamic>) matches 18412 files in [project]/ … Overly broad patterns can lead to build performance issues and over bundling.` Собственный комментарий файла («файлов в `public/hotels/` почти нет») устарел: сейчас там 4603 `.webp` (920.5 МБ).
- **Р:** средний — можно сломать отдачу файлов и отрицательный кэш 404 (от него зависел отклик карточек: `lib/hotel-photo.ts` делает probe-запросы).
- **П:** 3 (после P1, чтобы не смешивать изменения).
- **В:**
  1. `next build` → 0 предупреждений;
  2. `GET /hotels/hotel_1.webp` (существующий файл) → `200`, `content-type: image/webp`;
  3. `GET /hotels/htl-does-not-exist.jpg` → `404` + `cache-control`;
  4. замер `Compiling /` до/после (Turbopack), витрина `/search?category=hotels` — фото на месте.

### P0-4. `npm run lint` не работает (нет ESLint и конфига)
- **Ф:** `frontend/package.json` (скрипт `lint: "eslint"`); установка `eslint` + `eslint-config-next` + `eslint.config.mjs`.
- **О:** `npm run lint` → exit 1: `'eslint' is not recognized as an internal or external command`; `node_modules/eslint` отсутствует; `eslint.config.*`/`.eslintrc*` не найдены.
- **Р:** низкий, но это **изменение зависимостей** — по правилам задания требует отдельного решения человека.
- **П:** вне кода, только после согласования: либо поставить ESLint и зафиксировать конфиг, либо удалить скрипт `lint`.
- **В:** `npm run lint` → exit 0 (или скрипт удалён и документирован).

---

## P1 — доказанно неиспользуемый / дублирующий код (безопасное удаление)

> Все пункты P1 — результат одного скана: 343 файла, 1516 строк импорта, проверка basename + полнотекстовый поиск по каждому кандидату. До исправления методики (multi-line imports, `-LiteralPath` для путей с `[id]`) сканы давали ~25 ложных «мёртвых» модулей — см. аудит §3.

### P1-1. ✅ ВЫПОЛНЕНО — Удалить `components/marketplace/CompactSearch.tsx`
- **Ф:** `frontend/components/marketplace/CompactSearch.tsx` (6763 Б).
- **О:** **0 импортёров**. Полнотекстовый поиск `CompactSearch`: только определения внутри самого файла + 3 упоминания **в комментариях** (`app/search/page.tsx:156`, `components/marketplace/search/hotel-search-store.ts:8`, `tour-search-store.ts:7`). Нет теста, нет динамического импорта, нет реестра (единственный реестр — статическая карта `BLOCK_COMPONENTS`, `MarketplaceRenderer.tsx:18-27`). Функционально дублирует `HeroSearch.tsx` (те же 10 форм поиска).
- **Р:** низкий. 10 форм поиска, которые он импортирует, остаются в графе через `HeroSearch`.
- **П:** 1 (первая группа удаления, одна строка `git rm`).
- **В:** `npx tsc --noEmit` → 0; `npx vitest run`; вручную `/` и `/search` — панель поиска и табы на месте.

### P1-2. ✅ ВЫПОЛНЕНО — Убрать мёртвые импорты в `lib/behavioral-events.ts`
- **Ф:** `frontend/lib/behavioral-events.ts`, строки **4** (`import { useLocale } from "@/lib/i18n";`) и **5** (`import { usePathname } from "next/navigation";`).
- **О:** полнотекстовый поиск по файлу: `useLocale` и `usePathname` встречаются только в этих двух строках.
- **Р:** близкий к нулю (оба модуля и так в графе `/`).
- **П:** 1 (та же группа, 2 удалённые строки).
- **В:** `tsc`, `vitest` (есть `lib/behavioral-events.spec.tsx`), проверка отправки поведенческих событий на `/`.

### P1-3. `LEGACY_INTERNAL_REDIRECTS` / `resolveLegacyRedirect` — **оставить** (рекомендация)
- **Ф:** `frontend/lib/routes.ts:54,63`.
- **О:** не вызываются в рантайме (единственный потребитель — `lib/routes.spec.ts:37-47`), но документируют контракт legacy-URL и покрыты тестом. Сами редиректы выполняют page-заглушки (`app/catalog/page.tsx:5` и др.) — они **ACTIVE** и нужны для закладок.
- **Р:** удаление = потеря документации контракта и правка spec без выгоды.
- **П:** не выполнять. Оставить как P3-пункт «осознанный долг».

---

## P1-FIX (вне рамок аудита, по обращению пользователя). Скелетон PDP повторял «старую» карточку

**Симптом:** при переходе на карточку тура (`/products/PRD-0000835`) сначала показывался серый скелетон, по раскладке **зеркальный** финальному виду («тень старой карточки»), и только затем — реальная карточка.

**Причина (доказано кодом):** карточки TOUR/HOTEL строятся как `grid gap-6 lg:grid-cols-[340px_1fr]` — панель подбора слева, медиа справа (`components/supplier/TourDetail.tsx:131`, `HotelDetail.tsx`). `PdpSkeleton` (`components/public/Skeletons.tsx`) остался от прежней раскладки: `grid gap-8 lg:grid-cols-[2fr_1fr]` — крупное медиа СЛЕВА и `h-64` aside справа. Дополнительно Suspense-fallback оборачивался в `p-8`, тогда как `loading.tsx` и сама страница — в `mx-auto max-w-6xl px-4 py-8` (риск горизонтального скачка).

**Изменения:**
- `frontend/components/public/Skeletons.tsx` — `PdpSkeleton` переписан под реальную геометрию: breadcrumbs → H1 + чип → сетка `lg:grid-cols-[340px_1fr]` (слева панель фильтров + синяя карточка «как подать заявку» + карточка календаря; справа медиа `aspect-[16/9]` + панель подачи заявки + блоки описаний). Имя экспорта сохранено — изменились ровно те же 3 точки вызова;
- `frontend/app/products/[slug]/page.tsx` — Suspense-fallback приведён к тем же отступам `mx-auto max-w-6xl px-4 py-8`;
- `frontend/components/public/Skeletons.spec.tsx` — **новый** тест-контракт геометрии (падает, если раскладку снова отведут от карточки).

**Проверка:**

| Проверка | Результат |
|---|---|
| `npx tsc --noEmit` | exit 0, 40.2 с |
| `npx vitest run components/public/Skeletons.spec.tsx` | **3 passed / 3** |
| Релевантные спеки, 11 файлов (`components/public/*`, `components/supplier/*`, `components/storefront/*`, `lib/public-api.spec.ts`, `lib/supplier-registry.spec.ts`) | **63 passed / 1 failed** — падает только исходный `components/supplier/TourDetail.spec.tsx` |
| Полный прогон после P1 (до правки скелетона) | **1077 passed / 1 failed** (67 файлов) — как в baseline, регрессий от P1 нет |
| SSR-разметка живого маршрута `GET http://localhost:3000/products/PRD-0000835` | 200, 20 783 Б; в HTML присутствуют `lg:grid-cols-[340px_1fr]`, `aspect-[16/9]`, `bg-blue-50/70`; старой раскладки `[2fr_1fr]` нет |

**Остаётся (по желанию, отдельная задача):** сам скелетон всё ещё виден, потому что PDP — клиентский компонент с загрузкой в `useEffect` (`app/products/[slug]/page.tsx:34-52`): данные приходят после монтирования. Радикальное устранение скелетона — вынести загрузку в серверный компонент, но это рефакторинг с затрагиванием контрактов данных. Также скелетон теперь повторяет раскладку живой карточки (TOUR/HOTEL — 5478 + 2857 товаров); для редких не-живых типов (например FLIGHT) раскладка отличается, и скелетон для них приблизителен.

---

## SKELETON-PARITY (16.10.2026) — состояние загрузки не совпадало с реальной раскладкой

**Задание пользователя:** найти по всему сайту все места, где skeleton/loading не соответствует итоговой раскладке страницы, и исправить. Порядок: сначала рабочее пространство `/app/*` и разделы левого меню, затем публичная часть и кабинеты. Фичи не отключаются; дизайн, тексты, бизнес-логика, API-контракты, авторизация и маршруты не меняются.

### Методика (что считалось расхождением)

Сравнивалась **геометрия** блока загрузки с реальным рендером по исходникам (`loading.tsx`, in-page `<Suspense fallback>`, локальные `animate-pulse`), а не «на глаз».

| Признак | Источник истины |
|---|---|
| Колонки каркаса / сайдбар | литералы `lg:grid-cols-…` в компоненте карточки |
| Ширина контейнера и отступы | `mx-auto max-w-… px-… py-…` страницы vs fallback |
| Радиус/бордер карточек | `card-premium` / `--th-radius-card` (12px) vs `rounded-2xl` (16px) |
| Число карточек/ячеек/полей | `Array.from({ length: N })` в скелетоне vs реальный cap/список |
| Высота ключевых блоков | `h-64` / `h-16` / `aspect-[16/9]` vs реальная карточка |
| a11y-контракт | `role="status"` / `aria-busy` + sr-only `t("state.loading")` — сохранён везде, где существовал (`loading.tsx` + все каркасы библиотеки); **добавлен** в `documents/[id]` и `payments/[code]`, где его не было; **не добавлен** в две ветки `whatsapp`, где строки обязаны быть прямыми детьми `divide-y`, а обёртка с ролью сломала бы геометрию списка |

**Ключевой факт (доказано кодом, а не гипотеза):** один сегментный skeleton не может соответствовать 16 реальным раскладкам `/app/*`. В рабочем пространстве 41 страница (измерено: `Get-ChildItem -Recurse -LiteralPath app\app -Filter page.tsx` → 41, включая корневой `app/app/page.tsx`) и 16 разных форм каркаса, а единственный `app/app/loading.tsx` обслуживал сразу все маршруты ниже `/app`. Поэтому вместо «подгонки одного скелетона» добавлены **сегментные** `loading.tsx` — идиоматичный механизм Next.js (additive, откат = удаление файлов).

Эталоны геометрии (дословные классы, по ним выверялись скелетоны):

- `components/PageHeader.tsx:20,30` — полоса заголовка страницы;
- `components/Kpi.tsx:25,66` — `grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6`, карточка ≈62px `rounded-xl`;
- `components/OperationsCenterShell.tsx:279` — слот реестра `OperationsRegistrySlot`;
- `components/KpiCard.tsx:85`, `components/commerce/CommerceKpiCard.tsx`, `components/NotAvailableCard.tsx:16`;
- `components/supplier/TourDetail.tsx:131-282` + `MonthlyCalendar.tsx:455-483` — карточка PDP.

### Изменения

**1. Рабочее пространство `/app/*` — 35 `loading.tsx` + библиотека форм.**

- `frontend/components/internal/WorkspaceSkeletons.tsx` — **новый**, 14 форм: `WorkspacePageSkeleton` (+ вариант `toolbar`), `WorkspaceKpiPageSkeleton`, `MetricsPageSkeleton`, `OperationsPageSkeleton`, `EntityDetailSkeleton`, `DashboardPageSkeleton`, `FormPageSkeleton`, `QueuePageSkeleton`, `TabsPageSkeleton`, `CanvasPageSkeleton`, `HelpPageSkeleton`, `WhatsappPageSkeleton`, `SettingsPageSkeleton`, `DocumentPageSkeleton` (+ приватные `SkeletonFrame`/`Blocks`/`HeaderStrip`/`KpiRow`/`RegistryPanel`/`ToolbarRow`).
- `frontend/app/app/loading.tsx` — переписан в **нейтральный по умолчанию** (полоса `PageHeader` + `space-y-4 p-6` + панель реестра) **без** строки KPI: KPI есть лишь примерно у каждого четвёртого раздела (ранняя оценка ~10 из 41 страницы). Вариант с KPI использован для `users`, `catalog`, `marketing`, `support`.
- 34 сегментных `loading.tsx` (по одной на реальную форму): `analytics`, `bookings`, `bookings/[id]`, `bookings/new`, `catalog`, `catalog/[id]`, `command-center`, `crm`, `crm/customers/[id]`, `crm/partners/[id]`, `dashboard`, `documents`, `documents/[id]`, `finance/obligations`, `finance/overview`, `help`, `marketing`, `orders`, `orders/[id]`, `orders/new`, `page-builder`, `partners/onboarding`, `payments`, `payments/[code]`, `requests`, `requests/[id]`, `requests/new`, `seller-profiles`, `settings/integrations/whatsapp`, `support`, `support/[id]`, `support/new`, `users`, `whatsapp`.
- **Две границы `<Suspense>` были вообще без `fallback`** (`finance/obligations:342`, `finance/overview:215`): при пререндере эти страницы отдавали **пустой** контент — состояние загрузки «ничего» не соответствует раскладке так же, как чужой скелетон. Им подставлены точные формы (`WorkspacePageSkeleton toolbar` и новый `MetricsPageSkeleton`).
- 20 in-page `<Suspense fallback>` (границы `useSearchParams` при пререндере) заменены на соответствующий форме скелетон + импорт в эти 20 страниц (**итого fallback проставлен/исправлен у 22 границ**). **Сам boundary не удалялся** — это требование Next.js для `useSearchParams`, менялось только содержимое fallback.
- **Внутристраничные ветки загрузки** (`if (busy/loading) → серый блок`), найденные финальным сплошным сканом всех `animate-pulse` по `app/`+`components/`:
  - `app/app/documents/[id]/page.tsx:95` — была одна плита `h-32` без рамки; теперь шапка (h1 + бейдж + две кнопки по `:105-131`), info-карточка `grid grid-cols-2 gap-4 … sm:grid-cols-3` (:134) и карточка travelers (:149);
  - `app/app/payments/[code]/page.tsx:111` — были две короткие полоски; теперь hero-карточка суммы/статуса и карточка деталей со строками `divide-y` (`DetailRow` = `flex items-start gap-4 py-2`);
  - `app/app/whatsapp/page.tsx:390` — список: «пилюли» `h-12 rounded-lg` заменены на строки `px-3 py-2.5`, которые обязаны быть **прямыми детьми** контейнера `divide-y` (:389), как реальные (:416);
  - `app/app/whatsapp/page.tsx:569` — тред: `h-10 w-2/3 rounded-xl bg-slate-100` на фоне `bg-slate-50` был почти невидим; теперь пузыри `rounded-2xl` (`max-w-[78%]`-семейство), исходящие прижаты вправо (`justify-end`), фон белый/голубой.
- 14 тестов-контрактов в `frontend/components/internal/WorkspaceSkeletons.spec.tsx` (геометрия + a11y) — падают, если форму снова отведут от реальной раскладки.

**Фактическая карта «маршрут → форма каркаса»** (сгенерирована из содержимого `loading.tsx`, для проверки ревьюером):

```
/app (default)                 WorkspacePageSkeleton
analytics                      DashboardPageSkeleton
bookings                       OperationsPageSkeleton
bookings/[id]                  EntityDetailSkeleton
bookings/new                   FormPageSkeleton
catalog                        WorkspaceKpiPageSkeleton
catalog/[id]                   EntityDetailSkeleton
command-center                 DashboardPageSkeleton
crm                            TabsPageSkeleton
crm/customers/[id]             EntityDetailSkeleton
crm/partners/[id]              EntityDetailSkeleton
dashboard                      DashboardPageSkeleton
documents                      OperationsPageSkeleton
documents/[id]                 DocumentPageSkeleton
finance/obligations            WorkspacePageSkeleton (+ toolbar)
finance/overview               MetricsPageSkeleton
help                           HelpPageSkeleton
marketing                      WorkspaceKpiPageSkeleton
orders                         OperationsPageSkeleton
orders/[id]                    EntityDetailSkeleton
orders/new                     FormPageSkeleton
page-builder                   CanvasPageSkeleton
partners/onboarding            QueuePageSkeleton
payments                       OperationsPageSkeleton
payments/[code]                EntityDetailSkeleton
requests                       OperationsPageSkeleton
requests/[id]                  EntityDetailSkeleton
requests/new                   FormPageSkeleton
seller-profiles                QueuePageSkeleton
settings/integrations/whatsapp SettingsPageSkeleton
support                        WorkspaceKpiPageSkeleton
support/[id]                   EntityDetailSkeleton
support/new                    FormPageSkeleton
users                          WorkspaceKpiPageSkeleton
whatsapp                       WhatsappPageSkeleton
```

**2. Публичная часть и витрина.**

- `frontend/app/globals.css` — **новый** класс `.card-skeleton`: радиус берётся из `--th-radius-card` (по умолчанию 12px), как у реальных карточек `card-premium`. Раньше скелетоны рисовались `rounded-2xl` (16px) и «не совпадали» по скруглению — CSS вне слоёв перебивает utility-классы, поэтому класс, а не utility.
- `frontend/components/public/Skeletons.tsx` — `ProductGridSkeleton`: `lg:grid-cols-3` → **`xl:grid-cols-3`** (совпадает с реальными сетками `/search` и `/categories/[slug]`); добавлен `CategoryPageSkeleton` (крошки + h1 + тулбар + `lg:grid-cols-[260px_1fr]`); `PdpSkeleton` во втором проходе доведён до карточки: **4** поля подбора вместо 3, `border-blue-100` у синей карточки, календарь цен — белая карточка с навигацией и сеткой `grid-cols-7` × `h-16` (было серый блок `h-64`, разница высоты ≈400px).
- `frontend/app/categories/[slug]/page.tsx` — два fallback (кадр A `:133` и кадр C) переведены на `CategoryPageSkeleton` с обёрткой `mx-auto max-w-6xl px-4 py-8`.
- `frontend/app/search/page.tsx` — fallback: `MarketplaceHeader` + `mx-auto max-w-[1400px] px-6 py-8` + hero-блок + заголовок результатов + сетка (раньше «голая» сетка на всю ширину).
- Тёмные секции витрины: `components/marketplace/{Tours,Hotels,Flights,HotTours,LatestOffers,SpecialOffers}.tsx` — радиус через `.card-skeleton`, у пяти секций число карточек 4 → **6** (реальный cap секции), `SpecialOffers` уже был 4/4.
- `components/marketplace/search/FlightResults.tsx` — 3 плитки `h-40` заменены на скелетон таблицы в 12 колонок (`rounded-2xl border border-white/10`, `text-[11px]`, `bg-white/5`, `divide-y divide-white/5`), как реальный список рейсов.

**3. Кабинеты (покупатель / продавец / поставщик).**

- `app/account/{orders,bookings,documents}/page.tsx` — таблица / карточки / список-строки вместо общей «полосы»; `app/account/{payments,support}/page.tsx` — через новый `NotAvailableCardSkeleton` в `components/account/NotAvailableCard.tsx`.
- `components/partner/PartnerProductsList.tsx` (строки по 8 ячеек), `components/partner/ProductEditorForm.tsx` (label+control), `components/supplier/MonthlyCalendar.tsx` (добавлена строка дней недели — без неё календарь «съезжал» на строку), `components/constructor/ConstructorCanvas.tsx` (полный каркас канвы), `components/command-center/{CommandCenter,SectionGrid,TrendWidget}.tsx` (виджеты по форме карточек), `components/AggregateSummary.tsx` (градиентная карточка + строка метрик).

### Проверка

| Проверка | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | **exit 0** (прогоны после каждой группы; замеренная длительность двух — 38.6 с и 65.2 с, у последующих не замерялась — успешный `tsc` пуст по выводу) |
| Контракт скелетонов workspace | `npx vitest run components/internal/WorkspaceSkeletons.spec.tsx` | **14 passed / 14** |
| Контракт скелетонов PDP | `npx vitest run components/public/Skeletons.spec.tsx` | **5 passed / 5** |
| Прицельно по правленым файлам | `npx vitest run` (13 спеков: `components/internal/WorkspaceSkeletons`, `components/public/{Skeletons,ProductCard}`, `components/marketplace/search/FlightResults`, `components/command-center/__tests__/command-center`, `components/partner/DynamicSchemaForm`, `lib/operations-center-shell`, `app/account/{sections,layout}`, `app/app/{requests,payments,pricing/markup,whatsapp}/page`) | **149 passed / 149**, exit 0 |
| Прицельно по второму проходу | `npx vitest run` (5 спеков: `app/app/whatsapp/page`, `lib/documents-registry`, `lib/payments-registry`, `components/internal/WorkspaceSkeletons`, `components/public/Skeletons`) | **158 passed / 158**, exit 0 |
| Полный прогон (финальный, на итоговом состоянии) | `npx vitest run` | **1096 passed / 1 failed** (69 файлов, 89.9 с); единственный сбой — исходный `components/supplier/TourDetail.spec.tsx:99` («selects the NEAREST priced day…»), воспроизводится изолированно и к правкам не относится; **регрессий нет** |
| Кол-во файлов | `Get-ChildItem -Recurse -LiteralPath app\app -Filter loading.tsx` | **35** (1 нейтральный + 34 сегментных) |
| Покрытие маршрутов | сопоставление каждого `page.tsx` с ближайшим `loading.tsx` | **все 40 маршрутов `/app/*` покрыты**; на нейтральном по умолчанию остались `finance/fx-rates`, `geography`, `hotel-directory`, `pricing/markup` и два редиректа `finance/payments[/[id]]` (см. ниже) |
| Нет «мёртвых» `loading.tsx` | проверка, что под каждым сегментом есть `page.tsx` | **0 лишних** (у всех 34 есть реальный маршрут) |
| Production-сборка (dev-сервер остановлен) | `npx next build` | **exit 0**, `✓ Compiled successfully in 29.3s`, TypeScript 97 с, 61/61 статических страниц; предупреждений ровно **2** — оба известные из **P0-3** (`app/hotels/[file]/route.ts:49` и `:62`), новых от 35 `loading.tsx` нет. В таблице маршрутов сохранились режимы: страницы с динамическими сегментами (`[id]`, `[code]`, `[slug]`) — `ƒ`, остальные `/app/*` — `○` (в т.ч. `finance/obligations` и `finance/overview` остались статическими). После сборки `.next` удалён (правило **P0-2**) |

### Осознанно НЕ менялось (остающиеся расхождения)

1. **`components/Shell.tsx:196`** — тёмный предмонт-фон `bg-slate-950`. Это не skeleton, а сущность «ворота авторизации» (до готовности сессии показывается тёмный экран). Смена = изменение дизайна/поведения, а не исправление расхождения геометрии.
2. **Витрина конструктора `/store/*`** — сегментных `loading.tsx` нет вообще; страницы серверные, данные приходят до первого рендера. Это **отсутствие** скелетона, а не его несоответствие.
3. **`ProductGridSkeleton` count 6 vs реальный `pageSize: 12`** на `/search` — число карточек при загрузке меньше, чем «приедет» после. Влияет только на высоту «хвоста» страницы.
4. **`PdpSkeleton` и не-TOUR/HOTEL товары** — скелетон повторяет карточку TOUR/HOTEL (5478 + 2857 товаров). Для редких типов (например FLIGHT) раскладка отличается, скелетон для них приблизителен.
5. **Цвета блоков** (`bg-slate-200` vs `bg-slate-100` у изображения карточки) — не геометрия: серый блок-заглушка на белом фоне обязан быть видимым, «дословное» совпадение с `bg-slate-100`/`bg-white` сделало бы скелетон невидимым.
6. **Нейтральный каркас по умолчанию обслуживает 4 раздела** (`finance/fx-rates`, `geography`, `hotel-directory`, `pricing/markup`): форма совпадает, но в деталях расходится — `space-y-4` против `space-y-6` (`fx-rates`, `pricing/markup`) и **одна** панель против двух таблиц (`pricing/markup`: :261 и :407; `fx-rates`). Отдельные `loading.tsx` не заводились: файлы были бы на ~95 % копией дефолтного, а выигрыш — 8 px межблочного зазора и вторая панель.
7. **`finance/payments` и `finance/payments/[id]`** — исторические страницы-редиректы (28 строк: `router.replace` на канонический `/app/payments[/[code]]` + интерстишл `h-8 w-48 animate-pulse`). Скелетона у них нет и не требуется: согласовывать раскладку не с чем.
8. **Текстовые индикаторы загрузки, а не скелетоны раскладки:** `components/marketplace/GlobalSearchAutocomplete.tsx:124` и `components/marketplace/search/LiveSearchInput.tsx:203` — пульсирующий текст «Загрузка…» внутри выпадающего списка; у списка до загрузки нет своей раскладки, расхождение геометрии измерять не на чем.
9. **`components/command-center/DecisionQueue.tsx:125,416`** — пульсирующие точки индикатора просрочки SLA; это не состояние загрузки.
10. **`components/OperationsCenterShell.tsx:307`** — плейсхолдер реестра; приведён к контракту (`role="status"` + sr-only) и является источником истины для `RegistryPanel`, менять нечего.

---

## P2 — неиспользуемые зависимости/стили с подтверждением

**Пусто.** Проверено:
- CSS в проекте **один** файл (`frontend/app/globals.css`, 4201 Б) — дублей и legacy-стилей нет;
- barrel-файлов (`index.ts`) в `frontend/` **нет**;
- все зависимости из `frontend/package.json` реально используются: `@phosphor-icons/react` (19 файлов), `@dnd-kit/*` (`components/constructor/*`, `components/command-center/CustomizePanel.tsx`), `recharts` (`components/command-center/TrendWidget.tsx:12`), `qrcode.react` (`app/app/settings/integrations/whatsapp/page.tsx:4`), `next`, `react`, `react-dom`.
- Удалять зависимости не предлагается.

Единственный «пограничный» пункт требует решения человека:

### P2-1 (решение человека). `lib/registry-url-state.ts`
- **Ф:** `frontend/lib/registry-url-state.ts` + `frontend/lib/table-header-filter.spec.tsx`.
- **О:** ни одного импорта из продового кода; единственные ссылки — сам spec (`lib/table-header-filter.spec.tsx:13` и 4 `describe`). Модуль `lib/table-header-filter.ts` **не существует** — spec назван по старому имени.
- **Р:** средний — удаление модуля требует одновременной правки/удаления spec; нужно решить, является ли spec единственным хранителем контракта URL-состояния реестров.
- **П:** только после решения человека.
- **В:** `npx vitest run lib/table-header-filter.spec.tsx`; `tsc`.

---

## P3 — рефакторинг / оптимизация / архитектура

### P3-1 (приоритетный по эффекту). Точечные импорты иконок вместо barrel `@phosphor-icons/react`
- **Ф (19 файлов с barrel-импортом; 11 из них в клиентском графе `/`):**
  `components/marketplace/MarketplaceHeader.tsx`, `HeroSection.tsx`, `Hotels.tsx`, `HotTours.tsx`, `Tours.tsx`, `Flights.tsx`, `LatestOffers.tsx`, `SpecialOffers.tsx`, `Advertisement.tsx`, `MarketplaceFooter.tsx`, `GlobalSearchAutocomplete.tsx`, `CompactSearch.tsx` (удаляется в P1-1), `components/constructor/{ConstructorCanvas,ConstructorHeaderTab,ConstructorAvailableBlocks,ConstructorBlockList,ConstructorHeroTab,ConstructorSearchTab,DefaultConfigActions}.tsx`.
- **О:** пакет `@phosphor-icons/react@2.1.10`: barrel `dist/index.es.js` = 194 504 Б реэкспортирует **3024 модуля** (`dist/csr`, 8.0 МБ); в `exports` есть точечный путь `./dist/csr/*`. В dev webpack не делает tree-shaking → тысячи модулей на каждый barrel-импорт. Это **ведущая гипотеза** взрыва времени компиляции `/` на Webpack (99–111 с).
- **Р:** средний (массовая механическая правка); тип-система поймает опечатку в имени иконки.
- **П:** **сначала A/B-замер, потом правка** (гипотеза H1 в аудите §6.3 пока не подтверждена экспериментом).
- **В:**
  1. базовая линия: `next dev --webpack`, чистый `.next`, `GET /` → зафиксировать время;
  2. перевести 11 файлов графа `/` на `@phosphor-icons/react/dist/csr/<Icon>`;
  3. повторить замер (ожидание: падение с ~99 с до десятков секунд);
  4. `tsc` → 0; `vitest`; визуально `/`, `/search`, `/app/dashboard`;
  5. `npm run build` → exit 0.
  Если выигрыш подтверждается — распространить на остальные 8 файлов.

### P3-2. Свести два публичных «хрома»: `PublicLayout` ↔ `MarketplaceHeader`/`MarketplaceFooter`
- **Ф:** `components/PublicLayout.tsx`, `components/marketplace/MarketplaceHeader.tsx`, `MarketplaceFooter.tsx`.
- **О:** публичная часть использует два разных header/footer: `PublicLayout` (`/register`, `/become-a-partner`, `/categories/[slug]`, `/products/[slug]`) и `MarketplaceHeader/Footer` (`/`, `/search`). Одновременно на одной странице не встречаются, но пользователь видит разные шапки на соседних страницах.
- **Р:** средний — визуальные изменения; требует согласования дизайна.
- **П:** после P0/P1.
- **В:** визуальная сверка `/`, `/search`, `/products/<slug>`, `/categories/<slug>`, `/register`, `/become-a-partner`; `tsc`; `vitest`.

### P3-3. Свести `components/Pagination.tsx` и `components/public/Pagination.tsx`
- **Ф:** оба файла + 19 мест использования.
- **О:** разные контракты (`page/pageSize/total/onPageChange` vs `page/totalPages/onChange`) при одинаковом назначении.
- **Р:** низкий-средний (правка 19 файлов).
- **П:** после P3-2.
- **В:** `tsc`; `vitest` (`components/public/Pagination.spec.tsx`); проверка пагинации на `/app/orders`, `/app/users`, `/categories/<slug>`.

### P3-4. Разделить `lib/i18n.tsx` (319 083 Б / 3095 строк) по локалям
- **О:** единый словарь RU/AZ/EN втягивается в клиентский бандл из корневого layout (`app/layout.tsx` → `LocaleProvider`).
- **Р:** средний, ломается много точек `t(...)`.
- **П:** отдельная задача; **не** в этой очистке.

### P3-5. Уменьшить «ширину» графа `/` (ленивая загрузка блоков главной)
- **О:** `MarketplaceRenderer` статически импортирует все 8 блоков + `HeroSearch` с 10 формами поиска (189 КБ).
- **Р:** средний (`next/dynamic` сейчас не используется нигде — появится новый паттерн в кодовой базе).
- **П:** отдельная задача после P3-1 (сначала измерить эффект A/B по правилам задания).

---

## Порядок работ (предлагаемый)

1. **P0-1, P0-2** — регламент (сегодня, без изменений кода).
2. **P1-1, P1-2** — одна группа удаления (1 файл + 2 строки) → `tsc` + `vitest` + ручная проверка `/`, `/search`.
3. **P0-3** — индекс `public/hotels`, проверка 404/200, `next build` → 0 предупреждений.
4. **P3-1** — A/B-замер иконок (**только замер**), затем решение по правке 11 (или 19) файлов.
5. **Решения человека:** P0-4 (ESLint), P2-1 (registry-url-state + spec), незакоммиченные правки пользователя `HeroSection.tsx` / `MarketplaceRenderer.tsx` (**не трогались** в рамках SKELETON-PARITY; `app/app/loading.tsx` теперь входит в SKELETON-PARITY и переписан).
6. **P3-2…P3-5** — отдельные задачи, вне этой очистки.

## Итоговый контроль после каждой группы

- `git diff --check`, `git status`, просмотр diff;
- `npx tsc --noEmit` → 0;
- `npx vitest run` — исходно **1077 passed / 1 failed**; после SKELETON-PARITY **1096 passed / 1 failed** (69 файлов). Заранее известный сбой — `components/supplier/TourDetail.spec.tsx` (воспроизводится изолированно, к очистке не относится). Любой НОВЫЙ падающий файл — регресс от группы изменений;
- также известен нерешённый `npm run lint` (ESLint не установлен) — см. P0-4;
- `npm run build` при **остановленном** dev-сервере → exit 0, 0 предупреждений;
- замер `Compiling /` (Turbopack) до/после группы;
- проверка маршрутов: `/`, `/search`, `/app/dashboard`, 3–4 пункта левого меню, `/store/<slug>` (конструктор/CMS/preview не затронуты ни одним пунктом P1).
