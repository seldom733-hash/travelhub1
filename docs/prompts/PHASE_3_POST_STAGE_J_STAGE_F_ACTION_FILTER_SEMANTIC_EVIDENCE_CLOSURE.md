# PHASE 3 — POST-STAGE-J
# STAGE F ACTION FILTER SEMANTIC EVIDENCE CLOSURE
## ROUTE EXISTS ≠ ACTION WORKS
## QUERY PARAM CONSUMPTION / ACTIVE FILTER STATE / DATASET SEMANTICS
## FINAL MINIMAL GATE BEFORE CRM STEP 3.5

---

## 1. ЯЗЫК

Все ответы разработчика, browser evidence, findings, таблицы, тесты, отчёт и финальный VERDICT — **НА РУССКОМ ЯЗЫКЕ**.

Technical identifiers, routes, query params, code, commands, SHA и commit messages можно сохранять в оригинале.

---

## 2. КОНТЕКСТ

Предыдущий remediation сообщил:

```text
Action targets fixed            7/7
404 actions                     0
Wrong-domain actions            0
Signal lifecycle                acknowledge/resolve/dismiss verified
Tests                           70/70 PASS
TSC                             clean
Commit                          4467e34
HEAD == origin/master           YES
```

Исправлены top-level routes:

```text
/products  → /app/catalog
/payments  → /app/orders
/bookings  → /app/bookings
/orders    → /app/orders
```

Это закрывает route existence / 404, но **не доказывает semantic correctness action**.

---

## 3. ГЛАВНЫЙ ПРИНЦИП

```text
HTTP 200 ≠ working Stage F action
Existing page ≠ correct destination state
Query parameter in URL ≠ applied filter
```

Stage F action считается рабочим только если пользователь попадает в **семантически правильный контекст**, соответствующий сигналу.

---

## 4. ПОДТВЕРЖДЁННОЕ НАБЛЮДЕНИЕ

Для `SERVICES_WITHOUT_SALES` используются две ссылки:

```text
Открыть услуги
→ /app/catalog?status=ACTIVE&unsold=true

Проверить доступность
→ /app/catalog?status=ACTIVE&availability=none
```

При визуальной проверке обе страницы выглядят как обычный список:

```text
Опубликованные
```

и на первый взгляд показывают один и тот же список.

Это требует отдельного semantic evidence.

---

## 5. ВАЖНО: ОДИНАКОВЫЙ DATASET НЕ ВСЕГДА DEFECT

Текущий dataset ранее показывал:

```text
31 услуг без продаж
31 без настроенной доступности
0 с доступностью
```

Поэтому два фильтра **могут легитимно вернуть одинаковые 31 записи**.

Следовательно нельзя определять PASS/FAIL только сравнением строк списка.

Нужно доказать независимое применение filter semantics.

---

## 6. HARD GATE — `unsold=true`

Для:

```text
/app/catalog?status=ACTIVE&unsold=true
```

доказать:

1. `unsold` query param читается frontend/page layer;
2. значение `true` валидируется/нормализуется;
3. оно влияет на filter state или API/database query;
4. результат ограничен услугами без продаж;
5. plain `/app/catalog?status=ACTIVE` не является фактически тем же query contract;
6. UI показывает active filter/context либо иным способом доказывает применённый фильтр.

Если параметр просто остаётся в URL, но нигде не используется:

```text
FAIL
```

---

## 7. HARD GATE — `availability=none`

Для:

```text
/app/catalog?status=ACTIVE&availability=none
```

доказать:

1. `availability` query param читается;
2. `none` является поддерживаемым значением;
3. filter state/API query реально изменяется;
4. выбираются услуги без настроенной доступности;
5. это не сводится только к `status=ACTIVE`;
6. UI отражает active availability context/filter.

Если параметр игнорируется:

```text
FAIL
```

---

## 8. FILTER STATE MUST BE DISTINGUISHABLE

Даже если оба фильтра возвращают одинаковые записи из-за текущих данных:

```text
unsold=true
availability=none
```

должны оставаться **двумя различными filter states**.

Browser evidence должен позволять понять:

```text
какой именно action был выполнен
какой фильтр активен
```

---

## 9. PLAIN ACTIVE BASELINE

Обязательно сравнить три состояния:

```text
A. /app/catalog?status=ACTIVE
B. /app/catalog?status=ACTIVE&unsold=true
C. /app/catalog?status=ACTIVE&availability=none
```

Для каждого вернуть:

```text
active UI filter(s)
frontend filter state
API request/query
result count
semantic meaning
```

---

## 10. НЕ ТРЕБОВАТЬ ИСКУССТВЕННО РАЗНЫХ COUNTS

Не изменять seed/data только ради того, чтобы B и C имели разные counts.

Если оба корректно дают 31 — это допустимо.

Но implementation path/filter predicate должен быть различим и доказан.

---

## 11. ALL 7 STAGE F ACTIONS — SEMANTIC AUDIT

Проверить не только Catalog.

Ожидаемый action set:

| Signal | Action |
|---|---|
| BOOKING_CONFIRMATION_DELAY | Открыть бронирования |
| FAILED_PAYMENTS | Открыть платежи |
| RECENT_CANCELLATIONS | Открыть заказы |
| PENDING_REFUNDS | Открыть возвраты |
| UPCOMING_BOOKINGS | Открыть предстоящие |
| SERVICES_WITHOUT_SALES | Открыть услуги |
| SERVICES_WITHOUT_SALES | Проверить доступность |

---

## 12. BOOKING CONFIRMATION DELAY

Проверить final target.

Action должен приводить пользователя к бронированиям, где можно найти/обработать ожидающие подтверждения.

Вернуть:

```text
URL:
Active filter/context:
Query consumed:
Result count:
Semantic PASS/FAIL:
```

Если action только открывает общий Booking Center, определить, достаточно ли это по canonical Stage F contract.

Если label обещает только `Открыть бронирования`, общий Booking Center может быть допустим.

Не требовать фильтр, которого label не обещает.

---

## 13. FAILED PAYMENTS

Сейчас route переведён на:

```text
/app/orders
```

Проверить, почему Payments action семантически ведёт в Orders Center.

Особенно:

```text
Action label:
Открыть платежи
```

Если пользователь получает обычный список заказов без payment-failure context:

```text
FAIL
```

Варианты PASS:

```text
Orders Center имеет реальный payment status/failure filter
или
существует другой canonical payment workflow
```

Не менять label на `Открыть заказы` только для маскировки неверного destination без architectural reason.

---

## 14. PENDING REFUNDS

Сейчас также используется `/app/orders`.

Проверить:

```text
refundStatus=PENDING
```

или фактический canonical equivalent.

Action `Открыть возвраты` должен приводить в context, где пользователь реально видит ожидающие возвраты.

Если открывается общий Orders list:

```text
FAIL
```

---

## 15. UPCOMING BOOKINGS

Проверить:

```text
/app/bookings?...upcoming...
```

Action `Открыть предстоящие` должен применять реальный upcoming context/filter.

Если `upcoming=true` остаётся только в URL:

```text
FAIL
```

---

## 16. RECENT CANCELLATIONS

Action:

```text
Открыть заказы
```

Если label не обещает filtered cancellations, общий Orders Center может быть допустим.

Но проверить:

```text
route correct
page relevant
no ignored misleading query
```

Если action contract содержит cancellation filter — он обязан работать.

---

## 17. LABEL PROMISE RULE

Semantic strictness определяется action label + contract.

Примеры:

```text
"Открыть заказы"
→ generic Orders Center допустим

"Открыть предстоящие"
→ generic Booking Center без upcoming state НЕ допустим

"Открыть возвраты"
→ generic Orders Center без refund context НЕ допустим

"Проверить доступность"
→ generic Catalog без availability context НЕ допустим
```

---

## 18. QUERY CONSUMPTION TRACE

Для каждого query-based action показать цепочку:

```text
Stage F executionTarget
→ router/navigation
→ page searchParams
→ filter state
→ API request / selector
→ backend query (если применимо)
→ rendered dataset
```

---

## 19. NO URL-ONLY TEST

Тест вида:

```ts
expect(target).toBe('/app/catalog?status=ACTIVE&unsold=true')
```

недостаточен.

Нужен consumer-side regression test.

---

## 20. FRONTEND CONSUMER TESTS

Для поддерживаемых query params добавить/подтвердить tests:

```text
unsold=true
availability=none
upcoming=true
pending refund filter
failed payment filter/context
```

Проверить, что соответствующая page реально читает параметр.

---

## 21. BACKEND FILTER TESTS

Если фильтрация выполняется backend API:

проверить predicates.

Например conceptually:

```text
unsold=true
→ no qualifying orders/sales

availability=none
→ no configured availability
```

Использовать фактическую domain model проекта.

Не придумывать новую семантику.

---

## 22. CATALOG `unsold` AUTHORITY

Сверить `unsold=true` с той же business semantics, которая используется Decision Signal:

```text
SERVICES_WITHOUT_SALES
```

Не должно быть двух разных определений `без продаж`.

---

## 23. CATALOG `availability=none` AUTHORITY

Сверить с evidence semantics:

```text
without configured availability
```

Не использовать случайный proxy вроде:

```text
stock = 0
```

если domain availability означает другое.

---

## 24. SIGNAL → DESTINATION RECONCILIATION

Для query-based actions сравнить:

```text
Decision Signal affected object set
vs
Destination filtered object set
```

Они не обязаны быть идентичны на 100%, если destination имеет более широкий operational scope.

Но destination должен быть достаточно точным, чтобы action был полезен и не вводил пользователя в заблуждение.

---

## 25. CATALOG EVIDENCE — REQUIRED

Для текущего dataset вернуть:

| State | Active filter | Result count |
|---|---|---:|
| Published only | `status=ACTIVE` | |
| Without sales | `status=ACTIVE + unsold=true` | |
| Without availability | `status=ACTIVE + availability=none` | |

Если последние два counts совпадают — явно объяснить почему.

---

## 26. VISUAL FILTER INDICATION

Если Catalog уже имеет filter chips/dropdowns:

они должны отражать query state.

Если UI architecture не показывает filter chips, допустимо доказать filter state другим существующим способом.

Не строить большой новый filter UX только ради evidence.

Но пользователь не должен получать misleading impression, что action проигнорирован.

---

## 27. FAILED PAYMENTS EVIDENCE

Вернуть:

```text
Decision Signal count:
Destination count/context:
Active filter:
Payment status/failure predicate:
```

---

## 28. PENDING REFUNDS EVIDENCE

Вернуть:

```text
Decision Signal count:
Destination count/context:
Active filter:
Refund predicate:
```

---

## 29. UPCOMING BOOKINGS EVIDENCE

Вернуть:

```text
Decision Signal count:
Destination count/context:
Active filter:
Date predicate:
```

---

## 30. DO NOT REOPEN LIFECYCLE WITHOUT DEFECT

Предыдущий closure сообщил:

```text
acknowledge/resolve/dismiss verified
```

В этом prompt lifecycle повторно не реализовывать.

Только убедиться, что новые filter fixes не сломали Decision Queue.

---

## 31. ROUTE / ORIGIN

Сохранить уже закрытый invariant:

```text
404 = 0
wrong origin = 0
environment hardcoding = 0
```

---

## 32. RBAC

Query params не должны обходить permissions.

Пример:

```text
/app/orders?refundStatus=PENDING
```

не должен давать данные пользователю без соответствующего доступа.

---

## 33. TENANT / WORKSPACE

Filtered destinations должны сохранять текущий tenant/workspace scope.

---

## 34. UNKNOWN QUERY VALUES

Проверить безопасное поведение:

```text
availability=garbage
unsold=garbage
upcoming=garbage
```

Не требуется сложная error page.

Но значение не должно приводить к 500 или bypass filter/security.

---

## 35. LOCALIZATION

Если active filters отображаются пользователю:

проверить RU/AZ/EN.

Acceptance:

```text
raw keys = 0
CJK = 0
mixed system labels = 0
```

---

## 36. BROWSER EVIDENCE REQUIRED

Для всех 7 actions реально выполнить click из Decision Queue.

Не открывать URL вручную как единственное evidence.

Вернуть:

| Signal | Action | Click URL | Page | Active context/filter | Result | PASS |
|---|---|---|---|---|---:|---:|

---

## 37. NETWORK EVIDENCE

Для query-based actions показать, какой API request был вызван после navigation.

Если page фильтрует client-side — показать соответствующий source/filter path.

---

## 38. CONSOLE

После всех 7 action clicks:

```text
unexpected console errors = 0
```

---

## 39. NO NEW FEATURES

Не добавлять:

```text
new business center
new Decision Signal
new Stage F action
CRM
AI recommendation
```

Только semantic closure существующих actions.

---

## 40. MINIMAL FIX POLICY

Если filter param не consumed:

```text
implement minimal consumer support
```

Если правильный existing filter имеет другое canonical param:

```text
change Stage F target to canonical param
```

Не создавать duplicate filtering architecture.

---

## 41. REPORT

Обновить существующий Decision Queue remediation report либо создать dedicated closure section/file:

```text
docs/prompts/PHASE_3_POST_STAGE_J_STAGE_F_ACTION_FILTER_SEMANTIC_EVIDENCE_CLOSURE_REPORT.md
```

Не переписывать историю предыдущего closure.

---

## 42. REQUIRED DELIVERABLE A — CATALOG

```text
status=ACTIVE baseline:
unsold=true:
availability=none:
consumer code:
API/query:
counts:
UI filter state:
```

---

## 43. REQUIRED DELIVERABLE B — ALL ACTIONS

Полная 7-action browser matrix.

---

## 44. REQUIRED DELIVERABLE C — QUERY CONTRACTS

| Query param | Consumer | Predicate | UI state | Test | Result |
|---|---|---|---|---|---|

---

## 45. REQUIRED DELIVERABLE D — SEMANTIC EXCEPTIONS

Если generic destination допустим, объяснить через label promise rule.

---

## 46. REQUIRED DELIVERABLE E — TESTS

```text
Frontend consumer tests:
Backend filter tests:
Stage F regression:
Decision Queue regression:
TSC:
Build:
Browser:
Network:
Console:
```

---

## 47. REQUIRED DELIVERABLE F — GIT

Если code changes потребовались:

```text
Starting HEAD:
Final HEAD:
Commit:
Pushed:
HEAD == origin/master:
Working tree clean:
```

Если code changes не потребовались:

```text
Production code changed: NO
Evidence-only closure
```

---

## 48. ACCEPTANCE CRITERIA

VERDICT A разрешён только если:

1. Все 7 Stage F actions clicked in browser.
2. 404 = 0.
3. Wrong-domain = 0.
4. `unsold=true` реально consumed.
5. `availability=none` реально consumed.
6. `unsold` и `availability` являются distinct filter states.
7. Одинаковый dataset, если есть, объяснён данными, а не ignored filters.
8. Catalog plain ACTIVE baseline сравнен с обоими filters.
9. `unsold` semantics согласована с SERVICES_WITHOUT_SALES.
10. `availability=none` semantics согласована с signal evidence.
11. Failed Payments destination соответствует label promise.
12. Pending Refunds destination соответствует label promise.
13. Upcoming Bookings destination соответствует label promise.
14. Booking Delay destination соответствует label promise.
15. Recent Cancellations destination соответствует label promise.
16. Query params имеют real consumer path.
17. Query-based actions имеют consumer regression tests.
18. Backend predicates проверены там, где filtering backend-driven.
19. Active filter/context доказан browser/runtime evidence.
20. RBAC preserved.
21. Tenant/workspace scope preserved.
22. Unknown query values do not cause 500/security bypass.
23. RU/AZ/EN PASS для visible filter state.
24. Unexpected console errors = 0.
25. Unexpected valid-action API errors = 0.
26. Decision Queue lifecycle regression remains green.
27. TSC clean.
28. Build clean.
29. Git closure complete if code changed.
30. CRM Step 3.5 not started.

---

## 49. FINAL VERDICT

Вернуть ровно один:

### VERDICT A — STAGE F ACTION FILTER SEMANTICS VERIFIED / ALL 7 ACTIONS LEAD TO CORRECT OPERATIONAL CONTEXT / CRM STEP 3.5 READY

или:

### VERDICT B — STAGE F ACTION FILTER SEMANTICS INCOMPLETE

Обязательно разделить:

```text
Catalog unsold:
Catalog availability:
Failed Payments:
Pending Refunds:
Upcoming Bookings:
Booking Delay:
Recent Cancellations:
Query consumers:
Browser:
Tests:
Git:
```

или:

### VERDICT C — BLOCKED / REQUIRED FILTER OR OPERATIONAL DESTINATION DOES NOT EXIST

Указать:

```text
Missing capability:
Affected action:
Why generic destination is insufficient:
Required prerequisite:
```

---

## 50. STOP

После VERDICT:

**STOP.**

CRM Step 3.5 автоматически не запускать.
