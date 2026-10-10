# TRAVELHUB — Supplier Passenger Parameters Owner Decision Closure

Date: 2026-10-08
Source prompt: `TRAVELHUB_SUPPLIER_PASSENGER_PARAMETERS_OWNER_DECISION_CLOSURE_PROMPT.md`
Basis: `TRAVELHUB_SUPPLIER_AUTHORITATIVE_PRICE_CONSISTENCY_READ_ONLY_AUDIT_REPORT.md`
Mode: closure record only — no code, no schema/DB, no price/lifecycle/Markup changes, no commit/push.

## Decisions (owner-confirmed)

```text
S1 — Summer AGE1-3:        S1-C NEED SUPPLIER CONFIRMATION
A1 — Anex Tours ages:      A1-C NEED SUPPLIER CONFIRMATION
F1 — Flight child ages:    F1-B CARRY CHILD AGES
```

### S1 — Summer AGE1-3 = `NEED SUPPLIER CONFIRMATION`

- Owner has NOT confirmed that active `search_tour` XHR receives `AGE1/AGE2/AGE3`.
- Consequence: **code unchanged** — active XHR serializer keeps ADULT/CHILD only; `buildSummerSearchRequest` AGE1-3 build stays as-is (internal only); refreshPrice unchanged.
- Do not treat TravelHUB's internal AGE1-3 construction as supplier contract.
- Revisit only on explicit supplier/owner confirmation (then: serializer fix + refreshPrice + regression tests).

### A1 — Anex Tours ages = `NEED SUPPLIER CONFIRMATION`

- Owner has NOT confirmed the multi-child `AGES` format.
- Consequence: **mapper unchanged** — `AGES=childAges[0]` (`anex.adapter.ts:272`) stays; no `AGES=5,8,12` or any separator/encoding introduced; no TravelHUB pricing compensation for the truncation.
- Revisit only with the exact supplier format (separator/encoding) from supplier/owner.

### F1 — Flight child ages = `CARRY CHILD AGES`

- Owner decision: extend flight domain with `childAges` as **data/transport field only**.
- Rules:
  - no price calculation in TravelHUB (price authority chain unchanged, §4 of closure prompt);
  - pass ages only to suppliers that support them — AZAL DOB mapping requires its own confirmation (NOT granted by this decision; F1-C was not chosen);
  - no universal age-category rule across flight suppliers;
  - existing owner rule `<2 infant / 2–11 child / 12+ adult` remains AZAL-scoped business rule, applied only where a confirmed contract exists — currently NOT applied (AZAL `childrenDatesOfBirth: null` unchanged until AZAL contract confirmation);
  - authority for DOB → category: to be defined per supplier contract in the implementation prompt; universal rule prohibited.

## Closure criteria check

```text
S1 = NEED SUPPLIER CONFIRMATION   (not fully closed → blocker)
A1 = NEED SUPPLIER CONFIRMATION   (not fully closed → blocker)
F1 = CARRY CHILD AGES             (closed)
```

No `TBD`/`probably`/`assume` used — each value is an explicit owner answer.

## Final output

```text
S1 — Summer AGE1-3:        NEED SUPPLIER CONFIRMATION
A1 — Anex Tours ages:      NEED SUPPLIER CONFIRMATION
F1 — Flight child ages:    CARRY CHILD AGES

READY FOR IMPLEMENTATION: NO
```

Reason: S1 and A1 require supplier confirmation → per closure criteria §6, `READY FOR IMPLEMENTATION: NO`.

## Next steps (per closure prompt §6)

1. Obtain supplier confirmation for S1 (Summer AGE1-3 on active XHR) and A1 (Anex Tours multi-child AGES format).
2. Only then prepare the separate implementation prompt, restricted to:
   - confirmed decisions only (F1 transport field now; S1/A1 mapper fixes only after confirmation);
   - no unconfirmed supplier assumptions;
   - no payment deadline/recheck, Markup redesign, or lifecycle scope;
   - commit/push only on separate permission.
