# PHASE 2 — STEP 2.14E — COMMISSION POLICY FOUNDATION — STRICT REVIEW REPORT

## 1. Verdict

`PHASE 2 STEP 2.14E STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

Независимый adversarial-аудит по промпту `PHASE_2_STEP_2.14E_COMMISSION_POLICY_FOUNDATION_STRICT_REVIEW.md`. Имплементационный отчёт не принимался на веру: проверялись фактический production-код (CommissionPolicyService, controller, finance.validation, schema, migration SQL), repo-wide write-path, фактический ROLE_PERMISSIONS, события, документация — с реальными прогонами.

**Найден и исправлен 1 HIGH-дефект** (класс «validation bypass → молчаливая 0%-policy» + raw 500) и **1 stale-docs дефект** (комментарий контроллера). Архитектура не менялась; 0 stop-conditions.

## 2. Repository baseline

- Branch `master` @ `3ba2e70` (+ рабочие изменения 2.14E: schema, миграция `20260814180000_add_commission_policy_foundation`, CommissionPolicyService, controller/module/validation, RBAC, unit+e2e, docs, ADR-0013).
- Baseline из имплементации: unit 567/567, serial e2e 1120/1120 (64 suites), frontend 135/135, migrations 55/55.

## 3. Sources inspected

- `backend/src/modules/finance/commission-policy.service.ts` (весь)
- `backend/src/modules/finance/finance.validation.ts` (CommissionPolicy-блок)
- `backend/src/modules/finance/finance.controller.ts` (CommissionPolicy-эндпоинты)
- `backend/src/modules/finance/finance.module.ts`
- `backend/prisma/schema.prisma` (CommissionPolicy/History/enums)
- `backend/prisma/migrations/20260814180000_add_commission_policy_foundation/migration.sql`
- `backend/src/security/permissions.constants.ts`, `security.service.ts` (фактические ALL_PERMISSIONS/ROLE_PERMISSIONS)
- `backend/src/shared/exception.filter.ts`, `prisma-errors.ts`, `validation-pipe.ts`
- `backend/src/eventbus/domain-events.ts` (0 CommissionPolicy-событий)
- `backend/src/modules/finance/commission-policy.service.spec.ts`, `test/commission-policy-foundation.e2e-spec.ts`
- `docs/adr/ADR-0013-commission-policy-contract.md`, `docs/architecture/commission-policy-foundation.md`, `docs/contracts/api.md`, Roadmap v3, имплементационный отчёт

## 4. Ownership / write-path audit — HARD GATE PASS

Repo-wide `commissionPolicy.(create|update|upsert|delete|createMany|updateMany)` / `commissionPolicyHistory.create`: единственный production writer — **CommissionPolicyService** (все вызовы вне `src/generated/prisma/**` — только в нём). 0 raw SQL (кроме advisory lock в самом сервисе), 0 seed/job/consumer/CLI writer-ов, 0 второго rate-authority. Sales/Order/Catalog/Settings не владеют ставкой. **0 production hardcoded commission percentages** (аудит `0.15|0.10|0.1|takeRate|platformFee|platformCommission|commissionPercent|feeRate|commissionRate` по `src/` — только schema-комментарии и generated-типы).

## 5. Manual rate / master-data authority — HARD GATE PASS

Ставка — master data, вводится вручную FINANCE/ADMIN через `POST /finance/commission-policies` (`rate` в DTO) и хранится в `finance.CommissionPolicy.rate DECIMAL(18,6)`. НЕ выводится из ProviderFee (0 связей), НЕ от PSP (0 PSP-путей), НЕ из Payment (0 Payment-lookup в service/resolver), НЕ из Catalog price, НЕ hardcoded, НЕ зависит от live mutable lookup (resolver читает только `CommissionPolicy`). Контракт `0.15 = 15%` однозначен: «10»/«15»/«1» (≥ 1) → 422.

## 6. Rate / Decimal validation

Было (до фикса): `Number(rate)`-range + split-по-точке → **defect** (см. §20).
Стало: **каноническая форма** `/^0\.(?!0+$)\d{1,6}$/` — regex-authority без JS float arithmetic. Проверено фактически (реальный `Prisma.Decimal` + реальная валидация через probe-прогон):
- 0, negative, 1, >1 → rejected; `"10"`/`"15"` → rejected; `"0.15"`/`"0.150000"` → accepted; `"0.1500001"` (7 знаков) → rejected;
- **scientific notation `"1e-7"`, `"1.5e-7"`, `"1e-8"`, `"0.00000015"` → rejected** (ранее: проходили → DECIMAL(18,6) округлял до 0.000000 — молчаливая 0%-policy; HIGH);
- **whitespace `" 0.15 "`, `"0.15 "`, `" 0.15"` → rejected** (ранее: проходили → `Prisma.Decimal` бросал `[DecimalError]` → catch-all → raw 500; HIGH-adjacent);
- NaN/Infinity/malformed → rejected; `"+0.15"`, `".15"`, `"0,15"`, `"0.0"`, `"0.000000"` (all-zero fraction = 0) → rejected;
- границы `"0.000001"`/`"0.999999"` → accepted (не over-restrictive, e2e T5b: round-trip без округления значения; `"0.150000"` → DTO `"0.15"` — документированное Decimal.js срезание trailing zeros).

## 7. Channel semantics — HARD GATE PASS

Enum `CommissionChannel { MARKETPLACE, PARTNER_STOREFRONT, DIRECT, BUYER_REQUEST }` (CUSTOM_DOMAIN/API не добавлены — deferred 2.5B). `validateCommissionChannel` — vocabulary-гейт (неизвестные → 422). `assertCommissionPolicyCreateChannel` — V1 create-гейт: только MARKETPLACE; PARTNER_STOREFRONT/DIRECT/BUYER_REQUEST → 422 (e2e T6). `NO_COMMISSION_CHANNEL` (no-commission канал) ≠ `NO_POLICY` (канал commission-capable, но нет ACTIVE policy) — отдельные fail-closed резолуты, отсутствие policy НЕ превращается молча в 0% (e2e T6/T7). Future-каналы не получают commission-семантику молча (enum — явная аддитивность).

## 8. Lifecycle / CAS

`DRAFT → ACTIVE → ARCHIVED` (CAS from-guard):
- update: только DRAFT (ACTIVE/ARCHIVED → 422; unit-тест);
- activate: DRAFT → ACTIVE; повторный activate — idempotent no-op (200 с existing); activate ARCHIVED → 422; activate с overlap → 409;
- archive: DRAFT|ACTIVE → ARCHIVED (терминальный, не селектируема); повторный archive — idempotent no-op;
- forged status/version/server-fields → mass-assignment 422 (assertNoForbiddenKeys на raw body);
- stale version: version server-owned (инкремент `{increment:1}`), клиент не передаёт; concurrent update/activate сериализуются advisory-lock-ом на channel (re-read `fresh` после lock — no TOCTOU).
- Косметика (observation, без фикса): в `archive` обе ветки (`if DRAFT / else`) выполняют идентичный update — dead branch, не влияет на поведение.

## 9. Effective dates

`[effectiveFrom, effectiveTo)` half-open; `effectiveTo NULL` = open-ended. `assertValidRange(from, to)` — `validTo === undefined` → без проверки (open-ended); «to ≤ from» → 422. **Implementation-fix подтверждён:** `create` вызывает `assertValidRange(input.effectiveFrom, input.effectiveTo ?? undefined, ...)` — `new Date(null)`-epoch больше не возможен (для null-эффективной open-ended policy); `update` — inline `to !== null && to <= from` → 422. UTC/ISO (DTO `@IsISO8601`), timezone-смещения нормализуются в UTC instant. Future/expired policy корректно не селектируются resolver-ом (e2e T7/T11).

## 10. Overlap / concurrency — HARD GATE PASS

`assertNoOverlap` при activate: пересечение `[aFrom,aTo) ∩ [bFrom,bTo) ⇔ aFrom < bTo AND bFrom < aTo` (open-ended aTo = 9999-12-31T23:59:59.999Z). Adjacent (`A.to == B.from`) допустимы (условие `b.effectiveTo > aFrom` ложно). Lock: `pg_advisory_xact_lock(hashtext('commission-policy:'||channel))` — детерминированный ключ по channel; lock + overlap-check + update в **одной** `$transaction` — без TOCTOU. Concurrent conflicting activates → один 201 + один 409, 0 raw 500 (e2e T10: Promise.allSettled, statuses содержат 201 и 409, ни один ≠ 500). Resolver AMBIGUOUS — fail-closed DB-независимый backstop (не «первая строка»).

## 11. Resolver determinism — HARD GATE PASS

`resolveCommissionPolicy(channel, at)`: только канонический `CommissionPolicy` storage (0 live Payment/Order/Catalog lookups); `findMany` по `{channel, status: ACTIVE, effectiveFrom <= instant, (effectiveTo null | > instant)}`; exactly 1 → POLICY_FOUND; 0 → NO_POLICY; > 1 → AMBIGUOUS (fail-closed, НЕ `findFirst`); no-commission канал → NO_COMMISSION_CHANNEL (до любого storage-доступа). DRAFT не селектируема (e2e T7).

## 12. Version / history

`CommissionPolicyHistory` — строка на каждую мутацию (created/updated/activated/archived) с `action`, `version`, полным `fields`-снапшотом (code/channel/rateType/rate/status/effectiveFrom/effectiveTo), actorId/actorName, comment. Version monotonic (инкремент). Historical rows immutable (0 update-path). Полный state на версию → future frozen snapshot воспроизводит (code, version) без текущего lookup. AuditLog (`finance.commission_policy.*`, snake_case, PII-free) — дополняет, не заменяет history. e2e T15: history пишется.

## 13. RBAC — factual audit PASS

Фактический код: `ADMIN: ALL_PERMISSIONS` (включает `finance.commission.manage`); `FINANCE`: read + write + manage; `DIRECTOR`/`ANALYST`: read only; **SALES_MANAGER: commission.read НЕ имеет** (в отличие от payment/refund/dispute/invoice read). `finance.commission.manage` принадлежит FINANCE + ADMIN ✓. Seeding: `onModuleInit` синхронизирует Permission/ROLE_PERMISSIONS (матрица авторитетна). Декораторы: `@RequirePermissions` на всех 6 эндпоинтах + JwtAuthGuard/PermissionsGuard. Negative-роли: e2e T1/T2 (anonymous 401; SALES_MANAGER/OPERATOR → 403). Privilege escalation через generic permissions: отсутствует (нет wildcard/generic grant; ALL_PERMISSIONS только у ADMIN). **Исправлен stale-комментарий контроллера** (утверждал SALES_MANAGER read — по факту не имеет; api.md:874, арх-док:90, ADR-0013 D18 уже были точны).

## 14. API / mass assignment

Эндпоинты: list / detail / resolve / create / update / activate / archive (resolve объявлен до `:code` — Nest order корректен). Whitelist DTO-фильтры: channel/status/page/pageSize (page=0/pageSize=101/invalid → 400; invalid channel/status → 422, e2e T14). `assertNoForbiddenKeys(req.body, COMMISSION_POLICY_FORBIDDEN_KEYS)` на raw body до whitelist: forged `id/code/version/createdAt/updatedAt/status/rateType/actorId/actorName/correlationId/causationId` → 422 (e2e T4). Extra-ключи → whitelist-strip (ValidationPipe whitelist:true — единый проект-паттерн). Undocumented mutation routes: 0. Unknown/malformed code → 404 (unit).

## 15. Events / AuditLog — PASS

0 CommissionPolicy domain events (repo-wide `CommissionPolicy|commission_policy` в eventbus — пусто; 0 generic outbox writes из сервиса). AuditLog: `finance.commission_policy.created/updated/activated/archived` — snake_case, детали без PII/secrets/raw body.

## 16. P2002 / error mapping

`create` ловит `isUniqueViolation` (code === "P2002") → контролируемый `ConflictError` (409) на code-коллизию; **не глобальный no-op** — любой другой P2002 (например future unique) тоже 409 (fail-closed, документировано), unknown errors → rethrow (unit: «connection reset» rethrow). Overlap — не P2002-путь (service-level lock + check; resolver backstop).

## 17. ProviderFee / Commission boundary — HARD GATE PASS

ProviderFee (PSP/bank стоимость, 2.10B) ≠ TravelHub Commission: 0 ProviderFee→CommissionPolicy связей/чтений; resolver/rate не выводятся из PSP cost; 0 ProviderFee writer-ов в CommissionPolicyService (repo-wide audit). e2e T12: 0 ProviderFee-фактов создано.

## 18. Deferred producer / freeze boundaries — PASS

0 преждевременной реализации: Quote/Checkout/Sale/Order commission snapshot — нет; `Order.sellerPartnerId` — нет (документированная зависимость: seller-атрибуция — следующий freeze-шаг); commission calculation — нет; Commission/CommissionAccrual producers — нет (repo-wide: 0 `commission.create`/`commissionAccrual.create` вне generated); CommissionAccrued event — нет; Payment→Commission / Order→CommissionAccrual / Refund- / Dispute-commission adjustments — нет. Schema-only foundation не стала runtime flow (e2e T12/T13: 0 фактов, 0 cross-domain writes).

## 19. Migration / fresh replay / drift — PASS

`20260814180000_add_commission_policy_foundation`: аддитивная (3 enum + 2 таблицы + индексы + FK), 0 destructive ALTER, 0 fabricated backfill, 0 hardcoded policy/rate rows (проверен фактический SQL). Enum/индексы соответствуют инвариантам (channel_status_idx, effectiveFrom_idx, code unique). Реальные прогоны: `migrate status` — 55/55, «Database schema is up to date»; `migrate diff --from-config-datasource --to-schema` — **No difference detected** (drift 0); fresh replay — e2e global-setup `migrate deploy` на свежей БД (serial e2e 1121/1121 = 55 миграций применены с нуля).

## 20. Issues found

1. **HIGH — scientific-notation bypass (validation → молчаливая 0%-policy).** `validateCommissionRate` (до фикса): `Number(rate)`-range + `split(".")`-scale-check. `"1e-7"` = 0.0000001 → проходил оба (split даёт `["1e-7"]`, length 1), `Prisma.Decimal("1e-7")` валиден → Postgres `DECIMAL(18,6)` **округляет** до `0.000000` → создавалась ACTIVE-пригодная policy с rate 0 (нарушение контракта `0 < rate < 1`; resolver молча возвращал 0%). Класс: validation-bypass с тихим DB-искажением (аналог «authoritative decimal»-требования §3). **Доказано фактически**: probe-прогон с реальным `Prisma.Decimal` и валидацией (`1e-7 → validate: 1e-7 | Decimal: 1e-7`).
2. **HIGH-adjacent — whitespace → raw 500.** `" 0.15 "` проходил `Number()`-трим и split, но `new Prisma.Decimal(" 0.15 ")` бросал `[DecimalError]` → `AppExceptionFilter` catch-all → **500 Internal server error** вместо контролируемого 422. **Доказано фактически** (probe: `Decimal: DECIMAL_THROW([DecimalError] Invalid argument)`; filter: DecimalError не DomainError/HttpException).
3. **LOW (docs) — stale-комментарий контроллера**: «read — …/SALES_MANAGER» — фактический ROLE_PERMISSIONS SALES_MANAGER commission.read НЕ даёт (отчёт/ADR уже были исправлены).
4. Observation (без фикса): в `archive` обе CAS-ветки выполняют идентичный update (dead branch). Observation: научная нотация с валидным значением («1e-2» = 0.01) теперь rejected — осознанное решение (каноническая форма единственная; документировано в api.md/арх-доке).

## 21. Review fixes

1. `finance.validation.ts` — `validateCommissionRate` переписан на **regex-authority каноническую форму** `/^0\.(?!0+$)\d{1,6}$/` (reject: scientific notation, whitespace, `+0.15`, `.15`, `0,15`, all-zero fraction, NaN/Infinity/malformed, percent-as-number; accept: `0.000001`–`0.999999`, ≤ 6 знаков). Единая точка для create/update.
2. `commission-policy.service.spec.ts` — +16 тестов (adversarial-матрица `it.each` + canonical-границы).
3. `test/commission-policy-foundation.e2e-spec.ts` — T5 расширен 12 невалидными rate (scientific/whitespace/non-canonical) + DB-assert `rate > 0` (нет policy с rate ≤ 0); добавлен T5b (границы 0.000001/0.999999/0.1/0.150000 accepted, round-trip).
4. `finance.controller.ts` — stale-комментарий read-set исправлен (SALES_MANAGER убран).
5. `docs/contracts/api.md`, `docs/architecture/commission-policy-foundation.md` — каноническая форма rate документирована; имплементационный отчёт — STRICT REVIEW ADDENDUM; Roadmap v3 — 2.14E → APPROVED WITH REVIEW FIXES, NEXT = 2.12E.

## 22. Regression (фактические прогоны после фиксов)

- Backend: `tsc --noEmit` ✓, `npm run build` ✓.
- Unit: **583/583** (было 567; +16 adversarial rate-тестов) ✓.
- Targeted e2e: commission-policy-foundation **16/16** (`--runInBand`) ✓.
- Full serial e2e: **1121/1121 (64 suites)** (было 1120; +1 T5b) ✓.
- Frontend: `tsc --noEmit` ✓, Vitest **135/135** ✓, production build ✓.
- DB: `migrate status` 55/55 up-to-date; `migrate diff` live→schema — **No difference detected** (drift 0); fresh replay — e2e harness `migrate deploy` на свежей БД.

## 23. Files changed

- `backend/src/modules/finance/finance.validation.ts` (rate-валидация — фикс)
- `backend/src/modules/finance/finance.controller.ts` (комментарий read-set)
- `backend/src/modules/finance/commission-policy.service.spec.ts` (+16 unit)
- `backend/test/commission-policy-foundation.e2e-spec.ts` (T5 расширен, +T5b)
- `docs/contracts/api.md`, `docs/architecture/commission-policy-foundation.md`
- `docs/prompts/PHASE_2_STEP_2.14E_CHANNEL_BASED_COMMISSION_RULES_FOUNDATION_IMPLEMENTATION_REPORT.md` (addendum)
- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (2.14E → APPROVED, NEXT)
- `docs/prompts/PHASE_2_STEP_2.14E_COMMISSION_POLICY_FOUNDATION_STRICT_REVIEW_REPORT.md` (этот отчёт)

## 24. Stop-condition result

Проверены все 10 stop-conditions (§25): **0 сработало** — единственный policy authority (1), owner ясен (2), hardcoded rate не требуется (3), 0 конфликтов с ADR-0013 (4), ProviderFee/Commission не смешаны (5), channel semantics разрешим (6), overlap не требует destructive redesign (7), monetary Commission producer не запущен (8), fabricated backfill не требуется (9), freeze-boundary конфликт отсутствует (10). Новое архитектурное решение внутри review не изобреталось.

## 25. Roadmap status

- **Step 2.14E** → `✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES` (Roadmap v3 обновлён; имплементационный отчёт — addendum).
- **Step 2.14** — остаётся `⛔ BLOCKED — ARCHITECTURE DECISION REQUIRED` (prerequisites не закрыты; не меняется этим review).
- **2.12C / 2.12E** — остаются `⏳ NOT STARTED`.

## 26. Exact NEXT

`PHASE 2 — STEP 2.12E — PARTNER_COLLECT / COMMISSION ACCRUAL FOUNDATION`

По dependency graph (Roadmap v3, Commission Dependency Reconciliation): **2.14E (policy-фундамент) → 2.12E (PARTNER_COLLECT → CommissionAccrual; provider-neutral, trigger/base теперь определены ADR-0013) → 2.12C (SPLIT_AT_PAYMENT, после 2.12A/2.12B)**. 2.14A–D — после commission-контракта; Step 2.14 целиком остаётся BLOCKED до закрытия prerequisites.

**STOP. Следующий step не начинается.**
