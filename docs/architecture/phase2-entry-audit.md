# TravelHub — PHASE 2 ENTRY AUDIT (Step 2.0)

Дата: 2026-08-10. Статус: **PASS WITH STEP-LOCAL PREREQUISITES** (вердикт в конце).
Источник истины — фактический repository state + isolated runtime probes
(предыдущие отчёты — reference, не proof). Audit, не implementation: Phase 2
не начинался.

---

## 1. Current → Phase 2 target map (§4)

| Concern | Phase 1 current | Phase 2 expected owner | Ready? | Gap | Blocking? |
|---|---|---|---|---|---|
| Buyer identity | `security.User(role=BUYER) → customerId → crm.Customer`; own-scope | Security/CRM | ✅ | — | НЕТ |
| Customer | `crm.Customer` + history + events | CRM | ✅ | — | НЕТ |
| Partner | `User.partnerId → crm.Partner` (no entity-time) | CRM | ✅ (via events) | entity-time columns | НЕТ |
| Supplier | `crm.Supplier` (SUP-*, status, name) | CRM | ⚠️ FOUNDATION | нет lifecycle/контактов/валидации | НЕТ (prerequisite) |
| Product | `catalog.Product` + draft/history/moderation/media | Catalog | ✅ | — | НЕТ |
| Product publication | `ProductPublicationChannel` (MARKETPLACE/PARTNER_STOREFRONT) | Catalog | ✅ current-state; historical per-day — future | channel history | НЕТ |
| Marketplace | public catalog + behavioral (1.13B) | Catalog | ✅ | — | НЕТ |
| Storefront | lifecycle/entitlement/channels/behavioral (1.12.x) | Catalog (+ future Billing) | ✅ | billing — future | НЕТ |
| Order | `order.Order` foundation + canonical events (1.14) | Order (Phase 2) | ⚠️ FOUNDATION | milestone-колонки; checkout-команды | НЕТ (prerequisite для 2.4+) |
| Booking | `booking.Booking` foundation + events + Inbox dedup | Booking (Phase 2) | ⚠️ FOUNDATION | request/confirm timestamps, IANA | НЕТ (prerequisite для 2.8+) |
| Payment | **НЕТ entity/PSP/intent/ledger**; `Order.paymentStatus/paidAmount` | Finance (2.10C/2.12) | ⚠️ ABSENT (честно) | полный domain | НЕТ (prerequisite для 2.10+) |
| Communication | `communication.Communication` + ADR-0011 | Communication | ✅ | retention | НЕТ |
| Documents | нет domain; Buyer Cabinet controlled empty | Documents (Phase 3) | ✅ (absence честна) | domain | НЕТ |
| Support | нет domain; controlled empty | Support (Phase 3) | ✅ (absence честна) | domain | НЕТ |
| Behavioral analytics | `*BehavioralEvent` (1.12.3/1.13B), dedup, no PII | Catalog/Behavioral | ✅ | retention | НЕТ |
| AuditLog | `security.AuditLog` (action/resource/actor/createdAt) | Security | ✅ | retention | НЕТ |
| Outbox/Inbox | events.* durable + dedup | Events | ✅ | FAILED retry (2.17) | НЕТ (PASS-DEFERRED) |
| Correlation | requestId/correlationId/causationId (1.15/1.15A) | Events/Security | ✅ | — | НЕТ |
| Temporal history | lifecycle columns + `*_history` + events (1.13A/1.18A) | per-domain | ✅ | см. §24 | НЕТ |

## 2. Bounded-context map (§5)

| Context | Owner schema | Entities | Writes | Events produced | Events consumed | Cross-refs (без FK) |
|---|---|---|---|---|---|---|
| Catalog | `catalog.*` | Product/Draft/Media/Tariff/Availability/Category/CategorySchema/ModerationSubmission/PublicSellerProfile/Proposal/PartnerStorefront/StorefrontMedia/ProductPublicationChannel/BehavioralEvents | свой контур | ProductCreated/Published/Archived, PartnerCreated→profile projection, (behavioral — не outbox) | PartnerCreated, PartnerApproved | partnerId, sellerId (CRM refs) |
| CRM | `crm.*` | Customer/Contact/Company/Partner/Supplier | свой контур | CustomerCreated/Updated, PartnerCreated | — | userId (security ref) |
| Security/Auth | `security.*` | User/Role/Permission/PartnerApplication/PartnerApplicationHistory/AuditLog | свой контур | (audit только), PartnerApproved? | CustomerCreated (link при регистрации — ADR-0003) | customerId/partnerId (refs) |
| Order | `order.*` | Order/OrderItem/OrderTraveler/Fulfillment/OrderHistory | свой контур | OrderCreated/StatusChanged/ReadyForBooking/Fulfilled/Closed | BookingConfirmed (reconcile) | customerId/productId (refs) |
| Booking | `booking.*` | Booking/Reservation/SupplierConfirmation/Passenger/BookingHistory | свой контур | BookingCreated/Requested/Confirmed/Rejected/Cancelled/StatusChanged | OrderReadyForBooking (consumer) | orderId/productId/supplierId (refs) |
| Communication | `communication.*` | Communication | свой контур | — (не event bus) | — | contextType+contextId (typed refs) |
| Events | `events.*` | OutboxEvent/InboxEvent/BusinessSequence | свой контур | — (транспорт) | все | — |

**Future chain feasibility:** Marketplace/Storefront → commercial intent → Order →
Booking → Payment добавляется в существующие границы: Order/Booking уже имеют
canonical события, Inbox dedup, correlation; Payment создаётся как новый
bounded context (Finance) без конфликтов ownership. Никаких cross-schema FK —
только typed refs (ADR-0001) — Phase 2 наследует это.

## 3. Legacy vs canonical classification (§6)

| Entity | Class | Почему |
|---|---|---|
| Order | **TRANSITIONAL** | foundation + canonical events (1.14), но checkout-команды и milestone-колонки — Phase 2; `/orders/bootstrap` — временный ADMIN/import (Phase 2 §4 removal) |
| Booking | **TRANSITIONAL** | foundation + события + dedup, но request/confirm/cancel timestamps и IANA — Phase 2 |
| paymentStatus/paidAmount | **PLACEHOLDER** | представление на Order; НЕ canonical Payment domain; NO fake ledger |
| Supplier | **FOUNDATION** | сущность есть (SUP-*), lifecycle/контракты не развиты — Phase 2 prerequisite |
| Communication | **CANONICAL** | ADR-0011, bounded context, typed refs, NOTE/INTERNAL privacy |
| Customer | **CANONICAL** | CRM owner, history, events, unique email |
| Partner | **CANONICAL** (identity) | create-or-link deterministic, уникальные ключи; entity-time — future |
| Product | **CANONICAL** | один источник истины, draft N+1, moderation, history |
| Payment/Refund/Settlement/Payout | **NOT IMPLEMENTED** | отсутствуют (см. §14) |

**Наличие таблиц Order/Booking НЕ означает canonical Phase 2 lifecycle** — они
классифицированы TRANSITIONAL, Phase 2 строит на их событиях, не на legacy
assumptions.

## 4. Order entry boundary (§7)

- Создание: ADMIN-only `POST /orders/bootstrap` (`order.import`) — временный
  Phase 1 exception (задокументирован к удалению в Phase 2 §4). Проверено: BUYER/
  PARTNER не имеют `order.import`.
- Canonical: `order.Order` + `OrderHistory` + события OrderCreated/
  ReadyForBooking/Fulfilled/Closed (1.14) — атомарны с переходом (state+history+
  outbox в одной tx).
- `OrderStatusChanged` — только технические переходы; canonical milestones —
  отдельные события (подтверждено order-canonical-events e2e).
- customerId link — server-derived; items/amounts/currency/serviceDate — в модели;
  traveler PII redacted на HTTP-контуре (OPERATOR/ADMIN full).
- Temporal gaps: milestone-колонки (confirmedAt/cancelledAt/fulfilledAt/closedAt)
  — Phase 2 (2.5A/2.7); хронология уже восстановима из событий (1.18A).

## 5. Booking entry boundary (§8)

- Ownership: booking.*; Order→Booking по `orderId` (typed ref, без FK).
- `BookingRequested` command — идемпотентен (Inbox dedup + consumer guard;
  повторный Requested не создаёт второй Booking — phase1 e2e).
- BookingConfirmed → Order reconcile (subscriber, 1.14). SupplierConfirmation —
  receivedAt; Passenger на основе OrderTraveler.
- Temporal: request/confirm/cancel timestamps + IANA — Phase 2 (2.8A/2.9A).
- Вердикт: foundation достаточно для Phase 2 Booking lifecycle без нарушения
  текущих контрактов (события/входящие уже канонические).

## 6. Payment/Finance reality (§9)

| Concept | Exists? | Current representation | Canonical? | Phase 2 owner |
|---|---|---|---|---|
| Payment entity | НЕТ | — | — | Finance (2.10C/2.12) |
| PSP integration | НЕТ | — | — | Finance |
| Payment intent | НЕТ | — | — | Finance |
| Charge | НЕТ | — | — | Finance |
| Refund | НЕТ | — | — | Finance |
| Commission | НЕТ | — | — | Finance |
| Settlement/Payout | НЕТ | — | — | Finance |
| Ledger | НЕТ | `Order.paymentStatus/paidAmount` — projection, НЕ ledger | НЕТ | Finance |
| Invoice | НЕТ | — | — | Finance |

`Order.paymentStatus` НЕ эквивалент canonical Payment domain; `paidAmount` НЕ
финансовый ledger. Buyer Cabinet Payments — честный `available:false`
(подтверждено entry-audit e2e #2).

## 7. Monetary contract audit (§10/§29)

Все money-поля — `Decimal @db.Decimal(12,2)` (schema строки: Tariff.price 318;
Order.amount/paidAmount 1090-1091; OrderItem.price/amount 1118-1120;
Booking.amount 1211). Float НЕ используется — float-money hazard отсутствует
(доказано e2e: 123.45 сохранён без drift). Currency companion: Tariff/Order/
OrderItem — да (`currency`); **Booking.amount — без currency (наследует от Order
по orderId)** — зафиксировано как step-local prerequisite (Phase 2 Booking
должен определить currency/amount policy явно). Отрицательные суммы — нет
guard (нет negative-price контракта) — Phase 2 финансовая модель определяет.
`MONETARY CONTRACT REQUIRED` не блокирует вход (ближайший шаг Phase 2 — не
money-critical, но 2.4+ требует фиксации currency/rounding policy).

## 8. Product → commercial boundary (§11–§12)

- **Mutable catalog state**: title/description/media/tariffs/attributes — live,
  меняются через draft N+1 + moderation; НЕ являются transaction truth.
- **Commercial snapshot**: Phase 2 Order/Booking обязаны snapshot'ить
  (productCode/title/price уже снапшотятся в OrderItem — фактический паттерн
  есть; tariffs/live-данные — нет). Boundary доказан: публичный контур отдаёт
  только published + approved версии.
- Tariff/Availability: Catalog-owned, mutable, `slotsTotal/slotsBooked/
  slotsReserved` — инвентарные счётчики foundation; **reservation/capacity
  locking/race protection отсутствуют** — это Phase 2 prerequisite, не defect
  Phase 1 (классифицировано, не реализуется).

## 9. Buyer identity (§13)

`User → customerId → crm.Customer` — customerId server-derived (ADR-0003
orchestration); forged customerId в register-body → 422 (entry-audit e2e #9);
BUYER не выбирает customerId; cross-buyer IDOR закрыт (e2e #4 + buyer-identity/
buyer-cabinet suites); CRM internals не сериализуются Buyer; registration time ≠
Customer projection time (1.18A); anonymous behavioral session не линкуется к
Buyer автоматически (privacy boundary).

## 10. Partner identity (§14)

`User → partnerId → crm.Partner` — единственная каноническая связь; onboarding/
approval/seller-profile/storefront/product-ownership привязаны к этой цепочке.
Future commercial records (Order/Booking/Settlement) должны ссылаться на
`partnerId` (canonical crm.Partner id), НЕ на display-поля. Однозначность есть —
`ARCHITECTURE DECISION REQUIRED` не требуется; сущность Commercial Partner
Identity: `crm.Partner.id` (через `User.partnerId`/Product.partnerId).

## 11. Supplier boundary (§15)

`crm.Supplier` (SUP-*) — отдельная сущность от Partner (Partner ≠ Supplier,
код различает). Booking ссылается на supplierId (Reservation/
SupplierConfirmation). Фаза 2 может опираться на неё как на reference, но
lifecycle/валидация supplier — prerequisite (см. §44).

## 12. Marketplace → commercial transition (§16)

Public Marketplace не создаёт Order/Booking/Payment/Lead автоматически —
подтверждено entry-audit e2e #7 (behavioral event не даёт Order/Product side
effects). Boundary: behavioral interaction ≠ commercial transaction. Checkout не
проектируется.

## 13. Storefront → commercial transition (§17)

ContactClick ≠ Lead, ProductView ≠ Sale (semantics зафиксированы 1.12.3/1.13B);
acquisitionSource ≠ transaction attribution; entitlement ≠ billing subscription
(e2e #8: нет billing-моделей; entitlement — enum на Storefront; Billing —
deferred). Скрытой связи entitlement→Subscription нет.

## 14. Publication vs acquisition vs transaction (§18)

`ProductPublicationChannel` = distribution/visibility; `AcquisitionSource` =
interaction context; будущий transaction source/attribution — отдельный контракт
(не наследуется автоматически). Подтверждено 1.12.3/1.13B contracts и
поведенческими e2e.

## 15. RBAC (§19)

Матрица 10 ролей; internal-роли с business purpose; PARTNER/FINANCE/ANALYST/
MARKETER unscoped internal reads revoked (1.17 FIX 1 + staff audit);
BUYER — только own-scope. Phase 2 endpoints наследуют: own-scope permissions
(update_own_*/read_own), granular internal (order.*/booking.*/finance.*) без
broad domain:write. Пермишены `finance.*`/`sales.*`/`documents.*`/`support.*`
dormant (без endpoint'ов) — Phase 2 добавит endpoints под уже
существующие-резервные permission-слоты (grant-with-endpoint policy).

## 16. IDOR/object scope (§20)

Buyer: actor.customerId → Order → Booking (e2e #4). Partner: actor.partnerId →
Product/Storefront (rbac-partner-scope, product-scope, storefront suites).
Communication: participant/context consistency (communication e2e). Никаких
`?customerId=`/`?partnerId=`/body-полей как authority — server-authoritative
scope везде.

## 17. Event foundation (§21–§23)

- OutboxEvent/InboxEvent: eventType/aggregateId/payload/actor/correlationId/
  causationId/timestamps/status/attempts/error; dedup Inbox unique
  (consumerId,eventId) — DB-level (e2e #6).
- Correlation: root HTTP server-authoritative; client requestId — только
  диагностический echo; child events наследуют correlation; causation = direct
  cause (request-context + business-event-envelope e2e; e2e #5 root null
  causation).
- Outbox FAILED: durable row, manual recovery; **automated retry — Step 2.17
  (PASS-DEFERRED)**. Blocker для начала Phase 2? **НЕТ** — prerequisite для
  commercial steps, которые полагаются на надёжную доставку (2.4–2.8); до этого
  — не блокер входа.

## 18. Temporal readiness (§24)

Правило entity ≠ lifecycle ≠ event ≠ processing time — закреплено (1.13A/1.18A)
и действует. Phase 2 milestones получают dedicated columns/history/events в
своих steps (2.5A/2.7/2.8A/2.9A); `updatedAt` не станет milestone.

## 19. Analytics reconciliation (§25)

1.18A: Product/Moderation/Seller/Onboarding/Buyer/Storefront-lifecycle/
entitlement/behavioral — READY; accepted limitations (Category legacy entity-time,
channel per-day history, storefront text history) НЕ являются Phase 2 blockers.
Analytics-ready history ≠ commercial-domain completion (см. §59).

## 20. Legacy unknown inventory (§26)

| Entity | Unknown | Count (dev) | Critical? | Phase 2 impact | Segmentation |
|---|---|---|---|---|---|
| Category.createdAt | время создания (seed до 1.13A) | 18/18 | НЕТ | НЕТ (некоммерческий факт) | reliable-from 1.13A |
| CategorySchema.activatedAt (DRAFT) | milestone не происходил | 18 | НЕТ | НЕТ | корректный NULL |
| Outbox.actor | actor legacy (до 1.15A) | незнач. | НЕТ | events до 1.15A — actor NULL | reliable-from 1.15A |
| `crm.Partner` entity-time | нет колонок | все | НЕТ | восстанавливается из событий | via PartnerCreated |

Без guessed backfill — все значения не тронуты.

## 21. Privacy (§31)

Behavioral no PII (payload whitelist, forged → 422, e2e #9/1.18A #10); public
без CRM internals; contact values не попадают в Marketplace behavioral; AuditLog
не PII-dump; event payloads минимальны (canonical refs); traveler/passenger PII
redaction действует (OPERATOR/ADMIN full). Communication body не в analytics.

## 22. Communication/Documents/Support (§32–§34)

Communication — CANONICAL bounded context (ADR-0011), typed context refs готовы
связываться с будущими commercial contextType; НЕ Support/Chat/Notification
domain. Documents/Support — нет domain; Buyer Cabinet — controlled empty
(`available:false`), никаких fake voucher/invoice/ticket. Future owners:
Documents/Support — Phase 3 (roadmap).

## 23. Subscription/entitlement separation (§35)

Storefront entitlement ≠ Subscription: нет trial/plan/recurring/grace/
cancellation нигде в schema/code (e2e #8 подтверждает отсутствие моделей).
Billing/Subscription — Deferred (DD-003…DD-014); Catalog entitlement — projection
до появления Billing.

## 24. Deferred Decisions audit (§36)

DD-001…DD-020 карта актуальна; Step 2.0 ничего из них не решил (multilingual
partner content, AI translation, trial/plans/pricing, recurring billing,
cancellation/grace, anti-abuse, Partner CRM entitlements, custom domains,
commission rates, analytics matrix, retention, capability matrix — не
реализованы).

## 25. API baseline / pagination (§37–§38)

Error envelope `{statusCode, message, requestId}` + X-Request-Id (runtime probe);
401/403 разделены; neutral 404; DTO whitelist + forbidden-keys; pagination:
`page/pageSize` с cap 100, total, deterministic sort. Buyer Orders/Bookings —
pageSize-пагинация (default 20); history take:100 — transitional, не blocker
(Phase 2 шаги определят свой контракт).

## 26. Concurrency/idempotency (§39–§40)

Primitives: DB transactions; unique constraints (slug/email/partial unique);
CAS/version (Product, seller proposal, application, storefront ops); idempotent
commands (BookingRequested, moderation decisions); Inbox dedup; behavioral eventId
dedup. Разделение: HTTP-командная идемпотентность, event-delivery, behavioral,
consumer — не взаимозаменяемы. Explicit payment/checkout idempotency (idempotency
keys) — Phase 2 (отмечено как required для 2.10+).

## 27. Frontend boundary (§41–§43)

Лейауты разделены: public / Buyer `/account/*` / Partner `/partner/*` /
internal Shell `/app/*`; route gates; login `next` safe (anti-open-redirect);
public client без Authorization; account/partner API — auth. RU/AZ/EN системная
локализация сохранена; multilingual UGC deferred (без AI translation).
Marketplace PDP SEO (client-side title/meta) — LOW, non-blocker, owner 3.35.

## 28. Observability (§44)

requestId + correlation + causation; safe errors (no stack); AuditLog references;
Outbox processing status. Vendor tracing/APM не внедрялись.

## 29. Security negative matrix (§45)

Покрыто выделенными e2e: anonymous 401 (entry-audit #10, runtime probe); BUYER
cross-scope (#4); PARTNER чужой Product/Storefront — neutral/403 (product-scope,
rbac-partner-scope, storefront); MODERATOR без partner own-write; forged
customerId/partnerId/status/paymentStatus/entitlement/actor/correlation/
timestamps — rejected (entry-audit #9 + validation-pipe + buyer-identity +
storefront suites).

## 30. Phase 2 dependency graph (§46)

`Identity (Security/CRM) → Catalog (Product/publication) → Commercial intent
(новый; OrderRequested) → Order → Booking → Payment (Finance) → Fulfillment →
Settlement` — порядок по Roadmap v3 (Sales/Quote/Checkout → 2.1-2.4; Order →
2.5-2.7; Booking → 2.8-2.9; Payment/Finance → 2.10C/2.12). Реальные названия из
Roadmap имеют приоритет.

## 31. Blocker classification (§47)

- **BLOCKER: 0.**
- **STEP-LOCAL PREREQUISITES** (не блокируют вход, обязательны до своего шага):
  1. **Outbox automated retry/recovery — обязателен ДО Step 2.4 (Sale Completion →
     OrderRequested; consumer — Step 2.5), НЕ «2.4–2.8»** (уточнено Strict Review 2.0).
     Owner 2.17, но 2.17 стоит в КОНЦЕ Phase 2 → sequencing note (§37).
  2. Booking currency/amount policy — до 2.8+.
  3. Monetary contract (currency/rounding/negative) — до 2.5+ (2.4 finance);
     evidence: `bootstrapOrder` вычисляет amount через JS float (DB-округление
     маскирует) — Phase 2 checkout обязан использовать Decimal-арифметику.
  4. Tariff/Availability reservation & capacity locking — до checkout (2.4+);
     evidence: `slotsBooked/slotsReserved` не пишутся ни одним production path.
  5. Commercial snapshot policy (Product→Order) — до 2.5 (паттерн OrderItem уже есть).
  6. `/orders/bootstrap` removal — 2.6 (задокументировано; ADMIN-only, order.import).
  7. Payment/PSP/ledger — 2.10C/2.12 (полное absence честно признано).
  8. Supplier lifecycle/валидация — до 2.8 supplier-confirmation flow.
  9. Payment/checkout idempotency keys — до 2.10.
- **ACCEPTED DEBT**: PDP SEO (3.35); Communication retention (3.45A+DD); history
  take:100 (transitional); `crm.Partner` entity-time (Phase 2 commands);
  channel per-day history (по необходимости); Outbox `attempts`-колонка не
  инкрементируется (dormant, резерв для 2.17).
- **DEFERRED DECISIONS**: DD-001…020 (не решены — правильно).

## 32. Roadmap reconciliation (§58)

Все найденные prerequisites имеют owner в Roadmap v3 (номера выше). `ROADMAP
GAP` — нет.

## 33. ADR reconciliation (§61)

ADR-0001…0011 соответствуют фактическому коду (bounded contexts, cross-schema
refs без FK, Marketplace/Storefront identity, Partner boundary, behavioral
ownership, request/correlation, event envelope, Communication). Конфликтов нет;
ADR не переписывались.

## 34. Analytics/temporal reconciliation (§59–§60)

Противоречий с `analytics-readiness.md`/`temporal-readiness.md` нет:
analytics-ready history не означает completed commercial domain; reconstructable
legacy не означает canonical Phase 2 lifecycle; behavioral analytics ≠
transaction analytics. Phase 2 milestones получат dedicated timestamps/history/
events в своих steps.

## 35. Verification (§54–§56)

- Dev DB: только read/probe (1.18A coverage); isolated instance на temp DB
  `travelhub_p2audit` (fresh migrations) — public 200, anonymous private 401×3,
  X-Request-Id header == body requestId, neutral 404, boot без synthetic rows
  (1 admin только), затем инстанс остановлен и DB удалена.
- New e2e: `backend/test/phase2-entry-audit.e2e-spec.ts` (10 контрактов).
- Regression: см. ниже.

## 36. Final verdict

**PASS WITH STEP-LOCAL PREREQUISITES** — фундамент Phase 1 стабилен, безопасен,
архитектурно определён; первый implementation step Phase 2 может начинаться,
каждый шаг обязан закрыть свои step-local prerequisites (owner — его roadmap
step). `ARCHITECTURE DECISION REQUIRED` не требуется.

## 37. Strict Review 2.0 addendum (2026-08-10)

Независимый review подтвердил verdict (0 blockers; 9 prerequisites — все реальны,
owner-ы корректны). Два уточнения:

1. **Prerequisite #1 deadline уточнён**: точная точка, где надёжная доставка
   становится обязательной, — **Step 2.4 (Sale Completion → OrderRequested) /
   2.5 (Order Creation Consumer)**, не «2.4–2.8». Booking (2.8) — вторая точка.
2. **ROADMAP SEQUENCING NOTICE**: Step 2.17 (Phase 2 Hardening: Outbox/retries)
   находится в КОНЦЕ Phase 2, ПОСЛЕ первого production flow (2.4–2.8), который
   полагается на доставку. Конфликт sequencing реален, но не блокирует вход
   (Steps 2.1–2.3 не имеют критичных consumer-ов): решение — вынести/встроить
   reliability capability (automated FAILED retry + recovery command + attempts
   tracking) в scope Step 2.4/2.5 (или небольшим sub-step перед 2.4). Это
   scheduling-решение roadmap-owner'а, принимается при планировании Step 2.3/2.4,
   НЕ сейчас. `ARCHITECTURE / ROADMAP DECISION REQUIRED` не выносится: конфликт
   локален, owner есть (2.17), первый шаг (2.1) не зависит от доставки.

---

`PHASE 2 STEP 2.0 ENTRY AUDIT PASSED WITH STEP-LOCAL PREREQUISITES — READY FOR FIRST PHASE 2 IMPLEMENTATION STEP`
