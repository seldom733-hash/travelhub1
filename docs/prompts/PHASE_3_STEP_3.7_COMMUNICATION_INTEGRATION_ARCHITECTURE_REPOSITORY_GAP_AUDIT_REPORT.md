# PHASE 3 — STEP 3.7 — COMMUNICATION INTEGRATION — ARCHITECTURE / REPOSITORY GAP AUDIT REPORT

## A. Verdict

```
VERDICT A — STEP 3.7 AUDIT COMPLETE — READY FOR IMPLEMENTATION PLANNING
```

## B. Roadmap Contract

From canonical roadmap:

```
Step 3.7 --- Communication Integration
CML-*, email/message/contact history, CRM/Sales/Order/Support links.
```

## C. Current Architecture

### Communication Domain (`communication.*`)

**Schema:** `backend/prisma/schema.prisma` lines 2269–2468
**Module:** `backend/src/modules/communication/`
**Owner:** `communication.*` (ADR-0011, new bounded context)

**Models:**
| Model | Purpose | Key fields |
|---|---|---|
| `Communication` (CML-*) | Canonical communication fact | type, channel, direction, status, body, contextType, contextId, senderType/Id, recipientType/Id, threadId |
| `CommunicationThread` | Pre-sale conversation room | buyerRequestId, buyerCustomerId, sellerPartnerId, proposalId |

**Enums:**
| Enum | Values |
|---|---|
| CommunicationType | MESSAGE, NOTE |
| CommunicationChannel | PLATFORM (only) |
| CommunicationDirection | INBOUND, OUTBOUND, INTERNAL |
| CommunicationStatus | ACTIVE, ARCHIVED |
| CommunicationContextType | CUSTOMER, PARTNER, ORDER, BOOKING, BUYER_REQUEST |
| CommunicationParticipantType | USER, CUSTOMER, PARTNER, SYSTEM |

### Realtime Transport

**NOT IMPLEMENTED.** No WebSocket, Socket.IO, SSE, or polling infrastructure exists.

### Email Integration

**NOT IMPLEMENTED.** No SMTP, SendGrid, Resend, SES, or email template infrastructure.

### Attachments

**NOT IMPLEMENTED.** No attachment model, storage, or upload support in communication.

### Moderation

**Partially implemented:**
- Anti-disintermediation regex (`shared/anti-disintermediation.ts`) — detects email/phone/URL/social handles in pre-sale chat body/subject
- Catalog Product moderation exists (separate domain)
- No message moderation service, no review queue, no content filter

## D. API Inventory

| Method | Endpoint | Actor | Permission | Scope | Mutation | Risk |
|---|---|---|---|---|---|---|
| POST | /communications | Staff | communication.create | Cross-domain context | Create fact | Low (internal) |
| GET | /communications | Staff | communication.read | Cross-domain context | List | Low |
| GET | /communications/own | Buyer/Partner | communication.read_own | Own-scope | List | Low |
| GET | /communications/:code | Staff/Buyer/Partner | communication.read/read_own | Staff: any; Buyer/Partner: own | Detail | Low |
| POST | /communications/reverse/conversations | Buyer/Partner | communication.write_own | Own-scope (membership) | Open thread | Medium |
| GET | /communications/reverse/conversations | Buyer/Partner | communication.read_own | Own-scope | List threads | Low |
| GET | /communications/reverse/conversations/:id | Buyer/Partner | communication.read_own | Own-scope (membership) | Thread detail | Low |
| GET | /communications/reverse/conversations/:id/messages | Buyer/Partner | communication.read_own | Own-scope (membership) | List messages | Low |
| POST | /communications/reverse/conversations/:id/messages | Buyer/Partner | communication.write_own | Own-scope (membership) | Send message | Medium |

## E. RBAC / Entitlement

### Permissions

| Permission | Description | Roles |
|---|---|---|
| `communication.read` | Read communications (internal staff, cross-domain) | ADMIN, DIRECTOR, OPERATOR, SALES_MANAGER |
| `communication.create` | Create communication by business context (internal staff) | ADMIN, DIRECTOR, OPERATOR, SALES_MANAGER |
| `communication.read_own` | Read own communications (BUYER/PARTNER own-scope) | BUYER, PARTNER |
| `communication.write_own` | Open/send in own pre-sale conversations | BUYER, PARTNER |

### Basic vs Pro Communication

**Currently identical.** Both Marketplace Basic and Storefront Pro use the same pre-sale conversation system. No entitlement-based differentiation in communication behavior.

## F. Communication Topology (Current)

### Supported Paths

| Path | Status | Evidence |
|---|---|---|
| Customer ↔ Marketplace Partner (pre-sale) | ✅ IMPLEMENTED | CommunicationThread + reverse-conversation.service |
| Customer ↔ Platform Support | ❌ NOT IMPLEMENTED | No support chat path |
| Customer ↔ Storefront Pro | ⚠️ SAME AS MARKETPLACE | No differentiation |
| Partner ↔ Platform | ⚠️ INTERNAL ONLY | Staff create Communications for Partner context |

### Pre-Sale Conversation Flow

```
Buyer → POST /communications/reverse/conversations
  → open(buyerRequestId, sellerPublicId)
  → resolve seller from PublicSellerProfile
  → verify distribution eligibility
  → create CommunicationThread (get-or-create, unique on buyerRequestId+sellerPartnerId)
  → return thread

Buyer/Seller → POST /communications/reverse/conversations/:id/messages
  → verify membership (buyerCustomerId or sellerPartnerId)
  → verify BuyerRequest status (CANCELLED blocks new messages)
  → anti-disintermediation check on body/subject
  → create Communication (contextType=BUYER_REQUEST, threadId, senderType/Id from actor)
  → return message
```

### Membership Authority

- **Server-derived only.** Thread membership = `buyerCustomerId` + `sellerPartnerId` columns.
- **No generic add/remove member API.** No group chats.
- **Client cannot submit membership.** sellerId/buyerId/memberIds are forbidden keys.
- **Cross-Seller isolation:** Each (buyerRequest, seller) pair = one thread. Seller A cannot see Seller B's thread.

### Sender Authority

- **Server-derived from actor.** senderType/senderId always from authenticated user.
- **SYSTEM participant forbidden from HTTP** (only internal system events).
- **No impersonation possible** — direction↔participant policy enforced.

### Recipient Authority

- **Optional.** For MESSAGE type, recipient may be specified.
- **For BUYER_REQUEST threads:** direction is platform-managed (INBOUND from buyer side, OUTBOUND from seller side).
- **Cross-tenant sending prevented** by membership check.

## G. Tenant Isolation

### Code Evidence

1. **Thread membership:** `findThreadForMember()` checks `thread.buyerCustomerId === actor.id` or `thread.sellerPartnerId === actor.id`. Non-member → neutral 404.

2. **Own-scope list:** `getOwn()` for Buyer filters by `contextType=CUSTOMER, contextId=actor.customerId`. For Partner filters by `contextType=PARTNER, contextId=actor.partnerId`.

3. **Cross-Seller isolation:** Thread unique on `(buyerRequestId, sellerPartnerId)`. Each Seller has independent thread per request.

4. **Anti-enumeration:** Unknown/hidden seller → 422 (not 404). Non-existent thread → neutral 404 (not "exists but forbidden").

### IDOR Risk

**LOW.** UUID knowledge alone is insufficient — membership check enforced server-side.

### Realtime Subscription

**N/A** — No realtime transport exists.

## H. Marketplace Direct-Contact Risk

### Anti-Intermediation

- `shared/anti-disintermediation.ts` — regex detection of email/phone/URL/social handles
- Applied to pre-sale chat body and subject
- Detection → 422 (loud rejection, not silent strip)
- **Limitation:** Basic regex only — obfuscation not detected (zero-width chars, homoglyphs, emoji separators)

### Contact Surfaces Outside Chat

| Surface | Basic Partner sees Customer contact? | Pro sees? | Customer sees Partner contact? | Policy risk |
|---|---|---|---|---|
| CRM | ✅ email/phone from Customer entity | ✅ | ✅ via Storefront | HIGH — no filtering |
| Order | ✅ customer email/name | ✅ | ✅ order details | MEDIUM |
| Booking | ✅ via order linkage | ✅ | ✅ booking details | MEDIUM |
| Chat | ❌ blocked by regex | ❌ | ❌ blocked by regex | LOW |
| Product page | N/A | N/A | ❌ no Partner contact | LOW |
| Storefront | N/A | ✅ business contacts | ✅ structured contacts | INTENDED |

**Critical finding:** Marketplace Basic Partner can see Customer email/phone through CRM and Order detail — chat anti-disintermediation alone is insufficient.

## I. Platform Support/Moderation Authority

| Action | Status | Classification |
|---|---|---|
| View conversations | ✅ Staff with communication.read | LEGITIMATE SUPPORT |
| Create communication fact | ✅ Staff with communication.create | LEGITIMATE SUPPORT |
| Join conversation | ❌ Not implemented | N/A |
| Send as support | ❌ Not implemented | N/A |
| Edit messages | ❌ Not implemented | N/A |
| Delete messages | ❌ Not implemented | N/A |
| Hide messages | ❌ Not implemented | N/A |
| Moderate messages | ❌ Not implemented | N/A |
| Impersonate participants | ❌ Not implemented (SYSTEM forbidden from HTTP) | N/A |

## J. CRM Integration

### CrmActivity

- `MESSAGE` is defined as a valid `CrmActivitySourceType` in schema
- **However:** `crm-activity.service.ts` has NO handler for MESSAGE events
- **Gap:** Communication events do NOT generate CRM Activity records

### Partner CRM Activity Gap

Step 3.6D discovered `crm.activity.read` not granted to PARTNER. This is independent — communication history exists through `/communications/own` endpoint, not through CrmActivity.

### Operational Notes

Separate module (`operational-notes/`). NOT related to communication messages. Preserves distinction:
- Message = communication fact
- PCR note = Partner relationship note
- Operational Note = internal staff note
- CrmActivity = unified CRM read model (separate projection)

## K. Sales / Order / Booking / Support Integration

### Order Integration

- `CommunicationContextType.ORDER` exists in schema
- Staff can create Communications linked to Order context
- **No automatic Order → Communication link** exists
- **No Order detail → chat opening** in frontend

### Booking Integration

- `CommunicationContextType.BOOKING` exists in schema
- Same as Order — manual staff linking only

### Support Integration

- `CommunicationContextType.SUPPORT` **NOT defined** in enum (comment says "SUPPORT deferred")
- No Support domain exists
- No support ticket → communication link

## L. Email / External Contact History

**NOT IMPLEMENTED.** No email provider, SMTP, or inbound email processing. No phone call logging. No external contact history.

## M. Realtime / Notifications

**NOT IMPLEMENTED.** No WebSocket, SSE, polling, push notifications, or unread counters.

## N. Attachments

**NOT IMPLEMENTED.** No attachment model, file storage, or download support in communication.

## O. Source-of-Truth Matrix

| Domain | Source of truth | Read model/projection | Audit/history |
|---|---|---|---|
| Chat conversation | communication.CommunicationThread | reverse-conversation endpoints | security.AuditLog |
| Message | communication.Communication (CML-*) | reverse-conversation endpoints | security.AuditLog |
| Email | NOT IMPLEMENTED | — | — |
| Manual contact | NOT IMPLEMENTED | — | — |
| CRM Activity | crm.CrmActivity | CRM Activity API/UI | security.AuditLog |
| Operational Notes | operational-notes | Operational Notes API | security.AuditLog |
| Order history | order.OrderHistory | Order detail | security.AuditLog |
| Booking history | booking.BookingHistory | Booking detail | security.AuditLog |

## P. Current vs Target vs Gap

| Capability | Current | Target (Step 3.7) | Gap |
|---|---|---|---|
| Pre-sale Buyer↔Seller chat | ✅ CommunicationThread | ✅ | NONE |
| General Customer↔Partner chat | ❌ | ❓ roadmap ambiguous | MAJOR — no general chat |
| Customer↔Platform support | ❌ | ❓ roadmap ambiguous | MAJOR — no support chat |
| Email integration | ❌ | ❓ roadmap ambiguous | MAJOR — no email |
| External contact history | ❌ | ❓ roadmap ambiguous | MAJOR — no external history |
| CRM Activity from messages | ❌ | ✅ MESSAGE sourceType exists | MEDIUM — handler missing |
| Read receipts | ❌ | ❓ | MEDIUM |
| Message editing | ❌ | ❓ | LOW |
| Attachments | ❌ | ❓ | LOW |
| Realtime transport | ❌ | ❓ | LOW — polling may suffice |
| Marketplace contact filtering | ⚠️ chat only | ✅ all surfaces | HIGH — CRM/Order bypass |
| Partner Activity (deferred) | ❌ | ❓ | DEFERRED |

## Q. Security Findings

### P0 — Cross-Tenant Data Exposure
- **Finding:** Marketplace Basic Partner can see Customer email/phone through CRM and Order detail — chat anti-disintermediation alone is insufficient.
- **Evidence:** `GET /partner/customers/:id` returns full Customer identity (email, phone) for Basic partners with legitimate order relationship.
- **Risk:** Partner receives direct contact data outside chat channel.

### P1 — Unrestricted Marketplace Contact Bypass
- **Finding:** No contact filtering on CRM/Order surfaces for Marketplace Basic.
- **Evidence:** CRM detail endpoint returns customer email/phone without marketplace-specific filtering.
- **Risk:** Anti-disintermediation in chat is bypassed through other data surfaces.

### P1 — No Message Moderation
- **Finding:** No content moderation beyond regex anti-disintermediation.
- **Evidence:** No moderation service, review queue, or content filter exists.
- **Risk:** Inappropriate content not detected.

### P2 — No CRM Activity from Messages
- **Finding:** `MESSAGE` CrmActivitySourceType defined but no handler.
- **Evidence:** `crm-activity.service.ts` has no MESSAGE case.
- **Risk:** Communication history not visible in CRM timeline.

### P2 — No Realtime Transport
- **Finding:** No WebSocket/SSE/polling.
- **Risk:** Users must manually refresh to see new messages.

## R. Action Authority Matrix (Current + Target)

| Action | Customer | Marketplace Partner | Storefront Pro | Platform Support | Platform Moderator | System |
|---|---|---|---|---|---|---|
| Create conversation | ✅ own request | ✅ distributed request | ✅ same | ❌ not implemented | ❌ not implemented | ✅ internal |
| Read conversation | ✅ own | ✅ own thread | ✅ same | ✅ staff | ✅ staff | — |
| Send message | ✅ own thread | ✅ own thread | ✅ same | ❌ not implemented | ❌ not implemented | ✅ internal |
| Edit own message | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete own message | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Hide message | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Moderate | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Join room | N/A | N/A | N/A | ❌ | ❌ | N/A |
| Close room | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Download attachment | N/A | N/A | N/A | N/A | N/A | N/A |

## S. Discovered Dependencies

### Partner CRM Activity (deferred from 3.6D)
- Communication history is independent — uses `/communications/own` endpoint
- CrmActivity projection from messages is a separate concern
- **Recommendation:** Solve independently after communication integration

### Partner Operational Notes (deferred from 3.6D)
- Operational Notes are a separate module — not related to communication messages
- **Recommendation:** No dependency on Step 3.7

### Partner Analytics (deferred from 3.6D)
- Communication metrics may be needed for Partner Analytics
- **Recommendation:** Solve after communication integration + analytics

### Marketplace Moderation
- Anti-disintermediation regex exists
- Full automated moderation is a separate architecture stage
- **Recommendation:** Step 3.7 may enhance regex but full moderation = separate stage

## T. Recommended Implementation Decomposition

Based on evidence, Step 3.7 scope is ambiguous in the roadmap. The roadmap says:

```
CML-*, email/message/contact history, CRM/Sales/Order/Support links.
```

The current implementation already has:
- CML-* communication model ✅
- Pre-sale Buyer↔Seller chat ✅

**Not implemented:**
- General Customer↔Partner chat
- Customer↔Platform support chat
- Email integration
- External contact history
- CRM Activity from messages
- Order/Booking communication links

**Recommended decomposition (pending roadmap clarification):**

1. **3.7A** — Communication Authority / Tenant Isolation hardening (existing foundation)
2. **3.7B** — Business-Context Links (Order/Booking/Support communication links)
3. **3.7C** — Unified Communication History (CRM Activity projection from messages)
4. **3.7D** — Marketplace Contact Policy (extend anti-disintermediation to CRM/Order surfaces)
5. **3.7E** — Email/External Contact Integration (if roadmap requires)

**Note:** General Customer↔Partner chat and Customer↔Platform support chat are NOT part of the current CML-* foundation. These would require significant new architecture.

## U. Tests

### Existing Communication Tests

```
backend/src/modules/communication/communication.validation.spec.ts
backend/src/modules/communication/reverse-conversation.spec.ts (if exists)
```

### CRM Activity Tests (MESSAGE sourceType defined but no handler)

```
backend/src/modules/crm-activity/crm-activity.service.spec.ts (65 tests)
```

### No frontend communication tests (no frontend components exist)

## V. Runtime Evidence

### Pre-Sale Conversation Flow

```
Buyer → POST /communications/reverse/conversations → open thread (201)
Seller → POST /communications/reverse/conversations/:id/messages → send (201)
Buyer → GET /communications/reverse/conversations/:id/messages → list (200)
```

### Tenant Isolation

```
Seller A → GET /communications/reverse/conversations/:sellerB_threadId → 404 ✅
Buyer A → GET /communications/reverse/conversations/:buyerB_threadId → 404 ✅
```

### Anti-Disintermediation

```
Seller → send message with email → 422 "must not contain contact information" ✅
Seller → send message with phone → 422 ✅
Seller → send message with URL → 422 ✅
```

## W. Git Evidence

```
Starting HEAD:          36ce652
Final HEAD:             36ce652 (audit-only, no production changes)
origin/master:          36ce652
HEAD == origin/master:  YES ✅
Production changes:     NONE (audit-only)
```
