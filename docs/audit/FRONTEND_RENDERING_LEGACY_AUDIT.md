# Аудит рендеринга frontend Navitravel и legacy-кода

- **Репозиторий:** `C:\Projects\Navitravel` (путь не был указан в задании — взят из рабочей среды).
- **Базовый коммит:** `af87b1c` (ветка `master`).
- **Рабочая ветка аудита:** `audit/frontend-rendering-legacy` (создана от `master`; ничего не коммитилось).
- **Дата:** 16.10.2026. Все измерения — на этой машине (16 ГБ RAM), Node v22.23.3, npm 10.9.9.
- **Статус:** Этапы 0–5 выполнены. **Ни один файл не удалён и не изменён** (кроме двух отчётов в `docs/audit/`). См. «Границы покрытия» в конце.

---

## 1. Краткий вывод

1. **Гипотеза «новые страницы рендерятся поверх старых / рядом с legacy-кодом» не подтверждается.** В проекте один App Router, один корневой layout, один CSS-файл, ни одного второго React-корня, ни одного портала, ни одного `dangerouslySetInnerHTML`, ни одного динамического импорта (`next/dynamic`, `React.lazy`, `import()`), ни одного реестра компонентов по строковому имени, и ни одного файла с именем вида `Old/Legacy/V1/V2/Backup/Deprecated/copy/tmp`. Одновременный рендер двух версий интерфейса не найден ни на одном маршруте.
2. **Реальная проблема — компиляция, а не наложение вёрстки.** «Зависание на `Compiling / ...`» воспроизведено и локализовано: **это поведение Webpack-режима**. На чистом `.next`:
   - Webpack (`next dev --webpack`): первый `/` — **111 с**, а если другой маршрут уже был скомпилирован, `/` всё равно стоит **99 с** (из них 98 с — время компилятора). Пиковая память **1362–1750 МБ**.
   - Turbopack (режим по умолчанию): `/` — **12.3 с** как первый маршрут холодного сервера, **2.2 с** после прогрева. Пиковая память **592–831 МБ**.
   - **Вывод: Turbopack быстрее на порядок и потребляет в ~2.3 раза меньше памяти.** Предположение «с Webpack нагрузка ниже» на этой машине не подтвердилось: Webpack дал и худшее время, и большую память.
   - Отдельно: **~12 с у Turbopack — это цена первого маршрута вообще, а не `/`**: `GET /login` первым на чистом сервере стоит те же 11.9 с.
3. **Мёртвый код есть, но его мало.** Систематический скан 343 файлов / 1516 строк импорта дал всего **два** модуля без единого импортёра: `components/marketplace/CompactSearch.tsx` (подтверждённо неиспользуемый) и `lib/registry-url-state.ts` (используется только своим spec-файлом). Ни один маршрут не является недостижимым: все 6 «корневых legacy-страниц» (`/catalog`, `/orders`, `/bookings`, `/customers`, `/users`, `/app`) — намеренные редиректы-заглушки.
4. **`legacy/`** — отдельное «замороженное» приложение (`travelhub_v1`, свой SQLite/Prisma, свой `proxy.ts`). Не участвует в сборке и в работе `frontend/`: ссылок из `frontend/`, `backend/`, CI и `docker-compose.yml` нет.
5. **Два настоящих дубля по назначению** (оба живые, удалять нельзя): две реализации публичного «хрома» (PublicLayout vs MarketplaceHeader/Footer) и два `Pagination` с разными API. Это архитектурный долг (P3), а не мёртвый код.
6. **Найдено узкое место сборки, не связанное с legacy:** `app/hotels/[file]/route.ts` создаёт динамический файловый паттерн, который, по собственному предупреждению Turbopack, «matches 18412 files» (в `public/hotels` — 4603 файла / 920 МБ). Это P0-кандидат.

---

## 2. Карта рендеринга

### 2.1 Технологический стек и конфигурация (по фактическим файлам)

| Параметр | Значение | Источник |
|---|---|---|
| Router | **только App Router** (`frontend/app`), Pages Router отсутствует, `src/` нет | `frontend/app/**`, отсутствие `frontend/pages` |
| Next.js | 16.2.12 | `frontend/package.json`, `node_modules/next/package.json` |
| React / React-DOM | 19.2.4 | там же |
| TypeScript | 5.9.3 | `node_modules/typescript/package.json` |
| Tailwind | 4.3.3 (`@tailwindcss/postcss`) | `postcss.config.mjs` |
| Vitest | 4.1.10, environment `node`, `jsdom` для компонентных спеков | `vitest.config.ts` |
| Менеджер пакетов | npm; lock-файлы `frontend/`, `backend/`, `legacy/` (корневого нет) | — |
| Скрипты | `dev`=`next dev`, `build`=`next build`, `start`=`next start`, `lint`=`eslint`, `test`=`vitest run`, `postinstall`=`node scripts/patch-next-devtools.mjs` | `frontend/package.json` |
| ESLint | **не установлен и конфига нет** | `node_modules/eslint` отсутствует, `eslint.config.*` не найдены |
| `next.config.ts` | `devIndicators:false`; `allowedDevOrigins`; `experimental.proxyTimeout=300000`; `rewrites`: `/api/v1/:path*` → `BACKEND_URL ?? http://localhost:4000` | `frontend/next.config.ts` |
| Postinstall-патч | патчит только dev-tools Next (баг segment-explorer, `TypeError ... reading 'page.tsx'` на маршрутах конструктора) | `frontend/scripts/patch-next-devtools.mjs:1-16` |

### 2.2 Файлы-конвенции маршрутов (40 штук)

- **Страницы:** 79 (`app/**/page.tsx`).
- **Layout:** 5 — `app/layout.tsx` (root), `app/app/layout.tsx` (Shell), `app/partner/layout.tsx`, `app/account/layout.tsx`, `app/products/[slug]/layout.tsx`.
- **loading:** 2 — `app/products/[slug]/loading.tsx` (существует), `app/app/loading.tsx` (**новый, незакоммиченный**, из предыдущей задачи).
- **route handler:** 1 — `app/hotels/[file]/route.ts`.
- **not-found:** 1 — `app/not-found.tsx`.
- **Отсутствуют:** `error.tsx`, `global-error.tsx`, `template.tsx`, `default.tsx`; нет route groups `(group)`, нет parallel/intercepting-слотов `@slot`.

### 2.3 Группы маршрутов

| Группа | Кол-во | Внешний вид / доступ |
|---|---|---|
| `/` (marketplace home) | 1 | публичный |
| `/login`, `/register` | 2 | публичный |
| `/search`, `/categories/[slug]`, `/products/[slug]`, `/store/[slug]`, `/store/[slug]/products/[productSlug]`, `/become-a-partner` | 6 | публичный |
| `/catalog`, `/orders`, `/bookings`, `/customers`, `/users` | 5 | **редиректы-заглушки** → `/app/*` |
| `/app/**` | 48 | внутренний, `Shell` + proxy-гейт |
| `/partner/**` | 14 | кабинет партнёра, `proxy.ts` |
| `/account/**` | 7 | кабинет покупателя, `proxy.ts` |

Полный список URL — 79 страниц (§2.3 не перечисляет каждую; таблица маршрутов сгенерирована командой `Get-ChildItem app -Recurse -File -Filter page.tsx`, вывод сохранён в протоколе аудита).

### 2.4 Границы доступа

`frontend/proxy.ts` (в Next 16 `middleware.ts` переименован в `proxy.ts`, экспорт `proxy`): проверяет **только наличие** cookie `travelhub.auth`; нет cookie → `redirect /login?next=<path>`. Matcher: `/app`, `/app/:path*`, `/partner`, `/partner/:path*`, `/account`, `/account/:path*`. Никаких других redirects/rewrites в проекте нет.

### 2.5 Layout: вложенность

```
app/layout.tsx                  (server)  <html lang="ru"> + LocaleProvider (@/lib/i18n) + globals.css
├── /                            app/page.tsx        (client) MarketplaceRenderer  — PublicLayout НЕ используется
├── /search                      MarketplaceHeader
├── /login, /register, /become-a-partner, /categories/[slug], /products/[slug]
│                                PublicLayout (header/footer публичной витрины)
├── /store/[slug]                StorefrontSite (+ StorefrontPdp для карточки товара)
├── /app/*                       app/app/layout.tsx → <Shell>  (sidebar, auth, RBAC)
│   (app/app/page.tsx → redirect /app/dashboard)
├── /partner/*                   app/partner/layout.tsx
└── /account/*                   app/account/layout.tsx
```

---

## 3. Классификация файлов (доказательства)

Сканы выполнялись: (а) индексация всех строк `import/from/require(` по 343 файлам `frontend/` вне `node_modules`/`.next` (1516 строк); (б) сопоставление по basename с обязательным разделителем `/` или `"`; (в) отдельный полнотекстовый поиск по каждому кандидату (комментарии, тесты, динамические ссылки, реестры).

> **Методическая заметка (важно для доверия к выводам).** Первые два прогона скана дали ~25 и ~24 «мёртвых» модуля. Оба результата оказались ложными: (1) многострочные `import { ... } from "..."` не попадали в индекс; (2) `Get-Content $path` в PowerShell 5.1 трактует `[id]`, `[slug]`, `[file]`, `[code]` как wildcard, поэтому файлы из динамических сегментов не читались вовсе (нужен `-LiteralPath`). После исправления список сократился до 2 файлов. Это прямая иллюстрация требования «отсутствие обычного импорта — не доказательство».

| Файл | Назначение | Статус | Доказательство |
|---|---|---|---|
| `components/marketplace/CompactSearch.tsx` | Компактная поисковая панель результатов (10 форм поиска + иконки) | **UNUSED-CONFIRMED** | 0 импортёров после скана 343 файлов; полнотекстовый поиск `CompactSearch` даёт только определение самого файла + 3 упоминания **в комментариях** (`app/search/page.tsx:156`, `components/marketplace/search/hotel-search-store.ts:8`, `tour-search-store.ts:7`); нет теста; нет динамического импорта; нет реестра |
| `lib/registry-url-state.ts` | Хелперы URL-состояния реестров (sort/filter/reset) Operations Center | **LEGACY-BUT-REFERENCED (только тестом)** | Единственные ссылки — `lib/table-header-filter.spec.tsx:13` и 4 `describe` там же. Ни одного импорта из продового кода. Модуль `lib/table-header-filter.ts` **не существует** — spec назван по старому имени |
| `app/catalog/page.tsx`, `app/orders/page.tsx`, `app/bookings/page.tsx`, `app/customers/page.tsx`, `app/users/page.tsx`, `app/app/page.tsx` | Legacy-URL → канонический `/app/*` | **ACTIVE** | 6–8 строк, серверный `redirect()`: `app/catalog/page.tsx:5`, `app/orders/page.tsx:5`, `app/bookings/page.tsx:5`, `app/customers/page.tsx:6`, `app/users/page.tsx:5`, `app/app/page.tsx` → `/app/dashboard`. Комментарии «PHASE 1 STEP 1.6 §9». Внутренних ссылок на эти URL нет (проверено: `href="/catalog"` и т.п. — 0 совпадений), но они нужны для закладок/аналитики |
| `lib/routes.ts` — `LEGACY_INTERNAL_REDIRECTS:54`, `resolveLegacyRedirect:63` | Карта legacy-редиректов | **LEGACY-BUT-REFERENCED (только тестом)** | Единственный потребитель — `lib/routes.spec.ts:37-47`. В рантайме не вызывается ни разу; редиректы делают page-заглушки |
| `app/app/finance/payments/page.tsx` | Совместимость: редирект на `/app/payments` с сохранением query | **ACTIVE (compat)** | Файл целиком — `useEffect` + `router.replace` (строки 15-20), комментарий «UI-C1.2A … retained as a compatibility path» |
| `components/Pagination.tsx` | Пагинация внутренних реестров (`page/pageSize/total/onPageChange`) | **ACTIVE** | 18 импортёров (`app/app/*`, `app/partner/customers/page.tsx`) |
| `components/public/Pagination.tsx` | Пагинация публичной витрины (`page/totalPages/onChange`) | **ACTIVE** | 1 импортёр `app/categories/[slug]/page.tsx:9` + собственный spec |
| `components/PublicLayout.tsx` | Публичный header/footer (brand, категории из public API, locale, auth-состояние) | **ACTIVE** | 4 импортёра: `app/become-a-partner`, `app/categories/[slug]`, `app/products/[slug]/layout.tsx`, `app/register` |
| `components/marketplace/MarketplaceHeader.tsx` / `MarketplaceFooter.tsx` | Второй публичный «хром» (для `/` и `/search`) | **ACTIVE** | `MarketplaceHeader`: `app/search/page.tsx`, `MarketplaceRenderer.tsx:80,112`, `lib/use-global-branding.ts`; `MarketplaceFooter`: `MarketplaceRenderer.tsx:104,123` |
| `components/marketplace/GlobalSearchAutocomplete.tsx` | Автокомплит глобального поиска | **ACTIVE** | `MarketplaceHeader.tsx:29` (импорт) и `:188` (рендер). *Первый grep дал ложно «0 импортёров», т.к. импорт относительный — `./GlobalSearchAutocomplete`* |
| `components/storefront/StorefrontSite.tsx` / `StorefrontPdp.tsx` | Рендер опубликованного сайта партнёра (`/store/[slug]`) со своей темой и hero | **ACTIVE** | `StorefrontSite`: `app/store/[slug]/page.tsx`, `app/partner/storefront/preview/page.tsx`; `StorefrontPdp`: `app/store/[slug]/products/[productSlug]/page.tsx` |
| `components/Shell.tsx`, `EntityDetailShell.tsx`, `OperationsCenterShell.tsx`, `PageHeader.tsx`, `Kpi.tsx`, `CrmAnalytics.tsx` и др. | Внутренний каркас и UI-примитивы | **ACTIVE** | Shell — `app/app/layout.tsx`; `OperationsCenterShell` — 7 импортёров; `PageHeader` — 20; `Kpi` — 8 |
| `legacy/**` (234 файла в git) | Отдельное приложение TravelHub v1 (Next 16, Prisma+SQLite, свой `proxy.ts`) | **ISOLATED (не GENERATED, не ACTIVE)** | `legacy/package.json:2` name `travelhub_v1`; своя схема `legacy/prisma/schema.prisma`; поиск ссылок на `legacy` из `frontend/`, `backend/`, `.github/workflows/ci.yml`, `docker-compose.yml` — совпадений нет; `legacy/node_modules` в git не отслеживается |
| `frontend/app/globals.css` | **Единственный** CSS в проекте (4201 Б) | **ACTIVE** | Поиск `*.css` вне `node_modules`/`.next` даёт ровно один файл |
| `frontend/public/hotels/**` | 4603 `.webp` (920.5 МБ) | **GENERATED (скриптом)** | `backend/scripts/hotel-photo-catalog.ts`; в `.gitignore` строка `frontend/public/hotels/`; `git ls-files frontend/public/hotels` = 0 |

### 3.1 Что проверено на «скрытые» способы использования

| Проверка | Команда/метод | Результат |
|---|---|---|
| Динамические импорты | поиск `next/dynamic`, `React.lazy`, `lazy(` | **0** совпадений |
| Реестр компонентов по строке | `BLOCK_COMPONENTS` в `MarketplaceRenderer.tsx:18-27` — **статический** объект `Record<string, React.FC>` | единственный «реестр», это обычная статическая карта |
| Второй React root | `createRoot`, `hydrateRoot`, `ReactDOM.render`, `createPortal`, `dangerouslySetInnerHTML` | **0** совпадений |
| Стили-дубли / наложения | все `*.css` | 1 файл; overlay-классы только декоративные градиенты (`.hero-overlay`, `.destination-overlay`, `.search-glass`) |
| Barrel-файлы (`index.ts`) | `frontend/**/index.{ts,tsx}` | **0** файлов → циклических импортов через barrel нет |
| Файлы с «legacy»-именем | `old|legacy|deprecated|unused|backup|v1|v2|copy|tmp|bak` | **0** файлов |

---

## 4. Как рендерится главная `/`

```
/  →  app/page.tsx  ("use client")
      useMarketplaceViewed(true)                    // lib/behavioral-events.ts:4-5 — два НЕИСПОЛЬЗУЕМЫХ импорта
      <MarketplaceRenderer/>
         useConstructorPublished("marketplace-home")   // lib/use-constructor-published.ts
         ├── loading === true  → нейтральный skeleton (aspect-[16/6] bg-dark)
         ├── page === null     → <DefaultMarketplaceLayout/>           ← хардкод-фолбэк
         ├── sections.length===0 → <DefaultMarketplaceLayout/>
         └── иначе             → DesignTokenInjector + MarketplaceHeader
                                 + sections.map(BLOCK_COMPONENTS[blockType])
                                 + MarketplaceFooter
```

Факты:
- Маршрут статический (`○ /` в выводе `next build`).
- Оба варианта (`DefaultMarketplaceLayout` и опубликованная конфигурация) **взаимоисключающие** (`if/else`) — одновременного рендера «старой и новой» версии нет.
- Статически импортируемый граф `/` (через `MarketplaceRenderer.tsx:3-16`): `MarketplaceHeader`, `MarketplaceFooter`, `HeroSection`, `LatestOffers`, `HotTours`, `SpecialOffers`, `Tours`, `Hotels`, `Flights`, `Advertisement`, `DesignTokenInjector`, `SearchBlock`. `HeroSection` → `HeroSearch` → **10 форм поиска** (`HeroSearch.tsx:9-18`), каталог `components/marketplace/search/` = 189 046 Б / 26 файлов (крупнейшая — `TourSearch.tsx` 25 921 Б).
- Корневой layout втягивает `lib/i18n.tsx` в клиентский бандл: **319 083 Б, 3095 строк** — единый файл словаря RU/AZ/EN (~27 % всего `lib/`).
- Тяжёлые зависимости **не** попадают на `/`: `recharts` — только `components/command-center/TrendWidget.tsx:12`; `qrcode.react` — только `app/app/settings/integrations/whatsapp/page.tsx:4`; `@dnd-kit/*` — только `components/constructor/*` и `components/command-center/CustomizePanel.tsx`.

---

## 5. Найденные дубли

| # | Что дублируется | Версии | Вывод |
|---|---|---|---|
| 1 | Публичный «хром» (header/footer) | `components/PublicLayout.tsx` (для `/register`, `/become-a-partner`, `/categories/[slug]`, `/products/[slug]`) и `components/marketplace/MarketplaceHeader.tsx` + `MarketplaceFooter.tsx` (для `/`, `/search`) | Оба **ACTIVE**, одновременно на одной странице не встречаются (проверено по импортёрам). Два разных «фасада» публичной части — архитектурный долг P3, не мёртвый код |
| 2 | Пагинация | `components/Pagination.tsx` (page/pageSize/total) и `components/public/Pagination.tsx` (page/totalPages) | Оба **ACTIVE** с разными контрактами — P3 |
| 3 | Поисковая панель | `components/marketplace/HeroSearch.tsx` (**ACTIVE**) и `components/marketplace/CompactSearch.tsx` (**UNUSED**) | `CompactSearch` — единственный кандидат на удаление (P1) |
| 4 | Hero | `components/marketplace/HeroSection.tsx` (главная marketplace, конфигурируемая) и hero внутри `components/storefront/StorefrontSite.tsx:75-82` (`py-16 sm:py-24`) | **Разные продукты**: публичная витрина vs опубликованный сайт партнёра (`/store/[slug]`). Не дубль, объединять нельзя |
| 5 | «Legacy-страница + новая страница» | `/catalog` → `/app/catalog` и т.п. | Это **не** вторая реализация: 6–8-строчные серверные редиректы. Одновременного рендера нет |
| 6 | Layout-обёртки | root layout + 4 вложенных | Ни один вложенный layout не оборачивает страницу дважды: `app/app/layout.tsx` = только `<Shell>{children}</Shell>`; публичные страницы **не** проходят через Shell (комментарий `app/layout.tsx`: «Internal sidebar не идёт в public bundle») |
| 7 | React-корни, порталы, сторонние скрипты, монтирующие UI | — | **0** совпадений (§3.1) |

---

## 6. `Compiling / ...` и нагрузка: факты vs гипотезы

### 6.1 ФАКТЫ (измерено, точные числа)

Машина: free RAM 7.7–10 ГБ. Backend dev (`ts-node`, ~1.1 ГБ WS) работал во время замеров. `.next` очищался перед каждым прогоном.

| Режим | Готовность (`Ready in`) | Первый `GET /` | Прогретый `GET /` | Пиковая память node | Лог сервера |
|---|---|---|---|---|---|
| **Turbopack**, `/` первым | 3.2 с | **12.3 с** (`next.js: 10.9s`, `application-code: 1405ms`) | 0.28–0.30 с | 592 МБ | `Compiling / ...` → `GET / 200 in 12.3s` |
| **Turbopack**, `/login` первым | 2.8–3.2 с | `/login` **11.9 с**; затем `/` — **2.2 с** (`next.js 1856ms`) | — | 831 МБ | у `/` строки `Compiling /` уже **нет** |
| **Webpack**, `/` первым | 3.3 с | **111 с** (`next.js: 110s`) | 0.52 с | **1362 МБ** | `Compiling / ...` → `GET / 200 in 111s` |
| **Webpack**, `/login` первым | 2.5–3.3 с | `/login` 20.7 с; `/` **99 с** (`next.js: 98s`); `/search` 10.3 с; `/app/dashboard` 4.6 с; `/hotels/[file]` 15.0 с | — | **1750 МБ** | `Compiling / ...` → `GET / 200 in 99s` |
| **Turbopack**, маршруты подряд | 2.8–3.2 с | `/login` 11.9 → `/search` 4.0 → `/` 2.2 → `/app/dashboard` 2.9 → `/hotels/hotel_1.webp` 4.1 → `/app/crm` 2.2 | — | 831 МБ | — |

Из этого следует:
- **`/` на Webpack стоит 98–111 с компилятора — и это не эффект «первого маршрута»**: после уже собранного `/login` (20.7 с) `/` всё равно занял 98 с `next.js`-времени. Это и есть наблюдаемое «зависание».
- **Turbopack на том же коде быстрее в 8–50 раз** и потребляет ~2.3× меньше памяти. `--webpack` для этого проекта — регресс, а не оптимизация.
- **12 с у Turbopack — цена первого маршрута, а не специфика `/`**: `/login` первым дал 11.9 с, а `/` сразу после него — 2.2 с.
- **Цикла пересборки в покое нет**: после первой компиляции повторные `GET /` — 0.24–0.52 с, новых строк `Compiling` в логе нет.

Production build (`npm run build`, Turbopack): exit **0**, 150 с всего —
`✓ Compiled successfully in 26.3s` → `Finished TypeScript in 101s` (**доминирующая фаза**) → `Generating static pages 61/61 in 2.7s`. Выдано **2 предупреждения Turbopack**. Записи «First Load JS» в выводе нет (Next 16 её в этом режиме не печатает).

### 6.2 Предупреждения Turbopack (дословно)

```
./app/hotels/[file]/route.ts:49:24
The file pattern ('/ROOT/public/hotels/' <dynamic> | '/ROOT/public/hotels' <dynamic>) matches 18412 files in [project]/
Overly broad patterns can lead to build performance issues and over bundling.
./app/hotels/[file]/route.ts:62:38   (то же самое)
```

Факт: в `frontend/public/hotels` — **4603 файла `.webp`, 920.5 МБ**; `path.join(PUBLIC_HOTELS, safe)` с динамическим `safe` превращает всю папку в отслеживаемый динамический паттерн. Хендлер создавался, когда «файлов в `public/hotels/` почти нет» (см. его собственный комментарий) — предпосылка изменилась после загрузки каталога фото.

### 6.3 ГИПОТЕЗЫ (с указанием доказательной базы)

- **H1 (ведущая). Barrel-импорт `@phosphor-icons/react` — причина взрыва времени компиляции на Webpack.**
  Факты: `dist/index.es.js` = 194 504 Б и реэкспортирует **3024 модуля** иконок (`dist/csr`, 8.0 МБ); `package.json` пакета предоставляет точечный экспорт `./dist/csr/*`. Режим `import { X } from "@phosphor-icons/react"` (barrel) используется в **19 файлах**, из них **11 — в клиентском графе `/`** (`MarketplaceHeader`, `HeroSection`, `Hotels`, `HotTours`, `Tours`, `Flights`, `LatestOffers`, `SpecialOffers`, `Advertisement`, `MarketplaceFooter`, `GlobalSearchAutocomplete`). В dev-режиме webpack не выполняет tree-shaking, поэтому каждая такая точка тянет в компиляцию тысячи модулей; Turbopack обрабатывает barrel существенно дешевле.
  Чего не хватает: **A/B-замера**. `/login` (без иконок) на Webpack стоил 20.7 с, значит базис Webpack существует сам по себе, и ~78 с сверху у `/` пока не атрибутированы экспериментально.
  Проверка: перевести 11 файлов на точечные импорты (`@phosphor-icons/react/dist/csr/<Icon>`), замерить `--webpack` до/после и production build. Это первый шаг плана (P1-PERF).
- **H2. `.next`, испорченный production-сборкой при живом dev-сервере.**
  Факт (из предыдущей задачи, документирован): после `next build`, выполненного при работающем `next dev`, дев-сервер перестал распознавать `/app/*` — все пункты левого меню уходили в «Страница не найдена» (200 отдавали `/`, `/login`, `/search`), лечилось только удалением `.next` и перезапуском. Сегодняшний замер это подтверждает косвенно: после `next build` в `.next` лежали 104 файла / 0.10 ГБ dev-артефактов. **Правило: никогда не запускать `next build` при живом dev-сервере; после сборки — `Remove-Item -Recurse -Force .next`.**
- **H3. 4603-файловый паттерн `public/hotels` (предупреждение §6.2) даёт вклад в компиляцию/наблюдение.**
  Факты против сильного влияния: `Ready in` не вырос (2.8–3.3 с в обоих режимах), а сам `/hotels/[file]` отвечает 404 за 4.1 с (Turbopack) / 15.0 с (Webpack). Прямой вклад в 12/98 с у `/` не измерен.
  Проверка: заменить динамический `path.join(PUBLIC_HOTELS, safe)` на индекс файлов, построенный один раз (или на статический префикс), и перемерить.
- **H4. Ширина клиентского графа `/` сама по себе** (10 форм поиска = 189 КБ; `i18n.tsx` = 319 КБ в клиентском бандле из корневого layout). Вес реальный, но он влияет и на Turbopack, который при этом быстр, — значит, сам по себе он не объясняет именно webpack-взрыв.
- **H5. Мёртвые импорты `lib/behavioral-events.ts:4-5`** (`useLocale`, `usePathname` импортированы и не используются). В графе `/` (импортируется из `app/page.tsx:4`), но эффект на размер близок к нулю, т.к. и `i18n`, и `next/navigation` уже в графе.

### 6.4 Что НЕ подтвердилось

- «Turbopack даёт высокую нагрузку CPU и почти полностью занятую RAM» — сегодня Turbopack дал 592–831 МБ WS; «почти вся RAM» не воспроизводится (возможно, это состояние относилось к испорченному `.next` или к запуску двух серверов).
- «Webpack снижает нагрузку» — Webpack дал и больше памяти (1362–1750 МБ против 592–831 МБ), и в 8–50 раз больше времени на `/`.

---

## 7. Baseline (до любых изменений)

| Проверка | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` (в `frontend/`) | **exit 0**, 35.8 с |
| Lint | `npm run lint` | **exit 1** — `'eslint' is not recognized as an internal or external command`. ESLint не установлен, конфига нет. Проблема **исходная**, не связана с аудитом |
| Тесты | `npx vitest run --no-file-parallelism` (в `frontend/`) | **exit 1**: 67 файлов — 66 passed / 1 failed; 1078 тестов — 1077 passed / 1 failed (§7.1) |
| Production build | `npm run build` (в `frontend/`) | **exit 0**, 150 с; compile 26.3 с; TypeScript 101 с; 61/61 static pages за 2.7 с; 2 предупреждения Turbopack (§6.2) |
| Dev-сервер (3 замера) | см. §6.1 | Turbopack §6.1 ; Webpack §6.1 |
| Маршруты | 25 пунктов левого меню + публичные URL (предыдущая задача) | все отвечают 200 и рендерятся (после чистки `.next`) |

### 7.1 Тесты (vitest)

Команда: `npx vitest run --no-file-parallelism` (в `frontend/`), лог — `%TEMP%\2\opencode\vitest-baseline.log`.

| Метрика | Значение |
|---|---|
| Test Files | **66 passed / 1 failed (67)** |
| Tests | **1077 passed / 1 failed (1078)** |
| Duration | **546.79 с** (transform 9.88 с, setup 60.82 с, import 103.47 с, tests 56.98 с, **environment 264.93 с**) |
| Exit code | 1 |

Единственный сбой: `components/supplier/TourDetail.spec.tsx` → `TourDetail calendar → INLINE day tariffs (§4.9.4, no modal) > selects the NEAREST priced day by default and shows its tariffs inline`, падение на строке 99 (`expect(within(panel).getAllByText(DAY).length).toBeGreaterThan(0)`).

**Это исходный сбой, не связанный с аудитом и с незакоммиченными правками:**
- воспроизводится **изолированным** прогоном `npx vitest run components/supplier/TourDetail.spec.tsx` → `1 failed | 2 passed (3)`, детерминированно (13.67 с);
- ни `TourDetail.spec.tsx`, ни его граф не импортируют изменённые файлы: ссылки на `components/marketplace/HeroSection` / `MarketplaceRenderer` есть только в `app/page.tsx` и самом `MarketplaceRenderer.tsx`;
- `git diff --stat` показывает ровно 2 изменённых файла (hero) — 7 вставок / 3 удаления;
- дополнительно: в предыдущей задаче тот же spec-файл дал другую инфраструктурную ошибку (`Failed to start forks worker`) — файл проблемный в этом окружении, но к очистке отношения не имеет.

Исходные сбои (не вызваны аудитом): `npm run lint` (ESLint не установлен, конфига нет) и 1 падающий тест `components/supplier/TourDetail.spec.tsx`. **Ни один из них не исправлялся в рамках этого аудита** (по правилу «не исправлять посторонние ошибки без отдельного обоснования»).

---

## 8. Безопасные изменения vs. решения человека

### 8.1 Безопасно (не требует продуктовых решений)

1. **Не использовать `--webpack` в dev** (операционное правило, кода не касается). Основание: §6.1.
2. **Не запускать `next build` при живом `next dev`; после сборки чистить `.next`.** Основание: §6.3 H2.
3. **Устранить мёртвые импорты** `lib/behavioral-events.ts:4-5`. Основание: §3.
4. **Починить `public/hotels`-паттерн** в `app/hotels/[file]/route.ts:49,62` (построить индекс один раз) — убирает 2 предупреждения сборки. Основание: §6.2. Требует перепроверки отрицательных 404-ответов.
5. **Удалить `components/marketplace/CompactSearch.tsx`** (единственный подтверждённо мёртвый компонент). Основание: §3.

### 8.2 Требует решения человека

1. **`lib/registry-url-state.ts`** — продово мёртв, но покрыт тестом `lib/table-header-filter.spec.tsx`. Удалять только вместе с решением по этому spec-файлу (и вместе с вопросом: не является ли spec-файл единственным «хранителем» контракта URL-состояния реестров, который реализован иначе в компонентах).
2. **`npm run lint`** — либо установить ESLint + `eslint-config-next` и зафиксировать конфиг, либо удалить мёртвый скрипт. Сейчас `lint` в CI-подобных проверках смысла не имеет.
3. **`LEGACY_INTERNAL_REDIRECTS` / `resolveLegacyRedirect`** (`lib/routes.ts:54,63`) — не используются в рантайме, но документируют контракт и покрыты тестом. Предлагаю **оставить** (P3).
4. **Свести два публичных «хрома»** (PublicLayout vs MarketplaceHeader/Footer) и **два `Pagination`** — это функциональный рефакторинг с визуальными последствиями, требует отдельного согласования (P3).
5. **`frontend/app/app/loading.tsx`** (мой незакоммиченный файл из прошлой задачи) — в dev измеримого эффекта не дал; польза только для предзагруженных/prod-оболочек. Решение за пользователем.
6. **Незакоммиченные hero-правки** (`HeroSection.tsx`, `MarketplaceRenderer.tsx`) — не тронуты, ждут решения пользователя.

### 8.3 Генерируемое — не удалять

- `frontend/public/hotels/**` (4603 файла, 920.5 МБ) — источник: `backend/scripts/hotel-photo-catalog.ts`.
- `backend/data/**`, `backend/uploads/**`, `backend/.backups/**`, `backend/artifacts/**` — см. `.gitignore`.
- `frontend/scripts/patch-next-devtools.mjs` — запускается из `postinstall`, патчит только dev-tools Next (обход бага segment-explorer). Удалять нельзя без перепроверки бага.

---

## 9. Риски и проверки по каждому предлагаемому изменению

| # | Изменение | Риск | Проверка |
|---|---|---|---|
| 1 | Удалить `components/marketplace/CompactSearch.tsx` | Низкий. Потеря «потенциально нужной» второй панели поиска, если её планировали вернуть. Импорт 10 форм поиска из него — те же модули используются `HeroSearch`, поэтому удаление ничего не ломает в графе | `npx tsc --noEmit` → 0; `npx vitest run`; ручная проверка `/`, `/search` (панель поиска на месте) |
| 2 | Убрать импорты `useLocale`/`usePathname` из `lib/behavioral-events.ts` | Низкий: они не используются в теле файла (полнотекстовый поиск: только строки 4-5) | `tsc`; `lib/behavioral-events.spec.tsx` |
| 3 | Индекс `public/hotels` вместо динамического `path.join` | Средний: можно сломать отдачу существующих файлов и отрицательный кэш 404. Также критично, что каталог меняется только скриптом отелей | `next build` → 0 предупреждений; `/hotels/<существующий>.webp` → 200 `image/webp`; `/hotels/<несуществующий>.webp` → 404 с `cache-control`; замер `Compiling /` до/после |
| 4 | Точечные импорты иконок вместо barrel (`@phosphor-icons/react/dist/csr/<Icon>`) | Средний: массовая правка 19 файлов, риск опечатки в имени иконки (тип-система поймает) | A/B-замер `--webpack` `/` до/после (ожидание: падение с ~99 с до десятков секунд); `tsc`; `vitest`; визуальная проверка `/`, `/search`, `/app/dashboard`; `npm run build` |
| 5 | Удалить `lib/registry-url-state.ts` | Средний-высокий: тест `lib/table-header-filter.spec.tsx` перестанет компилироваться | Решение человека; при удалении — одновременно удалить/переписать spec; `vitest` |

---

## 10. Границы покрытия (что не проверено)

Не проверено / не измерено в этом аудите:
- **Функциональность под авторизацией**: для `/app/*` и `/partner/*` подтверждены HTTP-200 и отрисовка, но не сквозные сценарии (конструктор туров: создание → предпросмотр → публикация; модерация; финансы). Сценарии конструктора/CMS/preview/publish затронуты аудитом только статически.
- **E2E-набор**: в `frontend/` e2e-тестов не найдено; отдельный e2e-раннер не запускался.
- **Мобильная адаптация и визуальная регрессия**: не проверялись (только чтение CSS/классов).
- **Production-поведение развёрнутого стенда**: замеры сделаны только на локальном dev-сервере и локальном `next build`.
- **Профилирование CPU**: измерено только процессорное время процесса (`CPU seconds`) и рабочее множество (`WS`) — без профайлера (`--experimental-cpu-prof` не запускался), поэтому доля отдельных модулей в компиляции не измерена, а только выведена из §6.1/6.3.
- **`legacy/` в рантайме**: приложение не запускалось; вывод «изолировано» основан на статическом анализе ссылок, CI и конфигов.
- **Backend и БД**: вне области аудита.
- **Windows Defender / окружение**: влияние антивируса (`MsMpEng` ранее показывал большое CPU-время) не измерялось.
- **H1 и H3 не подтверждены A/B-замером** (см. §6.3) — это гипотезы, а не факты.

Аудит **не** охватывает «весь сайт»: покрыты все маршруты, layout, стили, реестры и граф `/` статически и все ключевые режимы компиляции — измерениями; не покрыты перечисленные выше динамические сценарии.

---

## 11. Дополнение: skeleton-parity (16.10.2026, по обращению пользователя)

Отдельная задача «найти все места, где состояние загрузки не совпадает с реальной раскладкой, и исправить» разобрана в `FRONTEND_RENDERING_CLEANUP_PLAN.md`, раздел **«SKELETON-PARITY»** (там же — список файлов, тесты и остающиеся расхождения).

Факты, на которых задача основана (получены чтением исходников, а не измерением):

- в `/app/*` — 41 страница (измерено: `Get-ChildItem -Recurse -LiteralPath app\app -Filter page.tsx`) и 16 разных форм каркаса при **единственном** сегментном `app/app/loading.tsx`, который обслуживал все маршруты ниже `/app`; отсюда — неизбежное расхождение для 15 из 16 форм;
- эталоны геометрии реальных страниц: `components/PageHeader.tsx:20,30`, `components/Kpi.tsx:25,66`, `components/OperationsCenterShell.tsx:279`, `components/KpiCard.tsx:85`, `components/NotAvailableCard.tsx:16`;
- витрина: `components/public/Skeletons.tsx` — `ProductGridSkeleton` использовал `lg:grid-cols-3`, тогда как реальные сетки `/search` и `/categories/[slug]` — `xl:grid-cols-3`; `PdpSkeleton` повторял доравенства-раскладку (см. P1-FIX);
- радиус карточек витрины задаётся `card-premium` / `--th-radius-card` (12px) вне CSS-слоёв, поэтому скелетоны с `rounded-2xl` (16px) расходились по скруглению — исправлено классом `.card-skeleton` в `app/globals.css`.

Не проверено в рамках дополнения: SSR-разметка загружаемых состояний (на момент правок dev-серверы остановлены по просьбе пользователя; для проверки нужен перезапуск `next dev`), визуальная регрессия, мобильная адаптация, `/store/*` (скелетона там нет).
