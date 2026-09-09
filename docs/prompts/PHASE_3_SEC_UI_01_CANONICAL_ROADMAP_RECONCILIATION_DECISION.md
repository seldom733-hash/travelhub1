# PHASE 3 --- SEC-UI-01 --- CANONICAL ROADMAP RECONCILIATION DECISION

## 1. Purpose

Этот документ является **governance / roadmap reconciliation decision**.

Он не выполняет UI-C6, не закрывает SEC-UI-01 технически и не является
qualification report.

Цель документа --- однозначно установить canonical sequencing:

``` text
SEC-UI-01 → UI-C6
UI-C6     → closes SEC-UI-01
UI-C7     → Request UI migration
```

Это необходимо для устранения конфликта между текущим Debt Register и
подготовленным UI-C6 implementation prompt.

------------------------------------------------------------------------

## 2. Current Baseline

``` text
Repository:
seldom733-hash/travelhub1

Canonical baseline:
d6aebb90182e54f45d1dd8090318542fcc7f26c0
```

На этом baseline:

``` text
UI-C4 = ACCEPTED
UI-C5 = ACCEPTED
SEC-UI-01 = OPEN
UI-C6 = NOT STARTED
UI-C7 = NOT STARTED
```

UI-C5 является завершённым этапом и не должен повторно рассматриваться
как TRUE NEXT.

------------------------------------------------------------------------

## 3. Problem Being Reconciled

В repository существуют два несовместимых stage mappings для одного debt
item.

### 3.1 Debt Register

Текущий `docs/TRAVELHUB_DEBT_REGISTER.md` содержит:

``` text
SEC-UI-01
Status: OPEN
Planned closure stage: UI-C7
```

### 3.2 UI-C6 Implementation Prompt

Подготовленный implementation prompt определяет:

``` text
UI-C6 = Request Server-Authority Remediation
UI-C7 = Request UI Migration
```

Следовательно, без отдельного decision layer существует конфликт:

``` text
Debt Register:
SEC-UI-01 → UI-C7

Implementation sequencing:
SEC-UI-01 → UI-C6
```

------------------------------------------------------------------------

## 4. Reconciliation Decision

### CANONICAL DECISION

Принять следующую sequencing model:

``` text
UI-C6 — Request Server-Authority Remediation
        ↓
        closes SEC-UI-01
        ↓
UI-C7 — Request UI Migration
```

Therefore:

``` text
SEC-UI-01 planned closure stage = UI-C6
```

а:

``` text
UI-C7 = dependent Request UI migration stage
```

------------------------------------------------------------------------

## 5. Rationale

### 5.1 Security remediation must precede UI migration

SEC-UI-01 описывает security gap:

``` text
Request actions are frontend-gated,
not server-authoritative.
```

Frontend migration не должна считаться способом закрытия authorization
gap.

Канонический security principle:

``` text
frontend may suggest
backend must decide
```

Поэтому remediation server authority должна быть отдельным prerequisite
stage.

------------------------------------------------------------------------

### 5.2 UI-C6 и UI-C7 имеют разные responsibilities

``` text
UI-C6
= backend/server-authority security remediation

UI-C7
= Request UI migration / consumption of canonical backend action contract
```

Смешивание этих двух задач создаёт риск того, что UI migration будет
принята при ещё открытом security debt.

------------------------------------------------------------------------

### 5.3 Dependency direction

Canonical dependency:

``` text
SEC-UI-01 OPEN
      ↓
UI-C6
      ↓
SEC-UI-01 CLOSED
      ↓
UI-C7
      ↓
Request UI migration
```

Не допускается:

``` text
UI-C7
  ↓
SEC-UI-01 closure
```

если UI-C7 означает migration, зависящую от уже server-authoritative
action contract.

------------------------------------------------------------------------

## 6. Effect on Debt Register

После принятия этого decision canonical Debt Register должен быть
reconciled:

``` text
SEC-UI-01
Planned closure stage:
UI-C6
```

Это является **documentation/governance reconciliation**, а не
техническим закрытием debt.

До выполнения UI-C6:

``` text
SEC-UI-01 Status = OPEN
Closure SHA = —
```

После успешного UI-C6 qualification:

``` text
SEC-UI-01 Status = CLOSED
Closure SHA = <UI-C6 final SHA>
```

UI-C6 implementation не должен заранее выставлять debt status в CLOSED.

------------------------------------------------------------------------

## 7. Effect on TRUE NEXT

После этого reconciliation sequencing ambiguity устранена.

Current accepted boundary:

``` text
UI-C4 ACCEPTED
UI-C5 ACCEPTED
```

Current blocker:

``` text
SEC-UI-01 OPEN / P1
```

Canonical closure stage:

``` text
UI-C6
```

Therefore:

``` text
TRUE NEXT = UI-C6
```

при условии, что отдельная TRUE NEXT requalification не обнаружит иной
более приоритетный blocker или dependency.

Это decision **разрешает sequencing conflict**, но не подменяет
implementation qualification.

------------------------------------------------------------------------

## 8. What Is NOT Changed

Этот decision НЕ:

-   закрывает SEC-UI-01;
-   реализует UI-C6;
-   реализует UI-C7;
-   изменяет Request state machine;
-   изменяет Request business semantics;
-   изменяет Order/Booking state machines;
-   изменяет Payment/Refund semantics;
-   изменяет D7 financial authority;
-   запускает D8;
-   запускает Finance Center;
-   запускает PROD-01;
-   закрывает PAY-01;
-   изменяет UI-C4/UI-C5 accepted scope.

------------------------------------------------------------------------

## 9. Historical Reports

Старый report:

``` text
TRUE NEXT = UI-C4
```

остаётся валидным **historical final report** для соответствующего
baseline и lifecycle point.

Он не должен переписываться под новый state.

Current sequence is:

``` text
historical:
UI-C2 → UI-C4

current:
UI-C4 ACCEPTED
UI-C5 ACCEPTED
SEC-UI-01 OPEN
TRUE NEXT → UI-C6
```

Таким образом historical report и current roadmap decision не являются
конкурирующими verdicts.

------------------------------------------------------------------------

## 10. UI-C6 Prompt Status

После принятия reconciliation:

``` text
PHASE_3_UI_C6_REQUEST_SERVER_AUTHORITY_REMEDIATION_IMPLEMENTATION_PROMPT.md
```

становится:

``` text
READY FOR EXECUTION
```

но только как implementation artefact.

Он всё ещё обязан пройти полный workflow:

``` text
AUDIT FIRST
→ IMPLEMENT
→ VERIFY
→ QUALIFY
→ REPORT
→ GIT HARD CLOSURE
→ FINAL VERDICT
```

Наличие этого decision не является доказательством успешного UI-C6.

------------------------------------------------------------------------

## 11. Required Follow-Up

### A. Reconcile canonical Debt Register

Изменить только sequencing field:

``` text
SEC-UI-01
Planned closure stage:
UI-C7 → UI-C6
```

Не менять:

``` text
Status:
OPEN
```

### B. Preserve UI-C7 dependency

Зафиксировать:

``` text
UI-C7 starts only after SEC-UI-01 is closed
```

### C. Run current TRUE NEXT requalification

После documentation reconciliation проверить:

``` text
TRUE NEXT = UI-C6
```

и убедиться, что нет другого NOW/security blocker.

### D. Only then execute UI-C6

------------------------------------------------------------------------

## 12. Governance Rule

Запрещено использовать следующую логику:

``` text
SEC-UI-01 exists
+
UI-C6 prompt exists
=
UI-C6 automatically accepted/started
```

Правильная логика:

``` text
SEC-UI-01 OPEN
        ↓
canonical sequencing decision
        ↓
TRUE NEXT = UI-C6
        ↓
UI-C6 execution
        ↓
security qualification
        ↓
SEC-UI-01 CLOSED
```

------------------------------------------------------------------------

## 13. Final Decision

``` text
RECONCILIATION DECISION: APPROVED

SEC-UI-01 closure stage:
UI-C6

UI-C6:
Request Server-Authority Remediation

UI-C7:
Request UI Migration

SEC-UI-01:
OPEN — remains open until UI-C6 is successfully qualified

TRUE NEXT:
UI-C6

UI-C6:
READY FOR EXECUTION AFTER CURRENT TRUE NEXT REQUALIFICATION

D8:
NOT STARTED

Finance Center:
DEFERRED / NOT STARTED

PROD-01:
OPEN / DEFERRED

PAY-01:
FUTURE
```

## 14. Final Governance Statement

Canonical sequencing is now:

``` text
UI-C4 ACCEPTED
      ↓
UI-C5 ACCEPTED
      ↓
SEC-UI-01 OPEN
      ↓
UI-C6 — Server-Authority Remediation
      ↓
SEC-UI-01 CLOSED
      ↓
UI-C7 — Request UI Migration
```

**This document resolves the SEC-UI-01 UI-C6/UI-C7 roadmap ambiguity. It
does not claim that SEC-UI-01 has been technically closed.**
