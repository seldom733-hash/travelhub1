# M4 PRE-CODING ARCHITECTURE DECISION — PHONE-FIRST CUSTOMER IDENTITY

## Purpose

Mandatory decision gate between the completed M3 and M4 implementation.

**This is an architecture decision, not an implementation prompt.**

No source, schema, migration, config or test changes are authorized by this document.

---

## 1. Primary Login Identity

**APPROVED: PHONE is the primary login identity.**

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

Email is not the intended primary login identity.

---

## 2. Legacy Compatibility

The existing system uses `User.username`.

M4 must NOT immediately delete it.

Transition:

```text
loginPhone = new primary identity
username   = legacy compatibility identifier
```

Existing users may temporarily authenticate through their legacy username.

New accounts must establish `loginPhone`.

`username` is transitional compatibility, not the final business identity.

Do not delete or repurpose it until a separate migration/deprecation decision confirms that all legacy accounts are safely migrated.

---

## 3. Customer Identity

**APPROVED: phone is the primary Customer identity-resolution input.**

```text
PHONE
  ↓
strong identity / resolver key

EMAIL
  ↓
contact/profile attribute
```

For compatibility, `Customer.email @unique` may remain in M4.

Do not silently remove or weaken that constraint.

Customer identity and authentication identity are related but are not the same database concept.

---

## 4. ADR-0003 Conflict

The audit found a conflict:

```text
ADR-0003:
email = canonical Customer key

M4:
phone = strong identity
```

This must be explicitly superseded by a new/updated ADR before implementation.

Target architectural statement:

```text
Phone = primary Customer identity-resolution key
Email = contact attribute
Customer.email uniqueness = temporarily retained for compatibility
```

Do not resolve this conflict silently in code.

---

## 5. Common Customer Resolver

M4 introduces one channel-independent resolver:

```text
Website
Guest Checkout
WhatsApp
Future channels
        ↓
Customer Resolver
        ↓
UNMATCHED / MATCHED / AMBIGUOUS
```

Rules:

```text
0 phone matches → UNMATCHED
1 phone match   → MATCHED
>1 matches      → AMBIGUOUS
```

FIO is only a verification/candidate signal.

Same FIO + different phone must never cause an automatic merge.

The resolver must use one canonical E.164 phone representation across all channels.

---

## 6. Customer Duplicate Prevention

The identity rule becomes:

```text
same canonical phone
        ↓
same Customer identity candidate
```

Existing data may contain null, raw, differently formatted or duplicate phones.

Therefore do NOT blindly make `Customer.phone @unique`.

Choose a migration-safe strategy after inspecting real data, potentially involving:

```text
Customer.phone
Customer.phoneCanonical
appropriate index/constraint
```

Do not invent or silently merge existing customers.

---

## 7. WhatsApp M3

M3 is frozen and passed:

```text
M3 FINAL PASS
```

M4 may extract reusable resolver logic from WhatsApp, but behavior must remain identical:

```text
0 → UNMATCHED
1 → MATCHED
>1 → AMBIGUOUS
```

The M3 e2e regression must remain green.

Do not redesign:

- Baileys/provider;
- QR/session lifecycle;
- inbound dedup;
- STOP/START;
- ordering;
- matching statuses;
- media;
- RBAC;
- audit;
- Communication history.

Only the identity-resolution boundary may change.

---

## 8. Registered Website

Target registration:

```text
country
phone
firstName
lastName
email
password
```

Flow:

```text
Registration
   ↓
normalize phone
   ↓
Customer Resolver
   ↓
Customer
   ↓
User/BUYER
   ↓
loginPhone = phone
```

Existing Customer/User must be reused when identity is established.

No silent duplicate Customer.

No silent password reset.

---

## 9. Guest Checkout

The audit confirmed that guest checkout does not currently exist.

Architecturally it is approved:

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

It is a new product surface and may be implemented as a controlled sub-phase after the identity core.

Do not pretend existing checkout already supports it.

---

## 10. WhatsApp First Contact

Target:

```text
WhatsApp phone
      ↓
Customer Resolver
      ↓
existing Customer?
 ├─ yes → verify FIO/reuse
 └─ no  → collect required data
             ↓
          re-check
             ↓
          Customer/User
```

Do not force WhatsApp-first customers into website registration merely to create Customer.

Account use remains optional.

Preferred account activation is a secure activation link.

Operators must never invent/store permanent customer passwords.

---

## 11. Activation / OTP

Audit result:

```text
activation infrastructure = absent
OTP infrastructure = absent
mail/SMS delivery = absent
```

M4 must explicitly choose:

### A
Implement a real delivery channel.

or

### B
Implement identity/account mechanics and explicitly defer delivery.

If deferred:

- document it;
- do not create insecure fake activation;
- do not expose permanent temporary passwords;
- remain OTP/activation-ready.

No invented production delivery mechanism.

---

## 12. Customer / User / Traveler / Payer

Preserve:

```text
Customer ≠ User
Customer ≠ Traveler
Customer ≠ Payer
User ≠ Traveler
```

Do not create User because a Traveler exists.

Do not redesign the existing traveler/passenger architecture unless a concrete blocker is discovered.

---

## 13. Commerce Ownership

Business ownership remains:

```text
phone
  ↓
Customer Resolver
  ↓
customerId
  ↓
Request / Order / Booking
```

Phone itself must not become the commerce owner.

Do not replace `customerId` with phone fields in Request/Order/Booking.

---

## 14. Communication Continuity

Preserve the existing continuous communication history.

Identity resolution must ultimately resolve to the same Customer/context rather than creating channel-specific customer streams.

---

## 15. Notification Layer

Keep notification architecture channel-agnostic:

```text
Request / Order / Booking
            ↓
      Notification Layer
       ↙       ↓       ↘
 WhatsApp    Email    Future
```

Do not couple RequestService/OrderService/BookingService directly to WhatsAppService.

Delivery infrastructure remains separately scoped.

---

## 16. Phone Change

Future-safe architecture:

```text
current auth
→ new phone verification
→ uniqueness check
→ update loginPhone
→ invalidate affected sessions/tokens
→ audit
```

Do not implement unsafe direct phone replacement.

---

## 17. Existing User Migration

Account for:

- legacy `User.username`;
- email-based registrations;
- admin username;
- users without Customer;
- Customer.phone null;
- duplicate/formatted phones.

Do not invent phone numbers.

Do not silently merge by FIO.

Do not assume every Customer can receive a loginPhone automatically.

---

## 18. M3 Baseline

The audit found the M3 implementation uncommitted.

Before M4:

```text
M3 FINAL PASS
      ↓
commit M3 baseline
      ↓
verify clean working tree
      ↓
M4 implementation
```

The commit requires explicit project-owner authorization.

M4 must not stack on an uncontrolled dirty baseline.

---

## 19. M4 Scope

### Core

1. Phone-first identity.
2. `User.loginPhone`.
3. E.164 normalization.
4. Common Customer Resolver.
5. Registered website phone-first onboarding.
6. Legacy login compatibility.
7. Duplicate prevention.
8. WhatsApp integration with common resolver.
9. Migration strategy.
10. Security/audit.
11. Regression tests.

### Controlled sub-scopes

- Guest checkout.
- WhatsApp customer onboarding.
- Activation/OTP delivery.
- Commerce Notification Layer.

These must not be assumed to have existing infrastructure.

---

## 20. Implementation Order

### M4.1 Identity foundation
- ADR supersession;
- phone canonicalization;
- schema/migration design;
- loginPhone;
- legacy compatibility.

### M4.2 Common Customer Resolver
- shared resolver;
- phone matching;
- AMBIGUOUS handling;
- Customer reuse/creation;
- migrate entry points.

### M4.3 Authentication / Registration
- phone registration;
- phone login;
- frontend;
- auth context;
- profile.

### M4.4 WhatsApp
- use common resolver;
- preserve M3 behavior;
- onboarding;
- activation strategy.

### M4.5 Guest checkout
- onboarding;
- resolver;
- Customer/User;
- Request;
- Order.

### M4.6 Hardening
- security;
- race conditions;
- duplicate prevention;
- migration verification;
- regression;
- browser smoke;
- M4 gate.

---

## 21. Final Architecture

```text
                    ┌───────────────────┐
                    │  Customer Resolver│
                    └─────────┬─────────┘
                              │
          ┌───────────────────┼────────────────────┐
          │                   │                    │
       Website             WhatsApp          Future Channels
          │                   │                    │
          └───────────────────┼────────────────────┘
                              ↓
                         Customer
                              │
                    ┌─────────┴─────────┐
                    │                   │
                  User             Commerce
                    │                   │
             loginPhone           Request
             password                ↓
             email                 Order
                                   ↓
                                 Booking
```

Separate concepts remain:

```text
Customer
User
Traveler
Payer
```

---

## 22. FINAL DECISION

Unless the project owner explicitly changes a decision above:

```text
M4 TARGET ARCHITECTURE = PHONE-FIRST CUSTOMER IDENTITY
```

The next implementation prompt must be generated from this document plus the completed:

```text
M4-PRE-IMPLEMENTATION-AUDIT.md
```

Do not reuse assumptions contradicted by the audit.

**No M4 implementation should start until the project owner approves this architecture decision.**
