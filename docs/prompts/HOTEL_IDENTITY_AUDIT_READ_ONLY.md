# HOTEL IDENTITY AUDIT
## hotelExternalId ↔ hotelKey — STRICT READ-ONLY ARCHITECTURE AUDIT

### STATUS

AUDIT ONLY.

This task is strictly READ-ONLY.

DO NOT modify source code.
DO NOT modify Prisma schema.
DO NOT modify database data.
DO NOT create migrations.
DO NOT run UPDATE / INSERT / DELETE.
DO NOT change tests.
DO NOT commit.
DO NOT push.
DO NOT reformat files.
DO NOT fix anything discovered during the audit.

The purpose is to establish the real architectural meaning and lifecycle of:
- `hotelExternalId`
- `hotelKey`

before any implementation decision is made.

---

# 1. PRIMARY QUESTION

Determine with repository evidence:

> What is the actual architectural purpose of `hotelExternalId`, where is it required, where is it transformed, and how does it relate to `hotelKey`?

The report MUST answer:
1. Why does `hotelExternalId` exist?
2. Why does `hotelKey` exist?
3. Are they semantically identical or only currently equal?
4. Which layer owns each identifier?
5. Which identifier should be stored in Product?
6. Which identifier should be used for supplier API calls?
7. Which identifier should Request DTOs accept?
8. Where should mapping occur?
9. Can either field safely be removed?
10. Can either be renamed?
11. Are there suppliers where they differ?
12. What is the minimal safe fix for the current Request→Product mismatch?

Do not answer from assumptions. Cite exact files/lines or concrete runtime evidence.

---

# 2. KNOWN CONTEXT TO VERIFY

Observed:
```text
Request:
  hotelExternalId = "1144"

Product:
  attributes.hotelKey = "1144"
  attributes.hotelExternalId = absent
```

The current `tour-request.service` appears to look up:
```ts
attributes: {
  path: ["hotelExternalId"],
  equals: dto.hotelExternalId
}
```

Catalog synchronization appears to persist:
```ts
attributes: {
  hotelKey: ...
}
```

Previous read-only investigation found approximately:
```text
Tour Products total: 3010
KAZUNION   2677 → hotelKey
KOMPAS       22 → hotelKey
SUMMERTOUR  310 → hotelKey
hotelExternalId in Products: 0
```

These facts MUST be independently verified where possible.

Do NOT infer from these facts that either identifier is obsolete.

---

# 3. SUPPLIERS IN SCOPE

Audit separately:
- SUMMERTOUR
- KOMPAS
- KAZUNION
- ANEX

For ANEX distinguish:
- tour flow
- hotel flow

If another supplier uses either identifier, include it.

---

# 4. REPOSITORY-WIDE SEARCH

Search all occurrences of:
```text
hotelExternalId
hotelKey
```

Also search:
```text
hotelExternalID
externalHotelId
externalHotelID
hotel_id
hotelId
```

Inspect:
- backend
- frontend
- Prisma schema
- DTOs
- services
- adapters
- sync services
- controllers
- repositories
- mappers
- serializers
- API clients
- tests
- fixtures
- seeds
- documentation
- configuration
- supplier integrations

Do not stop at the first match.

---

# 5. COMPLETE DATA-FLOW TRACE

For every relevant supplier reconstruct:

```text
Supplier API
  ↓
supplier response
  ↓
adapter
  ↓
normalization
  ↓
sync/catalog
  ↓
Product.attributes
  ↓
frontend Product
  ↓
OfferModal / selection
  ↓
Request DTO
  ↓
tour-request.service
  ↓
Product lookup
  ↓
Request snapshot
  ↓
Order
  ↓
Booking
  ↓
supplier operation
```

For each stage state which identifier is present and why.

---

# 6. hotelExternalId AUDIT

Determine:

### 6.1 Origin
Where is it first created?
- supplier API
- frontend
- database
- adapter
- DTO
- derived/mapped value

Give exact file/line evidence.

### 6.2 Transport
Trace:
- frontend → backend
- DTO → service
- service → adapter
- adapter → supplier API

### 6.3 Persistence
Check:
- Product
- Request
- Request snapshot
- Order
- OrderItem
- Booking
- supplier-specific records
- JSON attributes

If not persisted, explicitly state that.

### 6.4 Runtime usage
Classify meaningful uses:
- SEARCH
- AVAILABILITY
- PRICE
- REFRESH
- BOOKING
- CANCELLATION
- SYNC
- REQUEST
- ORDER
- UI
- IDENTITY/MAPPING
- OTHER

Ignore comments/dead code as runtime usage.

---

# 7. hotelKey AUDIT

Perform the same investigation for `hotelKey`.

Determine:
- origin
- creator
- writer
- persistence
- readers
- supplier-specific semantics
- Product identity role
- API usage
- synchronization
- deduplication
- upsert/update usage

---

# 8. SUPPLIER MATRIX

Produce:

| Supplier | Identifier | Source | Adapter mapping | Product storage | Runtime usage | Meaning |
|---|---|---|---|---|---|---|
| SUMMERTOUR | hotelExternalId | | | | | |
| SUMMERTOUR | hotelKey | | | | | |
| KOMPAS | hotelExternalId | | | | | |
| KOMPAS | hotelKey | | | | | |
| KAZUNION | hotelExternalId | | | | | |
| KAZUNION | hotelKey | | | | | |
| ANEX tours | hotelExternalId | | | | | |
| ANEX tours | hotelKey | | | | | |
| ANEX hotels | hotelExternalId | | | | | |
| ANEX hotels | hotelKey | | | | | |

If absent, write `NOT FOUND`. Do not infer.

---

# 9. VALUE-EQUALITY AUDIT

Determine whether:
```text
hotelExternalId == hotelKey
```
is:
- guaranteed by architecture
- currently true only for existing data
- true because adapters currently map one directly to the other
- not generally true
- unknown

Important:
```ts
hotelKey: query.hotelExternalId
```
proves a mapping, not identical semantics.

Search for evidence of suppliers where values can differ.

---

# 10. FUTURE-BREAKING ASSUMPTIONS

Find code assuming:
```text
hotelExternalId === hotelKey
hotelKey is always external ID
hotelExternalId is always Product identity
```

Classify each assumption:
- SAFE
- QUESTIONABLE
- DANGEROUS

Explain.

---

# 11. REQUEST FLOW AUDIT

Inspect:
- OfferModal
- Request DTO
- tour-request.service
- Request creation
- Request snapshot
- availableActions
- Request → Order conversion

Determine:
1. What does frontend send?
2. What does backend expect?
3. What does Product lookup use?
4. What enters the Request snapshot?
5. Does conversion require Product?
6. Is `productId = NULL` valid for manual/Live Sales?
7. Does projection incorrectly treat `productId = NULL` as invalid?

Do NOT fix anything.

---

# 12. MANUAL / LIVE SALES REQUIREMENT

Preserve this business rule:

Customers can buy via:
- WhatsApp
- phone
- office
- chat

Managers may assemble offers from supplier services that do not exist in the TravelHUB catalog.

Therefore:
```text
productId = NULL
```
can be valid.

Distinguish:

Catalog Request:
```text
Product exists
productId != NULL
```

Manual / Live Sales Request:
```text
Product may not exist
productId = NULL is valid
supplier/service snapshot required
```

Do NOT recommend making Product mandatory merely to solve this hotel linkage issue.

---

# 13. TEST AUDIT

Inspect tests involving:
- hotelExternalId
- hotelKey
- tour-request
- Product lookup
- SUMMERTOUR
- KOMPAS
- KAZUNION

Determine whether mocks reflect production.

Pay special attention to mocks such as:
```ts
attributes: {
  hotelExternalId: ...
}
```
when real Products contain:
```ts
attributes: {
  hotelKey: ...
}
```

Identify tests that can pass while production fails.

Do NOT modify tests.

---

# 14. DATABASE AUDIT

READ ONLY.

Inspect Product data and determine:
- total tour Products
- per supplier
- hotelKey populated
- hotelExternalId populated
- both populated
- neither populated

Where both exist, compare values.

Do not mutate data.

---

# 15. STRICTLY FORBIDDEN

Do not:
- edit code
- edit schema
- edit DTOs
- edit tests
- edit Product data
- migrate/backfill
- rename/delete fields
- change frontend
- change adapters
- commit
- push

This is investigation only.

---

# 16. DO NOT PRESELECT A FIX

Do not assume:
- replace `hotelExternalId` with `hotelKey`
- rename `hotelKey`
- store both in Product
- remove `hotelExternalId`

Determine the architecture first.

---

# 17. REQUIRED FINAL REPORT

Return exactly these sections:

# HOTEL IDENTITY AUDIT REPORT

## 1. Executive Verdict

Choose one:
- KEEP BOTH — DIFFERENT SEMANTICS
- KEEP BOTH — CURRENTLY SAME VALUE
- HOTEL_EXTERNAL_ID IS TRANSPORT-ONLY
- HOTEL_KEY IS REDUNDANT
- UNRESOLVED — MORE EVIDENCE REQUIRED

Explain with evidence.

## 2. hotelExternalId — Actual Purpose

Cover:
- origin
- owner
- consumers
- persistence
- API usage
- lifecycle

## 3. hotelKey — Actual Purpose

Cover:
- origin
- owner
- consumers
- persistence
- API usage
- lifecycle

## 4. Relationship

Explicitly answer:
```text
hotelExternalId == hotelKey ?
```
with:
- YES BY CONTRACT
- YES CURRENTLY
- NO
- DEPENDS ON SUPPLIER
- UNKNOWN

Explain.

## 5. Supplier Matrix

Provide the complete table.

## 6. Product Data Reality

Provide actual database counts.

## 7. Request Flow

Show:
```text
Frontend
→ DTO
→ Service
→ Adapter
→ Product
→ Request
```
with the identifier at every step.

## 8. Test Reliability

Identify production-accurate tests and unrealistic mocks.

## 9. Current Defect

Explain why:
```text
Request.hotelExternalId
```
currently fails or succeeds when resolving:
```text
Product
```
Do not fix it.

## 10. Risks

Assess what could break if:
- hotelExternalId removed
- hotelKey removed
- hotelExternalId renamed
- hotelKey renamed
- both merged
- Product lookup changed

## 11. Safe Architecture Options

Give 2–4 options. For each:
- option
- advantages
- risks
- affected layers
- migration required?
- backward compatibility
- recommendation

## 12. RECOMMENDED ARCHITECTURE

Based strictly on evidence, answer:
- Where does hotelExternalId live?
- Where does hotelKey live?
- Where does mapping happen?
- What does Request receive?
- What does Product store?
- What does supplier API receive?

## 13. MINIMAL SAFE FIX

Describe the smallest implementation change that fixes the Request→Product problem WITHOUT deleting or redefining either identifier.

Do not implement it.

## 14. Data Migration Requirement

Answer:
```text
YES / NO / UNKNOWN
```
Explain.

## 15. Implementation Scope

List exact files/modules that WOULD need modification later.

Do not modify them now.

## 16. Regression Test Plan

Define future tests for:
- SUMMERTOUR
- KOMPAS
- KAZUNION
- ANEX
- catalog request
- manual request
- product-less request
- request → order
- supplier API calls

Do not modify tests.

---

# 18. FINAL SAFETY CHECK

Explicitly confirm:

```text
Code changed: NO
Database changed: NO
Schema changed: NO
Tests changed: NO
Migration created: NO
Commit created: NO
Push performed: NO
```

If any accidental modification occurred, STOP and report it immediately.

---

# FINAL PRINCIPLE

Answer:

> "Why do we have hotelExternalId if Product already has hotelKey?"

before answering:

> "Which one should we use?"

Do not collapse identifiers merely because their current values happen to match.

The goal is to discover the canonical identity contract first, then make the smallest safe correction.
