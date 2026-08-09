# Каноническая ID Policy (Baseline §0.8)

Бизнес-идентификаторы неизменяемы после создания. Генерируются **только
доменом-владельцем** через атомарный счётчик `events.BusinessSequence`.

| Префикс | Сущность | Владелец |
|---|---|---|
| `PRD-` | Product | Catalog |
| `CAT-` | Category | Catalog |
| `TRF-` | Tariff | Catalog |
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

*Exit Audit Step 1.18:* таблица синхронизирована с фактическим реестром
`IdsService.nextCode` (PRD/CAT/TRF/CUS/CNT/COM/PAR/SUP/ORD/TH/BKG/CML/SELL/SPP/SF/APP/USR).

Формат: `PREFIX-` + число, дополненное слева нулями (8 цифр; для
`TH-YYYY-######` — 6 цифр, последовательность сквозная по году).

Реализация: `backend/src/shared/ids.service.ts` (`IdsService.nextCode`).
Инкремент выполняется `upsert`-ом в рамках транзакции домена — атомарно и
без дубликатов при параллельной работе.
