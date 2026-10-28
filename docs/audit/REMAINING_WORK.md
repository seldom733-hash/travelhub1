# Оставшиеся задачи и ограничения

Список сознательно не «раздут»: только подтверждённые аудитом задачи, которые
не были безопасно выполнены в этом проходе. Порядок — рекомендуемая
последовательность.

## P1-кандидаты (следующий проход)

1. **E2E-прогон и CI.** Полный serial-прогон выполнен на изолированной
   `*_test`: **114 suites / 1719 tests — PASS** (`reports/e2e-hybrid-final2.log`),
   включая финансовый сценарий и RBAC. Инфраструктура: `TEST_DATABASE_URL`,
   миграции на тестовой БД, MinIO test-bucket, heap 12 GB. Отдельно остаётся
   подключить этот прогон в CI (текущий workflow не актуализирован).
   *Критерий:* CI запускает тот же serial e2e и зелёный.
2. **ESLint.** `frontend/package.json` объявляет `lint: eslint`, но пакета нет
   и конфига нет. Нужно: добавить `eslint` + `eslint-config-next` (flat config
   `eslint.config.mjs`), прогнать, зафиксировать baseline нарушений, ввести в
   CI. Не отключать правила ради «зелени».
   *Критерий:* `npm run lint` выполняется и проходит (или документированный
   список исключений).
3. **Rate limiting публичного supplier API.** `/public/supplier/*` дергает
   внешние системы; ограничение сейчас только внутри адаптеров
   (resilience/circuit breaker). Нужен общий лимитер (per-IP/anon-session) и
   429-контракт, согласованный с фронтом (он уже умеет показывать retry для
   503/429).
   *Критерий:* лимит на дорогие эндпоинты, тест на 429, метрики.

## P2 (архитектура/UX/производительность)
4. **Дублирование marketplace-секций.** `Tours`, `Hotels`, `HotTours`,
   `Flights`, `LatestOffers`, `SpecialOffers` — почти идентичные компоненты
   (~1000 строк): карточка + skeleton + заголовок + сетка + mobile-link.
   Предложение: `MarketplaceSection` (props: title/subtitle/href/items/loading/
   variant) и `MarketplaceCard` (icon, aspect, size, showSeller); сохранить
   визуальные варианты через props, а не копии.
   *Риск:* средний (визуальная регрессия) → нужен screenshot-прогон до/после.
5. **Screenshot-baseline UI — выполнено частично (2026-10-25).** Снято 21
   состояние (1440/768/375): `/`, `/search`, `/login`, finance overview/
   obligations/supplier-payments, `/app/payments`, `/app/requests` +
   заполненные finance-состояния. Лежат в `docs/audit/ui-baseline/` вместе с
   `visual-report.json`. Не покрыты `/products/[code]`, `/store/[slug]`,
   `/app/orders` (нужны реальные коды/данные) — добавить при следующем проходе.
6. **Счётчик публичной выдачи.** `COUNT(*)` ≈56 ms на листинг; при росте
   каталога станет узким местом. Варианты: кэш счётчика с инвалидацией по
   публикации/каналу, либо approximate-count. Требует согласования точности.
7. **N+1 в синках поставщиков.** `findFirst`/`upsert` на продукт/тариф в
   циклах (`kompas-hotel-sync`, `voyager-hotel-sync`, `kazunion-hotel-sync`,
   `anax/fstravel/summertour`). Каталог растёт — время синка линейно по
   запросам. Предложение: batch `findMany` по `supplierRef IN (...)` + один
   `upsert`/`createMany` на пачку, замер до/после.
8. **Типизация `any`.** Backend: 736 `as any`, 448 `: any` (из 160k строк).
   Поэтапно по доменам, начиная с финансовых путей (там уже `Decimal`).
   Ввести запрет новых `as any` в изменяемых файлах (ESLint после п.2).

## P3 (гигиена)

9. **Каноническое имя и `<html lang>`.** `app/layout.tsx` рендерит
   `lang="az"` всегда; `LocaleProvider` исправляет после mount. Для SEO/a11y
   лучше определять локаль на сервере (cookie `travelhub.locale` или
   `Accept-Language`) и рендерить корректный `lang`.
10. **`color-scheme`.** Глобально `dark`, но админ-таблицы и часть карточек
    светлые — нативные контролы могут выглядеть чужеродно. Вынести
    `color-scheme` в theme-классы layout'ов.
11. **i18n-монолит.** `lib/i18n.tsx` — 3200+ строк, `help-registry` — 1385,
    `help-i18n` — 801: часть ключей дублируется. Разбить по доменам
    (`i18n/catalog.ts`, `i18n/commerce.ts`, …) без изменения API `t()`.
12. **Общие UI-примитивы.** Нет `components/ui`: кнопки/поля/бейджи/модалки
    повторяются в `components/public`, `internal`, `command-center`,
    `partner`. Ввести минимум (Button/Input/Select/Field/Modal/State) и
    использовать в новых экранах, не переписывая старые разом.
13. **Прогресс фоновых операций.** Синки/merge/экспорт возвращают итог в
    ответе API; в UI нет прогресса и истории. Нужен job-run журнал
    (аудит уже есть) + экран/тосты.
14. **Чистка артефактов аудита.** `reports/*.cjs` — одноразовые скрипты
    проверки; решить, что переносится в `backend/scripts/audit/`, остальное
    удалить из репозитория (сейчас untracked).

## Финансы и платежи поставщикам (2026-10-25, завершающий проход)

Закрыто в этом проходе:

- **Ledger-reversal.** Отмена CONFIRMED создаёт отдельную append-only проводку
  `SUPPLIER_PAYOUT_REVERSAL` (исходная `SUPPLIER_PAYOUT` сохраняется); CAS
  защищает от двойного сторно, outbox/inbox — от повторной доставки.
- **Документы платежа.** Приватный S3, signed URL, PDF/JPEG/PNG/WebP ≤10 MB,
  аудит upload/delete, soft delete только для PENDING; чужой документ → 404.
- **Отчёт «задолженность на дату».** Append-only `SupplierObligationEvent`,
  подтверждённые allocations на дату, `LEGACY_CURRENT` для старых записей,
  итоги по валютам, CSV/XLSX и аудит экспорта.
- **Реестр нераспределённых.** `?unallocated=true`, причина остатка
  (`NOT_ALLOCATED` / `FX_VARIANCE` / `PARTIAL`), переход к распределению.
- **Срок оплаты.** `SupplierPaymentTerms` (IMMEDIATE / NET_DAYS 0–365), snapshot
  правила и dueDate в обязательстве; изменение правил не переписывает прошлое.
- **Идемпотентность создания.** `@Idempotent("supplier_payment.create")` +
  unique `idempotencySlotKey`: повтор HTTP не создаёт дубль, divergent key →
  409, concurrent → один факт; `providerRef` сохранён как отдельная защита.
- **Финансовый E2E.** booking→obligation→PENDING→confirm→ledger→cancel→reversal
  → повторная отмена → документы → отчёт→экспорт: PASS. 8 finance-related
  suites / 89 tests PASS.

Осталось:

1. **Банковская интеграция/выписки и сверка.** Не реализована и не
   имитировалась. Нужен контракт импорта (CSV/API), матчинг по
   `providerRef/amount/date`, отчёт расхождений.
2. **Полный E2E-набор.** Выполнен: **114 suites / 1719 tests — PASS**
   (`reports/e2e-hybrid-final2.log`), включая финансовый сценарий. Осталось
   закрепить в CI.
3. **AFTER_INVOICE_DAYS.** Не реализован: в модели нет `invoiceReceivedAt`,
   поэтому срок «от счёта» не вычисляется; при появлении даты получения счёта
   добавить правило и snapshot, не пересчитывая прошлое.
4. **Автоподстановка FX-остатка.** Остаток от курсовой разницы виден и может
   быть распределён вручную; автоматическое распределение на произвольное
   обязательство запрещено.
5. **Миграции на staging/prod.** `20261025160000_*`, `20261025170000_*`,
   `20261025171000_*`, `20261025172000_*`, `20261025173000_*` применены на dev;
   на staging/prod — `prisma migrate deploy` в согласованное окно (все
   аддитивные, с backfill).
6. **`@Idempotent`-ключ HTTP create.** Подключён: `supplier_payment.create`,
   `SupplierPayout.idempotencySlotKey` (unique), replay/409/concurrent
   one-fact; UI переиспользует ключ при повторе того же payload. `providerRef`
   остаётся отдельной защитой внешней операции.

## Известные ограничения, принятые сознательно

- **Auth/rate-limit state в памяти** (login/guest checkout) — single-instance;
  для горизонтального масштабирования нужен внешний store (Redis). Отражено в
  README.
- **PSP/финансовый runtime** — фундамент (ledger/snapshots) есть, провайдер
  платежей не подключён; финансовый UI минимален. Не входило в аудит.
- **Ручное слияние отелей** — решение менеджера, авто-слияние по имени
  запрещено (аудит 23.10). Долговечность обеспечена тем, что синк не
  перепривязывает существующие refs; отдельного `HotelMergeLog` нет — история
  в `security.AuditLog` (`catalog.hotel.merge/split`).
- **Legacy** (`legacy/`) — исторический проект, не runtime, не трогали.
