# PHASE 2 — STEP 2.3B — PAYMENT TERMS / PAYMENT SCHEME FOUNDATION — IMPLEMENTATION PROMPT

## 0. Роль и режим

Выполни **PHASE 2 — STEP 2.3B — Payment Terms / Payment Scheme Foundation** для TravelHub.

Работай непосредственно с фактическим repository state после APPROVED Step 2.3A.

Предыдущий шаг считается закрытым:

`PHASE 2 STEP 2.3A STRICT REVIEW COMPLETED — APPROVED`

Implementation report предыдущего шага не заменяет код. Перед изменениями быстро проверь фактический baseline.

**НЕ начинать Step 2.4.**
**НЕ создавать OrderRequested.**
**НЕ создавать Order/Booking/Payment.**
**НЕ интегрировать PSP.**

Если для корректной реализации требуется фундаментальное решение, которого нет в Roadmap/ADR/Deferred Decisions, остановись и верни:

`ARCHITECTURE DECISION REQUIRED`

с точным описанием вопроса, вариантов и затрагиваемых следующих шагов.

---

# 1. Главная цель

Добавить в canonical Sales/Checkout flow **authoritative Payment Terms / Payment Scheme contract**, чтобы CheckoutIntent мог однозначно фиксировать коммерческие условия оплаты до будущего Sale completion.

Payment Terms описывают **обязательство покупателя и график/условия оплаты**, но НЕ являются:

- Payment;
- payment transaction;
- PSP intent;
- authorization/capture;
- refund;
- invoice;
- ledger;
- settlement;
- payout;
- commission;
- revenue recognition;
- paid status.

Frontend НЕ является authority ни для цены, ни для вычисляемых денежных значений payment terms.

---

# 2. Mandatory baseline audit

Перед реализацией проверить:

- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- Step 2.3 / 2.3A docs;
- ADR-0001…актуальный последний ADR;
- Deferred Decisions Map;
- `sales.Quote`;
- `sales.CheckoutIntent`;
- money helpers;
- permissions matrix;
- Checkout API;
- Sales history/audit conventions;
- current migration count/status.

Зафиксировать Current → Target.

---

# 3. Preserve Step 2.3A invariants

Нельзя сломать:

- owner Checkout = Sales;
- frozen Quote → frozen Checkout binding price;
- Decimal money;
- client cannot override totals/currency;
- Checkout `ACTIVE → CANCELLED`;
- отсутствие ложного READY/reservation guarantee;
- Availability = `checked, not reserved`;
- reservation/locking prerequisite ДО Step 2.4;
- `acquisitionSource=DIRECT` только для существующего internal-assisted entry;
- public/BUYER checkout пока отсутствует;
- no Order/Booking/Payment/OrderRequested;
- capability-based authorization;
- CAS/version;
- history/audit;
- requestId/correlation conventions.

---

# 4. Canonical payment scheme vocabulary

Проверь Roadmap и существующие документы и используй canonical names оттуда.

Если Roadmap действительно задаёт следующие схемы, реализовать именно их:

- `FULL_PREPAYMENT`
- `PARTIAL_PREPAYMENT`
- `DEPOSIT`
- `PAY_LATER`
- `PAY_AT_SERVICE`

Не переименовывать произвольно.

Если фактический Roadmap содержит другой список — следовать Roadmap и явно указать расхождение в отчёте.

Не добавлять лишние схемы "на будущее".

---

# 5. Semantics first

Для КАЖДОЙ payment scheme определить точную business semantics до написания persistence logic.

Нужно однозначно ответить:

- сколько покупатель должен оплатить до исполнения услуги;
- какая сумма остаётся после initial payment;
- когда остаток должен быть оплачен;
- является ли deposit частью total или дополнительной суммой;
- допускается ли нулевая initial amount;
- допускается ли 100%;
- какие поля обязательны;
- какие поля запрещены для конкретной схемы.

Никаких двусмысленных `deposit` / `prepayment`.

---

# 6. Recommended canonical monetary model

Не хранить произвольный frontend-computed payment schedule.

Payment terms должны ссылаться на frozen Checkout `total` и server-side вычислять производные значения.

Минимально рассмотреть:

- `paymentScheme`;
- `prepaymentType` / equivalent — только если действительно нужен;
- `prepaymentValue` — percentage or fixed amount, если схема этого требует;
- `initialAmount`;
- `remainingAmount`;
- due semantics;
- optional service-payment marker/date semantics только если Roadmap это требует.

Derived amounts должны вычисляться server-side.

Если достаточно меньшего набора — предпочесть меньший canonical contract.

---

# 7. FULL_PREPAYMENT

Canonical expectation:

- initialAmount = Checkout.total;
- remainingAmount = 0;
- никакой client-supplied amount;
- никакого percentage field, если оно не нужно contractually.

Проверить zero-total edge case по существующему monetary contract.

---

# 8. PARTIAL_PREPAYMENT

Должна быть строгая модель.

Определить canonical representation:

- percentage;
- fixed amount;
- либо один из этих вариантов, если Roadmap ограничивает.

Если разрешены оба, discriminated contract обязателен.

Нельзя угадывать по значению.

Server вычисляет:

`initialAmount`
`remainingAmount = total - initialAmount`

Strict validation:

`0 < initialAmount < total`

Если 100% → FULL_PREPAYMENT, а не PARTIAL.

---

# 9. DEPOSIT

Сначала определить semantics из Roadmap/architecture.

Критический вопрос:

**deposit входит в Checkout.total или является отдельным обязательством?**

Не реализовывать до однозначного ответа.

Если existing architecture трактует deposit как часть total:

`remainingAmount = total - depositAmount`

Если deposit сверх total — это уже иной commercial/finance contract и может требовать architecture decision.

---

# 10. PAY_LATER

Определить точный due trigger.

Не использовать расплывчатое "потом".

Если canonical contract ещё не имеет due-date/time model, допустим честный scheme marker без fake due timestamp — но это должно быть явно задокументировано.

initialAmount обычно 0 только если это соответствует Roadmap.

---

# 11. PAY_AT_SERVICE

Должно быть явно отличимо от generic PAY_LATER.

Связь с `serviceDate` должна быть честной.

Не создавать fake UTC service instant, если Step 2.3A поддерживает только date-only.

Если точный time/payment deadline невозможен до 2.8A — хранить semantic trigger `AT_SERVICE`, а не fabricated timestamp.

---

# 12. Money authority

Источник:

`Issued Quote → frozen Checkout total → server-derived Payment Terms amounts`

Запрещено:

`Frontend → initialAmount/remainingAmount`

Запрещено повторно читать текущую Catalog/Tariff price для расчёта payment terms.

---

# 13. Decimal and rounding

Использовать существующий canonical `sales.money` contract.

Проверить:

- DECIMAL precision/scale;
- half-up;
- percentage calculations;
- fixed amount;
- exact reconciliation.

Обязательный invariant:

`initialAmount + remainingAmount == Checkout.total`

для схем, где deposit/prepayment является частью total.

Никаких JS float.

---

# 14. Currency

Payment Terms НЕ выбирают currency.

Currency наследуется от Checkout.

Не дублировать currency без необходимости.

Если дублируется как immutable snapshot — доказать зачем и гарантировать равенство Checkout.currency.

---

# 15. Persistence strategy

Выбрать минимальную модель.

Предпочтение:

- поля непосредственно в `CheckoutIntent`, если terms являются единственным current commercial configuration;
- отдельная `CheckoutPaymentTerms` entity только если lifecycle/history/cardinality действительно требуют.

Не создавать giant payment aggregate.

Не создавать Finance schema.

---

# 16. Mutability

Payment Terms должны иметь чёткий mutation contract.

Пока Checkout ACTIVE и Sale не завершён — terms могут быть изменяемы только через отдельную command/API с CAS.

После CANCELLED — immutable.

Step 2.4 должен получить однозначный frozen terms snapshot.

Если нужен отдельный "terms locked" milestone — не изобретать без Roadmap basis.

---

# 17. CAS

Все изменения terms:

- `expectedVersion`;
- stale → 409;
- one winner;
- exactly one history fact;
- no partial mutation.

Проверить race:
- terms update vs cancel;
- two terms updates;
- terms update vs availability revalidate.

---

# 18. API

Добавить минимальный endpoint, например:

`PUT /api/v1/sales/checkouts/:code/payment-terms`

или canonical repo convention.

Не добавлять generic PATCH.

Request содержит только user-selectable semantic inputs.

Response содержит authoritative normalized terms + derived amounts.

---

# 19. DTO / mass assignment

Запретить forged:

- initialAmount;
- remainingAmount;
- total;
- subtotal;
- currency;
- price;
- paidAmount;
- paymentStatus;
- PSP fields;
- orderId;
- paymentId;
- status;
- version except expectedVersion contract;
- timestamps;
- actor;
- requestId/correlation;
- availability;
- acquisitionSource.

---

# 20. RBAC

Использовать existing:

- `sales.checkout.read`
- `sales.checkout.write`

Не создавать отдельные permissions без необходимости.

Подтвердить capability-based access.

Expected:
- ADMIN;
- SALES_MANAGER write;
- DIRECTOR according to existing read-only matrix;
- OPERATOR no accidental access;
- FINANCE не получает checkout write только потому, что слово "payment";
- BUYER/PARTNER/MODERATOR/ANALYST/MARKETER denied unless existing approved matrix says otherwise.

**Payment terms ≠ Finance permission.**

---

# 21. Customer/public boundary

2.3B остаётся current internal-assisted Sales flow.

Не открывать public/BUYER payment-term selection преждевременно.

Не создавать anonymous checkout identity.

Step 3.31/public checkout remains separate.

---

# 22. Availability boundary

Payment Terms НЕ резервируют capacity.

Не использовать selection of FULL_PREPAYMENT/DEPOSIT как основание считать Availability guaranteed.

DD-022 остаётся обязательным prerequisite до Step 2.4:

**atomic revalidate/reserve before OrderRequested.**

---

# 23. Quote expiry interaction

Определить:

- можно ли менять payment terms после истечения source Quote, если Checkout уже создан;
- является ли frozen Checkout price всё ещё authoritative;
- должен ли quoteExpired блокировать terms mutation или только future Sale completion.

Не придумывать policy молча.

Если Roadmap не определяет — выбрать минимально безопасную semantics и задокументировать либо вынести architecture decision, если влияет на binding contract.

---

# 24. Acquisition isolation

Payment terms не меняют `acquisitionSource`.

DIRECT остаётся server-authoritative для существующего internal flow.

Не связывать scheme с acquisition channel.

---

# 25. Temporal semantics

Не использовать `updatedAt` как payment-term milestone.

History должен фиксировать реальное изменение terms.

Dedicated timestamp добавлять только если business question реально требует:

"When were payment terms selected/changed?"

Если history достаточно — не добавлять redundant column.

---

# 26. History

Добавить immutable history action, например:

`payment_terms_changed`

Содержимое — semantic old/new scheme/config + derived monetary summary только если это соответствует существующей history policy.

Без PII.

Не хранить raw request body.

---

# 27. AuditLog

Audit action:

`sales.checkout.payment_terms_changed`

или repo convention.

Minimal details:
- checkout code/ref;
- scheme from/to;
- safe monetary summary if allowed.

Actor/correlation — existing infrastructure.

No PII.

---

# 28. Payment absence

Обязательные negative assertions:

После выбора любой scheme:

- Payment rows = none / entity отсутствует;
- no PSP intent;
- no paymentStatus mutation;
- no paidAmount mutation;
- no Order;
- no Booking;
- no Sale completion;
- no OrderRequested.

---

# 29. Sale boundary

Если `Sale` уже существует OPEN, Step 2.3B НЕ закрывает его.

Payment terms selection ≠ Sale completion.

Step 2.4 owner remains Sale completion → OrderRequested.

---

# 30. Order snapshot readiness

Payment Terms должны быть достаточно детерминированы, чтобы Step 2.4/2.5 мог snapshot them without reinterpretation.

Не реализовывать Order snapshot сейчас.

---

# 31. Idempotency

Checkout/payment idempotency key остаётся prerequisite Step 2.10 unless Roadmap says otherwise.

Не вводить ad-hoc idempotency framework в 2.3B.

CAS handles concurrent mutation, но не объявлять CAS полноценной request idempotency.

---

# 32. Migration

Если schema меняется:

- additive;
- nullable/default semantics честные;
- no fake backfill;
- existing Checkout rows remain valid;
- no guessed scheme;
- no default FULL_PREPAYMENT/DIRECT-like fabrication;
- deterministic;
- clean replay;
- no drift;
- applied migrations untouched.

Existing CheckoutIntent without terms should mean:

`payment terms not selected`

а не implicit scheme.

---

# 33. Existing Checkout rows

Критично:

не backfill existing ACTIVE Checkout with arbitrary payment scheme.

NULL = terms not selected.

Document exact semantics.

---

# 34. Projection

Checkout detail/list should expose payment terms in a stable explicit shape.

Recommended neutral shape when absent:

`paymentTerms: null`

Не возвращать partially fabricated zero schedule.

---

# 35. READY / status

Step 2.3A intentionally has no READY status.

2.3B не должен вводить READY только ради payment terms.

Если future Sale completion requires "checkout complete", validate prerequisites in Step 2.4 command instead of fake lifecycle unless Roadmap explicitly mandates a state.

---

# 36. Required validation cases

Test all applicable:

- FULL_PREPAYMENT;
- PARTIAL percentage;
- PARTIAL fixed;
- DEPOSIT;
- PAY_LATER;
- PAY_AT_SERVICE;
- zero;
- negative;
- >total;
- 100%;
- >100%;
- excessive decimals;
- invalid enum;
- forbidden mixed fields;
- forged derived amounts;
- cancelled Checkout;
- stale expectedVersion.

Only test schemes actually canonical in Roadmap.

---

# 37. Percentage boundary

If percentage exists:

- canonical scale/precision;
- >0;
- <100 for PARTIAL;
- no binary float;
- deterministic rounding;
- resulting amount cannot become 0 due to rounding unless explicitly allowed.

Boundary tests mandatory.

---

# 38. Fixed boundary

If fixed exists:

- >0;
- <total for PARTIAL;
- <=total for deposit only if semantics says part-of-total;
- correct 2dp normalization;
- max DECIMAL boundary.

---

# 39. Reconciliation tests

For each monetary scheme assert exact:

- total;
- initial;
- remaining;
- sum invariant.

Examples should include awkward rounding values, not only 100.00.

---

# 40. Failure atomicity

Invalid terms must create:

- no Checkout mutation;
- no history;
- no audit side effect;
- no outbox event.

---

# 41. Outbox

Не создавать PaymentTermsSelected event без consumer.

Если Step 2.4 later needs data, it reads authoritative Checkout/Sale snapshot or consumes future canonical Sale event.

"No consumer → no event" сохраняется.

---

# 42. Unit tests

Добавить focused pure tests for payment terms calculator/validator.

Покрыть:
- each scheme;
- Decimal rounding;
- boundaries;
- reconciliation;
- invalid field combinations;
- date-only AT_SERVICE semantics if applicable.

---

# 43. E2E suite

Создать отдельный:

`test/payment-terms.e2e-spec.ts`

или repo-consistent name.

Минимально проверить:

1. anonymous 401;
2. unauthorized roles 403;
3. SALES_MANAGER can set;
4. DIRECTOR matrix;
5. FULL_PREPAYMENT;
6. PARTIAL;
7. DEPOSIT;
8. PAY_LATER;
9. PAY_AT_SERVICE;
10. derived fields cannot be forged;
11. Decimal reconciliation;
12. stale CAS → 409;
13. concurrent updates → one winner;
14. cancelled Checkout immutable;
15. history;
16. audit no PII;
17. existing Checkout with no terms → null;
18. no fake migration backfill;
19. no Order/Booking/Payment;
20. no OrderRequested;
21. Sale remains OPEN;
22. availability still not reserved;
23. acquisitionSource unchanged;
24. requestId/error envelope.

Adapt list to actual canonical scheme set.

---

# 44. Migration legacy proof

Если migration добавляет nullable fields/entity, automated test должен доказать:

Checkout created before/without terms remains NULL after reconciliation/startup.

No seed/reconciliation may fabricate terms.

---

# 45. Runtime verification

На isolated backend/test DB:

- create/obtain issued Quote;
- create Checkout;
- confirm paymentTerms null;
- set each supported scheme;
- inspect derived amounts;
- stale version;
- cancel;
- verify no Payment/Order/Booking/OrderRequested;
- verify requestId;
- verify migration state.

Не загрязнять dev data.

---

# 46. Full regression

Backend:
- `tsc --noEmit`;
- unit;
- Step 2.1;
- Step 2.2;
- Step 2.3;
- Step 2.3A;
- new 2.3B e2e;
- full serial e2e.

Frontend:
- `tsc --noEmit`;
- vitest;
- production build.

Migrations:
- status;
- clean replay;
- diff/no drift.

No skipped/timeouts silently accepted.

---

# 47. Documentation

Создать/update:

`docs/architecture/payment-terms-foundation.md`

или repo-consistent document.

Документировать:

- owner;
- scheme vocabulary;
- exact semantics each scheme;
- authoritative source;
- derived amounts;
- Decimal/rounding;
- null/not-selected;
- mutability/CAS;
- history/audit;
- Checkout/Quote relation;
- availability non-reservation;
- Payment absence;
- Sale/Order boundary;
- public/BUYER boundary;
- prerequisites before 2.4.

Обновить relevant docs index/contracts if required.

---

# 48. Deferred Decisions

Не превращать обязательные scheme semantics в deferred decision.

Deferred допустим только для действительно будущих вопросов, например:
- exact PSP execution;
- payment due reminders;
- installments beyond canonical 2.3B;
- refundable/non-refundable deposit policy if Roadmap does not yet define it;
- offline collection workflow;
- finance ledger treatment.

Если core DEPOSIT semantics не определена — это не harmless DD; это architecture stop.

---

# 49. Step 2.4 gate checklist

После 2.3B до запуска 2.4 должно быть явно видно:

### Must be resolved before/during 2.4
- DD-022 availability reservation/locking owner + atomic gate;
- Outbox retry reliability prerequisite;
- payment terms snapshot propagation;
- acquisition source propagation;
- commercial snapshot contract;
- Sale completion idempotency/atomicity as required by Roadmap.

Не реализовывать их сейчас, кроме того, что непосредственно принадлежит 2.3B.

---

# 50. Architecture decision triggers

Вернуть `ARCHITECTURE DECISION REQUIRED`, если:

- canonical scheme list не определён;
- DEPOSIT semantics ambiguous;
- PARTIAL representation cannot be determined;
- Payment Terms owner disputed between Sales/Finance;
- terms selection requires creating Payment;
- terms must alter Checkout binding total;
- due-time requires inventing timezone/service instant;
- Step 2.4 cannot consume terms without redesign;
- migration would require guessed backfill.

---

# 51. Mandatory review of small-organization capability requirement

Сохранить принцип, обсуждавшийся ранее:

роль ≠ должность сотрудника.

Небольшая организация должна в будущем иметь возможность выдать одному сотруднику нужные capabilities разных operational centers без назначения ему искусственной "универсальной" business role.

На Step 2.3B:

- не вводить hardcoded `if role === SALES_MANAGER`;
- использовать permission/capability matrix;
- ADMIN должен сохранять возможность управления access model согласно существующей/запланированной capability architecture;
- не расширять UI access-management, если его owner-step ещё не наступил.

---

# 52. Required final report

Вернуть:

# PHASE 2 — STEP 2.3B — PAYMENT TERMS / PAYMENT SCHEME FOUNDATION — ОТЧЁТ

1. Verdict
2. Repository baseline
3. Sources inspected
4. Current → Target
5. Roadmap scope
6. Payment Terms ownership
7. Canonical scheme vocabulary
8. Scheme semantics matrix
9. Data model
10. Checkout integration
11. Quote/binding-price preservation
12. Monetary authority
13. Decimal/rounding
14. FULL_PREPAYMENT
15. PARTIAL_PREPAYMENT
16. DEPOSIT
17. PAY_LATER
18. PAY_AT_SERVICE
19. Currency
20. Null/not-selected semantics
21. Mutability
22. CAS/concurrency
23. API surface
24. DTO/mass-assignment
25. RBAC/capabilities
26. Customer/public boundary
27. Availability isolation
28. Quote-expiry interaction
29. Acquisition isolation
30. Temporal semantics
31. History
32. Audit
33. Privacy
34. Payment/Finance absence
35. Sale/Order/Booking isolation
36. Outbox/events
37. Migration
38. Legacy/no-fake-backfill
39. Unit tests
40. E2E tests
41. Runtime verification
42. Full regression
43. Documentation
44. Deferred Decisions
45. Step 2.4 prerequisites
46. Issues found/fixed
47. Architecture decision status
48. Out-of-scope confirmation
49. Files changed

Final line:

`PHASE 2 STEP 2.3B IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

---

# 53. Stop condition

После implementation:

**НЕ выполнять Strict Review в том же проходе.**
**НЕ начинать Step 2.4.**

Вернуть implementation report и ждать отдельного Strict Review prompt.
