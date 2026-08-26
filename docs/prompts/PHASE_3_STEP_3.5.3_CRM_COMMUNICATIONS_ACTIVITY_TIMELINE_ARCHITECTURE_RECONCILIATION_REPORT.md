# PHASE 3 — STEP 3.5.3 — PLATFORM CRM
## CRM COMMUNICATIONS & ACTIVITY TIMELINE
## ROUND 1 — ARCHITECTURE + CURRENT-STATE + DATA-SOURCE + RBAC / TENANT AUTHORITY RECONCILIATION — REPORT

---

### VERDICT

**VERDICT A — PHASE 3 STEP 3.5.3 PLATFORM CRM /
CRM COMMUNICATIONS + ACTIVITY TIMELINE /
CURRENT-STATE + DATA-SOURCE + EVENT SEMANTICS +
RBAC + TENANT AUTHORITY + UX CONTRACT /
FULLY RECONCILED — READY FOR IMPLEMENTATION**

---

### PRECONDITION

- **Repository:** travelhub_v1
- **Branch:** master
- **Starting SHA:** `b6b0365` (Round 2D.1 — Missing Create-Flow Coverage Closure)
- **b6b0365 preserved:** ✓

### ACCEPTED PRECEDING STAGES

| Stage | SHA | Status |
|---|---|---|
| Shared Table Controls — FINAL CLOSED | ec2e65c | ✓ Preserved |
| Operational Notes Architecture V2 | 240fbe8 | ✓ Preserved |
| Operational Notes Round 2A | e0fe7bb | ✓ Preserved |
| Operational Notes Round 2A.1 | a13e280 | ✓ Preserved |
| Operational Notes Round 2B | 8b9999f | ✓ Preserved |
| Operational Notes Round 2C | 64c6563 | ✓ Preserved |
| Operational Notes Round 2D | 88af625 | ✓ Preserved |
| Operational Notes Round 2D.1 | b6b0365 | ✓ Preserved |

---

### CURRENT-STATE MATRIX

| Domain / Source | Exists? | Canonical Model/Module | Write Authority | Read Authority | Customer Link | Partner Link | Current UI | Timeline Candidate? | Decision |
|---|---:|---|---|---|---|---|---|---:|---|
| Operational Notes | ✓ | `crm.OperationalNote` | `communication.create` permission + parent create | `operational-notes.read` permission | entityType=CUSTOMER → customerId | entityType=PARTNER → partnerId | Customer 360 Notes tab, Partner 360 Notes tab, Order detail, Booking detail, Product detail | ✓ YES | Include CREATED events only |
| Orders | ✓ | `order.Order` + `order.OrderHistory` | System (OrderRequested consumer) | `order.read` | `order.customerId` | Product→Partner via items | Customer 360 Orders tab, Partner 360 Orders tab | ✓ YES | Include CREATED + STATUS_CHANGED + CANCELLED |
| Bookings | ✓ | `booking.Booking` + `booking.BookingHistory` | System (BookingRequested subscriber) | `booking.read` | Via Order→Customer | Via Product→Partner | Customer 360 Bookings tab, Partner 360 Bookings tab | ✓ YES | Include CREATED + STATUS_CHANGED + COMPLETED |
| Payments | ✓ | `finance.Payment` + `finance.PaymentHistory` | Operator (finance.payment.write) | `finance.payment.read` | `payment.customerId` | Via Order→Product→Partner | Customer 360 Payments tab | ✓ YES | Include CREATED + CAPTURED (public-safe subset) |
| Refunds | ✓ | `finance.Refund` + `finance.RefundHistory` | Operator (finance.refund.write) | `finance.refund.read` | Via Payment→Customer | Via Payment→Order→Partner | Customer 360 Refunds tab | ✓ YES | Include CREATED + PROCESSED |
| Messages/Chat | ✓ | `communication.Communication` + `communication.CommunicationThread` | `communication.create` (staff) / `communication.write_own` (buyer/partner) | `communication.read` / `communication.read_own` | contextType=CUSTOMER | contextType=PARTNER / contextType=ORDER via Partner | No dedicated CRM UI (pre-sale chat only) | ✓ YES | Include MESSAGE events (non-NOTE, non-INTERNAL) |
| Notifications | ✗ | — | — | — | — | — | — | NO | Does not exist |
| Audit Events | ✓ | `security.AuditLog` | `security.audit()` (system) | `audit.read` | userId→User→Customer (indirect) | userId→User→Partner (indirect) | No dedicated UI | ✓ YES (selected subset only) | Include business-safe audit events only |
| Customer History | ✓ | `crm.CustomerHistory` | CRM service (automated on entity transitions) | `crm.customer.read` | Direct `customerId` | Via PartnerCustomerRelation | Customer 360 History tab | ✓ YES → MIGRATE | Replace with Activity tab |
| BuyerRequest | ✓ | `reverse.BuyerRequest` + `reverse.BuyerRequestHistory` | Buyer (reverse.request.write_own) | `reverse.request.read_own` / `reverse.distribution.read_own` | `buyerRequest.buyerId` → Customer | Via Distribution → Seller Partner | Buyer Cabinet (own-scope) | ✓ YES (Customer 360 only) | Include CREATED + SUBMITTED + CANCELLED for customer's requests |
| PartnerApplication | ✓ | `security.PartnerApplication` + `security.PartnerApplicationHistory` | Applicant (partner.onboarding.*) / Reviewer (partner.onboarding.review) | `partner.onboarding.read_own` / `partner.onboarding.review` | N/A (indirect via User→Customer) | Direct `partnerId` (assigned on approve) | Partner onboarding page | ✓ YES (Partner 360 only) | Include SUBMITTED + APPROVED/REJECTED for partner's application |
| Disputes | ✓ | `finance.Dispute` + `finance.DisputeHistory` | Operator (finance.dispute.write) | `finance.dispute.read` | Via Payment→Customer | Via Payment→Order→Partner | No dedicated CRM UI | DEFERRED | Not in v1 scope |
| Sales (Lead/Opportunity/Quote/Sale) | ✓ | `sales.*` models | Sales staff | `sales.*.read` | Direct/indirect | Via Product→Partner | Sales Center | DEFERRED | Not in v1 scope |

---

### DISCOVERED COMMUNICATION MODELS

| Model | Schema | Key Fields | Purpose |
|---|---|---|---|
| `Communication` | communication | code (CML-*), type, channel, direction, status, subject, body, contextType, contextId, threadId, senderType/Id, recipientType/Id, occurredAt | Canonical communication record |
| `CommunicationThread` | communication | code (CML-*), buyerRequestId, buyerCustomerId, sellerPartnerId, proposalId | Pre-sale conversation thread (Buyer↔Seller) |
| `CommunicationType` | enum | MESSAGE, NOTE | Message vs internal note |
| `CommunicationChannel` | enum | PLATFORM | Only in-app platform channel |
| `CommunicationDirection` | enum | INBOUND, OUTBOUND, INTERNAL | Message direction |
| `CommunicationContextType` | enum | CUSTOMER, PARTNER, ORDER, BOOKING, BUYER_REQUEST | Business context |
| `CommunicationParticipantType` | enum | USER, CUSTOMER, PARTNER, SYSTEM | Participant identity type |
| `CommunicationStatus` | enum | ACTIVE, ARCHIVED | Lifecycle |

**No Message/Chat/ChatRoom/ChatMember/Conversation/Thread models exist.** Communication IS the message model. CommunicationThread handles pre-sale conversation isolation.

---

### EXISTING CUSTOMER HISTORY

- **Data source:** `crm.CustomerHistory` — append-only audit journal with action/from/to/fields/actorId/actorName/comment/createdAt
- **Event types:** created, status changes, field updates (firstName, lastName, etc.), ownership override
- **Completeness:** Records every CRM mutation on Customer entity (create, update status, update fields)
- **Ordering:** Chronological by `createdAt` (no explicit sort in UI — renders in insertion order)
- **Pagination:** No pagination — renders all history records (unbounded but small in practice)
- **RBAC:** Inherits `crm.customer.read` permission (same as Customer detail)
- **Canonical vs derived:** Canonical — direct write from CRM service on every mutation
- **Decision:** **MIGRATE INTO ACTIVITY TIMELINE** — CustomerHistory becomes one source among many in the new Activity tab. The existing "History" tab is replaced by "Activity".

---

### PARTNER HISTORY CURRENT STATE

- Partner 360 has tabs: overview, services, orders, bookings, customers, storefront, notes
- **No History tab exists** in Partner 360
- Partner entity has no dedicated `PartnerHistory` model (unlike Customer)
- PartnerApplication has `PartnerApplicationHistory` (onboarding audit trail)
- PartnerCustomerRelation has `PartnerCustomerRelationHistory`
- **Decision:** Partner 360 will receive Activity tab in v1, sourcing from: Partner entity events, Products, Orders (via sellerPartnerId), Bookings (via Product→Partner), Payments/Refunds (via Order→Partner), Communications (contextType=PARTNER), OperationalNotes (entityType=PARTNER), PartnerApplication history

---

### CANONICAL TERMINOLOGY

| Term | Definition |
|---|---|
| **Communication** | Explicit exchange between actors/channels. Canonical model: `communication.Communication`. Types: MESSAGE (external/internal exchange), NOTE (internal staff note). Channel: PLATFORM (only current channel). |
| **Message** | A Communication with type=MESSAGE. Represents a recorded exchange (inbound/outbound). Not a real-time chat message — a durable record of communication fact. |
| **Operational Note** | Internal human-entered context on any entity. Canonical model: `crm.OperationalNote`. Append-only, soft-deletable, server-authoritative author. NOT a communication — no recipient/direction. |
| **Business Event** | Meaningful domain event produced by canonical entity transitions. Source: EventBus outbox (DomainEvents catalog). Examples: OrderCreated, BookingConfirmed, PaymentCaptured. |
| **Audit Event** | Security/accountability record of who changed what. Canonical model: `security.AuditLog`. System-produced, not user-authored. Contains action/resource/resourceId/details. |
| **Activity** | A single item in the Activity Timeline. A read-model/presentation-model projection from multiple canonical sources. NOT a source of truth. |
| **Timeline** | The chronological feed of Activity items for a subject (Customer or Partner). A presentation concept, not a data model. |
| **History** | Legacy term for CustomerHistory audit trail. Being replaced by Activity. |

---

### ARCHITECTURE OPTIONS MATRIX

| Criterion | Query-time Aggregation | Activity Read Model | Event-driven Projection | Hybrid |
|---|---|---|---|---|
| Canonical-source integrity | ✓ Direct from sources | ⚠ Stale if not rebuilt | ⚠ Projection lag | ✓ Sources remain authoritative |
| Query simplicity | ⚠ Complex multi-source query | ✓ Simple read | ✓ Simple read | ✓ Simple read |
| Performance | ⚠ O(S×P) per page across S sources | ✓ O(P) indexed read | ✓ O(P) indexed read | ✓ O(P) indexed read |
| Pagination | ⚠ Cross-source cursor extremely complex | ✓ Standard cursor | ✓ Standard cursor | ✓ Standard cursor |
| Cross-source ordering | ⚠ Application-level merge sort | ✓ Pre-sorted | ✓ Pre-sorted | ✓ Pre-sorted |
| Rebuildability | ✓ N/A (always fresh) | ✓ Truncate + rebuild from sources | ✓ Replay events | ✓ Truncate + rebuild |
| Backfill | ✓ N/A | ✓ One-time migration script | ✓ Replay historical events | ✓ One-time migration |
| Event loss recovery | ✓ N/A | ✓ Rebuild from sources | ⚠ Depends on outbox durability | ✓ Rebuild from sources |
| Tenant isolation | ✓ Per-query | ✓ Per-row metadata + query filter | ✓ Per-row metadata + query filter | ✓ Per-row metadata + query filter |
| RBAC filtering | ✓ Per-query | ✓ Per-row metadata + query-time auth | ✓ Per-row metadata + query-time auth | ✓ Per-row metadata + query-time auth |
| Historical accuracy | ✓ Always current | ⚠ Snapshot at projection time | ⚠ Event-time accuracy | ✓ Source-validated |
| Complexity | HIGH (multi-source orchestration) | MEDIUM (schema + migration + adapters) | HIGH (projection infra + replay) | MEDIUM |
| **Recommendation** | ✗ | **✓ SELECTED** | ✗ | ✗ |

---

### CANONICAL RECOMMENDATION

**Selected: Activity Read Model (denormalized `CrmActivity` table)**

Rationale:
1. **Pagination is critical** — cross-source cursor pagination across 6+ heterogeneous sources is extremely complex and error-prone. A materialized read model enables standard cursor pagination.
2. **Performance** — query-time aggregation requires reading from 6+ tables per page, each with different indexes. A single indexed table is O(P).
3. **Filtering** — server-side filtering by activityType, date range, actor is trivially indexed on a read model but requires complex UNION/INTERSECT across sources.
4. **Rebuildability** — the read model is trivially rebuildable from canonical sources (one-time migration + event listeners for new events).
5. **Simplicity** — frontend reads a single endpoint with standard pagination, no multi-source orchestration.

The read model is **derived, not authoritative**. All original domain entities remain the source of truth. The read model is a presentation optimization.

---

### ACTIVITY ITEM CONTRACT

```ts
interface ActivityItem {
  /** UUID — primary key of the read-model row */
  id: string;

  /** Categorical activity type (not arbitrary string) */
  activityType: ActivityType;

  /** Canonical source entity type */
  sourceType: SourceType;

  /** Canonical source entity ID (for deep-link and dedup) */
  sourceId: string;

  /** Event-specific identifier for deduplication (e.g., "created", "status:CAPTURED") */
  sourceEvent: string;

  /** Subject type: the entity this activity is ABOUT */
  subjectType: "CUSTOMER" | "PARTNER";

  /** Subject entity ID */
  subjectId: string;

  /** Customer ID (denormalized for Customer 360 queries) */
  customerId: string | null;

  /** Partner ID (denormalized for Partner 360 queries) */
  partnerId: string | null;

  /** Canonical business timestamp (NOT createdAt of the read-model row) */
  occurredAt: DateTime;

  /** Actor who performed the action (optional — system events may have no actor) */
  actorUserId: string | null;
  actorName: string | null;

  /** Display title (i18n key or resolved text) */
  title: string;

  /** Safe preview/summary text (role-filtered at write time) */
  summary: string | null;

  /** Source-specific metadata (JSON, role-filtered) */
  metadata: JsonNull | {
    /** Status before transition (for status-change events) */
    from?: string;
    /** Status after transition */
    to?: string;
    /** Amount (finance events, if permitted) */
    amount?: string;
    /** Currency (finance events) */
    currency?: string;
    /** Source code (e.g., ORD-00000001) for display */
    sourceCode?: string;
  };

  /** Deep link path (relative, e.g., /app/orders/:id) */
  deepLink: string | null;

  /** Visibility scope (who can see this item) */
  visibility: ActivityVisibility;

  /** Read-model row creation time (for rebuild ordering, NOT displayed) */
  projectedAt: DateTime;
}
```

**Field classification:**
- **Canonical (from source):** sourceType, sourceId, sourceEvent, occurredAt, subjectType, subjectId, customerId, partnerId
- **Derived/display-only:** id (read-model PK), activityType (mapped from sourceEvent), title (i18n-mapped), summary (role-filtered preview), metadata (role-filtered subset), deepLink (computed from sourceType+sourceId), visibility (computed from source permissions), projectedAt

---

### SOURCE TYPE STRATEGY

Strict enum, not arbitrary strings:

```ts
enum SourceType {
  OPERATIONAL_NOTE
  ORDER
  BOOKING
  PAYMENT
  REFUND
  MESSAGE
  AUDIT_EVENT
  CUSTOMER_HISTORY
  BUYER_REQUEST
  PARTNER_APPLICATION
}
```

Only sources that actually exist in the codebase. No invented types.

---

### ACTIVITY TYPE STRATEGY

Activity types are **event names** (fine-grained, specific), not coarse categories. This enables:
- Precise filtering (e.g., "show only payment captures" vs "show all finance events")
- Source-specific rendering (different card layouts per activityType)
- Future extensibility without changing existing types

Bounded set per source type:

```ts
// Operational Note
NOTE_CREATED

// Order
ORDER_CREATED
ORDER_STATUS_CHANGED
ORDER_CANCELLED

// Booking
BOOKING_CREATED
BOOKING_STATUS_CHANGED
BOOKING_COMPLETED

// Payment
PAYMENT_CREATED
PAYMENT_CAPTURED

// Refund
REFUND_CREATED
REFUND_PROCESSED

// Message
MESSAGE_SENT

// Audit (selected business-safe subset)
AUDIT_CUSTOMER_CREATED
AUDIT_CUSTOMER_STATUS_CHANGED
AUDIT_PARTNER_APPROVED

// Customer History (legacy, migrated)
CUSTOMER_HISTORY_CREATED
CUSTOMER_HISTORY_STATUS_CHANGED
CUSTOMER_HISTORY_UPDATED

// Buyer Request
BUYER_REQUEST_CREATED
BUYER_REQUEST_SUBMITTED
BUYER_REQUEST_CANCELLED

// Partner Application
PARTNER_APPLICATION_SUBMITTED
PARTNER_APPLICATION_APPROVED
PARTNER_APPLICATION_REJECTED
```

Total: ~20 activity types. Bounded, documented, server-controlled.

---

### SOURCE SEMANTICS MATRIX

| Source | Timeline Events | Timestamp Authority | Customer Inclusion | Partner Inclusion | Deep Link | Sensitive Fields | Permission |
|---|---|---|---|---|---|---|---|
| OperationalNote | NOTE_CREATED | `note.createdAt` | Direct (entityType=CUSTOMER) | Direct (entityType=PARTNER) | /app/crm/customers/:id?tab=notes or /app/crm/partners/:id?tab=notes | note text (role-filtered) | `operational-notes.read` |
| Order | ORDER_CREATED, ORDER_STATUS_CHANGED, ORDER_CANCELLED | `order.createdAt`, `orderHistory.createdAt` | Direct (`order.customerId`) | Indirect (items→product→partner) | /app/orders/:id | amount, currency | `order.read` |
| Booking | BOOKING_CREATED, BOOKING_STATUS_CHANGED, BOOKING_COMPLETED | `booking.createdAt`, `bookingHistory.createdAt` | Via Order→Customer | Via Product→Partner | /app/bookings/:id | amount, currency | `booking.read` |
| Payment | PAYMENT_CREATED, PAYMENT_CAPTURED | `payment.createdAt` / `payment.paidAt` | Direct (`payment.customerId`) | Via Order→Partner | /app/crm/customers/:id?tab=payments | amount, currency (non-finance roles see code only) | `finance.payment.read` |
| Refund | REFUND_CREATED, REFUND_PROCESSED | `refund.createdAt` / `refund.processedAt` | Via Payment→Customer | Via Payment→Order→Partner | /app/crm/customers/:id?tab=refunds | amount, currency, reason (non-finance roles see code only) | `finance.refund.read` |
| Message | MESSAGE_SENT | `communication.occurredAt` | contextType=CUSTOMER | contextType=PARTNER or ORDER→Partner | Communication detail (no dedicated route yet — metadata only) | body (role-filtered: preview for authorized, metadata-only for others) | `communication.read` |
| Audit | AUDIT_* (selected) | `auditLog.createdAt` | Via userId→User→Customer (indirect) | Via userId→User→Partner (indirect) | No deep link (audit log) | details (heavily filtered) | `audit.read` |
| BuyerRequest | BUYER_REQUEST_* | `buyerRequest.createdAt` / `buyerRequestHistory.createdAt` | Direct (`buyerRequest.buyerId`) | Via Distribution→Seller | Buyer Cabinet (own-scope) | N/A | `reverse.request.read_own` |
| PartnerApplication | PARTNER_APPLICATION_* | `partnerApplicationHistory.createdAt` | N/A | Direct (`partnerApplication.partnerId`) | Partner onboarding | N/A | `partner.onboarding.read_own` / `partner.onboarding.review` |

---

### TIMESTAMP MATRIX

| Event | Canonical Timestamp | Source Field | Fallback Allowed? | Reason |
|---|---|---|---|---|
| Note created | note.createdAt | `OperationalNote.createdAt` | NO | Server-authoritative creation time |
| Order created | order.createdAt | `Order.createdAt` | NO | Server-authoritative creation time |
| Order status changed | history.createdAt | `OrderHistory.createdAt` | NO | Actual transition time |
| Order cancelled | order.cancelledAt | `Order.cancelledAt` | NO | Canonical milestone |
| Booking created | booking.createdAt | `Booking.createdAt` | NO | Server-authoritative creation time |
| Booking status changed | history.createdAt | `BookingHistory.createdAt` | NO | Actual transition time |
| Booking completed | booking.completedAt | `Booking.completedAt` | NO | Canonical milestone |
| Payment created | payment.createdAt | `Payment.createdAt` | NO | Server-authoritative creation time |
| Payment captured | payment.paidAt | `Payment.paidAt` | NO | Canonical milestone (actual capture time) |
| Refund created | refund.createdAt | `Refund.createdAt` | NO | Server-authoritative creation time |
| Refund processed | refund.processedAt | `Refund.processedAt` | NO | Canonical milestone |
| Message sent | communication.occurredAt | `Communication.occurredAt` | NO | Server-authoritative fact time |
| Audit event | auditLog.createdAt | `AuditLog.createdAt` | NO | System-recorded time |
| Customer created | history.createdAt | `CustomerHistory.createdAt` | NO | CRM audit trail time |
| Customer status changed | history.createdAt | `CustomerHistory.createdAt` | NO | CRM audit trail time |
| BuyerRequest created | request.createdAt | `BuyerRequest.createdAt` | NO | Server-authoritative |
| BuyerRequest submitted | request.submittedAt | `BuyerRequest.submittedAt` | NO | Canonical milestone |
| PartnerApplication submitted | history.createdAt | `PartnerApplicationHistory.createdAt` | NO | Audit trail time |
| PartnerApplication approved | history.createdAt | `PartnerApplicationHistory.createdAt` | NO | Audit trail time |

**No generic createdAt fallback accepted.** Every event uses the canonical business timestamp from its source.

---

### CUSTOMER SUBJECT MODEL

**Inclusion semantics for Customer 360 Activity:**

Direct inclusion (customerId = customer.id):
- OperationalNote where entityType=CUSTOMER and entityId=customer.id
- Order where customerId=customer.id
- Payment where customerId=customer.id
- Communication where contextType=CUSTOMER and contextId=customer.id
- BuyerRequest where buyerId=customer.id
- CustomerHistory where customerId=customer.id

Indirect inclusion (via commercial chain):
- Booking → via Order→Customer (booking.orderId → order.customerId = customer.id)
- Refund → via Payment→Customer (refund.paymentId → payment.customerId = customer.id)
- Message on ORDER context → via Order→Customer (communication.contextType=ORDER, order.customerId = customer.id)
- Message on BOOKING context → via Booking→Order→Customer

**NOT included:**
- Partner entity events (Partner-specific, not Customer-specific)
- PartnerApplication events (Partner onboarding, not Customer)
- Audit events where userId does NOT resolve to this Customer's User (indirect, filtered)

**Decision:** Customer 360 shows **all commercial events involving that Customer**, not just events directly attached to Customer entity. This provides a complete operational history.

---

### PARTNER SUBJECT MODEL

**Inclusion semantics for Partner 360 Activity:**

Direct inclusion (partnerId = partner.id):
- OperationalNote where entityType=PARTNER and entityId=partner.id
- Communication where contextType=PARTNER and contextId=partner.id
- PartnerApplication where partnerId=partner.id

Indirect inclusion (via commercial chain):
- Product → partnerId=partner.id (ProductCreated events)
- Order → via items→product→partner (sellerPartnerId or product.partnerId)
- Booking → via Product→Partner
- Payment → via Order→Partner
- Refund → via Payment→Order→Partner
- Message on ORDER context → via Order→Product→Partner
- Message on BOOKING context → via Booking→Product→Partner

**NOT included:**
- Customer entity events (Customer-specific, not Partner)
- BuyerRequest events (Buyer-specific, not Partner — except Distribution events visible to Seller)
- Audit events where userId does NOT resolve to this Partner's User

**Cross-partner isolation:** Partner A's timeline NEVER includes Partner B's events. All queries are scoped by partnerId.

---

### SUBJECT-INCLUSION MATRIX

| Source/Event | Customer 360 | Partner 360 | Direct Link Rule | Indirect Link Rule | Scope Risk |
|---|---|---|---|---|---|
| Customer Note | ✓ | ✗ | entityType=CUSTOMER, entityId=customerId | — | Low (direct) |
| Partner Note | ✗ | ✓ | entityType=PARTNER, entityId=partnerId | — | Low (direct) |
| Order | ✓ | ✓ | order.customerId = Customer | items→product.partnerId = Partner | Medium (indirect via items) |
| Booking | ✓ | ✓ | Via Order→Customer | Via Product→Partner | Medium (indirect via Order/Product) |
| Payment | ✓ | ✓ | payment.customerId = Customer | Via Order→Partner | Medium (indirect via Order) |
| Refund | ✓ | ✓ | Via Payment→Customer | Via Payment→Order→Partner | Medium (indirect chain) |
| Message | ✓ | ✓ | contextType=CUSTOMER | contextType=PARTNER or ORDER→Partner | Medium (context-based) |
| BuyerRequest | ✓ | ✗ | buyerRequest.buyerId = Customer | — | Low (direct) |
| PartnerApplication | ✗ | ✓ | partnerApplication.partnerId = Partner | — | Low (direct) |
| Customer History | ✓ | ✗ | customerHistory.customerId = Customer | — | Low (direct) |

---

### OPERATIONAL NOTES INTEGRATION

**Timeline includes:** NOTE_CREATED only.

**Not included:**
- Note edited (OperationalNote.editedAt exists but no domain event is emitted; editing is a metadata update, not a new business fact)
- Note deleted (soft-deleted notes are hidden from ordinary timeline; audit trail preserved in AuditLog)

**Deleted note behavior:**
- Soft-deleted OperationalNote (deletedAt ≠ null) → timeline item REMOVED from ordinary view
- AuditLog entry for deletion remains visible to roles with `audit.read`
- The timeline item is regenerated on rebuild only if the note is not soft-deleted

**Note text in timeline:**
- summary field: truncated preview (first 100 chars) if the role may read the note
- For roles without `operational-notes.read`: summary = null (metadata only: "Примечание добавлено")

**OperationalNote remains its own canonical data source.** Timeline item links to the note/context but does NOT duplicate note authority. CRUD operations remain on the Notes tab.

---

### NOTES VS ACTIVITY UX

```
Notes tab = note-focused CRUD workspace (create, edit, delete, list, paginate)
Activity tab = cross-domain chronological read model (read-only aggregate history)
```

**Decision:** Keep Notes tab for CRUD. Add Activity tab for aggregate history. The Notes tab continues to serve operators who need to manage notes directly. The Activity tab provides a unified chronological view across all sources.

---

### MESSAGING / CHAT INTEGRATION

**Current messaging architecture:**
- `Communication` model — single message record (CML-*)
- `CommunicationThread` — pre-sale conversation isolation (Buyer↔Seller)
- Context types: CUSTOMER, PARTNER, ORDER, BOOKING, BUYER_REQUEST
- Channels: PLATFORM only
- Directions: INBOUND, OUTBOUND, INTERNAL
- Types: MESSAGE, NOTE

**Timeline inclusion:**
- Messages with type=MESSAGE are included in Activity timeline
- Messages with type=NOTE (internal staff notes) are excluded from Activity (visible only in source-specific views)
- Messages with direction=INTERNAL are excluded from buyer/partner views

**Message body in timeline:**
- For roles with `communication.read`: summary = truncated body preview (first 100 chars)
- For roles without `communication.read`: summary = null (metadata only: "Сообщение отправлено")

**Message privacy:** Timeline does NOT expose full message body to unauthorized roles. Body is role-filtered at projection time.

---

### CURRENT VS FUTURE CHANNELS MATRIX

| Channel | Exists Today? | Canonical Source | Timeline v1? | Future? | Notes |
|---|---|---|---:|---:|---|
| In-app chat (PLATFORM) | ✓ | `Communication.channel = PLATFORM` | ✓ YES | ✓ | Only current channel |
| Email | ✗ | — | NO | ✓ FUTURE | Reserved enum value not declared; architecture may add when real integration exists |
| SMS | ✗ | — | NO | ✓ FUTURE | Same as Email |
| WhatsApp | ✗ | — | NO | ✓ FUTURE | Same as Email |
| Phone log | ✗ | — | NO | ✓ FUTURE | Same as Email |
| System notifications | ✗ | — | NO | ✓ FUTURE | No notification model exists |

**No unsupported omnichannel claims.** Only PLATFORM channel is declared and implemented.

---

### COMMUNICATION WRITE / COMPOSER SCOPE

**Decision: Timeline-only in v1.** No messaging composer in Customer/Partner 360 Activity tab.

Rationale:
- The Activity tab is a read model — adding a composer conflates read and write concerns
- Pre-sale chat already has its own endpoint (reverse-conversation)
- Customer/Partner communication (CRM context) has `communication.create` endpoint
- Future: Customer 360 could deep-link to a communication composer, but that is a separate feature

---

### DEEP LINKS

| Source | Deep Link Pattern | Behavior |
|---|---|---|
| Order | `/app/orders/:id` | Navigate to Order detail |
| Booking | `/app/bookings/:id` | Navigate to Booking detail |
| Payment | `/app/crm/customers/:id?tab=payments` | Navigate to Customer 360 Payments tab |
| Refund | `/app/crm/customers/:id?tab=refunds` | Navigate to Customer 360 Refunds tab |
| OperationalNote | `/app/crm/customers/:id?tab=notes` or `/app/crm/partners/:id?tab=notes` | Navigate to Notes tab |
| Message | No dedicated route yet | Non-clickable (metadata display only) |
| BuyerRequest | Buyer Cabinet (own-scope) | Navigate to Buyer Cabinet |
| PartnerApplication | Partner onboarding page | Navigate to onboarding |
| Customer History | Replaced by Activity tab | N/A (migrated) |
| Audit | No dedicated CRM route | Non-clickable (metadata display only) |

**No dead links.** If source has no detail route, the activity card is non-clickable (no deepLink rendered).

---

### VISIBILITY MATRIX

| Source | ADMIN | DIRECTOR | SALES_MANAGER | OPERATOR | FINANCE | ANALYST | MARKETER | MODERATOR | PARTNER | BUYER |
|---|---|---|---|---|---|---|---|---|---|---|
| Notes | ✓ (all) | ✓ (all) | ✓ (all) | ✓ (all) | ✓ (all) | ✓ (all) | ✓ (all) | ✓ (all) | own-scope only | own-scope only |
| Orders | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | own-scope only | own-scope only |
| Bookings | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | own-scope only | own-scope only |
| Payments | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | N/A | own-scope only |
| Refunds | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | N/A | own-scope only |
| Messages | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | own-scope only | own-scope only |
| Audit-safe events | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | N/A | N/A |
| Customer History | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | N/A | N/A |
| BuyerRequest | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | N/A | own-scope only |
| PartnerApplication | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | own-scope only | N/A |

**Invariant:** `timeline visibility <= source visibility`. An activity item must never make a hidden source discoverable.

---

### RBAC MODEL

**Two-level permission model:**

```
Page gate:    crm.activity.read  (new permission — controls Activity tab visibility)
Per-item:     source-specific read permission (controls which items appear)
```

**New permission required:**
```ts
"crm.activity.read": "Чтение Activity Timeline (Customer 360 / Partner 360)"
```

**Role assignments for `crm.activity.read`:**
- ADMIN: ✓
- DIRECTOR: ✓
- SALES_MANAGER: ✓
- OPERATOR: ✓
- FINANCE: ✓
- ANALYST: ✓
- MARKETER: ✓
- MODERATOR: ✗ (moderation scope, not CRM operations)
- PARTNER: ✗ (own-scope handled separately via source permissions)
- BUYER: ✗ (own-scope handled separately via source permissions)

**PARTNER/BUYER handling:** The Activity tab on Partner 360 / Customer 360 (own-scope) does NOT require `crm.activity.read` — it uses source-specific own-scope permissions (e.g., `order.read_own`, `communication.read_own`). The `crm.activity.read` permission is for internal staff viewing any Customer/Partner 360.

---

### TENANT / WORKSPACE AUTHORITY

**Isolation model:**
- Customer timeline: scoped by `customerId` — query filters `customerId = :id`
- Partner timeline: scoped by `partnerId` — query filters `partnerId = :id`
- Cross-tenant aggregation: FORBIDDEN (no workspace-level timeline exists)
- Cross-partner data: FORBIDDEN (Partner A never sees Partner B's events)

**Read-model row metadata:** Each `CrmActivity` row stores both `customerId` and `partnerId` (nullable). Queries filter by the appropriate subject.

**Workspace/tenant:** The current architecture uses role-based access, not multi-tenant workspace isolation. Timeline inherits the same model.

---

### QUERY AUTHORIZATION ORDER

```
1. Resolve subject (Customer or Partner by ID)
2. Verify actor can access subject (source-specific permission check)
3. Determine candidate sources based on subject type
4. Query CrmActivity with subject scope + source-type filters
5. Apply source-specific authorization (per-item permission)
6. Aggregate + sort by occurredAt DESC
7. Paginate with cursor
```

**Not:** aggregate everything → hide unauthorized cards in frontend.

---

### PAGINATION / ORDERING

**Strategy:** Cursor-based pagination (recommended for multi-source chronological feeds).

**Stable ordering:** `occurredAt DESC, id DESC` (deterministic tie-breaker using read-model UUID)

**Page size:** Default 20, max 50

**Cursor:** Base64-encoded `{occurredAt, id}` of the last item on the current page.

**Back/Forward:** Cursor encodes position; backward pagination uses `occurredAt ASC, id ASC` with reversed cursor.

---

### FILTERS / SEARCH / URL STATE

**Filters (v1, server-side):**
- `activityType` — filter by specific activity type (e.g., ORDER_CREATED, PAYMENT_CAPTURED)
- `sourceType` — filter by source category (e.g., ORDER, PAYMENT)
- `dateFrom` — filter by occurredAt >= dateFrom
- `dateTo` — filter by occurredAt <= dateTo

**Search:** No text search in v1. Activity titles are i18n-mapped, not searchable content. Source-specific search exists in source-specific tabs.

**URL state:** `?tab=activity&type=ORDER_CREATED&dateFrom=2026-01-01&cursor=...`

Follows Shared Table Controls principles where applicable.

---

### EMPTY / ERROR / FORBIDDEN STATES

| State | Behavior |
|---|---|
| No activity | "Нет активности для этого клиента/партнёра" |
| No activity matching filters | "Нет активности по выбранным фильтрам" |
| Loading | Spinner |
| Load error | Error message + Retry button |
| Forbidden (no crm.activity.read) | Tab not rendered (hidden from tab bar) |
| Subject not found | Redirect to list or 404 |

**`403 != 200 []`**: Forbidden is a distinct state, not an empty result.

---

### PARTIAL SOURCE FAILURE

**Policy: Show partial timeline with warning.**

If the Activity read model is used (recommended), source failures during rebuild are logged but do not affect query-time reads. If query-time aggregation were used (not recommended), partial failure would show available sources with a warning banner.

**For read-model approach:**
- Projection failures are logged and monitored
- Stale data is surfaced via `projectedAt` timestamp in metadata
- Reconciliation job can rebuild from canonical sources on demand

---

### PROJECTION / CONSISTENCY

**Consistency model:** Eventual consistency (projection is asynchronous).

**Expected lag:** < 1 second (outbox worker processes events within 1 second).

**UI behavior:** Activity tab shows data as-of last projection. Manual refresh button available. No real-time updates in v1.

**Reconciliation:** Periodic rebuild job (daily or on-demand) ensures projection stays consistent with sources.

---

### BACKFILL / REBUILD

**Backfill strategy (one-time migration):**

For each source, generate "current-state" activity items from existing data:

| Source | Reconstructable Events | Not Reconstructable | Timestamp Choice |
|---|---|---|---|
| CustomerHistory | All records (action/from/to/createdAt) | — | `customerHistory.createdAt` |
| Order | ORDER_CREATED (from order.createdAt) | Intermediate status changes (OrderHistory may not cover all transitions) | `order.createdAt` |
| Booking | BOOKING_CREATED (from booking.createdAt) | Intermediate status changes | `booking.createdAt` |
| Payment | PAYMENT_CREATED (from payment.createdAt) | CAPTURED timestamp (paidAt exists) | `payment.createdAt` / `payment.paidAt` |
| Refund | REFUND_CREATED (from refund.createdAt) | PROCESSED timestamp (processedAt exists) | `refund.createdAt` / `refund.processedAt` |
| OperationalNote | NOTE_CREATED (from note.createdAt) | — | `note.createdAt` |
| Communication | MESSAGE_SENT (from communication.occurredAt) | — | `communication.occurredAt` |
| BuyerRequest | BUYER_REQUEST_CREATED (from request.createdAt) | SUBMITTED/CANCELLED (submittedAt/cancelledAt may be null) | `request.createdAt` |
| PartnerApplication | From PartnerApplicationHistory records | — | `history.createdAt` |

**Deduplication:** `sourceType + sourceId + sourceEvent` is the dedup key. Backfill inserts are idempotent (upsert on dedup key).

**No fake historical precision:** Only emit events that canonical data supports. If a status transition timestamp is unknown, do not fabricate it.

---

### AUDIT / FINANCE / MESSAGE PRIVACY

**Audit events:** Only business-safe audit events are included in Activity timeline:
- `customer.created`, `customer.status_changed` (CRM operations)
- `partner.approved` (onboarding milestones)
- Low-level security events (login failures, permission denials) are EXCLUDED

**Finance privacy:**
- Payment/Refund amount and currency are included in timeline metadata for roles with `finance.payment.read` / `finance.refund.read`
- For roles without finance permissions: metadata shows only status/code (no amount)
- Payment method and provider details are NEVER included in timeline

**Message privacy:**
- Message body preview is included only for roles with `communication.read`
- For unauthorized roles: metadata shows "Сообщение отправлено" (no body)
- Full message body is never denormalized into the read model — stored as reference only

---

### PII / RETENTION

**PII handling:**
- Note text: stored as reference (source is OperationalNote), preview in summary field (role-filtered)
- Message body: stored as reference (source is Communication), preview in summary field (role-filtered)
- Customer names: not duplicated in read model — resolved from source at display time or stored as display-only snapshot
- Payment metadata: amount/currency only (no PII)
- Refund reasons: descriptive text (no PII)

**Retention:** Read model does NOT extend retention beyond source policy. If source is soft-deleted:
- OperationalNote deleted → timeline item removed from view
- Communication archived → timeline item remains (status=ARCHIVED)
- Order/Booking/Payment/Refund → never deleted (append-only lifecycle)

---

### TARGET CUSTOMER 360 UX

```
Customer 360:
  Overview
  Orders
  Bookings
  Payments
  Partners
  Refunds
  Activity          ← NEW (replaces "History")
  Notes
```

**Decision:** The existing "History" tab is RENAMED to "Activity" and its content is replaced by the cross-domain Activity Timeline. The old CustomerHistory-only view is gone.

---

### TARGET PARTNER 360 UX

```
Partner 360:
  Overview
  Services
  Orders
  Bookings
  Customers
  Storefront
  Activity          ← NEW
  Notes
```

**Decision:** Partner 360 receives a new "Activity" tab. This is a new addition — Partner 360 currently has no history view.

---

### API CONTRACT

```
GET /customers/:id/activity
GET /partners/:id/activity
```

**Query parameters:**
- `activityType?` — filter by activity type
- `sourceType?` — filter by source type
- `dateFrom?` — ISO date (inclusive)
- `dateTo?` — ISO date (inclusive)
- `cursor?` — cursor for pagination
- `pageSize?` — default 20, max 50

**Response:**
```json
{
  "items": [ActivityItem],
  "nextCursor": string | null,
  "hasMore": boolean
}
```

---

### SECURITY MATRIX

| Threat | Mitigation | Server Authority | Test Required Later |
|---|---|---|---|
| Customer IDOR | Subject ID validated against DB; query scoped by customerId | Server resolves subject, applies scope | ✓ |
| Partner IDOR | Subject ID validated against DB; query scoped by partnerId | Server resolves subject, applies scope | ✓ |
| Cross-tenant aggregation | No cross-subject queries; each request is single-subject | Server enforces single-subject scope | ✓ |
| Note leakage | Timeline visibility <= source visibility; note text role-filtered at projection | Server computes visibility from source permissions | ✓ |
| Message leakage | Body preview role-filtered at projection; INTERNAL/NOTE excluded from own-scope | Server filters by type+direction+role | ✓ |
| Finance leakage | Amount/currency only for finance-permitted roles; others see status/code only | Server checks finance permissions at query time | ✓ |
| Audit leakage | Only business-safe audit events included; low-level events excluded at projection | Server selects audit event subset | ✓ |
| Cursor tampering | Cursor is opaque Base64; invalid cursor returns 400 | Server validates cursor format | ✓ |
| Deleted-source leakage | Soft-deleted sources excluded from projection; rebuild removes deleted items | Server filters deletedAt=null | ✓ |

---

### PERFORMANCE / N+1

**Performance considerations:**
- Customer timeline: typically < 1000 events (low volume)
- Partner timeline: potentially larger (many orders/bookings), but bounded by business volume
- Single-table index on (subjectType, subjectId, occurredAt DESC) supports efficient pagination
- No N+1: all data is in the read model; no secondary queries needed for display

**Index strategy:**
```sql
CREATE INDEX idx_crm_activity_subject ON CrmActivity (subjectType, subjectId, occurredAt DESC);
CREATE INDEX idx_crm_activity_source ON CrmActivity (sourceType, sourceId, sourceEvent);
```

---

### OBSERVABILITY

**Future metrics/logs (not implemented in this round):**
- Projection lag (time between source event and read-model write)
- Failed projection events (count, source type)
- Rebuild duration and record count
- Query latency (p50, p95, p99)
- Source failure count during rebuild
- Authorization denial count

---

### IMPLEMENTATION PHASING

```
Round 2A — Activity read-model schema + migration + source adapter services
Round 2B — Customer 360 Activity UI (replaces History tab)
Round 2C — Partner 360 Activity UI (new tab)
Round 2D — Backfill migration + rebuild job
Round 2E — Runtime/security/regression closure
```

Each round is independently testable and deployable.

---

### PRODUCTION CODE CHANGED:

```
Production code changed: NO
Schema changed: NO
Migration created: NO
Frontend implemented: NO
Backend implemented: NO
```

Architecture/report files only.

---

### REMAINING FINDINGS

- **P0:** None
- **P1:** None
- **P2:** None

---

### READY FOR IMPLEMENTATION: ✓

### NEXT CANONICAL ROUND:

```
Round 2A — Activity read-model schema + migration + source adapter services
```

---

**STOP**
