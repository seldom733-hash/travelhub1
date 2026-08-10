# ADR-0012: Reverse Marketplace — bounded context & ownership (Step 2.2A–2.2F prerequisite)

- **Status:** Accepted (Phase 2 — Reverse Marketplace; ADR-0012 Strict Review APPROVED WITH REVIEW FIXES)
- **Date:** 2026-08-10
- **Related:** ADR-0001 (modular monolith, cross-schema rules), ADR-0005 (PublicSellerProfile / catalog boundary), ADR-0007 (Partner CRM & acquisition boundary), ADR-0011 (Communication bounded-context precedent), Execution Sequence Amendment, Reverse Marketplace Roadmap Amendment

## Context

Reverse Marketplace — второй demand-path: request-led (BuyerRequest → matching →
Seller proposals → selection → существующий Sales pipeline) в дополнение к
product-led (Marketplace/Storefront → Product → Sales). Amendment зафиксировал 10
non-negotiable инвариантов, но ownership оставался RECOMMENDED: Roadmap
(Reverse Marketplace dependency analysis) требует формального ADR о новом
bounded context `reverse.*` (прецедент — ADR-0011 для `communication.*`) ДО
начала Step 2.2A.

Inventory (verified в репозитории): Sales владеет Lead (LED-*) / Opportunity
(OPP-*) / Quote (QTE-*) / CheckoutIntent (CKT-*) / Sale (SAL-*) — canonical
коммерческий pipeline (2.1–2.5). Communication владеет `communication.*` /
`CML-*` (ADR-0011). Catalog владеет Product/Tariff/Availability/PublicSellerProfile.
Security/CRM владеют Partner identity (PAR-*). Order/Booking/Finance — собственные
домены. Ни один существующий контекст не владеет request-led demand facts без
нарушения границ владения.

## Terminology

«Reverse Marketplace» — request-led (buyer-led) направление спроса: Buyer
публикует запрос, Sellers отвечают предложениями; обратное product-led
(Marketplace/Storefront → Product → Sales). Термин НЕ связан с возвратами/
реверсами платежей (payment reversal/refund — будущий Payment/Finance домен;
существующие `finance.refund.*` permissions относятся к возвратам, не к этому
контексту). Коллизий в репозитории не выявлено; переименование не требуется.

## Problem

1. Определить, является ли Reverse Marketplace first-class bounded context
   (`reverse.*`) и кто владеет его сущностями (capabilities, BuyerRequest,
   matching/distribution, Proposal).
2. Обеспечить, что request-led demand НЕ создаёт второй commerce/order/chat stack:
   конвергенция в canonical Sales, Communication остаётся у `communication.*`.
3. Зафиксировать acquisition-атрибуцию (`BUYER_REQUEST`, Step 2.5B) и privacy/
   object-scope границы ДО реализации, без premature заморозки полей/событий.

## Decision

1. **Reverse Marketplace — first-class bounded context `reverse.*`** (отдельная
   PostgreSQL-схема, конвенция «одна схема = один домен», прецедент ADR-0011).
   Recommendation ACCEPTED. Решение аддитивно; существующие домены не меняются.
2. **Reverse Marketplace — acquisition path, НЕ transaction system.** Никаких
   BuyerRequestOrder/ProposalOrder/reverse Checkout/Payment/Booking/Quote-engine.
   Выбранный Proposal конвергирует в существующий canonical Sales pipeline.
3. **`MATCHED ≠ CONTACT DISCLOSED`** — matching/distribution не раскрывает
   защищённые buyer-контакты автоматически; точная policy раскрытия — отдельный
   канонический later step (граница фиксируется сейчас).
4. **Acquisition source `BUYER_REQUEST` сохраняется end-to-end** (Step 2.5B enum
   уже зарегистрирован): конвертация в Sales НЕ заменяет его на DIRECT/
   MARKETPLACE; publication channel остаётся отличным от acquisition.
5. **Conversion point (Lead vs Opportunity vs Quote) — DEFERRED** (DD-030), но с
   hard prerequisite: точный conversion command/target резолвится ДО начала Step
   2.2F. Steps 2.2A–2.2E безопасно реализуемы без него (ownership фиксируется
   здесь; конвертация — owner-step 2.2F).

## Bounded context

`schema: reverse.*` — request-led demand facts. Не является: Sales, Catalog,
Communication, Security/CRM, Order/Booking/Finance, event bus, AuditLog.

## Ownership table

| Сущность | Владелец | Примечание |
|---|---|---|
| Seller Commercial Capabilities (service categories, destination coverage, accepts Buyer Requests ON/OFF, capability lifecycle/status, own-scope, audit) | `reverse.*` | seller-declared commercial eligibility; НЕ inventory/pricing/availability authority |
| BuyerRequest (identity, buyer ownership, category/service intent, destination intent, dates/flexibility, travelers/PAX, budget/preferences, lifecycle, privacy state, matching facts) | `reverse.*` | demand entity; НЕ Lead/Opportunity/Quote/Sale/Order/Booking/Communication |
| Matching / Distribution facts (evaluated/distributed/matched) | `reverse.*` | server-authoritative, auditable, deterministic eligibility; `MATCHED/DISTRIBUTED` ≠ `CONTACT DISCLOSED`; не создаёт Sales-сущности |
| Seller Proposal (0..N на BuyerRequest, per-Seller isolated) | `reverse.*` | pre-commercial response; НЕ canonical Quote; не второй pricing engine; amount до canonical Quote non-binding |
| Communication (messages/conversation lifecycle) | `communication.*` (CML-*) | reverse.* НЕ строит второй chat |
| Partner identity / legal location | Security/CRM (PAR-*) | НЕ определяет selling coverage (§5) |
| PublicSellerProfile | Catalog (SELL-*) | отдельная identity; НЕ source capabilities |
| Product / inventory / pricing / availability | Catalog | НЕ source capabilities; publication не grant'ит capabilities автоматически |
| Lead / Opportunity / Quote / CheckoutIntent / Sale | Sales | конвергенция (2.2F); distribution не создаёт их |
| Order / Booking / Finance | собственные домены | только canonical pipeline |

## Allowed dependencies

reverse.* может ЧИТАТЬ trusted references (по ID, без cross-schema FK, ADR-0001):
Security/CRM (Partner identity/status), Catalog (Product/PublicSellerProfile refs),
Sales (Lead/Opportunity/Quote refs при конвертации), Communication metadata (где
контрактно). Cross-context мутации — только через owner services/commands/events.

## Forbidden dependencies / writes

reverse.* НЕ пишет напрямую: `catalog.*`, `sales.*`, `order.*`, `booking.*`,
`finance.*`, `communication.*`. НЕ создаёт parallel checkout/order/booking/payment/
quote-engine/event bus. НЕ дублирует Communication lifecycle.

## Seller capability semantics

- Seller's legal/registration/office country НЕ определяет, где Seller может
  продавать. Пример остаётся валидным: Seller в Baku/AZ может продавать отели/
  туры в Турции.
- Eligibility — на основе declared/authorized capabilities + destination coverage.
- Capability ≠ inventory: Seller может быть eligible (HOTEL + Turkey) без
  опубликованного hotel Product/live inventory.
- Product publication НЕ grant'ит Reverse Marketplace capabilities автоматически
  (кроме явной future-синхронизации по policy).
- Service taxonomy extensible (Accommodation/Hotel/Apartment/Villa; Tours/
  Packages; Transport/Transfer/Car Rental; Activities/Excursion/Guide) — без
  hardcoded cross-category исключений.

## BuyerRequest ownership

`reverse.*`. Demand entity: request identity, buyer ownership, category/service
intent, destination/service-area intent, dates/date flexibility, travelers/PAX,
budget/preferences (где разрешено), lifecycle, privacy/disclosure state,
matching/distribution facts, audit/history, acquisition context. Точный набор
полей/lifecycle enum — implementation-step 2.2B (НЕ замораживается в ADR).

## Matching / Distribution ownership

`reverse.*`. Server-authoritative, auditable, детерминированный eligibility
foundation; никакого client self-promotion; unmatched Seller не получает доступ к
request; Seller не может forge собственную eligibility через payload.
Распределение НЕ создаёт Lead/Opportunity/Quote/Sale автоматически
(`1 BRQ → 70 matched → 25 delivered → 6 responses` — иллюстративный funnel,
НЕ бизнес-константа; без 70/25 Leads). `MATCHED/DISTRIBUTED` строго отличен
от `CONTACT DISCLOSED`.

## Proposal ownership

`reverse.*`. 0..N proposals на BuyerRequest; строгая per-Seller изоляция (Seller A
не видит Proposal B); Buyer видит только proposals своего request; внутренний
доступ — по permissions. Proposal НЕ canonical Quote, не второй pricing engine;
amount до canonical Quote non-binding (если Roadmap не решит иначе); binding
commercial authority — canonical Quote/Checkout/Sale.

## Communication boundary

Communication остаётся у `communication.*` (CML-*, ADR-0011). reverse.* НЕ
реализует второй messaging. Контекстные refs: BuyerRequest + Buyer + Seller
[+ Proposal]. Communication владеет messages/conversation lifecycle; reverse.*
владеет request/proposal/matching facts. IDOR/cross-Seller privacy: Seller A не
читает conversation Seller B (кроме явной future-policy).

## Sales convergence

Единственный путь: `BuyerRequest → Seller Proposal → canonical Sales conversion
point → (Lead|Opportunity|Quote по решению DD-030) → Checkout → Sale →
OrderRequested → Order → Booking → Finance`. Никаких параллельных стеков.

## Acquisition propagation

`BUYER_REQUEST` (канонический enum Step 2.5B) — immutable end-to-end через
конвертацию; publication ≠ acquisition; conversion не заменяет source.

## Privacy / contact disclosure

`MATCHED ≠ CONTACT DISCLOSED`. Matched Seller получает только коммерчески
необходимые request facts; phone/email/WhatsApp/passport/raw Customer data/лишний
PII — не автоматически. Anti-disintermediation (Step 1.11/3.37B) остаётся
авторитетной. Точная disclosure-policy — later canonical step.

## Security / object scope

- Buyer владеет своими requests; Seller видит только distributed/matched свои
  requests по canonical правилам; Seller видит только свой Proposal; чужие
  proposals изолированы.
- Object scope server-authoritative; role names НЕ заменяют capability/
  permission checks (project policy — permissions); ADMIN/system capabilities не
  оправдывают ordinary tenant leakage.
- Small-organization compat: один employee может иметь несколько
  capabilities/permissions.

**Threat model (для implementation-reviews 2.2A–2.2E):**
- Seller guessing BuyerRequest IDs → own-scope predicate на каждый read
  (request принадлежит Buyer ИЛИ распределён этому Seller); без scope — 404.
- Seller reading unmatched request → запрещено (только distributed/matched
  свои request-факты).
- Seller reading чужой Proposal → per-Seller изоляция (0..N, только own).
- Seller reading чужую conversation → Communication CML-* own-scope.
- Seller forging capability/coverage → server-authoritative validation,
  payload НЕ источник eligibility.
- Seller self-marking MATCHED/DISTRIBUTED → невозможен: facts пишутся только
  server matching-командой, auditable.
- Matching retry после потери eligibility → повторная проверка eligibility на
  каждом delivery; retry не расширяет доступ.
- ADMIN/support доступ ≠ tenant доступ: permissions проверяются всегда;
  elevated roles не обходят object scope без явной команды.

## Entitlements boundary

«Seller allowed to participate in Buyer Requests» — entitlement product rules
DEFERRED: capability declaration сама по себе НЕ даёт commercial entitlement;
approval/onboarding сама по себе НЕ даёт все Reverse Marketplace entitlements.
Без hardcode размера организации/ролей.

**Authority/gate (documented, НЕ реализуется в 2.2A):** matching-time predicate
«eligible + entitlement permits participation» проверяется против будущего
canonical entitlement решения (product entitlement rules — НЕ Billing domain
сегодня, authority определится отдельным решением при реализации gate). Step
2.2A моделирует capability (декларацию), не entitlement-грант; gate остаётся
открытой точкой для matching-step 2.2C.

## Events / reliability

Принципы (без заморозки каталога событий): reverse.* публикует факты, которыми
владеет; Sales — Sales-факты; Communication — Communication-факты; конвертация
использует canonical contracts; matching/distribution НЕ маскируется под Sales-
события. matching/distribution facts replay/idempotency-safe где async;
proposal conversion не дублирует canonical Sales-объекты; retries не раскрывают
request неeligible Seller-у; reliability — существующие платформенные механизмы
(outbox/inbox), не reverse-specific bus.

## Service Templates compatibility

2.2A–2.2F реализуемы до 1.8A–1.8D ТОЛЬКО в limited-scope (Execution Sequence
STRICT REVIEW): capabilities — легковесные seller-declared service categories +
destination coverage; matching не зависит от live inventory; matching не требует
нормализованных room/unit/tariff/period структур; Service Templates — later
commercial modeling. 1.8A–1.8D сюда не притягиваются.

## Consequences

**Benefits:**
- Ownership закрыт: request-led facts в `reverse.*`, конвергенция через Sales,
  коммуникация через Communication — без второй transaction/chat/quote системы.
- 2.2A–2.2E реализуемы без premature conversion-решения (2.2F — gate DD-030).
- Acquisition-атрибуция (BUYER_REQUEST) и privacy-граница (MATCHED ≠ DISCLOSED)
  зафиксированы архитектурно.
- ADR-0001 cross-schema read-by-ID и ADR-0007 acquisition boundary соблюдены.

**Costs / burden (осознанно принятые):**
- Новый bounded context + PostgreSQL-схема `reverse.*` — новая surface
  ownership, миграций и операционной нагрузки (плюс к events/security schemas).
- Новые cross-context контракты (read-by-ID refs на Security/CRM, Catalog,
  Sales, Communication) — стоимость интеграции и валидации.
- Privacy/security burden: matching/distribution и per-Seller изоляция требуют
  строгих own-scope проверок и аудита (threat model выше).
- Matching/distribution audit-требования (кто/когда/каким Sellers распределён).
- Единая точка конвергенции Proposal→Sales mapping (DD-030) — архитектурная
  зависимость для 2.2F и последующих коммерческих шагов.
- Операционная сложность: новые сущности/lifecycle/history/события в рамках
  существующих платформенных механизмов (outbox/inbox).

## Deferred decisions

- **DD-030 (new): Proposal → Sales conversion point** (Lead vs Opportunity vs
  Quote) — DEFERRED с hard prerequisite до начала 2.2F; 2.2A–2.2E не блокирует.
- Exact BuyerRequest/Proposal lifecycle enums, поля, events — implementation
  steps 2.2B–2.2F.
- Contact-disclosure policy (MATCHED ≠ DISCLOSED точные правила) — later
  canonical step.
- Reverse Marketplace entitlements product-rules — deferred.
- Seller Proposal ID prefix — implementation gate (ID registry).

## Implementation prerequisites

1. **ADR-0012 APPROVED** (после отдельного ADR Strict Review) — до начала 2.2A.
2. `reverse.*` schema + `BRQ-*` prefix — регистрация в `ids.md`/`IdsService` при
   implementation 2.2B (BRQ-* — working prefix из Roadmap, subject to
   verification).
3. DD-030 resolved до 2.2F.
4. Limited-scope правило 2.2A (capability ≠ inventory) — соблюдается.

## Rejected alternatives

- **BuyerRequest в Sales** — отклонено: Sales владеет canonical коммерческим
  pipeline; demand-entity стала бы «Lead-подобной» и нарушила инвариант «demand
  ≠ Lead/Opportunity», смешав acquisition и sales-stage.
- **Capabilities в Catalog** — отклонено: Catalog владеет Product/inventory;
  capabilities — seller-declared eligibility, не каталогный мастер-данные;
  смешение нарушило бы Product ≠ capabilities.
- **Capabilities только из опубликованных Products** — отклонено: инвариант
  «eligible без live inventory»; Seller может отвечать HOTEL+Turkey без Product.
- **Matching по legal country Seller** — отклонено: legal location ≠ coverage
  (инвариант №1; пример Baku↔Turkey).
- **Proposal сразу как Sales Quote** — отклонено: Proposal pre-commercial,
  competitive; premature Quote создал бы второй pricing engine; binding
  authority — canonical Quote.
- **Второй Reverse Marketplace checkout/order pipeline** — отклонено: violation
  инварианта №8; Reverse Marketplace — acquisition path, не transaction system.
- **Chat внутри reverse.*** — отклонено: Communication = CML-* (ADR-0011);
  второй messaging домен запрещён.
- **Auto-create Leads для каждого matched Seller** — отклонено: distribution ≠
  Lead creation (инвариант №4); conversion point — DD-030.

## Roadmap impact

- Execution Sequence: Reverse Marketplace ADR `✅ APPROVED` (ADR-0012 STRICT
  REVIEW, APPROVED WITH REVIEW FIXES); ADR-0012 → Accepted; unique NEXT —
  Step 2.2A (pairing rule: реализация остановится на отдельный STRICT
  REVIEW). 2.2A может начинаться.
- Reverse Marketplace dependency analysis: ссылка на ADR-0012 (prerequisite
  закрыт формальным решением).
- DD map: +DD-030 (conversion point, deferral + hard prerequisite).
