# TRAVELHUB — SUPPLIER PASSENGER PARAMETERS OWNER DECISION CLOSURE

## Purpose

Закрыть только три owner decisions из последнего
`TRAVELHUB_SUPPLIER_AUTHORITATIVE_PRICE_CONSISTENCY_READ_ONLY_AUDIT_REPORT.md`.

Это НЕ implementation prompt. На этом этапе запрещены код, schema/DB changes,
price changes, lifecycle changes, Markup changes, payment deadline/recheck work,
commit и push.

После закрытия всех решений подготовить отдельный implementation prompt.

---

## 1. Summer — AGE1 / AGE2 / AGE3

### Подтверждено аудитом

`buildSummerSearchRequest` формирует AGE1/AGE2/AGE3 из `childAges`, но active
`buildSummerXhrUrl` сериализует только ADULT/CHILD. `refreshPrice` также теряет
AGE1-3 на active XHR boundary.

Бизнес-правило владельца: Summer определяет цену детей сам; дети до 13 лет
включительно, а цена 5-летнего и 12-летнего может различаться по туру.

### Decision S1

Подтверждает ли Summer, что active `search_tour` XHR должен получать:

```text
ADULT
CHILD
AGE1
AGE2
AGE3
```

где AGE1..AGE3 — возраста конкретных детей?

Ответ должен быть одним из:

- **S1-A YES** — AGE1-3 являются подтвержденными параметрами active XHR.
- **S1-B NO** — active XHR их не использует.
- **S1-C NEED SUPPLIER CONFIRMATION** — контракт пока не подтвержден.

### Нельзя предполагать

Нельзя считать AGE1-3 рабочими только потому, что TravelHUB их уже строит
во внутреннем объекте.

### Consequence

**YES:** исправить active Summer XHR serializer, сохранить AGE1-3 также при
refreshPrice, добавить regression tests.

**NO:** не добавлять AGE1-3; использовать только подтвержденный supplier
contract, без собственного расчета цены.

**NEED CONFIRMATION:** код не менять.

---

## 2. Anex Tours — несколько child ages

### Подтверждено аудитом

Сейчас active adapter отправляет:

```text
ADULT
CHILD
AGES=childAges[0]
```

То есть передается только первый возраст.

### Decision A1

Какой формат официально принимает Anex Tours для нескольких детей?

Ответ:

- **A1-A MULTI-AGE SUPPORTED** — передаются все возраста; владелец должен
  указать точный supplier format.
- **A1-B ONLY FIRST AGE** — текущая схема является контрактным ограничением.
- **A1-C NEED SUPPLIER CONFIRMATION** — формат не подтвержден.

### Нельзя предполагать

Нельзя самостоятельно вводить `AGES=5,8,12` или другой separator/encoding.

### Consequence

**MULTI:** реализовать только подтвержденный supplier-specific mapping и
tests для нескольких детей.

**FIRST ONLY:** оставить ограничение явно зафиксированным; не компенсировать
его TravelHUB pricing logic.

**NEED CONFIRMATION:** mapper не менять.

---

## 3. Flights / AZAL — child ages

### Подтверждено аудитом

Flight domain сейчас использует:

```text
adults
children
infants
```

Child ages/DOB теряются.

Для AZAL используются агрегированные counts:

```text
adult_count
child_count
infant_count
```

Зафиксированное owner business rule:

```text
< 2       = infant
2–11      = child
12+       = adult
```

### Decision F1

Как поступать с child ages в flight domain?

- **F1-A COUNTS ONLY** — canonical flight pricing data содержит только
  adults/children/infants.
- **F1-B CARRY CHILD AGES** — добавить childAges как data/transport field,
  но не рассчитывать цену в TravelHUB.
- **F1-C AZAL DOB** — если AZAL подтверждает DOB contract, сделать
  AZAL-specific mapping.
- **F1-D NEED SUPPLIER CONFIRMATION** — сначала подтвердить контракт.

Если вводятся DOB/ages, отдельно определить authority для DOB → category:
supplier contract, утвержденное TravelHUB rule или supplier-specific rules.
Нельзя создавать универсальное правило для всех flight suppliers без
подтверждения.

### Consequence

**COUNTS ONLY:** не расширять flight pricing contract.

**CARRY AGES:** расширить transport data и передавать ages только suppliers,
которые это поддерживают.

**AZAL DOB:** сделать только AZAL-specific mapping; другие suppliers не менять.

**NEED CONFIRMATION:** implementation отложить.

---

## 4. Общее правило Price Authority

Независимо от решений:

```text
Passenger composition
        ↓
Supplier-specific mapper
        ↓
Supplier request
        ↓
Supplier response
        ↓
Supplier authoritative price
        ↓
TravelHUB Markup
        ↓
Public price
        ↓
Optional individual discount
```

TravelHUB не рассчитывает supplier price, не заменяет supplier pricing rules
и не создает универсальную age-based pricing formula.

---

## 5. Decision Matrix

| Decision | Owner answer | Implementation consequence |
|---|---|---|
| S1 — Summer AGE1-3 | YES / NO / NEED CONFIRMATION | Active XHR mapper |
| A1 — Anex Tours ages | MULTI / FIRST ONLY / NEED CONFIRMATION | `AGES` mapping |
| F1 — Flight child ages | COUNTS / CARRY AGES / AZAL DOB / NEED CONFIRMATION | Flight transport + AZAL mapping |

---

## 6. Closure criteria

Decision Closure завершен только если явно зафиксированы:

```text
S1 = ...
A1 = ...
F1 = ...
```

Не допускаются `TBD`, `probably`, `assume`, `looks like`, `should be` без
explicit owner confirmation.

После закрытия:

1. подготовить отдельный implementation prompt;
2. использовать только подтвержденные решения;
3. не включать неподтвержденные supplier assumptions;
4. не смешивать payment deadline/recheck, Markup redesign или lifecycle;
5. commit/push выполнять только по отдельному разрешению.

### Final output

```text
S1 — Summer AGE1-3:        [DECISION]
A1 — Anex Tours ages:      [DECISION]
F1 — Flight child ages:    [DECISION]

READY FOR IMPLEMENTATION: YES / NO
```

Если хотя бы одно решение требует supplier confirmation — `READY FOR
IMPLEMENTATION: NO`.

Если все три решения однозначно закрыты — `READY FOR IMPLEMENTATION: YES`.
