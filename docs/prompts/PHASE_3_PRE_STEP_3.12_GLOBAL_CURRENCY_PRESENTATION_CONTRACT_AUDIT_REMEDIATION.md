# PHASE 3 — PRE-STEP 3.12 — GLOBAL CURRENCY PRESENTATION CONTRACT — AUDIT & REMEDIATION

## STATUS

**Task type:** Project-wide UI presentation audit + remediation  
**Scope:** Platform + Partner/Storefront user-facing UI  
**Implementation status:** TO IMPLEMENT  
**Architecture:** Shared presentation-layer contract  
**Do not start unrelated stages automatically.**

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и текстовая документация по этой задаче должны быть преимущественно **на русском языке**.

Это относится к:

- Implementation Report;
- Remediation Report;
- Strict Review Report;
- Evidence / Runtime Report;
- Gap Audit;
- findings explanations;
- root cause analysis;
- architecture decisions;
- runtime evidence;
- conclusions/recommendations;
- verdict explanations.

English допускается только для технических идентификаторов: paths, class/method/DTO/model/table names, API endpoints, HTTP methods/status codes, CLI/Git commands, commit messages, enums, code snippets и стандартизированных `VERDICT`.

**Hard acceptance criterion:** преимущественно англоязычный отчёт считается незавершённым.

---

# 1. PURPOSE

В TravelHub сейчас используются разные способы отображения одной и той же валюты.

Примеры проблемы:

```text
11 250 USD
$11 250

14 438 AZN
14 438 ₼

1 250 EUR
1 250 €
```

Это создаёт визуальную и продуктовую несогласованность между:

- Command Center;
- Analytics;
- Orders;
- Bookings;
- Payments;
- CRM;
- Platform Workspace;
- Partner Workspace;
- Storefront Workspace;
- KPI cards;
- tables;
- detail pages;
- charts/tooltips.

Нужно ввести единый проектный **Global Currency Presentation Contract**.

---

# 2. CORE ARCHITECTURE RULE

Канонические машинные значения валют НЕ меняются.

```text
DB / API / domain:
AZN
USD
EUR
```

Пользовательский presentation layer использует символы:

```text
AZN → ₼
USD → $
EUR → €
```

Hard invariant:

```text
Currency ISO Code
≠
Currency Presentation Symbol
```

Нельзя мигрировать DB/API значения `USD` в `$`, `AZN` в `₼` и т.д.

Это задача presentation layer.

---

# 3. CANONICAL DISPLAY CONTRACT

Для обычного product UI:

| ISO currency | UI symbol |
|---|---|
| `AZN` | `₼` |
| `USD` | `$` |
| `EUR` | `€` |

Одинаковая валюта должна выглядеть одинаково независимо от страницы.

Не допускается:

```text
Command Center → $
Analytics      → USD
Payments       → USD
Booking Detail → $
```

при одинаковом пользовательском контексте.

---

# 4. AUDIT FIRST — MANDATORY

До изменения кода провести repository-wide audit всех способов форматирования денег и валют.

Найти:

- hardcoded `AZN`;
- hardcoded `USD`;
- hardcoded `EUR`;
- hardcoded `₼`;
- hardcoded `$`;
- hardcoded `€`;
- `Intl.NumberFormat`;
- `toLocaleString`;
- currency helper functions;
- shared formatters;
- local component-specific formatters;
- backend-preformatted monetary strings;
- chart formatters;
- tooltip formatters;
- table-cell formatters;
- KPI formatters;
- export formatters;
- financial document formatters.

Составить матрицу:

| Surface | Current formatter | Current output | Target | Action |
|---|---|---|---|---|
| Command Center | ... | ... | shared | ... |
| Analytics | ... | ... | shared | ... |
| Orders | ... | ... | shared | ... |
| Bookings | ... | ... | shared | ... |
| Payments | ... | ... | shared | ... |
| CRM | ... | ... | shared | ... |
| Partner | ... | ... | shared | ... |

Не ограничиваться только страницами, где дефект уже визуально замечен.

---

# 5. ONE SHARED FORMATTER

Должен существовать один канонический shared currency/money presentation mechanism.

Не создавать отдельные независимые реализации:

```text
formatCommandCenterCurrency()
formatAnalyticsCurrency()
formatPaymentsCurrency()
```

если они решают одну и ту же задачу.

Предпочтительная архитектура:

```text
Money value + ISO currency
          ↓
Shared Money/Currency Formatter
          ↓
locale-aware numeric formatting
          +
canonical UI currency symbol
          ↓
User-facing UI
```

Фактическое имя helper/module определить по существующей архитектуре проекта.

Если подходящий shared formatter уже существует — расширить/исправить его вместо создания дубликата.

---

# 6. NUMBER FORMATTING

Не ломать locale-aware форматирование чисел.

Нужно сохранить корректные:

- thousands separators;
- decimal separators;
- decimal precision;
- negative values;
- zero;
- large values.

Пример концептуально:

```text
RU:
1 250,50 ₼

EN:
1,250.50 ₼
```

Не хардкодить строковые разделители вручную, если проект уже имеет locale-aware infrastructure.

Проверить RU / AZ / EN локализации проекта.

---

# 7. SYMBOL POSITION

Провести аудит текущего UX и locale formatting.

Не внедрять хаотично:

```text
$1,250
1,250 $
```

на разных поверхностях.

Shared formatter должен определять каноническое представление с учётом принятой UI/localization модели.

Ключевой hard gate — единообразие.

Если существующая дизайн-система использует сумму перед символом для всех валют:

```text
1 250 ₼
1 250 $
1 250 €
```

сохранить этот продуктовый паттерн последовательно.

Если используется locale-native placement через formatter — задокументировать и применять одинаковый formatter на всех поверхностях.

---

# 8. USER-FACING SURFACES — REQUIRED SCOPE

Проверить минимум:

## Platform

- Workspace Home;
- Command Center;
- Analytics;
- Sales;
- Orders;
- Bookings;
- CRM;
- Partners;
- Payments / существующие financial views;
- KPI cards;
- aggregate summaries;
- detail pages.

## Partner / Storefront

Все уже реализованные поверхности, где отображаются денежные значения:

- dashboard/home;
- analytics;
- orders;
- bookings;
- payments;
- CRM/customer monetary values;
- storefront commerce views;
- subscription/SaaS UI только если он реально существует.

Не создавать отсутствующие Partner/Storefront modules ради этой задачи.

---

# 9. COMMAND CENTER + ANALYTICS — HARD RUNTIME CHECK

Особое внимание:

```text
/app/command-center
/app/analytics
```

Именно эти поверхности ранее демонстрировали разные представления валют.

Проверить:

- Executive KPI;
- Operational KPI, если monetary;
- Financial KPI;
- Marketplace KPI;
- Storefront SaaS KPI, если monetary;
- charts;
- chart axes;
- chart tooltips;
- tables;
- comparison values;
- drill-down labels.

Одинаковая валюта должна использовать одинаковый presentation contract.

---

# 10. TABLES / DETAILS / AGGREGATES

Проверить currency presentation в:

```text
Aggregate Summary
Table rows
Table totals
Detail sidebar/page
Related monetary fields
Pagination-independent totals
```

Нельзя исправить только KPI cards и оставить таблицы с ISO-кодами без архитектурной причины.

---

# 11. MULTI-CURRENCY RULE

Не суммировать разные native currencies ради красивого общего числа.

Например:

```text
AZN 10 000
USD 2 000
EUR 500
```

не превращать в:

```text
Total = 12 500
```

без authoritative FX conversion contract.

Presentation remediation не должна менять финансовую семантику.

Для multi-currency population отображать отдельные currency totals, пока FX/reporting layer не определяет иное.

---

# 12. EXPLICIT EXCEPTIONS — ISO CODE MAY REMAIN

ISO-коды допустимы там, где они имеют функциональный смысл.

Примеры:

- API;
- DB;
- debug/admin technical payload;
- audit logs;
- CSV/XLSX exports;
- accounting/reconciliation;
- payment-provider diagnostics;
- financial documents where explicit ISO identification is required;
- contexts where `$` alone may be ambiguous;
- currency selectors/dropdowns where code is useful.

В таких местах допустимо:

```text
USD
AZN
EUR
```

или:

```text
$ (USD)
₼ (AZN)
€ (EUR)
```

если это оправдано UX.

Каждое заметное исключение в product UI должно быть объяснено в отчёте.

---

# 13. DO NOT CHANGE FINANCIAL SEMANTICS

Эта задача НЕ должна менять:

- GMV formula;
- Revenue formula;
- Net Revenue formula;
- Commission formula;
- Payment status semantics;
- Refund semantics;
- FX conversion logic;
- reporting currency;
- settlement currency;
- partner payout logic.

Меняется только представление валюты, если для конкретной поверхности не обнаружен отдельный реальный дефект, блокирующий корректное отображение. Такой дефект документировать отдельно, а не маскировать.

---

# 14. DO NOT MIX GMV DRILL-DOWN REMEDIATION

Отдельно уже выявлена архитектурная задача:

```text
Command Center GMV
Analytics GMV
→ canonical financial drill-down
```

а не универсальный переход в Orders.

НЕ реализовывать её в этом Currency Presentation Contract.

Здесь можно только убедиться, что существующие monetary labels используют единый formatter.

---

# 15. DO NOT MIX CART / CHECKOUT

Cart / Checkout имеет статус:

```text
Implementation Status: NOT IMPLEMENTED
Roadmap Status: PLANNED
```

Не создавать Cart, Checkout, Consolidated Invoice или новую payment architecture в рамках currency remediation.

Current V1 остаётся:

```text
1 Order = 1 Booking
1 Order = 1..N Payments
```

---

# 16. BACKEND CONTRACT

Проверить, что backend продолжает возвращать канонический ISO currency code, например:

```json
{
  "amount": 1250.50,
  "currency": "USD"
}
```

Frontend presentation:

```text
1 250,50 $
```

или другой единый locale-aware вариант согласно принятому shared formatter.

Backend не должен возвращать `$` вместо `USD` как domain currency.

---

# 17. TESTS — REQUIRED

Добавить/обновить unit tests shared formatter.

Минимум:

```text
AZN → ₼
USD → $
EUR → €
```

Проверить:

- integer;
- decimals;
- zero;
- negative value;
- RU;
- AZ;
- EN;
- unsupported/unknown currency behavior.

Не придумывать молча символ для неизвестной валюты.

Safe fallback должен быть явно определён, например ISO code, если это соответствует архитектуре.

Добавить component/integration tests для ключевых поверхностей, минимум:

- Command Center;
- Analytics;
- одна operational table/detail surface;
- Payments/financial surface, если реализована.

---

# 18. RUNTIME / BROWSER EVIDENCE — MANDATORY

Source/tests недостаточно.

Нужна runtime/browser проверка реального UI.

Минимум:

```text
Command Center
Analytics
Orders or Bookings
Payments/financial view
Partner/Storefront monetary view (если реализована)
```

Для каждой поверхности предоставить:

- route;
- locale;
- currency;
- before;
- after;
- screenshot или иное воспроизводимое browser evidence.

Обязательно проверить минимум:

```text
AZN
USD
EUR
```

если representative dataset содержит их.

Runtime observation имеет приоритет над утверждением, что formatter «подключён в коде».

---

# 19. SEARCH FOR REMAINING INCONSISTENCIES

После implementation повторить repository-wide search.

Отдельно перечислить оставшиеся пользовательские occurrences:

```text
" USD"
" AZN"
" EUR"
```

и классифицировать:

```text
VALID EXCEPTION
or
DEFECT
```

Hardcoded ISO code в обычной monetary KPI/card/table cell без оправданной причины = FAIL.

---

# 20. ROADMAP / DOCUMENTATION

Обновить canonical roadmap additively:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Зафиксировать:

```text
Global Currency Presentation Contract
AZN → ₼
USD → $
EUR → €
DB/API remain ISO
```

Сохранить историю и реальные SHA.

Не менять numbering/history молча.

---

# 21. GIT EVIDENCE

Final report должен содержать:

```text
Starting SHA:
Implementation SHA:
Final HEAD:
origin/master:
HEAD == origin:
Working tree clean:
```

Все SHA реальные.

Не выдавать in-place uncommitted state за завершённую implementation.

---

# 22. REQUIRED ACCEPTANCE MATRIX

| Gate | Result |
|---|---|
| DB/API remain ISO | PASS/FAIL |
| Shared formatter exists/reused | PASS/FAIL |
| AZN → ₼ | PASS/FAIL |
| USD → $ | PASS/FAIL |
| EUR → € | PASS/FAIL |
| RU locale | PASS/FAIL |
| AZ locale | PASS/FAIL |
| EN locale | PASS/FAIL |
| Command Center runtime | PASS/FAIL |
| Analytics runtime | PASS/FAIL |
| Operational tables/details | PASS/FAIL |
| Payments/financial views | PASS/FAIL |
| Partner/Storefront applicable views | PASS/FAIL |
| Charts/tooltips | PASS/FAIL |
| Multi-currency semantics preserved | PASS/FAIL |
| Valid ISO exceptions documented | PASS/FAIL |
| Unit tests | PASS/FAIL |
| Component/integration tests | PASS/FAIL |
| Browser/runtime evidence | PASS/FAIL |
| Remaining inconsistent occurrences audited | PASS/FAIL |
| Canonical roadmap updated | PASS/FAIL |
| Git synchronized | PASS/FAIL |

---

# 23. REQUIRED FINAL REPORT STRUCTURE

```text
1. Executive Summary
2. Starting SHA / Repository State
3. Currency Presentation Audit
4. Root Cause
5. Canonical Currency Presentation Contract
6. Shared Formatter Architecture
7. Platform Surfaces Remediated
8. Partner / Storefront Surfaces Remediated
9. Command Center Runtime Evidence
10. Analytics Runtime Evidence
11. Tables / Detail Runtime Evidence
12. Charts / Tooltip Evidence
13. Multi-Currency Verification
14. ISO-Code Exceptions
15. Backend/API Verification
16. Tests
17. Remaining Occurrence Audit
18. Canonical Roadmap Update
19. Git / SHA Evidence
20. Residual Gaps
21. Acceptance Matrix
22. Final Verdict
```

---

# 24. VERDICT RULE

`VERDICT A` разрешён только если:

- обычный product UI больше не использует случайную смесь `USD`/`$`, `AZN`/`₼`, `EUR`/`€`;
- все ключевые поверхности используют общий presentation contract;
- DB/API продолжают использовать ISO;
- runtime/browser подтверждает результат;
- оставшиеся ISO occurrences классифицированы и оправданы;
- tests проходят;
- roadmap обновлён;
- Git state зафиксирован и синхронизирован.

Если хотя бы одна ключевая поверхность остаётся несогласованной:

```text
VERDICT B — REMEDIATION REQUIRED
```

Не использовать `VERDICT A — с оговорками` для фактически незакрытого hard gate.

---

# 25. STOP

После завершения:

**STOP.**

Не начинать автоматически:

- GMV drill-down remediation;
- Cross-Entity Traceability;
- Cart / Checkout;
- Booking KPI Semantics;
- Finance Center;
- Final Re-Qualification;
- Step 3.12.
