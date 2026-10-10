# TRAVELHUB — FIX B — LIVE DATA REPAIR OF PRE-FIX-A TRAVELER REQUIREMENTS

## STATUS

**Action:** controlled live-data repair only.  
**Purpose:** repair stale pre-FIX-A `pinnedRequirements` so the existing Traveler Data UI receives the canonical TOUR traveler-requirements shape.

FIX A is already implemented and verified. This task is **not** a new FIX A implementation.

The post-FIX-A browser audit established that the current live Order still contains the old offer-shaped `pinnedRequirements`, causing `fieldsFor=[]` and zero traveler input fields. The smallest safe correction is data repair, not a frontend fallback.

## 1. MANDATORY SAFETY RULE

Before any `UPDATE`, perform a read-only verification of every target record.

If a target record:
- does not exist;
- has an unexpected status;
- has an unexpected service/product type;
- does not contain the stale offer-shaped `pinnedRequirements`;
- or otherwise does not match the expected repair boundary;

**STOP for that record and report it. Do not guess.**

Do not perform a broad/table-wide update.

Do not repair unrelated requests/orders.

## 2. OWNER-APPROVED TARGET SET

Check these records individually:

- Order: `TH-2026-000101`
- Request: `MKT-REQ-00000402`
- Request: `MKT-REQ-00000301`
- Request: `MKT-REQ-00000401`

The latest browser audit explicitly confirmed the Order/request chain around `TH-2026-000101` / `MKT-REQ-00000402`.

The other IDs must be verified before touching them. If they are absent from the active DB or do not match the expected repair condition, skip them and report why.

**Do not extend the target list automatically.**

## 3. EXACT CANONICAL TOUR REQUIREMENTS

For an eligible TOUR record, use the project's existing canonical `TravelerFullRequirements` representation, equivalent to:

```json
{
  "firstName": "REQUIRED",
  "lastName": "REQUIRED",
  "birthDate": "OPTIONAL",
  "citizenship": "NOT_REQUESTED",
  "gender": "NOT_REQUESTED",
  "passportNumber": "NOT_REQUESTED",
  "passportExpiry": "NOT_REQUESTED"
}
```

Do not invent another schema.

## 4. PRESERVE COMMERCIAL/OFFER DATA

The repair must NOT destroy or rewrite offer facts.

In particular preserve:
- `productSnapshot`;
- `productSnapshot.offer`;
- supplier information;
- `hotelExternalId`;
- `externalOfferId`;
- dates, nights, travelers, meal, room, country, departure city, supplier code and other offer facts;
- all existing commercial/price snapshots.

If the current data model requires preserving the previous JSON for audit/history, use the project's existing audit/history mechanism.

**Do not invent a new audit table or schema.**

## 5. DO NOT CHANGE

This repair must NOT change:
- Request status;
- Order status;
- customer identity / `customerId`;
- traveler PII;
- traveler records;
- traveler count;
- `productId`;
- `productSnapshot.offer`;
- commercial snapshot;
- accepted price/currency;
- supplier or supplier external IDs;
- final confirmation;
- payment state;
- Booking state;
- Booking creation;
- D3 rules;
- `TravelerCollectionPanel`;
- API contracts;
- Prisma schema;
- migrations.

Do not call final confirm, confirm, send, or booking creation.  
Do not perform a lifecycle transition.

This is a **data-shape repair only**.

## 6. TRANSACTION / UPDATE RULE

For each eligible record:

1. Read the current row.
2. Record the exact pre-update `pinnedRequirements`.
3. Verify eligibility.
4. Update only `pinnedRequirements`.
5. Read the row again.
6. Verify the stored value exactly matches canonical TOUR requirements.
7. Verify `productSnapshot.offer` and commercial facts remain unchanged.
8. Verify status and identity fields remain unchanged.

Use the existing atomic service/repository mechanism where available.

If an update fails validation, rollback that record and report it.

## 7. ORDER / REQUEST CONSISTENCY

For `TH-2026-000101` and its upstream Request:

- determine the authoritative source for traveler requirements;
- repair the Request first if required by the current domain flow;
- then repair the copied Order value if it remains stale;
- ensure both contain the canonical traveler-requirements shape;
- do not create a second Request or Order.

Expected relationship:

```text
MKT-REQ-00000402
        ↓
TH-2026-000101
```

## 8. NO BULK BACKFILL

Do NOT execute a generic bulk update.

Do NOT mutate all Orders/Requests.

Only the explicitly listed IDs may be mutated, and only after per-record verification.

## 9. POST-REPAIR VERIFICATION

### API

For every repaired Request/Order:
- GET traveler requirements;
- confirm canonical requirements are returned;
- confirm traveler count remains correct;
- confirm `canEdit`/lock state is unchanged.

### Browser

Re-open:

```text
http://localhost:3000/app/orders/36e031c0-8a66-498b-9dac-b7ba89122076
```

Verify:
- Order remains `TH-2026-000101`;
- `ДАННЫЕ ТУРИСТОВ` is visible;
- `Турист 1 из 2` and `Турист 2 из 2` are visible;
- actual traveler input fields are rendered;
- `fieldsFor=[]` is no longer the cause of zero inputs;
- Save buttons remain available;
- final confirmation remains governed by existing D3 rules.

**Do not enter or save real traveler PII.**

## 10. REGRESSION CHECK

Run the existing focused traveler tests and relevant backend typecheck.

Do not modify tests merely to make them pass.

Classify unrelated/pre-existing failures separately.

## 11. GIT RULE

Do **NOT**:
- commit;
- push;
- reset unrelated work;
- clean unrelated dirty files;
- revert unrelated changes.

## 12. REQUIRED FINAL REPORT

Return:

### A. Target verification
For each of the four IDs:
- exists: YES/NO
- eligible: YES/NO
- reason if skipped

### B. Repairs
- records repaired;
- exact fields changed;
- old/new shape summary;
- confirmation that commercial/offer data was preserved.

### C. Safety
- statuses unchanged;
- customer/traveler PII unchanged;
- no Booking created;
- no lifecycle transition executed;
- no schema/migration changes.

### D. Verification
- API result;
- browser result;
- focused tests;
- typecheck.

### E. Git
- commit: NO
- push: NO

If the browser still shows no traveler fields after a successful data repair, **STOP** and report the exact API payload and UI behavior. Do not introduce a frontend fallback without a separate owner decision.
