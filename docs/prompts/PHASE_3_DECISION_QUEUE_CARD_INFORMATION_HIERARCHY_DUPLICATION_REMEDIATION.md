# PHASE 3 — DECISION QUEUE — CARD INFORMATION HIERARCHY REMEDIATION
## ALL SIGNAL CARDS / DUPLICATE METRICS / SEMANTIC LABELS / REASON vs IMPACT
## POST RUNTIME SEMANTIC CLOSURE

---

# 1. ЦЕЛЬ

Decision Queue runtime semantics, destination predicates, evidence columns и pagination уже проходили отдельные reconciliation/remediation этапы.

Текущий подтверждённый UX-дефект:

```text
одна и та же информация повторяется
в нескольких слоях одной Decision Queue card
```

Пример `FAILED_PAYMENTS`:

```text
Неуспешные платежи
4 неуспешных платежей

Объектов: 4
Наблюдений: 28

Неуспешных платежей: 4
Самый старый сбой: 2 дн 4 ч
Сумма неуспешных: 321 ₼
Группы ошибок: UNKNOWN: 4

Причина
Основной наблюдаемый фактор:
Доминирующий код ошибки: 4 из 4 — UNKNOWN

Влияние
Неуспешных платежей: 4
Сумма неуспешных попыток: 321 ₼
Способы оплаты: UNKNOWN: 4
Самый старый сбой: 2 дн 4 ч
```

Здесь количество, сумма, возраст и `UNKNOWN` повторяются или потенциально получают разные semantic labels.

Нужно выполнить SYSTEM-WIDE audit всех Decision Queue cards и привести их к единой информационной иерархии.

---

# 2. SCOPE

Аудит должен охватить ВСЕ существующие типы Decision Queue signals/cards, а не только `FAILED_PAYMENTS`.

Минимум проверить:

```text
SERVICES_WITHOUT_SALES
BOOKING_CONFIRMATION_DELAY
FAILED_PAYMENTS
RECENT_CANCELLATIONS
PENDING_REFUNDS
UPCOMING_BOOKINGS
```

и все дополнительные signal types, реально зарегистрированные/рендерящиеся в текущем проекте.

Сначала получить полный runtime/source inventory signal types.

Не ограничиваться 6 примерами выше.

---

# 3. ОСНОВНОЙ UX PRINCIPLE

Каждый слой карточки должен отвечать на отдельный вопрос:

```text
TITLE / SUMMARY
→ Что произошло?

SCALE / KEY METRICS
→ Каков масштаб?

REASON
→ Почему это произошло / какой фактор наблюдается?

IMPACT
→ Какое отдельное бизнес-последствие это создаёт?

ACTIONS
→ Что пользователь может сделать?
```

Одна и та же metric/value не должна механически повторяться между слоями.

---

# 4. NO DUPLICATE INFORMATION

Canonical rule:

```text
Same business fact
should normally appear once per card.
```

Например:

```text
FAILED_PAYMENTS count = 4
```

не должен одновременно отображаться как:

```text
subtitle: 4 неуспешных платежей
objects: 4
metric: Неуспешных платежей 4
impact: Неуспешных платежей 4
```

Оставить только наиболее полезное расположение.

---

# 5. ДОПУСТИМОЕ ПОВТОРЕНИЕ

Повтор допустим только если:

```text
есть отдельная доказанная UX-функция
```

Например headline может кратко сообщать проблему, а detailed metric давать другой denominator/context.

Но report должен явно объяснить такое исключение.

Не считать обычное повторение текста "UX reason".

---

# 6. OBJECTS / OBSERVATIONS AUDIT

Отдельно проверить generic поля:

```text
Объектов
Наблюдений
```

Для каждого signal определить:

```text
что такое object?
что такое observation?
отличается ли object count от headline count?
нужно ли это число пользователю для решения?
```

Если:

```text
headline count = object count
```

и `Объектов` не добавляет нового смысла:

```text
REMOVE / HIDE
```

Если `Наблюдений` — внутренняя detector telemetry и не является decision-useful business metric:

```text
не показывать в primary card UI
```

Можно сохранить в diagnostic/audit data, если это нужно системе.

---

# 7. НЕ УДАЛЯТЬ DATA SOURCE

Удаление визуального дубля НЕ означает удаление canonical data из backend/model.

Нужно различать:

```text
data collection
data API
decision detector evidence
user-facing card presentation
```

Не ломать detector/auditability ради UI cleanup.

---

# 8. FAILED PAYMENTS — REQUIRED AUDIT

Для текущего примера проверить каждый field:

```text
headline count
objects
observations
failed payments count
oldest failure
failed amount
error groups
dominant error code
impact failed count
impact failed amount
payment methods
impact oldest failure
```

Для каждого вернуть:

```text
business meaning
canonical source
current label
current section
duplicate-of
decision usefulness
KEEP / REMOVE / MOVE / RENAME
```

---

# 9. UNKNOWN SEMANTIC COLLISION

Подтверждённый suspicious case:

```text
Группы ошибок: UNKNOWN: 4

Причина:
Доминирующий код ошибки: UNKNOWN

Влияние:
Способы оплаты: UNKNOWN: 4
```

Нужно установить source field каждого `UNKNOWN`.

Hard rule:

```text
error code
≠
error group
≠
payment method
```

если canonical model не доказывает обратное.

Если `Способы оплаты: UNKNOWN` фактически построено из error-code aggregation:

```text
это semantic labeling defect
→ FIX
```

Не переименовывать blindly. Сначала trace source.

---

# 10. TITLE / SUMMARY CONTRACT

Title должен идентифицировать тип проблемы:

```text
Неуспешные платежи
Ожидают обработки возвраты
Услуги без продаж
...
```

Summary/subtitle может кратко дать основной масштаб:

```text
4 неуспешных платежа
```

Но если count уже естественно включён в title/summary, не повторять его в generic `Объектов` и первой KPI metric без дополнительного смысла.

---

# 11. KEY METRICS CONTRACT

Показывать только decision-useful, mutually distinct metrics.

Обычно:

```text
2–4 metrics
```

но не hardcode количество, если конкретному signal нужно меньше/больше.

Каждая metric должна добавлять новый факт.

Пример для Failed Payments:

```text
Сумма неуспешных попыток: 321 ₼
Самый старый сбой: 2 дн 4 ч
```

если count уже есть в summary.

---

# 12. REASON CONTRACT

`Причина` должна содержать causal/diagnostic evidence, а не пересказывать scale.

Пример:

```text
Доминирующий код ошибки:
UNKNOWN — 4 из 4
```

может быть Reason, если source действительно error code.

Не помещать сюда:

```text
Неуспешных платежей: 4
Сумма: 321 ₼
```

если это scale/impact data.

---

# 13. REASON ≠ PROVEN CAUSE

Если detector показывает только correlation/observed factor, UI не должен утверждать причинность.

Допустимые формулировки:

```text
Основной наблюдаемый фактор
Доминирующий код ошибки
Чаще всего наблюдается
```

Не писать:

```text
Причина сбоя — X
```

если система не имеет causal evidence.

---

# 14. IMPACT CONTRACT

`Влияние` должно показывать отдельное business consequence.

Примеры возможных impact facts — ТОЛЬКО если canonical data реально существует:

```text
затронутые заказы
затронутые клиенты
сумма заказов под риском
сумма ожидаемого возврата
нарушение SLA
```

Запрещено придумывать эти metrics.

---

# 15. EMPTY / DUPLICATE IMPACT

Если для signal нет отдельного canonical impact data:

```text
не заполнять Impact копией Summary/Metrics
```

Допустимые варианты:

```text
hide Impact section
```

или другой existing design-system empty behavior.

Лучше отсутствие блока, чем искусственное дублирование.

---

# 16. SIGNAL-BY-SIGNAL AUDIT

Для каждого signal построить field-level matrix:

| Field | Source | Meaning | Current section | Duplicate? | Correct label? | Decision-useful? | Action |
|---|---|---|---|---|---|---|---|

Action:

```text
KEEP
REMOVE FROM UI
MOVE
RENAME
MERGE
HIDE CONDITIONALLY
```

---

# 17. SERVICES WITHOUT SALES

Проверить возможные повторы:

```text
service count
object count
observation count
zero-sales metric
period without sales
potential value/price metrics
reason
impact
```

Не предполагать заранее, какие из них существуют.

Trace actual runtime fields.

---

# 18. BOOKING CONFIRMATION DELAY

Проверить:

```text
booking count
object count
observation count
waiting duration
SLA
oldest waiting
reason
impact
```

Не показывать одно и то же waiting time в Metrics и Impact без отдельного смысла.

---

# 19. PENDING REFUNDS

Проверить различие:

```text
refund count
order count
objects
observations
refund amount
oldest request
status aggregation
impact
```

Важно сохранить many-to-one semantics:

```text
refunds ≠ orders
```

Если оба counts полезны, можно показывать оба, но labels должны быть точными:

```text
Возвратов: 87
Заказов затронуто: 81
```

Это НЕ duplicate.

---

# 20. UPCOMING BOOKINGS

Проверить:

```text
booking count
object count
observation count
nearest service
date distribution
status distribution
reason
impact
```

Не создавать искусственный `Impact`, если upcoming booking сам по себе не является негативным impact.

---

# 21. RECENT CANCELLATIONS

Проверить:

```text
cancellation count
object count
observation count
cancelled amount
period
reason distribution
impact
```

Если count уже headline — не повторять без дополнительного denominator/context.

---

# 22. ALL OTHER SIGNALS

Для всех остальных discovered Decision Queue signal types применить тот же audit.

Нельзя вернуть VERDICT A после исправления только видимых сейчас 6 типов.

---

# 23. INFORMATION PRIORITY

Карточка должна позволять быстро прочитать:

```text
1. Что случилось
2. Насколько это важно
3. Почему это требует внимания
4. Что делать
```

Не превращать карточку в dump detector telemetry.

---

# 24. TECHNICAL TELEMETRY

Поля вроде:

```text
observations
fingerprint
detector runs
internal sample size
raw aggregation key
```

не должны автоматически отображаться пользователю.

Если они нужны для admin diagnostics — использовать существующий diagnostic/detail layer, если он есть.

Не создавать новый large diagnostics feature в этом remediation.

---

# 25. LABEL SEMANTICS

Каждый label должен соответствовать source.

Проверить минимум:

```text
Ошибка
Код ошибки
Группа ошибок
Способ оплаты
Платёж
Заказ
Бронирование
Возврат
Услуга
Объект
Наблюдение
Сумма
Возраст / время ожидания
```

Не использовать один aggregation source под несколькими несвязанными labels.

---

# 26. NUMBER SEMANTICS

Проверить denominators.

Пример:

```text
UNKNOWN — 4 из 4
```

Report должен определить:

```text
4 чего?
4 payments?
4 attempts?
4 orders?
```

UI label/context должен это делать понятным.

---

# 27. MONEY SEMANTICS

Не смешивать:

```text
order amount
payment attempt amount
refund amount
service price
GMV
revenue
```

Даже если численно значения совпадают на seed data.

---

# 28. TIME SEMANTICS

Не смешивать:

```text
oldest event age
average age
SLA breach duration
service date
request age
```

Каждый time metric — отдельное значение с точным label.

---

# 29. SHARED CARD COMPONENT

Проверить architecture текущего Decision Queue renderer.

Если duplicate UI возникает из shared generic rendering:

```text
исправить shared information hierarchy
```

вместо 6–N copy-paste hacks.

Но сохранить signal-specific semantics.

Не делать большой redesign Command Center.

---

# 30. DATA-DRIVEN CARD SCHEMA

Если cards формируются data-driven schema/config, проверить возможность явно задавать:

```text
summaryField
metrics[]
reason[]
impact[]
metadata visibility
```

Не создавать новую abstraction без необходимости, но устранить root cause системного duplication.

---

# 31. VISUAL DENSITY

После remediation карточка должна стать короче и легче для scanning.

Не заменять удалённые duplicates декоративными placeholders.

Не увеличивать card height без причины.

---

# 32. ACTIONS НЕ МЕНЯТЬ

Не менять уже reconciled actions:

```text
Принять
Решить
Отклонить
Открыть услуги
Проверить доступность
Открыть платежи
Открыть возвраты
Открыть предстоящие
etc.
```

Этот remediation касается information hierarchy, а не lifecycle/navigation semantics.

---

# 33. COUNTS НЕ МЕНЯТЬ

Не изменять detector predicates/counts ради устранения визуального дубля.

Если UI показывает count в другом месте:

```text
move/hide presentation
```

а не менять detector.

---

# 34. I18N

Все изменённые labels проверить:

```text
RU
AZ
EN
```

Raw keys = 0.

Проверить pluralization/grammar для counts, если existing i18n architecture это поддерживает.

---

# 35. ACCESSIBILITY

После hide/remove/move:

```text
semantic labels remain understandable
buttons retain accessible names
important information not conveyed only by color
```

---

# 36. RUNTIME BEFORE/AFTER EVIDENCE

Для каждого signal report должен содержать compact before/after.

Пример:

```text
FAILED_PAYMENTS

BEFORE
count shown 3 times
amount shown 2 times
oldest failure shown 2 times
UNKNOWN shown under 3 semantic labels

AFTER
count shown once
amount shown once
oldest failure shown once
error code shown only as error code
payment method shown only from payment-method source, or hidden if unavailable
```

---

# 37. DUPLICATION SCORE

Для каждого card посчитать:

```text
number of visible business facts
number of duplicate visible occurrences
```

До/после.

Не нужен сложный algorithm.

Простой manual/runtime audit достаточен.

Goal:

```text
unjustified duplicate occurrences = 0
```

---

# 38. REQUIRED RUNTIME MATRIX

| Signal | Duplicate facts before | Duplicate facts after | Semantic label defects | Result |
|---|---:|---:|---:|---|

Для ВСЕХ discovered signal types.

---

# 39. REQUIRED FIELD DECISION MATRIX

Для каждого signal:

| Field | Value example | Source | Current section | Final section | Decision |
|---|---|---|---|---|---|

Это ключевой evidence artifact.

---

# 40. BROWSER EVIDENCE

Открыть в browser все active/history card types, доступные на runtime dataset.

Проверить:

```text
desktop layout
no duplicate facts
no empty headings
no orphan separators
no broken card spacing
actions still work
evidence still understandable
```

Если какой-то signal отсутствует в runtime dataset — использовать isolated fixture/component test, не портить canonical data.

---

# 41. ACTIVE + HISTORY

Проверить обе вкладки:

```text
Активные
История
```

Если один и тот же card renderer используется для resolved/dismissed signals, cleanup должен работать одинаково.

Lifecycle history metadata не удалять, если оно необходимо в History.

---

# 42. TESTS

Добавить focused frontend/component tests, где возможно, минимум:

```text
duplicate count not rendered
duplicate amount not rendered
impact hidden when no distinct impact
correct semantic source for error/payment-method labels
signal-specific distinct counts preserved
```

Не писать brittle tests на полный текст всей карточки без необходимости.

---

# 43. BACKEND

Backend менять только если semantic label defect вызван неправильным API mapping.

Если API уже отдаёт правильные distinct fields, исправлять frontend.

Не менять backend purely to reshape presentation без необходимости.

---

# 44. SECURITY / LIFECYCLE REGRESSION

Подтвердить:

```text
lifecycle mutations unchanged
action destinations unchanged
RBAC unchanged
signal counts unchanged
detector predicates unchanged
```

---

# 45. NO SCOPE CREEP

Не реализовывать:

```text
new Decision Queue signals
new KPIs
CRM Step 3.5
Supplier Settlement S.1–S.19
new payment methods
new error taxonomy
new refund lifecycle
new detector semantics
```

---

# 46. REPORT FILE

Создать:

```text
docs/prompts/PHASE_3_DECISION_QUEUE_CARD_INFORMATION_HIERARCHY_DUPLICATION_REMEDIATION_REPORT.md
```

---

# 47. REQUIRED REPORT CONTENT

Report:

```text
Root cause
Signal inventory
Shared renderer architecture
Before/after screenshots or browser evidence
Field decision matrix per signal
Duplication matrix
Semantic-label findings
Objects/Observations decision
Reason/Impact decision
i18n
Tests
TSC/build
Git evidence
Remaining findings
```

---

# 48. HARD ACCEPTANCE CRITERIA

VERDICT A только если:

1. Full Decision Queue signal inventory completed.
2. Every signal card audited.
3. Same count is not redundantly shown multiple times without documented reason.
4. Same money metric is not duplicated without documented reason.
5. Same time metric is not duplicated without documented reason.
6. `Объектов` shown only when it adds distinct business meaning.
7. `Наблюдений` shown only when decision-useful; otherwise hidden from primary UI.
8. Reason does not merely repeat scale metrics.
9. Impact does not merely repeat summary/metrics.
10. Impact hidden/omitted when no distinct canonical impact exists.
11. Error code/group/payment method sources traced separately.
12. `UNKNOWN` is not mislabeled across unrelated dimensions.
13. Refund count vs affected order count remains distinct where applicable.
14. All number denominators understandable.
15. Money semantics remain distinct.
16. Time semantics remain distinct.
17. No detector predicate changes.
18. No signal count changes caused by presentation cleanup.
19. No lifecycle/action changes.
20. Active cards PASS.
21. History cards PASS.
22. No empty headings/separators after conditional hiding.
23. Card scanning density improved.
24. RU/AZ/EN labels PASS.
25. Raw i18n keys = 0.
26. Accessibility not regressed.
27. Relevant frontend tests PASS.
28. Backend tests PASS if backend touched.
29. Frontend TSC PASS.
30. Backend TSC PASS if backend touched.
31. Build PASS where relevant.
32. Unrelated files committed = 0.
33. Push complete.
34. HEAD == origin/master.

---

# 49. VERDICT

Только если все gates закрыты:

```text
VERDICT A — DECISION QUEUE CARD INFORMATION HIERARCHY / DUPLICATION / SEMANTIC LABELS RECONCILED
```

Если duplicate information остаётся хотя бы в одном существующем signal type:

```text
VERDICT B — DECISION QUEUE CARD INFORMATION HIERARCHY REMEDIATION INCOMPLETE
```

---

# 50. FINAL RESPONSE FORMAT

```text
VERDICT:

Signal types audited:

Root cause:

Shared renderer changes:

FAILED_PAYMENTS:
Before:
After:
Semantic fixes:

SERVICES_WITHOUT_SALES:
Before:
After:

BOOKING_CONFIRMATION_DELAY:
Before:
After:

PENDING_REFUNDS:
Before:
After:

UPCOMING_BOOKINGS:
Before:
After:

RECENT_CANCELLATIONS:
Before:
After:

Other signals:

Objects:
Observations:
Reason:
Impact:

Semantic label audit:
Error code:
Error group:
Payment method:
Refund/order distinction:
Other:

Duplication matrix:
Before total duplicate occurrences:
After total duplicate occurrences:

Active:
History:

i18n:
Accessibility:
Tests:
TSC:
Build:

Production code changed:
Files changed:
Commit:
HEAD:
origin/master:
HEAD == origin/master:
Unrelated files:

Remaining findings:
Next canonical stage:
```

---

# 51. STOP

После отчёта:

```text
STOP
```

Не запускать автоматически следующий Phase 3 stage.

Следующий этап определяется после review результата этого remediation.
