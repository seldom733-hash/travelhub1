# PHASE 3 — D8 — FINAL RECONCILIATION CORRECTION
## AUDIT-ONLY GOVERNANCE PROMPT

### 0. ЦЕЛЬ

Выполнить только финальную точечную корректировку уже существующего:

`docs/reports/PHASE_3_D8_EVIDENCE_SCOPE_RECONCILIATION_REPORT.md`

Это НЕ новый D8 audit и НЕ implementation.

Нельзя переписывать весь анализ без необходимости.

---

# 1. ОБЯЗАТЕЛЬНЫЕ ЧЕТЫРЕ КОРРЕКЦИИ

## C1 — Classification Summary Consistency

Привести Executive Summary, Final Reclassified Findings и Final Output к одной и той же классификации.

Canonical classification должна соответствовать фактическому §23:

```text
B-01 = INTENTIONAL DIFFERENCE + DOCUMENTATION GAP
B-02 = INTENTIONAL DIFFERENCE + DOCUMENTATION GAP
B-03 = INTENTIONAL DIFFERENCE + DOCUMENTATION GAP
B-04 = NO ISSUE / DOCUMENTATION GAP
B-05 = NO ISSUE / DOCUMENTATION GAP
B-06 = CONFIRMED DEFECT
B-07 = DOCUMENTATION GAP
B-08 = STYLE PREFERENCE / NOT ARCHITECTURAL
B-09 = D9-OWNED
B-10 = STYLE PREFERENCE / NOT ARCHITECTURAL
B-11 = TERMINOLOGY ADJUSTMENT
```

Не писать одновременно, что B-04/B-05 являются documentation gaps и что они полностью rejected/no issue, если не пояснено:

```text
Implementation issue = NO
Code defect = NO
Documentation gap = YES
```

В summary counts не должно быть арифметических или semantic contradictions.

---

# 2. C2 — CANONICAL INVALID-DATE CONTRACT

B-06 является единственным подтверждённым functional defect.

Но сейчас registry contracts различаются:

```text
Requests  → 400 BadRequestException
Payments  → 422 ValidationDomainError
Orders    → no explicit validation
Bookings  → no explicit validation
```

Не выбирать canonical behavior по предположению.

Сначала проверить существующие:
- API error conventions;
- shared validation utilities;
- DTO validation patterns;
- existing tests;
- frontend expectations;
- controller exception filters;
- OpenAPI/error response conventions.

После evidence выбрать ОДИН из вариантов:

```text
A — canonical HTTP 400 + standard validation exception
B — canonical domain ValidationDomainError + mapped HTTP status
C — другой уже существующий canonical project-wide pattern
D — insufficient evidence; implementation decision required before coding
```

Обязательно зафиксировать:

```text
Exception type:
HTTP status:
Response shape:
Validation location:
Invalid date cases:
Whether both dateFrom/dateTo are validated:
```

Запрещено придумывать новый error contract только для D8.

Если existing repository evidence не позволяет выбрать единый contract — это должно быть явно записано как:

```text
OPEN GOVERNANCE DECISION
```

и D8 Implementation Ready тогда НЕ подтверждать.

---

# 3. C3 — ANALYTICS MUST BE RE-AUDITED AT VISIBILITY LEVEL

Предыдущий reconciliation исключил Analytics как OUT OF SCOPE.

Это нужно пересмотреть.

D8 отвечает за temporal visibility, тогда как D11 отвечает за project-wide KPI/status semantics.

Поэтому:

```text
D8:
Analytics temporal visibility / time dimensions
```

может быть в scope,

а:

```text
D11:
Analytics KPI semantic reconciliation
```

остаётся за D11.

Провести только необходимый additional audit Analytics:

Проверить:

- какие temporal fields реально существуют;
- какие временные dimensions используются;
- есть ли date/range/preset filters;
- server-side authority;
- URL/state;
- sorting;
- display;
- timezone;
- tenant/RBAC;
- какие temporal facts видимы пользователю;
- какие KPI temporal semantics относятся уже к D11.

В surface matrix Analytics НЕ должен оставаться просто:

```text
OUT OF SCOPE
```

Нужно классифицировать как минимум:

```text
Temporal visibility = IN SCOPE / PARTIAL / COMPLETE
KPI semantics = D11-owned
```

Не реализовывать Analytics.

---

# 4. C4 — CORRECT TEMPORAL VISIBILITY STATUS

Вместо:

```text
Temporal Visibility contract: EXISTING
```

использовать точную модель:

```text
Temporal semantics foundations = EXISTING
Temporal authority/filtering foundations = EXISTING
Global Temporal Visibility contract = PARTIAL
Canonical project-wide visibility contract = NOT YET FROZEN
```

Если evidence после Analytics audit доказывает более зрелое состояние — допускается:

```text
PARTIAL / READY FOR CANONIZATION
```

Но нельзя утверждать `EXISTING` как полностью canonical project-wide contract, если D8 всё ещё должен его canonize.

---

# 5. SCOPE RECHECK

После четырёх корректировок заново проверить D8 scope.

Получившийся MUST должен включать только доказанные D8 items.

Минимальная expected shape:

### MUST
- canonical global temporal vocabulary completion/canonization;
- canonical Operations Period contract;
- explicit intentional cross-domain temporal semantics;
- canonical default registry temporal dimension terminology;
- confirmed B-06 validation fix, только если C2 определил existing canonical error contract.

### SHOULD
- shared TemporalDisplay/code hygiene;
- DST documentation;
- timezone-layer documentation;
- edge-case tests not required for the confirmed defect.

### D9-owned
- export field standardization.

### D11-owned
- project-wide KPI temporal semantics/read-model reconciliation;
- period comparison semantics.

### Finance-owned
- PSP-specific temporal milestones.

Не превращать D8 в D9/D11/Finance.

---

# 6. IMPLEMENTATION PROMPT DECISION

После C1–C4 определить:

```text
Implementation Prompt = JUSTIFIED
```

только если:

1. D8 scope bounded;
2. B-06 canonical error contract determined;
3. Analytics visibility ownership determined;
4. no unresolved architectural blocker remains;
5. D8 MUST items implementable without changing frozen contracts;
6. D9/D11/Finance boundaries explicit.

Иначе:

```text
Implementation Prompt = NOT JUSTIFIED
```

с конкретной причиной.

---

# 7. VERDICT

Допустимы:

### VERDICT A — FINAL RECONCILIATION ACCEPTED / IMPLEMENTATION READY
Все four corrections закрыты, scope bounded.

### VERDICT B — FINAL RECONCILIATION ACCEPTED WITH ONE OPEN GOVERNANCE DECISION
D8 всё ещё TRUE NEXT, но один decision требуется до implementation.

### VERDICT C — REWORK REQUIRED
Evidence недостаточен или scope снова оказался неверным.

---

# 8. REQUIRED REPORT

Обновить существующий:

```text
docs/reports/PHASE_3_D8_EVIDENCE_SCOPE_RECONCILIATION_REPORT.md
```

Не создавать новый report.

В report обязательно добавить небольшой раздел:

```text
## Final Correction Pass
```

с четырьмя пунктами:

```text
C1 Classification Summary
C2 Canonical Invalid-Date Contract
C3 Analytics Visibility Ownership
C4 Temporal Visibility Contract Status
```

Затем обновить:
- Executive Summary;
- §23 Final Reclassified Findings;
- §24 D8 MUST/SHOULD/OUT OF SCOPE/DEFERRED;
- §26 Implementation Prompt Decision;
- §28 Final Output;
- Git evidence.

---

# 9. GIT

Если production code не меняется, допустим только report change.

Не изменять:
- schema;
- migrations;
- backend production code;
- frontend;
- permissions;
- tests, если это не требуется для evidence inspection;
- Master Plan;
- roadmap;
- D9/D11 contracts.

Если агент изменяет production code — это нарушение scope.

В конце:

```text
BASELINE SHA
FINAL SHA
HEAD == origin/master
tracked clean
untracked artifacts
production diff
```

---

# 10. FINAL OUTPUT

Вернуть:

```text
D8 FINAL RECONCILIATION CORRECTION

VERDICT: A / B / C

C1 Classification: PASS/FAIL
C2 Invalid-Date Contract: PASS/FAIL
Canonical exception:
Canonical HTTP status:
Canonical response shape:

C3 Analytics Visibility: PASS/FAIL
D8 Analytics scope:
D11 Analytics scope:

C4 Temporal Visibility Status:
- foundations:
- authority/filtering:
- global contract:

Confirmed defects:
Documentation gaps:
Intentional differences:
D9-owned:
D11-owned:
Finance-owned:
Rejected findings:

D8 MUST:
D8 SHOULD:
D8 OUT OF SCOPE:
D8 DEFERRED:

Implementation Prompt:
JUSTIFIED / NOT JUSTIFIED

Open governance decisions:
Blocking issues:

Git:
HEAD == origin/master:
Tracked clean:
Production changes:
Final SHA:
```

**STOP после reconciliation.**

Не создавать D8 implementation prompt.
Не реализовывать D8.
Не создавать новый roadmap.
Не переходить к D9.
