# PHASE 3 — COMMAND CENTER / DECISION INTELLIGENCE
## STAGE D — DETERMINISTIC WHY ATTRIBUTION IMPLEMENTATION

# LANGUAGE REQUIREMENT — MANDATORY

Все ответы разработчика, audit findings, объяснения, результаты тестов, runtime evidence, итоговый отчёт и VERDICT — **НА РУССКОМ ЯЗЫКЕ**. Технические идентификаторы, code, paths, endpoints, fields, enum, SHA и команды сохранять в оригинале.

# 1. ENTRY / OBJECTIVE

Подтверждено: Stage A, B, B.1, B.2, C завершены; Stage C Acceptance Review → `VERDICT A / PRE-STAGE-D GATE PASSED`.

Stage D реализует второй элемент Decision Loop:

```text
WHAT   → COMPLETE (B/C)
WHY    → THIS STAGE
IMPACT → Stage E
ACTION → Stage F
```

Цель: deterministic, evidence-based, explainable и auditable WHY Attribution.

# 2. NON-NEGOTIABLE PRINCIPLE

WHY не должен генерироваться как правдоподобный текст.

```text
DecisionSignal + structured evidence + deterministic rules = WHY
```

Запрещено:

```text
DecisionSignal → LLM → plausible causal explanation
```

Различать:

- `PROVEN_CAUSE`
- `OBSERVED_DRIVER`
- `CONTRIBUTING_FACTOR`
- `INSUFFICIENT_EVIDENCE`

Допустимы эквивалентные enum names при сохранении semantics.

Не использовать fake confidence percentages.

# 3. AUDIT CURRENT HEAD

До реализации проверить actual HEAD:

- `DecisionSignal`, `DecisionSignalService`;
- 6 detectors;
- evidence structures;
- Decision Queue DTO/UI;
- lifecycle / Active / History;
- RBAC;
- i18n;
- AI Decision Feed;
- доступные domain fields для attribution.

Вернуть:

| Signal | Evidence now | WHY safely derivable? | Missing evidence | Decision |
|---|---|---:|---|---|

# 4. COVER ALL 6 DETECTORS

Audit:

1. `PendingBookingsDetector`
2. `FailedPaymentsDetector`
3. `RecentCancellationsDetector`
4. `PendingRefundsDetector`
5. `UpcomingBookingsDetector`
6. `ServicesWithoutSalesDetector`

Для каждого определить WHAT, factual evidence, безопасный WHY и запрещённые claims.

Не требуется искусственно создать WHY для всех. Если evidence недостаточно:

```text
WHY = INSUFFICIENT_EVIDENCE
```

Это правильнее fabrication.

# 5. WHY ≠ RESTATEMENT OF WHAT

Плохо:

```text
WHAT: 87 refunds pending
WHY: потому что 87 refunds pending
```

Нужен дополнительный explanatory driver либо честный `INSUFFICIENT_EVIDENCE`.

# 6. CLAIM SAFETY

Примеры:

`4 failed payments` не доказывает «банк работает неправильно».

Если 3/4 имеют один factual provider/failure code, допустимо:

```text
Основной наблюдаемый фактор: 3 из 4 ошибок имеют код X.
```

Если reason отсутствует:

```text
Причина не подтверждена доступными данными.
```

Recent cancellations требуют structured `cancellationReason/cancelledBy/...`, если они существуют. Free text не превращать автоматически в causal taxonomy.

`50 services without sales` НЕ означает автоматически «нет спроса», «плохой маркетинг», «неверная цена». Допустимы только доказуемые факторы: publication, availability, inventory/catalog state и т.п., если реальные данные это подтверждают.

# 7. ATTRIBUTION CONTRACT

Создать один authoritative application-level WHY contract поверх DecisionSignal, концептуально:

```text
why: {
  status/type,
  primaryDriver?,
  contributingFactors[],
  evidenceStrength,
  evidenceRefs[],
  ruleId,
  ruleVersion
}
```

Exact names выбрать по current architecture.

DecisionSignal остаётся single source of truth. Не создавать второй signal engine.

# 8. STORAGE DECISION — REQUIRED

Обосновать:

```text
WHY derived on read
vs
WHY persisted/snapshotted
```

Учитывать determinism, historical correctness, re-observation, resolved/history signals, auditability и query cost.

Если derived — same evidence + same rule version = same WHY.

Если persisted — определить recompute/invalidation.

Не создавать Prisma migration без доказанной необходимости.

# 9. RULES / VERSIONING

Каждая реализованная attribution rule должна иметь stable identity/version, например:

```text
ruleId
ruleVersion
```

Не строить rule-management platform.

Запрещены arbitrary causal thresholds вроде:

```text
>5 = root cause
>50% = definitely cause
```

Без authority можно использовать descriptive ranking: largest observed group / dominant factual code — как `OBSERVED_DRIVER`, не proven cause.

# 10. DETERMINISM

Обязательные invariants:

```text
same evidence + same rule version = same output
```

DB row ordering не должен менять результат.

При ties — deterministic handling: co-primary либо stable ordering с явным равенством; не выбирать случайного победителя.

Missing/null/legacy evidence → safe `INSUFFICIENT_EVIDENCE`, а не crash/fabrication.

# 11. HISTORY / REOBSERVATION

Проверить:

- reobserved signal + changed evidence → как recompute WHY;
- resolved/dismissed historical signal не должен получать новую причину из mutable current DB state;
- legacy signals до Stage D должны отображаться безопасно.

Storage/snapshot решение должно учитывать эти invariants.

# 12. WHY ≠ IMPACT ≠ ACTION

Stage D не добавляет:

```text
HIGH/MEDIUM/LOW impact
critical financial risk
potential = n × X
recommended action
"вам следует..."
```

Monetary evidence можно показывать factual в AZN, но не превращать в impact score.

Разрешены Stage C controls: Acknowledge / Resolve / Dismiss / navigation.

# 13. AI FEED BOUNDARY

Hardcoded AI Decision Feed не является authority для WHY. Не использовать его pseudo-WHY/potential formulas. Его reconciliation остаётся Stage G.

# 14. ANALYTICS BOUNDARY

Command Center показывает concise WHY + evidence. Если требуется глубокое exploration — route/deep link в Analytics/domain surface, а не второй analytics engine внутри Command Center.

# 15. SECURITY

WHY наследует signal RBAC:

```text
page access + section/category permission + signal authority
```

Cross-domain evidence не должно раскрывать данные недоступной секции.

Не включать provider raw payloads, tokens, card details, secrets или ненужные PII.

# 16. BUSINESS / FINANCIAL AUTHORITY

Сохранять:

```text
Marketplace ≠ Storefront SaaS ≠ Storefront Commerce
GMV ≠ TravelHub Revenue
Payment Volume ≠ Revenue
Revenue ≠ Profit
Marketplace commission ≠ Storefront subscription revenue
PLATFORM reporting currency = AZN
```

WHY не должен возвращать superseded labels или `$`.

# 17. DETECTOR EVIDENCE ENRICHMENT

Если evidence недостаточно, разрешено расширить detectors factual fields при условиях:

- deterministic;
- bounded query cost;
- no speculation;
- no PII leakage;
- backward compatible where possible.

Для каждого enrichment объяснить необходимость.

# 18. FRONTEND UX

Decision Queue получает компактный WHY block.

Claim wording должен соответствовать strength:

```text
PROVEN_CAUSE          → Причина
OBSERVED_DRIVER       → Основной наблюдаемый фактор
CONTRIBUTING_FACTOR   → Дополнительный фактор
INSUFFICIENT_EVIDENCE → Недостаточно данных для определения причины
```

Exact RU/AZ/EN wording — через i18n.

Raw `ruleId` не показывать как primary UI text.

Использовать deterministic localized templates, не LLM.

# 19. PERFORMANCE

Stage C accepted baseline:

```text
Dashboard ~430ms
6 detector runs/page
~12 DB queries/page
```

Перепроверить actual baseline и измерить after D:

| Measurement | Before D | After D |
|---|---:|---:|
| Dashboard endpoint | | |
| Detector runs/page | | |
| DB queries/page | | |
| WHY attribution duration | N/A | |
| N+1 | | |

Не допустить per-card N+1. Предпочитать detector evidence enrichment/batching.

Если Stage D делает request-time detector architecture неприемлемой — вернуть remediation/blocker, не скрывать.

# 20. BACKEND TESTS

Минимум:

- same-input determinism;
- rule/version traceability;
- missing evidence;
- legacy signal;
- ties;
- order independence;
- reobservation;
- history semantics;
- RBAC/no evidence leakage;
- supported signal codes;
- insufficient-evidence fallback;
- no severity/impact calculation;
- no business action generation.

Для rule: positive + insufficient/negative + boundary.

# 21. FRONTEND TESTS

Минимум:

- WHY block;
- claim-strength wording;
- primary/contributing factors;
- insufficient evidence;
- RU/AZ/EN;
- no raw i18n keys;
- no raw rule id as primary UI;
- no fake impact;
- no recommended business action;
- lifecycle and Active/History regression.

# 22. E2E / RUNTIME — MANDATORY

Доказать:

```text
detector
→ DecisionSignal evidence
→ deterministic WHY
→ API
→ Decision Queue
→ human-readable WHY
```

В browser проверить минимум:

1. representative active signal shows WHAT + WHY;
2. WHY traceable to evidence;
3. insufficient-evidence behavior (runtime или integration evidence);
4. lifecycle works;
5. Active/History work;
6. no fake IMPACT;
7. no business recommendation;
8. AZN preserved;
9. RU/AZ/EN verified.

VERDICT A без runtime/browser evidence запрещён.

# 23. REQUIRED DELIVERABLES

## A — WHY Coverage Matrix

| Detector | WHY status | Attribution type | Evidence | Rule | Limitation |
|---|---|---|---|---|---|

## B — Attribution Contract

| Field | Type | Source | Persisted/Derived | User-visible |
|---|---|---|---|---|

Объяснить storage decision.

## C — Rule Catalog

| Rule ID | Version | Applies to | Inputs | Output type | Deterministic |
|---|---|---|---|---|---:|

## D — Claim Safety Matrix

Минимум:

| Claim | Allowed? | Why |
|---|---:|---|
| Observed dominant failure code | | |
| Bank/provider caused failure | | |
| 87 refunds pending | | |
| Finance team is slow | | |
| Service has zero sales | | |
| Demand is low | | |

Дополнить реальными examples.

## E — Decision Loop Boundary

| Dimension | Status after D | Authority |
|---|---|---|
| WHAT | COMPLETE | B/C |
| WHY | COMPLETE / bounded | D |
| IMPACT | NOT IMPLEMENTED | E |
| ACTION | lifecycle/navigation only | F for business action |

## F — Performance

Actual before/after latency, DB queries, N+1, detector runs, WHY duration.

## G — Security

```text
WHY respects RBAC:
Cross-category leakage:
PII leakage:
Unauthorized WHY test:
```

## H — Tests

Фактические counts:

```text
WHY unit:
DecisionSignal:
Dashboard:
Command Center E2E:
RBAC:
Backend full:
Backend TSC/build:
Frontend Vitest:
Frontend TSC/build:
Browser/runtime:
```

## I — Files Changed

Точное количество:

```text
Total:
Backend:
Frontend:
Tests:
Docs:
Migrations:
```

## J — Git Evidence

```text
Starting HEAD:
Final HEAD:
Commits:
Pushed to origin:
Working tree clean:
```

# 24. REPORT / ROADMAP

Создать:

```text
docs/prompts/PHASE_3_STAGE_D_DETERMINISTIC_WHY_ATTRIBUTION_IMPLEMENTATION_REPORT.md
```

Отчёт полностью на русском.

После успешного завершения additive update canonical roadmap:

```text
Stage D — Deterministic WHY Attribution
→ VERDICT A — COMPLETE
```

Указать report, commit, coverage, insufficient-evidence cases, runtime evidence, next-stage readiness.

Stage E автоматически не запускать.

# 25. ACCEPTANCE INVARIANTS

VERDICT A только если:

1. WHY deterministic и evidence-based.
2. DecisionSignal остаётся source of truth.
3. Нет второго signal engine.
4. Claim strength различает proven cause и observed driver.
5. Недостаток evidence → honest insufficient state.
6. Нет arbitrary confidence percentages/causal thresholds.
7. Rules traceable/versioned.
8. Same input + rule version = same result.
9. Tie/order deterministic.
10. Legacy/history/reobservation safe.
11. RBAC/PII safe.
12. Нет fake IMPACT.
13. Нет recommended business ACTION.
14. AI feed не является WHY authority.
15. RU/AZ/EN complete.
16. Performance acceptable, no N+1.
17. Stage C lifecycle/filter/history preserved.
18. AZN preserved.
19. Runtime/browser evidence provided.
20. Tests/builds green.
21. Roadmap updated.
22. Финальный отчёт на русском.

# 26. VERDICT

Вернуть ровно один.

## VERDICT A — STAGE D COMPLETE

Только при полном выполнении invariants. После этого:

```text
Stage E — Impact / Severity
→ READY
```

но не запускать автоматически.

## VERDICT B — STAGE D REMEDIATION REQUIRED

Если есть исправимые defects в rules, claim safety, evidence, RBAC, history, i18n, performance, runtime или tests.

## VERDICT C — BLOCKED

Если meaningful WHY невозможно без отсутствующего authoritative domain evidence. Не fabricating WHY ради A.

Указать exact missing evidence, affected signals, smallest prerequisite и owner.

# 27. STOP

После Stage D **STOP**.

Не запускать Stage E/F/G/H/I/J/2.14.x. Вернуть полный отчёт на русском и ждать review.
