# PHASE 2 — STEP 2.14E — CHANNEL-BASED COMMISSION RULES FOUNDATION — IMPLEMENTATION REPORT

## 1. VERDICT

`PHASE 2 STEP 2.14E IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

## 2. REPOSITORY BASELINE

master @ `3ba2e70`; до изменений: unit 548/548, serial e2e 1105/1105 (63 suites),
frontend 135/135, migrations 54/54, drift 0. После: unit **567/567** (+19),
serial e2e **1120/1120 (64 suites, +15)**, frontend 135/135, migrations **55/55**,
drift 0.

## 3. SOURCES INSPECTED

ADR-0013 (canonical), decision report, reconciliation report, Roadmap v3, арх-доки
2.10–2.13A, schema.prisma, FinanceService/Controller/validation/module,
permissions.constants.ts, security.service.ts, IdsService, ids.md/api.md/events.md,
refund-flow e2e harness, финанс-миграции (формат SQL).

## 4. ADR-0013 RECONCILIATION

Все решения D1–D23 имплементированы ровно в объёме 2.14E (policy foundation):
D1 (Finance-owned) ✓; D2 (channel-only matching) ✓; D3 (PERCENTAGE) ✓; D15 (channel
vocabulary + MARKETPLACE create-гейт) ✓; D16 (effective/versioning) ✓; D17 (тривиальная
precedence + fail-closed) ✓; D18 (RBAC manage) ✓; D19 (0 событий) ✓. Одна
**не-semantic clarifications** (зафиксирована): D18 read-set — фактические держатели
`finance.commission.read` в ROLE_PERMISSIONS: FINANCE/DIRECTOR/ANALYST (SALES_MANAGER
НЕ имеет — этот read-набор существовал до 2.14E); ADR-0013 обновлён.

## 5. EXISTING-STATE AUDIT

0 существующих CommissionPolicy/rate/полиси-полей (только foundation Commission/
CommissionAccrual schema-only, 0 writer-ов); CommissionChannel/RateType отсутствовали;
`finance.commission.read/write` существовали (read: FINANCE/DIRECTOR/ANALYST;
write: FINANCE; manage — отсутствовал); Finance master-data паттерн — Currency/
ExchangeRate/Tax (FinanceService).

## 6. OWNERSHIP

Finance — единственный writer (`CommissionPolicyService`); 0 других
commissionPolicy create/update/upsert/delete в prod (repo-wide аудит); Settings/
Catalog/Sales/PSP не дублируют.

## 7. COMMISSION CHANNEL CONTRACT

`CommissionChannel` enum (finance): MARKETPLACE / PARTNER_STOREFRONT / DIRECT /
BUYER_REQUEST. V1 create-гейт: только MARKETPLACE; no-commission каналы → 422 (T6);
CUSTOM_DOMAIN/API не добавлены (Roadmap 2.5B deferred). AcquisitionSource НЕ
переиспользован как есть.

## 8. COMMISSION POLICY SCHEMA

`finance.CommissionPolicy` (CMP-*): code unique, channel, rateType (PERCENTAGE,
server-derived), rate DECIMAL(18,6), status (DRAFT/ACTIVE/ARCHIVED), version Int,
effectiveFrom/effectiveTo, createdAt/updatedAt; индексы (code unique,
channel+status, effectiveFrom). `CommissionPolicyHistory` (policyId FK cascade,
action, version, fields Json — полный state, actorId/actorName, comment, createdAt).

## 9. IDENTIFIER

`CMP-` зарегистрирован в ids.md; генерируется IdsService.nextCode в той же
транзакции, server-owned; P2002 → controlled 409.

## 10. PERCENTAGE DECIMAL CONTRACT

Десятичная ДОЛЯ: 0 < rate < 1 (0.15 = 15%); «10»/«0»/«1.5»/«-0.05»/«0.1234567» →
422; ≤ 6 знаков (DECIMAL(18,6), прецедент ExchangeRate rate ≠ amount); API —
строки; 0 JS float. Representation документирован: 0.10 = 10%.

## 11. RATE TYPE

`rateType` = PERCENTAGE (enum с единственным значением; forged rateType → 422;
fixed/hybrid/tiered — deferred, аддитивное расширение enum).

## 12. EFFECTIVE DATES

effectiveFrom обязателен; effectiveTo nullable (open-ended); effectiveTo >
effectiveFrom (иначе 422); ISO 8601 DTO-валидация; createdAt НЕ precedence;
lookup по business instant [from, to).

## 13. VERSION SEMANTICS

version server-owned (инкремент на каждую draft-итерацию; клиент не передаёт —
422). ACTIVE/ARCHIVED immutable → историческая (code, version) стабильна;
CommissionPolicyHistory хранит полный state на версию (future frozen snapshot
репродукция). Update-in-place только в DRAFT.

## 14. OVERLAP / AMBIGUITY INVARIANT

Сериализация: `pg_advisory_xact_lock(hashtext('commission-policy:'||channel))` на
create/update/activate/archive. activate: любой другой ACTIVE policy канала с
пересечением [from, to) → **409** (T9); concurrent conflicting activates → один
201 + один 409, 0 raw 500 (T10); resolver backstop: >1 applicable → AMBIGUOUS →
no policy. Не insertion order / createdAt / row order.

## 15. POLICY RESOLUTION

`resolveCommissionPolicy(channel, instant)`: NO_COMMISSION_CHANNEL (channel ∉
MARKETPLACE) / NO_POLICY / POLICY_FOUND / AMBIGUOUS; half-open [effectiveFrom,
effectiveTo); детерминирован; НЕ считает amount; НЕ читает Catalog; НЕ пишет.
HTTP read-path `GET /finance/commission-policies/resolve` (T7/T8).

## 16. CRUD / COMMANDS

create (DRAFT) / update (DRAFT, version+1) / activate (DRAFT→ACTIVE, overlap-check) /
archive (→ARCHIVED, terminal) / list / detail / resolve. Нет «calculate» endpoint;
нет Payment/Order mutation endpoints.

## 17. MASS ASSIGNMENT

`COMMISSION_POLICY_FORBIDDEN_KEYS` (raw-body loud 422): id/code/version/createdAt/
updatedAt/status/rateType/actorId/actorName/correlationId/causationId (T4).

## 18. RBAC

`finance.commission.manage` (НОВОЕ; FINANCE + ADMIN via ALL_PERMISSIONS):
create/update/activate/archive. Read: `finance.commission.read` — FINANCE/DIRECTOR/
ANALYST (factual ROLE_PERMISSIONS); SALES_MANAGER/OPERATOR/BUYER/PARTNER → 403 (T2).
Anonymous → 401 (T1). Каталог permissions.constants.ts + security.service.ts
обновлены.

## 19. AUDIT LOG

AuditLog snake_case: `finance.commission_policy.created/updated/activated/archived`;
details PII-free (code/channel/rate/version); + CommissionPolicyHistory (полный
state snapshot на версию).

## 20. EVENTS

**0 новых доменных событий** (ADR-0013 D19). CommissionAccrued/CommissionAdjusted
не эмитятся; policy-событий нет (master data + AuditLog, конвенция
Currency/ExchangeRate/Tax).

## 21. COMMISSION FACT BOUNDARY

0 Commission rows создано policy CRUD (T12 — счётчик неизменен).

## 22. COMMISSION ACCRUAL BOUNDARY

0 CommissionAccrual rows (T12); accrual-механика — 2.12E (NOT STARTED).

## 23. PAYMENT / REFUND / DISPUTE BOUNDARY

0 Payment/Refund/Dispute rows; 0 lifecycle changes; 0 adjustments (T12; boundaries
§20 промпта соблюдены).

## 24. LEDGER BOUNDARY

0 LedgerTransaction writes; 2.12D не реализован; policy — master data, не ledger fact.

## 25. PROVIDER FEE / SETTLEMENT / PAYOUT BOUNDARY

0 ProviderFee/Settlement/Payout (T12); ProviderFee остаётся отдельным концептом.

## 26. TAX / FX BOUNDARY

0 tax/FX logic в resolver/CRUD (T12; §23 промпта); base/currency — future
calculation concern (ADR D23).

## 27. SELLER / PARTNER SNAPSHOT DEPENDENCY

`Order.sellerPartnerId` (ADR D14) **НЕ реализован в 2.14E** — документированная
зависимость следующего freeze-шага; 0 Commission producer-ов может быть включено
до его удовлетворения; 0 live Catalog lookup.

## 28. MIGRATION

`20260814180000_add_commission_policy_foundation` — аддитивная (3 enums +
CommissionPolicy + CommissionPolicyHistory + индексы); без backfill; fresh replay
доказан (serial e2e 64 suites с нуля); drift 0; migrate 55/55.

## 29. LEGACY COMPATIBILITY

0 backfill исторических фактов; legacy-строки (0 Commission/Accrual) валидны;
0 ретроспективного назначения policy историческим сделкам.

## 30. CONCURRENCY

T10: concurrent conflicting activates (overlapping окна) под advisory lock →
один 201 + один 409, 0 raw 500; не остаётся двусмысленных ACTIVE.

## 31. P2002 / DB ERROR HANDLING

create: известный unique collision (code) → controlled ConflictError (не raw 500);
unknown DB errors → rethrow (unit: connection reset → rethrow). Не глобальный
convert P2002 → idempotent success.

## 32. IDEMPOTENCY SEMANTICS

Policy creation НЕ имеет business idempotency-identity (каждая policy — отдельный
CMP-* код); duplicate → уникальный code (новая policy) — документировано; activate/
archive — idempotent no-op на terminal-статусе (ACTIVE→activate, ARCHIVED→archive).
Divergent payload не «молча успешен»: update/activate-конфликты → 422/409.

## 33. UNIT COVERAGE

`commission-policy.service.spec.ts` — 19 тестов (rate contract, channel vocabulary +
V1 гейт, interval, P2002 mapping, unknown DB rethrow, version semantics, overlap
409, activate success, resolver NO_COMMISSION_CHANNEL/NO_POLICY/AMBIGUOUS/POLICY_FOUND,
not-found). Unit total 567/567.

## 34. E2E COVERAGE

`commission-policy-foundation.e2e-spec.ts` — 15 тестов T1–T15 (§32 все маппинг-пункты:
401/RBAC/create/422/validation/no-commission/resolution/boundary/overlap/concurrency/
historical-safety/zero-facts/no-cross-domain/pagination/migration). 15/15 PASS.

## 35. REPO-WIDE WRITE-PATH AUDIT

`commissionPolicy.*` writers — только `commission-policy.service.ts` (0 в других
prod-файлах); `commission.*`/`commissionAccrual.*` факт-writers — 0; hardcoded
percentage — 0 (только тест-фикстуры «0.15» и т.п., не production defaults).

## 36. HARDCODED-RATE AUDIT

0 бизнес-ставок в production коде (5%/10%/15%/0.1/0.15 отсутствуют как policy);
ставки — только data через API; документированная representation (0.15 = 15%).

## 37. ISSUES FOUND DURING IMPLEMENTATION

1. `assertValidRange` с `effectiveTo: null` → `new Date(null)` = epoch → ложный 422
   для open-ended политик. **Исправлено:** `effectiveTo ?? undefined` в create.
2. E2E-тесты пересекались по effective-окнам (T8/T9/T10/T12 cross-contamination).
   **Исправлено:** disjoint окна (2030–2044) + half-open границы.
3. ADR-0013 D18 read-set содержал SALES_MANAGER — фактический ROLE_PERMISSIONS не
   даёт SALES_MANAGER `finance.commission.read`. **Исправлено:** ADR-0013 уточнён
   (не-semantic clarification), e2e T2 приведён к факту.

## 38. BACKEND REGRESSION

tsc --noEmit ✓; build ✓; unit **567/567**; target e2e (9 suites, --runInBand)
**123/123**; serial e2e **1120/1120 (64 suites, +15)**.

## 39. FRONTEND REGRESSION

tsc --noEmit ✓; Vitest **135/135** (23 files); production build ✓.

## 40. DB REGRESSION

migrate deploy ✓ (55/55); migrate status «up to date»; drift **0** («No difference
detected»); fresh replay через e2e harness (64 suites с нуля) ✓; 0 db push.

## 41. FILES CHANGED

- `backend/prisma/schema.prisma` (+CommissionPolicy/History/enums);
- `backend/prisma/migrations/20260814180000_add_commission_policy_foundation/migration.sql`;
- `backend/src/modules/finance/commission-policy.service.ts` (new);
- `backend/src/modules/finance/commission-policy.service.spec.ts` (new);
- `backend/src/modules/finance/finance.controller.ts` (+7 endpoints);
- `backend/src/modules/finance/finance.module.ts` (+provider);
- `backend/src/modules/finance/finance.validation.ts` (+rate/channel/DTOs/forbidden);
- `backend/src/security/permissions.constants.ts` (+finance.commission.manage);
- `backend/src/security/security.service.ts` (+каталог);
- `backend/test/commission-policy-foundation.e2e-spec.ts` (new);
- `docs/adr/ADR-0013-commission-policy-contract.md` (D18 clarification);
- `docs/architecture/commission-policy-foundation.md` (new);
- `docs/contracts/api.md` (+2.14E секция); `docs/contracts/ids.md` (+CMP-);
- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (2.14E статус);
- `docs/prompts/PHASE_2_STEP_2.14E_..._IMPLEMENTATION_REPORT.md` (this).

## 42. DEFERRED SCOPE

Расчёт/freeze на Quote ISSUE; Order.sellerPartnerId (freeze-шаг); Commission fact
producer; CommissionAccrual (2.12E); SPLIT_AT_PAYMENT (2.12C, после 2.12A/B);
buyer invoice (2.14); adjustments (Refund/Dispute); tax/FX; partner-дименсия;
fixed/hybrid/tiered rates.

## 43. ROADMAP UPDATE

Step 2.14E → `🚧 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
(с evidence-сводкой); НЕ APPROVED; 2.14 остаётся BLOCKED; 2.12C/2.12E/2.14A–D
NOT STARTED; NEXT = **PHASE 2 — STEP 2.14E — STRICT REVIEW**.

## 44. ARCHITECTURE DECISION STATUS

ADR-0013 — DECIDED (подтверждён имплементацией; D18 read-set уточнён по факту).
0 конфликтов с каноном; 0 stop-conditions.

## 45. EXACT NEXT

`PHASE 2 — STEP 2.14E — STRICT REVIEW` (не выполняется в этом проходе).

## 46. FINAL CANONICAL STATEMENT

`PHASE 2 STEP 2.14E IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

- Finance-owned CommissionPolicy authority материализован (CMP-*, channel-only V1,
  PERCENTAGE, DRAFT→ACTIVE→ARCHIVED, overlap fail-closed, детерминированный
  resolver, RBAC finance.commission.manage, 0 событий, 0 фактов, 0 hardcoded rates);
- регрессия: unit 567/567, serial e2e 1120/1120 (64 suites, +15), frontend
  135/135 + build, migrate 55/55 drift 0;
- 2.14 ⛔ BLOCKED; 2.12C/2.12E ⏳ NOT STARTED; NEXT = STRICT REVIEW.

---

## STRICT REVIEW ADDENDUM (APPROVED WITH REVIEW FIXES)

Проведён независимый adversarial strict review (промпт
`PHASE_2_STEP_2.14E_COMMISSION_POLICY_FOUNDATION_STRICT_REVIEW.md`, отчёт
`PHASE_2_STEP_2.14E_COMMISSION_POLICY_FOUNDATION_STRICT_REVIEW_REPORT.md`).

**Найден и исправлен HIGH-дефект (валидация rate):**
1. **Scientific notation bypass** — «1e-7» (0.0000001) проходил старую валидацию
   (`Number()`-range + split по «.»), а Postgres DECIMAL(18,6) округлял значение
   до 0.000000 → через API создавалась policy с rate 0 (нарушение 0 < rate < 1,
   resolver молча возвращал 0%). Фикс: каноническая форма
   `/^0\.(?!0+$)\d{1,6}$/` (regex-authority, без JS float arithmetic) —
   scientific notation, whitespace, «+0.15», «.15», «0,15», all-zero fraction,
   percent-as-number → контролируемый 422.
2. **Whitespace → raw 500** — « 0.15 » проходил `Number()`-трим, но
   `Prisma.Decimal` бросал `[DecimalError]` → catch-all → 500. Тот же фикс.

**Исправлен stale-комментарий контроллера** (SALES_MANAGER read — по факту
ROLE_PERMISSIONS SALES_MANAGER commission.read НЕ имеет; api.md/арх-док/ADR-0013
D18 уже были точны).

**Регрессия после фиксов:** unit 583/583 (+16 adversarial rate-тестов),
e2e T5 расширен (16 невалидных rate) + T5b (границы 0.000001/0.999999 приняты),
serial e2e 1121/1121 (64 suites), frontend 135/135 + build, migrate 55/55,
live DB drift 0 (migrate diff --exit-code 0), fresh replay (e2e harness: migrate
deploy на свежей БД).

Вердикт: `PHASE 2 STEP 2.14E STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`.
NEXT = STEP 2.12E — PARTNER_COLLECT / COMMISSION ACCRUAL FOUNDATION (не начинается).
