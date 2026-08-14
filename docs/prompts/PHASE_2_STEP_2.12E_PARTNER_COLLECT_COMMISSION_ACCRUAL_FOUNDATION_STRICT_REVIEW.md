# PHASE 2 --- STEP 2.12E --- PARTNER_COLLECT / COMMISSION ACCRUAL FOUNDATION --- STRICT REVIEW

## 0. MODE

**STRICT REVIEW ONLY · REPOSITORY-FIRST · ADVERSARIAL · NO NEXT-STEP
IMPLEMENTATION**

Проведи независимый Strict Review фактической реализации Step 2.12E.
Implementation report не является доказательством: каждое утверждение
проверяется по production-коду, Prisma schema, SQL migration,
EventBus/outbox/inbox, RBAC, тестам, runtime и актуальным
ADR/Roadmap/contracts.

Не начинать 2.12A/B/C/D, 2.14, 2.14A--F или любой следующий
implementation step.

## 1. Допустимые verdict

Финальный verdict должен быть ровно одним из:

-   `PHASE 2 STEP 2.12E STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED)`
-   `PHASE 2 STEP 2.12E STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
-   `PHASE 2 STEP 2.12E STRICT REVIEW FAILED — IMPLEMENTATION DEFECTS REMAIN`
-   `PHASE 2 STEP 2.12E STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

Green tests сами по себе не являются основанием для APPROVED.

## 2. Baseline

До изменений зафиксировать branch, HEAD, origin sync, dirty/untracked
state, migration status/count, статусы 2.12E, 2.12A--D,
2.14/2.14E/2.14F. Не очищать unrelated worktree.

## 3. Обязательные источники

Проверить фактически: Roadmap v3; ADR-0001, ADR-0010, ADR-0013; 2.14E
Commission Policy architecture + strict review; 2.11 frozen snapshot;
2.12 Payment; 2.13 Refund; 2.13A Dispute; `schema.prisma`; migration
`20260814190000_add_partner_collect_commission_accrual`;
`sales.money.ts`; Quote ISSUE; CheckoutIntent/Sale/Order propagation;
Order consumer/subscribers; `CommissionService`;
`CommissionAccrualConsumer`; EventBus; Finance controllers/validation;
actual `ROLE_PERMISSIONS`; `api.md`, `events.md`, `ids.md`; relevant
unit/e2e.

## 4. Scope reconciliation --- HARD GATE

Независимо доказать, что 2.12E реализует только PARTNER_COLLECT
Commission Accrual Foundation:

-   frozen commission snapshot;
-   frozen seller identity;
-   Commission fact;
-   CommissionAccrual fact;
-   CommissionAccrued;
-   read API.

Не должно быть: PSP split, Payment→commission producer, Ledger posting,
Settlement/Payout, Invoice, refund/dispute commission adjustment,
Commission UI.

Любое scope expansion классифицировать.

## 5. Commission policy authority --- HARD GATE

Repo-wide найти все источники commission rate/percentage/rules.
Доказать:

-   `finance.CommissionPolicy` из 2.14E --- единственный mutable policy
    authority;
-   production hardcoded TravelHub commission rates = 0;
-   ProviderFee ≠ TravelHub Commission;
-   Catalog/Product/Tariff/PSP/frontend/env не являются вторым rate
    authority.

Второй mutable authority → FAIL/BLOCKED.

## 6. Freeze boundary --- HARD GATE

Проследить:

`Quote ISSUE → CheckoutIntent → Sale → Order → Commission producer`

Для `commissionSnapshot` проверить verbatim propagation как минимум:

-   policyCode;
-   rate;
-   baseAmount;
-   channel;
-   sellerPartnerId;
-   selectedAt;
-   version/discriminator, если существует.

После freeze запрещены policy re-resolve, live rate lookup и repricing.

Обязательный тест: policy A активна → Quote ISSUE → policy A
архивируется/заменяется B → flow продолжается → Commission использует
frozen A.

## 7. Seller snapshot --- HARD GATE

Проверить источник `sellerPartnerId`, freeze и propagation. Commission
producer должен читать frozen seller, а не live Catalog.

Adversarial test: freeze → изменить live seller/catalog relation →
продолжить flow → историческая комиссия остаётся привязана к frozen
seller.

## 8. One-seller invariant

Проверить:

-   один seller → допустимо;
-   missing seller → 0 Commission/Accrual;
-   multi-seller → 0 Commission/Accrual;
-   malformed/mixed seller → нельзя выбирать `first`.

Поведение должно соответствовать ADR-0013 и docs. Никакого live lookup
для «исправления» snapshot.

## 9. NO_POLICY / AMBIGUOUS / NO_COMMISSION_CHANNEL

Доказать fail-closed:

-   не превращаются в 0%;
-   не создают Commission/Accrual;
-   нет fallback rate;
-   AMBIGUOUS не маскируется `findFirst`.

NULL snapshot означает отсутствие frozen commission fact, а не 0%.

## 10. Money/base/rounding --- HARD GATE

Canonical V1:

`commissionAmount = round_half_up(baseAmount × rate)`

Проверить:

-   Decimal/canonical money helper;
-   ROUND_HALF_UP;
-   no JS float authority;
-   no `Number(rate) * Number(base)`;
-   no parseFloat;
-   overflow/scale guards;
-   base = frozen discounted Order.total согласно ADR-0013;
-   no Refund/Dispute/ProviderFee/FX subtraction/conversion.

Добавить half-cent adversarial tests.

## 11. Corrupted snapshot

Через controlled test setup проверить invalid rate, zero, \>=1,
excessive precision, invalid/scientific representation если применимо,
invalid base, base != canonical frozen total, channel mismatch, seller
mismatch, malformed selectedAt, missing material fields.

Принцип: corrupted authoritative snapshot → fail loudly; никогда не
создавать молча неверный финансовый факт. При этом validation не должна
требовать live policy lookup исторической policy.

## 12. Write-path audit --- HARD GATE

Repo-wide найти все Prisma/raw SQL writers для:

-   Commission;
-   CommissionAccrual;
-   commissionSnapshot;
-   Order.sellerPartnerId.

Классифицировать create/update/upsert/delete/raw SQL/seed/job/consumer.
Доказать single authority, zero hidden writer, zero cross-domain Finance
write.

## 13. Commission vs CommissionAccrual

Явно установить семантику обеих моделей и доказать, что они не являются
двумя независимыми money authorities.

Проверить:

-   создаются атомарно;
-   amount не может расходиться;
-   CommissionAccrual однозначно ссылается на source Commission;
-   нет независимого update amount.

## 14. Transaction atomicity

Проверить одну transaction для требуемого набора:

-   Commission;
-   CommissionAccrual;
-   CommissionAccrued outbox;
-   Inbox state, если контракт требует его в той же transaction.

Failure injection: нельзя оставить Commission без Accrual, Accrual без
Commission или event для rollback-факта.

## 15. Idempotency --- HARD GATE

Проверить все три уровня:

1.  Inbox unique;
2.  `Commission_orderId_key`;
3.  `CommissionAccrual_sourceCommissionId_key`.

### Identical replay

Один business effect: 1 Commission, 1 Accrual, 1 CommissionAccrued.

### Divergent replay

На том же business identity отдельно изменить material fields: rate,
baseAmount, policyCode, sellerPartnerId, channel.

Ожидание: controlled conflict/failure; не silent return existing; raw
500 = 0.

Специально искать класс дефекта Ledger 2.10A / Dispute 2.13A: **silent
divergent idempotency success**.

Unknown P2002 не должен классифицироваться как legitimate replay.

## 16. Future-safety idempotency key

Оценить `Commission_orderId_key` в рамках V1 one-seller PARTNER_COLLECT.
Не требовать сейчас future multi-seller/refund-adjustment redesign, но
документировать additive evolution point. Если key уже противоречит
ADR-0013 V1 → FAIL.

## 17. Concurrency

Реальные concurrent tests:

-   два identical OrderCreated;
-   divergent concurrent replay, где возможно;
-   competing consumer execution.

Результат: одна Commission, один Accrual, один business event; loser
controlled; raw 500 = 0.

## 18. EventBus / OrderCreated --- CRITICAL CROSS-CUTTING HARD GATE

Реализация 2.12E изменила delivery `OrderCreated`. Проверить фактическую
цепочку:

`OrderRequested → Order consumer transaction → OrderCreated outbox → post-commit publishPending → CommissionAccrualConsumer`

Доказать:

-   OrderCreated создаётся с корректным outbox state;
-   публикация не происходит до commit;
-   rollback не публикует event;
-   nested/reentrant `publishPending()` не создаёт duplicate delivery;
-   recursion loop отсутствует;
-   ordering сохраняется;
-   изменение является узким применением уже утверждённого outbox
    pattern, а не скрытым redesign EventBus.

Если введена новая глобальная delivery/retry architecture без ADR →
`ARCHITECTURE DECISION REQUIRED`.

## 19. OrderRequested regression

Implementation report сообщает, что промежуточная версия давала
`attempts=2`. Независимо доказать исправление для
success/failure/rollback/replay.

Нормальный flow не должен получать дополнительную delivery только из-за
nested `publishPending`.

Проверить существующие sale-completion/order-requested contracts.

## 20. Не переоценивать EventBus fix

Установить точную границу исправления. Если независимого background
publisher/retry worker по-прежнему нет, docs не должны утверждать, что
2.12E решила общий durable retry gap. Этот cross-cutting hardening
остаётся за Step 2.17.

## 21. CommissionAccrued event

Проверить event name/envelope/payload:

-   source aggregate;
-   correlationId;
-   causationId;
-   actor согласно ADR-0010;
-   PII-free;
-   immutable identifiers;
-   causation от OrderCreated;
-   один business event на реальный accrual.

Не заявлять transport exactly-once; доказать one business effect через
inbox/idempotency.

## 22. Boundaries --- HARD GATE

Repo-wide доказать:

### Refund

0 mutation original Commission/Accrual/snapshot; 0 reversal в 2.12E.

### Dispute

0 mutation/automatic adjustment; OPENED не считается liability outcome.

### Payment / PSP / 2.12C

0 SPLIT_AT_PAYMENT; 0 PSP adapter/split; 0 Payment→Commission producer;
0 PSP-owned rate.

### Ledger / 2.12D

0 LedgerTransaction auto-posting.

### ProviderFee / Settlement / Payout

0 side effects.

### Invoice / Step 2.14

0 Invoice, numbering, invoice events.

### Booking / Availability

0 mutations.

## 23. Negative boundary matrix

После нормального PARTNER_COLLECT flow доказать:

  Fact/domain                          Expected
  ---------------------------------- ----------
  Commission                                  1
  CommissionAccrual                           1
  CommissionAccrued business event            1
  LedgerTransaction                           0
  ProviderFee                                 0
  Settlement                                  0
  Payout                                      0
  Invoice                                     0
  Refund created by accrual                   0
  Dispute created by accrual                  0
  Payment mutation by accrual                 0
  Booking mutation                            0
  Availability mutation                       0

## 24. RBAC/read API

Читать фактический `ROLE_PERMISSIONS`, не docs.

Проверить list/detail Commission и Accrual для всех ролей. Ожидаемый
read-set использовать только если код подтверждает:
FINANCE/DIRECTOR/ANALYST + ADMIN через ALL_PERMISSIONS.

Отдельно проверить SALES_MANAGER, OPERATOR, PARTNER, BUYER, MODERATOR,
MARKETER, anonymous.

Проверить 401/403/404.

## 25. Public write surface / mass assignment

Commission/Accrual producer-owned. Публичные arbitrary POST/PATCH/DELETE
для facts должны отсутствовать, если контракт не требует иного.

Проверить forged server-owned fields во всех затронутых request paths:
snapshot, sellerPartnerId, rate, baseAmount, policyCode, selectedAt,
fact code/status/amount/accruedAt.

Учесть, что ValidationPipe whitelist может silently strip поля до
service validation; где проект требует explicit 422, проверять raw body
convention.

## 26. Read API quality

Проверить list/detail, filters, pagination, money serialization.

Adversarial:

-   page=0;
-   pageSize=0;
-   pageSize\>max;
-   page=abc;
-   unapproved filters;
-   unknown code → 404.

Money в API --- decimal string, не float authority.

## 27. Temporal / IDs / immutability

Проверить семантику:

-   selectedAt = policy selection/freeze instant;
-   accruedAt = approved accrual recognition instant;
-   createdAt = persistence time.

Без fabricated backfill и `updatedAt` как business time.

IDs: CMS-######## и CAA-######## через canonical IdsService, корректная
transaction/collision behavior, ids.md updated.

Проверить фактический enforcement immutability: update/delete routes,
raw SQL, `updatedAt`, FK/cascade. Не заявлять DB-trigger immutability,
если её нет.

## 28. Migration --- HARD GATE

SQL `20260814190000_add_partner_collect_commission_accrual` проверить
напрямую:

-   additive;
-   no destructive ALTER;
-   no fabricated backfill;
-   correct indexes/uniques;
-   legacy nullable safety;
-   no db push.

Фактически прогнать migrate status, fresh DB migrate deploy через normal
harness и live→schema diff. Ожидаемые 56/56 --- только baseline claim;
подтвердить фактом.

## 29. Legacy compatibility

Pre-2.12E Quote/Checkout/Sale/Order без snapshot должны оставаться
валидными.

Запрещены:

-   historical backfill current policy;
-   fabricated sellerPartnerId;
-   fabricated Commission/Accrual;
-   NULL → 0%.

## 30. Channel semantics

Проверить canonical mapping согласно ADR-0013:

-   MARKETPLACE --- commission-capable;
-   PARTNER_STOREFRONT --- no TravelHub commission;
-   DIRECT / BUYER_REQUEST --- no commission;
-   deferred channels remain deferred.

Не выводить channel из PSP/provider/UI route.

## 31. Required adversarial e2e

Если покрытия нет --- добавить review tests минимум для:

1.  normal PARTNER_COLLECT;
2.  exact rounding;
3.  policy changed after freeze;
4.  mutable product/catalog changed after freeze;
5.  NO_POLICY;
6.  AMBIGUOUS;
7.  missing seller;
8.  multi-seller;
9.  identical replay;
10. divergent rate;
11. divergent base;
12. divergent seller;
13. concurrent duplicate;
14. corrupted snapshot;
15. Refund leaves original accrual unchanged;
16. Dispute leaves original accrual unchanged;
17. zero Ledger/Settlement/Payout/Invoice;
18. RBAC;
19. read 404;
20. pagination validation;
21. legacy NULL;
22. OrderRequested attempts regression;
23. rollback before Order commit → no Commission;
24. correlation/causation.

Не ослаблять существующие тесты.

## 32. Unit tests

Проверить/добавить: calculation/rounding, snapshot validation,
no-policy, malformed snapshot, identical replay, divergent replay, known
P2002, unknown P2002, non-P2002 rethrow, seller invariant.

## 33. Regression

Из-за cross-cutting EventBus change targeted regression должна включать
Finance и:

-   Sale completion;
-   OrderRequested/Order creation;
-   Booking;
-   Payment;
-   Refund;
-   Dispute;
-   event-envelope;
-   inbox/outbox;
-   temporal readiness, если затронуто.

Затем полный serial e2e.

Фактически выполнить:

### Backend

-   tsc/typecheck;
-   production build;
-   unit;
-   targeted e2e;
-   full serial e2e.

### Frontend

-   typecheck;
-   Vitest;
-   production build, если это baseline.

### DB

-   migrate status;
-   fresh replay;
-   drift diff.

Не копировать counts из implementation report без запуска.

## 34. Documentation consistency

Сверить Roadmap, ADR-0013, 2.12E arch doc, api.md, events.md, ids.md,
implementation report.

Docs не должны утверждать, что завершены:

-   2.12C PSP split;
-   2.12D ledger posting;
-   refund commission reversal;
-   dispute liability adjustment;
-   Invoice;
-   autonomous EventBus retry worker.

Stale docs исправлять как review fix.

## 35. Review fixes

Разрешены только однозначные исправления уже утверждённого контракта:
silent divergent replay, wrong RBAC, decimal bug, duplicate delivery,
wrong event/audit naming, missing controlled conflict, broken verbatim
propagation, missing high-risk test, stale docs.

Нельзя изобретать новую business policy.

Для каждого review fix указать severity, defect, evidence, files
changed, proving tests.

## 36. Architecture stop conditions

Вернуть `ARCHITECTURE DECISION REQUIRED`, если обнаружено:

1.  противоречие canonical commission base;
2.  неразрешимый seller source/ownership;
3.  противоречие recognition moment PARTNER_COLLECT;
4.  неоднозначная monetary authority Commission vs Accrual;
5.  one-Commission-per-Order противоречит approved V1;
6.  freeze boundary конфликтует с ADR-0013/2.11;
7.  multi-seller требует нового policy decision;
8.  корректность текущего факта требует refund/dispute policy, которого
    нет;
9.  EventBus fix требует нового глобального delivery redesign;
10. review требует придумать PSP split semantics.

Обычный implementation bug не является architecture stop.

## 37. Roadmap update

Если review успешен, обновить только статус 2.12E на:

`✅ STRICT REVIEW COMPLETED — APPROVED ...`

Не стартовать другой step.

Step 2.14 не разблокировать автоматически. 2.12C не считать начатым.

## 38. NEXT dependency reconciliation --- REQUIRED

После verdict определить **eligible NEXT по dependency graph, не по
номеру**.

Отдельно проверить prerequisites/status:

-   2.12A PSP Adapter Foundation;
-   2.12B webhook/provider lifecycle;
-   2.12C SPLIT_AT_PAYMENT;
-   2.12D Ledger posting;
-   Step 2.14 resume;
-   Step 2.14F Commission Policy Management UI.

Если 2.12C по-прежнему hard-depends on 2.12A/2.12B --- явно
зафиксировать это.

Это только planning metadata. NEXT **не начинать**.

## 39. Required report

Создать:

`docs/prompts/PHASE_2_STEP_2.12E_PARTNER_COLLECT_COMMISSION_ACCRUAL_FOUNDATION_STRICT_REVIEW_REPORT.md`

Минимальные секции:

1.  Verdict
2.  Methodology
3.  Baseline
4.  Sources inspected
5.  Scope reconciliation
6.  Policy authority
7.  Freeze chain
8.  Seller snapshot
9.  Multi/no-seller
10. Money/base/rounding
11. Corrupted snapshot
12. Write-path audit
13. Commission vs Accrual semantics
14. Atomicity
15. Idempotency/divergent replay
16. Concurrency
17. EventBus OrderCreated audit
18. OrderRequested regression
19. CommissionAccrued envelope
20. Refund/Dispute boundaries
21. Payment/PSP/Ledger boundaries
22. Settlement/Payout/Invoice boundaries
23. RBAC/read API
24. Temporal/IDs/immutability
25. Migration/fresh replay
26. Legacy compatibility
27. Negative boundary matrix
28. Review fixes
29. Backend/frontend/DB regression
30. Documentation consistency
31. Files changed
32. Stop-condition result
33. Roadmap update
34. Dependency reconciliation
35. Exact NEXT
36. Final canonical verdict

## 40. HARD STOP

После strict review, необходимых contract-preserving fixes, полной
regression, report, Roadmap update и определения NEXT:

**STOP.**

Не реализовывать NEXT.

Особое предупреждение: не превращать CommissionAccrual в заявление о
double-entry accounting, GAAP/IFRS recognition, settled receivable,
Ledger balance, Invoice, Payout или cash receipt --- эти контракты не
следуют автоматически из Step 2.12E.

Финальная строка отчёта --- ровно выбранный verdict из §1.
