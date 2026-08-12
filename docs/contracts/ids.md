# Каноническая ID Policy (Baseline §0.8)

Бизнес-идентификаторы неизменяемы после создания. Генерируются **только
доменом-владельцем** через атомарный счётчик `events.BusinessSequence`.

| Префикс | Сущность | Владелец |
|---|---|---|
| `PRD-` | Product | Catalog |
| `CAT-` | Category | Catalog |
| `TRF-` | Tariff / Rate Plan (canonical commercial variant, Step 1.8B) | Catalog |
| `UNI-` | ServiceUnit (Seller Commercial/Service Unit, Step 1.8A) | Catalog |
| `CPR-` | CommercialPeriod (date-based period price/availability факт, Step 1.8C) | Catalog |
| `CRS-` | CommercialRestriction (scoped commercial restriction/override, Step 1.8D) | Catalog |
| `CUS-` | Customer | CRM |
| `CNT-` | Contact | CRM |
| `COM-` | Company | CRM |
| `PAR-` | Partner | CRM |
| `SUP-` | Supplier | CRM |
| `ORD-` | Order (внутренний) | Order |
| `TH-YYYY-######` | Order (пользовательский номер) | Order |
| `BKG-` | Booking | Booking |
| `CML-` | Communication | Communication |
| `SELL-` | PublicSellerProfile | Catalog (seller identity) |
| `SPP-` | Seller profile proposal | Catalog (seller identity) |
| `SF-` | PartnerStorefront | Catalog (storefront) |
| `APP-` | PartnerApplication | Security (onboarding) |
| `USR-` | User (staff/role accounts) | Security |
| `LED-` | Lead | Sales |
| `OPP-` | Opportunity | Sales |
| `QTE-` | Quote | Sales |
| `SAL-` | Sale | Sales |
| `CKT-` | CheckoutIntent (commercial intent) | Sales |
| `RSR-` | AvailabilityReservation (capacity hold) | Catalog |
| `CAP-` | SellerCapability (commercial capability) | Reverse Marketplace (reverse.*) |
| `BRQ-` | BuyerRequest (demand entry) | Reverse Marketplace (reverse.*) |
| `PRP-` | SellerProposal (pre-commercial response) | Reverse Marketplace (reverse.*) |

*Exit Audit Step 1.18:* таблица синхронизирована с фактическим реестром
`IdsService.nextCode` (PRD/CAT/TRF/CUS/CNT/COM/PAR/SUP/ORD/TH/BKG/CML/SELL/SPP/SF/APP/USR).
*Step 2.1:* добавлены Sales-префиксы LED/OPP/QTE/SAL (sales.*, Phase 2).
*Step 2.3A:* добавлен CKT- (CheckoutIntent, sales.*, Phase 2).
*Step 2.4:* добавлен RSR- (AvailabilityReservation, catalog.*, capacity hold) — префикс зарегистрирован в `IdsService.nextCode`.

*Step 2.4 (полный реестр):* `PRD/CAT/TRF/CUS/CNT/COM/PAR/SUP/ORD/TH/BKG/CML/SELL/SPP/SF/APP/USR/LED/OPP/QTE/SAL/CKT/RSR`.
*Step 2.5:* ORD-*/TH-YYYY-###### создаются canonical OrderRequested consumer-ом
(тот же `IdsService`); год TH-* — по UTC (canonical time-конвенция).
*Step 2.2A:* добавлен CAP- (SellerCapability, reverse.*, Phase 2) — коммерческие
capability declarations.
*Step 2.2B:* зарегистрирован BRQ- (BuyerRequest, reverse.*) — канонический
buyer-demand префикс (финальная регистрация в точке реализации 2.2B).
*Step 2.2D:* зарегистрирован PRP- (SellerProposal, reverse.*) — pre-commercial
ответ Seller-а на распределённый BuyerRequest (промпт 2.2D §37).
*Step 2.2E:* pre-sale conversations (communication.CommunicationThread + её
сообщения) используют существующий префикс CML-* (тот же атомарный счётчик —
никакого нового ID-домена; 2.2E §18).
*Step 2.2F (DD-030, target = Opportunity):* конверсия выбранного SellerProposal
создаёт canonical `OPP-*` (существующий Sales-префикс; никакого нового ID-домена).
Provenance refs — trusted refs БЕЗ FK: `Opportunity.buyerRequestId` (BRQ-*),
`Opportunity.proposalId` (PRP-*, @unique — один Proposal → одна Opportunity),
`Opportunity.sellerId` (crm.Partner). `BuyerRequest.selectedProposalId` @unique —
one-winner invariant (2.2F §11/§12).
*Step 1.8A (DD-025 B):* добавлен `UNI-` (ServiceUnit, catalog.*) — персистентная
Seller-определённая коммерческая/сервисная единица ВНУТРИ Product (комната
отеля, вариант трансфера, пакет тура и т.п.). Префикс зарегистрирован в
`IdsService.nextCode` (атомарный счётчик). НЕ конфликтует с существующими
(PRD/CAT/TRF/.../CAP/BRQ/PRP — проверено по реестру).

Формат: `PREFIX-` + число, дополненное слева нулями (8 цифр; для
`TH-YYYY-######` — 6 цифр, последовательность сквозная по году).

Реализация: `backend/src/shared/ids.service.ts` (`IdsService.nextCode`).
Инкремент выполняется `upsert`-ом в рамках транзакции домена — атомарно и
без дубликатов при параллельной работе.
