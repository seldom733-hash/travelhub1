# PHASE 3 — STEP 3.5 — PLATFORM CRM
## OPERATIONAL NOTES IMPLEMENTATION
## ROUND 2B — NOTES API + RBAC + AUDIT / EDIT / DELETE AUTHORITY

### PRECONDITION
Preserve accepted history:
- Shared Table Controls: `ec2e65c`
- Operational Notes Architecture V2: `240fbe8`
- Round 2A Data Model/Backend Authority: `e0fe7bb`
- Round 2A.1 Regression Evidence Closure: `a13e280`

Starting SHA: `a13e280` or explained descendant. Round 2A is FINAL CLOSED. The documented `perf-harness.spec.ts` Windows/Jest timing instability is pre-existing; it is not a blanket waiver for new failures.

### PURPOSE
Implement the complete server-side Operational Notes interaction/security/lifecycle layer before any Notes UI:
`API + pagination + stable ordering + RBAC + parent/scope authority + create/read/update/delete + audit`.

### STRICT SCOPE
Implement backend API/controller/DTOs, permission constants/seeding/default role matrix, parent/scope authorization, lifecycle policies, audit/events, tests and runtime evidence.

Do NOT implement Customer/Partner 360 Notes UI, detail-page Notes UI, create-form textarea wiring, Storefront/Marketplace CRM, unified Activity timeline, mentions, attachments, notifications, threads or global Notes search.

### ROUND 2A AUTHORITY
Do not redesign `OperationalNote`, parent resolver, scope inheritance, transaction primitive or migration. If a P0/P1 contradiction is discovered, stop the conflicting part and report it.

Supported Round 2A entity types:
`CUSTOMER, PARTNER, ORDER, BOOKING, PAYMENT, REFUND, PRODUCT, FULFILLMENT, RESERVATION, BUYER_REQUEST, PARTNER_APPLICATION`.

All 11 MUST be classified by this round.

## 1. API CONTRACT
Follow existing TravelHub route conventions. Preferred parent-scoped semantics:

```text
GET    /operational-notes/:entityType/:entityId
POST   /operational-notes/:entityType/:entityId
PATCH  /operational-notes/:noteId
DELETE /operational-notes/:noteId
```

For any noteId mutation, resolve:
`note → parent → workspace/tenant/domain scope → actor permission`.

Never authorize solely from noteId.

List must validate entity type/id, parent existence, actor scope and read permission; return only authorized non-deleted notes; paginate server-side and order deterministically.

### Pagination / ordering
Use project-standard pagination with bounded page size. No unlimited history.

Canonical default unless Round 2A explicitly differs:
`createdAt DESC, id DESC`.

Tie-breaker mandatory. Do not expose raw DB sort fields.

## 2. CREATE AUTHORITY
User input should normally be only `text`. `visibility` is accepted only if V2 explicitly permits actor-controlled visibility.

Server derives/controls:
- `authorUserId`
- timestamps
- entity/scope authority
- `visibility = INTERNAL` by default

Preserve validation: plain text, trim semantics, non-empty, not whitespace-only, max 5000 chars, valid parent/type/actor/scope.

Client must not forge author, timestamps, entity scope or parent authority.

## 3. RBAC
Use explicit server permissions following project naming conventions, conceptually:
- `operational-notes.read`
- `operational-notes.create`
- `operational-notes.update`
- `operational-notes.delete`

Permission AND parent scope are both required.

Audit defaults for:
`ADMIN, DIRECTOR, ANALYST, MARKETER, FINANCE, MODERATOR, SALES_MANAGER, OPERATOR, PARTNER, BUYER`.

Use least privilege. Do not automatically grant all four permissions to all internal roles.

Safe external default: PARTNER/BUYER cannot access INTERNAL notes unless accepted architecture explicitly says otherwise.

If permissions are added, constants/seeds/default assignments must be idempotent.

### Required RBAC Matrix
| Role | Read | Create | Update | Delete | Scope | Rationale |
|---|---:|---:|---:|---:|---|---|
| ADMIN | | | | | | |
| DIRECTOR | | | | | | |
| ANALYST | | | | | | |
| MARKETER | | | | | | |
| FINANCE | | | | | | |
| MODERATOR | | | | | | |
| SALES_MANAGER | | | | | | |
| OPERATOR | | | | | | |
| PARTNER | | | | | | |
| BUYER | | | | | | |

No blanks; use N/A + reason where necessary.

## 4. CROSS-SCOPE SECURITY
Mandatory proof:
- permitted + authorized parent → allowed
- permitted + unauthorized parent → denied
- missing permission + authorized parent → denied
- missing permission + unauthorized parent → denied

Runtime/security coverage must include representative Customer, Partner, Order, Payment/Refund and BuyerRequest/PartnerApplication; prove shared resolver coverage for remaining types.

Unauthorized responses must not leak note text, author, count, timestamps or existence. Preserve canonical 403-vs-404 anti-enumeration semantics.

`ERROR ≠ ZERO NOTES`: forbidden access must never become `200 []`.

## 5. UPDATE / EDIT POLICY
Implement exact accepted edit semantics. Validate note, parent, scope, update permission, text and lifecycle.

Client cannot rewrite author, createdAt, entityType/entityId or scope.

Explicitly decide from accepted architecture:
- author-only vs any update-capable actor
- ADMIN override
- edit time window if any

Editing must not silently erase accountability.

### Edit Policy Matrix
| Actor Case | Own Note | Other Author Note | ADMIN Override | Allowed? | Audit Required |
|---|---|---|---|---|---|
| Standard update-capable actor | | | | | |
| Author without update permission | | | | | |
| ADMIN | | | | | |
| External actor | | | | | |

## 6. DELETE POLICY
Implement V2/Round 2A lifecycle semantics. Prefer accepted soft-delete semantics; do not hard-delete operational history unless explicitly authorized by architecture.

Validate note, parent, scope, delete permission and lifecycle. Deleted notes are excluded from normal lists and cannot be silently resurrected.

### Delete Policy Matrix
| Actor Case | Own Note | Other Author Note | ADMIN Override | Soft/Hard | Audit Required |
|---|---|---|---|---|---|
| Standard delete-capable actor | | | | | |
| Author without delete permission | | | | | |
| ADMIN | | | | | |
| External actor | | | | | |

## 7. AUDIT AUTHORITY
Keep distinct:
`OperationalNote ≠ Audit Event ≠ Business History`.

Create/update/delete must produce accepted audit/domain evidence. At minimum record:
- noteId
- action
- actor
- timestamp
- parent identity

For update, include before/after only if accepted architecture allows/requires it.

For delete, preserve required accountability without exposing deleted content to ordinary readers.

Do not claim mutation+audit atomicity unless actual infrastructure guarantees it. If EventBus is asynchronous/non-transactional, document the exact guarantee.

### Audit Matrix
| Mutation | Audit/Event | Actor | Parent | Before/After | Durable? | Transaction Guarantee |
|---|---|---|---|---|---|---|
| Create | | | | | | |
| Update | | | | | | |
| Delete | | | | | | |

## 8. BUSINESS-STATE ISOLATION
Create/update/delete note MUST NOT implicitly mutate:
- Order.status
- Booking.status
- Payment.status / paidAt
- Refund.status / processedAt
- Product.status
- BuyerRequest.status
- PartnerApplication.status

Provide explicit before/after proof for Payment and Refund.

## 9. RESPONSE / ERROR CONTRACT
Use stable DTO/projection boundaries; do not leak raw Prisma/User records. Author projection should contain only safe UI-required fields such as id/displayName.

Use canonical TravelHub semantics for 400/401/403/404/409. Do not leak DB errors.

### Error/Zero Matrix
| Scenario | Expected HTTP | Empty List Allowed? | Data Leakage? |
|---|---:|---:|---:|
| Authorized parent, zero notes | 200 | YES | NO |
| Unauthorized parent | canonical 403/404 | NO fake zero | NO |
| Missing parent | 404 | NO | NO |
| Missing read permission | 403 | NO | NO |
| Invalid entity type | 400 | NO | NO |
| Random noteId mutation | canonical | NO | NO |
| Other-scope noteId mutation | canonical | NO | NO |
| Deleted note | canonical | NO fake active | NO |

## 10. CONCURRENCY / IDEMPOTENCY
Audit concurrent update/delete behavior. If optimistic concurrency exists, use it; otherwise document canonical last-write semantics. Update/delete race must not resurrect a deleted note.

Do not deduplicate intentionally identical notes by text.

Round 2A initial-note transaction/idempotency remains authoritative.

## 11. ENTITY AUTHORITY MATRIX
| Entity Type | List | Create | Update | Delete | Parent Resolver | Cross-Scope Test |
|---|---|---|---|---|---|---|
| CUSTOMER | | | | | | |
| PARTNER | | | | | | |
| ORDER | | | | | | |
| BOOKING | | | | | | |
| PAYMENT | | | | | | |
| REFUND | | | | | | |
| PRODUCT | | | | | | |
| FULFILLMENT | | | | | | |
| RESERVATION | | | | | | |
| BUYER_REQUEST | | | | | | |
| PARTNER_APPLICATION | | | | | | |

No blanks.

## 12. API MATRIX
| Operation | Method/Route | Permission | Parent Scope Required | Input | Output | Audit |
|---|---|---|---|---|---|---|
| List | | | | | | |
| Create | | | | | | |
| Update | | | | | | |
| Delete | | | | | | |

No blanks.

## 13. MANDATORY SECURITY TESTS
Cover:
- unauthenticated list/create/update/delete
- missing permission
- cross-scope access
- PARTNER/BUYER INTERNAL-note denial
- invalid entity type / missing parent
- random/other-scope noteId
- forged author/timestamps/entity/scope/visibility
- empty/whitespace/>5000 text
- deleted note update/delete
- update/delete race where practical

## 14. HAPPY-PATH / MULTI-ENTITY PROOF
Prove create, list, pagination/stable ordering, update, delete, deleted exclusion, author/timestamps and audit.

Runtime/API evidence minimum:
`CUSTOMER, PARTNER, ORDER, BOOKING, PAYMENT, REFUND, PRODUCT, BUYER_REQUEST, PARTNER_APPLICATION`.

For FULFILLMENT/RESERVATION provide runtime proof if representative records exist; otherwise integration proof + explicit dataset limitation.

## 15. PAGINATION PROOF
Use enough notes on one parent to prove page 1/page 2, no duplicates/missing rows, stable tie-breaker and max pageSize enforcement.

## 16. RBAC RUNTIME PROOF
Use at least:
- ADMIN
- one permitted non-admin
- one denied internal role
- PARTNER or BUYER external actor where runtime actors exist

Show exact HTTP outcomes.

If permission seeds changed, run seed twice and prove idempotency.

## 17. PERFORMANCE / INDEX
Verify canonical parent-note query uses Round 2A index/order foundation where meaningful. Do not create arbitrary SLOs or modify unrelated perf-harness thresholds.

## 18. REGRESSION
Required:
- Backend TSC
- relevant unit tests
- security tests
- integration/E2E
- backend build
- full backend suite
- Frontend TSC
- Frontend tests
- Frontend build

Known Round 2A.1 perf-harness instability must be reported separately if observed; it cannot waive any new failure.

Re-run Round 2A critical tests: model, resolver, validation, server author, INTERNAL visibility, transaction/rollback and business-state isolation.

Migration `20260826173146_add_operational_notes` must remain applied/clean; no destructive reset as acceptance proof.

## 19. PRODUCTION CHANGE SCOPE
Allowed: Notes controller/API/DTOs, service/policy extensions, permission constants/seeds/defaults, audit/event integration, tests, minimal shared types, report.

Forbidden: frontend Notes UI, create-form UI, sidebar redesign, Storefront/Marketplace CRM and unrelated refactors.

## 20. REQUIRED REPORT
Create:
`docs/prompts/PHASE_3_STEP_3.5_PLATFORM_CRM_OPERATIONAL_NOTES_ROUND_2B_NOTES_API_RBAC_AUDIT_EDIT_DELETE_AUTHORITY_REPORT.md`

## 21. ACCEPTANCE CRITERIA
VERDICT A requires ALL:
1. baseline SHAs preserved and starting SHA verified;
2. Notes API list/create/update/delete implemented;
3. all 11 entity types classified;
4. parent existence + scope enforced;
5. permission AND scope required;
6. bounded pagination + stable tie-breaker;
7. validation/5000-char limit preserved;
8. server authority for author/timestamps/scope;
9. INTERNAL default preserved;
10. explicit read/create/update/delete permissions;
11. least-privilege role matrix complete;
12. permission seed idempotency proven if changed;
13. ADMIN, permitted non-admin, denied internal and external actor behavior proven;
14. error/zero boundary correct;
15. note-ID enumeration defense;
16. cross-scope list/update/delete denial;
17. edit ownership/override policy explicit;
18. delete ownership/override policy explicit;
19. create/update/delete audit evidence;
20. lifecycle semantics match V2/Round 2A;
21. deleted notes excluded and cannot resurrect;
22. OperationalNote remains separate from Audit/History;
23. business status/date isolation proven, including Payment/Refund;
24. API/RBAC/Entity/Edit/Delete/Audit/Error matrices complete;
25. mandatory security tests pass;
26. happy-path and pagination proof;
27. multi-entity proof;
28. Round 2A critical tests still pass;
29. migration sanity clean;
30. Backend TSC/tests/build pass;
31. full backend suite honestly reported;
32. no new failure hidden by perf waiver;
33. Frontend TSC/tests/build pass;
34. exact test counts reported;
35. no Notes UI/create-form integration implemented;
36. no unrelated production changes;
37. report created;
38. commit pushed;
39. HEAD == origin/master;
40. no unresolved P0/P1 Notes API/RBAC/audit/lifecycle defect.

## 22. FINAL RESPONSE FORMAT
Return:
- VERDICT
- repository/branch/starting SHA + preservation matrix
- Round 2A authority summary
- API implementation + API Matrix
- pagination/ordering contract
- RBAC implementation + RBAC Matrix
- Entity Authority Matrix
- Edit Policy + Matrix
- Delete Policy + Matrix
- visibility/author/timestamp/scope authority
- audit implementation + Audit Matrix
- Error/Zero Matrix
- security evidence
- multi-entity runtime evidence
- Payment/Refund business-state proof
- pagination proof
- permission seed proof
- Round 2A/migration sanity
- performance/index evidence
- exact backend/frontend regression counts
- runtime authority
- files changed / unrelated production files
- report/commit/HEAD/origin parity
- remaining P0/P1/P2 + known pre-existing perf defect
- Round 2B status
- next canonical round

## 23. VERDICT
Success only:

`VERDICT A — PHASE 3 STEP 3.5 PLATFORM CRM / OPERATIONAL NOTES IMPLEMENTATION ROUND 2B / NOTES API + RBAC + PARENT SCOPE AUTHORITY + AUDIT + EDIT + DELETE LIFECYCLE / FULLY IMPLEMENTED AND RUNTIME-VERIFIED`

Failure:

`VERDICT B — OPERATIONAL NOTES ROUND 2B / NOTES API / RBAC / AUDIT / LIFECYCLE AUTHORITY INCOMPLETE`

No conditional VERDICT A.

## 24. NEXT CANONICAL ROUND
Only after VERDICT A:

`PHASE 3 — STEP 3.5 — OPERATIONAL NOTES IMPLEMENTATION — ROUND 2C — PLATFORM DETAIL / 360 NOTES UI + RUNTIME UX AUTHORITY`

Create-form initial-note integration remains **Round 2D**.

Do NOT implement 2C/2D here.

## 25. STOP
After report and verdict: **STOP**.
