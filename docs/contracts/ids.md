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

Формат: `PREFIX-` + число, дополненное слева нулями (8 цифр; для
`TH-YYYY-######` — 6 цифр, последовательность сквозная по году).

Реализация: `backend/src/shared/ids.service.ts` (`IdsService.nextCode`).
Инкремент выполняется `upsert`-ом в рамках транзакции домена — атомарно и
без дубликатов при параллельной работе.
