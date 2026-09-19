# TRAVELHUB — TOUR DATA ORIGIN AUDIT — ОТЧЁТ
**Дата:** 2026-09-19 · **Тип:** READ-ONLY аудит (production/local код и БД не изменены, ничего не создавалось/не удалялось/не коммитилось)

---

## 1. Verdict

**PREVIEW_SOURCE_IDENTIFIED** (частично — идентичность скрипта-удалителя: UNDETERMINED, см. §7)

Классификация (§12): **PREVIEW_USES_SEED_DATA** в широком смысле — Preview показывал **реальные строки `catalog."Product"`** из той же БД `travelhub1`, что и «реальный сайт». Отдельного preview-источника данных НЕ существует: «Preview» и «сайт» — это **одно и то же приложение** (Next.js :3000 + NestJS :4000 + PostgreSQL `travelhub1`). Расхождение — **временное** (данные были → потом массово удалены), а не структурное.

## 2. Direct Answer

> **Почему Preview показывал туры, а реальный каталог пуст?**

Потому что это происходило **в разное время с одной и той же БД**. Карточки (Ishq Talpe Villa, Amangalla, Golden Palace и др.) были настоящими `Product` (type=TOUR/HOTEL, status=PUBLISHED) в `travelhub1` и отдавались публичным API `GET /api/v1/public/products` — тем же самым, который читает сайт. Затем (18.09) все строки каталога были **массово удалены напрямую в БД, минуя API** — сейчас `catalog."Product"` = 0 во всех БД хоста, поэтому и Preview, и сайт показывают пустые секции (фронтенд скрывает пустые блоки: `HotTours.tsx: "Don't render section at all if empty or error"`).

## 3. Tour Creation Status

- Таблицы/сущности `Tour` **не существует** (0 таблиц с именем Tour; Prisma-модель одна — `Product`, `type=TOUR`).
- Реальные `Product`-записи **создавались**: `pg_stat` фиксирует **4920 INSERT / 4921 DELETE** (`Product`), 4563/4563 (`Tariff`), 4922/4923 (`ProductPublicationChannel`).
- **Механизм создания = прямая запись в БД в обход API**: `ProductHistory` = 0 строк, `security."AuditLog"` не содержит ни одного product-действия (только auth.login 134, request.created 12), `events."OutboxEvent"` пуст. При этом API-создание (`catalog.service.createProduct`) **всегда** пишет `ProductHistory` в той же транзакции → 4920 строк созданы Prisma-скриптами, а не через API.
- In-tree скрипт `src/seed/demo-seed.ts` (200 продуктов, upsert, без history) совпадает по **механизму** (прямой Prisma-upsert), но его фиксированные детерминированные ID и шаблонные имена («Baku Old City Walking Tour»…) не совпадают с наблюдаемым объёмом (~24–25 прогонов × ~200) и именами карточек Preview.
- Имена карточек Preview (Amangalla / Ishq Talpe / Golden Palace / Актау) **отсутствуют во всём дереве** (src, seed, scripts, dist, reports, docs, legacy/dev.db) — скрипт, их создавший, в рабочем дереве не сохранился. Коррелирует с практикой ad-hoc скриптов: `backend/diagnostic/` (8 скриптов прошлых сессий) сейчас **пуст**.

## 4. Preview Data Flow

```
Preview (та же Next.js страница http://localhost:3000)
→ HotTours/Tours/SpecialOffers/LatestOffers/Hotels (frontend/components/marketplace/*)
→ publicApi.listProducts({sort,pageSize:50})  [frontend/lib/public-api.ts:161-200]
→ GET /api/v1/public/products  (proxy → NestJS :4000)
→ PublicCatalogController.listProducts (@Public, PUBLISHED-only)
→ PublicCatalogService → Prisma → catalog."Product"
→ PublicProductCard DTO → TourCard
```
Mock/fixture/USE_MOCK-пути во фронте **отсутствуют** (grep по lib/components/app — 0 совпадений; единственный "fixture" — тестовые данные в `workspace-api.spec.ts`).

## 5. Real Site Data Flow

Идентичен §4 (тот же браузерный URL :3000, тот же backend :4000, та же БД). Отличий Preview vs Production в конфигурации данных нет: `.env.local` не требуется (run doc), `BACKEND_URL` один (`http://localhost:4000`), DATABASE_URL один (`postgresql://…/travelhub1`).

## 6. Preview vs Real Site Matrix

| Вопрос | Preview | Real Site | Evidence |
|---|---|---|---|
| Data source | public catalog API | тот же | `public-api.ts` BASE `/api/v1/public` |
| Database | travelhub1 | travelhub1 | `backend/.env` DATABASE_URL; один backend :4000 |
| API | GET /api/v1/public/products | тот же | `public-catalog.controller.ts:69` |
| Endpoint filters | PUBLISHED-only, sort/pageSize | те же | `PublicCatalogService` (approved+PUBLISHED) |
| Tour records | были (реальные строки) | сейчас 0 | pg_stat 4920 ins/4921 del; COUNT(*)=0 |
| Mock data | нет | нет | grep USE_MOCK/mockTours/demoTours — 0 |
| Seed data | demo-seed существует, имён карточек не содержит | тот же | `demo-seed.ts` PRODUCT_TEMPLATES |
| Supplier data | SupplierOffer → search-only | то же | supplier-модуль не пишет product (grep 0) |
| TourCard input | PublicProductCard (DTO реального API) | тот же | HotTours.tsx:104-118 |
| Result count | >0 (19.09 01:55 snapshot) | 0 сейчас | preview_snapshot vs curl `{"items":[],"total":0}` |

## 7. Root Cause

**Каталог опустошён массовым bulk-DELETE прямо в БД (~18.09, последняя активность по таблице — autovacuum 2026-09-18 16:35), в обход API.** Профиль wipe-а — **только каталог**: `Product` 4921 del, `Tariff` 4563 del, `ProductPublicationChannel` 4923 del; при этом `Category` (18), `Partner` (Summer/KOMPAS), `Supplier`, storefront-таблицы — целы. Это НЕ `reset-and-reseed.ts` (он вычищает также Partner/Category/Customer — они целы) и НЕ e2e-jest (изолированы на `travelhub1_*_test` через `e2e.env.ts`). Спеки с прямым доступом к dev-БД (`commerce-chain.invariants.spec.ts:19`, `reference-number.concurrency.spec.ts:15` — hardcode-fallback `travelhub1`) — **только читают**/пишут BusinessSequence, каталог не трогают (проверено построчно). **Скрипт-удалитель в текущем дереве отсутствует** — наиболее вероятно, ad-hoc cleanup-скрипт одной из прошлых агентских сессий (ср. пустой `backend/diagnostic/`). Логирование DELETE в PostgreSQL выключено (log_statement off), AuditLog обойдён → идентичность удалителя по имеющимся следам **неустановима** (UNDETERMINED).

## 8. Required Next Implementation (НЕ реализовано — только план)

1. **Восстановить каталог детерминированно**: `npm run seed:demo-2026` (demo-seed, 200 PUBLISHED-продуктов) — быстрый путь; либо реализовать пайплайн **SupplierOffer → Product** из `docs/prompts/TRAVELHUB_SUMMER_ONLY_SUPPLIER_ENGINE_IMPLEMENTATION_PROMPT.md` (Product+SupplierOffer модель уже спроектирована там) — постоянный источник реальных туров.
2. **Guardrails против повторного wipe-а**:
   - `reset-and-reseed.ts` → требовать `--yes` + явное имя БД (по образцу guard из `src/perf/lib/guard.ts`);
   - убрать hardcode-fallback `travelhub1` в `commerce-chain.invariants.spec.ts:19` и `reference-number.concurrency.spec.ts:15` (падать, если TEST_DATABASE_URL не задан);
   - включить `log_statement = 'mod'` для схемы `catalog` (или pgaudit) — чтобы будущие bulk-DELETE были видимы.
3. **Практика сессий**: запрет удалять диагностические скрипты до фиксации в отчёте (сейчас `backend/diagnostic/` пуст, а скрипты упомянуты в отчётах — воспроизводимость потеряна).

## 9. KOMPAS

KOMPAS/Summer **только инспектировались** (kompas.adapter.ts, supplier-модуль): подтверждено, что в текущей реализации существует только путь `SupplierOffer → Search result / PriceConfigurator`; **персистентности SupplierOffer → Product нет**. Изменений в KOMPAS-код не внесено (closure 837c587 не затронут).

## 10. Git State

- Ветка: `master`; HEAD: **`837c587`** — `feat(kompas): close application integration`.
- Working tree: **не изменён аудитом**. Untracked (pre-existing): `backend/start-backend.cmd`, `docs/prompts/*.md` (9 шт., вкл. сам промпт аудита), `reports/`.
- Commit/push/stage не выполнялись.

## 11. Evidence

| # | Факт | Источник |
|---|---|---|
| E1 | `catalog."Product"` = 0; `Tour`-таблицы нет | psql COUNT / information_schema |
| E2 | 4920 ins / 4921 del Product; 4563/4563 Tariff; 4922/4923 PublicationChannel; autovac 18.09 16:35 | `pg_stat_all_tables` |
| E3 | Остальной каталог и CRM целы (Category 18, Partner=Summer/KOMPAS, Supplier=2) | psql |
| E4 | AuditLog: 0 product-действий; OutboxEvent: 0 строк; ProductHistory: 0 | psql (security/events/catalog) |
| E5 | API-создание всегда пишет ProductHistory | `catalog.service.ts:288,303,802,900,964` |
| E6 | Публичный API = PUBLISHED-only, @Public | `public-catalog.controller.ts:69` + header-комментарий |
| E7 | Все marketplace-секции читают publicApi.listProducts | `HotTours.tsx:104`, `Tours.tsx:105`, `SpecialOffers.tsx:120`, `LatestOffers.tsx:126`, `Hotels.tsx` |
| E8 | Пустые секции скрываются UI | `HotTours.tsx` («Don't render section at all if empty or error») |
| E9 | Mock-пути отсутствуют | grep USE_MOCK/mockTours/demoTours/fixtures по frontend = 0 |
| E10 | e2e-тесты изолированы (обязателен test-DB, guard «must contain test») | `test/e2e.env.ts`, `e2e-db-config.ts` |
| E11 | Спеки с fallback `travelhub1` — read-only (SELECT / BusinessSequence INSERT) | `commerce-chain.invariants.spec.ts:19,25`, `reference-number.concurrency.spec.ts:15,21,50` |
| E12 | reset-and-reseedwipe-профиль не совпадает (уничтожал бы Partner/Category) | `reset-and-reseed.ts:102-133` + E3 |
| E13 | demo-seed: 200 продуктов, upsert, без history, имена «Baku…» ≠ имена Preview | `demo-seed.ts:36-38,364` |
| E14 | Имена карточек Preview отсутствуют в дереве и legacy/dev.db | grep Amangalla/Ishq/Talpe/Golden Palace по всему репо = 0 |
| E15 | `backend/diagnostic/` пуст (ad-hoc скрипты прошлых сессий удалены) | ls → 0 файлов |
| E16 | Карточки реально отображались 19.09 01:55 (snapshot Preview) | журнал сессии/preview_snapshot |

---

**FINAL PRINCIPLE соблюдён:** система не изменена; цель аудита — установление источника и документирование следующего шага — выполнена.
