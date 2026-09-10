# PHASE 3 — Detail Route Identifier Contract Reconciliation
## ADR-OPS-001 / Payments URL Contract — Audit-Only Reconciliation Prompt

> **Режим:** AUDIT / RECONCILIATION ONLY  
> **Цель:** устранить противоречие между нормативным архитектурным контрактом и текущей реализацией Payments detail route.  
> **Запрещено:** изменять production-код, schema, RBAC, API contracts или создавать новый canonical contract до завершения reconciliation.

---

## 1. Контекст

Предыдущий audit по Detail Route Identifier Contract зафиксировал:

- Requests → `/app/requests/[id]` → internal UUID;
- Orders → `/app/orders/[id]` → internal UUID;
- Bookings → `/app/bookings/[id]` → internal UUID;
- Payments backend lookup → `:code` → `findUnique({ where: { code } })`;
- текущая реализация была нормализована к `/app/payments/[code]`;
- legacy `/app/finance/payments/[id]` сохранён как compatibility redirect.

Однако в qualification report одновременно утверждается, что `ADR-OPS-001 §6` содержит canonical Payments route `/app/payments/[id]`, а затем этот же ADR используется как основание для вывода, что canonical Payments route является `/app/payments/[code]`.

Это требует отдельного reconciliation pass.

### Ключевой конфликт

Необходимо доказательно определить единственный нормативный контракт:

```text
Option A:
Payment canonical URL = /app/payments/[id]
identifier = internal UUID

или

Option B:
Payment canonical URL = /app/payments/[code]
identifier = business code PAY-*

или

Option C:
ADR-OPS-001 допускает иной/гибридный контракт,
который нужно точно зафиксировать.

```

До разрешения этого вопроса нельзя считать предыдущий `VERDICT C` окончательно подтверждённым.

---

# 2. Главные правила выполнения

## MUST

1. Работать только с canonical repository state.
2. Сначала прочитать:
   - `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
   - `docs/architecture/TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md`
   - `docs/prompts/TRAVELHUB_MASTER_ROADMAP.md`
   - `docs/TRAVELHUB_DEBT_REGISTER.md`
3. Найти и прочитать полный текст:
   - `ADR-OPS-001`
   - `ADR-OPS-012`
   - любые ADR/reports, которые прямо ссылаются на Payments detail route;
   - `PHASE_3_DETAIL_ROUTE_IDENTIFIER_CONTRACT_AUDIT_AND_NORMALIZATION_PROMPT.md`, если он присутствует;
   - предыдущий qualification report по detail route identifiers.
4. Не ограничиваться grep по одному фрагменту. Для каждого нормативного утверждения прочитать контекст всей соответствующей секции.
5. Отделить:
   - **нормативное решение (canonical contract);**
   - **описание существующей реализации;**
   - **рекомендацию/вывод отчёта;**
   - **legacy compatibility behavior.**
6. Проверить git history:
   - commit, которым был введён `ADR-OPS-001`;
   - commits, изменявшие его §6;
   - commits, создавшие `/app/payments`;
   - commits, связанные с `/app/finance/payments`;
   - если возможно, определить какой документ был источником accepted route decision.
7. Проверить текущий код только для подтверждения implementation state. Код не изменять.

---

# 3. Обязательная source hierarchy

При конфликте использовать следующую иерархию:

1. Explicit accepted ADR / architecture contract.
2. Canonical architecture document, если он прямо фиксирует contract.
3. Accepted reconciliation/design report, который явно approved canonical decision.
4. Implementation.
5. Qualification report interpretation.

**Текущее поведение кода само по себе НЕ считается доказательством canonical architecture.**

---

# 4. Точный аудит ADR-OPS-001

## 4.1 Найти §6

Необходимо вывести дословно релевантный фрагмент `ADR-OPS-001 §6`.

Зафиксировать отдельно:

- exact route для Requests;
- exact route для Orders;
- exact route для Bookings;
- exact route для Payments;
- употребляется ли `[id]`;
- употребляется ли `[code]`;
- определяется ли семантика сегмента;
- говорится ли, что это canonical URL;
- говорится ли только о “route” без определения identifier semantics.

## 4.2 Не интерпретировать шаблон маршрута автоматически

Отдельно проверить:

```text
/app/payments/[id]
```

означает ли в ADR:

- literal Next.js dynamic segment name `id`;
- внутренний UUID;
- любой entity identifier;
- историческое имя сегмента;
- либо просто обозначение detail route.

**Нельзя предполагать semantic meaning `[id]` без подтверждения документацией или кодом, если сам ADR его не определяет.**

Аналогично:

```text
/app/payments/[code]
```

нельзя считать canonical только потому, что backend endpoint использует `:code`.

---

# 5. Аудит связанных ADR

Проверить минимум:

- `ADR-OPS-012`
- все документы, где упоминается:
  - `/app/payments`
  - `/app/payments/[id]`
  - `/app/payments/[code]`
  - `/app/finance/payments`
  - `/app/finance/payments/[id]`
  - `Payment.code`
  - `referenceNumber`
  - `Payment.id`

Составить таблицу:

| Source | Section | Exact statement | Type | Authority |
|---|---|---|---|---|
| ADR | ... | ... | normative / descriptive / compatibility | canonical / supporting |
| Report | ... | ... | ... | supporting |
| Code | ... | ... | implementation | non-authoritative |

---

# 6. Проверка semantic contract

Построить definitive taxonomy:

| Field | Значение | Role |
|---|---|---|
| `Payment.id` | internal UUID | persistence identity |
| `Payment.code` | PAY-* | business identifier |
| `Payment.referenceNumber` | MKT-PAY-* | display/reference identifier |
| `/app/payments/[...]` | ? | URL identifier |

Особенно ответить на вопрос:

> Есть ли в canonical architecture правило, связывающее URL identifier Payment именно с `code`?

Допустимые доказательства:

- явная фраза в ADR;
- explicit route + explicit identifier semantics;
- accepted architecture contract, который однозначно определяет mapping.

Недопустимое доказательство:

> “backend использует `code`, поэтому URL должен использовать `code`”.

Это может быть технически разумно, но само по себе не является архитектурным доказательством.

---

# 7. Git history audit

Проверить историю файлов/решений.

Минимально:

```bash
git log --oneline --all -- ADR-OPS-001
git log -p --all -- ADR-OPS-001
git log --oneline --all -- '*payments*'
git log -p --all -- <relevant payment route files>
```

Найти:

1. когда впервые появился `/app/payments/[id]`;
2. когда впервые появился `/app/payments/[code]`;
3. когда был введён `/app/finance/payments/[id]`;
4. когда появился statement “redirect kept”;
5. какой commit/ADR установил migration path;
6. был ли `[id]` сознательно выбран как UUID или просто использован как generic dynamic segment.

Если history не позволяет доказать intent — так и написать. Не реконструировать intent догадкой.

---

# 8. Проверка реализации

Проверить фактический current state:

### Payments

```text
registry
  ↓
detail href
  ↓
Next route
  ↓
frontend fetch
  ↓
backend controller
  ↓
service
  ↓
Prisma lookup
```

Зафиксировать:

- current canonical-looking route;
- current compatibility route;
- current API;
- lookup field;
- display field.

### Other commerce entities

Проверить, что Requests / Orders / Bookings используют UUID не только по имени `[id]`, а фактически:

```text
route
→ API :id
→ service
→ database id lookup
```

---

# 9. Security / compatibility check

Без изменения кода подтвердить:

### Payment

- authorized valid code;
- unauthorized;
- nonexistent code;
- UUID supplied where code expected;
- malformed segment;
- cross-tenant/storefront isolation.

Отдельно проверить:

> зависит ли object-level authorization от identifier type?

И отдельно:

> does compatibility route preserve exactly the same authorization semantics?

---

# 10. Обязательный вывод

После аудита выбрать **один** verdict.

## VERDICT A — CONTRACT CONFIRMED

Использовать только если evidence однозначно показывает canonical URL contract.

В отчёте обязательно написать:

```text
Canonical Payment URL:
...
URL identifier:
...
Normative source:
...
Exact section:
...
Why this is semantic contract:
...
```

После `VERDICT A`:

- если current implementation соответствует → **NO CODE CHANGE REQUIRED**;
- если current implementation не соответствует → это уже отдельный implementation qualification task.

---

## VERDICT B — CONTRACT AMBIGUOUS / RECONCILIATION REQUIRED

Использовать, если:

- ADR содержит `/app/payments/[id]`;
- но нигде нормативно не определено, что `[id]` = UUID;
- или есть конфликтующие approved documents;
- или canonical identifier intent невозможно доказать.

В этом случае:

### ЗАПРЕЩЕНО

- менять route;
- менять redirect;
- менять backend;
- менять schema;
- создавать новый ADR самостоятельно;
- объявлять `/app/payments/[code]` canonical.

Нужно выпустить только:

```text
docs/reports/PHASE_3_DETAIL_ROUTE_IDENTIFIER_CONTRACT_RECONCILIATION_REPORT.md
```

В отчёте дать:

1. conflicting evidence;
2. exact quotations;
3. authority ranking;
4. unresolved decision;
5. минимальный список вопросов/решений, которые должен принять architecture owner.

**Важно:** Proposed contract должен быть помечен:

```text
NOT CANONICAL — PENDING ARCHITECTURAL APPROVAL
```

---

## VERDICT C — IMPLEMENTATION DEFECT CONFIRMED

Использовать только если canonical contract однозначно доказан и current implementation ему противоречит.

Тогда зафиксировать:

```text
Canonical contract = ...
Current implementation = ...
Violation = ...
```

После этого implementation можно исправлять отдельным targeted pass.

---

# 11. Особое правило для текущей ситуации

Не считать автоматически, что:

```text
/app/payments/[code]
```

правильнее только потому, что:

```text
GET /finance/payments/:code
findUnique({ where: { code } })
```

И наоборот, не считать:

```text
/app/payments/[id]
```

UUID-based только потому, что dynamic segment называется `[id]`.

Именно это является центральным вопросом reconciliation.

---

# 12. Что НЕ делать

В рамках этого задания запрещены:

- изменение production code;
- изменение Prisma schema;
- миграции;
- RBAC changes;
- API contract changes;
- изменение Requests/Orders/Bookings;
- изменение D8 temporal contract;
- изменение finance domain semantics;
- удаление legacy routes;
- создание нового ADR как способ “закрыть” конфликт без owner decision;
- массовая документационная перестройка.

---

# 13. Expected report structure

Файл:

```text
docs/reports/PHASE_3_DETAIL_ROUTE_IDENTIFIER_CONTRACT_RECONCILIATION_REPORT.md
```

Структура:

```text
# PHASE 3 — Detail Route Identifier Contract Reconciliation Report

## 1. Executive Summary

## 2. Baseline SHA

## 3. Canonical Sources

## 4. ADR-OPS-001 Exact Evidence

## 5. Related ADR Evidence

## 6. Identifier Taxonomy

## 7. Git History Findings

## 8. Current Implementation State

## 9. Conflict Analysis

## 10. Security / Compatibility Analysis

## 11. Final Canonical Contract

## 12. Verdict

## 13. Required Next Action

## 14. Git Closure
```

---

# 14. Обязательная final table

В конце должна быть таблица:

| Entity | Canonical route | URL identifier | Backend lookup | Normative source | Status |
|---|---|---|---|---|---|
| Request | ... | ... | ... | ... | CONFIRMED / AMBIGUOUS |
| Order | ... | ... | ... | ... | CONFIRMED / AMBIGUOUS |
| Booking | ... | ... | ... | ... | CONFIRMED / AMBIGUOUS |
| Payment | ... | ... | ... | ... | CONFIRMED / AMBIGUOUS |

Для Payment нельзя ставить `CONFIRMED`, пока exact normative evidence не приведено.

---

# 15. Git closure

Выполнить:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
git diff --check
```

Если были изменены **только audit report**, сделать отдельный documentation-only commit.

Запрещено смешивать reconciliation report с production implementation.

После commit:

```bash
git push origin master
git status --short
git rev-parse HEAD
git rev-parse origin/master
```

Требуется:

```text
HEAD == origin/master
working tree clean
```

---

# 16. Final response format

В финальном сообщении агент обязан дать:

```text
VERDICT: A / B / C

Canonical Payment route:
...

Payment URL identifier:
...

Normative evidence:
...

ADR conflict:
YES / NO

Implementation change required:
YES / NO

Production files changed:
YES / NO

Report:
docs/reports/PHASE_3_DETAIL_ROUTE_IDENTIFIER_CONTRACT_RECONCILIATION_REPORT.md

Final SHA:
...

origin/master:
...

Working tree:
CLEAN / DIRTY
```

Не писать “everything is correct”, если canonical contract всё ещё зависит от интерпретации.

Не считать задачу закрытой до тех пор, пока конфликт `ADR-OPS-001 §6` ↔ `/app/payments/[code]` не разрешён доказательствами.
