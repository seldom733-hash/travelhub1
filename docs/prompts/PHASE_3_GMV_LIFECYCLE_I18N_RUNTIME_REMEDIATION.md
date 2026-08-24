# PHASE 3 — GMV LIFECYCLE — i18n RUNTIME REMEDIATION
## FINAL PRE-STAGE-E CLOSURE

## LANGUAGE REQUIREMENT — MANDATORY
Все ответы разработчика, findings, тесты, browser/runtime evidence и финальный отчёт — **НА РУССКОМ ЯЗЫКЕ**. Technical identifiers/paths/keys/code сохранять как есть.

## 1. CONTEXT
GMV / Collection / Refund Semantics Policy Closure получил VERDICT A. Новая Executive-модель:
- GMV = qualified orders, status NOT IN (NEW, CANCELLED)
- Collected GMV = cohort-based `Order.paidAmount`
- Outstanding = `MAX(0, GMV - Collected)`
- Completed GMV = FULFILLED/CLOSED
- Payment Volume = CAPTURED payments by `Payment.paidAt` (EVENT_PERIOD)

Но runtime показывает raw system keys:
```text
GMV
11 514 ₼

cc.kpi.collected-gmv
10 838 ₼

cc.kpi.outstanding
675 ₼

cc.kpi.completed-gmv
7 460 ₼
```

Это P2 i18n/runtime defect. Stage E до исправления НЕ запускать.

## 2. PURPOSE
Исправить отображение новых GMV lifecycle cards без изменения financial formulas, scopes, statuses, period semantics или refund policy.

## 3. REQUIRED USER-FACING LABELS

### RU
```text
GMV
Оплачено по GMV
Остаток к оплате
Исполненный GMV
```

### EN
```text
GMV
Collected GMV
Outstanding GMV
Completed GMV
```

### AZ
```text
GMV
Ödənilmiş GMV
Ödənilməmiş qalıq
Tamamlanmış GMV
```
Если в проекте уже существует утверждённый AZ glossary для Outstanding/Completed, сохранить его consistency.

## 4. ROOT CAUSE — MANDATORY
Не ограничиваться добавлением строк в `i18n.tsx`. Проверить полную цепочку:
```text
backend widget/metric ID
→ DTO
→ dashboard-api mapping
→ SectionGrid
→ KpiCard
→ translation-key construction
→ i18n dictionary
→ fallback
→ rendered label
```

Объяснить, почему предыдущий отчёт заявил `8 new i18n keys (RU/AZ/EN)`, но runtime всё равно отображает raw keys.

Особенно проверить mismatch:
```text
collected-gmv vs collectedGmv
completed-gmv vs completedGmv
cc.kpi.outstanding
```
Root cause доказать, а не предполагать.

## 5. CANONICAL KEY STRATEGY
Не создавать хаотические дубли `collected-gmv`, `collectedGmv`, `collected_gmv`.

Выбрать и сохранить существующую архитектурную стратегию:
- exact backend IDs поддерживаются dictionary; ИЛИ
- stable widget IDs явно map-ятся на canonical translation keys.

## 6. RAW-KEY SAFETY
Проверить fallback. Raw internal keys `cc.kpi.*` не должны становиться нормальным production UI.

Targeted scan Executive:
```text
cc.
dashboard.
analytics.
undefined
null
```

Также проверить subtitles/tooltips новых GMV cards и Payment Volume.

## 7. DO NOT CHANGE FINANCIAL SEMANTICS
В этом remediation запрещено менять:
```text
GMV qualifying statuses
Collected GMV formula
Outstanding formula
Completed GMV formula
Payment Volume formula
Refund semantics
comparison semantics
```
Если обнаружится финансовый defect — STOP и report отдельно.

## 8. FINANCIAL NON-REGRESSION
Зафиксировать один и тот же API request/period до/после fix.

Требование:
```text
label changes
financial values do not
```

Вернуть:
| Metric | Before | After | Match |
|---|---:|---:|---|
| GMV | | | |
| Collected GMV | | | |
| Outstanding | | | |
| Completed GMV | | | |

Допустима только естественная смена live-data; предпочтительно использовать фиксированный snapshot/request.

## 9. RUNTIME VALIDATION — MANDATORY

### RU
Должно отображаться:
```text
GMV
Оплачено по GMV
Остаток к оплате
Исполненный GMV
```
Raw `cc.kpi.*` = 0.

### AZ
Переключить реальный UI на AZ и проверить все четыре cards.

### EN
Проверить:
```text
GMV
Collected GMV
Outstanding GMV
Completed GMV
```

Dictionary/unit test без browser/runtime evidence недостаточен.

## 10. REGRESSION TESTS
Добавить test, который гарантирует минимум:
```text
rendered Command Center does NOT contain "cc.kpi."
```
И direct assertions для RU/AZ/EN lifecycle labels.

Тест должен падать при возврате текущего defect.

## 11. AZN NON-REGRESSION
Проверить:
```text
₼ / AZN preserved
unexpected $ = 0
unexpected USD = 0
```
Не менять currency semantics.

## 12. TEST/BUILD GATES
Минимум:
```text
Command Center frontend tests
Frontend Vitest
Frontend TSC
Frontend build
RU browser/runtime
AZ browser/runtime
EN browser/runtime
```
Если backend не менялся — backend full suite не обязателен.
Если backend изменён — relevant backend tests + TSC/build обязательны.

## 13. REQUIRED DELIVERABLE A — ROOT CAUSE
Для каждого:
```text
cc.kpi.collected-gmv
cc.kpi.outstanding
cc.kpi.completed-gmv
```
вернуть:
```text
Raw key:
Expected label:
Actual dictionary key:
Actual lookup key:
Root cause:
Fix:
```

## 14. REQUIRED DELIVERABLE B — LANGUAGE MATRIX
| Widget | RU | AZ | EN | Runtime PASS |
|---|---|---|---|---|
| GMV | GMV | GMV | GMV | |
| collected-gmv | Оплачено по GMV | Ödənilmiş GMV | Collected GMV | |
| outstanding | Остаток к оплате | Ödənilməmiş qalıq | Outstanding GMV | |
| completed-gmv | Исполненный GMV | Tamamlanmış GMV | Completed GMV | |

## 15. REQUIRED DELIVERABLE C — BEFORE/AFTER
Browser evidence:
```text
BEFORE
cc.kpi.collected-gmv
cc.kpi.outstanding
cc.kpi.completed-gmv

AFTER RU
Оплачено по GMV
Остаток к оплате
Исполненный GMV
```
Плюс AZ/EN evidence.

## 16. REQUIRED DELIVERABLE D — TEST RESULTS
Вернуть exact counts:
```text
Command Center frontend tests:
Frontend Vitest:
Frontend TSC:
Frontend build:
RU runtime:
AZ runtime:
EN runtime:
Raw cc.kpi.* count:
Unexpected $/USD count:
```

## 17. REQUIRED DELIVERABLE E — FILES / GIT
```text
Starting HEAD:
Final HEAD:
Total files changed:
Frontend:
Backend:
Tests:
Docs:
Migrations:
Commit:
Pushed to origin: YES/NO
Working tree clean: YES/NO
```
Ожидается `Migrations: 0`.

## 18. REPORT
Создать:
```text
docs/prompts/PHASE_3_GMV_LIFECYCLE_I18N_RUNTIME_REMEDIATION_REPORT.md
```
Полностью на русском языке.

## 19. ROADMAP STATUS
Не создавать новый product stage. После PASS зафиксировать:
```text
GMV / COLLECTION / REFUND SEMANTICS → CLOSED
i18n runtime remediation            → VERIFIED
Command Center financial semantics  → TRUSTED
Stage E                             → READY
```
Stage E автоматически НЕ запускать.

## 20. ACCEPTANCE CRITERIA
VERDICT A только если:
1. Root cause доказан.
2. Все три raw keys исчезли.
3. RU/AZ/EN labels проверены в runtime.
4. Subtitles/tooltips не содержат raw keys.
5. Regression guard `no cc.kpi.*` существует.
6. Financial formulas не изменены.
7. Values до/после reconciled.
8. AZN authority сохранена.
9. Unexpected $/USD = 0.
10. Tests/TSC/build green.
11. Report на русском.
12. Stage E не запущен.

## 21. VERDICT
Вернуть ровно один:

### VERDICT A — GMV LIFECYCLE i18n REMEDIATION COMPLETE / STAGE E READY
Только после RU/AZ/EN runtime verification и regression tests.

### VERDICT B — i18n REMEDIATION REQUIRED
Если хотя бы один raw key остаётся или mapping не доказан.

### VERDICT C — BLOCKED
Если defect вызван более глубокой проблемой localization infrastructure и минимальный безопасный fix невозможен.

## 22. STOP
После отчёта **STOP**.

Не запускать автоматически:
```text
Stage E
Stage F
Stage G
Stage H
Stage I
Stage J
Stage 2.14.x
```
Ждать review.
