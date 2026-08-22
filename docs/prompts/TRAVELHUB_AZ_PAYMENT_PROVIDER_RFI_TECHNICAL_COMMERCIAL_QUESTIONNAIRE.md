# TRAVELHUB — PAYMENT ACQUIRER / PSP RFI
## Commercial & Technical Questionnaire for Azerbaijan Payment Providers

**Purpose:** due diligence for TravelHub V1 payment infrastructure  
**Target candidates:** Millikart, Kapital Bank and other CBA-licensed Azerbaijan acquiring/payment candidates  
**Decision dependency:** ADR-0015 — Payment Provider Selection  
**Roadmap dependency:** Phase 2 — Step 2.12B — Buyer Card / Wallet Payment  
**Status:** RFI / COMMERCIAL & TECHNICAL CONFIRMATION REQUIRED

---

## 1. Purpose

TravelHub is evaluating an acquiring/payment provider for an Azerbaijan-based travel marketplace. This RFI requests written confirmation of merchant eligibility, AZN acquiring/settlement, cards/wallets, API/webhook capabilities, sandbox, marketplace/split/payout support, reconciliation and commercial terms.

Please answer each item as **SUPPORTED**, **NOT SUPPORTED**, **SUPPORTED WITH CONDITIONS**, **CUSTOM INTEGRATION REQUIRED**, **COMMERCIAL DISCUSSION REQUIRED**, or **NOT APPLICABLE**, and attach official technical evidence where possible.

TravelHub does not intend to store raw PAN/CVC on its backend.

---

## 2. Provider and contracting entity

Provide legal company name, brand, CBA licence/authorization and reference number, acquiring bank/processor (if different), contracting entity, website, API documentation URL, merchant portal, commercial contact, technical contact and support contact.

---

## 3. Merchant onboarding

1. Can an Azerbaijan-registered TravelHub legal entity onboard directly?
2. Do you support online travel businesses and travel marketplaces?
3. Are travel merchants subject to special underwriting, reserves, rolling reserves, deposits or guarantees?
4. Minimum processing volume or monthly fees?
5. Restricted/prohibited aspects of TravelHub's marketplace model?
6. Required KYB documents?
7. Typical onboarding timeline?
8. Does marketplace activity require TravelHub to hold an additional licence or regulated status?

---

## 4. Currency — distinguish presentment, settlement and payout

| Currency | Buyer presentment | TravelHub settlement | Partner payout | FX required? | Conditions |
|---|---|---|---|---|---|
| AZN | | | | | |
| USD | | | | | |
| EUR | | | | | |
| RUB | | | | | |

**Critical:** Can a buyer be charged **100.00 AZN** and TravelHub receive settlement in **AZN without mandatory conversion**?

Also confirm:
- international Visa/Mastercard charged in AZN;
- USD presentment/settlement;
- multi-currency settlement accounts;
- FX source, spread, timing and reporting;
- current RUB presentment/settlement availability and restrictions.

---

## 5. Card acquiring

Complete support for Visa, Mastercard, local schemes, UnionPay, international-issued cards, card-on-file/token payments, authorization, capture, delayed/partial capture, void, full refund and partial refund.

Explain:
- direct capture vs authorize/capture;
- authorization validity;
- partial capture;
- safe retry after uncertain network timeout.

---

## 6. PCI / tokenization

TravelHub target architecture:

`Buyer browser/app → provider-hosted/tokenized collection → provider token → TravelHub backend`

Confirm:
1. hosted checkout / hosted fields / JS SDK / mobile SDK / tokenization API;
2. TravelHub backend can avoid receiving PAN/CVC;
3. expected PCI DSS scope;
4. reusable merchant-specific tokens;
5. future payment/card-on-file support;
6. safe metadata such as brand/last4.

If raw PAN/CVC must reach TravelHub backend, explain why.

---

## 7. 3-D Secure / 3DS2

Confirm EMV 3DS2 support, mandatory rules, frictionless/challenge flows, API status representation, asynchronous completion mechanism, and deterministic sandbox test scenarios.

---

## 8. Apple Pay / Google Pay

For **each wallet**, confirm:
- available to an Azerbaijan TravelHub merchant;
- web/mobile support;
- AZN presentment;
- AZN settlement;
- merchant/domain registration requirements;
- certificate/config ownership;
- whether it uses the same payment API/webhook lifecycle;
- additional fees.

Do not answer only that the wallet is generally available in Azerbaijan; confirm availability through your acquiring/gateway setup for this merchant.

---

## 9. Payment API

Provide current documentation and confirm:
- protocol (REST/etc.) and JSON;
- API versioning;
- sandbox/production URLs;
- authentication;
- rate limits/timeouts;
- OpenAPI/Swagger;
- create/get payment;
- authorize/capture/void;
- payment status;
- provider transaction/reference ID;
- refund/get refund.

---

## 10. API idempotency — CRITICAL

1. Does payment creation accept a merchant-supplied idempotency key?
2. Header/field name, format, maximum length, scope and retention?
3. Same key + identical request → same payment with no second charge?
4. Same key + different amount/currency/order → controlled rejection?
5. Provider processed payment but HTTP response was lost → can TravelHub safely retry the same operation?
6. Does this guarantee hold across provider instances/data centers?

Attach official documentation.

---

## 11. Payment identity / correlation

Confirm:
- stable immutable provider payment ID;
- lookup by provider ID;
- lookup by merchant order/reference;
- lookup by idempotency/operation reference;
- protection against duplicate charges for one merchant operation.

---

## 12. Webhooks / callbacks — CRITICAL

Confirm:
- asynchronous payment webhooks;
- relevant event types;
- immutable **event ID** distinct from payment ID;
- duplicate delivery possibility;
- retry schedule/duration;
- out-of-order delivery possibility;
- ordering guarantees per payment;
- API retrieval after webhook;
- manual replay capability.

---

## 13. Webhook authentication — CRITICAL

Describe:
- HMAC/asymmetric signature/mTLS/etc.;
- raw-body signing requirement;
- algorithm;
- signed timestamp;
- replay tolerance/protection;
- key rotation;
- separate sandbox/production keys;
- official verification examples.

**IP allowlisting alone is not sufficient evidence of cryptographic webhook authenticity for TravelHub.**

---

## 14. Race / callback ordering scenarios

Describe provider behavior for:
1. webhook arrives before create-payment HTTP response;
2. provider charged successfully but API response timed out;
3. success webhook delivered multiple times;
4. two TravelHub instances process the same webhook;
5. success/failure/cancellation events arrive out of order.

Identify authoritative fields, sequence numbers and timestamp guarantees.

---

## 15. Sandbox — CRITICAL

Confirm sandbox availability before launch and whether it supports:
- success;
- decline;
- insufficient funds;
- 3DS challenge;
- timeout simulation;
- duplicate/idempotent request;
- refund/partial refund;
- signed webhook;
- duplicate webhook;
- dispute simulation;
- Apple Pay;
- Google Pay.

State known sandbox/production differences and procedure for obtaining credentials.

---

## 16. Refunds

Confirm API-created full/partial refunds, multiple partial refunds up to captured amount, stable refund ID, asynchronous status/webhooks, failure behavior, settlement timeline and fee treatment.

---

## 17. Disputes / chargebacks

Confirm unique dispute ID, lifecycle/statuses, won/lost outcome, webhooks, evidence API, dispute fees and correlation to original payment.

---

## 18. Settlement / reconciliation

Confirm:
- settlement frequency;
- **AZN settlement**;
- bank account requirements;
- unique settlement/batch ID;
- API retrieval;
- CSV/XLSX/SFTP reports;
- payment/refund/dispute/fee linkage;
- gross, fee and net separately;
- timezone/cutoff.

---

## 19. Provider/acquirer fees

TravelHub treats provider cost separately from TravelHub commission.

Confirm availability of actual transaction-level:
- gross amount;
- provider/acquirer fee;
- scheme/interchange components where exposed;
- tax/VAT on fee;
- net settlement;
- refund/chargeback fees;
- timing/finality of fee data.

---

## 20. Marketplace / sub-merchants — CRITICAL

TravelHub is a marketplace, not only a single-seller webshop.

Confirm:
1. marketplace/platform merchants supported?
2. partners represented as sub-merchants/connected accounts/beneficiaries/vendors?
3. who performs partner KYB/KYC?
4. API onboarding?
5. payment identifies underlying seller?
6. restrictions on TravelHub receiving funds before partner settlement?
7. additional licence/regulatory requirements for TravelHub?

Provide the contractual/regulatory model.

---

## 21. Native split payments — CRITICAL FOR FUTURE STEP 2.12C

Confirm:
1. native split at payment/capture time?
2. allocation between seller and TravelHub?
3. can TravelHub pass an **exact precomputed monetary commission/split amount**?
4. does provider require its own rate/policy?
5. idempotent split retry?
6. refund treatment?
7. chargeback allocation?
8. split components in reconciliation?
9. sub-merchant prerequisite?

If unsupported, state **NOT SUPPORTED** explicitly.

**A later payout after centralized settlement is not considered equivalent to native `SPLIT_AT_PAYMENT`.**

---

## 22. Partner payouts

Confirm:
- payout/transfer API;
- Azerbaijan bank account/card/IBAN/internal merchant destinations;
- AZN payout;
- unique payout ID;
- payout webhooks;
- payout idempotency;
- recipient KYB/KYC;
- limits/schedules.

---

## 23. Commercial proposal

| Item | Provider response |
|---|---|
| Setup/integration fee | |
| Monthly fee | |
| Domestic card acquiring | |
| International card acquiring | |
| Apple Pay | |
| Google Pay | |
| 3DS | |
| Refund | |
| Chargeback | |
| Settlement | |
| Payout/transfer | |
| FX spread/markup | |
| Tokenization/card-on-file | |
| Minimum volume/fee | |
| Rolling reserve | |
| Security deposit | |
| Other fees | |

Please provide a formal/indicative commercial proposal and clearly state VAT/tax treatment.

---

## 24. Operations, security and privacy

Provide:
- support hours and 24/7 incident escalation;
- API availability SLA/status page;
- breaking-change/deprecation policy;
- PCI DSS certification;
- ISO 27001/equivalent;
- TLS/API credential rotation;
- webhook-key rotation;
- mTLS/IP controls;
- fraud/risk controls;
- data-hosting location;
- cross-border transfers;
- required buyer PII;
- retention/deletion;
- DPA availability.

Do not send production secrets.

---

## 25. Documentation requested

Please provide, where available:
1. Payment API
2. OpenAPI/Swagger
3. Authentication
4. Idempotency
5. Webhooks
6. Webhook signature verification
7. Payment status/event mapping
8. Sandbox/test cards
9. 3DS2
10. Apple Pay
11. Google Pay
12. Tokenization/card-on-file
13. Refund
14. Dispute/chargeback
15. Settlement/reconciliation
16. Marketplace/sub-merchant
17. Native split
18. Payout
19. Rate limits
20. API versioning/deprecation
21. PCI/security documentation

NDA-protected documentation is acceptable; please state NDA requirements.

---

## 26. Mandatory YES / NO / CONDITIONAL matrix

| # | Architecture question | YES / NO / CONDITIONAL | Evidence / notes |
|---:|---|---|---|
| 1 | Azerbaijan TravelHub legal entity can onboard | | |
| 2 | Buyer can pay in AZN | | |
| 3 | TravelHub can settle in AZN | | |
| 4 | International Visa/Mastercard can be charged in AZN | | |
| 5 | Backend can avoid PAN/CVC | | |
| 6 | 3DS2 supported | | |
| 7 | Apple Pay supported for this merchant | | |
| 8 | Apple Pay can settle in AZN | | |
| 9 | Google Pay supported for this merchant | | |
| 10 | Google Pay can settle in AZN | | |
| 11 | Create-payment supports idempotency | | |
| 12 | Timeout retry cannot double-charge | | |
| 13 | Stable provider payment ID | | |
| 14 | Stable unique webhook event ID | | |
| 15 | Webhooks cryptographically signed | | |
| 16 | Webhook retries documented | | |
| 17 | Duplicate webhooks possible/handled | | |
| 18 | Out-of-order callbacks documented | | |
| 19 | Sandbox available pre-production | | |
| 20 | Partial refunds supported | | |
| 21 | Dispute events available | | |
| 22 | Settlement/reconciliation data available | | |
| 23 | Actual provider fees separately identifiable | | |
| 24 | TravelHub marketplace model permitted | | |
| 25 | Sub-merchants/partners supported | | |
| 26 | Native payment split supported | | |
| 27 | TravelHub can provide exact split amount | | |
| 28 | AZN partner payouts supported | | |
| 29 | Payout status callbacks available | | |
| 30 | Payout initiation idempotent | | |

---

## 27. Evidence standard

For architecture-critical **SUPPORTED** answers, provide official documentation, written technical confirmation, written commercial confirmation, or sandbox evidence.

Critical evidence includes:
- AZN settlement;
- merchant eligibility;
- tokenization;
- API idempotency;
- webhook signature;
- webhook event identity;
- marketplace legal/commercial model;
- native split;
- partner payout.

Unanswered does **not** mean supported.

---

## 28. TravelHub evaluation classification

- **A — APPROVED FOR V1:** all hard requirements confirmed.
- **B — APPROVED WITH EXPLICIT LIMITATIONS:** V1 viable with accepted limitations.
- **C — TECHNICALLY SUITABLE — COMMERCIAL APPROVAL PENDING**
- **D — COMMERCIAL SUITABILITY — TECHNICAL EVIDENCE INSUFFICIENT**
- **E — DISQUALIFIED**

---

## 29. Hard gates before Step 2.12B implementation

1. Azerbaijan merchant onboarding confirmed.
2. AZN presentment confirmed.
3. AZN settlement confirmed, or business explicitly accepts another settlement currency.
4. Tokenized/hosted card collection confirmed.
5. Provider API idempotency documented.
6. Webhook cryptographic verification documented.
7. Stable payment/event correlation documented.
8. Sandbox access confirmed.
9. Marketplace model confirmed.
10. Native split explicitly confirmed or rejected.
11. Commercial proposal received.
12. Technical documentation received.

---

## 30. Requested next steps

Please return:
1. completed questionnaire;
2. technical documentation package;
3. sandbox access procedure;
4. onboarding/KYB requirements;
5. commercial proposal;
6. technical and commercial contacts;
7. marketplace/native-split confirmation;
8. estimated onboarding/integration timeline;
9. NDA if required.

---

## 31. Suggested cover email

**Subject: TravelHub — Payment Acquiring / PSP Technical & Commercial RFI**

Dear [Provider / Team],

TravelHub is evaluating payment acquiring and gateway providers for an Azerbaijan-based travel marketplace platform.

Our V1 requirements include AZN card payments and settlement, international Visa/Mastercard acceptance, tokenized card processing, 3DS2, secure payment APIs and callbacks/webhooks, and—where supported—Apple Pay and Google Pay.

Because TravelHub operates as a marketplace, we also need to understand your contractual and technical capabilities for sub-merchants, native payment splitting and partner payouts.

Attached is a structured technical and commercial questionnaire. We would appreciate written responses together with relevant API documentation, sandbox-access information, onboarding requirements and a commercial proposal.

For architecture-critical capabilities—particularly AZN settlement, API idempotency, webhook authentication, marketplace support and native split payments—we request official technical documentation or written confirmation from your technical team.

We are happy to sign an NDA if required for access to integration documentation.

Kind regards,  
**TravelHub**  
[Legal entity / representative]  
[Email]  
[Phone]

---

## 32. INTERNAL — do not send in provider-facing copy

After responses:
1. preserve original answers/attachments;
2. unanswered critical questions remain gaps;
3. compare candidates against the same matrix;
4. reconcile evidence with ADR-0015;
5. decide single-provider vs approved provider set;
6. only verified evidence may move ADR-0015 to `ACCEPTED`;
7. then Roadmap 2.12B may become `READY FOR IMPLEMENTATION`;
8. execute the existing 2.12B implementation prompt;
9. do **not** silently replace 2.12C `SPLIT_AT_PAYMENT` with payout orchestration;
10. if native split is unavailable, run a separate architecture/business reconciliation for 2.12C.

### Provider verdict template

```text
TRAVELHUB PAYMENT PROVIDER EVALUATION — <PROVIDER>

Merchant:
- Azerbaijan onboarding: ...
- marketplace model: ...

Currency:
- AZN presentment: ...
- AZN settlement: ...
- USD: ...
- RUB: ...

Payment:
- Visa/Mastercard: ...
- tokenized/no-PAN backend: ...
- 3DS2: ...
- Apple Pay: ...
- Google Pay: ...

API:
- create-payment idempotency: ...
- stable payment ID: ...
- timeout retry safety: ...

Webhook:
- stable event ID: ...
- cryptographic signature: ...
- retry semantics: ...
- duplicate delivery: ...
- ordering: ...

Operations:
- sandbox: ...
- refunds: ...
- disputes: ...
- provider fee data: ...
- settlement/reconciliation: ...

Marketplace:
- sub-merchants: ...
- native split: ...
- exact TravelHub-supplied split amount: ...
- AZN partner payout: ...

Commercial:
- quote received: YES | NO
- reserve/deposit: ...
- onboarding conditions: ...

Evidence gaps:
- ...

Classification: A | B | C | D | E

ADR-0015:
- ACCEPTABLE FOR ACCEPTANCE
or
- REMAINS BLOCKED

Step 2.12B:
- READY FOR IMPLEMENTATION
or
- BLOCKED
```

---

## 33. Interpretation rules

These distinctions are hard gates:

`AZN acquiring` ≠ `AZN settlement`

`Apple Pay available in Azerbaijan` ≠ `provider enables Apple Pay for TravelHub`

`webhook exists` ≠ `webhook is cryptographically authenticated`

`retry supported` ≠ `payment creation is idempotent`

`payout supported` ≠ `native SPLIT_AT_PAYMENT`

`ordinary merchant acquiring` ≠ `marketplace/sub-merchant model`

Provider selection must be based on written commercial and technical evidence, not assumptions.
