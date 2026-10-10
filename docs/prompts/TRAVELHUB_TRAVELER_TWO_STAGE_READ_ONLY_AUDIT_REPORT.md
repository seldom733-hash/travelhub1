# READ-ONLY AUDIT — §8 «Two-stage traveler data model + FIX B»

**Документ-источник:** `TRAVELHUB_TRAVELER_TWO_STAGE_DATA_MODEL_AND_FIX_B.md` (§8 «First: read-only audit»)
**Объём:** только чтение кода/схемы/данных. Изменений нет: ни кода, ни БД (только `SELECT`), ни миграций, ни UI.
**Дата:** 2026-10-07 · **Git:** commit NO / push NO

---

## 1. Существующая модель Traveler (Prisma)

| Модель | Файл | Поля |
|---|---|---|
| **`OrderTraveler`** | `backend/prisma/schema.prisma:2294-2315` | `id, orderId, customerId, position, firstName, lastName, birthDate?, citizenship?, gender?, passportNumber?, passportExpiry?, dataCompleteness, version` |
| **`Passenger`** (booking) | `schema.prisma:2641-2655` | `bookingId, firstName, lastName, birthDate?, citizenship?, gender?, passportNumber?, passportExpiry?` |
| `QuoteTraveler` | `schema.prisma:3769-3780` | только `firstName, lastName, birthDate?` (без passport-данных) |
| `CheckoutIntentTraveler` | `schema.prisma:4049-4060` | только `firstName, lastName, birthDate?` («без passport/document/payment», privacy §42) |

**`RequestTraveler` / `Traveler` — НЕ СУЩЕСТВУЕТ.** У `Request` **нет relation `travelers`** (единственный relation — `history`, `schema.prisma:2451`).

Order-level D3-поля: `termsAcceptedAt` `:2243`, `travelerDataCompletedAt` `:2247`, `finalConfirmedAt` `:2251`, `pinnedRequirements` `:2257`, `travelerCount` `:2260`, `travelers` `:2263`.
Request-level: `quantity` `:2394`, `travelerCount` `:2419`, `pinnedRequirements` `:2430`, `productSnapshot` `:2435`.
`Order.productSnapshot` — **НЕТ** (только у `Request`).

`TravelerDataCompleteness` = `INCOMPLETE | COMPLETE` (`schema.prisma:2111-2116`).
Схема **не содержит `@map`/`@@map`** — имена колонок = имена полей.

---

## 2. Request traveler API — страницы данных отсутствует

- `backend/src/modules/order/request.controller.ts` (`:26,54,63,162,172,178,197,207,217,227,243,257,266,279`) — маршрута `travelers` **нет**.
- DTO `requestDto` (`request.service.ts:1269-1350`) **не содержит** ни `travelers`, ни `pinnedRequirements`; наружу идут только `travelerCount` (`:1324`) и `productSnapshot` (`:1325`).
- Request-стадия хранит **только агрегат состава**: `travelerCount` = `adults + children` (`supplier/tour-request.service.ts:261`), из `body.passengers` (`supplier/azal/azal.controller.ts:176`), из guest-checkout (`checkout/guest-checkout.service.ts:113`), либо из DTO вручную (`request.service.ts:227-230, :271`).
- **`firstName/lastName/birthDate` на Request-стадии не сохраняются нигде.** Имена в публичном тур-флоу (`tour-request.service.ts:63-64, 99-110`) пишутся в `crm.Customer` (контакт), не в Request.

**Вывод: UX §9 («Traveler 1/2 → Имя/Фамилия/Дата рождения» на Request) не на чем строить — нет ни сущности, ни endpoint, ни UI.**

---

## 3. Order traveler API

| Endpoint | Код | Ответ |
|---|---|---|
| `GET /orders/:id/travelers` | `order.controller.ts:310` → `order.service.ts:1722-1787` | `pinnedRequirements, termsAcceptedAt, travelerDataCompletedAt, finalConfirmedAt, travelerCount, travelers[9 полей]` |
| `GET /orders/:id` | `order.service.ts:1105-1190` | вся строка Order + `travelers[]` (raw) |
| `PATCH /orders/:id/travelers` (bulk) | `order.service.ts:1312-1408` | `OrderTraveler[]` |
| `PATCH /orders/:id/travelers/:tid` (D3) | `order.service.ts:1804-1942` | один `OrderTraveler` |
| `POST /orders/:id/validate-completion` | `order.service.ts:1954-2028` | `{complete, reason, travelerDataCompletedAt}` |
| `POST /orders/:id/final-confirm` | `order.service.ts:2040-2121` | `{orderId, finalConfirmedAt}` |

PII-редакция: `redactTravelersPii` (`shared/pii.ts:18` — `passportNumber, passportExpiry, birthDate`; видны только OPERATOR/ADMIN).

---

## 4. Request → Order copy (`createOrderFromRequest`, `order.service.ts:608-809`)

| Source (Request) | Target (Order) | Строка |
|---|---|---|
| `customerAcceptedAt` | `termsAcceptedAt` | `:702` |
| `pinnedRequirements` (или `{}`) | `pinnedRequirements` | `:705` |
| `travelerCount` | `travelerCount` | `:707` |
| `commercialSnapshot` | `commercialSnapshot` verbatim | `:711-713` |
| `productSnapshot.{productId,productCode,productTitle,productType}` | `OrderItem.*` | `:737-750` |
| `confirmedPrice ?? displayedPrice` | `amount/subtotal` | `:664-665, 682, 715` |

**Traveler-строки НЕ копируются — их нет.** Создаются пустые заглушки (`order.service.ts:752-768`):

```
// D3 OrderTraveler placeholders: ... Request party names не собираются pre-Order; count frozen
firstName: "", lastName: "", birthDate: null, dataCompleteness: "INCOMPLETE"
```

Контраст: sales-путь `OrderRequested` **копирует** реальные FIO/birthDate из `CheckoutIntentTraveler` (`order-requested.consumer.ts:77-81` → `order.service.ts:528-541`) — **готовый образец того, как надо делать Request→Order**.

`productSnapshot.offer` в Order **не переносится** (`:740-743` — только 4 identity-ключа).

Гейт конвертации: CAS `CUSTOMER_ACCEPTED → CONVERTED` (`request.service.ts:1030-1042`), требует `hasD3AcceptSnapshot` (`:1012-1016`).

---

## 5. Completeness

**Per-traveler** — `computeTravelerCompleteness` (`order.service.ts:1296-1310`):
- `pinned == null` → `COMPLETE` ⇔ непустой `passportNumber` (`:1300-1302`);
- иначе → `COMPLETE` ⇔ **все поля со статусом `REQUIRED` непустые** (`:1304-1309`); `OPTIONAL`/`NOT_REQUESTED` не учитываются.

**Order-level** — `validateTravelerCompletion` (`:1954-2028`): `termsAcceptedAt` → `pinnedRequirements` существует → `travelers.length >= travelerCount` → все `REQUIRED` непустые → все `dataCompleteness == COMPLETE` → ставит `travelerDataCompletedAt` (однократно, иммутабельно).

**Request-level completeness — НЕ СУЩЕСТВУЕТ.** Эквивалент — D3-гейт `hasD3AcceptSnapshot` (`request.service.ts:67-71`): `customerAcceptedAt && pinnedRequirements && travelerCount && productSnapshot`.

**Проверка срока действия паспорта — НЕ СУЩЕСТВУЕТ** (см. §8).

---

## 6. TravelerCollectionPanel

`frontend/components/order/TravelerCollectionPanel.tsx`:
- `FIELD_ORDER` = 7 полей: `firstName, lastName, birthDate, citizenship, gender, passportNumber, passportExpiry` — `:41`;
- `fieldsFor` = `pinned ? FIELD_ORDER.filter(f => (pinned[f] ?? "NOT_REQUESTED") !== "NOT_REQUESTED") : []` — `:105-108`. Никакой валидации структуры: любая строка ≠ `NOT_REQUESTED` рендерится; `REQUIRED` даёт `*` (`:232`);
- `locked = Boolean(view?.finalConfirmedAt)` — `:103`; `canEdit = useCan("order.edit_noncritical")` — `:58`; `availableActions` в панели **не читается**;
- Save → `PATCH /orders/{id}/travelers/{travelerId}` — `:136`, payload = **все** `fieldsFor`, trim, пустые даты пропускаются (`:130-135`);
- рендер: по одному `label+input` на поле из `fieldsFor` (`:229-259`), `type="date"` для `birthDate/passportExpiry` (`DATE_FIELDS :44`);
- legacy-плашка при `pinned == null` — `:172-176`;
- тест: `frontend/components/order/TravelerCollectionPanel.spec.tsx` (8 тестов).

**Request-стадии UI нет:** `app/app/requests/*` содержит только `travelerCount`/`travelerProgress` (`[id]/page.tsx:61, 89-91, 410-413`); `components/request/` — только `RequestActionBar.tsx`; `ManualCreateForm` рендерит traveler-поля лишь когда `needsTravelers = mode !== "request"` (`components/commerce/ManualCreateForm.tsx:49`).

**i18n:** `d3.field.*` `lib/i18n.tsx:1699-1705` — Имя / Фамилия / Дата рождения / Гражданство / Пол / Номер паспорта / Срок действия паспорта. **«Серия» — нет.**
История: `order.action.update_traveler_d3` `:2498`, `update_travelers` `:2499`, `final_confirm` `:2497`, `update_order_fields` `:2502`. `request.action.*` (`:2509-2517`) — только lifecycle/цена, действий по данным туриста нет.

---

## 7. TravelerRequirements / TravelerFullRequirements

`backend/src/modules/catalog/traveler-requirements.ts`:
- `TRAVELER_REQUIREMENT_STATES = ["NOT_REQUESTED","OPTIONAL","REQUIRED"]` — `:15` (**единственные 3 состояния**);
- `TRAVELER_FIELDS` — `:27-35`: `firstName, lastName, birthDate, citizenship, gender, passportNumber, passportExpiry` — **ровно 7, `passportSeries` отсутствует**;
- `TravelerRequirementsMap` `:45`, **`TravelerFullRequirements`** `:48`;
- `validateTravelerRequirements` `:65-83`, `getDefaultTravelerRequirements(productType)` `:194-201`, `getEffectiveTravelerRequirements` `:214-235` (override Product поверх дефолтов ProductType);
- **`DEFAULTS_TOUR` `:88-96`: `birthDate: "OPTIONAL"`**, `citizenship/gender/passportNumber/passportExpiry: "NOT_REQUESTED"`;
- `DEFAULTS_FLIGHT` `:98-106`: `birthDate/citizenship/passportNumber/passportExpiry` = `REQUIRED`;
- `DEFAULTS_SANATORIUM` `:148-156`: документы `OPTIONAL`;
- детектор формы пина: `OFFER_SNAPSHOT_KEYS` `:240-255`, `getPinnedRequirementsShape` → `traveler_requirements|offer_snapshot|unknown` `:271-280`; используется в `order.service.ts:1770-1776` (только warn);
- дубликаты каталога: `frontend/components/partner/TravelerRequirementsEditor.tsx:19-70`, `frontend/components/order/TravelerCollectionPanel.tsx:41`;
- тест: `backend/src/modules/catalog/traveler-requirements.spec.ts` (44 теста).

---

## 8. Паспорт/документы — что есть и чего нет

**Есть:** поля `citizenship/passportNumber/passportExpiry` в `OrderTraveler` и `Passenger`; PII-маскировка (`shared/pii.ts:18`, `shared/audit.ts:74`); формат-проверка `YYYY-MM-DD` (`order.service.ts:1860-1864`); наличие при `REQUIRED`.

**НЕТ (проверено прямым grep):**
- `passportSeries` / `series` / `Серия` — **0 совпадений** в `schema.prisma`, `backend/src`, `frontend` (встречается только в промпте, 4 раза: `:13, 46, 131, 312`);
- **сравнение `passportExpiry < tripEndDate`** — 0 совпадений;
- `documentRequirement` / destination-специфичные правила документов — 0 совпадений;
- статусы `WARNING`/`BLOCK`/`MANUAL_REVIEW` для документов — 0 совпадений;
- предупреждение об истечении в UI — 0 совпадений.

Требование §4 (валидация срока действия + архитектура destination/service/supplier-правил) **не реализовано вообще**.

---

## 9. D3 final-confirmation gate (`finalConfirm`, `order.service.ts:2040-2121`)

Проверки по порядку:
1. Order существует `:2041-2045`;
2. не `PARTNER_STOREFRONT` `:2049-2051`;
3. **`termsAcceptedAt`** `:2053-2056`;
4. **`pinnedRequirements`** `:2059-2061`;
5. **`travelers.length >= travelerCount`** `:2064-2068`;
6. **`travelerDataCompletedAt`** (иначе прогон `validateTravelerCompletion`) `:2070-2076`;
7. ещё не подтверждён `:2079-2081`;
8. row-lock `SELECT ... FOR UPDATE` + re-check `:2088-2092`;
9. CAS `WHERE finalConfirmedAt IS NULL` `:2096-2102`;
10. аудит `OrderHistory action:"final_confirm"` `:2104-2115`.

**Паспортной/срочной валидации нет.** Связанные гейты: `confirm`/`send` заблокированы до `finalConfirmedAt` (`:1489-1495`), `confirm` заблокирован при любом не-`COMPLETE` (`:1498-1505`), зеркало проекции действий (`:184-193`).
D3 **не ослаблялся и ослаблять не нужно** — новые проверки добавляются поверх.

---

## 10. Booking payload / consumer

- Событие **без PII**: `BookingRequestedPayload = {orderId, orderCode, customerId}` (`backend/src/eventbus/domain-events.ts:326-330`, комментарий про минимизацию `:319-325`); эмитится в `order.service.ts:1657-1673`.
- `backend/src/modules/booking/booking.subscribers.ts`: читает `order.travelers` по `position` (`:80-86`), **берёт только `dataCompleteness === "COMPLETE"`** (`:120`), пишет `Passenger` со всеми 7 полями включая `passportExpiry` (`:225-238`).
- Дальше — только voucher: `documents/voucher.consumer.ts:139, 170-177`, шаблон `documents/templates/voucher.template.tsx:17-24`.
- `passengers` — запрещённый клиентский ключ (`booking.validation.ts:77`).

---

## 11. Supplier submission path

`SupplierAdapter` (`supplier/supplier.types.ts:242-271`) = `search | getOffer | refreshPrice | refreshAvailability | getPriceCalendar | discoverGeoOptions` — **метода отправки брони/пассажиров НЕТ** (grep `submitBooking|bookRequest|sendPassenger|passengerName` — 0).

Наружу сериализуются **только числа состава**: `adults/children/childAges/infants` —
`anex.adapter.ts:270-272`, `anex-hotel.adapter.ts:279-295`, `summertour-http.service.ts:102-125`, `summertour.request-builder.ts:109-110`, `kazunion-http.service.ts:584-619`, `kompas.adapter.ts:386-393`, `azal.adapter.ts:107-163`, `aviasales.http.service.ts:249-252`.

**Имена/даты рождения/паспорта наружу не уходят ни в одном адаптере.**

**Возрастная классификация:** `birthDate → adult/child` **не реализована нигде** (grep `ageCategory|ageAtServiceDate|deriveAge|getAge|ageFromBirth` — 0). Существующие правила работают с **уже готовыми числами возрастов**:
- `catalog/tour-builder/tour-builder.service.ts:917` инфанты `< 2`, `:918` дети `2–11`, `:954` дети `< 12` (страховка) — сегменты принимают `children: {age:number}[]` (`:767, 780`);
- `childRules?` объявлен (`tour-builder.service.ts:117`, `frontend/lib/tour-builder-api.ts:14`) — **нигде не используется**;
- `supplier/supplier-aggregator.service.ts:170, 188` — только лимиты паксов поставщика, не возрастные полосы.

**Состав в цене:** только как контекст поиска/перепроверки (`tour-request.service.ts:115-139`), ключ кэша цены (`supplier/supplier-offer.service.ts:204-210`). В `commercialSnapshot` **traveler-полей нет вообще** (`pricing/commercial-snapshot.ts:38-67`), `travelerCount` в математике цены не участвует, `OrderItem.quantity = 1` (`order.service.ts:744`).

---

## 12. `productSnapshot`

Пишется в 4 местах:
- ручной Request — `request.service.ts:244-258, 272` (только 4 identity-ключа, `null` без продукта);
- публичный тур — `tour-request.service.ts:231-275`: `{productId?, productCode?, productTitle, productType:"TOUR", type:"TOUR", offer:{...}}` — всегда, даже без продукта;
- flight — `azal.controller.ts:177` (`{type:"FLIGHT", from, to, fareFamily}`); **и** `:181` пишет offer-shaped `pinnedRequirements` — источник битого пина;
- `customerAccept` — `request.service.ts:858-873` (merge + 4 ключа, `offer` сохраняется).

Форма `offer` (`tour-request.service.ts:233-247`): `supplierCode, externalOfferId, hotel, hotelExternalId, departureDate, nights, adults, children, childAges, room, meal, destination, departureCity, country` — совпадает с `OFFER_SNAPSHOT_KEYS`.

---

## 13. Критические расхождения с моделью §1–§5

| # | Требование документа | Фактическое состояние | Влияние |
|---|---|---|---|
| **G1** | Request собирает `firstName/lastName/birthDate` | **Нет сущности, endpoint, UI** — только `travelerCount` | Нужна новая доменная модель Request-traveler (кандидат на переиспользование: `CheckoutIntentTraveler` / `QuoteTraveler`) |
| **G2** | Request: `birthDate` **REQUIRED** | `DEFAULTS_TOUR.birthDate = "OPTIONAL"` (`traveler-requirements.ts:91`) | Правка дефолта ProductType + репин; дефолт влияет только на новые Request |
| **G3** | Order: **7 полей REQUIRED**, включая `passportSeries` | `TRAVELER_FIELDS` = 7 полей, но **с `gender`, без `passportSeries`** (`:27-35`) | Расхождение состава: у владельца 7 = FIO+birthDate+series+number+citizenship+expiry; в коде 7 = FIO+birthDate+citizenship+**gender**+number+expiry. Нужно решение по `gender` |
| **G4** | Order pin = все 7 REQUIRED | Live Order-pin: `birthDate=OPTIONAL`, `citizenship/passportNumber/passportExpiry=NOT_REQUESTED`, `passportSeries` отсутствует | **Все 4 одобренные записи сейчас в устаревшей форме** (см. §14) |
| **G5** | `birthDate` участвует в классификации взрослый/ребёнок | Классификации из `birthDate` нет; состав приходит числами из поиска | Нужен мост `traveler rows → adults/children/childAges` |
| **G6** | `birthDate` участвует в коммерческом расчёте | `commercialSnapshot` не содержит traveler-полей; `travelerCount` в цене не участвует | Требует отдельного решения (сейчас цена приходит от поставщика целиком) |
| **G7** | `passportExpiry < tripEndDate` → WARNING/BLOCK | **0 реализаций** (проверено) | Нужен новый слой валидации (3 точки входа: изменение, final-confirm, Booking) |
| **G8** | Валидация «перед отправкой поставщику» | Метода отправки брони поставщику нет | Точка входа не существует — валидация возможна только на Order/Booking |
| **G9** | Order наследует Request-данные «не должны исчезнуть» | Заглушки `""` вместо копии (`order.service.ts:755-768`) | Нарушение §3 — **ожидаемо**, пока G1 не закрыт |
| **G10** | Order completion ≠ Request completion | Request-completeness отсутствует; Order требует только `REQUIRED` из пина | После G4 требование §10 выполнится автоматически |

---

## 14. Влияние на уже выполненный FIX B

Текущее состояние 4 одобренных записей (read-only SELECT, 2026-10-07):

```
MKT-REQ-00000301 | CUSTOMER_ACCEPTED | quantity=1 travelerCount=2 | offer=YES (13 ключей)
MKT-REQ-00000401 | CUSTOMER_ACCEPTED | quantity=1 travelerCount=2 | offer=YES (13 ключей)
MKT-REQ-00000402 | CONVERTED         | quantity=1 travelerCount=2 | offer=YES (13 ключей)
Order TH-2026-000101 | IN_PROCESSING | travelerCount=2 | travelerDataCompletedAt=null | finalConfirmedAt=null
OrderTraveler ×2 | position 1,2 | firstName="" lastName="" birthDate=null citizenship=null
                                 gender=null passportNumber=null passportExpiry=null | INCOMPLETE

pin (все 4 записи идентичны):
{"firstName":"REQUIRED","lastName":"REQUIRED","birthDate":"OPTIONAL",
 "citizenship":"NOT_REQUESTED","gender":"NOT_REQUESTED",
 "passportNumber":"NOT_REQUESTED","passportExpiry":"NOT_REQUESTED"}
```

- **Request-pin не соответствует §5**: `birthDate` должен быть **REQUIRED**, стоит `OPTIONAL`.
- **Order-pin не соответствует §5**: нет `passportSeries`, документы `NOT_REQUESTED` вместо `REQUIRED`.
- §«Owner decision» прямо запрещает «предыдущую модель FIX B, где passport-поля были `NOT_REQUESTED`» — **это ровно то, что сейчас в БД**.
- Offer-факты и `commercialSnapshot` **целы** — повторный ремонт не потеряет данные.
- Расхождение — **только в `pinnedRequirements`**; `OrderTraveler` пусты, ПII-конфликта нет.
- `SERIES_COL = 0` — колонки `*series*` нет ни в одной таблице.

---

## 15. Что можно переиспользовать (без дублирования)

| Потребность | Готовый артефакт |
|---|---|
| Типы требований | `TravelerFullRequirements`, `TRAVELER_FIELDS`, `validateTravelerRequirements`, `getEffectiveTravelerRequirements` |
| Store правил по ProductType | `PRODUCT_TYPE_DEFAULTS` + override Product (`traveler-requirements.ts:214-235`) |
| Инфраструктура пина | freeze в `customerAccept` (`request.service.ts:802-814`), копия в Order (`order.service.ts:705`), детектор формы (`:1770-1776`) |
| Order-traveler форма/валидация | `updateTravelerD3` `order.service.ts:1804-1942` + `TravelerCollectionPanel` (уже рендерит любое поле из пина) |
| Completeness/D3-гейты | `computeTravelerCompleteness` `:1296`, `validateTravelerCompletion` `:1954`, `finalConfirm` `:2040` |
| Копия FIO+birthDate Request→Order | образец: `order-requested.consumer.ts:77-81` → `order.service.ts:528-541` |
| Pre-Order traveler-строки | `CheckoutIntentTraveler` (`sales/sales-checkout.service.ts:144-153, 196-205`), `QuoteTraveler` |
| Аудит-история | `RequestHistory.comment`, `OrderHistory.fields` (использованы в FIX B) |
| Маскировка PII | `shared/pii.ts`, `shared/audit.ts` |
| i18n | `d3.field.*` `lib/i18n.tsx:1699-1705`, `order.action.update_traveler_d3/update_travelers` `:2498-2499` |

---

## 16. Открытые вопросы (решение владельца, до реализации)

1. **`gender`**: остаётся в `TRAVELER_FIELDS` (сейчас 7-е поле) или заменяется на `passportSeries`?
2. **Где хранить Request-traveler**: новая таблица `order.RequestTraveler` vs расширение существующей связи — модель сейчас отсутствует.
3. **Граница `birthDate → price`**: документ требует, чтобы birthDate участвовал в коммерческом расчёте, но цена сейчас приходит от поставщика составом из поиска — требуется либо мост состава, либо пересчёт.
4. **Точка валидации срока**: §4 требует 3 точки, но отправки поставщику нет — валидировать на Booking или отложить до появления адаптера?
5. **Миграция 4 live-записей**: Request-pin → `birthDate:REQUIRED`; Order-pin → новая 7-полевая карта; offer-факты уже сохранены.
6. **Дефолт `DEFAULTS_TOUR.birthDate`**: `OPTIONAL → REQUIRED` — влияет на все новые TOUR-заявки (не только на 4 записи).

---

## 17. §8 checklist — статус

| Пункт §8 | Статус | Раздел |
|---|---|---|
| Existing Traveler model/Prisma fields | найдено | §1 |
| Request traveler API | **ОТСУТСТВУЕТ** | §2 |
| Order traveler API | найдено | §3 |
| Request→Order copy logic | найдено (заглушки) | §4 |
| Completeness calculation | найдено (только Order) | §5 |
| TravelerCollectionPanel | найдено | §6 |
| TravelerRequirements/TravelerFullRequirements | найдено | §7 |
| D3 final-confirmation gate | найдено (без документов) | §9 |
| Booking payload/consumer | найдено | §10 |
| Supplier submission path | **ОТСУТСТВУЕТ** (только search/pricing) | §11 |
| productSnapshot structure | найдено | §12 |
| Existing passport/document fields | частично (нет `passportSeries`, нет валидации) | §8 |

---

## 18. Safety

- Код: **не изменён** · БД: **только `SELECT`** · миграции: **не созданы** · UI: **не изменён**
- Git: commit **NO** / push **NO** · в репозитории файлов этой сессии не добавлено (SQL-скрипты аудита — в `%LOCALAPPDATA%\Temp\opencode\`)

**Статус:** аудит §8 завершён. Реализация **не начата** — ожидается решение по вопросам §16.
