# TRAVELHUB — COMMERCIAL SERVICE BUILDER / PRICING
# STRICT READ-ONLY RECONCILIATION AUDIT — V2 — REPORT

Дата: 2026-10-07. База инспекции: HEAD `75c6bea` (master, staged 0). Аудит строго read-only (§24 внизу).

---

## A. Executive Verdict

```text
PARTIALLY IMPLEMENTED
```

Ядро коммерческой архитектуры **соответствует** договорённости владельца:
единственная граница наценки (`SupplierPricingService.apply`), серверный индивидуальный
скидок без процентных approval-порогов с обязательным floor
`final >= supplier cost` (равенство разрешено), заморозка snapshot при
принятии, конверсия Request → Order с замораживанием денег, отсутствие
double markup, отсутствие мутации публичной цены при индивидуальной скидке.

Но значительная часть целевой модели отсутствует: Service Builder
(мультисервисные строки) не существует в UI и в Request/Order; сценарий D
(собранный тур) невозможен; UI индивидуальной скидки и видимой прибыли нет
(бэкенд скидки готов); входы поставщика/стоимости поставщика в Live Sales
форме нет; Supplier Settlement flow отсутствует (есть только generic
finance-foundation); одна website-точка входа мертва. Несколько рисков
обхода supplier-floor (заявки без snapshot).

---

## B. Current Architecture

**Доменная модель** (backend/prisma/schema.prisma):

- `Request` (2377) — спрос клиента; `productId?` (2387), `partnerId?` (2388),
  `displayedPrice/confirmedPrice` (2397-2400), supplier-переговоры
  (`supplierDecision`, `supplierPriceProposal` 2405-2407),
  `commercialSnapshot Json?` (2426), `productSnapshot Json?` (2435),
  `convertedOrderId` (2438). **Один** snapshot на заявку — service lines отсутствуют.
- `Order` (2131) — принятая коммерческая истина; `commercialSnapshot Json?`,
  `subtotal/amount`; `OrderItem` (2276) — `productId String` (не NULL;
  для product-less — placeholder), `price/amount`, **нет** supplier-колонок
  (поставщик и его стоимость живут только в JSON snapshot'ах).
- `Booking` (2526) — fulfillment, ссылка `orderItemId` (Stage2), N booking'ов на Order.
- `Payment` (4127) — `PaymentStatus`, `isActivePayment` + partial unique
  `Payment_one_active_per_order` (4182), milestone-колонки; `PaymentHistory`
  (4192) — actor/reason; `Refund` (4247).
- `Settlement` (4853) / `Payout` (4884) — generic append-only факты finance
  (sourceType/sourceId, **без** payee-колонки, комментарий 4881). Модель
  `SupplierSettlement` — 0 совпадений в коде.
- `Quote` (3652) / `QuoteItem` (3722) / `Sale` (3812) — существующий sales-домен
  с мультисервисными строками и деньгами (`sales.money.ts`), но **не** участвует
  в потоке Request → Order (`prisma.quote.create` вне generated — 0; UI цитат — 0).
- `Product` (353), enum `ProductType` (279-291): TOUR, HOTEL, SANATORIUM,
  FLIGHT, TRAIN, EXCURSION, GUIDE, TRANSFER, PHOTOGRAPHER.
- `Partner` (1935) — центральная директория (extensible через
  `crm.service createPartner`); `Supplier` (1967) — 10-строчный stub;
  связи Partner↔Supplier и Partner↔service line через не-FK колонки.
- `MarkupRule` (4637) + `MarkupRuleHistory` (4666).

**Пricing** (backend/src/modules/pricing/):

- `SupplierPricingService.apply()` supplier-pricing.service.ts:94-121 —
  **единственный** участок формулы `supplier + markup = public`; `resolve()`
  76-85 (0 правил → NOT_CONFIGURED 0%, >1 → fail-closed). Вызывается из всех
  supplier-путей: kompas-sync.service.ts:46, kazunion-sync.service.ts:60,
  summertour/summer-sync.service.ts:91, summer-bulk-sync.service.ts:44,
  azal.controller.ts:225/238, supplier-offer.service.ts:41,
  markup-matrix.service.ts:62 — one boundary.
- `commercial-snapshot.ts`: `buildWorkingSnapshot` 83-142 (инвариант
  `publicPrice = supplierPrice + markupAmount` 111-115; Gate E supplierPrice > 0),
  `applyIndividualDiscount` 149-166 (не трогает publicPrice),
  `validateForAcceptance` 174-254 (floor 234-238: `final < supplier → 422`;
  accepted-money floor 245-249), `freezeForAcceptance` 260-274 (Gate F).
- `sales.money.ts`: `validateDiscountValue` 63-81 (PERCENTAGE ≤ 100 —
  **числовая** граница 74-77, не бизнес-кап), `discountAmountOf` 108+
  (FIXED > subtotal → 422, без silent clamp).
- Discount-флоу: `request.controller.ts:243` `POST :id/discount`
  (RBAC `sales.discount.grant` 244) → `request.service.ts:670-759 grantDiscount`
  (статус-гейт NEW/CHECKING/CONFIRMED 701, запрет при frozen/converted 685-700,
  пересчёт 721, floor 722, история `discount_granted` 732-742,
  аудит `request.discount_granted` 744-757).
- Конверсия: `request.service.ts:963 convertRequestToOrder` (idempotent
  968-986, 409 re-conv 994-999, статус-гейт CUSTOMER_ACCEPTED 1002-1006,
  freeze/D3 snapshot 1007-1011, CAS 1025-1037) →
  `order.service.ts createOrderFromRequest` (money gate 661-666, Order row
  682-729: commercialSnapshot копия 708-710, subtotal=amount 712,
  upstream refs 715-720, один OrderItem).

**Frontend:**

- Website: `GuestCheckoutForm.tsx` (checkout/guest; цену клиент не шлёт —
  комментарий 13-14), `OfferModal.tsx:332` шлёт `price: offer.price` +
  серверный recheck авторитетен (45-46, дрейф виден 379-380),
  `HelpFindButton.tsx:20` `POST /api/v1/public/requests` — **бэкенд-контроллера
  нет** (0 совпадений; есть только `@Controller("requests")`
  request.controller.ts:18 и `@Controller("buyer/requests")`
  reverse/requests.controller.ts:151), ошибки глушатся (36-37).
- Manager: `ManualCreateForm.tsx` — productId опционален (270-272
  «— без услуги —»), customerId (143), «Цена *» → `displayedPrice` (147),
  автопоток confirm-price (158) → customer-accept (161) → convert (164);
  **нет** полей partnerId/supplier cost/discount.
- `requests/[id]/page.tsx`: actions из `availableActions`
  (108-115: confirmPrice/proposePrice/customerAccept/convert; generic
  `runPost /requests/:id/${action}` 198, рендер RequestActionBar 250-254,
  комментарий 322), отображение displayed/confirmed price (306-310),
  привязанный Order/Booking/Payments (399-454); **нет** discount UI,
  **нет** profit.
- Админка наценки: `app/app/pricing/markup/page.tsx` — CRUD + история
  MarkupRule (spec подтверждает `/pricing/markup-rules` list/create/history).
- Discount UI в frontend: **0** совпадений (`grantDiscount|discountType|скидк`
  по *.tsx — только посторонние комментарии TourConstructor).
- Profit/margin в frontend и backend: **0** совпадений
  (`grossProfit|grossMargin|прибыл`).

**Тесты** (пройдены сегодня): ui-c6-request-server-authority 22/22,
d3-request-flow 4/4, m4-guest-checkout 8/8 (product-less → Order),
pricing-markup-admin 9/9, request-discount-grant 7/7; юнит
`commercial-snapshot.spec.ts` (floor 166, равенство 171),
`request-discount-grant.spec.ts` (floor-кейсы 153-230).

---

## C. Target Architecture

```text
REQUEST
   ↓
Commercial Service Builder / Offer  (service lines: тип, партнёр, сырой
                                     поставщик, стоимость, цена, скидка)
   ↓ customer accepts
ORDER
   ↓
Order Items (по строке на услугу)
   ├── Bookings / fulfillment
   ├── Customer Payments
   └── Supplier Settlements
```

Правила: каталог `supplier cost + markup = public price` (наценка один раз);
Live Sales `catalog price − индивидуальная скидка = final price`, скидка без
процентного лимита, единственное правило `final >= supplier cost`
(равенство = 0 прибыли — допустимо), публичная цена не мутируется;
Request без Product — легален; собранный тур — много строк от разных
поставщиков; прибыль/маржа видимы; snapshot'ы заморожены; provenance цены.

---

## D. Reconciliation Matrix

| Area | Current Implementation | Target | Status | Evidence |
|---|---|---|---|---|
| Website Request | 3 рабочих точки (guest checkout, offer/tour request, PDP) + 1 мёртвая; Request создаётся, Order — только через accept→convert | Create Request → Submit | PARTIAL | `GuestCheckoutForm.tsx:62-71`; `OfferModal.tsx:332`; `HelpFindButton.tsx:20-37` vs 0 backend-controller; `request.controller.ts:178` |
| Catalog Price | `supplier + markup = public` в единственной границе; admin MarkupRule UI; отображение priceFrom | Same | IMPLEMENTED | `supplier-pricing.service.ts:94-121`, `kompas-sync.service.ts:46`, `ProductCard.tsx:119`, `pricing/markup/page.tsx` |
| Live Sales | Backend полный (propose/confirm/discount/accept/convert + RBAC); UI — только ManualCreateForm без скидки/поставщика/стоимости; discount API без UI | Manager UI: скидка, floor, прибыль, поставщик | PARTIAL | `request.controller.ts:197-279`; `ManualCreateForm.tsx:139-164`; 0 совпадений discount UI |
| Service Builder | Отсутствует (0 совпадений «Добавить услугу»/ServiceBuilder; Request — один snapshot) | `[ + Добавить услугу ]`, строки | MISSING | `frontend` grep 0 hits; `schema.prisma:2426` (единственный snapshot) |
| Supplier Cost | `supplierPrice` в snapshot (raw scalar); ввода стоимости менеджером нет; gross/net не различаются | Per-line supplier cost | PARTIAL | `commercial-snapshot.ts:42-43`; `ManualCreateForm.tsx` (нет полей); §12 |
| Customer Price | `displayedPrice` (что увидел), `confirmedPrice` (supplier), `customerFinalPrice` (snapshot) | Final customer price per line | PARTIAL | `schema.prisma:2397-2400`; `commercial-snapshot.ts:57` |
| Discount | Server-authoritative, без % approval-порогов, floor >=, история+аудит, publicPrice не мутируется; **нет UI** | Manager discount, no cap | PARTIAL | `request.service.ts:670-759`; `commercial-snapshot.ts:149-166,234-238`; `sales.money.ts:63-81` |
| Supplier Floor | `validateForAcceptance` 422 «final price < supplier price»; равенство разрешено; неприменим для заявок без snapshot | Always enforced | PARTIAL | `commercial-snapshot.ts:234-249`; `commercial-snapshot.spec.ts:166,171`; `request.service.ts:690-694` (discount без snapshot → reject) |
| Expected Profit | Не рассчитывается, не сохраняется, не отображается (0 совпадений); все данные есть в snapshot | Visible, recalculated, frozen | MISSING | grep `grossProfit\|grossMargin\|прибыл` = 0 hits; `commercial-snapshot.ts:42-57` |
| Multi-supplier | Нет: один productSnapshot/commercialSnapshot, один OrderItem; Quote/QuoteItem (multi-line) существуют, но вне Request-flow | Service lines, per-line supplier/cost/price | MISSING | `schema.prisma:2426,2435`; `order.service.ts:682-729`; `schema.prisma:3652,3722`; 0 `prisma.quote.create` вне generated |
| Request → Order | CAS + link + money-gate + freeze; e2e d3/ui-c6/m4 | Frozen conversion, no duplicates | IMPLEMENTED | `request.service.ts:963-1074`; `order.service.ts:661-729`; `d3-request-flow.e2e-spec` PASS |
| Order Snapshot | `Order.commercialSnapshot` копия snapshot'а заявки (only-if-non-null); subtotal = amount (со скидкой), `discountAmount` не копируется | Frozen commercial truth | PARTIAL | `order.service.ts:708-712`; `schema.prisma:2131` |
| Customer Payment | Payment + milestone'ы + активный платёж unique + PaymentHistory (actor/reason) + manual flow | Implemented | IMPLEMENTED | `schema.prisma:4127-4188,4192`; `payment.service.ts` (CAS) |
| Supplier Settlement | Только generic `Settlement/Payout` foundation без доменного потока, без payee, без связи supplier cost→settlement; `SupplierSettlement` — 0 hits | Per-supplier settlement от supplier cost | MISSING | `schema.prisma:4853-4907`; `settlement.service.ts:139,189` (0 доменных вызовов); `finance.controller.ts:208-246` (read-only) |
| Booking | `Booking.orderItemId`, N bookings на Order, fulfillment-семантика чистая | Per-OrderItem booking | IMPLEMENTED | `schema.prisma:2526`; Stage2-миграции (untracked) |

---

## E. Four Scenario Results

### 1. Website catalog purchase — WORKS (с дефектом одной точки входа)

- Каталог: цена считается в единственной границе и публикуется
  (`supplier-pricing.service.ts:94-121`, отображение `ProductCard.tsx:119`).
- Клиент принимает **публичную** цену: guest checkout цену не передаёт
  (комментарий `GuestCheckoutForm.tsx:13-14`), offer-флоу шлёт offer.price как
  заявленное намерение, серверный recheck авторитетен
  (`OfferModal.tsx:45-46,332`, дрейф 379-380 показывается клиенту).
- Request получает catalog selling price: snapshot
  `publicPrice = supplier + markup` (`tour-request.service.ts:203`
  `priceSource: "PUBLIC"`, `commercial-snapshot.ts:111-115`), supplier cost
  сохранён (`supplierPrice` в snapshot).
- **Второй наценки нет**: `buildWorkingSnapshot` только валидирует, не
  применяет; discount трогает лишь `customerFinalPrice` (`commercial-snapshot.ts:149-166`).
- Конвертация замораживает: Gate F (`commercial-snapshot.ts:260-274`) +
  копия в Order (`order.service.ts:708-710`), деньги проходят money-gate (661-666).
- Принятие клиента: `POST :id/customer-accept` (`request.controller.ts:257`)
  или менеджером от имени клиента (ManualCreateForm:161).
- **Дефект**: кнопка «Помочь найти» молча теряет спрос
  (`HelpFindButton.tsx:20` → 404, тихий catch).

### 2. Live Sales from catalog — BACKEND WORKS, UI MISSING

- Каталогная цена сохраняется: `grantDiscount` меняет только
  `commercialSnapshot` (`request.service.ts:727`), publicPrice/displayedPrice
  не мутируются (724-730; spec `request-discount-grant.spec.ts:7`).
- Процентного лимита нет: единственный числовой предел —
  PERCENTAGE ≤ 100 и FIXED ≤ subtotal (`sales.money.ts:74-77,106`) —
  математические границы, НЕ approval-пороги; ролевых порогов нет
  (0 совпадений на thresholds/approval по скидке).
- Floor: `validateForAcceptance` → 422 при `final < supplier`
  (`commercial-snapshot.ts:234-238`), равенство допустимо (spec:171
  `final = supplier → not.toThrow`), ниже — reject (spec:166).
- Аудит: `RequestHistory.discount_granted` + security-audit
  (`request.service.ts:732-757`), actor/timestamp — да.
- **Нет**: UI скидки (0 совпадений), UI прибыли, флоу «менеджер выбирает
  поставщика» — сценарий из UI недоступен (только API).

### 3. Live Sales non-catalog — PARTIAL

- Request без Product: `productId String?` (`schema.prisma:2387`),
  ManualCreateForm «— без услуги —» (270-272), e2e m4 — product-less
  заявка → Order (PASS).
- Customer price вводится: «Цена *» → `displayedPrice` (`ManualCreateForm.tsx:147`).
- **Нет**: выбора Partner/Supplier в форме (`partnerId` в Request есть —
  schema:2388 — но из UI не отправляется, 0 совпадений), ввода supplier
  cost, коммерческого расчёта (profit), snapshot для ручных заявок
  (manual → `commercialSnapshot = null` → скидка невозможна
  `request.service.ts:690-694`, supplier-floor не применим).
- Supplier-подтверждение цены существует (`POST :id/confirm-price`
  controller:197, `supplierPriceProposal` schema:2406) — сырой поставщик
  входит переговорным флоу, а не строкой услуги.

### 4. Multi-supplier assembled tour — MISSING

- Один `productSnapshot` + один `commercialSnapshot` на заявку
  (schema:2426,2435); конвертация создаёт **один** OrderItem
  (`order.service.ts:682-729`); строк с разными поставщиками нет.
- `Quote/QuoteItem` — существующая мультисервисная коммерческая сущность
  (`schema.prisma:3652,3722`), но мертва для Request-flow (0
  `prisma.quote.create` вне generated, 0 UI) — кандидат на существующий
  эквивалент §2, требует решения владельца, не изобретать дубликат.
- Booking per OrderItem — да; supplier settlements — нет (см. D).

---

## F. Price Flow Diagram

### Actual (сегодня)

```text
[Supplier adapter: kompas/azal/summertour/kazunion]
        │ raw supplierAmount (gross/net не различаются)
        ▼
SupplierPricingService.apply  ← MarkupRule resolver (единая граница)
        │ publicPrice = supplier + markup   (NO DOUBLE MARKUP)
        ▼
Catalog / Offer  ──►  Website (ProductCard / OfferModal / GuestCheckout)
        │                     │ price НЕ передаётся или как заявка + recheck
        ▼                     ▼
Request.productSnapshot   Request.commercialSnapshot (working)
        │        └── discount: applyIndividualDiscount (publicPrice не меняется)
        │                        └── validateForAcceptance: final >= supplier
        ▼
customerAccept → freezeForAcceptance (Gate F, customerAcceptedAt)
        ▼
convertRequestToOrder (status gate, CAS) → order.service.createOrderFromRequest
        │   money-gate: accepted >= supplier (snapshot basis)
        ▼
Order.commercialSnapshot (копия) + OrderItem(1) + traveler pin
        ├── Booking(orderItemId)      [fulfillment]
        ├── Payment(orderId)          [клиентские деньги, ≤1 активный]
        └── Settlement/Payout         [generic facts; supplier flow ОТСУТСТВУЕТ]
```

### Target (согласованная модель)

```text
Supplier Net Cost
   + TravelHUB Markup            (catalog — один раз)
   = Catalog Selling Price
              │
   ─ Live Sales: Catalog Price − Individual Discount (без % лимита) = Final
   ─ Non-catalog: Supplier Quote → Manager negotiated price (без 2-й наценки)
              ▼
REQUEST ── Service Builder: [N строк × (тип, партнёр, supplier cost,
          customer price, discount)] ── customer accepts
              ▼
ORDER ── N OrderItems (frozen per-line snapshot)
          ├── Bookings (per item)
          ├── Customer Payments
          └── Supplier Settlements (per supplier obligation)
   Прибыль = Σ customer − Σ supplier cost; Margin = Profit / Σ customer
```

---

## G. Profit Visibility

Менеджер **не видит** нигде (0 совпадений `grossProfit|grossMargin|прибыл`
в backend и frontend):

- supplier cost — только в JSON snapshot (backend), UI не показывает;
- customer price — ДА (`requests/[id]/page.tsx:306-310`, list page:556);
- discount — значение хранится (`discountAmount`), UI не показывает;
- expected gross profit — НЕ рассчитывается и не сохраняется;
- margin % — НЕ рассчитывается.

Все входные данные для расчёта уже есть в `CommercialSnapshot`
(`commercial-snapshot.ts:42-57`: supplierPrice, publicPrice, discountAmount,
customerFinalPrice) — расчёт тривиален, ничего хранить не обязательно.
Повторный расчёт при изменении скидки — произойдёт автоматически, если
панель читает snapshot. Заморозка при принятии — уже есть (Gate F).

---

## H. Critical Gaps

```text
P0 — blocks core business flow
  H1. Service Builder / мультисервисные строки отсутствуют (UI + Request/Order):
      сценарий D невозможен, сценарий C — только одна заявка без строк.
      Evidence: schema.prisma:2426,2435; order.service.ts:682-729; 0 UI hits.
  H2. UI индивидуальной скидки нет: бэкенд `POST :id/discount` готов, но
      менеджер не может применить скидку из интерфейса (curl-only).
      Evidence: request.controller.ts:243; 0 совпадений discount UI в *.tsx.

P1 — major functional gap
  H3. Supplier Settlement flow отсутствует (foundation generic, payee нет,
      supplier cost→settlement нет): schema.prisma:4853-4907;
      settlement.service.ts:139,189 — 0 доменных вызовов.
  H4. Supplier floor не применим для заявок без snapshot (manual/legacy):
      request.service.ts:690-694; schema.prisma:2424-2426.
  H5. Мёртвая website-точка входа «Помочь найти»: HelpFindButton.tsx:20 →
      0 backend-controller, тихий catch 36-37 (спрос теряется).
  H6. Supplier cost не вводится и не показывается (нет поля в Live Sales
      формах, нет gross/net decomposition — §12).
  H7. Прибыль/маржа не видимы (G).

P2 — important but non-blocking
  H8. Order.subtotal = сумма со скидкой, но discountAmount в Order не
      копируется — внутренняя несогласованность snapshot/итогов
      (order.service.ts:708-712).
  H9. Supplier identity в Order — только JSON snapshot, не колонка;
      OrderItem.productId не nullable (placeholder для product-less).
  H10. provenance: PriceSource = PUBLIC|LIVE_SALES, но LIVE_SALES никогда не
      выставляется (0 producer) — фактически один источник
      (commercial-snapshot.ts:36,136).
  H11. ProductType без INSURANCE/VISA/CAR_RENTAL/OTHER (schema.prisma:279-291).
  H12. partnerId в Request есть (schema:2388), из UI не отправляется
      (ManualCreateForm — 0 совпадений).

P3 — enhancement
  H13. supplierPriceExpiresAt хранится, но не revalidируется (freshness — запись,
       не контроль).
  H14. Quote/Sale домен не связан с Request-flow (возможный реиспользование
       мультисервисности — решение владельца).
```

---

## I. Risks / Contradictions

| Риск (чек-лист §I) | Вердикт | Evidence |
|---|---|---|
| Double markup | **Отсутствует** — одна граница apply(), snapshot валидирует `public=supplier+markup`, discount не трогает publicPrice | supplier-pricing.service.ts:94-121; commercial-snapshot.ts:111-115,149-166 |
| Supplier-cost ambiguity | **Присутствует** — raw scalar, gross/net поставщика не различаются; markup применяется к неопределённой базе | §12; supplier.types/adapter'ы (supplierAmount); commercial-snapshot.ts:42 |
| Missing Product support | **Частично** — заявка/заказ без Product работают, но service lines (продукт per line) отсутствуют | schema.prisma:2387; ManualCreateForm.tsx:272; m4 e2e PASS |
| Missing multi-supplier | **Присутствует** (см. H1) | schema.prisma:2426,2435 |
| Catalog price mutation | **Отсутствует** для индивидуального клиента (grantDiscount только snapshot); правка каталога — каталог-менеджмент, допустим | request.service.ts:724-730; pricing/markup UI |
| Supplier-floor bypass | **Присутствует** — заявки без snapshot обходят floor; discount для них невозможен (fallback: пересоздание заявки/подтверждённая цена без supplier basis) | H4; request.service.ts:690-694; schema.prisma:2424-2426 |
| Missing snapshot | **Присутствует** для manual/legacy заявок | туда же |
| Booking/payment mixing | **Отсутствует** — Booking = fulfillment (orderItemId), Payment отдельный (active-payment invariant) | schema.prisma:2526,4127-4188 |
| Duplicate entity risk | **Низкий** — новые сущности не нужны; риск повторить Quote-домен, если строить service lines с нуля; snapshot продублирован в Request+Order (терпимо, это и есть frozen truth) | schema.prisma:3652; §2 |
| Hidden discount restrictions | **Нет бизнес-скрытых ограничений**; существующие PERCENTAGE ≤100 / FIXED ≤ subtotal — числовые границы (flag на review владельцу, §14) | sales.money.ts:74-77,106 |

Существующее поведение для §14 review (не менять без решения):
`validateDiscountValue` PERCENT_MAX = 100 (математически избыточен — любой
процент >100 даёт отрицательную цену, которая и так отсекается floor'ом).

---

## J. Minimal Safe Implementation Scope (НЕ реализовывать в рамках аудита)

Предпочтительно расширять существующее, не создавать дубликаты:

1. **UI скидки (H2)**: кнопка/форма в RequestActionBar/`[id]` page →
   существующий `POST /requests/:id/discount` (server-authoritative floor уже
   есть; RBAC `sales.discount.grant` уже выдан менеджерским ролям).
2. **Панель прибыли (H7)**: чистый клиентский расчёт из полей
   `commercialSnapshot` (никаких сущностей/миграций).
3. **Партнёр в Live Sales (H12)**: поле partner select → существующая
   колонка `Request.partnerId` (schema:2388) + центральная директория Partner.
4. **Supplier cost / provenance (H6, H10)**: вход стоимости поставщика для
   non-catalog через pricing boundary в snapshot + `priceSource`
   (`"LIVE_SALES"` уже объявлен, но не выставляется) — без новых таблиц.
5. **Service lines (H1)**: решение владельца — (a) расширить Request
   `serviceLines Json[]` + N OrderItem (additive), или (b) реиспользовать
   Quote/QuoteItem sales-домена как существующий эквивалент §2. Новую
   сущность не заводить.
6. **Supplier Settlements (H3)**: расширить существующий `Settlement`
   (sourceType=ORDER/supplier provenance; payee-колонка уже сознательно не
   вводилась — комментарий schema:4881) вместо новой модели.
7. **Мёртвая точка входа (H5)**: перевести HelpFindButton на существующий
   публичный create-request путь (или добавить public-контроллер) + показ ошибки.
8. **Order-итоги (H8)**: копировать discountAmount в Order snapshot рядом с
   subtotal (тот же JSON, без миграции).
9. **ProductType (H11)**: additive enum-значения миграцией `migrate deploy`.

---

## K. Regression Plan

После любой реализации — обязательно:

1. Юнит: `commercial-snapshot.spec.ts` (floor, равенство, инварианты),
   `request-discount-grant.spec.ts`, `request-customer-accept.spec.ts`,
   `request.service.dto.spec.ts`, `pricing-markup-admin` spec.
2. E2E (serial, runInBand): `ui-c6-request-server-authority`,
   `d3-request-flow`, `m4-guest-checkout`, `pricing-markup-admin`,
   `request-discount-grant` — сегодня 50/50 PASS; после правок — тот же набор.
3. Новые целевые тесты: (a) discount из UI → 200/422 floor; (b) заявка без
   snapshot → явный отказ/гейт (H4); (c) HelpFindButton → Request создан;
   (d) partnerId из формы → сохранён; (e) для service lines — конверсия
   N строк → N OrderItem + Booking per item; (f) supplier settlement
   идемпотентность (sourceType+sourceId unique).
4. RBAC-проверка: `sales.discount.grant` не расширяется на
   `order.edit_noncritical` (контракт request.controller.ts:239-244).
5. §30/Gate-инварианты: NO DOUBLE MARKUP, money-gate, Gate F immutable,
   ≤1 активный Payment — не регрессировать.

---

## L. Final Verdict

```text
WHAT EXISTS
- Единственная граница наценки каталога (SupplierPricingService + MarkupRule
  + админка), инвариант public = supplier + markup, отсутствие double markup.
- Серверный индивидуальный скидок без процентных approval-порогов, floor
  final >= supplier cost (равенство разрешено), история + аудит,
  неизменность публичной цены.
- Commercial snapshot (working → freeze при принятии), freshness-метки,
  priceSource, markupRuleCode/Version (provenance в JSON).
- Полный конверсионный контур Request → Order (CAS, idempotency, money-gate,
  заморозка), отсутствие дублей сущностей при конвертации.
- Customer Payments ( Payment + PaymentHistory + active-invariant ), Booking
  per OrderItem, разделение booking/payment.
- Website entry: guest checkout, offer/tour request с серверным recheck,
  product-less заявки и заказы.
- Центральная Partner-директория; Quote/QuoteItem — существующая
  мультисервисная коммерческая сущность (вне Request-flow); generic
  Settlement/Payout foundation.

WHAT IS MISSING
- Service Builder (service lines в UI/Request/Order) — сценарий D невозможен.
- UI скидки и UI прибыли/маржи; supplier cost / partner ввод в Live Sales формах.
- Supplier Settlement flow (supplier obligation → settlement → payout).
- Supplier floor для заявок без snapshot; supplier cost gross/net decomposition.
- Живая website-точка «Помочь найти»; provenance LIVE_SALES;
  INSURANCE/VISA/CAR_RENTAL/OTHER типы услуг.

WHAT MUST CHANGE
- Добавить service lines, расширив существующие Request/Order/OrderItem или
  реиспользовав Quote (решение владельца) — новых сущностей не заводить.
- UI поверх готовых API: discount, profit-panel, partner select, supplier cost.
- Supplier settlement на базе существующего Settlement (provenance payee).
- Починить HelpFindButton; копировать discountAmount в Order snapshot.
- Закрыть обходы floor (H4): требовать snapshot/gate для non-snapshot заявок.

WHAT MUST NOT CHANGE
- Единственная граница наценки и инвариант public = supplier + markup.
- Floor `final >= supplier cost` без процентных approval-порогов
  (PERCENTAGE ≤100 — числовая граница, не бизнес-лимит — без решения
  владельца не трогать).
- Неизменность публичной цены при индивидуальной скидке.
- Gate F (принятые деньги иммутабельны), money-gate конверсии, idempotency,
  409 re-convert, CAS.
- Разделение Booking (fulfillment) / Payment (деньги) / Order (правда).
- §10/§6.21: слабые 403-owner-rule, чужие workstream'ы, stash-бейзлайны,
  `prisma migrate deploy` как единственный путь миграций.
```

---

## §24 FINAL SAFETY CHECK

```text
Production code changed: NO
Schema changed: NO
Database data changed: NO   (обращения к БД в аудите — только SELECT из
                             предыдущих сессий; в этой сессии — не обращался)
Tests changed: NO
Migration created: NO
Commit created: NO
Push performed: NO
```

Контроль git: HEAD `75c6bea` (не менялся), staged 0, dirty 117 → 118
(+1 — сам этот отчёт, untracked). Изменения 116 → 117 до начала аудита —
untracked-файл промпта аудита (создан владельцем после soft-E2E снапшота);
за 3 часа до аудита ни один tracked-файл не изменялся (проверено по mtime).
