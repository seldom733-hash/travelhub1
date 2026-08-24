# PHASE 3 — GMV DISPLAY ROUNDING & RECONCILIATION REMEDIATION
## FINAL PRE-STAGE-E NUMERIC CONSISTENCY GATE

# LANGUAGE REQUIREMENT — MANDATORY

Все ответы разработчика, findings, расчёты, DB/API/runtime evidence, результаты тестов,
финальный отчёт и VERDICT должны быть предоставлены **НА РУССКОМ ЯЗЫКЕ**.

Technical identifiers, field names, paths, commands, SHA и code сохранять в оригинальном виде.

---

# 1. CONTEXT

Уже закрыты:

```text
GMV / COLLECTION / REFUND SEMANTICS        → CLOSED
GMV LIFECYCLE i18n RUNTIME REMEDIATION     → COMPLETE
```

Новые Executive cards отображаются корректными пользовательскими названиями:

```text
GMV
11 514 ₼

Оплачено по GMV
10 838 ₼

Остаток к оплате
675 ₼
```

Однако визуально:

```text
11 514 - 10 838 = 676
```

тогда как UI показывает:

```text
Outstanding = 675
```

Это создаёт впечатление ошибочного финансового расчёта.

Перед Stage E необходимо определить:

```text
A. backend/API calculation defect
или
B. independent display-rounding inconsistency
```

и устранить проблему минимально и доказуемо.

---

# 2. CURRENT CANONICAL SEMANTICS — DO NOT CHANGE

Сохранять:

```text
GMV
= qualified order value
= status NOT IN (NEW, CANCELLED)

Collected GMV
= cohort-based Order.paidAmount for qualified orders

Outstanding
= MAX(0, GMV - Collected GMV)

Completed GMV
= FULFILLED/CLOSED

Payment Volume
= EVENT_PERIOD CAPTURED payments by Payment.paidAt
```

Этот remediation НЕ является пересмотром financial policy.

---

# 3. FIRST TASK — EXACT VALUES

Для того же period/filter/context, где UI показывает:

```text
GMV             11 514 ₼
Collected GMV   10 838 ₼
Outstanding        675 ₼
```

получить exact values без display rounding:

```text
DB GMV:
DB Collected GMV:
DB Outstanding:

API GMV:
API Collected GMV:
API Outstanding:
```

Показать достаточную decimal precision.

---

# 4. EXACT ARITHMETIC PROOF

Обязательно доказать:

```text
Exact Outstanding
=
MAX(0, Exact GMV - Exact Collected GMV)
```

Показать вычисление численно.

Пример формата:

```text
11513.52 - 10838.37 = 675.15
```

Не использовать этот пример как expected actual value.

---

# 5. CLASSIFICATION

После exact reconciliation классифицировать defect ровно как один primary type:

```text
CALCULATION_DEFECT
```

если exact DB/API значения не выполняют canonical formula;

или:

```text
DISPLAY_ROUNDING_INCONSISTENCY
```

если exact formula корректна, но независимо округлённые cards визуально не сходятся;

или:

```text
DATA_INCONSISTENCY
```

если source fields сами противоречат canonical data model.

Если есть несколько проблем — перечислить secondary findings отдельно.

---

# 6. DB → API → UI TRACE

Вернуть:

| Metric | DB exact | API exact | UI raw input | UI displayed |
|---|---:|---:|---:|---:|
| GMV | | | | |
| Collected GMV | | | | |
| Outstanding | | | | |

Не использовать только screenshot как evidence.

---

# 7. ROUNDING AUDIT

Определить actual rounding implementation:

```text
Math.round?
Intl.NumberFormat?
maximumFractionDigits?
minimumFractionDigits?
Decimal conversion?
Number conversion?
backend rounding?
frontend rounding?
```

Указать exact file/function.

Проверить, где именно теряются decimals:

```text
DB
→ service
→ DTO/JSON
→ frontend parser
→ KpiCard
→ Intl/formatter
```

---

# 8. FINANCIAL PRECISION

Проверить типы actual fields:

```text
Order.amount
Order.paidAmount
aggregated GMV
aggregated Collected
Outstanding
```

Указать:

```text
DB decimal precision
Prisma representation
backend conversion
JSON representation
frontend JS representation
```

Не допускать premature integer rounding.

---

# 9. CORE PRODUCT REQUIREMENT

Связанные Executive cards не должны визуально противоречить собственной формуле.

Если UI показывает целые AZN и canonical relationship:

```text
Outstanding = GMV - Collected
```

то пользователь должен видеть арифметически согласованный набор.

Current unacceptable example:

```text
GMV             11 514
Collected       10 838
Outstanding        675

11 514 - 10 838 != 675
```

---

# 10. DO NOT FIX BY CHANGING BACKEND TRUTH

Если exact backend calculation корректен:

НЕ менять authoritative financial amount только ради display arithmetic.

Запрещено:

```text
persist rounded amounts
round DB aggregates before business calculations
change Outstanding business formula
alter paidAmount
```

Проблема должна решаться на presentation/reconciliation layer.

---

# 11. CHOOSE A CANONICAL DISPLAY POLICY

После audit выбрать один policy.

## OPTION A — DISPLAY DECIMALS

Показывать связанные monetary cards, например:

```text
11 513.52 ₼
10 838.37 ₼
675.15 ₼
```

Преимущество:

```text
exact visible arithmetic
```

Недостаток:

```text
Executive cards становятся визуально тяжелее
```

---

## OPTION B — RECONCILED INTEGER PRESENTATION

Если Executive design должен показывать целые AZN:

```text
Displayed GMV       = round(exact GMV)
Displayed Collected = round(exact Collected)
Displayed Outstanding
                      = Displayed GMV - Displayed Collected
```

При этом authoritative API amount остаётся exact.

Этот derived displayed Outstanding существует только как presentation value.

Не использовать его для:

```text
analytics
comparison
Stage E
exports
financial logic
```

---

## OPTION C — CONSISTENT ALLOCATION ROUNDING

Если в будущем появится больше взаимосвязанных components:

```text
GMV
= Collected
+ Outstanding
+ Released/Adjusted
```

может понадобиться deterministic allocation rounding, чтобы displayed components всегда
суммировались в displayed total.

Не реализовывать сложный allocation engine сейчас без необходимости.

---

# 12. RECOMMENDATION FOR CURRENT EXECUTIVE

Если exact calculation доказан корректным и UI intentionally показывает целые AZN,
предпочтительный minimal policy:

```text
OPTION B — RECONCILED INTEGER PRESENTATION
```

Но разработчик обязан сначала доказать root cause.

Не применять Option B автоматически, если проблема находится в backend formula.

---

# 13. COMPARISON DELTAS

Очень важно:

```text
↑ 13.9%
↑ 15.7%
↓ 9.1%
```

должны рассчитываться из authoritative exact current/previous values,
а НЕ из reconciled displayed integers.

То есть:

```text
business comparison
→ exact values

display reconciliation
→ presentation only
```

Не изменять comparison semantics ради integer cards.

---

# 14. TOOLTIP / EXACT VALUE

Если Executive показывает integer reconciliation, рассмотреть tooltip:

```text
Точное значение: 11 513.52 ₼
```

только если current UX pattern это поддерживает и не перегружает интерфейс.

Это optional, не blocker.

---

# 15. FINANCIAL SECTION

Проверить, показывает ли Financial section те же metrics.

Если Financial предназначен для более точного анализа, допустимо:

```text
Executive → integer AZN
Financial → 2 decimal places
```

Но это должно быть единым documented formatting policy.

Не создавать случайные различия по компонентам.

---

# 16. REFUNDS

Не менять refund semantics.

Этот remediation касается visual reconciliation:

```text
GMV
Collected
Outstanding
```

Если audit выявит, что refund приводит к actual semantic inconsistency Outstanding —
это НЕ rounding fix.

В таком случае вернуть `VERDICT B` и описать financial defect отдельно.

---

# 17. ZERO / SMALL VALUES

Проверить:

```text
GMV = 0
Collected = 0
Outstanding = 0
```

и small decimals:

```text
0.40
0.49
0.50
0.51
```

Не допустить:

```text
Displayed GMV = 0
Displayed Collected = 1
Displayed Outstanding = negative
```

Если presentation subtraction может дать negative:

```text
Displayed Outstanding = MAX(0, displayed GMV - displayed Collected)
```

только на presentation layer.

---

# 18. BOUNDARY ROUNDING TESTS

Добавить deterministic cases минимум:

```text
100.49 - 40.49 = 60.00
100.50 - 40.49 = 60.01
100.49 - 40.50 = 59.99
11513.xx - 10838.xx = actual current category
```

Expected displayed behavior должен соответствовать выбранному policy.

---

# 19. NO FLOATING-POINT DRIFT

Проверить, не возникает ли:

```text
675.149999999
```

из-за JS Number conversion.

Если authoritative backend использует Decimal, не ухудшать precision преждевременным float conversion.

Для display использовать deterministic formatter.

---

# 20. REUSABLE FORMATTER

Если rounding logic используется несколькими Command Center cards,
не размножать ad-hoc `Math.round()`.

Предпочтительно использовать existing shared monetary formatter либо минимально расширить его.

Но не проводить большой frontend refactor.

---

# 21. NO FINANCIAL FORMULA IN KpiCard

`KpiCard` не должен становиться business-calculation engine.

Если reconciled presentation требует связи между cards, вычислить display model на подходящем
Command Center/section mapping layer, а `KpiCard` оставить presentation component.

---

# 22. BACKEND NON-REGRESSION

Если backend formula уже корректна, backend менять не требуется.

Если backend изменён:

обязательны relevant unit tests + TSC/build.

---

# 23. FRONTEND REGRESSION TEST

Добавить test, который воспроизводит current problem.

Например с exact values, которые независимо округляются в несогласованный набор.

Тест должен доказать после fix:

```text
Displayed GMV - Displayed Collected = Displayed Outstanding
```

для выбранного integer presentation policy.

---

# 24. EXACT VALUES REMAIN AVAILABLE

Убедиться, что frontend/API не заменяют exact raw amount reconciled integer value.

Нужно сохранить separation:

```text
authoritativeValue
displayValue
```

conceptually или технически.

Stage E в будущем должен использовать authoritative values.

---

# 25. STAGE E SAFETY

Stage E запрещено использовать:

```text
rounded displayed values
reconciled integer presentation values
formatted strings
```

для IMPACT.

Stage E должен получать exact authoritative numeric values.

Зафиксировать это в report/architecture note при необходимости.

---

# 26. RUNTIME VALIDATION

В реальном browser проверить тот же Command Center.

Зафиксировать после fix:

```text
Displayed GMV:
Displayed Collected:
Displayed Outstanding:

Displayed GMV - Displayed Collected:
```

Последнее должно равняться displayed Outstanding при integer presentation.

---

# 27. PERIOD VALIDATION

Проверить минимум:

```text
current/default period
one additional period
2026 YEAR if supported
```

Чтобы fix не был hardcoded под конкретные:

```text
11 514 / 10 838 / 675
```

---

# 28. LANGUAGE NON-REGRESSION

После предыдущего i18n remediation проверить:

```text
Оплачено по GMV
Остаток к оплате
Исполненный GMV
```

Raw:

```text
cc.kpi.*
```

должен оставаться 0.

---

# 29. AZN NON-REGRESSION

Проверить:

```text
₼
```

и отсутствие unexpected:

```text
$
USD
```

---

# 30. REQUIRED DELIVERABLE A — EXACT RECONCILIATION

Вернуть:

```text
Exact GMV:
Exact Collected GMV:
Exact calculated difference:
Exact API Outstanding:

Formula PASS/FAIL:
```

---

# 31. REQUIRED DELIVERABLE B — ROOT CAUSE

Вернуть:

```text
Classification:
Root cause:
File/function:
Rounding method:
Why UI showed 675 while visible subtraction showed 676:
```

Без этой секции VERDICT A запрещён.

---

# 32. REQUIRED DELIVERABLE C — SELECTED POLICY

Вернуть:

```text
Selected display policy:
Why:
Authoritative values affected: YES/NO
Comparison affected: YES/NO
Stage E inputs affected: YES/NO
```

Ожидается, что authoritative values:

```text
NO
```

---

# 33. REQUIRED DELIVERABLE D — BEFORE / AFTER

| Metric | Exact | Before UI | After UI |
|---|---:|---:|---:|
| GMV | | 11 514 | |
| Collected | | 10 838 | |
| Outstanding | | 675 | |

И:

```text
BEFORE visible equation:
11 514 - 10 838 = 676 != 675

AFTER visible equation:
Displayed GMV - Displayed Collected = Displayed Outstanding
```

---

# 34. REQUIRED DELIVERABLE E — COMPARISON NON-REGRESSION

Для всех трёх cards показать:

| Metric | Exact delta before | Exact delta after | Match |
|---|---:|---:|---|
| GMV | | | |
| Collected | | | |
| Outstanding | | | |

Не пересчитывать deltas из displayed integer values.

---

# 35. REQUIRED DELIVERABLE F — TESTS

Вернуть exact:

```text
New regression tests:
Command Center tests:
Frontend Vitest:
Frontend TSC:
Frontend build:
Backend tests if changed:
Browser/runtime:
```

---

# 36. REQUIRED DELIVERABLE G — FILES / GIT

```text
Starting HEAD:
Final HEAD:
Files changed:
Migrations:
Commit:
Pushed to origin: YES/NO
Working tree clean: YES/NO
```

Ожидается:

```text
Migrations: 0
```

---

# 37. REPORT

Создать:

```text
docs/prompts/PHASE_3_GMV_DISPLAY_ROUNDING_RECONCILIATION_REMEDIATION_REPORT.md
```

Полностью на русском языке.

---

# 38. ROADMAP STATUS

Не создавать новый product stage.

После PASS:

```text
GMV semantics                       → CLOSED
GMV i18n runtime                    → VERIFIED
GMV display numeric reconciliation → VERIFIED
Command Center financial trust     → VERIFIED
Stage E                             → READY
```

Stage E автоматически НЕ запускать.

---

# 39. ACCEPTANCE CRITERIA

VERDICT A только если:

1. Exact DB/API values получены.
2. Canonical Outstanding formula проверена на exact precision.
3. Root cause классифицирован.
4. Если backend defect — исправлен именно backend defect.
5. Если display rounding defect — authoritative values не изменены.
6. Visible related cards арифметически согласованы.
7. Comparison deltas продолжают использовать exact values.
8. Stage E inputs остаются exact, не display-rounded.
9. No premature financial rounding.
10. Regression test воспроизводит и закрывает текущий case.
11. Дополнительный period проверен.
12. i18n regression отсутствует.
13. AZN authority сохранена.
14. Tests/TSC/build green.
15. Browser/runtime evidence предоставлен.
16. Report на русском.
17. Stage E не запущен автоматически.

---

# 40. VERDICT

Вернуть ровно один.

## VERDICT A — GMV DISPLAY ROUNDING RECONCILED / STAGE E READY

Только если exact financial truth сохранена и displayed cards больше не противоречат друг другу.

## VERDICT B — GMV CALCULATION / DISPLAY REMEDIATION REQUIRED

Если exact formula или presentation reconciliation всё ещё неверны.

## VERDICT C — BLOCKED

Если проблема требует изменения canonical financial semantics или отсутствующей domain capability.

---

# 41. STOP

После remediation:

**STOP.**

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

Вернуть отчёт на русском языке и ждать review.
