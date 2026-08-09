# PHASE 1 — STEP 1.11: PUBLIC SELLER IDENTITY & ANTI-DISINTERMEDIATION

## Статус входа
Steps 1.0–1.10 — APPROVED.

Начни только **PHASE 1 — STEP 1.11: Public Seller Identity & Anti-Disintermediation**.

Не начинай Partner Storefront, checkout, Payment/PSP, Sales, OrderRequested, Booking changes, Buyer Cabinet full или Partner Finance.

## 1. Цель
Разделить:
```text
CRM Partner Identity ≠ Marketplace Public Seller Identity
```
Marketplace показывает seller-safe projection, а не raw CRM Partner.

## 2. Главный invariant
В Public Marketplace не публикуются напрямую:
```text
legalName
taxId
registrationNumber
private address
phone
email
website
WhatsApp
Telegram
social links
bank/payment data
internal CRM notes
staff contacts
```
если отдельная policy явно не разрешает поле.

## 3. PublicSellerProfile
Добавь/переиспользуй отдельную публичную projection/model:
```text
PublicSellerProfile
id
partnerId
publicId
publicDisplayName?
publicLogoMediaId?
publicDescription?
countryLabel?
cityLabel?
visibilityMode
verificationBadge
memberSince
completedSales?    // only if authoritative
rating?            // only after Reviews domain
reviewCount?       // only after Reviews domain
status
approvedAt?
approvedById?
createdAt
updatedAt
```
Не использовать CRM Partner напрямую как public DTO.

## 4. Visibility modes
Минимум:
```text
ANONYMOUS
VERIFIED_ALIAS
PUBLIC_BRAND
```

ANONYMOUS:
```text
Проверенный партнёр TravelHub
country/city general label
memberSince
verification badge
```

VERIFIED_ALIAS:
approved `publicDisplayName`.

PUBLIC_BRAND:
approved real brand/display name.

Даже PUBLIC_BRAND не раскрывает phone/email/site/socials автоматически.

## 5. Default
Для нового Partner default:
```text
ANONYMOUS
```
Нельзя автоматически публиковать legalName после onboarding approve.

## 6. Moderator control
MODERATOR получает отдельные permissions:
```text
seller_public_profile.review
seller_public_profile.approve_alias
seller_public_profile.approve_brand
seller_public_profile.hide_identity
seller_public_profile.request_changes
```
или equivalent.

MODERATOR может approve alias/brand, request changes, hide identity, change visibilityMode через controlled transition.
MODERATOR не получает CRM edit rights.

## 7. Partner proposal
PARTNER может предложить:
```text
publicDisplayName
logo
publicDescription
country/city label
```
Но публикация требует moderation decision.
PARTNER не может сам переключить себя в `PUBLIC_BRAND`.

## 8. Public Catalog contract
Текущий provider contract заменить на seller-safe projection:
```text
seller {
  publicId
  displayName
  visibilityMode
  verified
  memberSince
  locationLabel?
  rating?
  reviewCount?
  completedSales?
}
```
Internal `partnerId` по возможности не отдавать.

## 9. Product Card / PDP
Card и PDP используют только PublicSellerProfile.

Не показывать:
- email;
- phone;
- website;
- socials;
- exact office address;
- raw CRM name.

## 10. Stage-based disclosure readiness
Заложить:
```text
PRE_PURCHASE
POST_ORDER
POST_CONFIRMATION
POST_PAYMENT / FULFILLMENT
```
В Step 1.11 реализовать только PRE_PURCHASE safe projection.

## 11. Anti-disintermediation content policy
Product moderation должна блокировать попытки вывести Buyer за пределы TravelHub через:
```text
phone numbers
email addresses
web URLs
WhatsApp
Telegram
Instagram/social handles
QR codes
"найдите нас..."
"напишите напрямую..."
external booking links
```
Минимум в:
- title;
- shortDescription;
- description;
- captions;
- alt text;
- public seller description.

## 12. Automated text detection baseline
Добавь deterministic detection для:
- email;
- URL/domain;
- phone-like patterns;
- messenger/social markers.

False positive → review flag/controlled validation, не silent mutation.
AI moderation не внедрять.

## 13. Image/QR policy
OCR/AI image moderation не делать.
Но policy явно запрещает contact details/QR/external URLs в Product media.

Reason codes:
```text
EXTERNAL_CONTACT_INFO
EXTERNAL_BOOKING_LINK
QR_CODE_OR_CONTACT_MEDIA
DISINTERMEDIATION_ATTEMPT
```

## 14. Moderation integration
Расширить существующую Product moderation reason model.
Existing lifecycle approve/reject/request_changes не ломать.

## 15. Public seller moderation lifecycle
Минимум:
```text
DRAFT
SUBMITTED
IN_REVIEW
APPROVED
CHANGES_REQUESTED
REJECTED
HIDDEN
```

Можно переиспользовать moderation infrastructure, если semantics не смешиваются.

## 16. Seller profile changes
Approved profile changes идут через proposal:
```text
Published N
→ proposal N+1
→ moderation
→ approve
→ public N+1
```
No silent overwrite.

## 17. Security
Проверить:
- PARTNER меняет чужой profile;
- PARTNER self-approves;
- MODERATOR меняет CRM Partner;
- raw CRM leak;
- direct lookup by partnerId;
- hidden/unpublished profile leak;
- proposal leak.

## 18. i18n
RU/AZ/EN:
- seller labels;
- verification badge;
- anonymous label;
- moderation reasons;
- Partner proposal UI;
- moderator review UI.

## 19. Existing Partners migration
Для существующих Partner:
- не публиковать raw CRM name автоматически;
- создать conservative PublicSellerProfile;
- default visibilityMode = ANONYMOUS unless explicitly approved;
- idempotent migration;
- no guessing.

## 20. Tests
Минимум:
1. raw CRM legalName absent by default;
2. phone absent;
3. email absent;
4. website absent;
5. ANONYMOUS renders generic label;
6. VERIFIED_ALIAS renders alias;
7. PUBLIC_BRAND renders approved brand;
8. PARTNER cannot self-switch visibility;
9. PARTNER cannot edit other profile;
10. MODERATOR can review;
11. MODERATOR cannot edit CRM Partner;
12. hidden profile not exposed;
13. proposal not public before approve;
14. approved change becomes public;
15. email in Product content flagged/rejected;
16. URL detected;
17. phone-like contact detected;
18. messenger/social marker detected;
19. moderation reason preserved;
20. public JSON contains no private CRM fields;
21. Marketplace regression green;
22. Partner Cabinet regression green;
23. onboarding regression green;
24. frontend build/typecheck/tests green;
25. backend regression green.

## 21. Не делать
Не реализовывать:
```text
Partner Storefront
custom subdomain
custom domain
checkout
Payment
PSP
Sales
Order
Booking
post-purchase contact disclosure
chat anti-circumvention
AI/OCR image moderation
Reviews/Ratings backend
```

## 22. Definition of Done
- CRM Partner and PublicSellerProfile separated;
- conservative default visibility;
- moderator controls public identity;
- Product Card/PDP use seller-safe projection;
- private contacts never leak pre-purchase;
- profile changes moderated;
- text anti-disintermediation baseline exists;
- reason codes exist;
- existing Partners migrated safely;
- RU/AZ/EN;
- regressions green.

## 23. После выполнения
Предоставь:
1. changed files;
2. PublicSellerProfile model;
3. visibility modes;
4. migration/backfill;
5. Partner proposal flow;
6. moderator review flow;
7. Public Catalog DTO changes;
8. ProductCard/PDP changes;
9. anti-disintermediation validator;
10. moderation reason additions;
11. security tests;
12. frontend tests;
13. browser tests;
14. backend tests;
15. typecheck/build;
16. regressions;
17. git diff;
18. issues;
19. ADRs / `ARCHITECTURE DECISION REQUIRED`.

Не переходи к Step 1.12 автоматически.

Финальная строка строго:
```text
PHASE 1 STEP 1.11 COMPLETED — WAITING FOR REVIEW
```
