# ETG / RateHawk — Read-Only Audit Report (TravelHUB)

**Дата аудита:** 2026-10-22
**Проверенная ветка/commit SHA:** `master` @ `fbe719b4e2a4ca834d0221ed84981a224f651e82`
**Режим:** исключительно read-only. Исходный код, миграции, конфигурация не изменялись. Тесты с побочными эффектами не запускались.

## 1. Краткое резюме

Интеграция ETG / RateHawk **не реализована**. Поиском по всему репозиторию (backend/src, frontend, конфиги, миграции) не найдено ни одного упоминания `ETG`/`RateHawk`/`ratehawk`, ни адаптера, ни эндпоинтов, ни DTO, ни тестов. Существующие поставщики отелей (KOMPAS, KAZUNION, ANEX, SUMMERTOUR, VOYAGER) реализуют только **поиск цен и синхронизацию каталога**, но **не бронирование через API поставщика** — бронирование в TravelHUB является ручным внутренним workflow (Booking → Order → SupplierConfirmation), без HTTP-вызовов к поставщику.

**Сводка по пунктам 53–80:** PASS 0, PARTIAL 12, FAIL 0, NOT IMPLEMENTED 14, BLOCKED 0, NOT APPLICABLE 2 (пункты 56 и 68 — вне области аудита).

## 2. Архитектура фактически найденной интеграции

### 2.1 Поставщики отелей (search-only)
- `backend/src/modules/supplier/` — адаптеры: ANEX, KAZUNION, KOMPAS, SUMMERTOUR, VOYAGER, FSTRAVEL.
- Все реализуют `SupplierAdapter.search()` (цены) и `discoverGeoOptions()` (гео-словарь). Никто не реализует `book`/`prebook`/`recheck`/`cancel`.
- `supplier-aggregator.service.ts` — агрегатор с per-supplier deadline (240s), `perSupplier.{count,error,ms,rawOffers}`, `clientClosed`-лог.
- `supplier-pricing.service.ts` — конвертация USD→AZN через seeded FX-курсы, markup. Нет минимальной цены продажи / floor price.

### 2.2 Каталог отелей
- `catalog."Hotel"` (physical hotel, `photoFile`, `photoStatus`, `photoSource`), `catalog."HotelSupplierRef"` (supplierCode+externalKey → Hotel).
- `hotel-registry.ts` строит реестр из products + geo links; `hotel-photo-catalog.ts` качает фото с TripAdvisor CDN.
- `public-catalog.service.ts::hotelPhotoMap` резолвит фото через реестр.

### 2.3 Бронирование/заказ
- `booking.Booking` (lifecycle NEW→COMPLETED), `Order`, `OrderItem`, `OrderTraveler`, `Passenger`, `Reservation`, `SupplierConfirmation`.
- `SupplierConfirmation.confirmationNumber` существует в схеме, но **не используется** в src (grep по `confirmationNumber`/`HCN`/`externalBookingId` → 0 совпадений).
- Нет HTTP-вызовов к поставщику в booking/order flow. Бронирование — внутренний workflow с ручными переходами статусов.

### 2.4 География
- `geo.SupplierGeoLink` (kind TOWN/STAR/HOTEL/TOUR) — заполняется `run-geo-ingest.ts`.
- На момент аудита (commit `fbe719b`) для SUMMERTOUR и KAZUNION `geo.SupplierGeoLink` содержал 0 строк — geo-ingest для них не запускался. Во время сессии аудита (после commit) были запущены `run-geo-ingest.ts SUMMERTOUR 9` и `run-geo-ingest.ts KAZUNION 6`, что добавило 272 и 577 записей соответственно. Эти изменения — операции с БД, не часть проверенного кода.

## 3. Таблица пунктов 53–80

| ID | Пункт | Статус | Доказательство |
|---:|---|---|---|
| 53 | Полный цикл бронирования | NOT IMPLEMENTED | Нет ETG-адаптера; `supplier/**` содержит только `search`/`discoverGeoOptions`. `booking.service.ts` — внутренний lifecycle, без HTTP-вызовов к поставщику. |
| 54 | Архитектура взаимодействия | NOT IMPLEMENTED | Нет sequence supplier→ETG. Существующая архитектура: Frontend → Backend (aggregator) → supplier adapters (search-only) → БД. Точек бронирования у поставщика нет. |
| 55 | Минимальная цена продажи | NOT IMPLEMENTED | `supplier-pricing.service.ts` — markup + FX, но нет floor price / min margin / loss-leader check. grep `minPrice/minSale/belowCost/floorPrice` в pricing → 0. |
| 57 | Mapping отелей | PARTIAL | Реестр `Hotel`/`HotelSupplierRef` (hotel-registry.ts), grouping по (name, country, city), sibling-reuse фото. Канонический ID = `Hotel.id`. Защита от слияния одноимённых — через country+city. |
| 58 | Статический контент | PARTIAL | Фото: `Hotel.photoFile` (TripAdvisor CDN). Описания/удобства/адреса/координаты — не централизованы; у Voyager `latitude/longitude/star` в `SamoHotelEntry`, у других поставщиков — нет единого контент-слоя. |
| 59 | Mapping как отдельная услуга | NOT IMPLEMENTED | Mapping — внутренняя функция (`hotel-registry.ts`), не отдельная услуга/API. |
| 60 | Обновление каталога | PARTIAL | Ручные скрипты (`run-voyager-sync.ts`, `run-geo-ingest.ts`, `hotel-photo-catalog.ts`). Cron/scheduler для supplier sync не найден. |
| 61 | Mapping и доступность | PARTIAL | Mapping (`Hotel`/`HotelSupplierRef`) и availability (`SupplierOffer.availability` в поиске) разделены на уровне кода: каталог фото резолвит через реестр, поиск отдаёт availability отдельно. Инвариант соблюдён, но не зафиксирован тестами/документом. |
| 62 | Географические справочники | PARTIAL | `geo.SupplierGeoLink` (TOWN/STAR/HOTEL/TOUR) + `GeoCountry/City/Resort` + ingest. На commit `fbe719b` SUMMERTOUR и KAZUNION имели 0 записей (ingest не запускался). |
| 63 | Mapping типов комнат | NOT IMPLEMENTED | `room` — строка из supplier response, без канонического mapping. |
| 64 | Внешние сервисы mapping | NOT IMPLEMENTED | Нет интеграций со сторонними mapping-сервисами. |
| 65 | Требования к контенту | NOT IMPLEMENTED | Валидаторов обязательных полей отеля не найдено. |
| 66 | Справочник типов питания | PARTIAL | Meal keys (AI/BB/HB/FB/RO) в адаптерах, без канонической таблицы. |
| 67 | Нормализация питания | PARTIAL | `resolveMealKey` в адаптерах; неизвестное значение → «no meal filter» (не ломает тариф). |
| 69 | Поддерживаемые способы поиска | PARTIAL | По направлению/стране/городу (geo), по датам/гостям, по hotelId/name. Конкретный отель по списку внешних ID — через `hotelsCsv`/`hotelExternalId` (только для Voyager). |
| 70 | Преобразование поиска в hotel IDs | PARTIAL | `hotelRefKey` → `HotelSupplierRef` → `Hotel`. Источник IDs — attributes продукта. |
| 71 | Размер пакета hotel IDs | NOT IMPLEMENTED | Нет chunking списков hotel IDs в aggregator (только даты). |
| 72 | Кеширование тарифов | PARTIAL | In-memory cache в адаптерах (TTL 5 мин), `SupplierCacheService`. Frontend: `probePhotoUrl` cache. Redis — не найден. |
| 73 | Срок кеширования тарифов | PARTIAL | TTL 5 мин (адаптеры), 420s (captcha store). Общие, не per-supplier. |
| 74 | Налоги и сборы | NOT IMPLEMENTED | Нет явного учёта налогов/сборов; цена = supplier price + markup + FX. Двойного начисления нет, но и нет явной модели. |
| 75 | Гражданство и страна проживания | PARTIAL | `Passenger.citizenship` существует. `countryOfResidence` отдельно не найден. Валидация traveler — в `request-travelers.ts`. |
| 76 | Recheck / Prebook | NOT IMPLEMENTED | `refreshPrice`/`refresh-availability` endpoints есть, но это повторный поиск, не Prebook. |
| 77 | Допустимое изменение цены | NOT IMPLEMENTED | Нет порогов/согласия клиента при изменении цены. |
| 78 | Несколько комнат | NOT IMPLEMENTED | `room` — строка, один тип комнаты на поиск. Multi-room не поддерживается. |
| 79 | Комнаты разных типов | NOT IMPLEMENTED | Не поддерживается. |
| 80 | Исходный HCN | NOT IMPLEMENTED | `SupplierConfirmation.confirmationNumber` есть в схеме, но не используется в src (grep → 0). HCN как поле ETG не реализован. |

## 4. Сквозные цепочки (фактические)

- **A (успешное бронирование):** не применимо — нет supplier booking API. Внутренний flow: Request → Order → Booking (ручные переходы).
- **B (цена изменилась):** не реализовано.
- **C (тайм-аут при создании брони):** не применимо.
- **D (повторный запрос):** HTTP idempotency — `IdempotencyModule` существует. Event inbox — `OutboxWorkerService` (outbox pattern). Бизнес-идемпотентность бронирования — через `Booking_orderItemId_key` partial unique. **Однако это не доказывает ETG-уровневую идемпотентность: при отсутствии ETG-адаптера повторный HTTP-запрос к поставщику не отправляется, поэтому дубль брони у поставщика не возникает и не проверяется. При реализации ETG-интеграции идемпотентность должна проектироваться и проверяться отдельно (idempotency-key, внешний ID, статус).**
- **E (отмена):** внутренний `cancel` → CANCELLED, без вызова поставщика.
- **F (несколько комнат):** не реализовано.

## 5. Тесты

- Unit/integration для supplier: `supplier-aggregator.service.spec.ts`, `supplier-pricing.service.spec.ts`, adapter specs (voyager, kazunion, etc.).
- E2E для booking/order — не проверялись в рамках этого аудита (read-only).
- Наличие тестового файла не означает, что тест пройден — тесты не запускались (read-only режим).

## 6. Дополнительные риски

- **Секреты:** `SupplierFxRate`, partner tokens — хранятся в БД. Логи: `pii.spec.ts` проверяет редактирование PII. Паспортные данные в `Passenger` (birthDate, passportSeries, passportNumber, passportExpiry) — хранятся в БД.
- **Тайм-ауты/retry/circuit breaker:** `resilience/` модуль (circuit breaker), `cache/` (supplier cache), pacedGet в http-сервисах.
- **Гонки состояний:** `Booking_orderItemId_key` partial unique предотвращает дубль брони на один item.
- **Транзакционные границы:** `$transaction` в sync-сервисах; booking transitions через CAS (version).
- **Согласованность статусов:** внутренний Booking ↔ поставщик — не применимо (нет supplier booking).

## 7. Что требует проверки по документации ETG / подтверждения поставщика

- Endpoint'ы поиска/бронирования/отмены/статуса.
- Формат HCN и его реальное имя поля.
- Prebook/recheck контракт и TTL предложения.
- Допустимое изменение цены (пороги).
- Лимиты batch size hotel IDs.
- Налоги/сборы в ответе.
- Поля гостя (гражданство vs страна проживания).
- Multi-room поддержка.
- Idempotency-заголовки.

## 8. Объективные условия PASS для ETG-интеграции

1. Адаптер `EtgAdapter implements SupplierAdapter` + регистрация в `supplier.module.ts`.
2. Контракты DTO для поиска/предложения/prebook/book/cancel/status.
3. Mapping отелей: `HotelSupplierRef` с supplierCode=ETG.
4. Ценовая модель: FX + markup + налоги/сборы + snapshot.
5. Бронирование: HTTP-вызов + сохранение внешнего ID + статус.
6. Idempotency: повторный запрос не создаёт дубль.
7. Тайм-аут/retry/circuit breaker.
8. Тесты: unit + integration + негативные.

## 9. Read-only подтверждение

Код, миграции, конфигурация не изменялись. Созданы только отчётные файлы в `docs/audits/`. Тесты с побочными эффектами не запускались. Секреты в отчёт не выводились.
