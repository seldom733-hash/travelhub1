# PHASE 2 — STEP 2.14E — COMMISSION POLICY FOUNDATION — STRICT REVIEW

## Цель

Провести независимый adversarial Strict Review реализованного Step 2.14E. Implementation report не считать доказательством: проверять фактический production-код, Prisma schema, SQL migration, RBAC, API, tests, runtime и документацию.

Текущий статус:

`PHASE 2 STEP 2.14E IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Не начинать 2.12C, 2.12E, 2.14, 2.14A–D или иной следующий шаг.

## Архитектурный baseline

ADR-0013 Commission Policy Contract определяет:

- Finance владеет `CommissionPolicy`;
- ставка комиссии устанавливается вручную FINANCE/ADMIN как master data;
- никаких hardcoded ставок;
- V1 dimension = channel;
- MARKETPLACE — commission-bearing;
- PARTNER_STOREFRONT, DIRECT, BUYER_REQUEST — no-commission;
- V1 rate type = PERCENTAGE;
- `0.15 = 15%`;
- base = frozen discounted Order.total, tax-exclusive;
- будущий selection/freeze boundary = Quote ISSUE;
- collection models: SPLIT_AT_PAYMENT / PARTNER_COLLECT;
- ProviderFee ≠ TravelHub Commission;
- multi-seller fail-closed;
- Refund adjustment и Dispute liability handling deferred;
- policy events не требуются;
- Commission/CommissionAccrual producers в 2.14E не реализуются.

## 1. Ownership / write-path — HARD GATE

Repo-wide проверить все writer-ы `CommissionPolicy`.

Доказать:

- единственный canonical production writer находится в Finance;
- Sales/Order/Catalog/Settings не владеют ставкой;
- нет raw SQL/seed/job/consumer скрытых writer-ов;
- нет второго commission-rate authority;
- нет production hardcoded commission percentages.

Искать минимум:
`CommissionPolicy`, `commissionRate`, `commissionPercent`, `commissionPercentage`,
`platformFee`, `platformCommission`, `takeRate`, `feeRate`, `MARKETPLACE`.

Второй authority = HIGH либо ARCHITECTURE DECISION REQUIRED.

## 2. Manual master-data semantics — HARD GATE

Доказать ключевой контракт:

**ставка комиссии вводится вручную уполномоченным FINANCE/ADMIN через policy-management API и хранится как versioned master data.**

Она НЕ должна:

- выводиться из ProviderFee;
- приходить от PSP как authority;
- вычисляться из Payment;
- вычисляться из Catalog price;
- быть hardcoded;
- зависеть от live mutable lookup вне policy.

Проверить однозначность API-контракта:

`0.15 = 15%`

Не допускать путаницу между `15`, `15%`, `0.15`.

## 3. Rate / Decimal validation

Adversarial cases:

- 0, negative, 1, >1;
- `"10"`, `"15"`, `"0.15"`, `"0.150000"`, `"0.1500001"`;
- scientific notation;
- whitespace;
- NaN / Infinity;
- malformed string;
- JS numeric/float input;
- precision/overflow.

Требование: authoritative decimal без JS float arithmetic; `0 < rate < 1`, max 6 decimal places.

## 4. Channel contract — HARD GATE

Проверить enum и все mutation paths.

V1:

- MARKETPLACE — policy allowed;
- PARTNER_STOREFRONT — no commission;
- DIRECT — no commission;
- BUYER_REQUEST — no commission;
- future channels не получают commission semantics молча.

`NO_COMMISSION_CHANNEL` и `NO_POLICY` — разные состояния. Отсутствие policy нельзя молча превращать в 0%.

## 5. Lifecycle / CAS

Проверить фактическую state machine, ожидаемо:

`DRAFT → ACTIVE → ARCHIVED`

Update — только DRAFT.

Проверить update ACTIVE/ARCHIVED, repeated activate/archive, archive DRAFT, forged status/version/server fields, stale version и concurrent transitions. Expected conflicts → controlled 4xx, не raw 500.

## 6. Effective dates

Проверить `effectiveFrom/effectiveTo`, open-ended policy, `[from,to)`, `from < to`, UTC/ISO, future/expired policy, exact boundary instant, timezone offset.

Обязательно перепроверить implementation-time fix:

`assertValidRange(null) → epoch`

Open-ended policy не должна порождать 1970-derived semantics.

## 7. Overlap / concurrency — HARD GATE

Для одного channel не должно быть двух применимых ACTIVE policy на один instant.

Проверить:

- finite overlap;
- finite + open-ended;
- open-ended + open-ended;
- adjacent ranges (`A.to == B.from`) — допустимы;
- nested;
- same-start/same-end;
- concurrent activation.

Если используется `pg_advisory_xact_lock`, доказать deterministic lock key и выполнение lock + overlap check + activation в одной transaction без TOCTOU. Concurrent overlap → один winner, второй controlled conflict.

## 8. Resolver determinism — HARD GATE

Проверить `resolveCommissionPolicy(channel, instant)`:

- только canonical policy storage;
- никаких live Payment/Order/Catalog lookups для ставки;
- корректный `[from,to)`;
- exactly one → policy;
- no policy → fail-closed;
- no-commission channel → отдельный fail-closed result;
- ambiguity → fail-closed.

Недопустим `findFirst`-подход, молча выбирающий одну из конфликтующих policy.

## 9. Version/history

Проверить `CommissionPolicyHistory`:

- history на create/update/activate/archive;
- monotonic version;
- immutable historical rows;
- достаточный полный state для восстановления версии;
- AuditLog не заменяет history.

## 10. Freeze boundary containment

ADR-0013 задаёт будущий Quote ISSUE freeze boundary, но 2.14E — только foundation.

Доказать отсутствие преждевременной реализации:

- Quote/Checkout/Sale/Order commission snapshot;
- `Order.sellerPartnerId`;
- commission calculation;
- Commission/CommissionAccrual creation.

## 11. Commission fact boundary

Repo-wide проверить отсутствие:

- Commission producer;
- CommissionAccrual producer;
- CommissionAccrued event;
- Payment→Commission;
- Order→CommissionAccrual;
- Refund commission adjustment;
- Dispute commission adjustment.

Schema-only foundation не должна незаметно стать runtime flow.

## 12. ProviderFee separation — HARD GATE

`ProviderFee ≠ TravelHub Commission`.

Запрещено использовать ProviderFee amount/rate как commission policy или выводить TravelHub Commission из PSP cost.

## 13. Collection-model boundary

Даже если policy хранит metadata SPLIT_AT_PAYMENT/PARTNER_COLLECT, Step 2.14E не должен выполнять:

- PSP split;
- Payment capture split;
- transfer instruction;
- CommissionAccrual;
- partner receivable;
- settlement/payout adjustment.

## 14. Multi-seller safety

Поскольку `Order.sellerPartnerId` deferred:

- resolver не определяет seller через live Catalog;
- policy selection не зависит от mutable seller lookup;
- fake seller snapshot отсутствует;
- dependency задокументирована.

## 15. RBAC factual audit

Проверить фактические `ALL_PERMISSIONS`, `ROLE_PERMISSIONS`, seeding, decorators и guards.

`finance.commission.manage` должен принадлежать FINANCE + ADMIN.

Read-set определить по фактическому коду, а не по отчёту. Проверить negative roles и отсутствие privilege escalation через generic permissions.

## 16. Mass assignment

Проверять raw request body до whitelist stripping.

Forged server-owned fields должны давать explicit 422:

`code`, `status`, `version`, timestamps, history/internal IDs и прочие server-owned поля.

## 17. API

Проверить create/update/activate/archive/list/detail, pagination/filter whitelist, unknown/malformed code, page=0, oversized pageSize, unknown filters и extra body keys. Undocumented mutation routes отсутствуют.

## 18. Events / AuditLog

Ожидается 0 domain events для policy management.

Repo-wide проверить отсутствие `CommissionPolicyCreated/Activated/...` и скрытых generic outbox events.

AuditLog проверить на стабильные snake_case action names, отсутствие PII/secrets/full raw body.

## 19. P2002 / error mapping

Нельзя глобально трактовать любой P2002 как no-op.

Проверить CMP code collision, expected constraint, unknown P2002 и concurrency. Expected conflicts → controlled 4xx.

## 20. Migration

Проверить фактическую migration:

`20260814180000_add_commission_policy_foundation`

Требования:

- additive;
- no destructive ALTER;
- no fabricated backfill;
- no hardcoded policy/rate rows;
- enums/indexes/uniques соответствуют invariants;
- fresh replay реальными migrations;
- migrate status;
- live DB → schema diff.

Implementation baseline: 55/55 migrations, drift 0.

## 21. Hardcoded-rate audit

Repo-wide искать подозрительные constants/arithmetic (`0.1`, `0.15`, `/100`, `*100`, commission/takeRate/platformFee), классифицируя контекст. Test fixtures допустимы; production commission rate constant — нет.

## 22. Documentation consistency

Сверить ADR-0013, Roadmap v3, commission-policy architecture doc, api.md, ids.md, implementation report, schema comments, RBAC matrix.

Документация должна ясно фиксировать:

- ручное управление ставкой;
- `0.15 = 15%`;
- channel-only V1;
- no-commission channels;
- no hardcoded rates;
- future Quote ISSUE freeze;
- deferred 2.12C/2.12E;
- Step 2.14 ещё BLOCKED.

Нельзя утверждать, что commission calculation/accrual уже работает.

## 23. Required high-risk tests

Убедиться, что доказаны:

1. anonymous 401;
2. forbidden roles 403;
3. FINANCE/ADMIN manage;
4. create DRAFT;
5. valid decimal rate;
6. invalid rate matrix;
7. no-commission channel rejection;
8. DRAFT update + version/history;
9. ACTIVE ordinary update forbidden;
10. overlap rejected;
11. concurrent overlap — one winner;
12. adjacent ranges accepted;
13. open-ended range;
14. resolver exact match;
15. resolver NO_POLICY;
16. resolver NO_COMMISSION_CHANNEL;
17. archive semantics;
18. mass assignment 422;
19. no Commission/Accrual/Ledger/etc side effects;
20. no cross-domain mutations.

Добавлять тесты только для реально недоказанных high-risk cases.

## 24. Regression

После review fixes выполнить фактические:

Backend:
- `tsc --noEmit`;
- build;
- unit;
- targeted e2e;
- full serial e2e.

Frontend, если production frontend не менялся:
- tsc;
- Vitest;
- production build.

DB:
- migrate status;
- drift diff;
- fresh replay.

Implementation baseline:
- unit 567/567;
- serial e2e 1120/1120 (64 suites);
- frontend 135/135;
- migrations 55/55.

После fixes counts могут увеличиться — отчёт должен содержать фактические результаты.

## 25. Architecture stop conditions

Немедленно остановиться с:

`PHASE 2 STEP 2.14E STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

если обнаружено:

1. два commission policy authority;
2. неясный owner ставки;
3. необходимость hardcoded rate;
4. конфликт с ADR-0013;
5. смешение ProviderFee/Commission;
6. неразрешимый channel semantics conflict;
7. overlap требует destructive redesign;
8. уже запущен monetary Commission producer с неразрешённой семантикой;
9. требуется fabricated backfill;
10. конфликт freeze boundary 2.11/policy selection нельзя исправить локально.

Не изобретать новое архитектурное решение внутри Strict Review.

## 26. Review fixes

Локальные дефекты, не меняющие архитектуру, исправить в этом review, добавить regression test и перепроверить.

Verdict:

`APPROVED WITH REVIEW FIXES`

или при отсутствии дефектов:

`APPROVED (NO REVIEW FIXES REQUIRED)`.

## 27. Roadmap / NEXT

После успешного review обновить 2.14E:

`✅ STRICT REVIEW COMPLETED — APPROVED ...`

NEXT определить по dependency graph и актуальному Roadmap/ADR-0013, не по номеру.

Ожидаемый dependency после 2.14E:

**PHASE 2 — STEP 2.12E — PARTNER_COLLECT / COMMISSION ACCRUAL FOUNDATION**

но это обязательно перепроверить по текущему Roadmap.

Step 2.14 должен оставаться BLOCKED, пока prerequisites не закрыты.

**Следующий step не начинать.**

## 28. Strict Review report

Создать:

`docs/prompts/PHASE_2_STEP_2.14E_COMMISSION_POLICY_FOUNDATION_STRICT_REVIEW_REPORT.md`

Минимальная структура:

1. Verdict
2. Repository baseline
3. Sources inspected
4. Ownership/write-path audit
5. Manual rate/master-data authority
6. Rate/Decimal validation
7. Channel semantics
8. Lifecycle/CAS
9. Effective dates
10. Overlap/concurrency
11. Resolver determinism
12. Version/history
13. RBAC
14. API/mass assignment
15. Events/AuditLog
16. P2002/error mapping
17. ProviderFee/Commission boundary
18. Deferred producer/freeze boundaries
19. Migration/fresh replay/drift
20. Issues found
21. Review fixes
22. Regression
23. Files changed
24. Stop-condition result
25. Roadmap status
26. Exact NEXT

## 29. Final response

Начать строго одним из:

`PHASE 2 STEP 2.14E STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED)`

`PHASE 2 STEP 2.14E STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

`PHASE 2 STEP 2.14E STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

Затем кратко указать hard gates, defects/fixes, фактическую регрессию, migrations/drift, Roadmap update и exact NEXT.

**STOP. Следующий step не начинать.**
