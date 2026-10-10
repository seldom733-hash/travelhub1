# M4 FINAL IMPLEMENTATION PROMPT — PHONE-FIRST CUSTOMER IDENTITY

## STATUS

M4 architecture decision has been explicitly approved by the project owner.

Source basis:

1. `M3-GATE-REPORT.md` — M3 FINAL PASS.
2. `M4-PRE-IMPLEMENTATION-AUDIT.md` — repository audit.
3. `M4_PRE_CODING_ARCHITECTURE_DECISION.md` — approved architecture decision.

This prompt authorizes implementation of M4.

---

# 0. ABSOLUTE EXECUTION RULES

You have full access to the local TravelHUB repository.

Before changing code, read and use:

- `M3-GATE-REPORT.md`
- `M4-PRE-IMPLEMENTATION-AUDIT.md`
- `M4_PRE_CODING_ARCHITECTURE_DECISION.md`

The repository is authoritative for actual current state.

Do not:

- invent existing functionality;
- assume `/checkout` exists;
- assume activation/OTP infrastructure exists;
- silently preserve email as the new primary identity;
- silently remove legacy username;
- silently weaken `Customer.email` uniqueness;
- create duplicate Customers;
- merge Customers by FIO;
- create Users from Travelers;
- redesign M3;
- change WhatsApp provider/session behavior;
- bypass RBAC/audit;
- commit or push without explicit owner authorization;
- hide failing tests;
- classify a new M4 regression as pre-existing without evidence.

**M3 is frozen.**

Any M3 behavior change requires explicit evidence that it is necessary for M4 and must preserve all existing M3 contracts.

---

# 1. M4 TARGET

The approved target is:

```text
LOGIN = PHONE
```

Phone is the primary authentication identity.

Target:

```text
User
 ├── loginPhone
 ├── email
 ├── passwordHash
 └── customerId
```

Meaning:

```text
loginPhone = authentication identity
email      = contact/profile attribute
```

---

# 2. LEGACY USERNAME STRATEGY

Current repository has:

```text
User.username @unique
```

Do not delete it immediately.

During M4:

```text
loginPhone = new primary identity
username   = legacy compatibility identifier
```

Existing users must remain recoverable.

New users must establish `loginPhone`.

Temporary compatibility may allow legacy username authentication, but it must remain clearly transitional.

Do not turn the system into a permanently ambiguous:

```text
phone OR email OR username
```

identity model.

---

# 3. CUSTOMER IDENTITY

Approved:

```text
PHONE
  ↓
primary Customer identity-resolution input

EMAIL
  ↓
contact/profile attribute
```

For compatibility:

```text
Customer.email @unique
```

may remain.

Do not remove or weaken that constraint in M4 unless the approved architecture is explicitly changed.

---

# 4. ADR UPDATE

The repository contains an older ADR assumption that email is the canonical Customer key.

Create/update the appropriate ADR so the repository explicitly records that the phone-first architecture supersedes that assumption.

It must state:

```text
Phone = primary Customer identity-resolution key
Email = contact attribute
Customer.email uniqueness = retained temporarily for compatibility
```

Do not silently resolve an architectural conflict through implementation.

---

# 5. M4 IMPLEMENTATION PHASES

Implementation must proceed in controlled phases:

```text
M4.0 BASELINE
M4.1 IDENTITY FOUNDATION
M4.2 CUSTOMER RESOLVER
M4.3 PHONE AUTH + REGISTRATION
M4.4 WHATSAPP INTEGRATION
M4.5 GUEST CHECKOUT
M4.6 HARDENING + FINAL GATE
```

Do not jump directly into a monolithic implementation.

Each phase requires:

- implementation;
- focused tests;
- relevant regression;
- documented result.

---

# 6. M4.0 — BASELINE

Before implementation:

1. Verify current branch/HEAD.
2. Verify M3 working-tree state.
3. Confirm the M3 implementation is present.
4. Confirm M3 gate is PASS.
5. Obtain/verify the required owner-authorized baseline commit before stacking M4 changes.

Do not create the baseline commit without explicit owner authorization.

If baseline is already committed, record its exact commit.

Record:

```text
branch
HEAD
working tree
baseline commit
```

---

# 7. M4.1 — IDENTITY FOUNDATION

Implement the minimum schema/auth foundation required for phone-first identity.

Expected direction:

```text
User.loginPhone
```

The exact nullability/uniqueness strategy must be based on the real migration/data state.

Do not blindly execute:

```text
Customer.phone @unique
```

because the audit found existing duplicate/formatting risks.

Use a migration-safe strategy.

Potential design:

```text
Customer.phone
Customer.phoneCanonical
appropriate index/constraint
```

Choose based on actual repository/data evidence.

## Migration requirements

- inspect existing data before backfill;
- do not invent phone numbers;
- do not silently merge customers;
- identify conflicts;
- make migrations deterministic;
- use explicit SQL where required;
- never use `prisma migrate dev` as a production migration strategy;
- generate/apply the intended migration correctly;
- verify schema status.

---

# 8. EXISTING DATA MIGRATION

Account for:

- legacy username;
- existing email-based registrations;
- admin username;
- Users without Customer;
- `Customer.phone` null;
- raw/format-divergent phone values;
- duplicate logical phones.

Do not assume every User has a usable phone.

If an existing user has no verified/usable phone:

```text
do not invent one
```

Such users remain legacy-compatible until a valid phone is established.

If duplicate Customer phone identities exist:

```text
do not auto-merge
```

Create an explicit conflict/reporting path.

---

# 9. M4.2 — COMMON CUSTOMER RESOLVER

Create a reusable, channel-independent Customer Resolver.

Suggested boundary:

```text
backend/src/shared/customer-resolver/
```

or another architecture-consistent identity module.

Do not copy/paste the WhatsApp matcher.

The resolver must be reusable by:

```text
Website
Guest Checkout
WhatsApp
Future Facebook/Instagram/TikTok
```

Core behavior:

```text
normalize phone
      ↓
search canonical Customer identity
      ↓
0 → UNMATCHED
1 → MATCHED
>1 → AMBIGUOUS
```

FIO is not an identity key.

Same FIO + different phone:

```text
NOT an automatic merge
```

---

# 10. WHATSAPP RESOLVER EXTRACTION

Current M3 contains private matching logic including:

- canonical phone extraction;
- Customer lookup;
- 0/1/>1 matching.

Extract reusable identity logic without changing M3 semantics.

After extraction:

```text
WhatsApp → Common Customer Resolver
```

not:

```text
WhatsApp → duplicate resolver implementation
```

Mandatory invariant:

```text
0 → UNMATCHED
1 → MATCHED
>1 → AMBIGUOUS
```

M3 e2e regression must remain green.

---

# 11. CUSTOMER CREATION / REUSE

Migrate relevant Customer creation paths to use the resolver where appropriate.

Correct conceptual flow:

```text
identity information
      ↓
Customer Resolver
      ↓
existing Customer?
 ├─ yes → reuse
 └─ no  → create according to business flow
```

Phone is the primary identity-resolution key.

Email remains a contact attribute and compatibility constraint.

The implementation must prevent race-condition duplicates.

Handle database uniqueness errors deterministically.

Do not return HTTP 500 for an expected concurrent identity race.

---

# 12. M4.3 — PHONE AUTHENTICATION

Current login:

```text
username + password
```

Target:

```text
phone + password
```

Implement phone login while preserving legacy accounts.

The authentication layer must:

1. normalize phone;
2. lookup `loginPhone`;
3. authenticate;
4. preserve legacy username compatibility;
5. maintain session revocation behavior;
6. maintain existing HttpOnly cookie behavior;
7. maintain throttling/security.

Do not create a permanent multi-identity ambiguity.

Document the exact lookup precedence.

Recommended:

```text
canonical phone → loginPhone
legacy username → compatibility path
```

Email must not become the login identity.

---

# 13. AUTH THROTTLING

Current throttling uses username/IP.

Update it so phone-first authentication cannot bypass throttling.

Account for:

```text
canonical phone
legacy username
IP
```

Do not create a bypass where an attacker can rotate identifier formats to evade throttling.

Preserve existing limits unless there is a documented security reason to change them.

---

# 14. FRONTEND LOGIN

Change customer-facing login UI from:

```text
username
```

to phone-first login.

The UI should clearly communicate that the customer logs in using their phone number.

Do not present email as the normal login identity.

Legacy/admin compatibility may require a scoped compatibility path.

Do not break admin authentication.

Update:

- validation;
- phone input;
- country handling;
- API payload;
- i18n;
- errors;
- auth context.

---

# 15. REGISTRATION

Current buyer registration is email-based.

Target:

```text
country
phone
firstName
lastName
email
password
```

Phone and country must be validated.

Phone must be normalized before persistence.

Registration flow:

```text
registration
    ↓
phone normalization
    ↓
Customer Resolver
    ↓
Customer reuse/create
    ↓
User creation/link
    ↓
loginPhone = canonical phone
```

Do not create duplicate Customer.

Do not silently reset an existing password.

Do not permit client-provided:

```text
role
permissions
customerId
partnerId
```

or equivalent privileged identity fields.

Preserve/strengthen current forbidden-key behavior.

---

# 16. FRONTEND REGISTRATION

Update:

```text
frontend/app/register/page.tsx
```

and related API/i18n.

Add:

- country selector;
- phone input;
- phone validation;
- country/phone i18n;
- correct payload;
- error handling.

Ensure the UI matches the backend identity model.

Do not copy the partner registration flow blindly; buyer registration has different semantics.

---

# 17. USER / CUSTOMER BOUNDARY

Preserve:

```text
Customer ≠ User
```

A User/BUYER may link to Customer.

Do not collapse the models.

Do not create a User merely because a Customer record exists unless the relevant onboarding flow explicitly requires it.

---

# 18. M4.4 — WHATSAPP INTEGRATION

Replace WhatsApp-private Customer matching dependency with the common resolver.

Do not alter:

- Baileys;
- QR;
- session persistence;
- reconnect;
- lease/fencing;
- inbound dedup;
- STOP/START;
- media;
- RBAC;
- audit;
- communication timeline.

Preserve:

```text
UNMATCHED
MATCHED
AMBIGUOUS
```

and existing manual-link behavior.

## WhatsApp first contact

For an unknown phone:

```text
WhatsApp
   ↓
Customer Resolver
   ↓
UNMATCHED
   ↓
collect required customer information
   ↓
re-resolve
   ↓
create/reuse Customer
   ↓
optionally activate User
```

Do not force website registration.

Do not invent permanent passwords.

---

# 19. ACTIVATION / OTP

The audit found no activation/OTP delivery infrastructure.

Do not pretend one exists.

Before implementing production activation:

### If a real delivery provider is available

Implement it through an appropriate abstraction.

### If no delivery provider is available

Implement only safe identity/account mechanics and explicitly defer delivery.

Never:

- expose permanent temporary passwords;
- log activation secrets;
- store plaintext secrets;
- create fake SMS/email delivery;
- invent provider credentials.

If activation is deferred, document the exact remaining dependency.

---

# 20. PHONE CHANGE

If phone change is implemented in M4, require:

```text
authenticated current session
→ verify new phone
→ uniqueness/conflict check
→ update loginPhone
→ invalidate appropriate sessions
→ audit
```

If full phone change is deferred, create a safe extension point and document it.

Never allow direct unverified phone replacement.

---

# 21. TRAVELER / PASSENGER / PAYER

Do not redesign traveler architecture.

Preserve:

```text
Customer ≠ Traveler
Customer ≠ Payer
User ≠ Traveler
```

Do not create User/Customer because a Traveler/Passenger is created.

Traveler data remains requirement-driven.

---

# 22. COMMERCE OWNERSHIP

Preserve:

```text
Customer
   ↓
customerId
   ↓
Request
   ↓
Order
   ↓
Booking
```

Do not use phone as the commerce owner.

Do not replace `customerId` with phone in Request/Order/Booking.

Do not break Request → Order → Booking continuity.

---

# 23. GUEST CHECKOUT

Audit found:

```text
no /checkout
no cart
no guest checkout
```

Therefore treat this as new functionality.

Approved direction:

```text
anonymous visitor
      ↓
Оформить заказ
      ↓
onboarding
      ↓
Customer Resolver
      ↓
Customer/User
      ↓
Request
      ↓
Order
```

Use existing `CheckoutIntent` architecture where appropriate.

Do not require passport/traveler data merely to establish customer identity unless a real product requirement requires it.

Traveler collection remains separate.

---

# 24. REQUEST / ORDER / BOOKING

All commerce entry points must ultimately resolve:

```text
customerId
```

Verify:

- Request creation;
- Order creation;
- Booking continuity;
- guest flow;
- staff-assisted flow;
- communication continuity.

Do not use phone as the commerce owner.

---

# 25. NOTIFICATION ARCHITECTURE

Do not directly couple commerce services to WhatsApp.

Target:

```text
Request / Order / Booking
        ↓
Notification Layer
   ↙      ↓      ↘
WhatsApp Email Future
```

If notification implementation is included:

- use channel-agnostic domain events/service boundaries;
- preserve existing WhatsApp service boundaries;
- do not make WhatsApp a hard dependency for successful commerce operations;
- respect suppression/idempotency.

If delivery infrastructure is not available, separate orchestration from delivery.

---

# 26. SECURITY

M4 must explicitly test:

## Identity

- E.164 normalization;
- uniqueness;
- duplicate race;
- AMBIGUOUS;
- no silent merge;
- no inappropriate account enumeration.

## Authentication

- wrong password;
- unknown phone;
- legacy username;
- throttling;
- session revocation;
- logout.

## Registration

- duplicate phone;
- duplicate email;
- conflicting Customer;
- forbidden fields;
- concurrent registration.

## Activation

- expiry;
- single use;
- secret handling;
- audit.

No security regression may be hidden under "legacy behavior".

---

# 27. DATABASE / MIGRATIONS

All schema changes require proper migrations.

Requirements:

- inspect current migrations;
- deterministic SQL where necessary;
- preserve existing data;
- verify existing rows before constraints;
- handle conflicts explicitly;
- run Prisma generation;
- run migration status;
- verify no drift.

Do not use destructive shortcuts.

Do not drop existing identity fields without an approved migration/deprecation plan.

---

# 28. TEST REQUIREMENTS

Add/modify tests for:

### Resolver

- 0 match;
- 1 match;
- >1;
- normalization variants;
- same FIO/different phone;
- concurrent resolution;
- duplicate creation race.

### Auth

- phone login;
- legacy username login;
- wrong password;
- throttle;
- logout;
- session revocation.

### Registration

- phone + country;
- duplicate phone;
- duplicate email;
- Customer reuse;
- no duplicate Customer;
- forbidden fields.

### WhatsApp

- existing M3 e2e;
- inbound MATCHED;
- AMBIGUOUS;
- UNMATCHED;
- manual link;
- outbound continuity.

### Guest checkout

If implemented:

- anonymous onboarding;
- Customer creation/reuse;
- Request;
- Order;
- no duplicate Customer.

### Traveler

- ensure traveler creation does not create User.

---

# 29. M3 NON-REGRESSION GATE

Mandatory after every relevant M4 phase:

```text
backend/test/whatsapp-m3.e2e-spec.ts
```

must pass.

Also preserve relevant M2 suites.

For every failure classify:

```text
new?
pre-existing?
unrelated?
M4-caused?
```

Provide evidence.

---

# 30. FULL REGRESSION

At final M4 gate run, as appropriate:

Backend:

```text
npx tsc --noEmit
npx jest --runInBand
```

Frontend:

```text
npx tsc --noEmit
npx vitest run
```

Relevant e2e suites:

```text
whatsapp-m2
whatsapp-m3
rbac-parity
auth-hardening
restart-persistence
validation-pipe
identity/auth suites
request/order/booking suites
guest checkout suites
```

Run destructive full e2e only when the repository's test environment explicitly permits it.

Do not destroy development data accidentally.

---

# 31. BROWSER SMOKE

Verify at minimum:

## Registration

```text
country
→ phone
→ FIO
→ email
→ password
→ account
```

## Login

```text
phone
→ password
→ authenticated account
```

## Existing legacy account

Verify compatibility where applicable.

## WhatsApp

```text
incoming phone
→ resolver
→ Customer
→ conversation
```

## Guest checkout

If implemented:

```text
anonymous
→ onboarding
→ Request
→ Order
```

---

# 32. DOCUMENTATION

Update documentation for:

- phone-first identity;
- Customer Resolver;
- migration;
- legacy username;
- WhatsApp integration;
- guest checkout if implemented;
- activation/OTP status;
- notification architecture.

The new ADR must be included with the implementation unless repository workflow requires another documentation sequence.

---

# 33. AUDIT / OBSERVABILITY

Identity operations with security/business impact must remain auditable.

At minimum consider:

```text
customer.created
customer.resolved
customer.identity_conflict
user.phone_login
user.phone_changed
account.activation
```

Do not log:

- passwords;
- activation secrets;
- OTP codes;
- session secrets.

Use existing audit conventions.

---

# 34. DELIVERABLES

At completion produce:

```text
M4-IMPLEMENTATION-REPORT.md
```

It must contain:

1. Executive summary.
2. Exact baseline commit.
3. Files changed.
4. Schema/migration changes.
5. Customer Resolver design.
6. Authentication changes.
7. Registration changes.
8. WhatsApp integration.
9. Guest checkout status.
10. Activation/OTP status.
11. Notification layer status.
12. Security changes.
13. Tests.
14. E2E.
15. Browser smoke.
16. Migration verification.
17. M3 regression.
18. Known limitations.
19. Deferred work.
20. Final M4 verdict.

---

# 35. FINAL GATE

The implementation is not complete until the report explicitly states:

```text
M4 FINAL PASS
```

or:

```text
M4 FINAL FAIL
```

A PASS requires:

- phone-first identity functioning;
- Customer Resolver functioning;
- no duplicate Customer creation in covered flows;
- legacy compatibility verified;
- M3 regression green;
- auth/security tests green;
- relevant commerce flows green;
- frontend green;
- migrations clean;
- browser smoke green;
- no unexplained M4-scoped failures.

---

# 36. NO SILENT SCOPE EXPANSION

Do not add unrelated work.

In particular do not use M4 to redesign:

- catalog;
- supplier architecture;
- AZAL;
- Aviasales;
- WizzAir;
- unrelated booking infrastructure;
- unrelated CRM functionality.

If a blocker is discovered outside M4, report it separately.

---

# 37. FINAL STOP CONDITION

When implementation and final gate are complete:

1. Produce `M4-IMPLEMENTATION-REPORT.md`.
2. Report exact test results.
3. Report exact migration state.
4. Report M3 regression state.
5. Report browser smoke state.
6. State `M4 FINAL PASS` or `M4 FINAL FAIL`.
7. Do not push.
8. Do not create unrelated commits.
9. Stop.

The project owner will decide the next stage after reviewing the M4 report.
