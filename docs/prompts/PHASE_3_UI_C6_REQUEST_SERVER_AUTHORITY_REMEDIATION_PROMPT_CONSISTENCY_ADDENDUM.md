# PHASE 3 --- UI-C6 --- REQUEST SERVER-AUTHORITY REMEDIATION

## PROMPT CONSISTENCY / ROADMAP SELECTION GATE --- ADDENDUM

### Назначение

Этот addendum является обязательным governance-дополнением к:

`PHASE_3_UI_C6_REQUEST_SERVER_AUTHORITY_REMEDIATION_IMPLEMENTATION_PROMPT.md`

Он **не меняет implementation scope UI-C6**, не меняет SEC-UI-01 и не
переопределяет canonical roadmap.

Его задача --- исключить ошибочную интерпретацию:

> наличие UI-C6 implementation prompt автоматически означает, что UI-C6
> уже выбран как TRUE NEXT.

------------------------------------------------------------------------

## 1. PRECONDITION --- ROADMAP SELECTION GATE

UI-C6 является **implementation candidate**, пока отдельный:

`PHASE_3_ROADMAP_REQUALIFICATION_TRUE_NEXT_AUDIT_PROMPT.md`

не подтвердит:

``` text
TRUE NEXT = UI-C6 — Request Server-Authority Remediation
```

Следующие факты **сами по себе НЕ являются достаточным основанием** для
выбора UI-C6 как TRUE NEXT:

``` text
SEC-UI-01 = OPEN
SEC-UI-01 = NOW / BLOCKER
UI-C6 = canonical closure stage for SEC-UI-01
наличие данного implementation prompt
```

Они доказывают необходимость и canonical closure mapping, но не заменяют
отдельное решение о выборе следующего stage.

------------------------------------------------------------------------

## 2. REQUIRED SEQUENCE

До запуска implementation:

``` text
CURRENT ACCEPTED STATE
        ↓
ROADMAP REQUALIFICATION
        ↓
candidate comparison
        ↓
dependency / security / architecture check
        ↓
TRUE NEXT determination
        ↓
если TRUE NEXT = UI-C6
        ↓
UI-C6 implementation prompt
        ↓
AUDIT FIRST
        ↓
IMPLEMENT
        ↓
VERIFY
        ↓
QUALIFY
        ↓
REPORT
        ↓
GIT HARD CLOSURE
        ↓
FINAL VERDICT
```

Не допускается сокращать эту последовательность до:

``` text
SEC-UI-01 OPEN
→ UI-C6
```

------------------------------------------------------------------------

## 3. CURRENT CANONICAL FACTS

На baseline:

``` text
BASELINE:
d6aebb90182e54f45d1dd8090318542fcc7f26c0
```

сохраняются:

``` text
UI-C4 = ACCEPTED
UI-C5 = ACCEPTED
SEC-UI-01 = OPEN
UI-C6 = Request server-authority remediation
UI-C7 = Request UI migration
D8 = NOT STARTED
Finance Center = NOT STARTED
PROD-01 = OPEN
PAY-01 = future requirement
```

Canonical phasing:

``` text
UI-C6  → Request server-authority remediation (SEC-UI-01)
UI-C7  → Request UI migration
```

и:

``` text
SEC-UI-01 closes at UI-C6,
before Request migration at UI-C7.
```

Эта последовательность является **closure dependency**, но окончательный
выбор `TRUE NEXT` должен быть подтверждён отдельным roadmap audit.

------------------------------------------------------------------------

## 4. HISTORICAL NUMBERING --- NO RESEQUENCING BY OLD ARTEFACTS

В repository/library могут существовать более ранние документы с другой
нумерацией UI-C3/UI-C4/UI-C5/UI-C6/UI-C7.

Они не должны автоматически переопределять текущий canonical mapping.

При конфликте использовать precedence:

``` text
accepted stage reports
+
current canonical design/roadmap contract
+
current Debt Register
```

Исторический artefact должен рассматриваться как historical/superseded
evidence, если более поздний accepted/canonical source явно установил
другое соответствие.

Не выполнять resequencing UI-C6 только на основании старого номера
stage.

------------------------------------------------------------------------

## 5. BLOCKING CONDITION BEFORE IMPLEMENTATION

Если latest roadmap requalification обнаружит:

-   другой security blocker с более высоким приоритетом;
-   неразрешённую dependency, которая должна быть закрыта до UI-C6;
-   contradiction между canonical roadmap sources;
-   необходимость сначала выполнить другой prerequisite stage;
-   невозможность однозначно определить TRUE NEXT;

то:

``` text
STOP
DO NOT IMPLEMENT UI-C6
VERDICT = BLOCKED / ROADMAP REQUALIFICATION REQUIRED
```

В таком случае сам UI-C6 implementation prompt остаётся валидным как
подготовленный implementation artefact, но **не является разрешением на
запуск**.

------------------------------------------------------------------------

## 6. NO AUTOMATIC TRUE NEXT AFTER PROMPT CREATION

Создание, проверка или сохранение этого prompt не должно менять roadmap
state.

Следовательно:

``` text
PROMPT EXISTS
≠
UI-C6 STARTED
≠
UI-C6 ACCEPTED
≠
SEC-UI-01 CLOSED
≠
TRUE NEXT PROVEN
```

Только фактическое выполнение и qualification могут закрыть UI-C6.

Только отдельный roadmap requalification может выбрать UI-C6 как TRUE
NEXT.

------------------------------------------------------------------------

## 7. FINAL GOVERNANCE RULE

Правильная модель:

``` text
SEC-UI-01
    │
    │ OPEN / NOW / BLOCKER
    ▼
UI-C6
    │
    │ canonical closure stage
    ▼
ROADMAP REQUALIFICATION
    │
    ├── another blocker/dependency → BLOCK
    │
    └── no higher-priority blocker
              │
              ▼
        TRUE NEXT = UI-C6
              │
              ▼
        UI-C6 EXECUTION
```

Таким образом, UI-C6 остаётся корректным и готовым implementation stage,
но его запуск не должен быть автоматизирован только существованием
SEC-UI-01 или самого prompt.

------------------------------------------------------------------------

## 8. CONSISTENCY VERDICT

``` text
PROMPT:
PHASE_3_UI_C6_REQUEST_SERVER_AUTHORITY_REMEDIATION_IMPLEMENTATION_PROMPT.md

CONSISTENCY:
PASS

IMPLEMENTATION SCOPE:
PASS

SEC-UI-01 MAPPING:
PASS

CURRENT ROADMAP MAPPING:
PASS

HISTORICAL NUMBERING HANDLING:
PASS

GOVERNANCE PRECONDITION:
REQUIRED

TRUE NEXT:
MUST BE CONFIRMED BY SEPARATE ROADMAP REQUALIFICATION
```

### Final rule

``` text
UI-C6 = READY FOR EXECUTION
ONLY AFTER
TRUE NEXT = UI-C6
is explicitly established by the roadmap requalification.
```
