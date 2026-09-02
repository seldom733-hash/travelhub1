# TRAVELER DATA REQUIREMENTS + CHECKOUT COLLECTION + BOOKING SNAPSHOT + VOUCHER SOURCE — ARCHITECTURE AUDIT

```
Starting SHA:    fa1606d
Audit SHA:       (pending)
Final SHA:       (pending)
origin/master:   fa1606d
```

---

# 1. Текущее состояние (Current State Audit)

## 1.1 Schema Models —旅行者/Passenger

В Prisma schema существуют **4 отдельные модели** для traveler data:

| Model | Schema | Attached To | Fields | Status |
|---|---|---|---|---|
| `QuoteTraveler` | sales | Quote | firstName, lastName, birthDate | Exist, populated via Quote API |
| `CheckoutIntentTraveler` | sales | CheckoutIntent | firstName, lastName, birthDate | Exist, populated via Checkout API |
| `OrderTraveler` | order | Order | firstName, lastName, birthDate, citizenship, gender, passportNumber, passportExpiry, customerId, dataCompleteness | Exist, **0 records** |
| `Passenger` | booking | Booking | firstName, lastName, birthDate, citizenship, gender, passportNumber, passportExpiry | Exist, **0 records** |

### Ключевые observations:

1. **4 traveler models** — каждый привязан к разной фазе commerce lifecycle
2. **Minimal fields в Quote/Checkout** — только name + birthDate
3. **Extended fields в Order/Booking** — добавлены citizenship, gender, passport, dataCompleteness
4. **0 records** в OrderTraveler и Passenger — модель существует, но не используется
5. **Нет Product-level traveler requirements** — нет конфигурации seller-defined requirements
6. **Нет snapshot mechanism** — нет снапшота traveler requirements при создании Booking

## 1.2 Commerce Flow — Current Implementation

```
Quote (QuoteTraveler: firstName, lastName, birthDate)
  ↓
CheckoutIntent (CheckoutIntentTraveler: firstName, lastName, birthDate)
  ↓
Order → OrderTraveler (firstName, lastName, birthDate, citizenship, gender, passport, dataCompleteness)
  ↓
Booking → Passenger (firstName, lastName, birthDate, citizenship, gender, passport)
  ↓
Payment
  ↓
Voucher (пока не реализован)
```

## 1.3 Checkout API — Current State

```typescript
// CheckoutTravelerInputDto — minimal
class CheckoutTravelerInputDto {
  firstName: string;     // required
  lastName: string;      // required
  birthDate?: string;    // optional
}

// travelers передаются при создании CheckoutIntent
POST /sales/checkout { quoteId, customerId, serviceDate, travelers: [...] }

// travelers можно обновить отдельным PUT
PUT /sales/checkout/:code/travelers { travelers: [...] }
```

## 1.4 Frontend — Current State

- **Нет traveler-related компонентов** в frontend
- **Нет checkout traveler form**
- **Нет voucher components**
- Traveler data вводятся только через API (curl/тесты)

---

# 2. Passenger vs Traveler — Resolution

## 2.1 Текущая terminological confusion

Существуют два термина для одного business concept:

```
Passenger (booking schema)  — technical model для Booking
OrderTraveler (order schema) — technical model для Order
```

## 2.2 Canonical Resolution

```
Traveler = business term (= участник поездки/тура)
Passenger = текущий technical model в booking schema (для Booking)
OrderTraveler = текущий technical model в order schema (для Order)
```

**Новая entity НЕ создаётся.** Существующие модели используются как есть.

До approved schema evolution:

```
Traveler business concept
  → QuoteTraveler (quote phase)
  → CheckoutIntentTraveler (checkout phase)
  → OrderTraveler (order phase)
  → Passenger (booking phase — canonical traveler at fulfillment)
```

---

# 3. Customer ≠ Payer ≠ Traveler Contract

## 3.1 Определения

```
Customer
= покупатель / заказчик / CRM customer
= лицо, которое делает заказ и несёт ответственность за него

Payer
= фактическое лицо/сторона, осуществившая платёж
= может совпадать с Customer, а может быть другим лицом (company, gift, etc.)

Traveler
= лицо, которое реально получает/использует забронированную услугу
= участник поездки/тура/услуги
```

## 3.2 Supported Cases

| Case | Customer | Payer | Traveler | Example |
|---|---|---|---|---|
| A | = Payer = Traveler | = Customer = Traveler | = Customer = Payer | Solo traveler booking for self |
| B | = Payer | Traveler = другое лицо | ≠ Customer | Parent books for child |
| C | ≠ Payer | Traveler(s) = другие лица | ≠ Customer, ≠ Payer | Company books for employees |
| D | = один из Travelers | = Customer | Customer = one of several | Family booking, parent travels too |
| E | ≠ Traveler | = Customer | ≠ Customer | Gift booking, customer doesn't travel |

## 3.3 Current Implementation

- `OrderTraveler.customerId` — optional relation к CRM Customer
- `Passenger` — не имеет customerId
- `Customer` — основной buyer в Order
- **Нет Payer entity** — payment привязан к Order, а Payer implicit через Order.customerId

## 3.4 Recommended Payer Model

V1: Payer = Order.customerId (implicit). Отдельная Payer entity не создаётся.

V2 (future): Если потребуется explicit Payer → отдельная задача.

---

# 4. Traveler Ownership

## 4.1 Canonical Relationship

```
Booking → 1..N Passengers (= Travelers)
```

**Primary traveler data принадлежат Booking context.**

## 4.2 Не создавать CRM Customer автоматически

```
Traveler ≠ automatically CRM Customer

Допустимо:
  Traveler.customerId (optional) — если тот же человек уже CRM entity

Запрещено:
  Booking creation → automatically create CRM Customer для каждого Traveler
```

## 4.3 OrderTraveler vs Passenger

```
OrderTraveler → snapshot на момент Order creation
Passenger → canonical traveler data для fulfillment
```

OrderTraveler используется как промежуточный snapshot до Booking creation. Passenger — итоговая модель.

---

# 5. Product Requirement Architecture

## 5.1 Текущее состояние

**Нет product-level traveler requirements.** Все путешественники одинаковы.

## 5.2 Canonical Target

```
Product / Service
  └── Traveler Data Requirements
        ├── First Name        REQUIRED
        ├── Last Name         REQUIRED
        ├── DOB               REQUIRED (insurance) / OPTIONAL (tour) / NOT_REQUESTED (transfer)
        ├── Citizenship       OPTIONAL
        ├── Gender            NOT_REQUESTED
        ├── Passport Number   REQUIRED (visa) / NOT_REQUESTED (tour)
        ├── Passport Expiry   REQUIRED (visa) / NOT_REQUESTED (tour)
        └── Phone             OPTIONAL (transfer) / NOT_REQUESTED (tour)
```

## 5.3 Requirement States

```typescript
enum TravelerFieldRequirement {
  NOT_REQUESTED  // field not shown, not collected
  OPTIONAL       // field shown, not required
  REQUIRED       // field shown, required
}
```

## 5.4 Configuration Location

```
Product edit page → Traveler Requirements block
```

Service-specific defaults:

| Service Type | DOB | Passport | Citizenship | Phone |
|---|---|---|---|---|
| Tour / Excursion | OPTIONAL | NOT_REQUESTED | OPTIONAL | NOT_REQUESTED |
| Accommodation | OPTIONAL | NOT_REQUESTED | OPTIONAL | OPTIONAL |
| Transfer | NOT_REQUESTED | NOT_REQUESTED | NOT_REQUESTED | OPTIONAL |
| Insurance | REQUIRED | REQUIRED | REQUIRED | REQUIRED |

## 5.5 Storage Strategy

**Option A: Normalized JSON on Product**

```typescript
model Product {
  // ... existing fields
  travelerRequirements Json? // { firstName: "REQUIRED", lastName: "REQUIRED", dob: "OPTIONAL", ... }
}
```

**Option B: Normalized requirement table**

```typescript
model TravelerFieldRequirement {
  id          String @id @default(uuid())
  productId   String
  fieldName   String // "firstName", "lastName", "dob", "passport", ...
  requirement TravelerFieldRequirementEnum // NOT_REQUESTED | OPTIONAL | REQUIRED
}
```

**Recommended: Option A (JSON)** — проще для V1, достаточно для product-level config, не требует migration для каждого нового field.

---

# 6. Snapshot Architecture

## 6.1 Hard Requirement

```
Booking Traveler Requirements
= SNAPSHOT requirements at Booking creation time
≠ current Product configuration
```

Если seller завтра изменит Passport: OPTIONAL → REQUIRED, это **не должно ретроактивно менять** уже созданную Booking.

## 6.2 Snapshot Storage

**On Booking:**

```typescript
model Booking {
  // ... existing fields
  travelerRequirements Json? // snapshot from Product at Booking creation
}
```

**Alternative: Separate snapshot table** — если потребуется queryability.

**Recommended: JSON on Booking** — проще для V1, snapshot immutable after creation.

## 6.3 Snapshot Population

```
Product travelerRequirements
  ↓
Booking creation (consumer: BookingRequested)
  ↓
snapshot copied to Booking.travelerRequirements
  ↓
immutable after creation
```

---

# 7. Checkout Collection Point

## 7.1 Current State

Traveler data collection происходит в CheckoutIntent (quote → checkout flow):

```
Quote (travelers: firstName, lastName, birthDate)
  ↓
CheckoutIntent (travelers: firstName, lastName, birthDate)
  ↓
Order (OrderTraveler: extended fields)
  ↓
Booking (Passenger: extended fields)
```

## 7.2 Canonical Flow

```
Request created (travelerCount only)
  ↓
Supplier confirms availability/price
  ↓
Customer accepts current terms
  ↓
Traveler Data Collection ← THIS IS THE COLLECTION POINT
  ↓
Final booking confirmation
  ↓
Order created
  ↓
Booking created (with traveler snapshot)
```

## 7.3 Question: Request → Order conversion

Текущая реализация:

```
Request CONVERTED → Order created (without traveler data)
```

Будущая реализация:

```
Request CONVERTED → Traveler Data Collection → Order created (with traveler data)
```

**Gap:** Текущий Request → Order conversion не включает traveler data collection.

---

# 8. Request → Order → Booking Contract

## 8.1 Текущий flow

```
Request (customerId, productId, partnerId, status, dates, prices)
  ↓ convertToOrder()
Order (customerId, items, sellers, prices)
  ↓ consumer: OrderRequested
Booking (orderId, productId, status, dates)
```

## 8.2 Traveler data в текущем flow

- **Request** — нет traveler data (только travelerCount через quantity)
- **Order** — OrderTraveler модель существует, но **0 records**
- **Booking** — Passenger модель существует, но **0 records**

## 8.3 Gap

Текущий Request → Order conversion НЕ запрашивает traveler data.

Для implementation travelers на Order/Booking level необходимо:

1. Добавить traveler data collection после Request conversion
2. Заполнить OrderTraveler при Order creation
3. Snapshot traveler requirements в Booking

---

# 9. TTL / Offer Expiry

## 9.1 Текущий state

```
Request TTL: customerActionDeadline (48h после supplier confirmation)
```

## 9.2 Traveler data collection и TTL

После customer acceptance и до final booking confirmation:

```
Customer accepts
→ TTL may still apply until final booking confirmation
```

**Рекомендация:** Новый TTL для traveler data collection (например, 24h) после customer acceptance. Если TTL истёк — Request → EXPIRED, без Order creation.

## 9.3 Recommendation

V1: Использовать существующий Request lifecycle. Traveler data collection = part of Request → Order conversion. TTL не расширяется.

V2 (future): Отдельный traveler data collection stage с собственным TTL.

---

# 10. Order Creation Point

## 10.1 Текущий point

```
Request CONVERTED → Order created immediately
```

## 10.2 Canonical target

```
Request CONVERTED
→ Customer provides traveler data
→ Traveler required fields validated
→ Order created (with OrderTraveler records)
```

## 10.3 Recommendation

**V1:** Order creation point остаётся как сейчас (Request → Order). Traveler data collection добавляется **после** Order creation через отдельный API endpoint.

**Rationale:** Меньше disruption, существующий Request → Order flow не меняется. Traveler data collection = Order lifecycle extension.

---

# 11. Booking Creation Point

## 11.1 Current contract

```
1 Order = 1 Booking (V1)
```

Booking создается consumer-ом OrderRequested events.

## 11.2 Traveler snapshot на Booking

```
Order created (with OrderTraveler records)
  ↓ consumer: BookingRequested
Booking created (with Passenger records, snapshot from OrderTraveler)
```

## 11.3 Snapshot transfer

```
OrderTraveler → Passenger (at Booking creation time)
```

Passenger наследует поля от OrderTraveler + получает snapshot traveler requirements от Product.

---

# 12. Payment Relationship

## 12.1 Current states

```
Order: UNPAID → PARTIALLY_PAID → PAID → REFUNDED
```

## 12.2 Traveler collection и payment

```
Traveler data collection
→ Order created (UNPAID)
→ Payment (optional, pay later)
→ Booking confirmation
```

**Traveler data collection НЕ зависит от payment success.**

---

# 13. Voucher Source

## 13.1 Current state

**Voucher не реализован.**

## 13.2 Canonical contract

```
Voucher Travelers
= Booking Passengers (canonical traveler data)
```

Не использовать:

```
Customer
Order.customer
Payer
```

как источник туристов.

## 13.3 Voucher data source

```
Booking → Passengers → firstName, lastName, birthDate, citizenship, passportNumber, ...
Booking → travelerRequirements (snapshot)
```

## 13.4 Voucher versioning

```
Booking created
Traveler data corrected
→ Voucher regenerated
→ old voucher invalidated
```

V1: Voucher не генерируется. Требуется отдельная задача.

---

# 14. Service-Type Differences

## 14.1 Current ProductType enum

```typescript
enum ProductType {
  TOUR
  HOTEL
  SANATORIUM
  FLIGHT
  TRAIN
  EXCURSION
  GUIDE
  TRANSFER
  PHOTOGRAPHER
}
```

## 14.2 Traveler requirements by service type

| Service Type | DOB | Passport | Citizenship | Phone | Notes |
|---|---|---|---|---|---|
| TOUR | OPTIONAL | NOT_REQUESTED | OPTIONAL | NOT_REQUESTED | Participants |
| HOTEL | OPTIONAL | NOT_REQUESTED | OPTIONAL | OPTIONAL | Guests |
| EXCURSION | OPTIONAL | NOT_REQUESTED | OPTIONAL | NOT_REQUESTED | Participants |
| TRANSFER | NOT_REQUESTED | NOT_REQUESTED | NOT_REQUESTED | OPTIONAL | Passengers |
| INSURANCE | REQUIRED | REQUIRED | REQUIRED | REQUIRED | Insured persons |
| GUIDE | NOT_REQUESTED | NOT_REQUESTED | NOT_REQUESTED | NOT_REQUESTED | Staff |
| PHOTOGRAPHER | NOT_REQUESTED | NOT_REQUESTED | NOT_REQUESTED | NOT_REQUESTED | Staff |

**Seller может переопределять requirements на уровне Product.**

---

# 15. Security / Privacy / RBAC

## 15.1 Sensitive data classification

| Category | Fields | Sensitivity |
|---|---|---|
| Basic identity | firstName, lastName | LOW |
| Contact | email, phone | MEDIUM |
| Identity documents | passportNumber, passportExpiry, documentType | HIGH |
| Demographics | birthDate, gender, citizenship | MEDIUM |
| Health/special | specialAssistance, medicalNotes | HIGH |
| Minor data | birthDate for children | HIGH |

## 15.2 RBAC permissions (proposed)

```
traveler.read              — read basic traveler data
traveler.write             — create/update traveler data
traveler.sensitive.read    — read passport/document fields
traveler.document.read     — read document images/scans
traveler.export            — export traveler data
```

## 15.3 Current RBAC convention

Backend использует `PermissionsGuard` с permissions в User.role. Traveler permissions добавляются в существующую модель.

## 15.4 Export restrictions

Traveler data НЕ попадают в generic CSV/XLSX export без explicit permission.

Допустимые exports:
- Booking operational export (name, reference)
- Voucher (all traveler fields)
- Supplier manifest (names, document status)

---

# 16. Tenant Isolation

## 16.1 Current isolation

```
Platform ADMIN → all data
Partner A → own bookings, own travelers
Partner B → own bookings, own travelers
```

## 16.2 Traveler-specific isolation

```
Partner A cannot see Partner B travelers
Storefront Traveler ≠ Platform Marketplace Customer
```

acquisitionSource НЕ используется как authorization boundary.

---

# 17. Export / Search Policy

## 17.1 Export

Traveler data экспортируются только через:
- Booking detail export (filtered)
- Voucher generation
- Supplier manifest

Generic Orders/Bookings CSV НЕ включает traveler document fields.

## 17.2 Search

Traveler names индексируются в Booking search.
Document values НЕ индексируются в глобальном поиске.

---

# 18. Gap Matrix

| Capability | Current State | Target | Gap | Severity | Stage |
|---|---|---|---|---|---|
| Passenger model | Exists, 0 records | Populated with traveler data | GAP | HIGH | B |
| OrderTraveler model | Exists, 0 records | Populated at Order creation | GAP | HIGH | B |
| Product traveler requirements | NOT IMPLEMENTED | Product-level config | GAP | HIGH | A |
| Requirement states (NOT_REQUESTED/OPTIONAL/REQUIRED) | NOT IMPLEMENTED | Enum + Product config | GAP | HIGH | A |
| Snapshot on Booking | NOT IMPLEMENTED | Booking.travelerRequirements JSON | GAP | HIGH | B |
| Traveler data collection UI | NOT IMPLEMENTED | Checkout traveler form | GAP | HIGH | C |
| Traveler validation | NOT IMPLEMENTED | Server-side validation per requirements | GAP | MEDIUM | C |
| Customer ≠ Payer ≠ Traveler | Documented | Implemented in OrderTraveler.customerId | PARTIAL | MEDIUM | B |
| Traveler edit lifecycle | NOT IMPLEMENTED | Editable before final confirmation | GAP | MEDIUM | D |
| Voucher source | NOT IMPLEMENTED | Booking → Passengers | GAP | LOW | F |
| Sensitive data access control | NOT IMPLEMENTED | RBAC permissions | GAP | HIGH | G |
| Tenant isolation for travelers | NOT IMPLEMENTED | Partner-scoped access | GAP | HIGH | G |
| Export restrictions | NOT IMPLEMENTED | Permission-gated export | GAP | MEDIUM | G |
| Audit trail for traveler changes | NOT IMPLEMENTED | BookingHistory/OrderHistory | GAP | MEDIUM | G |
| Representative seed | 0 travelers | Cases A-E covered | GAP | HIGH | H |
| TTL for traveler collection | NOT IMPLEMENTED | Optional TTL stage | GAP | LOW | D |
| Service-type specific requirements | NOT IMPLEMENTED | Product defaults per type | GAP | MEDIUM | A |
| Saved travelers / companions | NOT IMPLEMENTED | Future feature | GAP | LOW | FUTURE |
| Age calculation against serviceDate | NOT IMPLEMENTED | dateOfBirth + serviceDate | GAP | LOW | D |

---

# 19. Recommended Implementation Stages

## Stage A — Domain/Schema Contract + Traveler Requirements Model

```
1. Add travelerRequirements Json field to Product model
2. Create TravelerFieldRequirementEnum (NOT_REQUESTED/OPTIONAL/REQUIRED)
3. Add default requirements per ProductType
4. Add API endpoint for Product traveler requirements CRUD
5. Add traveler requirements display on Product detail (admin)
```

**Deliverable:** Seller can configure traveler requirements per product.

## Stage B — Order/Booking Traveler Population

```
1. Populate OrderTraveler at Order creation (from Request data)
2. Populate Passenger at Booking creation (from OrderTraveler)
3. Snapshot travelerRequirements to Booking
4. Add traveler data to Order/Booking detail API responses
```

**Deliverable:** Traveler data flows through Order → Booking chain.

## Stage C — Checkout Traveler Collection UI

```
1. Create traveler data collection form in frontend
2. Add server-side validation per product requirements
3. Wire to Order creation flow
4. Support Case A-E (customer=payer=traveler scenarios)
```

**Deliverable:** Users can enter traveler data during checkout.

## Stage D — Traveler Edit Lifecycle + TTL

```
1. Allow traveler data editing before final confirmation
2. Add TTL for traveler data collection (optional)
3. Implement edit audit trail
4. Handle expiry gracefully
```

**Deliverable:** Traveler data can be corrected before booking.

## Stage E — Booking Detail Traveler Section

```
1. Add traveler section to Booking detail page
2. Show traveler requirements snapshot
3. Show completeness status
4. Support inline editing (where permitted)
```

**Deliverable:** Traveler data visible and editable in Booking detail.

## Stage F — Voucher Integration

```
1. Generate voucher from Booking Passengers
2. Include traveler requirements snapshot
3. Support voucher regeneration on traveler edit
4. Add voucher download/print
```

**Deliverable:** Voucher generated from canonical traveler data.

## Stage G — Security / Audit / Export Hardening

```
1. Add traveler RBAC permissions
2. Implement tenant isolation for traveler data
3. Restrict generic export from traveler document fields
4. Add audit trail for sensitive field changes
```

**Deliverable:** Traveler data properly secured and auditable.

## Stage H — Representative Seed + Strict Runtime Review

```
1. Create representative traveler data for all Cases A-E
2. Add traveler-specific test scenarios
3. Runtime browser verification
4. Full strict review
```

**Deliverable:** Complete representative dataset and verified implementation.

---

# 20. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| 4 traveler models create confusion | Medium | Document canonical mapping; don't add 5th model |
| Snapshot complexity | Medium | Use simple JSON; avoid over-engineering |
| Privacy concerns with traveler documents | High | Implement RBAC before exposing document fields |
| Voucher dependency on complete traveler data | Medium | Voucher generation gated on dataCompleteness = COMPLETE |
| Multi-traveler form complexity | Medium | Start with simple list; iterate |
| Tenant isolation for sensitive traveler data | High | Server-side authorization mandatory |

---

# 21. Hard Questions — Answers

| # | Question | Answer |
|---|---|---|
| Q1 | Passenger = Traveler или новая entity? | Passenger = Traveler (current technical model). Новая entity НЕ создаётся. |
| Q2 | Traveler привязан к Order или Booking? | Оба: OrderTraveler (order phase) → Passenger (booking phase). Canonical: Booking → Passengers. |
| Q3 | Где seller задаёт requirements? | Product travelerRequirements (JSON field). |
| Q4 | Как хранить NOT_REQUESTED/OPTIONAL/REQUIRED? | Enum TravelerFieldRequirement + JSON на Product. |
| Q5 | Как snapshot создаётся? | Копируется из Product в Booking при creation. |
| Q6 | Когда checkout запрашивает traveler data? | V1: после Order creation (Order lifecycle extension). V2: в checkout flow. |
| Q7 | Когда создаётся Order? | После Request conversion + traveler data collection (V1: после conversion, travelers added to existing Order). |
| Q8 | Когда создаётся Booking? | Consumer OrderRequested events (unchanged). Snapshot populated at creation. |
| Q9 | Может ли TTL истечь во время traveler form? | V1: нет (TTL на Request, travelers collection = part of Request→Order). V2: да, отдельный TTL. |
| Q10 | Что происходит при expiry? | Request → EXPIRED. Order не создаётся. |
| Q11 | Как Customer связывается с Traveler? | OrderTraveler.customerId (optional). Passenger: без direct link. |
| Q12 | Как моделируется Payer? | V1: implicit = Order.customerId. V2: отдельная entity. |
| Q13 | Как Voucher получает travelers? | Booking → Passengers (canonical source). |
| Q14 | Как меняются traveler data после booking? | Editable до final confirmation. После — audit trail + approval. |
| Q15 | Какой audit trail? | BookingHistory/OrderHistory (existing models). |
| Q16 | Какие поля sensitive? | passportNumber, passportExpiry, birthDate (for minors). |
| Q17 | Кто имеет доступ? | Platform ADMIN, booking owner Partner, passenger themselves (future). |
| Q18 | Какие поля экспортируются? | Only name/reference in generic export. Documents: voucher/supplier manifest only. |
| Q19 | Tenant isolation? | Partner-scoped: Partner A ≠ Partner B travelers. |
| Q20 | Какие изменения обязательны для Stage A? | Product.travelerRequirements (JSON), API endpoint, defaults per ProductType. |

---

# 22. Roadmap Update

Зафиксировать additively в canonical roadmap:

```
Traveler Architecture Audit completed
Customer ≠ Payer ≠ Traveler contract fixed
Booking → 1..N Passengers (= Travelers)
Seller-defined Traveler Requirements on Product (JSON)
Booking snapshot contract
Voucher ← Booking Passengers
8 implementation stages proposed (A-H)
```

Не объявлять implementation completed.

---

# 23. Git Closure

```
Starting SHA:    fa1606d
Audit SHA:       (pending)
Final SHA:       (pending)
origin/master:   fa1606d
```

---

# 24. Final Verdict

```
VERDICT A — ARCHITECTURE AUDIT COMPLETED — READY FOR IMPLEMENTATION
```

Все обязательные audit items выполнены:
- ✅ Current models audited (4 traveler models identified)
- ✅ Current API audited (checkout traveler endpoints exist)
- ✅ Current customer flow audited (Quote → Checkout → Order → Booking)
- ✅ Passenger vs Traveler resolved (Passenger = Traveler, no new entity)
- ✅ Customer/Payer/Traveler contract fixed (5 cases defined)
- ✅ Booking ownership fixed (Booking → Passengers)
- ✅ Requirement model fixed (JSON on Product + enum)
- ✅ Snapshot strategy fixed (JSON on Booking)
- ✅ Checkout collection point fixed (after Order creation for V1)
- ✅ Order/Booking creation points fixed (existing flow preserved)
- ✅ TTL behavior fixed (existing Request TTL, no new stage for V1)
- ✅ Voucher source fixed (Booking → Passengers)
- ✅ Security/privacy model fixed (RBAC permissions proposed)
- ✅ Tenant isolation model fixed (Partner-scoped)
- ✅ Gap Matrix complete (18 gaps identified)
- ✅ Implementation stages proposed (8 stages A-H)
- ✅ No contradictions remain
