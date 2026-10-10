# TRAVELHUB — SUPPLIER PASSENGER PARAMETERS CONFIRMED IMPLEMENTATION PROMPT

## 0. PURPOSE

Implement the confirmed passenger-composition transport changes using the
supplier contracts demonstrated by real supplier requests supplied by the
owner.

This prompt supersedes the previous owner-decision blocker for the confirmed
tour suppliers.

Do NOT invent supplier formats.

Do NOT calculate supplier prices in TravelHUB.

Do NOT mix this implementation with:
- payment deadline / payment recheck;
- Markup redesign;
- Request → Order → Booking lifecycle;
- unrelated traveler UI work;
- unrelated supplier functionality.

No commit/push unless separately authorized.

---

# 1. CONFIRMED SUPPLIER EVIDENCE

The owner supplied real supplier request URLs demonstrating that the
following tour suppliers accept child ages through a comma-separated `AGES`
parameter.

## 1.1 Summer

Real request contains:

```text
ADULT=12
CHILD=3
AGES=2,6,12
```

Confirmed supplier-native representation:

```text
childAges = [2, 6, 12]
        ↓
AGES=2,6,12
```

Important:

- Do NOT implement `AGE1`, `AGE2`, `AGE3` for Summer XHR.
- The confirmed active representation is one `AGES` parameter.
- Summer remains authoritative for supplier pricing.

## 1.2 Anex Tours

Real request contains:

```text
ADULT=2
CHILD=3
AGES=1,6,13
```

Confirmed representation:

```text
childAges = [1, 6, 13]
        ↓
AGES=1,6,13
```

Do NOT keep the current behavior of sending only the first child age once
the confirmed implementation is applied.

Do NOT invent another separator or encoding.

## 1.3 Kompas

Real request contains:

```text
ADULT=2
CHILD=3
AGES=1,6,7
```

Confirmed representation:

```text
childAges = [1, 6, 7]
        ↓
AGES=1,6,7
```

Kompas must preserve the complete child-age list supported by the canonical
composition.

## 1.4 KazUnion

Real request contains:

```text
ADULT=2
CHILD=3
AGES=4,6,8
```

Confirmed representation:

```text
childAges = [4, 6, 8]
        ↓
AGES=4,6,8
```

Do not restrict the implementation to a hard-coded AGE1..AGE4 representation
when serializing the confirmed `AGES` parameter.

---

# 2. CANONICAL TRAVELHUB COMPOSITION

Use the canonical passenger composition as data:

```json
{
  "adults": 2,
  "children": 3,
  "childAges": [4, 6, 8]
}
```

The exact values are examples.

The implementation must preserve the actual runtime values and ordering of
`childAges`.

Invariant:

```text
children === childAges.length
```

when child ages are present and the supplier contract requires all child
ages.

Do not calculate supplier prices from these ages.

---

# 3. SUPPLIER-SPECIFIC MAPPING

Keep the mapper boundary supplier-specific.

Required mappings:

```text
SUMMERTOUR
  adults     → ADULT
  children   → CHILD
  childAges  → AGES=<comma-separated ages>

ANEX
  adults     → ADULT
  children   → CHILD
  childAges  → AGES=<comma-separated ages>

KOMPAS
  adults     → ADULT
  children   → CHILD
  childAges  → AGES=<comma-separated ages>

KAZUNION
  adults     → ADULT
  children   → CHILD
  childAges  → AGES=<comma-separated ages>
```

Do not create one generic supplier URL builder.

A shared small serialization helper may be used only if it does not erase
supplier-specific boundaries and does not introduce supplier assumptions.

---

# 4. SUMMER FIX

Audit showed that Summer internally builds child ages but active XHR
serialization drops them.

Fix the active Summer request boundary so canonical:

```text
childAges = [2, 6, 12]
```

becomes:

```text
AGES=2,6,12
```

Apply the same correct composition to:

- normal search request;
- supplier price refresh/recheck path where the same Summer search context
  is used.

Do not introduce:

```text
AGE1
AGE2
AGE3
```

into the active Summer XHR.

Do not change supplier price calculation.

---

# 5. ANEX TOURS FIX

Current audit state sends only the first child age.

Replace the incomplete mapping with:

```text
childAges = [1, 6, 13]
        ↓
AGES=1,6,13
```

All available child ages must be preserved according to the confirmed
supplier contract.

The implementation must not silently truncate:

```text
[1, 6, 13]
```

to:

```text
[1]
```

---

# 6. KOMPAS FIX

Ensure the active Kompas mapper serializes the full canonical list:

```text
[1, 6, 7]
        ↓
AGES=1,6,7
```

Do not replace this with AGE1/AGE2/AGE3 unless the existing transport layer
requires an internal representation before final serialization.

The supplier-facing request must match the confirmed real request:

```text
AGES=1,6,7
```

---

# 7. KAZUNION FIX

Ensure the active KazUnion mapper serializes the full canonical list:

```text
[4, 6, 8]
        ↓
AGES=4,6,8
```

Do not impose an artificial four-age ceiling in the supplier-facing `AGES`
serialization if the canonical composition contains more ages.

If another genuine supplier endpoint has a separate documented limitation,
keep that limitation local to that endpoint and do not generalize it.

---

# 8. REQUEST / TRAVELER RELATION

Do NOT implement a new universal DOB → supplier-price engine.

The confirmed architecture is:

```text
Traveler / search input
        ↓
canonical passenger composition
        ↓
supplier-specific mapper
        ↓
supplier request
        ↓
supplier authoritative price
```

RequestTraveler DOB may later be used to validate or reconcile composition,
but this implementation must not turn DOB directly into a TravelHUB supplier
pricing formula.

Do not change the existing Request/Order lifecycle.

---

# 9. FLIGHT DOMAIN — F1 CONFIRMED DECISION

The owner decision is:

```text
F1 = CARRY CHILD AGES
```

Therefore flight domain should carry:

```text
childAges[]
```

as a data/transport field.

Rules:

- no supplier-price calculation in TravelHUB;
- pass child ages only to a flight supplier whose contract supports them;
- no universal DOB → age-category rule across all flight suppliers;
- AZAL DOB mapping is NOT confirmed by this decision;
- the existing AZAL-scoped rule `<2 infant / 2–11 child / 12+ adult`
  must not be generalized to all flight suppliers;
- do not change AZAL `childrenDatesOfBirth` behavior until its supplier
  contract is separately confirmed.

The flight change is a transport/data change, not a pricing-engine change.

---

# 10. PRICE AUTHORITY — NON-NEGOTIABLE

The implementation must preserve:

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
```

TravelHUB must NOT:

- calculate Summer price by age;
- calculate Anex price by age;
- calculate Kompas price by age;
- calculate KazUnion price by age;
- replace supplier price with a locally calculated price;
- apply Markup twice.

---

# 11. TEST REQUIREMENTS

Add/update tests proving the supplier-facing mappings.

## Summer

At minimum:

```text
adults = 2
children = 3
childAges = [2, 6, 12]

expect:
ADULT=2
CHILD=3
AGES=2,6,12
```

Also verify that active XHR does NOT emit the old lost-age behavior.

## Anex Tours

```text
adults = 2
children = 3
childAges = [1, 6, 13]

expect:
ADULT=2
CHILD=3
AGES=1,6,13
```

Prove that only-first-child truncation is gone.

## Kompas

```text
adults = 2
children = 3
childAges = [1, 6, 7]

expect:
ADULT=2
CHILD=3
AGES=1,6,7
```

## KazUnion

```text
adults = 2
children = 3
childAges = [4, 6, 8]

expect:
ADULT=2
CHILD=3
AGES=4,6,8
```

## Edge cases

Where supported by existing DTO/adapter contracts, cover:

- zero children;
- one child;
- multiple children;
- preservation of age ordering;
- mismatch between `children` and `childAges.length`;
- refresh/reprice uses the same composition.

Do not invent new business rules for invalid composition. Follow the existing
validation/error conventions of each module.

---

# 12. REGRESSION SAFETY

Before changing code:

1. inspect current dirty worktree;
2. identify existing unrelated changes;
3. do not overwrite or revert unrelated work;
4. isolate changes to passenger composition / supplier mapping scope.

Run:

- targeted supplier unit tests;
- targeted request-traveler/composition tests;
- relevant TypeScript/typecheck;
- relevant E2E tests if available.

If an existing test fails for a pre-existing reason, classify it instead of
weakening the test.

Do not weaken D3 gates.

---

# 13. NO DATABASE REPAIR IN THIS TASK

Do not modify live database data.

Do not create fake traveler data.

Do not rewrite existing Requests or Orders.

Do not change `pinnedRequirements` through a migration or ad-hoc repair as
part of this task.

This task is supplier passenger-parameter transport only.

---

# 14. NO UNRELATED SCOPE

Explicitly exclude:

- payment deadlines;
- payment-time supplier recheck;
- price-change proposal workflow;
- MarkupRule redesign;
- individual discount redesign;
- Request → Order → Booking transitions;
- Booking supplier fulfillment;
- traveler passport UI;
- customer identity;
- WhatsApp;
- supplier catalog redesign;
- schema migration unless strictly proven necessary for F1 transport and
  separately reported.

---

# 15. REQUIRED FINAL REPORT

Return a strict final report containing:

## A. Implementation status

```text
Summer:    PASS / FAIL
Anex:      PASS / FAIL
Kompas:    PASS / FAIL
KazUnion:  PASS / FAIL
Flights:   PASS / FAIL / NOT IMPLEMENTED
```

## B. Exact mapping

Show examples of:

```text
childAges[] → AGES=a,b,c
```

for every changed supplier.

## C. Tests

Report exact:

```text
suite count
passed
failed
typecheck
E2E
```

Do not claim tests were run if they were not.

## D. Scope safety

Confirm:

```text
No price calculation added
No double markup
No lifecycle changes
No payment changes
No live DB repair
No unrelated files intentionally modified
```

## E. Git

Report:

```text
HEAD
working tree status
staged files
commit: NO
push: NO
```

unless the owner separately authorizes commit/push.

---

# 16. FINAL ARCHITECTURAL RESULT

The intended architecture after successful implementation is:

```text
                  CANONICAL COMPOSITION
                         │
          ┌──────────────┼──────────────┐
          │              │              │
       Summer          Anex          Kompas       KazUnion
          │              │              │              │
          └──────────────┴──────────────┴──────────────┘
                         │
                  childAges[]
                         │
                supplier-specific
                     mapping
                         │
                    AGES=a,b,c
                         │
                 supplier request
                         │
              supplier authoritative price
                         │
                 TravelHUB Markup
```

For flights:

```text
flight passengers
      │
      ├── adults
      ├── children
      ├── infants
      └── childAges[]   ← carry as data
             │
             └── supplier-specific mapping only
                 where contract is confirmed
```

The fundamental rule remains:

> TravelHUB transports passenger composition to the supplier; the supplier
> determines the supplier price.
