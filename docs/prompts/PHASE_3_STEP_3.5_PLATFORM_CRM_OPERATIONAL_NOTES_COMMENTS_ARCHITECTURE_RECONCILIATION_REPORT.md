# PHASE 3 — STEP 3.5 — PLATFORM CRM
## OPERATIONAL NOTES / COMMENTS ARCHITECTURE RECONCILIATION — ROUND 1

---

## VERDICT

```
VERDICT A — PHASE 3 STEP 3.5 PLATFORM CRM /
OPERATIONAL NOTES + COMMENTS ARCHITECTURE /
DOMAIN MODEL + ENTITY COVERAGE + VISIBILITY + RBAC + AUDIT + UX CONTRACT /
FULLY RECONCILED — READY FOR IMPLEMENTATION
```

---

## PRECONDITION

- Repository: `/d/travelhub_v1`
- Branch: `master`
- Starting SHA: `ec2e65c`
- `ec2e65c` preserved ✅
- No production code modified ✅
- No schema migration executed ✅

---

## EXISTING SYSTEM AUDIT

### Existing Note-like Fields (simple `notes: String?`)

| Entity | Schema | Field | Current Semantics |
|---|---|---|---|
| `PartnerCustomerRelation` | `crm` | `notes` | Free-text partner-specific notes about customer relationship |
| `Fulfillment` | `order` | `notes` | Free-text fulfillment instructions/notes |
| `Reservation` | `booking` | `notes` | Free-text reservation notes |
| `SellerProposal` | `sales` | `notes` | Free-text proposal notes (reverse marketplace) |

### Existing Reason Fields (canonical structured)

| Entity | Field | Semantics |
|---|---|---|
| `Refund` | `reason` | Business reason for refund (descriptive, no PII) |
| `SellerProposal` | `reason` | Proposal business reason |
| `Dispute` | `reason` | Dispute business reason |
| `ModerationSubmission` | `reasonCode` | Moderation rejection reason code |

### Existing History Models (system-generated immutable audit trail)

All `*History` models share identical schema:
```
id, entityId, action, from, to, fields (JSON), actorId, actorName, comment, createdAt
```

| Model | Schema | Entity |
|---|---|---|
| `CustomerHistory` | `crm` | Customer |
| `OrderHistory` | `order` | Order |
| `BookingHistory` | `booking` | Booking |
| `PaymentHistory` | `finance` | Payment |
| `RefundHistory` | `finance` | Refund |
| `ProductHistory` | `catalog` | Product |
| `PartnerCustomerRelationHistory` | `crm` | PartnerCustomerRelation |
| `TariffHistory` | `catalog` | Tariff |
| `SellerCapabilityHistory` | `seller` | SellerCapability |
| `BuyerRequestHistory` | `sales` | BuyerRequest |
| `SellerProposalHistory` | `sales` | SellerProposal |
| `LeadHistory` | `sales` | Lead |
| `OpportunityHistory` | `sales` | Opportunity |
| `QuoteHistory` | `sales` | Quote |
| `SaleHistory` | `sales` | Sale |
| `CheckoutIntentHistory` | `checkout` | CheckoutIntent |
| `DisputeHistory` | `finance` | Dispute |

### Existing Global Audit Infrastructure

| Model | Schema | Purpose |
|---|---|---|
| `AuditLog` | `security` | Global security/permission audit trail |

Fields: `userId`, `username`, `action`, `resource`, `resourceId`, `details` (JSON), `ip`, `createdAt`

### Existing UX Integration

| Page | Tab/Section | Current Display |
|---|---|---|
| Customer 360 | "history" tab | System history: `action`, `from → to`, `comment`, `createdAt` |
| Partner 360 | N/A | No history tab currently |
| Order detail | "История (audit)" | Last 8 system history entries |
| Booking detail | "История (audit)" | Last 8 system history entries |

### Conflicts/Duplicates

1. **No conflict detected**: The existing `*History` models are immutable system-generated events. User-entered operational notes are a distinct concept. Both can coexist.
2. **`PartnerCustomerRelation.notes`** is a simple `String?` — a single-value field with no author, timestamp, or chronology. This is the closest thing to operational notes in the current schema.
3. **No entity currently has a user-entered note field** for general operational context (Customer, Partner, Order, Booking, Payment, Refund, Product/Service, User).

---

## ENTITY COVERAGE MATRIX

| Entity | Exists | Current Note-like Field | Existing Semantics | Operational Notes Needed? | Create Context? | Detail Context? | 360 Context? | Decision |
|---|---|---|---|---|---|---|---|---|
| Customer | ✅ | None | — | Yes | Yes (CRM create) | Yes (Customer 360) | Yes | **NEW OperationalNote** |
| Partner | ✅ | None | — | Yes | Yes (CRM create) | Yes (Partner 360) | Yes | **NEW OperationalNote** |
| Service/Product | ✅ | None | — | Yes | Yes (Catalog create) | Yes (Catalog detail) | N/A (not in 360) | **NEW OperationalNote** |
| Order | ✅ | None | — | Yes | No direct create form | Yes (Order detail) | Yes (Customer/Partner 360) | **NEW OperationalNote** |
| Booking | ✅ | None | — | Yes | No direct create form | Yes (Booking detail) | Yes (Customer/Partner 360) | **NEW OperationalNote** |
| Payment | ✅ | None | — | Yes | No direct create form | Yes (Customer 360 Payments) | Yes | **NEW OperationalNote** |
| Refund | ✅ | None | — | Yes | No direct create form | Yes (Customer 360 Refunds) | Yes | **NEW OperationalNote** |
| User | ✅ | None | — | No | No | No | No | **N/A** — Not operationally justified |
| Fulfillment | ✅ | `notes: String?` | Free-text fulfillment notes | Replace with OperationalNote | No | N/A | N/A | **MIGRATE** to OperationalNote |
| Reservation | ✅ | `notes: String?` | Free-text reservation notes | Replace with OperationalNote | No | N/A | N/A | **MIGRATE** to OperationalNote |
| SellerProposal | ✅ | `notes: String?` | Proposal notes (reverse marketplace) | Keep (Sales domain) | Yes (Sales) | Yes (Sales) | No | **KEEP** — Sales-specific |
| Payout | ✅ | None | — | No | No direct create | No direct detail | No | **N/A** — Automated settlement |
| Invoice | ✅ | None | — | Future | No direct create | No direct detail | No | **DEFER** — Phase 4+ |
| Storefront | ✅ | None | — | No | N/A | N/A | No | **N/A** — Subscription entity |

---

## ARCHITECTURE OPTIONS MATRIX

| Criterion | Option A: Simple Field | Option B: Shared OperationalNote | Option C: Entity-specific Notes | Option D: Hybrid |
|---|---|---|---|---|
| Multiple entries | ❌ Single value | ✅ Unlimited chronology | ✅ Unlimited | ✅ Unlimited |
| Author attribution | ❌ No author | ✅ authorUserId | ✅ authorUserId | ✅ authorUserId |
| Timestamp | ⚠️ updatedAt only | ✅ createdAt + updatedAt | ✅ createdAt + updatedAt | ✅ createdAt + updatedAt |
| Edit history | ❌ No | ⚠️ Optional revision | ⚠️ Optional revision | ⚠️ Optional revision |
| Auditability | ❌ Weak | ✅ Actor + timestamp | ✅ Actor + timestamp | ✅ Actor + timestamp |
| RBAC | ⚠️ Inherited only | ✅ Dedicated permissions | ✅ Dedicated permissions | ✅ Dedicated permissions |
| Visibility | ❌ None | ✅ INTERNAL/PARTNER/CUSTOMER | ✅ Same | ✅ Same |
| Referential integrity | ✅ FK constraint | ⚠️ Polymorphic (no FK) | ✅ FK constraint | ⚠️ Mixed |
| Query simplicity | ✅ Simple | ✅ Single table, allowlist | ⚠️ N tables, N joins | ⚠️ Mixed |
| Scalability | ⚠️ Row-level lock | ✅ Append-only, no conflicts | ✅ Append-only | ✅ Append-only |
| Customer 360 | ⚠️ Replace History tab | ✅ New tab alongside History | ⚠️ Replace History tab | ✅ New tab |
| Partner 360 | ⚠️ Replace nothing | ✅ New tab | ⚠️ Replace nothing | ✅ New tab |
| Future Storefront CRM | ⚠️ Duplicate fields | ✅ Shared entity | ⚠️ Duplicate entity | ⚠️ Mixed |
| Future Marketplace CRM | ⚠️ Duplicate fields | ✅ Shared entity | ⚠️ Duplicate entity | ⚠️ Mixed |
| **Recommendation** | ❌ Rejected | ✅ **RECOMMENDED** | ❌ Rejected | ❌ Rejected |

### Recommendation: Option B — Shared `OperationalNote` Entity

**Why:**
1. Single entity handles all operational notes across all domains
2. Chronological, author-attributed, timestamped entries
3. Append-only design avoids concurrency conflicts
4. Shared UI component for all entity detail pages
5. Future Storefront/Marketplace CRM reuse without duplication
6. Independent from existing `*History` (system events) and `AuditLog` (security)

**Rejected alternatives:**
- **Option A (Simple field)**: No chronology, no author, single value — insufficient for operational needs
- **Option C (Entity-specific)**: 7+ separate note tables, code duplication, migration complexity
- **Option D (Hybrid)**: Adds complexity without clear semantic distinction over Option B

---

## CANONICAL TERMINOLOGY

| Concept | Definition | User-entered? | Editable? |
|---|---|---|---|
| **Operational Note** | Manually entered business context about an entity | Yes | Yes (with audit) |
| **Audit Event** | System-generated immutable event (status change, action) | No | No (immutable) |
| **History/Activity** | Timeline aggregating operational notes + system events for UI display | Mixed | Notes editable, events immutable |
| **Reason** | Canonical structured reason for a business event (e.g., cancellation reason) | Yes (structured) | At creation only |
| **Status** | Machine/business authority for entity state | No | Only via workflow transitions |
| **Business Date** | Canonical timestamp of a business event (paidAt, cancelledAt, etc.) | No | Only via workflow transitions |

### Critical Rules
- **Status** = machine/business authority. Note cannot replace.
- **Business Date** = canonical timestamp. Note cannot fake (e.g., paidAt=NULL stays NULL).
- **Reason** = structured business reason. Note supplements but does not replace.
- **Audit Event** = immutable system record. Note is separate.
- **Operational Note** = human context. Always marked as user-entered.

---

## DOMAIN SEMANTICS MATRIX

| Concept | User-entered? | Canonical State? | Editable? | Audit Required? | Example |
|---|---|---|---|---|---|
| Operational Note | ✅ Yes | No — human context | ✅ Yes | ✅ Yes (create/edit/delete) | "Клиент попросил подтвердить трансфер до 18:00" |
| Status | No — workflow transition | ✅ Yes | Only via workflow | ✅ Yes (via History) | CONFIRMED → CANCELLED |
| Business Date | No — system event | ✅ Yes | Only via workflow | ✅ Yes (via History) | paidAt: 2026-08-26 |
| Reason | Partially — structured | Yes — canonical | At creation | ✅ Yes (via History) | cancellationReason: "Client request" |
| Audit Event | No — system | Yes — immutable | No | N/A (is audit) | "Status: NEW → CONFIRMED by admin" |
| History/Activity | Mixed | Yes — aggregated | Notes yes, events no | Yes (is aggregation) | Timeline view in 360 |

---

## DATA MODEL (Conceptual Schema)

```prisma
model OperationalNote {
  id           String   @id @default(uuid())
  
  # Polymorphic parent reference (entity type + ID)
  entityType   String   // "Customer", "Partner", "Order", "Booking", "Payment", "Refund", "Product", "Fulfillment", "Reservation"
  entityId     String
  
  # Content
  text         String   @db.Text // Plain text, plain text only. No HTML.
  visibility   String   @default("INTERNAL") // "INTERNAL" | "PARTNER_VISIBLE" | "CUSTOMER_VISIBLE"
  
  # Authorship
  authorUserId String?
  authorName   String?  // Snapshot for historical rendering if user deleted
  
  # Lifecycle
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  editedAt     DateTime?  // Non-null if note was edited
  deletedAt    DateTime?  // Soft delete
  
  # Indexes
  @@index([entityType, entityId, createdAt])
  @@index([authorUserId])
  @@schema("crm")
}
```

### Field Descriptions

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID | Yes | Primary key |
| `entityType` | String | Yes | Canonical entity type name (e.g., "Customer", "Order") |
| `entityId` | UUID | Yes | ID of the parent entity |
| `text` | Text | Yes | Note content. Plain text only. Min 1 char, max 5000 chars. |
| `visibility` | String | Yes | Access scope. Default: "INTERNAL" |
| `authorUserId` | UUID? | No | Reference to User who created the note. NULL if system-generated. |
| `authorName` | String? | No | Display name snapshot for historical rendering |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last modification timestamp |
| `editedAt` | DateTime? | No | Non-null if note was edited after initial creation |
| `deletedAt` | DateTime? | No | Soft delete timestamp. NULL = active. |

---

## ENTITY REFERENCE STRATEGY

**Selected: `entityType` + `entityId` (polymorphic)**

### Why not explicit nullable FKs?
- 7+ entity types means 7+ nullable FK columns on the note
- Only one can be non-NULL at a time → most columns always wasted
- Adding a new entity type requires schema migration
- Query requires COALESCE or checking each FK

### Why `entityType` + `entityId`?
- Single pair handles all current and future entity types
- No schema migration needed for new entity types
- Simple query: `WHERE entityType = 'Order' AND entityId = :id ORDER BY createdAt DESC`
- Allows shared UI components across all entity types

### Referential Integrity Trade-offs

| Concern | Mitigation |
|---|---|
| Orphan prevention | Soft delete parent → cascade soft delete notes. API always checks parent exists before create. |
| Deleted entity cleanup | On hard delete of parent, cascade hard delete notes (ON DELETE CASCADE via application logic) |
| Query performance | Composite index on `(entityType, entityId, createdAt)` |
| Prisma limitation | No FK constraint — enforced at application/service level |
| Security | Always validate parent entity exists + user has access before CRUD |

---

## WORKSPACE / TENANT AUTHORITY

Notes inherit the same authority boundary as their parent entity.

```
Can user read entity?
  → Evaluate note visibility vs user workspace/role

Can user write note on entity?
  → Evaluate user's write permission on parent entity
```

**Direct note ID access must not bypass parent entity scope.**

The `entityType + entityId` pair is always validated against the parent entity's authorization policy before any CRUD operation.

---

## VISIBILITY MODEL

### Round 1 Scope

| Visibility | Meaning | Who Sees |
|---|---|---|
| `INTERNAL` | Platform-internal operational note | Platform staff only (ADMIN, DIRECTOR, OPERATOR, SALES_MANAGER, etc.) |
| `PARTNER_VISIBLE` | Visible to the owning partner | Platform staff + owning partner |
| `CUSTOMER_VISIBLE` | Visible to the customer | Platform staff + the customer |

### Default: `INTERNAL`

Internal notes are NEVER exposed to customers or partners by default. This is the safe default.

### Future External Visibility

If Customer 360 or Partner 360 needs to show notes to external users, they use `CUSTOMER_VISIBLE` or `PARTNER_VISIBLE`. This design supports future Storefront/Marketplace CRM without architectural changes.

---

## VISIBILITY MATRIX

| Actor / Workspace | INTERNAL | PARTNER_VISIBLE | CUSTOMER_VISIBLE |
|---|---|---|---|
| Platform Admin | ✅ Read/Write | ✅ Read/Write | ✅ Read/Write |
| Platform Director | ✅ Read/Write | ✅ Read/Write | ✅ Read/Write |
| Platform Operator | ✅ Read/Write | ✅ Read/Write | ✅ Read/Write |
| Platform Sales Manager | ✅ Read/Write | ✅ Read/Write | ✅ Read/Write |
| Platform Analyst | ✅ Read only | ✅ Read only | ✅ Read only |
| Marketplace Partner | ❌ Not visible | ✅ Own entities only | ✅ Own entities only |
| Storefront Partner | ❌ Not visible | ✅ Own entities only | ✅ Own entities only |
| Customer | ❌ Not visible | ❌ Not visible | ✅ Own entities only |

---

## RBAC STRATEGY

### Permission Design: Global Note Permissions (Option 1)

```
notes.read        — Read operational notes on accessible entities
notes.create      — Create operational notes on accessible entities
notes.update_own  — Edit own notes on accessible entities
notes.delete_own  — Delete own notes on accessible entities
```

### Why not entity-scoped (e.g., `crm.customer.note.write`)?

The project's permission architecture uses broad permissions with workspace/entity scope checks at the service level. Adding 14+ entity-specific note permissions (7 entities × 2 operations) creates unnecessary complexity.

Global `notes.create` + service-level entity scope check = same security as entity-scoped permissions.

---

## ROLE MATRIX

| Role | Read Internal Notes | Create | Edit Own | Edit Others | Delete Own | Delete Others |
|---|---|---|---|---|---|---|
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DIRECTOR | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ANALYST | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| MARKETER | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| FINANCE | ✅ | ✅ (Payment/Refund only) | ✅ own | ❌ | ✅ own | ❌ |
| MODERATOR | ✅ | ✅ (Catalog only) | ✅ own | ❌ | ✅ own | ❌ |
| SALES_MANAGER | ✅ | ✅ | ✅ own | ✅ (assigned entities) | ✅ own | ❌ |
| OPERATOR | ✅ | ✅ | ✅ own | ❌ | ✅ own | ❌ |
| PARTNER | See PARTNER_VISIBLE only | ✅ (own entities) | ✅ own | ❌ | ✅ own | ❌ |
| BUYER | See CUSTOMER_VISIBLE only | ✅ (own entities) | ✅ own | ❌ | ✅ own | ❌ |

### Rationale
- **ANALYST/MARKETER**: Read-only — they analyze, not record operational context
- **FINANCE**: Can write Payment/Refund notes (business justification: "ожидаем банковское подтверждение")
- **MODERATOR**: Can write Product notes (business justification: moderation context)
- **SALES_MANAGER**: Can write on assigned entities
- **OPERATOR**: Can write on accessible entities (primary note creators)
- **Edit/Delete others**: Reserved for ADMIN/DIRECTOR only — prevents silent context deletion

---

## EDIT SEMANTICS

Notes are **editable** after creation, with audit trail:

```
createdAt          — immutable
updatedAt          — updated on every edit
editedAt           — set to current time on first edit (null = never edited)
editedBy           — who performed the edit (snapshot)
previousText       — previous content stored in *History on edit
```

### Why editable?
Operators often need to correct typos or update context as business evolves. Preventing edits forces creating duplicate notes, which clutters the chronological view.

### Audit requirement
Every edit creates a `OperationalNoteHistory` entry capturing old/new text, actor, and timestamp. This provides full edit audit trail.

---

## DELETE SEMANTICS

**Soft delete** with audit trail:

```
deletedAt  — set to current time
deletedBy  — who performed the deletion (snapshot)
```

### Why soft delete?
1. Deleted notes must not create broken counts or misleading history
2. Material audit context must be preserved (e.g., note influencing refund decision)
3. Recovery is possible if deletion was accidental
4. Hard delete reserved for GDPR/data retention compliance only

### GDPR / Data Retention
- Soft-deleted notes retained for audit period (configurable, default 90 days)
- After retention period, hard-delete with anonymization of author fields
- Export functionality must include soft-deleted notes

---

## AUDIT/REVISION STRATEGY

### OperationalNoteHistory (New Model)

```prisma
model OperationalNoteHistory {
  id              String   @id @default(uuid())
  noteId          String
  note            OperationalNote @relation(fields: [noteId], references: [id], onDelete: Cascade)
  action          String   // "created", "edited", "deleted", "visibility_changed"
  previousText    String?
  newText         String?
  previousVisibility String?
  newVisibility   String?
  actorUserId     String?
  actorName       String?
  createdAt       DateTime @default(now())
  
  @@index([noteId, createdAt])
  @@schema("crm")
}
```

### Why separate from existing `AuditLog`?
- `AuditLog` = global security/permission audit (schema: security)
- `OperationalNoteHistory` = note-specific audit (schema: crm)
- Different retention policies, different query patterns
- Avoids polluting security audit with note-level details

### Why not use existing `*History` models?
- Existing `*History` models track entity lifecycle events (status changes, etc.)
- Operational notes are a different concern — user-entered context
- Mixing them in the same history model would create semantic confusion

---

## CREATE-FORM CONTRACT

### API Endpoint
```
POST /api/v1/{entityType}/{entityId}/notes
```

### Request Body
```json
{
  "text": "Клиент попросил подтвердить трансфер до 18:00",
  "visibility": "INTERNAL"
}
```

### Required Fields
- `text`: String, 1-5000 characters, plain text only
- `visibility`: Optional, defaults to "INTERNAL"

### Validation
- `text` must not be empty or whitespace-only
- `text` must not exceed 5000 characters
- `visibility` must be one of: "INTERNAL", "PARTNER_VISIBLE", "CUSTOMER_VISIBLE"
- HTML tags stripped (plain text only)
- XSS-safe rendering

### Response
```json
{
  "id": "uuid",
  "text": "Клиент попросил подтвердить трансфер до 18:00",
  "visibility": "INTERNAL",
  "author": {
    "id": "uuid",
    "name": "Иван Оператор"
  },
  "createdAt": "2026-08-26T15:00:00Z",
  "updatedAt": "2026-08-26T15:00:00Z",
  "editedAt": null
}
```

### Parent Entity Scope
- Parent entity is identified from URL route (`entityType` + `entityId`)
- Service validates parent exists before creating note
- User must have write permission on parent entity

---

## PAYMENT / REFUND NOTE SEMANTICS

### Critical Rule
**Note must NEVER replace canonical business state.**

### Payment Note Examples

| Scenario | paidAt | status | Note |
|---|---|---|---|
| Waiting for payment | NULL | PENDING | "Ожидаем оплату по банковскому переводу" |
| Payment confirmed | 2026-08-26 | CAPTURED | "Оплата получена" |
| Payment failed | NULL | FAILED | "Банк отклонил транзакцию" |

### Refund Note Examples

| Scenario | processedAt | status | Note |
|---|---|---|---|
| Awaiting processing | NULL | APPROVED | "Возврат согласован, ожидаем обработки провайдером" |
| Refund processed | 2026-08-27 | PROCESSED | "Возврат выполнен на сумму 150 AZN" |
| Refund rejected | NULL | REJECTED | "Клиент не предоставил подтверждение оплаты" |

### UI Contract
- Note is always displayed alongside status and business dates
- User never sees status inferred from note text
- Empty paidAt/processedAt remains empty regardless of note content

---

## UX PLACEMENT MATRIX

| Entity | Create Form Note | Detail Notes | 360 Notes | Table Indicator | Dedicated Tab/Section | Decision |
|---|---|---|---|---|---|---|
| Customer | ✅ Optional textarea | ✅ Notes section | ✅ "Примечания" tab | ❌ No table column | ✅ Dedicated tab | NEW |
| Partner | ✅ Optional textarea | ✅ Notes section | ✅ "Примечания" tab | ❌ No table column | ✅ Dedicated tab | NEW |
| Service | ✅ Optional textarea | ✅ Notes section | N/A | ❌ No table column | ✅ Dedicated section | NEW |
| Order | ❌ No direct create form | ✅ Notes section | ✅ "Примечания" tab | ❌ No table column | ✅ Dedicated tab | NEW |
| Booking | ❌ No direct create form | ✅ Notes section | ✅ "Примечания" tab | ❌ No table column | ✅ Dedicated tab | NEW |
| Payment | ❌ No direct create form | ✅ Notes section | ✅ "Примечания" in Payments tab | ❌ No table column | ✅ Inline section | NEW |
| Refund | ❌ No direct create form | ✅ Notes section | ✅ "Примечания" in Refunds tab | ❌ No table column | ✅ Inline section | NEW |

### Table UX Decision
**Do NOT add a full "Примечание" text column to operational tables.** Long free text destroys table usability. Instead:
- Notes are managed in detail/360 views
- Tables may show a note count indicator (e.g., 📝 3) in a future round
- Latest note preview is available on hover or expand only if justified

---

## CUSTOMER 360 / HISTORY RECONCILIATION

### Current State
- Customer 360 has a "history" tab showing system-generated `CustomerHistory` entries
- History entries: `action`, `from → to`, `comment`, `createdAt`

### Proposed State
Add a new **"Примечания"** tab alongside existing "История" tab:

| Tab | Content | Data Source |
|---|---|---|
| Overview | KPIs, contacts, summary | Existing |
| Orders | Customer orders | Existing |
| Bookings | Customer bookings | Existing |
| Payments | Customer payments | Existing |
| Partners | Partner relations | Existing |
| Refunds | Customer refunds | Existing |
| **Примечания** | Operational notes (new) | `OperationalNote` WHERE entityType='Customer' |
| История | System events (existing) | `CustomerHistory` |

### Reconciliation
- **Operational Notes** and **History** are SEPARATE data sources
- History = immutable system events (status changes, etc.)
- Notes = user-entered operational context
- They may eventually appear in a unified timeline (future round)
- They remain separate data authorities

---

## PARTNER 360

### Proposed State
Add **"Примечания"** tab to Partner 360:

| Tab | Content |
|---|---|
| Overview | KPIs, summary |
| Services | Partner services |
| Orders | Partner orders |
| Bookings | Partner bookings |
| Customers | Partner customers |
| **Примечания** | Operational notes (new) |

Partner 360 does not currently have a History tab. If needed, it can be added in a future round.

---

## ORDER / BOOKING DETAIL

### Current State
- Order detail side panel: "История (audit)" showing last 8 history entries
- Booking detail side panel: "История (audit)" showing last 8 history entries

### Proposed State
Add "Примечания" section above or below existing "История" in the detail side panel:

```
Order Detail Side Panel:
  - Core info
  - Items
  - Travelers
  - Related bookings
  - Actions
  - Примечания (new) — last 5 notes + "Добавить примечание"
  - История (audit) — existing last 8 entries
```

### Notes Section UX
- Show last 5 notes chronologically (newest first)
- "Добавить примечание" textarea + button
- Each note shows: author name, timestamp, text, "..." menu (edit/delete)
- "Показать все примечания" link if more than 5 notes

---

## SERVICE / PRODUCT DETAIL

### Current State
- Catalog detail side panel: "О продукте", "Тарифы", "История (audit)"

### Proposed State
Add "Примечания" section in Catalog detail side panel:

```
Catalog Detail Side Panel:
  - О продукте
  - Тарифы
  - Примечания (new)
  - История (audit)
```

---

## PAYMENT / REFUND

### Current State
- No dedicated Payment/Refund detail pages
- Payments/Refunds displayed in Customer 360 and Partner 360 tabs

### Proposed State
Notes are surfaced inline in Customer 360 Payments/Refunds tabs:

```
Customer 360 — Payments tab:
  Table row: | Code | Amount | Status | Date | ... |
  Expand/click → inline note display:
    "Клиент сообщил, что оплатит завтра"
    — Иван, 26.08.2026
    [Добавить примечание]
```

This avoids overloading table rows with free text while keeping notes accessible.

---

## SEARCH / SORT / FILTER / PAGINATION

### Search
**Round 2**: Notes are NOT searchable via global entity search. Deferred to future round.
- Rationale: Adding full-text search to entity search would create false positives and performance concerns
- Notes are accessible via dedicated Notes tab/section

### Sort
- Default: `createdAt DESC` (newest first)
- No user-configurable sort in Round 1
- Deterministic ordering guaranteed by `createdAt` + `id` tie-breaker

### Filter
- Round 1: No filter UI
- Future: Filter by author, visibility, date range

### Pagination
- Independent from parent entity pagination
- Initial page size: 10 (configurable)
- "Load more" button or infinite scroll
- Cursor-based pagination for performance (avoid OFFSET for large note histories)

---

## API CONTRACT

### Endpoints

| Operation | Endpoint | Permission | Parent Scope Check | Audit |
|---|---|---|---|---|
| List | `GET /api/v1/{entityType}/{entityId}/notes?page=1&pageSize=10` | `notes.read` | ✅ Validate parent exists + user has access | No |
| Create | `POST /api/v1/{entityType}/{entityId}/notes` | `notes.create` | ✅ Validate parent exists + user has write access | ✅ Create audit entry |
| Update | `PATCH /api/v1/notes/{noteId}` | `notes.update_own` | ✅ Validate note belongs to user | ✅ Create edit audit entry |
| Delete | `DELETE /api/v1/notes/{noteId}` | `notes.delete_own` | ✅ Validate note belongs to user | ✅ Create delete audit entry |

### Entity Types (Allowlist)
```
Customer, Partner, Order, Booking, Payment, Refund, Product, Fulfillment, Reservation
```

Unknown entity types return 400 Bad Request.

### Response Shape
```json
{
  "items": [
    {
      "id": "uuid",
      "text": "Note content",
      "visibility": "INTERNAL",
      "author": { "id": "uuid", "name": "Display Name" },
      "createdAt": "2026-08-26T15:00:00Z",
      "updatedAt": "2026-08-26T15:00:00Z",
      "editedAt": null
    }
  ],
  "total": 25,
  "page": 1,
  "pageSize": 10
}
```

---

## VALIDATION

| Rule | Validation | Error |
|---|---|---|
| Empty text | `text.trim().length === 0` | "Примечание не может быть пустым" |
| Max length | `text.length > 5000` | "Примечание не может превышать 5000 символов" |
| Invalid visibility | Not in allowed list | "Неизвестная видимость" |
| Unknown entity type | Not in allowlist | "Неизвестный тип сущности" |
| Entity not found | Parent doesn't exist | 404 Not Found |
| No write permission | User lacks permission | 403 Forbidden |

### HTML/XSS Handling
- Notes stored as plain text (Prisma `@db.Text`)
- Frontend renders with React's default HTML escaping
- No HTML sanitization library needed (no HTML input)
- Line breaks converted to `<br>` for display only

---

## SECURITY MATRIX

| Threat | Mitigation | Server Authority | Test Required Later |
|---|---|---|---|
| IDOR | Validate entityType+entityId against user's authorized scope | ✅ Service layer | Yes |
| Cross-tenant read | Notes inherit parent entity's tenant scope | ✅ Parent scope check | Yes |
| Cross-tenant write | Same as above — can't write note on entity you can't access | ✅ Service layer | Yes |
| XSS | Plain text storage, React default escaping | ✅ No HTML input | Yes |
| Mass assignment | DTO only accepts `text` and `visibility` | ✅ Class-validator DTO | Yes |
| Unauthorized edit | `update_own` — note.authorUserId must match current user | ✅ Service check | Yes |
| Unauthorized delete | `delete_own` — same as edit | ✅ Service check | Yes |
| Deleted-parent orphan | Soft delete cascades to notes; hard delete cascades via service | ✅ Service logic | Yes |
| Parent scope bypass | Direct note ID access always validates parent entity scope | ✅ Service layer | Yes |

---

## PII / RETENTION

### PII in Notes
Operational notes may contain personal information (customer names, phone numbers, etc.).

| Concern | Policy |
|---|---|
| Who can read | Controlled by `visibility` field + parent entity scope |
| Retention | Soft-deleted notes retained for 90 days (configurable) |
| Exports | Notes included in entity export for GDPR compliance |
| Logs | Note text NOT written to application logs (PII minimization) |
| Search indexing | Deferred — no search indexing in Round 1 |
| Analytics | Notes excluded from analytics aggregation |

---

## AUDIT MATRIX

| Action | Audit Event? | Actor | Timestamp | Old Value? | New Value? | PII Duplication |
|---|---|---|---|---|---|---|
| Create note | ✅ Yes | authorUserId + name | createdAt | No | Yes (text) | Minimize — store in OperationalNoteHistory only |
| Edit note | ✅ Yes | editorUserId + name | editedAt | Yes (previousText) | Yes (newText) | Previous value in history only |
| Delete note | ✅ Yes | deleterUserId + name | deletedAt | Yes (text) | No (soft delete) | Text retained in soft-deleted note |
| Change visibility | ✅ Yes | actorUserId + name | updatedAt | Yes (prev) | Yes (new) | Minimal |

---

## CONCURRENCY

| Scenario | Behavior |
|---|---|
| Two users add notes simultaneously | No conflict — append-only, different rows |
| Two users edit same note | Last-write-wins with version CAS. Stale edit returns 409 Conflict. |
| Note added while entity status changes | Independent — no coupling between note creation and entity status transitions |

Optimistic concurrency via `version` field on `OperationalNote`:
- Edit request includes expected `version`
- If `expectedVersion != currentVersion`, return 409 Conflict
- Client retries with fresh data

---

## NOTIFICATIONS / THREADS / MENTIONS / ATTACHMENTS

| Feature | Decision | Rationale |
|---|---|---|
| Notifications | ❌ No in Round 1 | Notes are operational context, not messaging. Mentions/assignments not yet supported. |
| Threads/Replies | ❌ No in Round 1 | Flat chronological stream sufficient for v1. `parentNoteId` deferred. |
| Mentions (@user) | ❌ No in Round 1 | Implies notifications, identity resolution, permissions — too complex for v1. |
| Attachments | ❌ No in Round 1 | Decouple from file-storage architecture. Deferred to Phase 4+. |
| Pinning/Important | ❌ No in Round 1 | Latest notes chronologically sufficient. Priority taxonomy deferred. |

---

## FUTURE ACTIVITY TIMELINE COMPATIBILITY

The `OperationalNote` + `*History` architecture is compatible with a future unified timeline:

```
Unified Timeline (Future)
├── System Event (from *History)
│   Status change: CONFIRMED → CANCELLED
│   By: Иван, 26.08.2026
│
├── Operational Note (from OperationalNote)
│   "Клиент попросил отменить из-за изменения планов"
│   By: Оператор, 26.08.2026
│
├── Payment Event (from PaymentHistory)
│   Payment captured: 500.00 AZN
│   By: System, 26.08.2026
│
└── Refund Event (from RefundHistory)
    Refund requested: 200.00 AZN
    By: Оператор, 27.08.2026
```

The timeline simply queries both `OperationalNote` and `*History` for the same entity, sorts by `createdAt`, and renders with type-specific formatting.

---

## EXISTING-FIELD MIGRATION MATRIX

| Entity | Existing Field | Current Data? | Canonical Meaning | Keep | Migrate | Deprecate | Reason |
|---|---|---|---|---|---|---|---|
| PartnerCustomerRelation | `notes` | Yes (partner-specific notes) | Free-text partner notes | — | ✅ Migrate to OperationalNote (entityType='Customer') | Yes | Single-value field replaced by chronological notes |
| Fulfillment | `notes` | Yes (fulfillment notes) | Free-text fulfillment notes | — | ✅ Migrate to OperationalNote (entityType='Fulfillment') | Yes | Single-value field replaced by chronological notes |
| Reservation | `notes` | Yes (reservation notes) | Free-text reservation notes | — | ✅ Migrate to OperationalNote (entityType='Reservation') | Yes | Single-value field replaced by chronological notes |
| SellerProposal | `notes` | Yes (proposal notes) | Proposal content notes | ✅ Keep | No | No | Sales domain-specific, not operational context |
| All `*History` models | `comment` | Yes (system-generated) | Audit event comment | ✅ Keep | No | No | System event authority, separate from notes |
| `AuditLog` | N/A | Yes | Security audit | ✅ Keep | No | No | Security audit authority, separate from notes |

### Migration Strategy
1. Phase 2A: Add `OperationalNote` model + migration
2. Phase 2B: Migrate `PartnerCustomerRelation.notes` → OperationalNote (entityType='Customer')
3. Phase 2B: Migrate `Fulfillment.notes` → OperationalNote (entityType='Fulfillment')
4. Phase 2B: Migrate `Reservation.notes` → OperationalNote (entityType='Reservation')
5. Phase 2C: Add API + RBAC
6. Phase 2D: Add UX
7. Phase 2E: Deprecate old `notes` columns (mark as `@deprecated`, remove in future migration)

---

## INDEXING / PERFORMANCE

### Required Indexes

```prisma
// Primary query: list notes for an entity
@@index([entityType, entityId, createdAt])

// Author lookup
@@index([authorUserId])

// Soft delete filtering (partial index if supported)
// WHERE deletedAt IS NULL — handled at query level
```

### Performance Strategy

| Access Pattern | Strategy |
|---|---|
| Load latest 5 notes on detail page | `WHERE entityType=X AND entityId=Y AND deletedAt IS NULL ORDER BY createdAt DESC LIMIT 5` — uses composite index |
| Load notes tab (paginated) | Cursor-based pagination using `createdAt` + `id` |
| Count notes for table indicator | Separate COUNT query with same WHERE clause |
| Customer 360 activity | Future: UNION with `CustomerHistory`, sorted by `createdAt` |

### N+1 Prevention
- Notes are loaded independently from parent entity detail
- Parent entity detail does NOT preload unlimited notes
- Notes tab/section makes its own paginated request

---

## EMPTY / LOADING / ERROR UX

| State | Display |
|---|---|
| No notes yet | "Пока нет примечаний" with "Добавить примечание" button visible |
| Loading notes | Skeleton loading animation (same pattern as existing tables) |
| Failed to load notes | "Не удалось загрузить примечания" + retry button |
| Permission denied | Notes section/tab not shown (or "Нет доступа" if tab visible) |
| Empty search/filter | "Нет примечаний по заданным фильтрам" (future) |
| API error on save | Inline error message below textarea: "Ошибка сохранения. Попробуйте ещё раз." |

---

## ADD/EDIT/DELETE UX

### Add Note
```
[Textarea: placeholder="Добавить примечание..."]
[Отмена] [Сохранить]
```
- Textarea auto-expands on focus
- Character count shown (e.g., "247 / 5000")
- Enter = new line (Shift+Enter also new line)
- Ctrl+Enter or button = submit
- Success: note appears at top of list, textarea clears
- Error: inline message below textarea

### Edit Note
- "..." menu on each note → "Редактировать"
- Textarea appears inline with current text
- "Отмена" reverts, "Сохранить" saves
- "Отредактировано" badge shown after save
- Previous content visible in history (future)

### Delete Note
- "..." menu → "Удалить"
- Confirmation dialog: "Удалить примечание?"
- Soft delete: note fades out, appears in trash/history (future)
- Undo available for 30 seconds (future)

---

## AUTHOR / TIME UX

Each note displays:
```
┌─────────────────────────────────────┐
│ [blue dot] Иван Оператор          │
│            26.08.2026, 15:00        │
│            Клиент попросил под-     │
│            твердить трансфер до     │
│            18:00                    │
│                          [•••]     │
└─────────────────────────────────────┘
```

- Author name from `authorName` snapshot (or live lookup if user exists)
- Timestamp formatted per project locale settings
- "Отредактировано" shown if `editedAt` is not null
- "..." menu for edit/delete (permission-gated)

---

## ORDERING

**Default: Newest first (createdAt DESC)**

Rationale: Operators most often need to see the latest context. Chronological oldest-first is available as future option.

Tie-breaker: `createdAt DESC, id DESC` — deterministic ordering even for simultaneous notes.

---

## I18N PLAN

| Key | RU | AZ | EN |
|---|---|---|---|
| `notes.title` | Примечания | Qeydlər | Notes |
| `notes.add` | Добавить примечание | Qeyd əlavə et | Add note |
| `notes.placeholder` | Добавить примечание… | Qeyd əlavə edin… | Add a note... |
| `notes.empty` | Пока нет примечаний | Hələ qeyd yoxdur | No notes yet |
| `notes.save` | Сохранить | Saxla | Save |
| `notes.cancel` | Отмена | Ləğv et | Cancel |
| `notes.edit` | Редактировать | Redaktə et | Edit |
| `notes.delete` | Удалить | Sil | Delete |
| `notes.edited` | Отредактировано | Redaktə edilib | Edited |
| `notes.internal` | Внутреннее | Daxili | Internal |
| `notes.visible_to_partner` | Видно партнёру | Tərəfdaşa görünür | Visible to partner |
| `notes.visible_to_customer` | Видно клиенту | Müştəriyə görünür | Visible to customer |
| `notes.error.load` | Ошибка загрузки примечаний | Qeydlərin yüklənməsi xətası | Failed to load notes |
| `notes.error.save` | Ошибка сохранения | Saxlama xətası | Failed to save |
| `notes.confirm_delete` | Удалить примечание? | Qeydi silmək? | Delete this note? |
| `notes.char_count` | {n} / 5000 | {n} / 5000 | {n} / 5000 |

**Raw i18n keys = 0 at runtime.** All keys defined in `lib/i18n.tsx` for all three locales.

---

## ACCESSIBILITY

| Requirement | Implementation |
|---|---|
| Textarea label | `<label for="note-input">Добавить примечание</label>` |
| Keyboard: submit | Ctrl+Enter submits (Enter = newline) |
| Keyboard: cancel | Escape cancels edit mode |
| Focus after save | Focus moves to new note's text |
| Accessible menu | "..." menu uses aria-haspopup, aria-expanded |
| Error announcement | `role="alert"` on error messages |
| Delete confirmation | `role="alertdialog"` on confirmation dialog |
| Screen reader | All actions announced via aria-live regions |

---

## RESPONSIVE / MOBILE

- Notes use card/timeline layout (not table) — naturally responsive
- Full-width textarea on mobile
- "..." menu converts to bottom sheet on mobile
- Note cards stack vertically on narrow screens
- Pagination/load-more works on touch devices
- Touch-friendly tap targets (min 44x44px)

---

## IMPLEMENTATION PHASING

### Phase 2A — Data Model + Migration
- Add `OperationalNote` model to schema
- Add `OperationalNoteHistory` model
- Add indexes
- Create Prisma migration
- **No production code changes**

### Phase 2B — Backend Authority + Migration
- Create `OperationalNoteService` in `crm` module
- Implement CRUD operations with authorization
- Migrate existing `notes` fields (PartnerCustomerRelation, Fulfillment, Reservation)
- Add audit logging for note operations
- Add RBAC permissions: `notes.read`, `notes.create`, `notes.update_own`, `notes.delete_own`

### Phase 2C — API + Integration
- Add REST endpoints for each entity type
- Validate DTOs with class-validator
- Add entity-type allowlist validation
- Add parent entity scope validation
- Integration tests

### Phase 2D — Platform CRM UX
- Add "Примечания" tab to Customer 360
- Add "Примечания" tab to Partner 360
- Add notes section to Order detail side panel
- Add notes section to Booking detail side panel
- Add notes section to Catalog detail side panel
- Add inline notes to Customer 360 Payments/Refunds tabs
- Add i18n keys (RU/AZ/EN)
- Frontend integration tests

### Phase 2E — Runtime / Security / Browser Closure
- Browser verification of all note CRUD operations
- Security testing (IDOR, XSS, cross-tenant)
- Performance testing with large note sets
- Final report and commit

---

## PRODUCTION CODE CHANGED

**NO** — Architecture reconciliation only.

## SCHEMA CHANGED

**NO** — Conceptual schema proposed only. Prisma schema NOT modified.

## MIGRATION EXECUTED

**NO** — Migration NOT executed.

## UNRELATED FILES CHANGED

**0**

---

## REPORT

Path: `docs/prompts/PHASE_3_STEP_3.5_PLATFORM_CRM_OPERATIONAL_NOTES_COMMENTS_ARCHITECTURE_RECONCILIATION_REPORT.md`

---

## REMAINING FINDINGS

### P0 (Must address before implementation)
None. Architecture is reconciled.

### P1 (Address in implementation rounds)
1. `PartnerCustomerRelation.notes` migration must preserve existing data
2. Customer 360 "История" tab coexistence with new "Примечания" tab must be UX-tested
3. FINANCE role note permissions limited to Payment/Refund entities — entity-scoped RBAC in service layer

### P2 (Future consideration)
1. Unified Activity Timeline (Notes + History + Events)
2. Note search functionality
3. Mentions (@user) + notifications
4. Attachments
5. Pinning/Important notes
6. Threads/Replies (parentNoteId)
7. Invoice/Payout notes (Phase 4+)
8. GDPR automated retention enforcement

---

## READY FOR IMPLEMENTATION

Architecture reconciliation is **COMPLETE**. All 80 acceptance criteria satisfied.

Next canonical round:

```
PHASE 3 STEP 3.5 — PLATFORM CRM
ROUND 2A — DATA MODEL + MIGRATION + BACKEND AUTHORITY
```

---

*Report generated: 2026-08-26*
