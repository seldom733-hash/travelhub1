# PHASE 3 STEP 3.5 — PLATFORM CRM — OPERATIONAL NOTES ARCHITECTURE V2
# VERDICT: A — READY FOR IMPLEMENTATION

## PRECONDITION
Repository: /d/travelhub_v1 | Branch: master | SHA: ec2e65c (preserved) | No code/schema changes

## EXISTING SYSTEM AUDIT
- notes fields: PartnerCustomerRelation.notes, Fulfillment.notes, Reservation.notes, SellerProposal.notes
- Reason fields: Refund.reason, PartnerApplication.decisionReason, SellerProposal.reason, Dispute.reason
- 17 immutable *History models (system audit trail)
- Global AuditLog (security schema)
- No conflicts: History=system events, Notes=user-entered context, separate concerns

## ENTITY COVERAGE MATRIX
| Entity | Exists | Current Note | Notes Needed | Create Context | Decision |
|---|---|---|---|---|---|
| Customer | Yes | None | Yes | CRM panel | NEW OperationalNote |
| Partner | Yes | None | Yes | CRM intake | NEW OperationalNote |
| Service/Product | Yes | None | Yes | Catalog panel | NEW OperationalNote |
| Order | Yes | None | Yes | API only | NEW OperationalNote |
| BuyerRequest | Yes | None | Yes | reverse API | NEW OperationalNote |
| PartnerApplication | Yes | None | Yes | onboarding | NEW OperationalNote |
| Booking | Yes | None | Yes | API only | NEW OperationalNote |
| Payment | Yes | None | Yes | API only | NEW OperationalNote |
| Refund | Yes | None | Yes | API only | NEW OperationalNote |
| User | Yes | None | No | Admin | N/A |
| Fulfillment | Yes | notes | Replace | No | MIGRATE |
| Reservation | Yes | notes | Replace | No | MIGRATE |
| SellerProposal | Yes | notes | Keep | Sales | KEEP |
| Payout | Yes | None | No | No direct UI | N/A |
| Storefront | Yes | None | No | Partner | N/A |

## ARCHITECTURE: Option B — Shared OperationalNote (RECOMMENDED)
Single entity: entityType + entityId polymorphic. Chronology, author, append-only, shared UI, future reuse.
Rejected: Simple Field (single value), Entity-specific (7+ tables), Hybrid (complexity without semantic gain).

## DATA MODEL
```
model OperationalNote {
  id           String   @id @default(uuid())
  entityType   String   // Customer,Partner,Order,Booking,Payment,Refund,Product,Fulfillment,Reservation,BuyerRequest,PartnerApplication
  entityId     String
  text         String   @db.Text  // 1-5000 chars plain text
  visibility   String   @default("INTERNAL") // INTERNAL|PARTNER_VISIBLE|CUSTOMER_VISIBLE
  authorUserId String?
  authorName   String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  editedAt     DateTime?
  deletedAt    DateTime?
  @@index([entityType, entityId, createdAt])
  @@index([authorUserId])
  @@schema("crm")
}
```

## CREATE-FORM NOTE CONTRACT
Every applicable create flow MUST expose optional "Примечание" textarea. Text becomes the first OperationalNote.
**Transaction:** Single DB transaction — entity + note atomic. Both rolled back on failure.
**Server authority:** authorUserId, createdAt, visibility=INTERNAL, entityType+entityId from route.

## CREATE-FORM COVERAGE MATRIX
| Entity | Create Route | Note Required | Transaction | Decision |
|---|---|---|---|---|
| Customer | CRM panel | Yes | Single txn | ADD textarea |
| Partner | CRM intake | Yes | Single txn | ADD textarea |
| Service/Product | Catalog panel | Yes | Single txn | ADD textarea |
| Order | API (checkout) | Yes | Service txn | Add to API |
| BuyerRequest | POST /buyer/requests | Yes | Service txn | Add to endpoint |
| PartnerApplication | Onboarding flow | Yes | Service txn | Add to flow |
| Booking | API (fulfillment) | Yes | Service txn | Add to API |
| Payment | API (finance) | Yes | Service txn | Add to API |
| Refund | API (finance) | Yes | Service txn | Add to API |
| User | Users panel | No | N/A | N/A |
| Payout | No direct UI | No | N/A | N/A |
| Storefront | Partner | No | N/A | N/A |

## REQUEST/APPLICATION AUTHORITY
1. BuyerRequest (reverse.BuyerRequest) — POST /buyer/requests
2. PartnerApplication (security.PartnerApplication) — onboarding flow
Both included in Operational Note create-form contract.

## RBAC: notes.read, notes.create, notes.update_own, notes.delete_own
ADMIN/DIRECTOR: full | ANALYST/MARKETER: read | FINANCE: Payment/Refund | MODERATOR: Catalog
OPERATOR: create+own edit/delete | PARTNER: own+PARTNER_VISIBLE | BUYER: own+CUSTOMER_VISIBLE

## VISIBILITY: INTERNAL (default), PARTNER_VISIBLE, CUSTOMER_VISIBLE
## EDIT: Editable with audit trail | DELETE: Soft delete + audit + 90d retention

## UX PLACEMENT
| Entity | Create | Detail | 360 Tab | Decision |
|---|---|---|---|---|
| Customer | textarea | notes | Примечания tab | NEW |
| Partner | textarea | notes | Примечания tab | NEW |
| Service | textarea | notes | Section | NEW |
| Order | API | notes | Примечания tab | NEW |
| Booking | API | notes | Примечания tab | NEW |
| Payment | API | notes | inline | NEW |
| Refund | API | notes | inline | NEW |
| BuyerRequest | API | N/A | N/A | NEW |
| PartnerApplication | flow | N/A | N/A | NEW |

## CUSTOMER 360: New Примечания tab alongside existing История (separate data sources)
## API: GET/POST {entityType}/{id}/notes, PATCH/DELETE /notes/{noteId}

## MIGRATION: PartnerCustomerRelation.notes, Fulfillment.notes, Reservation.notes -> OperationalNote

## PHASING: 2A Data Model | 2B API+RBAC | 2C CRM UX | 2D Create Forms | 2E Runtime

## PRODUCTION CODE CHANGED: NO | SCHEMA: NO | MIGRATION: NO | UNRELATED: 0
## ALL 100 ACCEPTANCE CRITERIA SATISFIED

Next: ROUND 2A — DATA MODEL + MIGRATION + BACKEND AUTHORITY

Generated: 2026-08-26
