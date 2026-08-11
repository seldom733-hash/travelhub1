# PHASE 2 — STEP 2.2E — BUYER REQUEST / PROPOSAL COMMUNICATION

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.2E  
**Mode:** IMPLEMENTATION  
**Canonical owners:** Reverse Marketplace (`reverse.*`) + Communication (`communication.*`)  
**Prerequisite:** Step 2.2D Strict Review `APPROVED WITH REVIEW FIXES`  
**Next after completion:** STOP and wait for separate STRICT REVIEW

---

# 1. MISSION

Implement canonical pre-sale communication for Reverse Marketplace.

Buyer and Seller must be able to communicate in the context of:

- BuyerRequest;
- canonical Buyer/Seller relationship established by Distribution;
- optionally SellerProposal.

Hard rule:

> **Communication remains owned by the existing Communication bounded context. Reverse Marketplace must not create a second chat/message system.**

This step integrates approved Reverse Marketplace objects as communication context only.

---

# 2. CANONICAL SOURCES — READ FIRST

Before changing code inspect latest repository truth:

- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- `CURRENT CANONICAL EXECUTION SEQUENCE`;
- ADR-0012;
- ADR-0011;
- ADR-0001;
- ADR-0005;
- ADR-0007;
- Step 2.2A implementation + Strict Review;
- Step 2.2B implementation + Strict Review;
- Step 2.2C implementation + Strict Review;
- Step 2.2D implementation + Strict Review;
- current `communication.*` schema/module;
- CML-* ID contract;
- communication controller/service;
- conversation/chat membership rules;
- BuyerRequest;
- BuyerRequestDistribution;
- SellerProposal;
- PublicSellerProfile;
- CRM Buyer/Seller identity;
- permissions/RBAC;
- field validation;
- AuditLog/history;
- EventBus/outbox/inbox;
- privacy/PII conventions;
- Deferred Decisions Map;
- DD-030;
- any canonical contact-disclosure deferred decision.

If this prompt conflicts with Roadmap or accepted ADRs, Roadmap/ADR wins.

---

# 3. OWNERSHIP BOUNDARY — HARD GATE

Canonical ownership:

- BuyerRequest → `reverse.*`
- Distribution → `reverse.*`
- SellerProposal → `reverse.*`
- Conversation / Communication / Messages → `communication.*`

Do NOT create:

- `reverse.Message`;
- `reverse.Chat`;
- `reverse.Conversation`;
- second message table;
- second chat API;
- duplicate CML ID scheme.

Reverse may provide trusted context refs only.

Communication owns:
- room/conversation lifecycle;
- membership;
- messages;
- message timestamps;
- read/message state where already canonical.

No cross-context writes outside owner-service/command boundary.

---

# 4. COMMUNICATION CONTEXT

Communication must be tied to a canonical reverse-marketplace relationship.

Minimum trusted context may include:

- BuyerRequest ID/code;
- Buyer identity;
- Seller identity;
- Distribution ID;
- optional SellerProposal ID if Proposal already exists.

Do not allow arbitrary Seller/Buyer pairing by client payload.

Context must be resolved server-side.

---

# 5. WHO MAY COMMUNICATE

At minimum:

Buyer:
- owns BuyerRequest.

Seller:
- has canonical BuyerRequestDistribution for that BuyerRequest.

If Proposal is required by Roadmap before chat:
- validate Proposal belongs to same Seller/request.

If Proposal is optional:
- allow communication after distribution according to canonical Roadmap.

Do not guess. Inspect current 2.2E Roadmap wording and implement exactly.

---

# 6. NO UNMATCHED SELLER ACCESS

A Seller without canonical distribution MUST NOT:

- create conversation;
- join conversation;
- list the BuyerRequest conversation;
- read messages;
- send messages;
- infer whether a conversation exists.

Seller cannot self-insert into BuyerRequest communication.

Neutral 404/403 should follow repository anti-enumeration conventions.

---

# 7. CROSS-SELLER ISOLATION — HARD GATE

If Seller A and Seller B both receive the same BuyerRequest:

- A must have a distinct communication scope from B;
- A cannot read B messages;
- A cannot send into B conversation;
- A cannot infer B conversation ID/member list;
- Buyer may communicate separately with A and B.

Do NOT create one shared Seller group room for all matched Sellers unless Roadmap explicitly requires it.

Default safe model:

`BuyerRequest + Buyer + Seller [ + Proposal ] → one isolated communication context`

---

# 8. BUYER OWN-SCOPE

Buyer may access only communication tied to BuyerRequests owned by that Buyer.

Cross-Buyer:
- list;
- detail;
- messages;
- send;
- membership

must be denied.

Buyer identity must be server-derived.

---

# 9. SELLER OWN-SCOPE

Seller identity must be server-derived from Partner context.

Seller may access only own BuyerRequest communication contexts.

No client-authoritative:
- sellerId;
- buyerId;
- member IDs;
- owner IDs.

---

# 10. PROPOSAL CONTEXT

If Proposal is used in context:

- Proposal must belong to same BuyerRequest;
- Proposal must belong to same Seller;
- Buyer must own BuyerRequest;
- Proposal must not become Communication owner.

Communication stores only trusted context refs/metadata.

Do not duplicate Proposal content into messages automatically.

---

# 11. REQUEST CANCELLATION

Define behavior when BuyerRequest becomes CANCELLED.

Minimum safe expectation:
- no new commercial progression;
- existing message history remains durable;
- sending new messages after cancellation must follow canonical policy.

If Roadmap does not define post-cancel messaging:
choose conservative behavior and document it.

Do not delete conversation/history.

---

# 12. PROPOSAL WITHDRAWAL

If Proposal is WITHDRAWN:
- existing communication history remains;
- whether new messages remain allowed must follow Roadmap policy;
- do not delete CML history.

Do not automatically reopen/convert Proposal via chat.

---

# 13. CONTACT DISCLOSURE — HARD PRIVACY GATE

Canonical invariant remains:

`MATCHED / DISTRIBUTED / PROPOSAL / CHAT EXISTS ≠ CONTACT DISCLOSED`

Chat must NOT automatically reveal:

- email;
- phone;
- WhatsApp;
- Telegram;
- passport;
- raw CRM profile;
- private address;
- internal Seller legal/private identity.

The existence of a chat does not authorize off-platform contact disclosure.

---

# 14. ANTI-DISINTERMEDIATION

If current policy forbids contact sharing before explicit disclosure stage, apply communication content validation.

Review:
- email;
- phone;
- URL;
- domain;
- WhatsApp;
- Telegram;
- social handle;
- external contact call-to-action.

Do not claim full DLP if only regex/key checks exist.

Document limitations honestly.

Reuse existing canonical communication moderation/validation if present.

Do not invent a second anti-disintermediation implementation if Communication already owns it.

---

# 15. MESSAGE CONTENT

Use existing Communication message model.

Do not create a new rich-text or arbitrary HTML path.

Apply existing:
- size limits;
- plain-text/format rules;
- control-char validation;
- XSS/injection protections;
- attachment policy if already canonical.

If attachments are not implemented in current Communication context, do not add them in 2.2E.

---

# 16. PUBLIC SELLER IDENTITY

Buyer-facing conversation may display Seller public identity.

Use canonical PublicSellerProfile/read model from ADR-0005.

Do NOT expose raw `crm.Partner` UUID/legal/private profile where public identity is required.

Respect:
- visibilityMode;
- HIDDEN;
- ANONYMOUS;
- publicId;
- displayName;
- verified;
- geography fields if allowed.

Do not copy private Seller profile into Communication persistence unnecessarily.

---

# 17. BUYER IDENTITY EXPOSURE TO SELLER

Seller-facing conversation must not expose raw Buyer CRM identity beyond what is required.

Prefer:
- request code/context;
- safe Buyer display identity if canonical.

Do not expose Customer internal UUID, email, phone or profile data merely for chat membership.

---

# 18. CML ID STRATEGY

Reuse existing canonical Communication ID prefix:

`CML-*`

Do not introduce:
- RCM-*;
- BRQCHAT-*;
- reverse conversation prefix

unless Communication contract explicitly requires a new subtype under same owner.

No duplicate ID system.

---

# 19. CONVERSATION CARDINALITY

Determine canonical uniqueness.

Likely safe model:

`BuyerRequest + Seller → at most one active canonical pre-sale conversation`

Optionally Proposal ref may attach to same context.

Avoid duplicate rooms due to retry/concurrency.

Use DB uniqueness/idempotent get-or-create where appropriate.

Do not create one conversation per message or per Proposal revision.

---

# 20. CONVERSATION CREATION TRIGGER

Determine current Roadmap intent:

- explicit Buyer/Seller open-conversation command;
- lazy get-or-create on first message;
- automatic creation after distribution/proposal.

Prefer minimal explicit/lazy canonical behavior over speculative automatic side effects.

Do not create chat during 2.2C/2.2D retroactively.

Document exact trigger.

---

# 21. IDEMPOTENCY

Repeated create/open for same BuyerRequest+Seller must converge to same canonical conversation.

Concurrent create/open must not create duplicates.

Require:
- DB uniqueness or existing room uniqueness invariant;
- transaction-safe get/create;
- no duplicate membership;
- no duplicate audit/history.

---

# 22. MEMBERSHIP

Use existing Communication membership model.

Members must be derived server-side from:
- Buyer owner;
- distributed Seller.

Do not accept arbitrary member IDs from client.

No Seller may add another Seller.

No Buyer may add arbitrary third party.

No group-chat expansion in this step unless canonical.

---

# 23. MEMBERSHIP CHANGES

Do not expose generic add-member/remove-member operations that bypass Reverse Marketplace scope.

If Communication module has generic membership APIs, verify Reverse Marketplace conversations are protected against unauthorized membership mutation.

This is a critical integration review point.

---

# 24. RBAC / PERMISSIONS

Reuse or extend existing communication permissions consistently.

Do not create parallel reverse-message permissions unless required for context gating.

If new capability is needed, it should protect context creation/access, while message ownership remains Communication.

Buyer/Seller permissions must be least privilege.

No role hardcoding that bypasses capability/own-scope conventions.

---

# 25. API SURFACE

Prefer existing Communication APIs extended with Reverse Marketplace context rather than duplicate endpoints.

Minimal required capabilities:

- open/get canonical conversation for eligible BuyerRequest+Seller context;
- list own reverse-marketplace conversations if current Communication supports contextual filtering;
- read messages;
- send message.

Do NOT add:
- contact disclosure endpoint;
- Proposal accept/select;
- Sales conversion;
- payment/order actions.

---

# 26. CONTEXT TYPE / REFERENCES

If Communication uses a generic context model:

Add minimal canonical context type/ref for BuyerRequest/Proposal only if current architecture supports it.

Do not:
- create giant polymorphic uncontrolled JSON;
- duplicate whole BuyerRequest snapshot;
- duplicate Proposal snapshot.

Store stable refs.

If existing Communication architecture cannot safely reference Reverse Marketplace context:
`ARCHITECTURE DECISION REQUIRED`.

---

# 27. MASS ASSIGNMENT

Reject client authority over:

- conversation ID/code;
- buyerId;
- sellerId;
- member IDs;
- context owner;
- BuyerRequest owner;
- Proposal owner;
- status;
- createdBy;
- system actor;
- timestamps;
- contactDisclosed;
- correlation/causation;
- internal moderation state.

Client may provide only legitimate route/context/message input.

---

# 28. MESSAGE AUTHORSHIP

Author must be derived from authenticated actor.

Client cannot spoof:
- senderId;
- senderType;
- senderName;
- seller/buyer identity.

Message history must preserve real actor.

---

# 29. READ AUTHORIZATION / IDOR

Every room/message read must verify membership/context scope.

Test:
- guessed CML code;
- guessed room UUID;
- guessed message ID;
- Seller A reading Seller B room;
- Buyer A reading Buyer B room.

No information leak through different error bodies.

---

# 30. SEND AUTHORIZATION

Sending requires current actor is authorized member and context policy permits message.

Do not trust room membership only if generic membership could have been forged earlier.

Context ownership must be revalidated where architecture requires.

---

# 31. REQUEST / PROPOSAL STATE AT SEND TIME

If BuyerRequest becomes CANCELLED or Proposal WITHDRAWN, define whether new messages are allowed.

Do not rely only on room creation-time state.

If policy requires blocking, re-read authoritative Reverse state at send time.

No cross-context write.

---

# 32. CONCURRENCY

Required races:

- Buyer and Seller concurrently open same conversation;
- duplicate first-message creation;
- distribution revoked/ineligible vs first open if revocation exists;
- BuyerRequest cancel vs first open;
- BuyerRequest cancel vs send;
- Proposal withdraw vs send if Proposal-gated.

No duplicate rooms or membership.

Final state deterministic.

---

# 33. FAILURE ATOMICITY

Failed conversation creation/open/send must not leave:

- duplicate room;
- partial membership;
- orphan message;
- misleading audit;
- Reverse mutation;
- Sales mutation.

If room+members+first message are created together, transaction semantics must be explicit.

---

# 34. EVENTS / OUTBOX

Use existing Communication event behavior.

Do not invent reverse-specific event bus.

If Communication already emits message/conversation events:
preserve conventions.

Do not emit Sales conversion events.

No Buyer PII in event payload.

---

# 35. AUDIT / HISTORY

Reuse Communication audit/history if present.

At minimum ability to establish:
- conversation created/opened;
- message authored;
- actor;
- timestamp;
- context refs.

No contact PII beyond message body already canonically stored.

Do not duplicate the same fact in Reverse history unless required.

---

# 36. NO REVERSE CHAT TABLES

Explicit schema proof:

After 2.2E, `reverse.*` must NOT contain:
- Message;
- ChatRoom;
- ChatMember;
- Conversation.

Communication owns those.

Reverse may only hold existing business entities.

---

# 37. NO PROPOSAL MUTATION FROM CHAT

Messages must not:
- submit Proposal;
- withdraw Proposal;
- select Proposal;
- convert Proposal.

Those require explicit domain commands.

---

# 38. NO SALES CONVERSION

Opening/sending chat creates zero:

- Lead;
- Opportunity;
- Quote;
- Checkout;
- Sale;
- Order;
- Booking;
- Payment.

2.2F remains next conversion step after 2.2E approval.

---

# 39. DD-030

Do not resolve Proposal→Sales conversion target in 2.2E.

No sales refs added to chat as conversion authority.

DD-030 remains gate before 2.2F.

---

# 40. ACQUISITION SOURCE

Communication does not alter acquisition source.

Future canonical conversion remains `BUYER_REQUEST`.

No DIRECT/MARKETPLACE rewrite from chat.

---

# 41. CATALOG / PRICING ISOLATION

Chat does not:
- create Product;
- alter pricing;
- reserve Availability;
- create Tariff;
- create Rate Plan.

No Pricing Engine work.

---

# 42. PRIVACY PROJECTIONS

Buyer conversation projection:
- safe public Seller identity only.

Seller conversation projection:
- safe Buyer/request context only.

Do not return:
- CRM raw records;
- other Seller identities;
- contact disclosure;
- audit internals;
- hidden moderation internals.

---

# 43. LIST / PAGINATION

If conversation/message list endpoints exist:

- bounded pagination;
- deterministic order;
- own-scope total;
- no cross-tenant rows;
- stable tie-breaker.

Reuse existing Communication conventions.

---

# 44. MIGRATION

If Communication schema needs additive context fields/unique constraints:

- additive only;
- owner = communication.*;
- no destructive backfill;
- no prohibited cross-schema FK;
- no db push;
- clean replay;
- drift 0.

If no migration needed, document why existing generic context supports Reverse Marketplace.

---

# 45. REQUIRED TESTS

At minimum prove:

1. anonymous denied;
2. unmatched Seller cannot open/read/send;
3. distributed Seller can open;
4. Buyer owning request can open;
5. Buyer A cannot access Buyer B conversation;
6. Seller A cannot access Seller B conversation;
7. same BuyerRequest distributed to A/B → isolated conversations;
8. repeated open returns same CML;
9. concurrent open → one conversation;
10. memberships server-derived;
11. forged buyerId/sellerId/memberIds rejected;
12. guessed CML ID denied;
13. guessed message ID denied;
14. sender spoof rejected;
15. Buyer can send;
16. Seller can send;
17. Seller projection has no Buyer contact PII;
18. Buyer projection uses safe PublicSellerProfile;
19. raw Partner UUID not exposed where publicId is required;
20. HIDDEN/ANONYMOUS seller identity semantics respected;
21. contact-sharing content blocked according to canonical policy;
22. anti-disintermediation bypass tests;
23. message length/control-char/XSS validation;
24. BuyerRequest CANCELLED open/send semantics;
25. Proposal WITHDRAWN semantics if Proposal context is used;
26. no duplicate membership;
27. failure atomicity;
28. no reverse Message/Chat tables;
29. no Proposal mutation;
30. no Sales/Order/Booking/Payment;
31. no Catalog/Pricing mutation;
32. no acquisition source mutation;
33. audit/history/event behavior;
34. pagination/determinism;
35. migration replay/drift if migration exists.

One test may prove multiple invariants.

---

# 46. FULL REGRESSION

Run:

Backend:
- tsc;
- unit;
- Step 2.2E targeted E2E;
- Communication regressions;
- Step 2.2D regression;
- Step 2.2C regression;
- Step 2.2B regression;
- Step 2.2A regression;
- Step 2.5B acquisition regression;
- RBAC/privacy tests;
- full serial E2E.

Frontend:
- tsc;
- vitest;
- production build.

DB:
- migrate status;
- clean replay;
- drift.

Report exact counts.

---

# 47. DOCUMENTATION

Create/update Step 2.2E architecture documentation covering:

- Communication ownership;
- Reverse context refs;
- Buyer/Seller eligibility;
- distribution prerequisite;
- conversation cardinality;
- membership;
- cross-Seller isolation;
- contact disclosure boundary;
- anti-disintermediation;
- PublicSellerProfile projection;
- Buyer PII minimization;
- request/proposal state behavior;
- idempotency/concurrency;
- events/audit;
- no Sales conversion;
- compatibility with 2.2F.

---

# 48. ROADMAP UPDATE

Only after implementation and green regression:

Mark:

`2.2E IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Set active item:

`Step 2.2E STRICT REVIEW`

Keep Step 2.2F blocked/not started.

Do not mark 2.2E approved in this pass.

---

# 49. ARCHITECTURE STOP CONDITIONS

STOP with:

`ARCHITECTURE DECISION REQUIRED`

if implementation requires:

- reverse-owned chat/message system;
- ambiguous Communication context ownership;
- unsafe generic membership model that cannot enforce reverse scope;
- unresolved contact-disclosure authority needed for chat;
- Proposal→Sales conversion;
- DD-030 resolution;
- cross-context writes;
- new Pricing Engine;
- Service Templates;
- parallel communication domain.

---

# 50. REQUIRED FINAL REPORT

Return:

# PHASE 2 — STEP 2.2E — BUYER REQUEST / PROPOSAL COMMUNICATION — ОТЧЁТ

## 1. Verdict
`PHASE 2 STEP 2.2E IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
or
`ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline
## 3. Sources inspected
## 4. Current → Target mapping
## 5. Communication ownership
## 6. Reverse context model
## 7. Distribution prerequisite
## 8. Buyer own-scope
## 9. Seller own-scope
## 10. Cross-Seller isolation
## 11. Proposal context semantics
## 12. Conversation cardinality
## 13. Conversation creation trigger
## 14. Membership model
## 15. RBAC / permissions
## 16. API surface
## 17. Mass assignment
## 18. Message authorship
## 19. IDOR / read authorization
## 20. Send authorization
## 21. Request cancel semantics
## 22. Proposal withdraw semantics
## 23. Contact disclosure boundary
## 24. Anti-disintermediation
## 25. Seller public identity projection
## 26. Buyer privacy projection
## 27. Concurrency / idempotency
## 28. Failure atomicity
## 29. Events / outbox
## 30. Audit / history
## 31. Reverse schema isolation
## 32. Proposal isolation
## 33. Sales isolation
## 34. DD-030 compatibility
## 35. Acquisition source
## 36. Catalog / Pricing isolation
## 37. Migration
## 38. IDs
## 39. Pagination / query paths
## 40. Targeted tests
## 41. Full regression
## 42. Runtime verification
## 43. Issues found/fixed
## 44. Documentation changes
## 45. Deferred decisions
## 46. Architecture decision status
## 47. Out-of-scope confirmation
## 48. Exact files changed

Final line repeats verdict.

---

# 51. STOP CONDITION

After implementation and validation:

STOP.

Do NOT perform Step 2.2E Strict Review in the same pass.
Do NOT start Step 2.2F.
Do NOT resolve DD-030.
Do NOT implement Proposal → Sales conversion.
Do NOT implement contact disclosure.
Do NOT execute Universal Pricing Model Amendment.
Do NOT implement Service Templates 1.8A–1.8D.

Wait for a separate Step 2.2E STRICT REVIEW prompt.
