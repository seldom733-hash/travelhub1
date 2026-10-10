# TRAVELHUB — TRAVELER DATA TWO-STAGE MODEL + FIX B

## Owner decision

Traveler data is collected in two stages.

**Request** collects the minimum data required to determine traveler composition, age categories and supplier price:
- firstName
- lastName
- birthDate

**Order** inherits these fields and expands each Traveler with:
- passportSeries
- passportNumber
- citizenship
- passportExpiry

Do not implement the previous FIX B model where passport fields were `NOT_REQUESTED`.

## 1. Request stage

For every traveler:

```text
firstName  REQUIRED
lastName   REQUIRED
birthDate  REQUIRED
```

These values participate in:
- traveler count;
- adult/child/other supplier-specific age classification;
- supplier/product pricing;
- commercial snapshot.

Reuse existing supplier/product age rules. Do not invent a global rule if supplier-specific rules already exist.

## 2. Order stage

Order preserves the Request traveler data and adds:

```text
firstName       REQUIRED
lastName        REQUIRED
birthDate       REQUIRED
passportSeries  REQUIRED
passportNumber  REQUIRED
citizenship     REQUIRED
passportExpiry  REQUIRED
```

Do not create a duplicate Traveler domain. Reuse the existing Traveler model/API where possible.

Passport data belong to Traveler, not Customer.

## 3. Data flow

```text
REQUEST
  FIO + birthDate
       ↓
traveler composition
       ↓
supplier price
       ↓
ORDER
  FIO + birthDate
  + passport series
  + passport number
  + citizenship
  + passport expiry
       ↓
BOOKING
       ↓
SUPPLIER
```

The original Request data must never disappear when Order is created.

## 4. Passport expiry

`passportExpiry` is required Order data.

The system must detect at least:

```text
passportExpiry < tripEndDate
```

and show a clear warning/block.

However, do not hard-code this as the universal legal rule. The architecture must allow destination/service/supplier-specific document requirements.

Conceptually:

```text
passport data
   ↓
destination/service/supplier requirements
   ↓
document validation
   ↓
OK / WARNING / BLOCK / MANUAL_REVIEW
```

Validation should be possible:
1. when document data are entered/changed;
2. before final confirmation;
3. before Booking/supplier submission.

Do not weaken existing D3 gates.

## 5. FIX B legacy repair

The current problem is stale pre-FIX-A offer-shaped `pinnedRequirements`.

For an eligible TOUR Request, canonical traveler requirements are:

```text
firstName  REQUIRED
lastName   REQUIRED
birthDate  REQUIRED
```

For the Order traveler requirements are:

```text
firstName       REQUIRED
lastName        REQUIRED
birthDate       REQUIRED
passportSeries  REQUIRED
passportNumber  REQUIRED
citizenship     REQUIRED
passportExpiry  REQUIRED
```

Use the existing project `TravelerRequirements` / `TravelerFullRequirements` type if present.

Old offer facts must not be lost. Facts such as nights, adults, children, country, departure city, supplier code, external offer ID, hotel external ID, room, meal and dates must be preserved in the existing `productSnapshot.offer` structure.

Repair sequence:

```text
old pinnedRequirements
 ├─ traveler requirements → canonical traveler requirements
 └─ offer facts → productSnapshot.offer
```

## 6. Approved live records

Only verify and potentially repair these records:

```text
Order:
TH-2026-000101

Requests:
MKT-REQ-00000402
MKT-REQ-00000301
MKT-REQ-00000401
```

Before every mutation:
1. read;
2. verify existence/type/status/old shape;
3. preserve pre-update value through existing audit/history if available;
4. perform minimal update;
5. reread;
6. compare before/after.

If a record is missing or unexpected, skip it and report why.

No broad backfill.

## 7. Do not change

Do not:
- change lifecycle statuses;
- create another Request or Order;
- create Booking;
- change payments;
- change customer identity;
- modify unrelated traveler PII;
- weaken D3;
- introduce unrelated schema changes;
- commit or push.

## 8. First: read-only audit

Before implementation, inspect:
- existing Traveler model/Prisma fields;
- Request traveler API;
- Order traveler API;
- Request→Order copy logic;
- completeness calculation;
- TravelerCollectionPanel;
- TravelerRequirements/TravelerFullRequirements;
- D3 final-confirmation gate;
- Booking payload/consumer;
- supplier submission path;
- productSnapshot structure;
- any existing passport/document fields.

Reuse existing structures. Do not create duplicates.

## 9. Required UX

### Request

```text
Traveler 1
[ First name ]
[ Last name ]
[ Birth date ]

Traveler 2
[ First name ]
[ Last name ]
[ Birth date ]
```

### Order

```text
Traveler 1

First name       [________]
Last name        [________]
Birth date       [__.__.____]

Passport series  [________]
Passport number  [________]
Citizenship      [________]
Passport expiry  [__.__.____]

[ Save ]
```

The same structure applies to every traveler.

## 10. Completeness

Request completion and Order traveler completion are different.

Order completion requires all seven required fields above.

Do not mark an Order traveler complete merely because Request-stage fields are complete.

## 11. Tests

Add/update focused tests proving:
1. adult + child traveler composition is preserved;
2. birth dates feed the existing supplier/product classification;
3. commercial calculation receives correct traveler composition;
4. Request→Order preserves FIO + birthDate;
5. Order accepts document data;
6. Order completeness requires document fields;
7. expired document is detected for an obviously invalid trip;
8. commercial snapshot is preserved;
9. no duplicate Request/Order is created;
10. existing Booking flow receives complete traveler data.

Do not rewrite unrelated tests.

## 12. Browser verification

After implementation and controlled repair, verify:

```text
http://localhost:3000/app/orders/36e031c0-8a66-498b-9dac-b7ba89122076
```

Each traveler must show:
- first name;
- last name;
- birth date;
- passport series;
- passport number;
- citizenship;
- passport expiry.

Verify real inputs, Save behavior, completeness and document warning/block behavior.

Use synthetic test data only. Do not enter real passport data.

## 13. Final report

Report:
- read-only architecture findings;
- exact Traveler fields used;
- Request pricing/traveler-composition behavior;
- Order expansion behavior;
- passport validation behavior;
- exact live records repaired;
- tests and typechecks;
- browser result;
- safety confirmation;
- remaining genuine gaps.

### Final owner model

```text
REQUEST
  └─ firstName + lastName + birthDate
       ↓
  traveler composition
       ↓
  supplier pricing
       ↓
ORDER
  └─ inherited data
     + passportSeries
     + passportNumber
     + citizenship
     + passportExpiry
       ↓
BOOKING
       ↓
SUPPLIER
```

Implement this two-stage model. Do not replace it with a single generic traveler form.
