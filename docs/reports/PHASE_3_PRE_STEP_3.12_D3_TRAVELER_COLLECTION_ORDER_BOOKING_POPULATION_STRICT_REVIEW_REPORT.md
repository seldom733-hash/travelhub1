# PHASE 3 — PRE-STEP 3.12 — D3 — TRAVELER COLLECTION + ORDER/BOOKING POPULATION — STRICT REVIEW REPORT

---

## 1. Executive Summary

Независимый Strict Review D3 по цепочке `CANONICAL CONTRACT → CODE → DB → API → UI → RUNTIME → EVENT FLOW`.

**Главный вывод:** реализация D3 содержала **неразрешённое lifecycle-противоречие** с замороженным D1-контрактом и три блокирующих P1-дефекта:

| ID | Severity | Суть | Статус после Remediation |
|---|---|---|---|
| F1 | **P1** | Order создаётся ДО final confirmation (D1-DEC-07/§14.3: «Order = committed, final confirmation prerequisite») | **Option B реконсилировано** (SR R4): Order = durable commerce root принятого кейса; Booking жёстко заблокирован до finalConfirmedAt (SR R3). Канонический контракт и roadmap обновлены |
| F2 | **P1** | `termsAcceptedAt` = synthetic `new Date()` в consumer-е (processing time), НЕ реальный acceptance event | **Исправлено** (SR R1): `termsAcceptedAt = Sale.completedAt` (acceptance instant), frozen в OrderRequested payload; e2e test 10 (ms-равенство) |
| F3 | **P1** | Pin-race: consumer перечитывал mutable `Product.travelerRequirements` на T3 (после acceptance) — snapshot мог быть B вместо A | **Исправлено** (SR R2): requirements PINNED в момент acceptance (Sale completion, та же транзакция) и доставляются в payload; canonical path НЕ читает Product на T3 |
| F4 | **P1** | Booking мог начаться ДО final confirmation (send → BookingRequested без гейта) | **Исправлено** (SR R3): `confirm`/`send` требуют `finalConfirmedAt` для traveler-bearing Order (travelerCount>0); e2e test 9 + browser Scenario D |
| F5 | **P2** | Порядок OrderTraveler недетерминирован (уже исправлено в D3 impl: `position`) | PASS (подтверждено в SR) |
| F6 | **P1 (gate FAIL)** | **Request flow НЕ интегрирован с D3**: `Request.customerAccept` (CUSTOMER_ACCEPTED + `customerAcceptedAt`) существует, но конверсия `convertToOrder` НЕ подключена ни к одному вызывающему коду; реального E2E «Request → acceptance → pin → travelers → final confirm → Order → convertedAt» нет | **NOT IMPLEMENTED** (строгий gate §9/§30 → VERDICT B) |

Регрессия: **ноль** новых падений (сравнение failure-сетов на baseline `7b73732` vs текущий код — идентичны для 5 e2e-суит и 4 unit-суит).

Runtime-подтверждение: backend e2e `d3-traveler-collection` — **10/10 PASS** (включая новые SR-тесты 9/10); frontend component — **8/8**; browser runtime — **50/50 PASS** (включая SR Scenario D: Order в registry до final confirmation, Booking заблокирован).

```text
VERDICT B — D3 TRAVELER COLLECTION + ORDER/BOOKING POPULATION
STRICT REVIEW FAILED — REMEDIATION REQUIRED
(блокирующие lifecycle/security гейты исправлены; Request-flow gate остаётся
NOT IMPLEMENTED → TRUE NEXT: D3 REMEDIATION / EVIDENCE CLOSURE)
```

---

## 2. Starting Git State

```text
branch:             master
Starting SHA (SR):  eba53bb88dda2da5613b667aadbb1b4a1165fd98  (D3 impl + docs, pushed)
origin/master:      eba53bb88dda2da5613b667aadbb1b4a1165fd98
Baseline D3 impl:   7b73732ddb413120c69c743ce19a242900db3292
Working tree:       untracked evidence (tmp_*) + tracked deletion D2-отчёта + ' M' D1A-отчёта
                    (артефакты предыдущих фаз)
```

---

## 3. Canonical D1/D2 Contract

Принятый baseline (D1 finalization report + `docs/architecture/COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md`):

```text
Request flow (non-authoritative):
  Request → supplier response/current terms → customer acceptance (termsAcceptedAt)
  → traveler collection (requirements pinned at termsAcceptedAt)
  → final confirmation (finalConfirmedAt)
  → Request conversion → Order created (convertedAt ≈ Order.createdAt)
  → Booking (BookingRequested)

No-Request flow (authoritative): Product → terms → pin → travelers → final confirm → Order → Booking

D1-DEC-07:  Order creation requires final confirmation + required traveler data
D1-DEC-02:  traveler collection after acceptance, BEFORE Order
D1-DEC-03:  requirements pinned at termsAcceptedAt (prevents dynamic form changes)
D2:         NOT_REQUESTED / OPTIONAL / REQUIRED; effective = defaults + override
```

---

## 4. Current D3 Lifecycle Reconstruction (по коду/runtime)

```text
Quote → CheckoutIntent (travelers/terms/date) → Sale (OPEN)
→ Sale complete (acceptance):
     Sale → CLOSED, completedAt = now
     OrderRequested payload: frozen commercial snapshot + productType + (SR R1/R2)
       acceptedAt + pinnedRequirements
→ OrderRequestedConsumer → OrderService.createOrderFromRequested:
     Order (NEW) + OrderItem[] + OrderTraveler[] (position 1..N, INCOMPLETE)
       + termsAcceptedAt (SR R1: payload.acceptedAt) + pinnedRequirements (SR R2: payload)
     → OrderCreated (event)
→ Traveler collection: PATCH /orders/:id/travelers/:travelerId (по pinned snapshot)
→ POST /validate-completion → travelerDataCompletedAt (server-owned, CAS)
→ POST /orders/:id/final-confirm → finalConfirmedAt (idempotent, 409 на повтор)
→ lifecycle: process (IN_PROCESSING) → confirm (READY_FOR_BOOKING) → send
     (BookingRequested) — SR R3: confirm/send требуют finalConfirmedAt (travelerCount>0)
→ Booking → Passenger (из confirmed OrderTraveler, passportExpiry включён)
```

---

## 5. D1 vs D3 Lifecycle Diff

| Аспект | D1 canonical | D3 impl (до SR) | Diff |
|---|---|---|---|
| Момент создания Order | после final confirmation | при OrderRequested (до final confirm) | **противоречие** (D1-DEC-07) |
| Traveler collection point | до Order | под Order (OrderTraveler) | **противоречие** (D1-DEC-02) |
| termsAcceptedAt | реальное acceptance | synthetic now в consumer | **нарушение** (SR R1) |
| Pin timing | в момент acceptance | на T3 (consumer, mutable Product) | **race** (SR R2) |
| Booking eligibility | только после final confirm | send возможен без final confirm | **нарушение** (SR R3) |
| OrderTraveler semantics | immutable snapshot при создании | mutable draft до final confirm | требует явной семантики (SR §14.3A/§15.1) |
| Request flow | acceptance → travelers → confirm → Order → convertedAt | REQ-* acceptance есть; конверсия не подключена | **NOT IMPLEMENTED** |

---

## 6. termsAcceptedAt Semantics

До SR: `createOrderFromRequested` писал `termsAcceptedAt: new Date()` — processing time consumer-а, не business event timestamp.

**Remediation (SR R1):**
- `sales-completion.service.ts` (момент acceptance, та же транзакция `Sale → CLOSED` + `completedAt`): в `OrderRequestedPayload` добавлен `acceptedAt` (= `now.toISOString()`, тот же instant, что `Sale.completedAt`);
- consumer: `termsAcceptedAt = new Date(payload.acceptedAt)` (fallback `now()` только для legacy payload до R1);
- `OrderRequestedPayload.acceptedAt` — additive, v1-совместимый, PII-free.

**Evidence:** e2e test 10 — `Order.termsAcceptedAt.getTime() === Sale.completedAt.getTime() === completed.completedAt`; DB: `termsAcceptedAt` и `finalConfirmedAt` ≠ (разные события, `final > terms`).

---

## 7. Pin Timing / Race Analysis

До SR: consumer на T3 делал `tx.product.findUnique` (mutable Catalog) и вычислял effective requirements — если Product менялся между T1 (acceptance) и T3, принятый checkout получал политику B. Тест «Product changed after Order created» этот window не закрывал.

**Remediation (SR R2):**
- `sales-completion.service.ts`: в момент acceptance (та же транзакция) читаются `Product.type/travelerRequirements`, вычисляется `getEffectiveTravelerRequirements(...)` и **frozen snapshot кладётся в OrderRequested payload**;
- consumer: `isFullRequirementsMap(payload.pinnedRequirements)` → использует payload; mutable Product на T3 НЕ читается (canonical path);
- legacy payload (до R1/R2, без snapshot): transitional fallback как раньше (документирован, только для старых событий);
- replay детерминирован (payload immutable).

**Evidence:** e2e test 2 (immutability после создания), test 10 (snapshot в payload = pinned на Order), `pinnedRequirements` в payload — snapshot-at-event (тот же паттерн, что commissionSnapshot/sellerPartnerId).

---

## 8. Pre-Order Accepted State Ownership

Audit: `CheckoutIntent` (Sales, immutable после completion — `assertCheckoutNotCompleted`), `Sale` (CLOSED, completedAt, frozen snapshot), `OrderRequestedPayload` (frozen commercial snapshot). Pre-Order сущности **не хранят traveler requirements** (подтверждено по schema: `CheckoutIntentTraveler` несёт только firstName/lastName/birthDate).

**Решение (Option B, SR §14.3A):** требования PINNED в payload в момент acceptance (это и есть canonical owner момента), затем копируются в Order domain (durable). `termsAcceptedAt`/`pinnedRequirements`/`travelerCount` живут на Order как server-owned immutable факты; клиент не может их заменить (нет API-пути).

---

## 9. Order Creation Semantics

- Order создаётся consumer-ом при accepted checkout — это **durable commerce root** принятого кейса (snapshot frozen), НЕ draft и НЕ provisional в смысле «можно отбросить»: коммерческие факты (amount/currency/paymentTerms/items/pinned/travelerCount/reservations) immutable.
- До final confirmation Order: `NEW` (или `IN_PROCESSING` после `process`), НЕ booking-eligible, НЕ fulfillable (SR R3 гейты).
- Conversion (коммерческое обязательство к booking) = `finalConfirmedAt`; `Order.status` → `READY_FOR_BOOKING` только после гейта.
- Buyer-direct flows (D1 §§14.2/14.3) остаются каноном; platform-assisted flow реконсилирован §14.3A контракта.

---

## 10. OrderTraveler Semantics

Контракт (SR §15.1):
- создаётся при Order (party list из CheckoutIntentTraveler, `position` 1..N — детерминированный порядок);
- до final confirmation — собираемые данные (draft-level) под pinned snapshot (server-validated поля, NOT_REQUESTED не хранятся);
- `finalConfirmedAt` → confirmed/immutable snapshot (мутации после → 409);
- Passenger читает ТОЛЬКО confirmed snapshot.
- Legacy `position=0`: fallback порядок по id (в dev/test строк с position=0 нет).

---

## 11. Traveler Count

- Источник: `CheckoutIntentTraveler` (canonical party list), заморожен при acceptance (checkout immutable после completion — Step 2.4 assert);
- `Order.travelerCount = travelers.length` (consumer; read-only immutable контекст) и продублирован в payload (SR R2) — count не выводится из Passenger/форм;
- Evidence: e2e test 1 (count=1), test 4 (count=2), browser (2/2/2: count = OrderTraveler = Passenger).

---

## 12. Completion Semantics

- `travelerDataCompletedAt` ставится сервером при успешной validate-completion (одна CAS-запись, не перезаписывается);
- stale-защита: очистка REQUIRED поля после completion → 422 (PATCH блокирует clear REQUIRED); повторная validate после неполноты → `complete=false` (timestamp семантически корректен);
- Product mutation не влияет (валидация против pinned snapshot, не mutable policy);
- `updatedAt` не используется как business timestamp.

---

## 13. Final Confirmation State Machine

- `POST /orders/:id/final-confirm` (`order.edit_noncritical`): gates — termsAcceptedAt, pinned, count, все REQUIRED валидны, travelerDataCompletedAt установлен;
- success → `finalConfirmedAt`; повтор → 409; мутации после → 409; один `orderHistory` milestone `final_confirm`;
- (SR R3) `confirm`/`send` требуют finalConfirmedAt для traveler-bearing Order → READY_FOR_BOOKING/BookingRequested недостижимы до final confirmation;
- Event flow: `confirm` → OrderReadyForBooking; `send` → BookingRequested (PII-min payload); Booking consumer → Booking + Passenger.

---

## 14. Request Flow Verification

- Существующие возможности: `Request` (REQ-*), supplier actions (confirm-price/propose/reject/unavailable), `customer-accept` → `CUSTOMER_ACCEPTED` + `customerAcceptedAt` (реальный acceptance факт), `Request.convertedAt`/`convertedOrderId` поля, `convertToOrder(requestId, orderId)` — **сервис-метод без единого вызывающего в app-коде** (grep по src: только определение);
- Полноценного E2E «Request → supplier response → acceptance → pin → travelers → final confirmation → Order → convertedAt/convertedOrderId» **НЕТ**;
- `OrderRequested` эмитится только `sales-completion` (sales chain); Request-цепочка до Order не интегрирована;
- **Gate §9: FAIL / NOT IMPLEMENTED** (не закрывается no-Request тестом).

---

## 15. No-Request Flow Verification

- Authoritative no-Request flow подтверждён E2E: D3 spec test 7 (canonical sales chain, Request.convertedOrderId отсутствует), browser Scenario A–D (принятый checkout → Order без Request → collection → final confirm → Booking).
- Сохранён без fake Request.

---

## 16. Booking Eligibility

До SR: `send` (BookingRequested) не требовал finalConfirmedAt.

**Remediation (SR R3):** в `orderAction` для traveler-bearing D3 Order (`travelerCount > 0` и `termsAcceptedAt != null`) `confirm`/`send` отклоняются (ValidationDomainError 422), пока `finalConfirmedAt` не установлен. Legacy Orders (termsAcceptedAt null — 1000 seeded) и orders без travelers (count 0 — существующие lifecycle-спеки) сохраняют прежний lifecycle.

**Evidence:** e2e test 9 (process 200 → confirm 422 → send 409 → 0 Booking/BookingRequested → final-confirm → confirm 200 → send 200 → 1 Booking); browser Scenario D (те же коды + registry NEW).

---

## 17. Passenger Population

- `booking.subscribers.ts` читает confirmed `OrderTraveler` (READ-only, по orderId) и пишет Passenger: firstName/lastName/birthDate + citizenship/gender/passportNumber/passportExpiry (passportExpiry включён — D3 fix);
- Нет Customer fallback, нет mutable Product lookup;
- Evidence: e2e test 4 — 1 Booking, ровно 2 Passenger, значения = confirmed OrderTraveler.

---

## 18. Customer ≠ Payer ≠ Traveler

- Customer НЕ копируется в Traveler автоматически; payer не считается traveler; `customerId` не fallback для отсутствующей traveler-идентичности;
- Traveler создаётся из CheckoutIntentTraveler (party list); prefill «я турист» — deferred (не введён, что допустимо).

---

## 19. Authorization / Tenant Isolation

- **PARTNER**: у роли нет `order.*`/`booking.*` (permissions.constants, комментарий: эти права открывают ЧУЖИЕ данные). Blanket-deny на Order Center = **канонический object-scope дизайн** (partner работает через own-scope endpoints: `catalog.product.*_own`, partner workspace; storefront данные — sales chain). Чужой PARTNER → 403 (e2e test 6).
- **Platform**: OPERATOR/ADMIN — полный доступ к traveler PII (операционная роль); SALES_MANAGER — GET 200 c redacted PII, мутации 403 (нет `order.edit_noncritical`); BUYER → 403 (нет `order.*`).
- D4 углубляет privacy/security; D3 не вводит cross-tenant/broad-role PII leakage (PASS).

---

## 20. PII Review

- PII-поля: birthDate/passportNumber/passportExpiry/citizenship/gender — redaction по viewer в `GET /orders/:id/travelers` (тот же контракт listOrders/getOrder);
- NOT_REQUESTED чувствительные поля не запрашиваются/не хранятся (минимизация §9; e2e test 3 — PATCH citizenship/passportNumber на TOUR → строки остаются null);
- BookingRequested payload PII-min (только orderId/orderCode/customerId); OrderRequested payload PII-free;
- Validation errors не echo-ят чувствительные значения (reason: имена полей/туристов);
- Логи/outbox не содержат паспортных данных.

---

## 21. Browser Runtime

Playwright (headless Chromium, RU, live dev-стек :3000/:4000, canonical seeded order count=2). **50/50 PASS**, скриншоты в `docs/evidence/d3/`:

| Файл | Сценарий |
|---|---|
| `tmp_d3_browser_1_initial.png` | панель: 2 карточки, REQUIRED/OPTIONAL, citizenship скрыт (NOT_REQUESTED), milestones |
| `tmp_d3_browser_2_saved.png` | partial save → notice, badge «Заполнено» |
| `tmp_d3_browser_3_resume.png` | после reload: значения сохранены (save→refresh→resume) |
| `tmp_d3_browser_4_registry_preconfirm.png` | SR-D: Order в registry (NEW) ДО final confirmation; send 409 / confirm 422 (gate) |
| `tmp_d3_browser_5_gate_denied.png` | failure path: incomplete → «Финальное подтверждение отклонено: …missing: gender (…)» |
| `tmp_d3_browser_6_final_locked.png` | success path: final confirm → locked UI, milestones, disabled inputs |

---

## 22. DB/API/UI/Event Reconciliation

Один канонический кейс (browser evidence order):

```text
pinnedRequirements (payload@acceptance) = Order.pinnedRequirements = API view = UI поля
travelerCount 2 = OrderTraveler rows 2 = UI «Турист 1/2 из 2» = Passenger 2 (после send)
termsAcceptedAt = Sale.completedAt (момент acceptance)
travelerDataCompletedAt < finalConfirmedAt (server milestones)
BookingRequested/Booking — только после finalConfirmedAt (e2e test 9, SR-D)
```

Никакой противоречивой хронологии.

---

## 23. Regression Requalification

Независимая проверка (worktree на baseline `7b73732` = D3 impl, тот же e2e-харнесс):

| Суиты | Baseline (7b73732) | Current (SR) | Вывод |
|---|---|---|---|
| booking-lifecycle-completion | 1 fail (availability isolation) | 1 fail (идентичный title) | нет регрессии |
| reverse-conversion, sale-completion-order-requested, order-temporal-contract, order-canonical-events | 58 fail (идентичный set) | 58 fail (идентичный set) | нет регрессии |
| unit: analytics/finance-payment/finance-refund/sales service | 25 fail / 63 pass | те же 4 суиты | нет регрессии (pre-existing; на HEAD c05af07 подтверждено ранее в сессии git stash-сравнением) |

Все failure-сеты идентичны по названиям тестов (diff пустой) — D3 impl и SR-ремедиации не добавили падений; падения pre-existing (stale спеки: продукт требует Partner-owner 3.6B и пр.).

---

## 24. Git/Worktree Closure

- Tracked deletion `docs/reports/…D2_PRODUCT_TRAVELER_REQUIREMENTS.md` — intentional rename cleanup (renamed report в history) → закоммичена как docs-deletion;
- `' M' docs/reports/…D1A_FINAL_EVIDENCE_CLOSURE_REPORT.md` — тривиальное обновление SHA (5c74792→98c799f) → закоммичено;
- D3-SR evidence: 6 скриншотов → `docs/evidence/d3/` (committed); мои tmp-скрипты/state удалены;
- Остаются untracked-артефакты ПРЕДЫДУЩИХ фаз (tmp_*.png и пр. — не относятся к D3/SR; задокументированы);
- финал: push SUCCESS, HEAD == origin/master (см. §27).

---

## 25. Findings Matrix

| ID | Severity | Finding | Evidence | Root Cause | Required Action | Result |
|---|---|---|---|---|---|---|
| F1 | P1 | Order создаётся до final confirmation (D1-DEC-07 violation) | consumer/orderService; D1 report §4 | Step 2.5/2.6 accepted OrderRequested→Order vs D1 order-after-confirm | Option B формальная реконсиляция + docs/roadmap sync | DONE (SR R4, §14.3A/§15.1, roadmap) |
| F2 | P1 | termsAcceptedAt = synthetic now (processing time) | orderService:351 (до SR) | отсутствовал upstream acceptance timestamp в payload | R1: payload.acceptedAt = Sale.completedAt | DONE (test 10, ms-равенство) |
| F3 | P1 | Pin-race (Product читается на T3) | consumer product.findUnique (до SR) | pin не в момент acceptance | R2: snapshot в payload при completion | DONE (payload pinned; canonical path без Product read) |
| F4 | P1 | Booking до final confirmation возможен | orderAction send без gate | отдельный D3-гейт отсутствовал | R3: confirm/send gate на finalConfirmedAt (travelerCount>0) | DONE (test 9, browser SR-D) |
| F5 | P2 | Недетерминированный порядок OrderTraveler | (найдено в D3 impl evidence) | нет ordinal/createdAt | position + orderBy | DONE (D3 impl) |
| F6 | P1 (gate) | Request flow НЕ интегрирован (convertToOrder без вызывающих; нет real Request E2E) | grep convertToOrder; request.service | Request automation deferred (D1 gap matrix); D3 не покрыл | D3 REMEDIATION / EVIDENCE CLOSURE | **OPEN → VERDICT B** |
| F7 | P3 | Dev-сид Order с createdAt в будущем + acquisitionSource default MARKETPLACE (registry sort) | dev DB | seed-инструмент | — (зарегистрировано; не D3) | OPEN (P3) |

---

## 26. Remediation Performed

- **SR R1 (F2)**: `acceptedAt` в `OrderRequestedPayload` (additive, v1) ← `Sale.completedAt`; consumer/`createOrderFromRequested` используют его как `termsAcceptedAt` (fallback now для legacy);
- **SR R2 (F3)**: `pinnedRequirements` computed в `sales-completion` (та же tx acceptance) и доставляется в payload; consumer `isFullRequirementsMap(payload)` → canonical path без Product read на T3; legacy fallback сохранён (только для payload до R1/R2);
- **SR R3 (F4)**: `orderAction` — гейты confirm/send для `travelerCount>0 && termsAcceptedAt` без `finalConfirmedAt` → 422; legacy/count-0 не затронуты;
- **SR R4 (F1)**: `docs/architecture/COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md` §14.3A + §15.1 amendment; roadmap v3: D3 status + D3-SR row;
- **Тесты**: D3 e2e + test 9 (Booking eligibility), test 10 (termsAcceptedAt = acceptance); browser Scenario D.

---

## 27. Canonical Architecture/Roadmap Sync

- `COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md` — новая секция **14.3A** (platform-assisted flow: Order = commerce root; final confirmation = гейт Booking; termsAcceptedAt/pin реальные) и уточнённая **15.1** (OrderTraveler draft→confirmed);
- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` — D3: «◐ IMPLEMENTED — SR B: remediation (R1–R4) applied; Request-flow E2E open» + строка D3-SR в debt-таблице;
- Итоговый Git state (после commit/push):

```text
Final SHA (SR commit):  f1ad2bf96f96438d87ce91a54bf3dea16bc6797b
origin/master:          f1ad2bf96f96438d87ce91a54bf3dea16bc6797b
HEAD == origin/master:  YES ✅ (push SUCCESS)
```

---

## 28. Acceptance Matrix

| Gate | Result | Evidence |
|---|---|---|
| D1 lifecycle reconstructed | PASS | §3; D1 report |
| Current D3 lifecycle reconstructed | PASS | §4 (code trace) |
| D1 vs D3 contradiction resolved | PASS | §5/§9/§27 (Option B, §14.3A) |
| termsAcceptedAt = real acceptance event | PASS | §6, e2e test 10 (ms == Sale.completedAt) |
| Requirements pinned at actual acceptance | PASS | §7, payload snapshot; test 2/10 |
| Acceptance→pin race impossible | PASS | §7 (canonical path без Product read на T3) |
| Pre-Order accepted state canonical owner | PASS | §8 (payload frozen; immutable checkout) |
| Order creation timing canonical | PASS | §9 (Option B reconciled + docs synced) |
| OrderTraveler semantics canonical | PASS | §10/§27 (§15.1) |
| Traveler count frozen correctly | PASS | §11 |
| Multi-traveler stable | PASS | §10 (position); browser 2 карточки |
| REQUIRED/OPTIONAL/NOT_REQUESTED correct | PASS | D3 impl; e2e test 3; browser |
| travelerDataCompletedAt never stale | PASS | §12 (clear REQUIRED → 422; CAS) |
| finalConfirmedAt transition canonical | PASS | §13 (gates + 409 idempotency) |
| Real Request flow E2E | **FAIL** | §14 (convertToOrder unwired; no E2E) |
| Request convertedAt timing | **FAIL** | §14 (нет конверсии) |
| No-Request flow E2E | PASS | §15; e2e test 7; browser |
| Booking impossible before final confirmation | PASS | §16 (test 9; SR-D: 409/422, 0 Booking) |
| Passenger from final traveler snapshot | PASS | §17 (test 4; passportExpiry) |
| Customer ≠ Payer ≠ Traveler | PASS | §18 |
| Owning Partner access correct | PASS | §19 (own-scope endpoints; platform Order Center) |
| Foreign Partner denied | PASS | §19 (e2e test 6: 403) |
| Platform permissions correct | PASS | §19 (OPERATOR full / SALES_MANAGER redacted / BUYER 403) |
| PII safe/redacted | PASS | §20 |
| Browser failure path | PASS | §21 (5_gate_denied) |
| Browser save→reload→resume | PASS | §21 (2/3) |
| Browser success path | PASS | §21 (6_final_locked) |
| DB/API/UI/Event reconciliation | PASS | §22 |
| Concurrent/retry idempotency | PASS | D3 impl (e2e test 5/8; 409; unique) |
| Regression baseline independently verified | PASS | §23 (идентичные failure-сеты) |
| Canonical docs synced if changed | PASS | §27 |
| Roadmap synced | PASS | §27 |
| HEAD == origin/master | PASS (после push) | §27 |
| Working tree clean | PARTIAL | §24 (D3/SR артефакты закрыты; pre-existing untracked предыдущих фаз задокументированы) |
| Russian report | PASS | этот отчёт |

---

## 29. Residual Risks

- **Request flow (REQ-*)** остаётся NOT IMPLEMENTED (convertToOrder unwired) — главный открытый gate (D3 REMEDIATION);
- Buyer-direct flows (D1 §§14.2/14.3) не имеют отдельного E2E-подтверждения (platform-assisted покрыт);
- `position=0` legacy OrderTraveler (строк нет; fallback по id);
- Dev-сид: createdAt в будущем + default acquisitionSource MARKETPLACE (registry-сортировка) — зарегистрировано P3;
- 4 unit-суиты + ряд e2e-суит — pre-existing stale на baseline (не D3/SR);
- Untracked-артефакты предыдущих фаз в рабочей копии (не D3/SR).

---

## 30. Final Verdict

```text
VERDICT B — D3 TRAVELER COLLECTION + ORDER/BOOKING POPULATION
STRICT REVIEW FAILED — REMEDIATION REQUIRED
```

Блокирующие lifecycle/security дефекты (F2–F4) исправлены и подтверждены runtime; lifecycle-противоречие (F1) формально реконсилировано (Option B, docs synced). Остаётся открытым **Request-flow gate (F6, §9/§14)** — реальный Request E2E с конверсией и convertedAt НЕ реализован → VERDICT A невозможен.

---

## 31. TRUE NEXT

```text
D3 REMEDIATION / EVIDENCE CLOSURE
  — Request flow integration (convertToOrder wiring: acceptance → pin → travelers
    → final confirmation → Order → convertedAt/convertedOrderId) + real Request E2E

D4 NOT STARTED.
```

---

**STOP.**