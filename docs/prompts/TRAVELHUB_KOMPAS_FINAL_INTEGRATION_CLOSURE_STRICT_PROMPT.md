# TRAVELHUB — KOMPAS FINAL INTEGRATION CLOSURE
## STRICT EXECUTION PROMPT — NO PARTIAL SUCCESS / NO REPETITION

## 0. ЦЕЛЬ

Это **CLOSURE TASK**, а не очередной exploratory этап.

Предыдущие этапы уже подтвердили:
- live KOMPAS access;
- Baku `TOWNFROMINC=1411`;
- Turkey `STATEINC=17`;
- Tour `3332`;
- nights `3–14`;
- explicit rejection unsupported nights;
- DOM hard-fail;
- SupplierOffer pipeline;
- cache integrity;
- public supplier search API;
- search route;
- PriceConfigurator;
- backend regression `126/126`;
- KOMPAS live E2E `14/14`.

Предыдущий отчёт оставил незакрытыми:
1. PriceCalendar не интегрирован в реальный search flow;
2. VitrinaFilters не интегрирован в реальный search flow;
3. полноценный browser/application E2E не доказан фактическим запуском;
4. Git Closure = PENDING;
5. working tree = DIRTY.

**Цель этого этапа — закрыть именно эти пункты. Не повторять уже закрытую работу без необходимости.**

---

## 1. ИСТОЧНИК ИСТИНЫ

`GitHub seldom733-hash/travelhub1` НЕ является полным baseline.

Использовать в приоритете:
1. текущий working tree;
2. текущую архитектуру;
3. предыдущие KOMPAS reports;
4. текущий application integration report;
5. существующие tests;
6. GitHub — только как supplementary history/reference.

### ЗАПРЕЩЕНО

- `git reset --hard`;
- `git clean -fd`;
- откат к старому commit;
- восстановление файлов только потому, что их нет в GitHub;
- удаление незакоммиченных изменений;
- перезапись unrelated work.

---

## 2. FIRST ACTION — ЗАФИКСИРОВАТЬ СОСТОЯНИЕ

До любых изменений:

```bash
git status --short
git diff --stat
git diff
git log -1 --oneline
```

Зафиксировать:
- HEAD before;
- branch;
- staged;
- modified;
- untracked.

Разделить изменения на:
- pre-existing;
- KOMPAS;
- unrelated.

---

## 3. ПРОВЕРИТЬ ФАКТИЧЕСКИЙ КОД

Перед изменениями изучить:

```text
frontend/app/search/page.tsx
frontend/components/marketplace/HeroSearch.tsx
frontend/components/marketplace/CompactSearch.tsx
frontend/lib/supplier-api.ts
frontend/components/supplier/PriceConfigurator.tsx
frontend/components/supplier/PriceCalendar.tsx
frontend/components/supplier/VitrinaFilters.tsx
backend/src/modules/supplier/
```

Также проверить существующие:
- API conventions;
- DTO;
- supplier abstraction;
- hooks;
- i18n;
- routing;
- tests.

Не создавать дубликаты существующих компонентов.

---

# 4. ОБЯЗАТЕЛЬНЫЕ CLOSURE GATES

К концу этапа должны быть доказаны:

```text
[ ] PriceCalendar реально интегрирован
[ ] VitrinaFilters реально интегрирован
[ ] Filters управляют реальным supplier search
[ ] Calendar использует реальный API/data flow
[ ] Full browser E2E реально выполнен
[ ] Golden scenario реально выполнен
[ ] nights=15 реально проверен через browser
[ ] stale-result isolation реально проверен через browser
[ ] USD — единственная валюта KOMPAS scope
[ ] failed query не показывает stale/fallback result
[ ] backend regression PASS
[ ] frontend typecheck PASS
[ ] frontend tests PASS или честно зафиксирован blocker
[ ] frontend build PASS или честно зафиксирован blocker
[ ] Git Closure выполнен
[ ] commit SHA существует
[ ] post-commit git status проверен
```

Если обязательный gate не проверен — он **NOT VERIFIED**, а не PASS.

---

# 5. PRICECALENDAR — ОБЯЗАТЕЛЬНО РЕАЛЬНО ИНТЕГРИРОВАТЬ

Существующий:

```text
frontend/components/supplier/PriceCalendar.tsx
```

не считать завершённым только потому, что файл существует.

Он должен быть частью реального TravelHub application flow.

Требуется:

```text
Search / Filters
      ↓
Public Supplier API
      ↓
SupplierOffer / price data
      ↓
PriceCalendar
```

Не использовать fake prices.

Не hardcode KOMPAS offers.

Не mock final live flow.

Проверить:
- date;
- price;
- USD;
- availability;
- loading;
- empty;
- error;
- retry;
- date selection.

---

# 6. VITRINAFILTERS — ОБЯЗАТЕЛЬНО РЕАЛЬНО ИНТЕГРИРОВАТЬ

Существующий:

```text
frontend/components/supplier/VitrinaFilters.tsx
```

должен быть встроен в реальный search UI.

Текущий подтверждённый KOMPAS scope:

```text
Nights: 3–14
Adults: 1–4
Children: 0–1
Destination
Meal
Currency: USD
```

Не добавлять:
- EUR;
- AZN;
- неподтверждённые STARS;
- seats;
- stopSale.

---

# 7. FILTER → API → KOMPAS

Для каждого активного filter доказать путь:

```text
UI
↓
state / URL
↓
API query
↓
backend DTO
↓
supplier service
↓
KOMPAS adapter
↓
actual KOMPAS parameter
```

Минимум проверить:
- nights;
- adults;
- children;
- departureCity;
- destination;
- meal;
- date;
- currency.

Если filter не доходит до KOMPAS, он не должен отображаться как рабочий filter.

---

# 8. GOLDEN SCENARIO

Использовать только ранее подтверждённый scenario:

```text
Baku = TOWNFROMINC 1411
Turkey = STATEINC 17
Tour = 3332
Nights = 7
Adults = 2
Children = 0
Currency = USD
```

---

# 9. FULL BROWSER E2E — ОБЯЗАТЕЛЬНО

Это НЕ backend E2E и НЕ component test.

Реально открыть приложение browser automation и выполнить:

```text
Browser
↓
/
↓
HeroSearch
↓
Tours
↓
Baku
↓
Turkey
↓
date
↓
nights=7
↓
adults=2
↓
search
↓
/search
↓
VitrinaFilters
↓
public supplier API
↓
KOMPAS
↓
SupplierOffer
↓
PriceConfigurator
↓
PriceCalendar
```

Зафиксировать фактические:
- URL;
- UI state;
- request;
- response;
- rendered offer;
- price;
- USD;
- nights;
- passengers.

**Описание предполагаемого flow не является evidence.**

---

# 10. NEGATIVE BROWSER E2E — NIGHTS=15

Через реальный application UI выполнить:

```text
nights=15
```

Ожидается rejection/error.

Запрещено:

```text
15 → 3
15 → previous result
15 → silent clamp
15 → fake empty success
```

Проверить одновременно:

```text
error visible
+
no fallback
+
no stale result
```

---

# 11. RESULT ISOLATION — BROWSER

В browser выполнить:

### A
```text
nights=7
adults=2
children=0
```

Получить A.

### B
```text
nights=3
adults=2
children=0
```

Получить B.

### C
```text
nights=15
```

Получить error.

Доказать:

```text
A ≠ B
A ≠ C
B ≠ C
```

Особенно важно:

```text
valid result
→ invalid query
```

не должен оставлять старый result видимым как результат нового запроса.

---

# 12. USD ONLY

KOMPAS scope:

```text
USD
```

Не реализовывать:
- conversion;
- EUR;
- AZN;
- fallback currency.

Каждая отображаемая KOMPAS price должна иметь:

```text
currency = USD
```

EUR/AZN — **OUT OF SCOPE**, не defects.

---

# 13. NO MOCK FINAL E2E

Для final KOMPAS golden flow нельзя mock:
- KOMPAS;
- SupplierOffer;
- price;
- availability.

Если live KOMPAS недоступен:
```text
NOT VERIFIED
```

Нельзя превращать mock test в PASS.

---

# 14. ERROR UX

Сохранить отдельные состояния:

```text
UNSUPPORTED
TIMEOUT
NO_RESULT
GENERIC
DOM_HARD_FAIL
```

Supplier error не должен становиться успешным empty result.

---

# 15. CACHE

Проверить:

```text
valid query → cache
invalid query → no successful cache
DOM hard-fail → no cache
timeout/error → no successful stale result
```

Минимум:
```text
nights=7
```
и
```text
nights=3
```
не должны выдавать неверный общий result.

---

# 16. TESTS

Запустить существующие backend tests.

Ожидаемая база:

```text
126/126 PASS
```

Если добавлены legitimate tests:

```text
previous: 126
new: <actual>
failed: 0
```

Не удалять/ослаблять tests ради PASS.

Frontend:

```bash
cd frontend
npx tsc --noEmit
npm test
npm run lint
npm run build
```

Если команда отсутствует — `NOT AVAILABLE`.

Если не выполнена — не писать PASS.

---

# 17. LIVE VERIFICATION

Реально проверить golden scenario:

```text
Baku 1411
Turkey 17
Tour 3332
7 nights
2 adults
0 children
USD
```

Путь:

```text
TravelHub
→ API
→ KOMPAS
→ real SupplierOffer
→ Frontend
```

---

# 18. НЕ ПЕРЕДЕЛЫВАТЬ ЗАКРЫТЫЕ ЧАСТИ

Не переписывать без фактической причины:
- KOMPAS discovery;
- nights 3–14 contract;
- DOM hard-fail;
- SupplierOffer model;
- уже проходящие adapter tests.

Если обнаружена регрессия — исправить минимально и доказать regression test.

---

# 19. FILE DISCIPLINE

До изменения каждого файла определить:

```text
PRE-EXISTING
CURRENT PHASE
UNRELATED
```

Не уничтожать unrelated changes.

В финальном отчёте перечислить все изменённые файлы.

---

# 20. GIT CLOSURE — ОБЯЗАТЕЛЬНО

Предыдущий отчёт закончен состоянием:

```text
Git Closure: PENDING
HEAD after: TBD
Commit: TBD
Working tree: DIRTY
```

Это состояние должно быть закрыто.

## 20.1 Before staging

```bash
git status --short
git diff --stat
git diff
```

Разделить:
- current phase;
- pre-existing;
- unrelated.

## 20.2 Final tests BEFORE commit

Запустить:
- backend tests;
- frontend typecheck;
- frontend tests;
- frontend build;
- full browser E2E;
- KOMPAS live verification.

## 20.3 Stage ONLY current phase

Не делать без проверки:

```bash
git add .
```

## 20.4 Commit

```bash
git commit -m "feat(kompas): close application integration"
```

Если использован другой message — указать фактический.

## 20.5 Verify

После commit обязательно:

```bash
git status
git log -1 --oneline
git rev-parse HEAD
```

Зафиксировать фактический SHA.

## 20.6 Push

Push только если реально выполняется и разрешён.

Если не выполнялся:

```text
PUSH: NOT EXECUTED
```

Не писать PUSHED без фактического push.

## 20.7 Git Closure result

Обязательно:

```text
Git Closure:
  STATUS: PASS / PARTIAL / FAIL

HEAD before:
  <actual SHA>

HEAD after:
  <actual SHA>

Commit:
  <actual SHA>

Commit message:
  <actual message>

Push:
  PUSHED / NOT EXECUTED

Working tree:
  CLEAN / DIRTY
```

---

# 21. FINAL REPORT

Создать:

```text
TRAVELHUB_KOMPAS_FINAL_INTEGRATION_CLOSURE_REPORT.md
```

Структура:

1. Executive Summary
2. Initial State
3. PriceCalendar Integration
4. VitrinaFilters Integration
5. Query Propagation
6. Golden Scenario
7. Full Browser E2E
8. Negative Browser E2E
9. Result Isolation
10. Error UX
11. Cache Integrity
12. USD Contract
13. Backend Regression
14. Frontend Tests
15. Build
16. Live Verification
17. Files Changed
18. Evidence Matrix
19. Remaining Limitations
20. Git Closure
21. Final Qualification

---

# 22. EVIDENCE MATRIX

| Gate | Result | Actual Evidence |
|---|---|---|
| Public Search API | PASS/FAIL | actual endpoint/test |
| Route integration | PASS/FAIL | actual browser execution |
| VitrinaFilters | PASS/FAIL | actual UI interaction |
| PriceConfigurator | PASS/FAIL | actual rendered offer |
| PriceCalendar | PASS/FAIL | actual rendered calendar |
| Golden scenario | PASS/FAIL | actual live evidence |
| nights=15 | PASS/FAIL | actual browser negative test |
| Result isolation | PASS/FAIL | actual A→B→C execution |
| USD | PASS/FAIL | actual rendered currency |
| Cache isolation | PASS/FAIL | actual test |
| Backend regression | PASS/FAIL | actual test count |
| Frontend typecheck | PASS/FAIL | actual output |
| Frontend tests | PASS/FAIL | actual output |
| Frontend build | PASS/FAIL | actual output |
| Git Closure | PASS/FAIL | actual SHA/status |

---

# 23. STRICT STATUS RULE

Allowed final statuses only:

```text
QUALIFIED
QUALIFIED WITH KNOWN LIMITATIONS
NOT QUALIFIED
```

`QUALIFIED` только если все mandatory closure gates PASS.

Если mandatory gate не выполнен:

```text
NOT QUALIFIED
```

если только это не genuinely accepted limitation outside mandatory scope.

---

# 24. ABSOLUTELY FORBIDDEN FALSE-PASS

Нельзя считать:

```text
component exists = integrated
component compiles = integrated
unit test = browser E2E
backend E2E = frontend E2E
described flow = executed flow
mock = live KOMPAS
previous report = current verification
planned command = executed command
staged = committed
commit command = commit completed
push command = push completed
dirty = clean
```

Каждый PASS должен иметь фактическое evidence.

---

# 25. STOP CONDITION

Не писать completion report как успешное закрытие, пока не выполнены:

1. PriceCalendar real integration;
2. VitrinaFilters real integration;
3. real browser E2E;
4. golden scenario;
5. nights=15 negative browser test;
6. result isolation browser test;
7. regression;
8. Git Closure.

Если что-либо невозможно выполнить:

```text
NOT QUALIFIED
```

с точным blocker.

---

# 26. ФИНАЛЬНЫЙ ПРИНЦИП

Мы больше не принимаем цикл:

```text
"implemented"
→ "report PASS"
→ следующая фаза обнаруживает, что не integrated
→ повтор той же работы
```

Поэтому:

> **Никакого PASS без executable evidence.**

Этап считается закрытым только после:

```text
REAL IMPLEMENTATION
+
REAL TEST EXECUTION
+
REAL BROWSER E2E
+
REAL LIVE EVIDENCE
+
REAL GIT COMMIT
```
