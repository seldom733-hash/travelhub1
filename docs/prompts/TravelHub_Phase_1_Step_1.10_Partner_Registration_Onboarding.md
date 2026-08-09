# PHASE 1 — STEP 1.10: PARTNER REGISTRATION & ONBOARDING

## Статус входа

Steps 1.0–1.9 — APPROVED.

Начни только **PHASE 1 — STEP 1.10: Partner Registration & Onboarding**.

Не начинай checkout, Payment/PSP, split payment, Settlement/Payout execution, Sales, OrderRequested, Booking changes, Partner Finance full или Buyer Cabinet full.

## 1. Цель

Реализовать полноценный lifecycle регистрации нового PARTNER как внешнего продавца/поставщика туристических услуг.

```text
Anonymous / Become a Partner
→ Partner registration
→ security.User в onboarding state
→ PartnerApplication
→ review
→ CRM Partner create-or-link
→ APPROVED
→ User.role = PARTNER
→ User.partnerId = crm.Partner.id
→ Partner Cabinet enabled
```

PARTNER не должен становиться полноценным продавцом сразу после простого ввода email/password без onboarding/approval.

## 2. Аудит

До изменений покажи:
- User model;
- `User.partnerId`;
- `crm.Partner`;
- Partner statuses;
- create Partner API;
- PARTNER login flow;
- Partner Cabinet gate;
- roles/permissions;
- Company/Contact entities;
- legal/business fields;
- verification/KYC fields if any;
- public registration page structure.

Не создавай параллельную Partner entity.

## 3. Разделение lifecycle

Не смешивать:
```text
Registration
≠ Partner approval
≠ Product moderation
≠ Payment/KYC onboarding
```

Регистрация создаёт onboarding identity/application.
Activation даёт право пользоваться Partner Cabinet как продавцу.
Product moderation отдельно проверяет каждую услугу.
Payment/KYC onboarding будет отдельным финансовым этапом позже.

## 4. PartnerApplication

Добавь/переиспользуй onboarding record, например:

```text
PartnerApplication
id
userId
partnerId?
status
applicantType
legalName?
brandName?
country
registrationNumber?
taxId?
website?
contactEmail
contactPhone?
address?
businessDescription?
serviceCategories?
submittedAt?
reviewedAt?
reviewedById?
decisionReason?
createdAt
updatedAt
```

Не хранить payment card/bank credentials здесь.

## 5. Lifecycle

Минимум:
```text
DRAFT
SUBMITTED
IN_REVIEW
APPROVED
REJECTED
CHANGES_REQUESTED
CANCELLED
```

Backend codes стабильны, UI labels локализуются.

## 6. Public registration

Добавить public route:
```text
/become-a-partner
/partner/register
```
или canonical equivalent.

Минимальные initial fields:
```text
email
password
firstName
lastName
country
applicantType
brand/legal display name
contact data
accepted terms
```

## 7. Role assignment

Public self-registration не должна сразу выдавать полный PARTNER selling access.

Допустим:
- role PARTNER + onboardingStatus gate;
- либо существующий equivalent.

Не вводи новую роль без необходимости.

Invariant:
```text
Partner selling capabilities
⇒ approved onboarding
⇒ valid User.partnerId
⇒ existing CRM Partner
```

## 8. CRM Partner mapping

CRM остаётся владельцем `crm.Partner`.
Security хранит только:
```text
User.partnerId
```

ADR-0003 Buyer exception не применять автоматически к Partner.

Если для activation нужен synchronous cross-domain mapping:
```text
ARCHITECTURE DECISION REQUIRED
```
и оформить отдельный ADR/разрешённый orchestration.

## 9. Create-or-link Partner

Retry не должен создавать duplicate Partner.

Deterministic match — только по authoritative business identifier.
Не merge по brand name.

Ambiguous match:
```text
manual review / ARCHITECTURE DECISION REQUIRED
```

## 10. Applicant type

Минимум:
```text
INDIVIDUAL
COMPANY
```

COMPANY:
- legal/company name;
- registration/tax fields where modeled.

INDIVIDUAL:
- personal business/operator fields only if required/modelled.

## 11. Service categories

Applicant может указать категории услуг, которые планирует продавать.

Это onboarding metadata, не Product ownership.

Использовать ACTIVE categories.

## 12. Edit rules

DRAFT / CHANGES_REQUESTED:
- own edit.

SUBMITTED / IN_REVIEW:
- read-only.

APPROVED:
- immutable/history-only except future compliance flow.

REJECTED:
- read-only или explicit reapply policy.

## 13. Submit

Перед submit validate:
- required fields;
- terms accepted;
- business identifiers if required;
- contacts;
- country.

После submit:
```text
SUBMITTED
```

## 14. Internal review

Authorized internal role(s):
```text
view queue
start review
approve
reject
request changes
```

Не смешивать с Product Moderation queue.

## 15. Approval

Approve должен:
1. validate application;
2. create/link CRM Partner through CRM-owned service;
3. set `User.partnerId`;
4. enable PARTNER selling capabilities;
5. set application APPROVED;
6. audit;
7. preserve history.

Cross-domain atomicity/orchestration — только через explicit approved contract/ADR.

## 16. Reject / Request Changes

Reject:
- reason required;
- no selling access.

Request Changes:
- reason/comment;
- application editable;
- re-submit;
- previous review history preserved.

## 17. Partner Cabinet gate

До APPROVED:
- no Product management;
- допустим `/partner/onboarding` со статусом.

После APPROVED:
- normal Partner Cabinet;
- My Products;
- create Product;
- moderation flow.

## 18. Login behavior

Pending applicant:
- onboarding status page.

Approved PARTNER:
- `/partner`.

Rejected/changes requested:
- onboarding page with feedback.

Не отправлять в `/app/*`.

## 19. Documents readiness

Если нужны документы — использовать существующий Document/Attachment abstraction, если он есть.

Не хранить binary в DB.
Не строить full Documents domain здесь.

## 20. Payment/KYC readiness — НЕ РЕАЛИЗОВЫВАТЬ

Baseline 1.6 предусматривает позже:
```text
settlementMode
connected PSP account
bank payout account
KYC/KYB status
payment capabilities
```

В Step 1.10 только neutral readiness hooks, если уже есть в Master.
Не интегрировать Stripe/Adyen/банковские API.

## 21. Status separation

Не смешивать:
```text
User.status
PartnerApplication.status
Partner.status
Product.status
ModerationSubmission.status
Payment/KYC status
```

## 22. RBAC

Applicant:
- read/update own DRAFT/CHANGES_REQUESTED application;
- submit own;
- read own status/history.

Cannot:
- approve self;
- read others;
- create arbitrary Partner;
- set own partnerId;
- assign permissions;
- bypass onboarding.

Reviewer:
- explicit onboarding review permissions.

ADMIN:
- explicit permissions only.

## 23. Self-approval protection

Applicant cannot approve own application even for multi-role accounts.

Object-level conflict check mandatory.

## 24. Audit

Audit:
```text
partner_application.created
partner_application.updated
partner_application.submitted
partner_application.review_started
partner_application.approved
partner_application.rejected
partner_application.changes_requested
partner.created_or_linked
user.partner_linked
```

## 25. Idempotency/concurrency

Protect:
- duplicate submit;
- concurrent approve/reject;
- duplicate Partner create;
- retry approve;
- stale application version.

Only one final decision wins.

## 26. Existing manual PARTNER users

Existing PARTNER + partnerId continue working.

Do not retroactively block them without migration policy.
Classify as legacy/pre-approved if needed.
Broken links — no guessing.

## 27. UI routes

Minimum:
```text
/become-a-partner
/partner/onboarding
/partner/onboarding/edit
/partner/onboarding/status
```

Internal review:
```text
/app/partners/onboarding
```
or canonical equivalent.

## 28. i18n

RU/AZ/EN:
- registration;
- business fields;
- statuses;
- review feedback;
- validation;
- terms labels;
- errors.

## 29. Security

Test:
- role injection;
- partnerId injection;
- application IDOR;
- applicant reads other application;
- self-approval;
- forged reviewer;
- duplicate business identity;
- stale approval;
- pending applicant Product API access;
- pending applicant `/partner/products/new`;
- approved Partner access;
- anonymous review queue.

## 30. Tests

Minimum:
1. anonymous opens partner registration;
2. cannot choose ADMIN;
3. no full selling access after signup;
4. application DRAFT created;
5. own DRAFT update;
6. other application denied;
7. submit → SUBMITTED;
8. submitted read-only;
9. reviewer queue;
10. applicant cannot see queue;
11. start review;
12. self-approval denied;
13. approve creates/links CRM Partner;
14. `User.partnerId == Partner.id`;
15. approved gets Partner Cabinet;
16. rejected does not;
17. request changes reopens edit;
18. re-submit works;
19. retry approve no duplicate Partner;
20. concurrent approve/reject one winner;
21. forged partnerId rejected;
22. pending applicant cannot create Product;
23. approved Partner can create Product;
24. legacy Partner unaffected;
25. RU;
26. AZ;
27. EN;
28. frontend tests/build/typecheck green;
29. backend regression green.

## 31. Не делать

Не реализовывать:
```text
checkout
Payment
PSP
split payment
Settlement
Payout
bank account verification
full KYB provider integration
Sales
OrderRequested
Booking changes
Partner sales reports
Partner finance dashboard
```

## 32. Definition of Done

- public Partner registration;
- PartnerApplication lifecycle;
- no self-activation;
- review/approve/reject/request changes;
- CRM Partner create/link;
- controlled `User.partnerId`;
- pending cannot sell;
- approved enters Partner Cabinet;
- audit/concurrency/security green;
- RU/AZ/EN;
- frontend/backend regressions green.

## 33. После выполнения

Предоставь:
1. changed files;
2. PartnerApplication model/migration;
3. lifecycle;
4. registration flow;
5. CRM Partner mapping;
6. activation flow;
7. Partner Cabinet gate;
8. review queue;
9. approve/reject/request changes;
10. RBAC;
11. concurrency/idempotency;
12. audit;
13. legacy Partner handling;
14. i18n;
15. frontend tests;
16. browser tests;
17. backend tests;
18. typecheck/build;
19. regression;
20. git diff;
21. issues;
22. ADRs / `ARCHITECTURE DECISION REQUIRED`.

Не переходи к Step 1.11 автоматически.

Финальная строка строго:
```text
PHASE 1 STEP 1.10 COMPLETED — WAITING FOR REVIEW
```
