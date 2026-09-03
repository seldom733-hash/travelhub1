# PHASE 3 — PRE-STEP 3.12 — D3 — REQUEST FLOW INTEGRATION — FINAL REMEDIATION & EVIDENCE CLOSURE — ОТЧЁТ

Статус: **ВЫПОЛНЕНО** (реализация + автоматические e2e + live browser-прогон + регрессия + git-закрытие).
Вердикт: **A** (F6 закрыт; детали в §34/§35).

---

## 1. EXECUTIVE SUMMARY

Фаза закрывает **F6 (P1 gate FAIL)** из D3 Strict Review: Request-домен (Заявки) имел полный lifecycle
(create → confirm-price → customer-accept → CONVERTED), но `convertToOrder` не был подключён ни к одному
вызывающему коду, реального E2E «Request → acceptance → pin → travelers → final confirm → Order →
convertedAt» не существовало, и Order не получал замороженный acceptance-snapshot при конвертации.

Выполнено:

- **Один канонический путь конверсии** (adapter-слой): `POST /requests/:id/convert` → CAS-claim
  `CUSTOMER_ACCEPTED → CONVERTED` → Order-graph через `OrderService.createOrderFromRequest`
  (канонические примитивы, та же транзакция) → `convertedOrderId`/`convertedAt` back-link →
  `OrderCreated` событие публикуется ПОСЛЕ коммита.
- **Acceptance timestamp (§6)**: `termsAcceptedAt = customerAcceptedAt` (момент CUSTOMER_ACCEPTED),
  переносится в Order при конвертации — не `now` конвертации.
- **Pin at acceptance (§7)**: `pinnedRequirements` + `travelerCount` + `productSnapshot` замораживаются
  в той же транзакции, что и `customerAcceptedAt`. Конверсия НЕ читает mutable Product/Price —
  гонка acceptance→pin исключена.
- **Traveler count freeze (§8)**: явный `travelerCount` (party composition) — canonical source для
  `Order.travelerCount`; legacy-заявки без D3-снапшота → конверсия отклонена (409).
- **Idempotency/конкурентность (§11)**: повторный convert → HTTP 200 + тот же Order; конкурентная гонка →
  CAS `updateMany` даёт ровно один победитель, один Order.
- **Request UI continuation (§13/§14)**: Request detail (Заявки) получил «Продолжить оформление» →
  linked Order, прогресс, связанный заказ с reference-number (i18n RU/AZ/EN).
- **Booking gate (§15)**: Request-derived Order проходит тот же SR R3 gate — confirm/send до
  `finalConfirmedAt` → 422 (traveler-bearing).
- **Дополнительно найден и исправлен реальный продуктовый дефект**: `GET /bookings?orderId=X`
  молча перезаписывал явный orderId channel-scope'ом (Order-detail панель показывала чужие брони) —
  теперь условия ИНТЕРСЕКТЯТСЯ (+ regression-тест 11 в D3-спецификации).
- **Детерминизм Passenger-населения**: Booking-subscriber теперь упорядочивает travelers по
  `position` (не DB-произвольный порядок) — устраняет pre-existing флейк теста 4.

Автоматика: **d3-request-flow 4/4**, **d3-traveler-collection 11/11** (включая новые: booking-фильтр),
request-center-search 14/14. Browser runtime (Playwright, RU): **13/13 checks PASS**, 8 скриншотов
(`docs/evidence/d3rf/`). Регрессия: failure-сеты 5 e2e-суит идентичны clean-baseline `7b73732`
(20 fail — pre-existing stale-спеки, 0 новых). Dev DB: 1000 seeded Orders сохранены, CASE A/B
перманентные, все disposable-цепочки удалены.

---

## 2. STARTING GIT STATE

- HEAD == `origin/master` == `c72cd50` (docs-коммит D3 SR §27 sync).
- Предыдущий закрытый вердикт: **VERDICT B — D3 SR closed; NEXT: D3 Request-flow E2E remediation (F6), затем D4**.
- Рабочее дерево: чистое (только pre-existing untracked файлы предыдущих фаз — промпты, tmp-скрипты, D1A-doc).

## 3. STRICT REVIEW F6 BASELINE

F6 из SR-отчёта (`docs/reports/PHASE_3_PRE_STEP_3.12_D3_TRAVELER_COLLECTION_ORDER_BOOKING_POPULATION_STRICT_REVIEW_REPORT.md`):

> **F6 (P1 gate FAIL)** — Request flow НЕ интегрирован с D3: `Request.customerAccept`
> (CUSTOMER_ACCEPTED + `customerAcceptedAt`) существует, но конверсия `convertToOrder` НЕ подключена
> ни к одному вызывающему коду; реального E2E «Request → acceptance → pin → travelers → final confirm →
> Order → convertedAt» нет. **NOT IMPLEMENTED** → **VERDICT B**.

Базовая проверка аудита на момент старта фазы:

- `RequestService.convertToOrder` — без вызовов (`grep` по src: 0 ссылок).
- Request Center UI (`frontend/app/app/requests/[id]`) — read-only, действий нет.
- Тесты Request-домена — только search-сценарии (`request-center-search.e2e-spec.ts`).

## 4. REQUEST DOMAIN AUDIT

Аудит фактического состояния домена (model/status/service/controller/events):

- **Модель** (`prisma/schema.prisma`, `model Request`): status (`NEW / PRICE_CONFIRMED / PROPOSED /
  CUSTOMER_ACCEPTED / DECLINED / REJECTED / UNAVAILABLE / CONVERTED`), `customerAcceptedAt`,
  `customerDecision`, `convertedOrderId`, `convertedAt`, `commerceSequence`, `confirmedPrice/Currency`,
  `displayedPrice/Currency`, `quantity`. **Отсутствовали** D3-поля: `travelerCount`, `pinnedRequirements`,
  `productSnapshot`.
- **Сервис** (`request.service.ts`): create/list/get/confirm-price/propose-price/reject/unavailable/
  customer-accept/customer-decline/kpi/history; `convertToOrder` существовал как заглушка без вызовов.
- **Контроллер** (`request.controller.ts`): `GET /requests`, `GET /requests/:id`, `POST /requests`,
  `POST :id/confirm-price|propose-price|reject|unavailable|customer-accept|customer-decline` —
  все под `order.read`/`order.edit_noncritical`; **не было** `POST /requests/:id/convert`.
- **События**: Request-домен событий не публикует; OrderRequested/OrderCreated — каноническая
  sale-цепочка (не Request).
- **UI**: список + детали read-only, без кнопок действий и без связи с Order.

## 5. ROOT CAUSE

1. **Нет конверсионного adapter-слоя**: при принятии заявки не создавался commerce-root;
   «Order» для заявки не существовал вообще.
2. **Нет pin**: `customerAccept` фиксировал только статус+`customerAcceptedAt`, но НЕ замораживал
   требования/цену/состав партии; любой поздний read Product давал бы mutable-семантику
   (та же F3-гонка, что SR устранил для sale-цепи, в Request-цепи оставалась).
3. **Нет freeze count**: `Order.travelerCount` при гипотетической конвертации взялся бы из
   текущего Product/quantity, а не из принятой заявки.
4. **Нет idempotency**: повторный/конкурентный convert без CAS дал бы дубль Order (root-duplication).
5. **UI оторван**: клиент не мог продолжить оформление заявки в Order.

## 6. CANONICAL CONVERSION DESIGN

Один канонический путь (adapter-слой в `RequestService`, примитивы OrderService):

```text
POST /requests/:id/convert
  → gate: status == CUSTOMER_ACCEPTED (+ D3-snapshot)
  → $transaction:
      CAS claim: updateMany(Request, {status: CUSTOMER_ACCEPTED} → {status: CONVERTED, version+1})
        (count != 1 → повторный вызов уже прошёл → вернуть существующий Order, HTTP 200 idempotent)
      order = OrderService.createOrderFromRequest(tx, {request: {…snapshot…}, actor})   // та же tx
      Request.convertedOrderId = order.id, convertedAt = order.createdAt
      RequestHistory(converted, CUSTOMER_ACCEPTED → CONVERTED)
      SecurityAudit(request.converted)
  → ПОСЛЕ коммита: publishEvent(OrderCreated)   // failure → FAILED + retryable, не rollback
```

Свойства:

- **Один источник правды**: Order-graph создаётся только здесь (для Request-цепи); все D3-инварианты
  (termsAcceptedAt, pinned, travelerCount, OrderTraveler) применяются через канонический
  `createOrderFromRequest`.
- **Никакого дубля**: CAS + idempotent-ветка.
- **Границы транзакций**: конверсия атомарна; событие — outbox после коммита.

## 7. REQUEST ACCEPTANCE SEMANTICS

- `termsAcceptedAt` (Order) = `customerAcceptedAt` (Request) — **реальный acceptance instant**,
  когда клиент (customer) принял цену/условия. НЕ `now` конвертации, НЕ время обработчика.
- В `customerAccept` фиксируется `customerAcceptedAt = now` сервера в момент CUSTOMER_ACCEPTED
  (server-owned, клиент не может подменить — запрещённые ключи в DTO).
- E2E test 1 (d3-request-flow) проверяет ms-равенство `Order.termsAcceptedAt == Request.customerAcceptedAt`.

## 8. REQUIREMENTS PINNING

- В транзакции `customerAccept` вычисляются **effective traveler requirements**:
  `getEffectiveTravelerRequirements(Product.travelerRequirements ?? ProductTypeDefaults)` —
  и замораживаются в `Request.pinnedRequirements` (JSONB) **вместе** с `customerAcceptedAt`
  (та же транзакция → гонки нет).
- Дополнительно замораживается `productSnapshot` (productId/productCode/productTitle/productType)
  на момент **создания** заявки (продукт «как подан»).
- Конверсия **не читает** mutable Product/Catalog — принимает snapshot из `existing`.
- E2E test 1: Policy A (birthDate REQUIRED) → после customer-accept продукт мутирован в Policy B
  (REQUIRED→другие поля) → Order всё равно получает **A** (pinned), новый checkout — B.
- E2E test 3: legacy заявка без pinned/travelerCount → конверсия отклонена (409, «no D3 acceptance snapshot»).

## 9. TRAVELER COUNT FREEZE

- При создании заявки принимается явный `travelerCount` (party composition, guests/туристы).
- `customerAccept` замораживает `travelerCount = request.travelerCount ?? request.quantity`
  (legacy-компромисс: quantity — единственное прежнее count-представление; DB default 1 = 1 гость).
- Конверсия передаёт замороженный count в `Order.travelerCount`; `OrderTraveler`-строки создаются
  ровно N (position 1..N) — тот же механизм, что в sale-цепи.
- E2E test 1: `travelerCount = 2` → 2 OrderTraveler → 2 Passenger.

## 10. REQUEST → ORDER LINKING

- `convertedOrderId` — FK/UUID фактического Order root (никогда не строка REQ-*/ORD-*), §9 spec.
- `convertedAt` = `Order.createdAt` (момент конверсионной транзакции; каноническая семантика).
- Back-link в UI: Request detail показывает «Связанный заказ» + reference (MKT-ORD-…), клик → Order.
- API DTO: `convertedOrder: {id, referenceNumber, status, createdAt}`, `idempotent: true` на повторе.

## 11. convertedAt / convertedOrderId SEMANTICS

- `convertedOrderId` — **ссылка**, не источник фактов: все денежные/требовательные факты живут в
  Order (frozen при конверсии из Request-снапшота).
- `convertedAt == Order.createdAt` — «конверсия и создание Order — одна атомарная операция».
- `Request.status == CONVERTED` — терминальное состояние; повторные мутации (accept/decline/
  confirm-price) на CONVERTED → конфликт (проверка в transition-гейтах).

## 12. REQUEST STATE MACHINE

Каноническая цепь (используется тестами и UI):

```text
NEW → PRICE_CONFIRMED (confirm-price) → CUSTOMER_ACCEPTED (customer-accept + PIN + count + acceptedAt)
                                                              ↓
                                                        CONVERTED (convert, CAS)
        NEW/PRICE_CONFIRMED → REJECTED / UNAVAILABLE (supplier actions)
        NEW/PRICE_CONFIRMED/CUSTOMER_ACCEPTED → DECLINED (customer-decline)
```

- Переходы валидируются в сервисе (невалидный переход → 4xx), version increment на каждом мутирующем шаге.
- `CONVERTED` — терминальный; `customerAccept` на CONVERTED → конфликт.
- E2E test 3: NEW (не принята) → conversion denied; принятая без D3-снапшота → denied.

## 13. IDEMPOTENCY / CONCURRENCY

- **Idempotent replay**: `POST /requests/:id/convert` на `CONVERTED` заявке → HTTP **200** + тот же
  Order (`idempotent: true`) — E2E test 2.
- **Concurrent convert**: CAS `updateMany(where: {id, status: CUSTOMER_ACCEPTED})` → ровно один
  победитель; проигравший повторно читает `CONVERTED+convertedOrderId` и возвращает существующий
  Order без создания второго — E2E test 2 (Promise.all, ровно 1 Order).
- **Одна бронь на Order** сохраняется (Booking subscriber `count > 0 → skip`).

## 14. TRAVELER COLLECTION INTEGRATION

- Request-derived Order получает `OrderTraveler` (position 1..N) через канонический
  `createOrderFromRequest` — тот же pin/COMPLETE-механизм, что в sale-цепи.
- TravelerCollectionPanel (Order Center) работает для конвертированных заказов без изменений
  (поля из `pinnedRequirements`).
- Browser evidence: CASE C — заявка → конверсия → 2 карточки туристов → save/resume →
  final confirm → READY_FOR_BOOKING → SENT_TO_BOOKING → Booking в «Связанные брони» (UI).

## 15. BOOKING GATE

- SR R3 gate сохранён: для traveler-bearing Order (`travelerCount > 0 && termsAcceptedAt != null`)
  `confirm`/`send` до `finalConfirmedAt` → 422 (ValidationDomainError).
- E2E test 9 (D3-коллекция): подтверждено на sale-цепи; browser evidence E: тот же гейт на
  Request-derived Order через UI (кнопки «Готов к бронированию»/«Передать в Booking» отклоняются,
  баннер «требует финального подтверждения»).
- После final confirm → confirm (READY_FOR_BOOKING) → send (SENT_TO_BOOKING) → 1 Booking.

## 16. PASSENGER POPULATION

- Booking subscriber населяет Passenger из confirmed OrderTraveler (не из Customer/Product),
  включая `passportExpiry` — как в D3 impl.
- **Детерминизм**: subscribers теперь упорядочивают `travelers: orderBy(position asc, id asc)` и
  `items: orderBy(id asc)` — Passenger-население повторяет канонический порядок подтверждённого
  списка туристов (устраняет DB-произвольный порядок → pre-existing flake теста 4).
- E2E: 1 Request-derived Order → 1 Booking → 2 Passenger (имена/паспорта совпадают с
  confirmed OrderTraveler); CASE B (live): Booking `MKT-BKG-00000084` + 2 Passenger.

## 17. CUSTOMER ≠ PAYER ≠ TRAVELER

- `Request.customerId` — покупатель (заказчик заявки); travellers — партия туристов; payer —
  не вводится (Request не хранит платёжные данные; оплата — отдельный домен Finance).
- Конверсия переносит `customerId` в Order; OrderTraveler привязаны к Order (не к customer).
- Не смешиваются: passenger-firstName/lastName из traveler-карточек, customer-данные не
  перезаписываются.

## 18. SECURITY / TENANT ISOLATION

- `GET /requests*` → `order.read`; `POST /requests`, `:id/confirm-price|propose-price|reject|
  unavailable|customer-accept|customer-decline|convert` → `order.edit_noncritical`.
- E2E test 4 (d3-request-flow):
  - BUYER → 403 (все действия);
  - чужой PARTNER (не seller заявки) → 403;
  - SALES_MANAGER → read 200 (ред. PII), write/convert → 403;
  - OPERATOR → полный цикл 200.
- `supplierAction` и object-scope: партнёр действует только по своим заявкам (`partnerId == own`).

## 19. NO-REQUEST REGRESSION

- Sale-цепочка (канонический Checkout → Sale → OrderRequested → consumer) не тронута:
  `createOrderFromRequest` — новый метод; существующий consumer-путь сохранён как есть.
- D3-спецификация (sale-цепь) полностью зелёная: **11/11** (было 10 + новый booking-фильтр тест 11).
- request-center-search (read-only центр заявок): **14/14 PASS** — поиск/пагинация/KPI не сломаны.
- No-Request flow (legacy Order без D3-полей) — тест 7 D3-спека: submission до acceptance → 422,
  final confirm → 422 — не изменялся.

## 20. PERMANENT VISUAL VERIFICATION CASE

CASE A (editable) и CASE B (completed) созданы на live dev-стеке и **сохраняются** (перманентные):

| CASE | Request | Order | Состояние |
|------|---------|-------|-----------|
| A | `MKT-REQ-09000547` | `MKT-ORD-09000547` | NEW; 2 OrderTraveler; acceptance+pin; без Booking — **редактируемый** (save/resume) |
| B | `MKT-REQ-09000548` | `MKT-ORD-09000548` | SENT_TO_BOOKING; 2 OrderTraveler; final confirmed; Booking `MKT-BKG-00000084` (COMPLETED) + 2 Passenger — **completed** (locked) |

Manifest: `docs/evidence/d3rf/MANIFEST.md` (полные идентификаторы, назначение, скриншоты).

## 21. BROWSER RUNTIME

Playwright (headless Chromium, RU) на live dev-стеке (`:3000` → proxy → `:4000`),
скрипт `frontend/tmp_d3rf_browser.mjs` (disposable). **13/13 checks PASS**, 8 скриншотов:

| # | Check-группа | Проверки |
|---|-------------|----------|
| A1 | Request detail (CASE A) | 4: страница открывается, «Связанный заказ» виден, прогресс «Ожидаются данные туристов», кнопка «Продолжить оформление» |
| A2 | Order traveler cards | 2 карточки «Турист 1/2 из 2» |
| A3 | final confirm denied | пустые REQUIRED → «Финальное подтверждение отклонено» (server gate) |
| A4 | save → hard refresh → resume | значение `Иван` персистируется |
| E | Booking gate denied | confirm/send до final confirm → баннер «требует финального подтверждения» |
| F | CASE C полный цикл | final confirm ok (`finalConfirmedAt` на сервере); confirm → READY_FOR_BOOKING; send → SENT_TO_BOOKING; Booking видна в «Связанные брони» (UI) — **проверяет фикс orderId-фильтра** |
| B | CASE B locked | «данные неизменяемы» (immutable после final confirm) |

Скриншоты: `docs/evidence/d3rf/tmp_d3rf_browser_{1..8}_*.png`.

## 22. AUTOMATED REQUEST E2E

`backend/test/d3-request-flow.e2e-spec.ts` (новый, **4/4 PASS**):

1. **Request → accept (policy A pinned) → Product→B → Order STILL A; travelerCount 2;
   1 Booking + 2 Passenger после final confirm; временные инварианты** — полный канонический цикл
   + pin-иммутабельность + termsAcceptedAt == customerAcceptedAt.
2. **Повторный convert → тот же Order (idempotent, 200); concurrent convert → ровно один Order** —
   Promise.all гонка, CAS.
3. **NEW / legacy accepted (без D3 snapshot) → conversion denied; accept без Product → 400** —
   gate-отрицательные контроли.
4. **BUYER/чужой PARTNER → 403; SALES_MANAGER read 200 + write 403; OPERATOR полный цикл** — RBAC.

## 23. TEMPORAL EVIDENCE

- `termsAcceptedAt == customerAcceptedAt` (ms-равенство) — E2E test 1.
- `finalConfirmedAt >= termsAcceptedAt` (два разных события) — D3-спека test 4.
- `convertedAt == Order.createdAt` — единая атомарная операция.
- Booking/Passenger createdAt после Order createdAt (цепочка не нарушена).
- D3-спека test 10 (sale-цепь): `termsAcceptedAt == Sale.completedAt` — sale-путь не изменён.

## 24. DB/API/UI/EVENT RECONCILIATION

Live dev (CASE A/B/C через API + browser):

- **DB**: Request CONVERTED + `convertedOrderId`/`convertedAt`; Order с frozen
  `pinnedRequirements`/`travelerCount`/`termsAcceptedAt`; N OrderTraveler; Booking + N Passenger.
- **API**: `GET /requests/:id` → `convertedOrder: {id, referenceNumber, status}`; `GET /bookings?orderId=X`
  → ровно брони X (фикс фильтра).
- **UI**: Request detail → linked Order (reference видна, клик); Order detail → travelers/booking.
- **Events**: OrderCreated (payload frozen, из Request-снапшота) публикуется после коммита;
  BookingRequested → BookingCreated — та же outbox/inbox механика.
- **Результат browser 13/13**: DB == API == UI на каждом шаге (assert через API + DOM).

## 25. REPRESENTATIVE DATA SAFETY

- Dev DB: seeded **1000 Orders** сохранены (проверено: total 1002 = 1000 + CASE A + CASE B;
  0 disposable-остатков).
- Все disposable CASE C-цепочки (`MKT-REQ-090007xx`, `0900065x` + их Order/Booking/Passenger/
  Outbox) удалены после evidence.
- Счётчики dev-последовательностей выровнены (Hi/Lo-аллокатор перезапущен после seed —
  коллизий REQ/ORD/BKG нет).

## 26. REGRESSION

- **Зелёные суиты (Request/Order/Booking домены)**: d3-request-flow 4/4; d3-traveler-collection
  11/11 (включая новый booking-фильтр тест 11); request-center-search 14/14; booking-temporal-contract
  12/12; продажи/файнанс — без изменений.
- **Сравнение failure-сетов (независимо, worktree на baseline `7b73732` = D3 impl)**: 5 e2e-суит
  (buyer-requests, booking-requested-consumer, booking-lifecycle-completion, booking-service-time-model,
  order-lifecycle-completion) — **20 fail / 153 pass на обеих сторонах, diff пустой (0 new / 0 fixed)**.
  Это pre-existing stale-спеки (Product требует Partner-owner 3.6B и пр.) — не вызваны D3RF.
- Frontend: `tsc --noEmit` clean; vitest — только известный pre-existing Intl NBSP-фейл
  (`formatPrice` U+00A0), остальное 8/9 pass (тот же failure на clean HEAD, подтверждён ранее).

## 27. FINDINGS MATRIX

| # | Severity | Finding | Статус | Где закрыто |
|---|----------|---------|--------|-------------|
| F6 (SR) | P1 gate | Request flow не интегрирован с D3 (нет convert endpoint, нет pin, нет count, нет UI-континуации) | **CLOSED** | §6–§16, §21–§22 |
| D3RF-1 | P1 | `convertToOrder` без вызывающего кода | CLOSED | §6, controller `POST /requests/:id/convert` |
| D3RF-2 | P1 | `customerAccept` не замораживал requirements/count/product | CLOSED | §7–§9 (migration + customerAccept) |
| D3RF-3 | P1 | Возможен дубль Order при повторном/конкурентном convert | CLOSED | §13 (CAS + idempotent 200) |
| D3RF-4 | P1 (prod) | `GET /bookings?orderId=X` перезаписывался channel-scope → Order-detail показывал чужие брони | **CLOSED (найдено при evidence)** | `booking.service.ts` (AND-интерсекция) + тест 11 |
| D3RF-5 | P2 | Passenger-население в DB-произвольном порядке → flake | CLOSED | `booking.subscribers.ts` (orderBy position) |
| D3RF-6 | P2 | Request UI read-only, нет связи с Order | CLOSED | §14/§21 (Request detail actions + linked order) |

## 28. FILES CHANGED

Backend:

- `backend/prisma/schema.prisma` — Request: `travelerCount`, `pinnedRequirements`, `productSnapshot`.
- `backend/prisma/migrations/20260903120000_d3_request_flow_conversion/migration.sql` — additive DDL (legacy NULL).
- `backend/src/modules/order/request.service.ts` — pin-at-acceptance, convert orchestration (CAS),
  gates, idempotency, security-аудит.
- `backend/src/modules/order/request.controller.ts` — `POST :id/convert` (passthrough 200/201),
  permission gates.
- `backend/src/modules/order/request.module.ts` — imports (OrderModule → OrderService).
- `backend/src/modules/order/order.service.ts` — `createOrderFromRequest` (+221 строк).
- `backend/src/modules/order/order.module.ts` — экспорт OrderService для RequestModule.
- `backend/src/modules/booking/booking.service.ts` — orderId-фильтр: AND-интерсекция с channel-scope.
- `backend/src/modules/booking/booking.subscribers.ts` — детерминированный порядок travelers/items.
- `backend/test/d3-request-flow.e2e-spec.ts` — **новый**, 4 теста.
- `backend/test/d3-traveler-collection.e2e-spec.ts` — + тест 11 (booking-фильтр); robust-выбор traveler по position.

Frontend:

- `frontend/app/app/requests/[id]/page.tsx` — Request detail: actions (confirm-price/accept/convert),
  прогресс, «Продолжить оформление», связанный заказ.
- `frontend/lib/i18n.tsx` — ключи requests-действий/linked-order (RU/AZ/EN).

Docs/evidence:

- `docs/evidence/d3rf/MANIFEST.md` + 8 скриншотов `tmp_d3rf_browser_{1..8}_*.png`.
- `docs/reports/PHASE_3_PRE_STEP_3.12_D3_REQUEST_FLOW_INTEGRATION_FINAL_EVIDENCE_CLOSURE_REPORT.md` — этот отчёт.

## 29. CANONICAL ARCHITECTURE SYNC

- Канонический contract (`docs/architecture/COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md`) уже обновлён
  в SR (Option B reconciliation §14.3A/§15.1): Order = commerce root; final confirmation = Booking gate.
- Request-конверсия теперь соответствует: Order создаётся только из **принятой** заявки с frozen
  snapshot; acceptance boundary = CUSTOMER_ACCEPTED (pin); Booking gate = finalConfirmedAt.
- Синхронизация с D1-доктриной: Request ≠ commerce root; Request → (acceptance) → Order →
  (final confirm) → Booking. Доп. правки документации не требуются (архитектура уже согласована в SR).

## 30. ROADMAP CLOSURE

- Roadmap v3 (docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md): SR-коммит уже внёс
  §3.12 D3-пункты (Option B reconciliation). D3RF-фаза не меняет порядок шагов — **следующий шаг D4**
  (см. §35).
- Промпт фазы выполнен полностью: все 39 секций (§1–§39) отработаны; STOP rule соблюдён
  (несвязанные stale-спеки не чинились, §30 промпта).

## 31. GIT CLOSURE

- Старт: `c72cd50` (HEAD == origin/master).
- Коммиты фазы (после закрытия):
  - `33cec2f` — `feat(order): D3 — Request flow integration (F6 closure)` (реализация + тесты)
  - `0b56a4f` — `docs(order): D3 request flow report — §31 git state (pushed 33cec2f)`
  - `6cf4426` — `chore(docs): D3 git closure — commit phase prompts/reports + storefront e2e specs, drop tmp artifacts` (Final Git Closure Recheck)
- Финал: HEAD == origin/master (push), рабочее дерево чистое (только pre-existing untracked:
  промпты предыдущих фаз, tmp-скрипты evidence — задокументированы в §28 как disposable).
- `tmp_d3rf_*` скрипты и `tmp_d3rf_cases.json` — disposable, не коммитятся (лежат в .gitignore-зоне
  или удаляются; evidence-скриншоты переехали в `docs/evidence/d3rf/`).

## 32. RESIDUAL RISKS

| Risk | Severity | Mitigation / комментарий |
|------|----------|--------------------------|
| Legacy Request-строки (без D3-снапшота) не конвертируются | Low | Осознанное решение: конверсия без pin нарушила бы D3; legacy-заявки остаются в Request Center (read-only) до D4/миграции |
| DEV-последовательности (Hi/Lo) выровнены вручную | Low | Только dev-среда; prod/e2e — аллокатор штатный |
| 5 e2e-суит pre-existing fail | Known | Сравнение с baseline `7b73732`: 0 новых; stale-спеки (partner-owner 3.6B) — вне скоупа фазы |
| Intl NBSP unit-фейл (frontend) | Known | Pre-existing на clean HEAD; не связан с D3RF |

## 33. ACCEPTANCE MATRIX (HARD)

| # | Gate (промпт) | Результат | Доказательство |
|---|---------------|-----------|----------------|
| §6 | Acceptance timestamp = customerAccept | **PASS** | E2E test 1 (ms-равенство) |
| §7 | Pin at request acceptance (frozen, no race) | **PASS** | E2E test 1 (Policy A → Product B → Order A); тест 3 (legacy denied) |
| §8 | Traveler count freeze | **PASS** | E2E test 1 (2 → 2 OrderTraveler → 2 Passenger) |
| §9 | Request→Order / converted semantics | **PASS** | E2E test 1–3; API DTO `convertedOrder` |
| §11 | Idempotency / concurrency | **PASS** | E2E test 2 (replay 200, Promise.all → 1 Order) |
| §13 | UI continuation | **PASS** | Browser A1–A4 (продолжить оформление → Order, save/resume) |
| §15 | Booking gate for request-derived Order | **PASS** | Browser E (UI deny); E2E D3 test 9 (sale-цепь) |
| §16 | Passenger population | **PASS** | E2E test 1 (2 Passenger, имена/паспорта); CASE B live |
| §18 | Security / tenant isolation | **PASS** | E2E test 4 (BUYER/чужой PARTNER 403; SALES_MANAGER read-only; OPERATOR полный) |
| §19 | No-Request regression | **PASS** | D3-спека 11/11 (sale-цепь); request-center-search 14/14 |
| §20/§21 | Permanent case + manifest + browser | **PASS** | CASE A/B в dev DB; MANIFEST.md; browser 13/13, 8 скриншотов |
| §23 | Automated real Request E2E | **PASS** | d3-request-flow 4/4 |
| §24 | Temporal invariants | **PASS** | §23 (ms-равенства, порядок createdAt) |
| §25 | DB → API → UI → Event reconciliation | **PASS** | §24 (live-проверки + browser asserts) |
| §27 | Representative data safety | **PASS** | 1000 Orders целы; disposable удалены; total 1002 |
| §29 | Regression | **PASS** | failure-сеты идентичны baseline (0 new) |
| §28 | Clean worktree | **PASS** | после commit+push; untracked = только pre-existing |
| §31 | Do not fix unrelated | **PASS** | 5 stale-суит не чинились (зафиксировано в §26) |

## 34. FINAL VERDICT

```text
VERDICT A — D3 REQUEST FLOW INTEGRATION COMPLETED & CLOSED (F6 remediated)
NEXT ACTION: D4 (следующий шаг roadmap §3.12)
```

## 35. TRUE NEXT

- **D4** — следующий шаг канонического roadmap (после D3-семейства; конкретика в
  `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` §3.12).
- Опционально перед D4: cleanup pre-existing stale e2e-суит (product-owner 3.6B спецификаторы)
  — отдельная задача вне скоупа D3RF.