# PHASE 3 — UI-C1.2H — FINAL IMPLEMENTATION PROMPT
## Help / i18n / Accessibility

**Baseline:** `16dfd72`  
**Stage:** `PHASE 3 — UI-C1.2H`  
**Mode:** Implementation → Verification → Qualification → Report → Git Closure  
**Language:** Russian

---

# 0. ROLE

Ты выполняешь строго ограниченный implementation stage `UI-C1.2H` проекта TravelHub.

Работай как Senior/Staff Full-Stack Engineer + QA/Security Engineer.

Не доверяй собственным предположениям и не расширяй scope без доказательства из repository/docs/current architecture.

Canonical business truth уже существует в backend/domain/query services и утверждённых registry/state-machine контрактах.

Твоя задача — реализовать утверждённый Help / Business Dictionary / i18n / Accessibility слой, не изменяя бизнес-смысл существующей Commerce Center архитектуры.

---

# 1. BASELINE И START CONDITION

Начальная точка:

```text
16dfd72
```

Перед изменениями:

```bash
git status --short
git rev-parse HEAD
git diff --check
```

Обязательное условие:

```text
HEAD == 16dfd72
working tree source-clean
staged source changes = none
```

Если baseline не совпадает или обнаружены неожиданные source changes:

**STOP.**

Не reset/restore/delete чужие изменения без явного разрешения.

---

# 2. APPROVED H SCOPE

Реализовать:

1. TravelHub Help / Business Dictionary production UI.
2. Shared typed Help/Metric Registry.
3. Canonical Help metadata contract.
4. KPI Help / definition popovers, где они применимы.
5. Status Help / definitions.
6. RU / AZ / EN localization.
7. Accessibility для Help UI и triggers/popovers.
8. Responsive behavior.
9. Registry/i18n/Help/accessibility tests.
10. Regression against accepted `UI-C1.2G`.

Дополнительно:

11. Удалить hardcoded Russian fallbacks:
```text
t("requests.group.lifecycle", locale) || "Жизненный цикл"
t("requests.group.exceptions", locale) || "Проблемы и завершения"
```

Все user-facing canonical strings должны проходить через i18n.

---

# 3. ABSOLUTE OUT OF SCOPE

Запрещено менять:

- RequestStatus;
- OrderStatus;
- OrderPaymentStatus;
- BookingStatus;
- PaymentStatus;
- RefundStatus;
- state machines;
- KPI business formulas;
- KPI/filter semantics;
- URL-state semantics;
- Header Period semantics;
- one-active-KPI invariant;
- server-side filtering;
- API contracts;
- backend business logic;
- RBAC semantics;
- tenant isolation;
- Finance ownership;
- Payment/Refund domain semantics;
- Order → Booking → Payment relation model;
- PROD-01 product/service model;
- canonical Commerce Center shell.

Нельзя вводить:

```text
PARTIALLY_CONFIRMED
```

как новый canonical Booking status.

Не создавать refund-status table column в Payments.

Не вычислять KPI на frontend.

Не дублировать backend business truth в Help.

Если реализация требует изменения любого пункта выше:

**STOP и зафиксируй BLOCKER.**

---

# 4. ARCHITECTURAL AUTHORITY CHAIN

Соблюдать:

```text
BACKEND DOMAIN / QUERY SERVICES
        ↓
BUSINESS CALCULATION AUTHORITY

SHARED TYPED HELP / METRIC REGISTRY
        ↓
METRIC / STATUS METADATA AUTHORITY

i18n
        ↓
LOCALIZED PRESENTATION TEXT

HELP UI / KPI POPOVER / STATUS HELP
        ↓
CONSUMERS ONLY
```

Help Registry не является источником KPI values.

Help UI не является источником business truth.

i18n не является источником metric semantics.

---

# 5. HELP REGISTRY

Создай:

```text
frontend/lib/help-registry.ts
```

Допустим отдельный typed bridge:

```text
frontend/lib/help-i18n-keys.ts
```

если он архитектурно оправдан.

Registry должен быть typed и импортируемым из UI и tests.

## 5.1 Canonical HelpEntry

Реализуй typed contract, содержащий:

```ts
id
type
domain
purpose
source
scope
businessDefinition
formula?
period?
statusMapping?
inclusions?
exclusions?
overlapRule?
reconciliationRule?
drillDown?
helpDescription
comparisonPeriod?
currencyUnit?
relatedMetrics?
workspace?
localizationKeys
contractVersion
changeNote?
```

Типы должны запрещать случайные ad-hoc fields.

Stable ID:

```text
{domain}.{metric-or-status}
```

Примеры:

```text
requests.kpi.total
requests.status.new
orders.status.new
orders.payment.unpaid
bookings.status.confirmed
payments.status.captured
payments.refund.status.requested
```

Stable ID никогда не локализуется.

---

# 6. CANONICAL REGISTRY INVENTORY

## 6.1 Requests

Обязательно покрыть:

### KPI

Все существующие Requests KPI, включая:

```text
requests.kpi.total
```

и все canonical KPI cards, реально существующие после G.

### Statuses

Все 12:

```text
NEW
CHECKING
SUPPLIER_TIMEOUT
PRICE_CHANGED
CUSTOMER_ACCEPTED
CONFIRMED
CONVERTED
REJECTED
UNAVAILABLE
EXPIRED
CUSTOMER_PAYMENT_TIMEOUT
CANCELLED_BY_CUSTOMER
```

Stable IDs:

```text
requests.status.new
requests.status.checking
requests.status.supplier_timeout
requests.status.price_changed
requests.status.customer_accepted
requests.status.confirmed
requests.status.converted
requests.status.rejected
requests.status.unavailable
requests.status.expired
requests.status.customer_payment_timeout
requests.status.cancelled_by_customer
```

Groups:

```text
requests.group.lifecycle
requests.group.exceptions
```

Groups не являются новыми statuses.

---

# 7. ORDERS

Покрыть:

- все существующие lifecycle KPI;
- все payment KPI;
- 12 canonical OrderStatus;
- 4 OrderPaymentStatus;
- group metadata.

Groups:

```text
orders.group.lifecycle
orders.group.rework
orders.group.exceptions
orders.group.payment
```

Payment dimension остаётся отдельным от lifecycle.

---

# 8. BOOKINGS

Покрыть:

- все существующие Booking KPI;
- 13 canonical BookingStatus;
- group metadata.

Groups:

```text
bookings.group.lifecycle
bookings.group.awaiting
bookings.group.decisions
bookings.group.terminal
```

Canonical statuses:

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

Критически:

```text
PARTIALLY_CONFIRMED
```

не должен существовать в Help Registry.

Не создавать искусственных переходов/стрелок.

---

# 9. PAYMENTS

Разделять:

```text
PaymentStatus
RefundStatus
```

## PaymentStatus — 6

```text
PENDING
AUTHORIZED
CAPTURED
FAILED
CANCELLED
REFUNDED
```

## RefundStatus — 4

```text
REQUESTED
APPROVED
PROCESSED
FAILED
```

Stable IDs:

```text
payments.status.pending
payments.status.authorized
payments.status.captured
payments.status.failed
payments.status.cancelled
payments.status.refunded

payments.refund.status.requested
payments.refund.status.approved
payments.refund.status.processed
payments.refund.status.failed
```

Не превращать:

```text
CASH
```

в PaymentStatus.

Не смешивать PaymentStatus и RefundStatus.

Не создавать RefundStatus column в Payments table.

Canonical deep-link precedence сохраняется:

```text
paymentStatus > refundStatus > currencyCard
```

---

# 10. KPI SEMANTICS

Help definition должна описывать существующий KPI, а не создавать новый.

Для каждого KPI, где применимо, зафиксировать:

- purpose;
- source;
- scope;
- business definition;
- formula;
- period;
- status mapping;
- inclusions;
- exclusions;
- overlap;
- reconciliation;
- drill-down;
- comparison period;
- currency/unit.

Не писать приблизительные формулы.

Если canonical formula/source невозможно доказать из repository/backend:

**STOP или явно пометь entry как blocked by missing authority.**

Нельзя придумывать бизнес-формулу.

---

# 11. STATUS SEMANTICS

Каждый canonical status должен иметь:

- stable ID;
- localized title;
- business definition;
- purpose;
- source;
- applicable scope;
- inclusions/exclusions where meaningful;
- related statuses/metrics where useful;
- workspace applicability;
- contract version.

Status Help должен объяснять бизнес-смысл статуса, но не менять state machine.

---

# 12. HELP CENTER

Создай production Help Center согласно утверждённой архитектуре.

Предполагаемый route:

```text
/app/help
```

Допустим deep-link:

```text
/app/help?topic=requests.kpi.total
/app/help?topic=bookings.status.confirmed
```

Но конкретную routing implementation выбери после проверки существующей Next.js архитектуры.

Help Center должен:

- показывать доступные Help topics;
- разрешать stable ID;
- отображать localized content;
- показывать business definition;
- показывать metadata в appropriate UI;
- поддерживать deep links;
- корректно обрабатывать неизвестный ID;
- не показывать raw internal data как business definition;
- не вычислять KPI.

---

# 13. KPI HELP / POPOVERS

Добавить Help trigger/popover там, где это применимо к KPI/status surfaces.

Минимально:

```text
MetricHelpTrigger
MetricHelpPopover
```

или эквивалентная реализация.

Popover должен брать content из:

```text
Help Registry → localizationKeys → i18n
```

а не из hardcoded JSX strings.

Short help должен быть кратким.

Business Dictionary должен позволять перейти к полному определению.

---

# 14. I18N

Поддержка:

```text
RU
AZ
EN
```

Registry хранит mapping:

```ts
localizationKeys: {
  title: "...",
  short: "...",
  description: "..."
}
```

Stable ID нельзя автоматически считать i18n key.

Запрещено:

```ts
t(id, locale)
```

если ID явно не зарегистрирован как i18n key.

Использовать explicit mapping.

---

# 15. RAW KEY / FALLBACK POLICY

Устранить:

```text
|| "Жизненный цикл"
|| "Проблемы и завершения"
```

Не заменять их другой inline Russian строкой.

Canonical rule:

```text
user-facing canonical string
        ↓
i18n key
        ↓
localized value
```

Если ключ отсутствует:

- использовать централизованную fallback policy;
- не использовать page-level hardcoded Russian fallback;
- в development/test желательно обнаруживать missing canonical key как contract error.

Не ломать существующий i18n runtime без необходимости.

---

# 16. ACCESSIBILITY

Help trigger должен иметь:

- accessible name;
- keyboard accessibility;
- правильный role;
- visible/focusable interaction;
- screen-reader-visible content;
- Escape close, где применимо;
- корректный focus behavior.

Help не должен быть доступен только через hover.

Не использовать цвет как единственный способ передачи значения.

Проверить:

```text
375
768
1024
1280
```

и keyboard flow.

---

# 17. RESPONSIVE UX

Help Center и popovers должны корректно работать:

```text
mobile
tablet
desktop
```

Не допускать:

- overflow;
- clipped popovers;
- inaccessible controls;
- unusable deep-link pages;
- layout breakage существующего Operations Center.

---

# 18. TESTS

Добавить tests.

## Registry

Проверить:

- все canonical IDs;
- стабильность ID;
- required metadata;
- localization mapping;
- Requests = 12 statuses;
- Orders = 12 + 4;
- Bookings = 13;
- Payments = 6 + 4;
- отсутствует `PARTIALLY_CONFIRMED`;
- PaymentStatus ≠ RefundStatus;
- CASH не является PaymentStatus.

## i18n

Проверить:

```text
RU
AZ
EN
```

для всех Help entries.

Проверить отсутствие raw keys.

Проверить отсутствие page-level hardcoded Russian fallback.

## Help UI

Проверить:

- registry → UI binding;
- topic rendering;
- stable-ID deep links;
- KPI popover;
- status help;
- unknown topic behavior.

## Accessibility

Проверить:

- accessible name;
- role;
- keyboard;
- Escape;
- focus;
- screen-reader-visible semantics.

## Regression

Обязательно сохранить:

```text
Requests: 12
Orders: 12 + 4 payment
Bookings: 13
Payments: 6 + 4 refund
```

И существующие G URL/filter/KPI semantics.

---

# 19. REGRESSION AGAINST G

После implementation выполнить regression.

Проверить все четыре registry:

```text
Requests
Orders
Bookings
Payments
```

Обязательно:

- Header Period;
- KPI selection;
- one-active KPI;
- URL state;
- reload;
- popstate;
- server-side filters;
- table filtering;
- sorting;
- i18n RU/AZ/EN;
- responsive;
- RBAC;
- tenant isolation;
- console errors.

Help implementation не должна менять существующие semantics.

---

# 20. AUDIT-FIRST DURING IMPLEMENTATION

Перед каждым крупным изменением:

1. Найти существующий implementation point.
2. Проверить reusable component.
3. Проверить существующий i18n key.
4. Проверить registry/spec.
5. Только затем изменять.

Не создавать дубликаты уже существующих abstractions.

Особенно проверить:

```text
CommerceKpiCard
StatusBadge
SortableHeader
TableHeaderFilter
registry-url-state
i18n.tsx
requests-registry.spec.tsx
orders-registry.spec.tsx
bookings-registry.spec.tsx
payments-registry.spec.tsx
```

---

# 21. NO SILENT FALLBACK / NO FAKE EVIDENCE

Запрещено:

- подменять отсутствующий Help metadata выдуманным текстом;
- утверждать, что backend является source, если это не доказано;
- создавать fake API;
- создавать fake metrics;
- писать тесты только на implementation details;
- использовать hardcoded data исключительно ради прохождения тестов;
- скрывать missing translations;
- скрывать missing registry entries.

Если authority отсутствует:

```text
BLOCKED / NEEDS AUTHORITY
```

и остановиться вместо выдумывания.

---

# 22. VERIFICATION ORDER

После implementation:

### Step 1
Static checks.

### Step 2
Registry tests.

### Step 3
i18n tests.

### Step 4
Help UI tests.

### Step 5
Accessibility tests.

### Step 6
Existing G regression tests.

### Step 7
TSC.

### Step 8
Production build.

### Step 9
Backend/frontend runtime.

### Step 10
Real browser / hydrated DOM.

### Step 11
Responsive.

### Step 12
Console/network errors.

### Step 13
RBAC / tenant isolation smoke checks.

---

# 23. RUNTIME QUALIFICATION

Не принимать:

```text
source looks correct
tests pass
```

как достаточное доказательство.

Нужен реальный runtime.

Проверить:

```text
/app/help
/app/help?topic=...
Requests
Orders
Bookings
Payments
```

Проверить:

- Help Center реально загружается;
- localized content реально отображается;
- popover реально открывается;
- keyboard interaction работает;
- stable deep link работает;
- неизвестный topic обрабатывается;
- существующие Operations Center страницы не регрессировали.

---

# 24. TEST FAILURE POLICY

До изменения tests зафиксировать baseline.

Если появляется failure:

1. определить affected stage;
2. определить regression или baseline failure;
3. не менять тест только ради green;
4. если failure вызван H implementation — исправить implementation;
5. если тест действительно устарел из-за утверждённого UX изменения — изменить тест с доказательством;
6. pre-existing unrelated failure оставить явно зарегистрированным.

Не использовать:

```text
test.skip
expect(...).toBeTruthy()
```

для маскировки проблемы.

---

# 25. FINAL REPORT

Создать:

```text
docs/reports/PHASE_3_UI_C1_2H_HELP_I18N_ACCESSIBILITY_QUALIFICATION_REPORT.md
```

Report обязательно на русском языке.

Структура:

```text
1. Stage / Baseline
2. Scope
3. Audit Findings
4. Architecture Implemented
5. Help Registry
6. Canonical Entry Inventory
7. i18n
8. Help Center
9. KPI/Status Help
10. Accessibility
11. Responsive
12. Tests
13. Runtime Qualification
14. Regression vs G
15. Security/RBAC/Tenant Isolation
16. Known Baseline Failures
17. Files Changed
18. Git Evidence
19. Final Verdict
20. Final SHA
```

Для каждого PASS/FIXED утверждения дать evidence.

Не писать:

```text
PASS
```

без доказательства.

---

# 26. GIT HARD CLOSURE

После полной qualification:

```bash
git status --short
git diff --check
git diff
git diff --cached
git log -1 --oneline
```

Проверить, что:

- все intended changes committed;
- no unintended source changes;
- report committed;
- working tree clean;
- final SHA известен.

Обязательно предоставить:

```text
BASELINE SHA:
16dfd72

FINAL SHA:
<actual sha>

WORKTREE:
CLEAN
```

Не считать stage closed только по сообщению Freebuff.

---

# 27. FINAL VERDICT RULES

### VERDICT A — ACCEPTED

Только если:

- Help implementation complete;
- registry complete;
- canonical metadata valid;
- i18n RU/AZ/EN valid;
- accessibility PASS;
- responsive PASS;
- runtime PASS;
- G regression PASS;
- tests pass except explicitly documented pre-existing unrelated failures;
- TSC PASS;
- build PASS;
- no unauthorized architecture changes;
- Git clean;
- report committed;
- final SHA proven.

### VERDICT B — VALID SYSTEM FAIL

Использовать только если implementation exists but qualification reveals real defect that cannot be silently ignored.

### VERDICT C — BLOCKED

Если отсутствует required authority, environment, access, backend dependency или иной blocker preventing valid qualification.

---

# 28. STOP CONDITIONS

Немедленно STOP при:

- изменении canonical status universe;
- появлении `PARTIALLY_CONFIRMED`;
- изменении KPI/filter semantics;
- изменении backend business logic;
- изменении API contracts;
- изменении RBAC/tenant semantics;
- неожиданном Prisma/schema migration;
- unexpected dependency upgrade;
- неожиданном изменении Commerce Center architecture;
- попытке заменить backend truth frontend calculation;
- необходимости придумать отсутствующую business definition/formula;
- baseline mismatch;
- обнаружении чужих незакоммиченных source changes.

В STOP report указать:

```text
FINDING
EVIDENCE
IMPACT
WHY OUT OF SCOPE
REQUIRED DECISION
```

---

# 29. EXECUTION PROTOCOL

Работать строго:

```text
AUDIT
↓
IMPLEMENTATION
↓
TESTS
↓
STATIC VERIFICATION
↓
RUNTIME QUALIFICATION
↓
REGRESSION
↓
REPORT
↓
GIT HARD CLOSURE
↓
FINAL VERDICT
```

Не перескакивать этапы.

Не коммитить промежуточные изменения до завершения необходимой verification, если это не требуется repository workflow.

---

# 30. FINAL RESPONSE FORMAT

В финальном сообщении предоставить:

```text
PHASE 3 — UI-C1.2H

VERDICT: A / B / C

BASELINE SHA:
16dfd72

FINAL SHA:
<sha>

Implementation:
PASS / FAIL

Help Registry:
PASS / FAIL

Help Center:
PASS / FAIL

i18n RU/AZ/EN:
PASS / FAIL

Accessibility:
PASS / FAIL

Responsive:
PASS / FAIL

Runtime:
PASS / FAIL

G Regression:
PASS / FAIL

TSC:
PASS / FAIL

Build:
PASS / FAIL

Git:
CLEAN / NOT CLEAN

Report:
<path>

Blocking findings:
<none or list>
```

---

# 31. CURRENT COMMAND

**НАЧАТЬ IMPLEMENTATION UI-C1.2H ПО ЭТОМУ PROMPT.**

Но сначала подтвердить:

```text
HEAD == 16dfd72
source working tree clean
```

Затем выполнить implementation согласно утверждённому H Architecture / Implementation Plan.

**Не менять scope.**
**Не менять business truth.**
**Не придумывать отсутствующие semantics.**
**Не считать stage закрытым без runtime + regression + report + Git hard closure.**
