# M4 PRE-IMPLEMENTATION AUDIT — FULL LOCAL REPOSITORY

## PURPOSE

Perform a **read-only, pre-implementation audit** of the TravelHUB repository before M4.

The local repository is the authoritative source for the audit.

### ABSOLUTE RULES

1. Do NOT modify source code.
2. Do NOT modify Prisma schema or migrations.
3. Do NOT create migrations.
4. Do NOT change configuration or environment files.
5. Do NOT run formatters that modify files.
6. Do NOT commit.
7. Do NOT push.
8. Do NOT implement M4.
9. Do NOT fix discovered issues.
10. Tests may be executed when useful, but must be read-only.
11. Do not assume something exists because architecture documentation describes it. Verify it in code.
12. Do not reopen or redesign completed M3 unless a concrete M4 integration issue is found.

The goal is to establish the **actual current state** and the exact work required for M4.

---

# 1. M4 TARGET TO AUDIT AGAINST

## Identity

**LOGIN = PHONE**, not email.

Conceptually:

```text
User
 ├── loginPhone       ← login identity
 ├── email            ← contact/profile attribute
 ├── passwordHash
 └── customerId
```

Phone must be normalized to **E.164** for identity matching.

## Customer

```text
Customer
 ├── phone
 ├── firstName
 ├── lastName
 └── ...
```

## Boundaries

```text
Customer ≠ User/BUYER ≠ Traveler ≠ Payer
```

Do not collapse these concepts.

A Traveler must not automatically become a User merely because traveler data exists.

---

# 2. THREE CUSTOMER ENTRY SCENARIOS

## A — Registered website

Expected:

```text
Visitor
  ↓
Registration
  ├── country
  ├── phone
  ├── firstName
  ├── lastName
  ├── email
  └── password
  ↓
Customer Resolver
  ↓
Customer
  ↓
User/BUYER (login = phone)
  ↓
search / service / checkout
  ↓
Request → Order → Traveler Data → Booking
```

Existing Customer/User must be reused. No silent duplicate and no silent password reset.

## B — Website guest checkout

Expected:

```text
browse
  ↓
Оформить заказ
  ↓
onboarding
  ├── country
  ├── phone
  ├── firstName
  ├── lastName
  ├── email
  └── password
  ↓
Customer Resolver
  ↓
Customer/User
  ↓
Request → Order
```

Do not require passport/traveler information at initial onboarding unless the existing product flow explicitly requires it.

## C — WhatsApp first contact

Expected:

```text
WhatsApp message
  ↓
phone known
  ↓
Customer Resolver
  ↓
existing Customer?
 ├─ yes → verify FIO / reuse
 └─ no  → collect FIO/email/etc.
            ↓
         re-check identity
            ↓
         Customer/User
            ↓
         secure activation
```

Do not force a WhatsApp-first customer into website registration merely to create a Customer.

Preferred activation is a secure activation link. Future OTP must remain architecturally possible.

---

# 3. CUSTOMER RESOLVER

Audit whether a reusable, channel-independent resolver exists.

Expected logic:

```text
normalize phone → E.164
        ↓
search Customer by phone
        ↓
0 matches → candidate/new
1 match   → MATCHED
>1        → AMBIGUOUS
```

Rules:

- Phone = strong identifier.
- FIO = verification/candidate signal.
- Same FIO with different phones must not be silently merged.
- Duplicate Customer records must not be silently created.
- AMBIGUOUS requires explicit operator resolution.
- Resolver should serve website registration, guest checkout, WhatsApp and future social channels.

Do not assume M3 WhatsApp matching automatically equals the complete M4 resolver. Verify it.

---

# 4. M3 FREEZE / NON-REGRESSION

M3 is treated as completed/frozen.

Audit integration points only.

Do not redesign M3.

M3 includes:

- Baileys provider;
- QR/session connection;
- inbound processing;
- conversations;
- matching states;
- outbound messages;
- deduplication;
- STOP/suppression;
- Communication history;
- RBAC/audit;
- real WhatsApp connection and real outbound smoke.

For each M3 integration point report:

```text
M3 component
→ M4 integration point
→ required change, if any
```

---

# 5. BACKEND / PRISMA AUDIT

Inspect the actual repository and report current state of:

- User
- Customer
- Traveler
- Passenger
- Order
- Request
- Booking
- relevant WhatsApp models
- communication models
- audit/auth/session models

For each relevant model document fields, nullability, uniqueness, indexes, relations, enums and relevant migrations.

### User

Determine:

- Is email unique?
- Is phone present?
- Is phone unique?
- Is there a separate login field?
- What is currently used as login identity?
- Is customerId present?
- Can multiple Users point to one Customer?
- Can a User exist without Customer?

### Customer

Determine:

- phone type;
- nullable/non-nullable;
- unique/indexed;
- normalization;
- duplicate risk.

Do not change data.

---

# 6. AUTHENTICATION AUDIT

Trace the real flow end-to-end:

- registration;
- login;
- auth service;
- password hashing;
- JWT/session;
- refresh tokens;
- guards/decorators;
- current-user resolution;
- password reset;
- activation;
- email verification;
- phone verification;
- frontend auth client;
- auth storage;
- logout;
- session invalidation.

Explicitly answer:

```text
CURRENT LOGIN IDENTIFIER = ?
```

Search the entire repository for assumptions equivalent to:

```text
email = login
```

Report every relevant location, not only auth.service.

---

# 7. REGISTRATION AUDIT

Inspect real frontend registration and backend endpoint.

Document:

- fields;
- validation;
- API payload;
- DTO;
- database writes;
- Customer creation;
- User creation;
- duplicate handling;
- errors;
- redirects;
- localization.

Determine whether country + phone can currently be collected and whether email is mandatory.

Do not modify anything.

---

# 8. CUSTOMER CREATION MATRIX

Find every place that creates or can create Customer.

Search for equivalents of:

```text
customer.create
customer.upsert
createCustomer
CustomerService
customerId
```

Build:

| Location | Trigger | Existing lookup | Duplicate protection | Creates User | Creates Customer |
|---|---|---|---|---|---|

Include:

- registration;
- checkout;
- guest checkout;
- WhatsApp;
- admin/operator flows;
- imports/seeds if relevant;
- tests.

Goal: discover every duplicate-creation path.

---

# 9. REQUEST / ORDER / BOOKING

Trace:

```text
Customer → Request → Order → Booking
```

Verify:

- how customerId is assigned;
- whether phone is incorrectly used as commerce owner;
- guest checkout;
- User requirements;
- Customer continuity;
- communication continuity.

Report any place where business ownership is coupled to email/User instead of Customer.

---

# 10. TRAVELER / PASSENGER / PAYER

Verify:

```text
Customer ≠ Traveler
Customer ≠ Payer
User ≠ Traveler
```

Inspect:

- OrderTraveler;
- Passenger;
- traveler collection;
- booking confirmation;
- traveler requirements;
- checkout traveler fields;
- automatic User/Customer creation from Traveler.

Report violations. Do not redesign this architecture.

---

# 11. WHATSAPP M3 INTEGRATION

Inspect actual M3 implementation:

- inbound matching;
- Customer resolution;
- AMBIGUOUS;
- manual link;
- matched customer;
- conversation;
- outbound;
- Communication history;
- audit;
- RBAC.

Answer:

**Can M4 introduce one common Customer Resolver without duplicating WhatsApp matching logic?**

If no, explain exactly why.

If yes, identify the clean integration boundary.

Do not modify code.

---

# 12. FRONTEND AUDIT

Inspect actual routes/components for:

- registration;
- login;
- account;
- checkout;
- guest checkout;
- customer profile;
- traveler collection;
- WhatsApp;
- settings;
- communication.

Document:

```text
Route
Component
API
Current identity assumptions
M4 impact
```

Search for email login forms, email user lookup, phone inputs, customer lookup and auth-context assumptions.

---

# 13. SECURITY AUDIT

Review:

## Phone identity

- normalization;
- uniqueness;
- enumeration;
- verification;
- race conditions;
- duplicate account creation.

## Activation

- activation token;
- expiration;
- single use;
- storage;
- hashing where applicable;
- audit;
- session behavior.

## Password

- hashing;
- reset;
- temporary credentials;
- forced replacement if temporary credentials exist.

## Phone change

Determine whether supported. If not, document preparation required:

```text
current auth
→ new phone verification
→ uniqueness check
→ update identity
→ session/token invalidation
→ audit
```

Do not implement.

---

# 14. DATA / MIGRATION AUDIT

Inspect actual migrations and schema.

Determine:

- whether existing Users can be migrated safely;
- whether duplicate phones exist;
- whether email-only accounts exist;
- whether Customer.phone is nullable;
- whether existing phone values are raw/un-normalized;
- whether uniqueness can safely be added;
- whether normalization/backfill is required;
- legacy handling.

If production data cannot be inspected, explicitly state:

```text
DATASET NOT VERIFIED
```

Do not invent data.

---

# 15. TEST AUDIT

Inspect and, where useful, run existing read-only tests for:

- auth;
- registration;
- login;
- customer;
- checkout;
- Request;
- Order;
- Booking;
- traveler;
- WhatsApp;
- communication;
- RBAC.

Report:

| Suite | Result | Relevant to M4? | Known pre-existing failure? |
|---|---|---|---|

Do not fix tests.

---

# 16. DOCUMENTATION VS CODE

Compare architecture documents with actual code.

For every important discrepancy:

```text
DOCUMENT SAYS
CODE DOES
CONCLUSION
```

Repository is authoritative for CURRENT STATE.

Architecture is authoritative for INTENDED TARGET where explicitly stated.

Do not silently reconcile discrepancies.

---

# 17. REQUIRED FINAL REPORT

Create:

```text
M4-PRE-IMPLEMENTATION-AUDIT.md
```

Required structure:

# M4 PRE-IMPLEMENTATION AUDIT

## 1. Executive Summary
## 2. Repository / Commit / Branch
## 3. Current Identity Architecture
## 4. Current Authentication
## 5. Current Registration
## 6. Customer Creation Matrix
## 7. Request / Order / Booking
## 8. Traveler / Passenger / Payer
## 9. WhatsApp M3 Integration
## 10. Frontend Identity Flows
## 11. Database / Prisma / Migration State
## 12. Security
## 13. Test State
## 14. Documentation vs Code Discrepancies
## 15. M4 Gaps
## 16. M3 Freeze / Non-Regression List
## 17. M4 Implementation Dependencies
## 18. Migration Risks
## 19. Recommended M4 Implementation Sequence
## 20. FINAL VERDICT

For gaps use:

| Area | Current State | Gap | Risk | Required Change |
|---|---|---|---|---|

Final verdict must be exactly one:

```text
READY
READY WITH REQUIRED CHANGES
BLOCKED
```

Explain why.

---

# 18. EVIDENCE STANDARD

Every important conclusion must include evidence:

```text
file path
symbol/class/function
line range if available
```

Do not write vague claims such as "the project probably uses email."

Show the actual location.

---

# 19. FINAL OUTPUT

Return:

1. `M4-PRE-IMPLEMENTATION-AUDIT.md`
2. concise executive summary;
3. final verdict;
4. blockers;
5. required M4 changes;
6. things already correct and therefore must not be touched.

### FINAL RULE

This is **AUDIT ONLY**.

No implementation.
No source changes.
No schema changes.
No migrations.
No fixes.
No refactoring.
No commit.
No push.

Stop after producing the audit report.
