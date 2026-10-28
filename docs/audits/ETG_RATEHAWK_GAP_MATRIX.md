# ETG / RateHawk — Gap Matrix

| ID | Требование | Статус | Фактическая реализация | Доказательство | Недостающие компоненты | Влияние на бизнес | Приоритет | Зависимость от документации ETG | Рекомендуемый следующий шаг |
|---:|---|---|---|---|---|---|---|---|---|
| 53 | Полный цикл бронирования | NOT IMPLEMENTED | Нет ETG-адаптера; supplier adapters search-only; booking — внутренний workflow | `backend/src/modules/supplier/` (нет etg/); `booking.service.ts` | EtgAdapter, DTO, book/cancel/status endpoints, внешние ID | Блокирует продажу отелей ETG | P0 | Да — контракт ETG | Реализовать адаптер и контракты |
| 54 | Архитектура взаимодействия | NOT IMPLEMENTED | Frontend → Backend aggregator → supplier adapters (search) → БД; нет supplier booking | `supplier-aggregator.service.ts`, `public-supplier.controller.ts` | Supplier booking layer, async events, компенсации | Блокирует | P0 | Да | Спроектировать sequence diagram |
| 55 | Минимальная цена продажи | NOT IMPLEMENTED | Markup + FX, без floor/min margin | `supplier-pricing.service.ts` (grep minPrice → 0) | Min price rule, validation | Риск продажи в убыток | P1 | Частично | Добавить floor price check |
| 57 | Mapping отелей | PARTIAL | Реестр `Hotel`/`HotelSupplierRef` (hotel-registry.ts), grouping по (name, country, city), sibling-reuse фото. Канонический ID = `Hotel.id`. Защита от слияния одноимённых — через country+city. | `hotel-registry.ts`, `public-catalog.service.ts::hotelPhotoMap` | Cross-supplier merge confidence, ручное подтверждение | Среднее | P2 | Нет | Улучшить confidence-скоринг |
| 58 | Статический контент | PARTIAL | Фото: `Hotel.photoFile` (TripAdvisor CDN). Описания/удобства/адреса/координаты — не централизованы; у Voyager `latitude/longitude/star` в `SamoHotelEntry`, у остальных поставщиков — нет единого контент-слоя. | `samo-hotel-dict.ts`, `hotel-photo-catalog.ts`, `Hotel` model | Единый контент-слой, приоритет источников | Среднее | P2 | Частично | Унифицировать контент-модель |
| 59 | Mapping как отдельная услуга | NOT IMPLEMENTED | Внутренняя функция `hotel-registry.ts`, не отдельная услуга/API | `backend/scripts/hotel-registry.ts` | Отдельный сервис/API mapping | Низкое | P3 | Нет | Не требуется для ETG MVP |
| 60 | Обновление каталога | PARTIAL | Ручные скрипты (`run-voyager-sync.ts`, `run-geo-ingest.ts`, `hotel-photo-catalog.ts`). Cron/scheduler для supplier sync не найден | `backend/src/scripts/` | Scheduler, инкрементальная sync, мониторинг | Среднее | P2 | Нет | Добавить cron/scheduler |
| 61 | Mapping и доступность | PARTIAL | Mapping (`Hotel`/`HotelSupplierRef`) и availability (`SupplierOffer.availability` в поиске) разделены на уровне кода: каталог фото резолвит через реестр, поиск отдаёт availability отдельно. Инвариант соблюдён, но не зафиксирован тестами/документом. | `public-catalog.service.ts::hotelPhotoMap`, `supplier-aggregator.service.ts` | Явный инвариант + тесты | Среднее | P2 | Частично | Документировать границы и добавить тест |
| 62 | Географические справочники | PARTIAL | `geo.SupplierGeoLink` (TOWN/STAR/HOTEL/TOUR) + `GeoCountry/City/Resort` + ingest. На commit `fbe719b` SUMMERTOUR и KAZUNION имели 0 записей (ingest не запускался). Во время аудита ingest выполнен (DB-операция, не часть commit). | `supplier-geo-ingest.service.ts`, `run-geo-ingest.ts`, q20/q27/q28 | Покрытие всех поставщиков | Среднее | P2 | Нет | Запустить ingest для новых поставщиков |
| 63 | Mapping типов комнат | NOT IMPLEMENTED | `room` — строка из supplier response, без канонического mapping | `supplier.types.ts` (room?: string) | Каноническая таблица room types | Среднее | P2 | Да | Разработать mapping |
| 64 | Внешние сервисы mapping | NOT IMPLEMENTED | Нет интеграций со сторонними mapping-сервисами | — | — | Низкое | P3 | Нет | Не требуется |
| 65 | Требования к контенту | NOT IMPLEMENTED | Валидаторов обязательных полей отеля не найдено | — | Валидаторы | Низкое | P3 | Частично | Добавить валидаторы |
| 66 | Справочник типов питания | PARTIAL | Meal keys (AI/BB/HB/FB/RO) в адаптерах, без канонической таблицы | `voyager-countries.ts` MEALS_KEY | Каноническая таблица meals | Низкое | P3 | Частично | Разработать справочник |
| 67 | Нормализация питания | PARTIAL | `resolveMealKey` в адаптерах; неизвестное значение → «no meal filter» (не ломает тариф). | adapter specs | Единый normalizer | Низкое | P3 | Частично | Унифицировать |
| 69 | Поддерживаемые способы поиска | PARTIAL | По направлению/стране/городу (geo), по датам/гостям, по hotelId/name. Конкретный отель по списку внешних ID — через `hotelsCsv`/`hotelExternalId` (только для Voyager). | `public-supplier.controller.ts` search-all/search-suppliers | Расширить | Среднее | P2 | Частично | Расширить |
| 70 | Преобразование поиска в hotel IDs | PARTIAL | `hotelRefKey` → `HotelSupplierRef` → `Hotel`. Источник IDs — attributes продукта. | `public-catalog.service.ts::hotelRefKey` | Дедупликация, размер списков | Среднее | P2 | Частично | Улучшить |
| 71 | Размер пакета hotel IDs | NOT IMPLEMENTED | Нет chunking списков hotel IDs в aggregator (только даты). | `supplier-aggregator.service.ts` | Batch/chunking | Среднее | P2 | Да | Добавить chunking |
| 72 | Кеширование тарифов | PARTIAL | In-memory cache адаптеров (TTL 5 мин), `SupplierCacheService`. Frontend: `probePhotoUrl` cache. Redis не найден | `voyager-http.service.ts` (searchCacheTtlMs), `cache/` | Redis/HTTP-кеш, инвалидация | Среднее | P2 | Частично | Добавить Redis |
| 73 | Срок кеширования тарифов | PARTIAL | TTL 5 мин (адаптеры), 420s (captcha store). Общие, не per-supplier | `voyager-http.service.ts` | Per-supplier TTL | Низкое | P3 | Частично | Настроить per-supplier |
| 74 | Налоги и сборы | NOT IMPLEMENTED | Нет явного учёта налогов/сборов; цена = supplier price + markup + FX | `supplier-pricing.service.ts` | Модель налогов/сборов | Высокое | P1 | Да | Разработать модель |
| 75 | Гражданство и страна проживания | PARTIAL | `Passenger.citizenship` существует. `countryOfResidence` отдельно не найден. Валидация traveler — в `request-travelers.ts`. | `schema.prisma` Passenger model | Поле countryOfResidence, валидация | Среднее | P2 | Да | Добавить поле |
| 76 | Recheck / Prebook | NOT IMPLEMENTED | `refreshPrice`/`refresh-availability` endpoints есть, но это повторный поиск, не Prebook. | `supplier.controller.ts` refresh-price/refresh-availability | Prebook endpoint, TTL предложения | Блокирует бронирование | P0 | Да | Реализовать Prebook |
| 77 | Допустимое изменение цены | NOT IMPLEMENTED | Нет порогов/согласия клиента при изменении цены. | — | Правила, UI согласия | Высокое | P1 | Да | Разработать правила |
| 78 | Несколько комнат | NOT IMPLEMENTED | `room` — строка, один тип комнаты на поиск. Multi-room не поддерживается. | `supplier.types.ts` (room?: string) | Multi-room DTO/UI/backend | Высокое | P1 | Частично | Разработать multi-room |
| 79 | Комнаты разных типов | NOT IMPLEMENTED | Не поддерживается. | — | Per-room конфигурация | Высокое | P1 | Частично | Разработать |
| 80 | Исходный HCN | NOT IMPLEMENTED | `SupplierConfirmation.confirmationNumber` есть в схеме, но не используется в src (grep → 0). HCN как поле ETG не реализован. | `schema.prisma` SupplierConfirmation, grep confirmationNumber → 0 | Использование HCN при статусе/отмене/поддержке | Блокирует | P0 | Да — имя поля ETG | Подтвердить имя поля ETG |

## Топ-5 критичных пробелов

1. **Нет ETG-адаптера и booking API** (53, 54) — бронирование невозможно.
2. **Нет Prebook/Recheck** (76) — нельзя проверить цену/наличие перед бронью.
3. **Нет HCN** (80) — нет внешнего идентификатора подтверждённого бронирования.
4. **Нет multi-room** (78, 79) — один тип комнаты на заказ.
5. **Нет модели налогов/сборов** (74) — цена без явного учёта налогов ETG.

## Зависимость от документации ETG

Все пункты, помеченные «Да» в колонке «Зависимость от документации ETG», требуют проверки по актуальной документации ETG/RateHawk: endpoints, контракты, HCN-поле, Prebook TTL, batch limits, налоги, поля гостя, multi-room, idempotency-заголовки.

## Примечание об идемпотентности (п. 53, 54, 76)

В коде существуют `IdempotencyModule` (HTTP-уровень) и partial unique `Booking_orderItemId_key` (БД-уровень), а также outbox-паттерн (`OutboxWorkerService`). Это обеспечивает идемпотентность **внутренних** операций TravelHUB. При реализации ETG-интеграции идемпотентность **на уровне поставщика** (повторный HTTP-запрос не создаёт вторую бронь) должна проектироваться и проверяться отдельно — существующие механизмы её не гарантируют.
