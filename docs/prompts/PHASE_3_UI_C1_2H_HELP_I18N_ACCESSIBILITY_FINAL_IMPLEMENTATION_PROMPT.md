# PHASE 3 — UI-C1.2H — HELP / I18N / ACCESSIBILITY
## FINAL IMPLEMENTATION & QUALIFICATION PROMPT

**Язык работы и итогового отчёта — русский.**

## 1. CONTEXT

TravelHub — Enterprise SaaS / Marketplace.

Canonical state:

- UI-C1.2A — ACCEPTED
- UI-C1.2B — ACCEPTED
- UI-C1.2C — ACCEPTED
- UI-C1.2D — ACCEPTED
- UI-C1.2E — ACCEPTED
- UI-C1.2F — ACCEPTED
- UI-C1.2F.1 — ACCEPTED
- UI-C1.2G — CLOSED

**UI-C1.2G final SHA: `16dfd72`**

Следующий этап:

**UI-C1.2H — Help / i18n / Accessibility**

UI-C1.2G не переоткрывать без фактической регрессии.

---

## 2. ЦЕЛЬ

Провести:

```text
AUDIT → IMPLEMENTATION → VERIFICATION → QUALIFICATION → REPORT → GIT CLOSURE
```

для Help / Business Dictionary, i18n и accessibility в:

```text
Requests
Orders
Bookings
Payments
```

H не должен менять:

- бизнес-статусы;
- state machines;
- KPI formulas;
- financial calculations;
- API contracts;
- filter semantics;
- RBAC;
- tenant isolation;
- domain logic.

---

## 3. ОБЯЗАТЕЛЬНЫЙ AUDIT-FIRST

До изменения кода изучить:

1. текущий Help implementation;
2. i18n registry;
3. accessibility implementation;
4. UI-C1.2G changes;
5. canonical status registries;
6. существующие tests.

Сначала сформировать Gap Matrix. До завершения audit implementation changes запрещены.

---

## 4. CANONICAL HELP ARCHITECTURE

TravelHub Help ≠ Support.

Help = Business/Product Dictionary.

Canonical authority:

```text
BACKEND DOMAIN / QUERY SERVICES
        ↓ business calculation authority
SHARED TYPED METRIC / HELP REGISTRY
        ↓ metadata authority
i18n
        ↓ localized presentation
HELP UI / KPI POPOVER
        ↓ consumers only
```

Help UI не вычисляет бизнес-значения самостоятельно.

Каждый применимый Help/Metric entry проверить по:

- stable ID;
- purpose;
- source;
- scope;
- business definition;
- formula;
- period;
- status mapping;
- inclusions;
- exclusions;
- overlap rule;
- reconciliation rule;
- drill-down;
- help description;
- comparison period;
- currency/unit;
- related metrics;
- workspace/entitlement;
- localization keys;
- contract version;
- change note.

Stable ID:

```text
{domain}.{metric}
```

Не создавать дублирующий registry, если canonical registry уже существует.

---

## 5. CANONICAL STATUS COVERAGE

### Requests

Проверить все 12 canonical RequestStatus.

Сохранить группировку UI-C1.2G:

```text
Жизненный цикл — 6
Проблемы и завершения — 6
```

### Orders

Проверить все canonical OrderStatus и payment semantics.

Не смешивать:

```text
OrderStatus
PaymentStatus
Payment Method
```

### Bookings

Проверить все **13 canonical BookingStatus**:

```text
NEW
PREPARING_REQUEST
SENT_TO_SUPPLIER
AWAITING_CONFIRMATION
CONFIRMED
IN_SERVICE
COMPLETED
NEEDS_CLARIFICATION
SUPPLIER_REJECTED
CHANGE_REQUESTED
CANCELLATION_REQUESTED
CANCELLED
PROBLEM
```

Критично:

```text
PARTIALLY_CONFIRMED НЕ СУЩЕСТВУЕТ.
```

Не создавать его в Help/i18n/UI/tests/documentation.

`AWAITING_CONFIRMATION` остаётся canonical visible status. Не придумывать для него transition.

### Payments

PaymentStatus:

```text
PENDING
AUTHORIZED
CAPTURED
FAILED
CANCELLED
REFUNDED
```

RefundStatus:

```text
REQUESTED
APPROVED
PROCESSED
FAILED
```

Не смешивать PaymentStatus, RefundStatus и Payment Method.

```text
CASH = Payment Method
CASH ≠ доказательство оплаты
```

---

## 6. KPI HELP

Для каждого KPI проверить:

- название;
- business definition;
- source;
- formula;
- period;
- inclusions;
- exclusions;
- status mapping;
- reconciliation rule;
- drill-down;
- related metrics.

Пользователь должен понимать:

```text
Что это?
Как считается?
За какой период?
Что входит?
Что не входит?
Почему может отличаться от другого KPI?
Куда ведёт детализация?
```

---

## 7. I18N

Обязательные locale:

```text
RU
AZ
EN
```

Проверить:

- missing keys;
- hardcoded user-facing text;
- смешение языков;
- fallback;
- KPI labels;
- group headings;
- status labels;
- table labels;
- filter labels;
- Help;
- accessibility labels;
- empty/loading/error states;
- pagination;
- buttons;
- breadcrumbs.

RU — контрольный язык qualification.

Не менять canonical terminology ради стилистики.

---

## 8. ACCESSIBILITY — REAL HYDRATED DOM

Проверять реальным browser/Playwright:

- keyboard navigation;
- visible focus;
- logical tab order;
- semantic headings;
- accessible names;
- icon-only controls;
- dropdown keyboard access;
- Help tooltip/popover;
- table headers;
- text alternative для status;
- корректный ARIA;
- focus management;
- Escape для overlays;
- meaningful screen-reader structure.

Не использовать ARIA без необходимости.

---

## 9. HELP POPOVER / TOOLTIP

Если используется tooltip/popover:

- keyboard trigger;
- accessible name;
- predictable open/close;
- keyboard navigation;
- Escape;
- focus behavior;
- длинный RU/AZ/EN текст;
- mobile viewport;
- отсутствие clipping.

Не переписывать существующий canonical Help UI без необходимости.

---

## 10. RESPONSIVE

Проверить:

```text
375px
768px
1024px
1280px
```

Для всех четырёх registry:

- KPI;
- Help;
- filters;
- tables;
- headings;
- badges;
- popovers;
- focus;
- horizontal overflow.

---

## 11. GAP MATRIX

Создать и сохранить:

| Область | Expected | Actual | Gap | Action |
|---|---|---|---|---|
| Help registry | canonical | | | |
| Requests Help | 12 statuses | | | |
| Orders Help | canonical | | | |
| Bookings Help | 13 statuses | | | |
| Payments Help | 6+4 | | | |
| RU | complete | | | |
| AZ | complete | | | |
| EN | complete | | | |
| Keyboard | PASS | | | |
| Focus | PASS | | | |
| Popover | PASS | | | |
| Tables | PASS | | | |
| Responsive | PASS | | | |
| Console | 0 errors | | | |

---

## 12. TESTING

### Static

Выполнить:

- TypeScript;
- lint, если существует;
- relevant unit/component tests;
- Help/i18n tests;
- accessibility tests, если существуют.

### Runtime

Через реальный Playwright/browser:

- authenticated session;
- Requests;
- Orders;
- Bookings;
- Payments;
- Help interactions;
- RU/AZ/EN;
- keyboard;
- responsive;
- console.

Source inspection не является доказательством hydrated DOM behavior.

---

## 13. REGRESSION

После implementation проверить:

```text
Requests
Orders
Bookings
Payments
```

Не должны измениться:

- KPI counts;
- status coverage;
- period semantics;
- URL state;
- reload;
- popstate;
- header filters;
- sorting;
- pagination;
- one-active KPI invariant;
- server-side filtering;
- RBAC/isolation.

UI-C1.2G behavior должен остаться неизменным.

---

## 14. PRE-EXISTING FAILURES

Если failure есть на baseline:

1. воспроизвести baseline;
2. дать concrete evidence;
3. не маскировать;
4. не считать H regression;
5. отдельно указать в отчёте.

Любой новый unexplained failure считать regression до доказательства обратного.

---

## 15. NO FAKE EVIDENCE / STOP

Запрещены:

- fake authentication;
- mock browser evidence вместо real UI;
- debug endpoints;
- RBAC/tenant bypass;
- подавление console errors;
- удаление failing tests;
- изменение business logic ради PASS.

STOP при:

- backend/domain/schema changes;
- canonical status changes;
- KPI formula changes;
- filter semantics changes;
- RBAC changes;
- tenant regression;
- unexpected source files;
- G regression;
- unexplained test failure;
- невозможности доказать runtime behavior.

Environment blocker: диагностировать → зафиксировать → STOP.

---

## 16. GIT BASELINE

Baseline:

```text
16dfd72
```

Не использовать без audit:

```text
git add .
```

Перед commit:

```text
git status --short
git diff
git diff --cached
```

---

## 17. FINAL QUALIFICATION

H может быть `QUALIFIED` только при:

```text
Help semantics             PASS
Help registry              PASS
Requests                    PASS
Orders                      PASS
Bookings                    PASS
Payments                    PASS
RU                          PASS
AZ                          PASS
EN                          PASS
Keyboard                    PASS
Focus                       PASS
ARIA / semantics             PASS
Help popover/tooltip         PASS
Responsive                   PASS
Console                     0 errors
Runtime hydrated DOM        PASS
Cross-registry regression   PASS
TSC                         PASS
Build                       PASS
Relevant tests              PASS
Git scope                   PASS
```

Pre-existing failure допускается только при доказанном baseline evidence.

---

## 18. ОБЯЗАТЕЛЬНЫЙ ИТОГОВЫЙ REPORT

Итог **обязательно сохранить в файл**, а не только вывести в чат:

```text
docs/reports/PHASE_3_UI_C1_2H_HELP_I18N_ACCESSIBILITY_QUALIFICATION_REPORT.md
```

**Файл и всё его содержимое — на русском языке.**

Структура:

```text
# PHASE 3 — UI-C1.2H — Help / i18n / Accessibility

## 1. Статус
## 2. Baseline
## 3. Цель этапа
## 4. Audit-first findings
## 5. Gap Matrix
## 6. Выполненные изменения
## 7. Help Architecture
## 8. Requests
## 9. Orders
## 10. Bookings
## 11. Payments
## 12. i18n
## 13. Accessibility
## 14. Responsive
## 15. Runtime Evidence
## 16. Tests
## 17. TSC / Build
## 18. Cross-Registry Regression
## 19. Git Closure
## 20. Pre-existing Issues
## 21. Final Verdict
```

В каждом разделе указывать concrete evidence:

- что проверено;
- каким способом;
- фактический результат;
- relevant files/tests;
- runtime evidence;
- failures и их классификация.

Не писать только `PASS`.

---

## 19. GIT HARD CLOSURE

Перед финальным verdict:

```text
git status --short
git diff 16dfd72..HEAD
git diff --cached
git log --oneline --decorate -n <relevant commits>
```

Проверить:

- только H-related changes;
- нет backend/domain/schema changes;
- нет неожиданных source files;
- docs/reports перечислены отдельно;
- final HEAD SHA;
- working tree clean.

После commit повторно:

```text
git status --short
```

---

## 20. FINAL VERDICT

Не объявлять CLOSED только на основании self-reported PASS.

Если всё PASS:

```text
UI-C1.2H — QUALIFIED
```

После Git hard closure:

```text
UI-C1.2H — CLOSED
```

Если unexplained failure:

```text
UI-C1.2H — BLOCKED
```

Если failure доказан как pre-existing:

```text
UI-C1.2H — QUALIFIED
Pre-existing issue — recorded separately
```

---

## 21. ФОРМАТ РАБОТЫ

Сохранять обязательный формат предыдущих этапов:

```text
Implementation
→ Verification
→ Qualification
→ Report .md
→ Git Closure
→ Final Verdict
```

Не возвращаться к формату, где итоговый отчёт существует только в сообщении чата.

---

## 22. НАЧАЛО РАБОТЫ

Начать строго:

```text
PHASE 3 — UI-C1.2H — AUDIT FIRST
Baseline: 16dfd72
```

Сначала предоставить:

1. фактическую Help architecture;
2. i18n architecture;
3. accessibility state;
4. canonical status coverage;
5. Gap Matrix;
6. необходимые implementation changes.

**До завершения audit-first implementation не начинать.**

После audit остановиться и предоставить findings для проверки.
