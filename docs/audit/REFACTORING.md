# Выполненные рефакторинги и изменения

Все изменения — в рамках существующей архитектуры; публичные контракты не
удалялись. Новые поля ответов — аддитивные.

## 1. Идентичность гостиницы: единое имя и цена из реестра

**Было.** `catalog.Hotel`/`HotelSupplierRef` уже хранили физическую гостиницу и
фото, но каноническое имя работало только через запись
`Product.attributes.canonicalHotelName`, которую делал `mergeHotels`. Любой
следующий синк пересобирал `attributes` и терял имя. Поиск предложений брал
первый продукт поставщика (`findFirst attributes.supplierCode`), поэтому цена
могла быть от другого отеля.

**Стало.**
- `public-catalog.service.ts`: `hotelPhotoMap` → `hotelRegistryMap` /
  `hotelRegistryForOne`; одна batch-выборка `HotelSupplierRef → Hotel` даёт и
  `photoUrl`, и `Hotel.name` для карточки и PDP. Имя подставляется общим
  `applyCanonicalName()` (`hotel-identity.ts`), сохраняющим хвост программы
  тура/города.
- `public-suggest.service.ts`: каноническое имя берётся из `catalog."Hotel"`
  (JOIN уже был), а не из `attributes`; добавлен фильтр видимости
  `EXISTS(ProductPublicationChannel)`.
- `hotel-matching.service.ts`: `getOffersForHotel()` ищет продукты по
  `supplierRef = {SUPPLIER}HTL-{hotelKey}-` (граница `-` исключает коллизию
  `123`/`1234`), выбирает самый дешёвый продукт на supplier-native отель,
  принимает публичный visibility-фильтр.
- `hotel-match-review.service.ts`: `mergeHotels`/`splitHotel` — в
  `$transaction`, с запретом слияния отелей разных стран, переносом
  фото-метаданных и записью в `security.AuditLog`; `findCandidates` группирует
  по городу, использует общий `nameSimilarity`, имеет бюджет пар и пагинацию.
- `hotel-matching.service.ts` (sync): существующий `HotelSupplierRef` больше
  **не перепривязывается** к другому Hotel. Иначе ручное слияние откатывалось
  следующим синком. Конфликт нескольких отелей в одной группе не склеивается
  автоматически, а логируется.

**Почему так, а не запись в Product.** Реестр — источник истины; чтение через
join исключает рассинхронизацию и не требует backfill-скрипта после каждого
синка. Слияние теперь видно на витрине сразу и не теряется.

**Файлы:** `backend/src/modules/catalog/hotel/hotel-matching.service.ts`,
`hotel-match-review.service.ts`, `hotel-match-review.controller.ts`,
`hotel-identity.ts`, `public/public-catalog.service.ts`,
`public/public-suggest.service.ts`, `catalog.module.ts`,
`supplier/supplier.controller.ts`.

## 2. Pricing: контракт валюты при записи в каталог

**Было.** `SupplierPricingService.publicAmountFor()` возвращает только число и
НЕ конвертирует валюту. Voyager вызывал его и ставил `currency = "AZN"` при
наличии курса, хотя сумма оставалась в USD. Витрина показывала USD-число как
AZN.

**Стало.** Добавлен `publicAmountWithFxFor()` — convert-then-markup, возвращает
`{ amount, currency }`; у `publicAmountFor()` в документации явно зафиксировано
«не конвертирует, валюту сохраняет вызывающий». Voyager tour/hotel sync
переведены на новый метод; `startingPrice` и тарифы всегда согласованы по
валюте (при отсутствии курса — fail-open в исходной валюте).

**Файлы:** `backend/src/modules/pricing/supplier-pricing.service.ts`,
`supplier/voyager/voyager-sync.service.ts`,
`supplier/voyager/voyager-hotel-sync.service.ts`,
`pricing/supplier-pricing.service.spec.ts` (+4 теста).

## 3. RBAC: объявление прав supplier API

Коды `supplier.search.read` / `supplier.search.manage` требовались
контроллером, но отсутствовали в каталоге прав, поэтому guard fail-closed
блокировал все `/supplier/*` эндпоинты. Коды добавлены в
`security/permissions.constants.ts` (+ `ROLE_PERMISSIONS` для документации),
гранты — миграциями:

- `20261025150000_declare_supplier_search_permissions` — Permission-строки,
  ADMIN (read+manage), DIRECTOR/OPERATOR (read).
- `20261025150500_revoke_partner_supplier_search` — удаление лишнего гранта
  `supplier.search.read` у PARTNER (найден в dev-БД; риск disintermediation).

**Проверка:** SQL-выборка грантов (`reports/verify-supplier-perms2.cjs`),
`prisma migrate deploy`, `prisma migrate status`.

## 4. Публичный контур: видимость и утечки

- `/public/suggest`: добавлен `EXISTS(ProductPublicationChannel)` — раньше
  продукт без каналов публикации попадал в подсказки.
- `/public/hotels/:hotelId/offers`: прокинут `marketplaceWhere()` в выборку
  продуктов; цены конвертируются в AZN по курсу поставщика, минимум считается
  только при единой валюте (иначе `minPrice=null`, без ложного сравнения).
- `/public/tours/:productId/comparable`: база проверяется на публичную
  видимость (400/404 вместо утечки черновика), альтернативы фильтруются тем же
  `marketplaceWhere()`.
- `public-supplier.controller.ts`: 500 больше не отдаёт сырой текст ошибки
  поставщика — только `Supplier request failed`, детали в логе.

## 5. Frontend: локаль, цены, ошибки

- `lib/i18n.tsx`: `DEFAULT_LOCALE` конфигурируется
  `NEXT_PUBLIC_DEFAULT_LOCALE` (значения ru/az/en, иначе AZ). Прод-дефолт
  остался AZ; vitest фиксирует RU, т.к. компонентные спеки исторически
  проверяют русские строки. Это устранило 48 падений без ослабления проверок:
  AZ/EN по-прежнему покрыты явными locale-тестами.
- `vitest.config.ts`: `test.env.NEXT_PUBLIC_DEFAULT_LOCALE = "ru"` +
  комментарий-обоснование.
- Все 6 marketplace-секций используют `formatPrice()` — единый формат
  «от 350,00 $» вместо `350 USD`.
- `app/error.tsx`: глобальный error boundary с `reset()`, локализацией и без
  утечки внутренних деталей; ключи `error.*` добавлены в i18n.
- `StorefrontSite.spec.tsx`: два устаревших assertion приведены к реальному
  DOM (бренд в header+footer; футер собирается из нескольких узлов и
  подгружается асинхронно) — проверки не удалены, а уточнены.

## 6. Тестовая инфраструктура

- `backend/package.json`: `jest.setupFiles = ["dotenv/config"]`. Раньше
  DB-зависимые спеки падали с `password authentication failed`, потому что не
  читали `.env` и шли на хардкод `travelhub1`.
- `supplier.controller.ts`: три копии `try/catch + console.warn` заменены
  методом `syncHotelRegistry()` с Nest `Logger` — это же устранило нарушение
  `pricing-debug-artifacts.spec.ts` (§5.9: только Nest Logger).
- Новый `hotel-matching.service.spec.ts` фиксирует регрессию выбора продукта.

## 7. База данных

Аддитивные индексы под публичную выдачу (без изменения данных):

```sql
CREATE INDEX "Product_status_publishedAt_idx" ON catalog."Product" ("status","publishedAt");
CREATE INDEX "ProductPublicationChannel_channel_productId_idx"
  ON catalog."ProductPublicationChannel" ("channel","productId");
```

`EXPLAIN ANALYZE`: 190.3 ms → 2.25 ms на публичном листинге. Миграция
`20261025151000_public_listing_indexes`, схема Prisma синхронизирована.

## 8. Изменённые/добавленные файлы (основное)

Backend:
`modules/catalog/hotel/{hotel-identity.ts,hotel-identity.spec.ts,hotel-matching.service.ts,hotel-matching.service.spec.ts,hotel-match-review.service.ts,hotel-match-review.controller.ts}`,
`modules/catalog/public/{public-catalog.service.ts,public-suggest.service.ts}`,
`modules/catalog/tour-matching.service.ts`,
`modules/pricing/supplier-pricing.service.ts` (+spec),
`modules/supplier/{supplier.controller.ts,public-supplier.controller.ts,voyager/voyager-sync.service.ts,voyager/voyager-hotel-sync.service.ts}`,
`modules/finance/{supplier-payment.service.ts (+spec),supplier-payment-evidence.service.ts (+spec),supplier-debt-report.service.ts (+spec),supplier-payment-terms.service.ts (+spec),ledger-posting.consumer.ts (+spec),supplier-obligation.service.ts (+spec),finance.controller.ts,finance.module.ts,finance.validation.ts,finance-overview.service.ts (+spec)}`,
`security/permissions.constants.ts`, `package.json`,
`prisma/schema.prisma`, 8 миграций (RBAC×2, public indexes, supplier payments,
evidence, obligation events, payment terms, idempotency).

Frontend:
`lib/i18n.tsx`, `lib/finance-center-api.ts`, `vitest.config.ts`, `app/error.tsx`,
`app/app/finance/{overview,obligations,supplier-payments,payment-terms}/page.tsx`,
`app/app/finance/reports/debt-as-of/page.tsx`,
`components/{Shell,PanelFrame,MarketplaceHeader}.tsx` (визуальные фиксы),
`components/marketplace/{Tours,Hotels,HotTours,Flights,LatestOffers,SpecialOffers}.tsx`,
`components/storefront/StorefrontSite.spec.tsx`,
`components/PublicLayout.tsx` (мобильная шапка).

Документация: `docs/audit/*`, правки `README.md`.

## 9. Что сознательно НЕ менялось

- Публичные DTO/эндпоинты не переименовывались и не удалялись.
- Бизнес-правила наценок/комиссий/статусов не переписывались (кроме
  исправления фактической ошибки валюты).
- Схема БД не переструктурирована; только аддитивные индексы и RBAC-строки.
- `legacy/` не трогали.
- Мёртвый код и `any` массово не вычищались — это отдельный поэтапный
  рефакторинг (см. `REMAINING_WORK.md`).

## 10. Finance completion — supplier payments (2026-10-25)

**Расширена существующая модель вместо параллельной.** `SupplierPayout` стал
заголовком платежа (supplier/partner, status PENDING/CONFIRMED/CANCELLED,
purpose/comment, confirm/cancel, version; `obligationId` — nullable legacy);
добавлена `SupplierPayoutAllocation` (payout ↔ obligation, amount + aznAmount,
`reversedAt`). Миграция `20261025160000_supplier_payment_allocations`
аддитивна и бэкфиллит legacy-выплаты в CONFIRMED + одну allocation, сохраняя
paid/remaining. `SupplierObligation` получил `invoiceNumber`, `dueDate`,
`version`; `OVERDUE` вычисляется на чтении (dueDate < сегодня, remaining > 0).

Новый `SupplierPaymentService`: регистрация (PENDING, распределения не
применяются), подтверждение (CAS PENDING→CONFIRMED + guarded применение
allocations), распределение (в т.ч. на CONFIRMED-платёж — применяется сразу),
отмена (PENDING — без влияния; CONFIRMED — сторно с возвратом paid/remaining),
idempotency по `providerRef`, supplier/currency/over-allocation guardrails,
audit на каждое действие, ledger-outbox событие на подтверждение.

Legacy `POST /finance/obligations/:code/payouts` сохранён (создаёт
CONFIRMED-платёж + allocation в одной транзакции) — обратная совместимость
существующего UI/тестов.

Финансовый UI: новый `/app/finance/supplier-payments` (KPI, фильтры, реестр,
форма регистрации, карточка с распределениями, confirm/cancel), доработка
`/app/finance/obligations` (счёт/срок/overdue, фильтр, редактирование
реквизитов), KPI в `/app/finance/overview`. i18n RU/AZ/EN, права через
`useCan` + серверные guard'ы. Экспорт CSV/XLSX обоих реестров через
существующий `ExportService` (`TableExportButton`, фильтры, cap 5000).

### 10.1 Завершающий проход (2026-10-25)

- **Ledger reversal.** Новое событие `SupplierPayoutReversed` (outbox) и
  факт `SUPPLIER_PAYOUT_REVERSAL` (same sourceType/sourceId, другой type).
  Исходная проводка не удаляется; CAS `PENDING/CONFIRMED → CANCELLED` гарантирует
  одного победителя, проигравший не сторнирует; inbox + unique(source,type)
  делают повторную доставку no-op.
- **Evidence.** `SupplierPaymentEvidence` (metadata) + приватный S3,
  signed URL 300 s, MIME + проверка сигнатуры файла, размер, компенсирующая
  очистка при сбое БД, soft delete только PENDING, аудит upload/delete,
  дочерний доступ только через код платежа (IDOR → 404).
- **Исторический отчёт.** Append-only `SupplierObligationEvent`
  (CREATED/ADJUSTED/CANCELLED, occurredAt) + backfill из AuditLog; оплата на
  дату — только CONFIRMED allocations с `confirmedAt <= asOf`, созданные до
  даты и не сторнированные; отмена после даты не переписывает прошлое;
  legacy помечается `LEGACY_CURRENT`, итоги группируются по валютам.
- **Нераспределённые.** `?unallocated=true`, причина
  `NOT_ALLOCATED/FX_VARIANCE/PARTIAL`; FX-остаток не распределяется
  автоматически.
- **Сроки.** `SupplierPaymentTerms` (`IMMEDIATE`, `NET_DAYS 0–365`) +
  snapshot `paymentTermsRule/Days/AppliedAt` и рассчитанный `dueDate` в
  обязательстве; правило применяется только при создании.
- **E2E.** `test/finance-supplier-payments.e2e-spec.ts`: booking→obligation→
  PENDING→confirm→ledger→cancel→reversal→documents→as-of→export; отдельно
  проверены повторный confirm/cancel и отсутствие второго сторно.
- **Idempotency-Key.** Переиспользован общий `@Idempotent` interceptor:
  операция `supplier_payment.create`, серверный слот
  `SupplierPayout.idempotencySlotKey` (unique) для crash-window 3; missing key
  → 400, same key/payload → replay, divergent → 409, concurrent → один факт.
  `providerRef` остаётся отдельной защитой внешней операции; replay разрешён
  только при совпадении суммы/валюты/поставщика и набора allocations.

## 11. Визуальные исправления (реальный браузерный прогон)

- **Контраст admin-контура**: `<main>` теперь `bg-slate-50 text-slate-900
  [color-scheme:light]`; PanelFrame — `text-slate-900`. До этого таблицы
  finance/реестров наследовали светлый цвет тёмной витрины.
- **Мобильный sidebar**: авто-collapse при `<768px` + resize-handler; на 375 px
  контент больше не уезжает за экран (scrollWidth = 375, rail 72 px).
- **Нативные контролы**: `color-scheme: light` в admin — checkbox/date больше
  не чёрные на белом.
- **Формат дат/сумм**: дата платежа через `formatDate`, суммы через
  `formatPrice`; панель распределений — одноколоночная (не обрезает
  placeholder'ы).
- **Публичная шапка на мобильном**: вторичные действия (Register/Аккаунт/Выход)
  скрыты `<sm`, основное действие остаётся; PDP 375px больше не даёт
  горизонтальный overflow (было 382px → 375px).

Скриншоты baseline/after: `docs/audit/ui-baseline/` (21+ снимок, отчёт
`visual-report.json`).
