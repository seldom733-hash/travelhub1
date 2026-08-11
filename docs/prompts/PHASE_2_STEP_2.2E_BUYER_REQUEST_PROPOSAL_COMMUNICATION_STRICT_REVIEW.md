# PHASE 2 — STEP 2.2E — BUYER REQUEST / PROPOSAL COMMUNICATION — STRICT REVIEW

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.2E  
**Mode:** STRICT REVIEW ONLY  
**Canonical owners:** Reverse Marketplace (`reverse.*`) + Communication (`communication.*`)  
**Implementation status:** `PHASE 2 STEP 2.2E IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`  
**Next only if APPROVED:** Step 2.2F — Proposal → Canonical Sales Conversion

## 1. Mission

Perform an independent, adversarial STRICT REVIEW of Step 2.2E. Do not approve from the implementation report alone. Inspect schema/migration, CommunicationThread, existing Communication messages, context refs, open/list/get/messages/send APIs, ownership, membership, RBAC, projections, anti-disintermediation, request/proposal state gates, concurrency, tests, docs, ADR/DD compliance and Roadmap.

Final verdict:
- `PHASE 2 STEP 2.2E STRICT REVIEW COMPLETED — APPROVED`
- `PHASE 2 STEP 2.2E STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `PHASE 2 STEP 2.2E STRICT REVIEW COMPLETED — CHANGES REQUIRED`
- `ARCHITECTURE DECISION REQUIRED`

## 2. Execution gate

Sequence: `2.2E implementation → 2.2E STRICT REVIEW → APPROVED → 2.2F`.

Do not start 2.2F, resolve DD-030, implement Proposal→Sales conversion, contact disclosure, attachments/notifications, Service Templates or Universal Pricing. If approved, update Roadmap, set 2.2F as unique NEXT and STOP.

## 3. Baseline

Inspect branch/HEAD, git status/diff/log, migration status, whether 2.2E is committed, and reported untracked `public/`, `src/`, `skills-lock.json`. Separate unrelated files, 2.2E implementation and review fixes. Do not delete unrelated user work.

## 4. Canonical sources

Read latest:
- Roadmap + CURRENT CANONICAL EXECUTION SEQUENCE;
- ADR-0011 + amendment;
- ADR-0012;
- ADR-0001;
- ADR-0005;
- ADR-0007;
- ADR-0009 where relevant;
- Deferred Decisions Map + DD-030;
- Steps 2.2A–2.2D implementations + reviews;
- `reverse-pre-sale-conversations.md`;
- `docs/contracts/api.md`;
- `docs/contracts/ids.md`;
- Prisma schema;
- migration `20260811101502_add_pre_sale_conversations`;
- Communication module/service/controller/contracts/validation;
- reverse-conversation service/controller/validation;
- shared anti-disintermediation helper;
- PublicSellerProfile service;
- BuyerRequest/Distribution/SellerProposal;
- AuditLog/EventBus/outbox;
- 2.2E E2E/unit tests.

Roadmap/accepted ADRs are authoritative.

## 5. Ownership — hard gate

Verify BuyerRequest/Distribution/Proposal remain in `reverse.*`, while thread/membership/messages remain in `communication.*`.

Hard failures:
- reverse-owned Message/Chat/Conversation tables;
- duplicate messaging domain;
- Communication writing Reverse state;
- Reverse directly writing Communication outside owner-service boundary.

## 6. CML reuse

Verify CML-* reuse is safe:
- no competing prefix;
- no collision between thread codes and message codes;
- no API ambiguity;
- atomic sequence;
- docs clearly define semantics.

If the same CML prefix across two tables is ambiguous, fix contract/model before approval.

## 7. CommunicationThread model

Review buyerRequestId, buyerCustomerId, sellerPartnerId, optional proposalId, timestamps, unique request+seller, thread/message relation. No duplicated Reverse snapshots. No prohibited cross-schema FK.

## 8. Context authority

Client must not choose Buyer/Seller pairing. Open must resolve BuyerRequest owner, authenticated Seller or safe sellerPublicId mapping, Distribution, and optional Proposal server-side.

## 9. Distribution prerequisite — hard gate

Unmatched Seller cannot open/read/send. Buyer cannot open arbitrary undistributed Seller. Forged sellerPublicId or distribution cannot bypass. Unknown seller/request behavior should resist enumeration.

## 10. Buyer own-scope

Buyer only accesses conversations for own BuyerRequests via list/detail/messages/send. No customerId spoofing or cross-Buyer CML/message access.

## 11. Seller own-scope

Seller only accesses threads where sellerPartnerId equals server-derived actor.partnerId. No cross-Seller thread/message inference.

## 12. Cross-Seller isolation — hard gate

Same BuyerRequest distributed to Sellers A/B must produce isolated conversations. A cannot read/send B, infer B thread ID/message count, or see B membership.

## 13. Proposal context

Proposal optional trusted ref must match same request+seller. WITHDRAWN behavior explicit. Chat never mutates Proposal.

## 14. Cardinality / idempotent open

Expected at most one thread per BuyerRequest+Seller. Verify DB uniqueness, repeated open, Buyer/Seller concurrent open, no duplicate membership/audit.

## 15. Membership model

Server-derived buyer/seller columns must be sufficient and protected. Generic Communication APIs must not add arbitrary participants or mutate reverse-marketplace thread membership.

## 16. RBAC

Review communication.read_own/write_own, BUYER/PARTNER scope, staff/admin behavior, and ensure permissions alone cannot broaden tenant access.

## 17. API surface

Review only open/list/detail/messages/send. No contact disclosure, Proposal selection, Sales conversion, payment/order actions.

## 18. Mass assignment

Reject forged thread/code, buyer/customer, seller/partner, member IDs, distribution/proposal IDs, status/version, sender/recipient/direction, contactDisclosed, sales refs, timestamps, actor/correlation.

## 19. Message authorship

Sender identity/type/name/direction/recipient must be server-derived from authenticated actor and thread context.

## 20. Legacy Communication IDOR — critical

Search all old Communication endpoints by code/ID/contextType/threadId. New BUYER_REQUEST messages must not be readable through a legacy endpoint that lacks reverse membership checks. Also test guessed message IDs/codes.

## 21. Request cancel / open

CANCELLED request must reject new open. Verify authoritative re-read and locking. Open-before-cancel may remain historical; cancel-before-open must block.

## 22. Request cancel / send — critical concurrency

Use controlled interleavings:
- cancel committed first → send blocked;
- send committed first → message durable then cancellation.

No message should commit after already-committed cancellation if policy forbids post-cancel send.

Review raw SQL/locking safety.

## 23. Proposal WITHDRAWN

Verify continued messaging after Proposal withdrawal is canonical and does not reopen/mutate Proposal.

## 24. Contact disclosure — hard gate

`CHAT EXISTS ≠ CONTACT DISCLOSED`.

No buyer/seller private contact in thread detail, members, message metadata, projections, audit or events.

## 25. Anti-disintermediation — critical

Verify one shared canonical helper reused by Proposal and Communication. Test email, phone, URL, bare domain, wa.me, Telegram, WhatsApp, social handles, obfuscation variants, Unicode/spacing, multiline, ISO dates. Document regex-only limitation honestly.

## 26. Shared helper regression

Re-run 2.2D Proposal validation to prove extraction did not regress contact blocking, ISO dates, control chars, normal text.

## 27. Message content / XSS

Review max size, empty/whitespace, control chars, HTML/script, stored-XSS risk, serialization. Attachments remain out of scope.

## 28. Seller public identity — ADR-0005

Buyer-facing thread must use safe PublicSellerProfile and not raw partnerId. Respect SELL-*, visibilityMode, HIDDEN, ANONYMOUS, displayName, verified/memberSince/geo.

Critical question: if HIDDEN Seller can legitimately receive a 2.2C distribution, does blocking Buyer open because profile is HIDDEN incorrectly conflate public profile visibility with reverse-marketplace participation? Resolve from ADR-0005/0012. If not canonical, fix.

## 29. sellerPublicId resolution

Public ID must belong to Seller actually distributed the request. No cross-request or enumeration bypass.

## 30. Buyer privacy projection

Seller view should expose only safe request context (e.g. BRQ code), not buyerCustomerId, Customer UUID, email, name/address unless canonically allowed.

## 31. Thread/message projection

List/detail/messages must omit raw buyerCustomerId, sellerPartnerId, distribution IDs, internal audit/security fields and other internal refs unless explicitly required.

## 32. CML ID ambiguity review

Verify whether a CML code can refer to both thread and message, whether global uniqueness is guaranteed, and whether route ambiguity exists. Contract must be unambiguous.

## 33. P2002 retry / concurrent open

Inspect retry after aborted interactive transaction:
- new transaction;
- bounded retry;
- only intended unique conflict;
- no loop;
- one thread after concurrent opens;
- no duplicate audit.

## 34. Raw SQL / FOR UPDATE safety

No user-controlled SQL interpolation. Correct schema/table quoting and lock ordering. Parameter binding mandatory.

## 35. Failure atomicity

Failed open/send leaves no orphan thread, partial membership, orphan message, misleading audit, Reverse mutation or Sales mutation.

## 36. Events / outbox

Verify no hidden event/outbox if intentionally absent and ADR-0011 permits it. No speculative event infrastructure required.

## 37. Audit

Verify conversation.opened/message.sent actor, requestId/correlation, body omitted, no PII, no duplicate audit on idempotent open unless intentional, and no success audit on failed operations.

## 38. Reverse schema isolation

No Message/Chat/Conversation tables in `reverse.*`.

## 39. Proposal isolation

Chat does not submit/withdraw/edit/select/convert Proposal.

## 40. Sales isolation

Open/send create zero Lead/Opportunity/Quote/Checkout/Sale/OrderRequested/Order/Booking/Payment. DD-030 remains deferred.

## 41. Acquisition source

Communication does not mutate BUYER_REQUEST or rewrite source to DIRECT/MARKETPLACE.

## 42. Catalog/Pricing isolation

No Product/Tariff/Availability/Reservation/Pricing changes.

## 43. Migration

Inspect SQL: additive Communication-owned context enum/thread table/threadId/indexes/uniqueness, legacy nullable compatibility, no destructive backfill, no prohibited cross-schema FK, clean replay, drift 0.

## 44. Pagination

Threads `createdAt desc,id desc`; messages `occurredAt asc,code asc`; cap 50; own-scope total/hasMore; deterministic static paging; invalid page/pageSize handling.

## 45. Test quality / flake review

The implementation reported early transient flakes under load followed by six green runs. Inspect actual failures/logs if available and determine whether they reveal shared-DB, cleanup, ID sequencing or concurrency defects. Do not accept “not reproducible” without cause review.

## 46. Shared-DB hygiene

Review cleanup for threads, messages, AuditLog, BuyerRequest/Distribution/Proposal fixtures and PublicSellerProfile. No global destructive cleanup.

## 47. Required targeted review proof

Confirm/add proof for:
1. anonymous denied;
2. unmatched Seller cannot open;
3. Buyer cannot open undistributed Seller;
4. distributed Seller open;
5. Buyer owner open;
6. cross-Buyer denied;
7. cross-Seller denied;
8. two Sellers → isolated threads;
9. repeated open same thread;
10. concurrent Buyer/Seller open → one thread;
11. server-derived membership;
12. forged member IDs rejected;
13. guessed thread CML denied;
14. guessed message ID/code denied;
15. legacy Communication endpoint cannot expose reverse messages;
16. Buyer send;
17. Seller send;
18. sender spoof rejected;
19. cancel-before-open blocked;
20. open-before-cancel historical;
21. cancel-before-send blocked;
22. send-before-cancel durable;
23. controlled cancel/send race;
24. withdrawn Proposal semantics;
25. no Proposal mutation;
26. no contact disclosure;
27. email/phone/url/domain/messenger/social blocking;
28. ISO-date allowed;
29. shared helper Proposal regression;
30. XSS/control-char/length;
31. safe PublicSellerProfile;
32. raw partner UUID absent;
33. HIDDEN semantics;
34. ANONYMOUS semantics;
35. sellerPublicId cannot bypass distribution;
36. Seller view no Buyer PII;
37. projections omit internal IDs;
38. CML uniqueness/ambiguity;
39. P2002 concurrent-open retry;
40. failure atomicity;
41. audit body omitted;
42. zero reverse events/outbox;
43. no reverse chat tables;
44. no Sales/Order/Booking/Payment;
45. no Catalog/Pricing mutation;
46. source unchanged;
47. pagination/determinism;
48. migration replay/drift;
49. no shared-DB leaks.

One test may prove multiple invariants.

## 48. Review-fix policy

Local 2.2E defects may be fixed. For each: root cause, minimum safe fix, regression proof, full regression. Do not start 2.2F.

Return `ARCHITECTURE DECISION REQUIRED` only for unresolved Communication-vs-Reverse ownership, membership architecture, contact disclosure authority, public visibility vs Reverse participation conflict not resolvable from ADRs, DD-030, cross-context writes or second messaging domain.

## 49. Full regression

Run actual current results:
- backend tsc;
- unit;
- 2.2E targeted E2E;
- Communication regression;
- 2.2D/C/B/A;
- 2.5B;
- RBAC/privacy;
- full serial E2E;
- frontend tsc/vitest/build;
- migrate status/clean replay/drift.

Report exact counts.

## 50. Roadmap update

Before approval: 2.2E waiting Strict Review; 2.2F blocked.

If approved:
- mark 2.2E `STRICT REVIEW COMPLETED — APPROVED` or `APPROVED WITH REVIEW FIXES`;
- set exact NEXT to `PHASE 2 — STEP 2.2F — PROPOSAL → CANONICAL SALES CONVERSION`;
- do not start 2.2F.

## 51. Approval criteria

Approve only if Communication ownership, CML reuse, distribution prerequisite, own-scope, cross-Seller isolation, legacy IDOR protection, contact-disclosure boundary, anti-disintermediation, PublicSellerProfile semantics, cancel/open/send concurrency, idempotent open, Proposal/Sales/Catalog isolation, audit, migration and regression all pass.

## 52. Required final report

Return:

# PHASE 2 — STEP 2.2E — BUYER REQUEST / PROPOSAL COMMUNICATION — STRICT REVIEW — ОТЧЁТ

## 1. Verdict
## 2. Repository baseline
## 3. Sources inspected
## 4. Communication ownership
## 5. CML reuse
## 6. CommunicationThread model
## 7. Reverse context authority
## 8. Distribution prerequisite
## 9. Buyer own-scope
## 10. Seller own-scope
## 11. Cross-Seller isolation
## 12. Proposal context
## 13. Conversation cardinality
## 14. Open trigger / idempotency
## 15. Membership model
## 16. RBAC
## 17. API surface
## 18. Mass assignment
## 19. Message authorship
## 20. Legacy Communication IDOR review
## 21. Request cancel / open semantics
## 22. Request cancel / send concurrency
## 23. Proposal withdrawn semantics
## 24. Contact disclosure boundary
## 25. Anti-disintermediation
## 26. Shared helper regression
## 27. Message content / XSS
## 28. Seller public identity / ADR-0005
## 29. HIDDEN / ANONYMOUS semantics
## 30. Buyer privacy projection
## 31. Thread/message projections
## 32. Raw SQL / locking safety
## 33. P2002 retry / concurrent open
## 34. Failure atomicity
## 35. Events / outbox
## 36. Audit
## 37. Reverse schema isolation
## 38. Proposal isolation
## 39. Sales isolation
## 40. DD-030 compatibility
## 41. Acquisition source
## 42. Catalog / Pricing isolation
## 43. Migration
## 44. IDs
## 45. Pagination
## 46. Test quality / flake review
## 47. Shared-DB hygiene
## 48. Review fixes
## 49. Regression results
## 50. Documentation / Roadmap
## 51. Deferred decisions
## 52. Architecture decision status
## 53. Exact files changed during review
## 54. Out-of-scope confirmation
## 55. Exact NEXT item

If approved, Exact NEXT:
`PHASE 2 — STEP 2.2F — PROPOSAL → CANONICAL SALES CONVERSION`

Final line repeats verdict.

## 53. Stop condition

After Strict Review STOP.

If approved, update Roadmap and set 2.2F as NEXT, but DO NOT implement it. Do not resolve DD-030 in this review unless it is a documented blocker; do not implement contact disclosure, Service Templates or Universal Pricing.
