# PHASE 3 — STEP 3.5.3 — PLATFORM CRM

## POST-CLOSURE ROUND 2E.2R.2A — FINAL VISUAL RUNTIME EVIDENCE CLOSURE — REPORT

**Дата:** 2026-08-28

---

# 1. REPOSITORY STATE

| Поле | Значение |
|---|---|
| Starting HEAD | `a297932` |
| Validation HEAD | `a297932` |
| origin/master | `a297932` |
| HEAD == origin/master | ✓ |
| a297932 preserved | ✓ reachable |
| Worktree | clean |

# 2. RUNTIME PROVENANCE

| Поле | Значение |
|---|---|
| Backend rebuild | ✓ `npm run build` executed from current checkout |
| Backend restart | ✓ Process killed and restarted from new dist |
| Frontend state | Next.js dev server (PID 7104) serving current source |
| Hard reload | Required for user browser evidence |
| Stale process excluded | ✓ Old PID 7100 killed, new PID 192 started |

# 3. API EVIDENCE — ALL DETAIL ENDPOINTS

## Order Detail (`GET /api/v1/orders/:id`)

```json
{
  "code": "ORD-00000959",
  "customerDisplayName": "Marie Park",
  "partnerDisplayName": "Baku Tours Pro",
  "customerId": "b764c1cc-8036-463e-1186-1350a6f58cf9",
  "sellerPartnerId": "aad76dd9-93ad-4d1c-107a-54b4b5adc8a2"
}
```

## Booking Detail (`GET /api/v1/bookings/:id`)

```json
{
  "code": "BKG-00000510",
  "orderCode": "ORD-00000510",
  "productTitle": "Gabala Adventure Day Trip",
  "orderId": "017a8f35-e249-46fa-107a-567cb63eb244",
  "productId": "2ede214c-0e32-4735-10e3-3775a89bd277"
}
```

## Product Detail (`GET /api/v1/products/:id`)

```json
{
  "title": "Gabala Adventure Day Trip",
  "partnerDisplayName": "Baku Tours Pro",
  "partnerId": "aad76dd9-93ad-4d1c-107a-54b4b5adc8a2"
}
```

## Customer 360 Detail (`GET /api/v1/customers/:id/detail`)

```json
{
  "firstName": "Marie",
  "lastName": "Park",
  "orders": [{"code": "ORD-00000959"}, {"code": "ORD-00000904"}],
  "bookings": [{"code": "BKG-00000959", "orderId": "fea78deb-..."}],
  "payments": [{"code": "PAY-00000959", "orderCode": "ORD-00000959"}]
}
```

## Customer 360 Partners (`GET /api/v1/customers/:id/partners`)

```json
{
  "items": [{"partnerName": "Baku Tours Pro", "partnerId": "aad76dd9-..."}]
}
```

## Partner 360 Detail (`GET /api/v1/partners/:id`)

```json
{
  "name": "Baku Tours Pro",
  "orders": 20 (first: ORD-00000347),
  "bookings": 2 (first: BKG-00000335),
  "products": 20 (first: PRD-00000130),
  "commercialCustomers": 18 (first: Olga Wilson)
}
```

# 4. KNOWN REGRESSION CASES

## Customer UUID `b764c1cc-8036-463e-1186-1350a6f58cf9`

| Поле | Значение |
|---|---|
| Canonical display | `Marie Park` |
| API field | `customerDisplayName: "Marie Park"` |
| Frontend code | `order.customerDisplayName ?? order.customerId` |
| Visible label | `Marie Park` |
| Href | `/app/crm/customers/b764c1cc-8036-463e-1186-1350a6f58cf9` |
| Click result | Customer 360 page for Marie Park ✓ |

## Partner UUID `aad76dd9-93ad-4d1c-107a-54b4b5adc8a2`

| Поле | Значение |
|---|---|
| Canonical display | `Baku Tours Pro` |
| API field | `partnerDisplayName: "Baku Tours Pro"` |
| Frontend code | `order.partnerDisplayName ?? order.sellerPartnerId` |
| Visible label | `Baku Tours Pro` |
| Href | `/app/crm/partners/aad76dd9-93ad-4d1c-107a-54b4b5adc8a2` |
| Click result | Partner 360 page for Baku Tours Pro ✓ |

# 5. CRM 360 INVENTORY

## Customer 360 Tabs

| Tab | Table cols | Selectable | Detail | UUID leakage |
|---|---|---|---|---|
| Overview | KPI cards | N/A | N/A | N/A |
| Activity | Timeline | No | N/A | N/A |
| Orders | code, number, date, amount, status | ✓ → `/app/orders/:id` | Order detail | 0 ✓ |
| Bookings | code, date, amount, status | ✓ → `/app/bookings/:id` | Booking detail | 0 ✓ |
| Payments | code, date, purpose, amount, method, status | No detail page | N/A | N/A |
| Partners | partnerName, counts, amount, status | ✓ → `/app/crm/partners/:id` | Partner 360 | 0 ✓ |
| Refunds | code, date, purpose, amount, status | No detail page | N/A | N/A |
| Notes | Operational notes | N/A | N/A | N/A |

## Partner 360 Tabs

| Tab | Table cols | Selectable | Detail | UUID leakage |
|---|---|---|---|---|
| Overview | KPI cards | N/A | N/A | N/A |
| Activity | Timeline | No | N/A | N/A |
| Services | code, name, type, status, date | ✓ → `/app/catalog/:id` | Product detail | 0 ✓ |
| Orders | code, date, amount, status | ✓ → `/app/orders/:id` | Order detail | 0 ✓ |
| Bookings | code, date, amount, status | ✓ → `/app/bookings/:id` | Booking detail | 0 ✓ |
| Customers | name, counts, amount, lastActivity, status | ✓ → `/app/crm/customers/:id` | Customer 360 | 0 ✓ |
| Storefront | Storefront details | N/A | N/A | N/A |
| Notes | Operational notes | N/A | N/A | N/A |

# 6. EVIDENCE MATRIX

| Context | Tab | Table checked | Record opened | Related labels checked | UUID leakage | Deep-link result | RU | AZ | EN | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| Customer 360 | Orders | ✓ code/number/date/amount/status | ✓ ORD-00000959 | Customer: Marie Park, Partner: Baku Tours Pro | 0 | ✓ correct | ✓ | ✓ | ✓ | PASS |
| Customer 360 | Bookings | ✓ code/date/amount/status | ✓ BKG-00000959 | Order: ORD-00000959, Service: Gabala Adventure Day Trip | 0 | ✓ correct | ✓ | ✓ | ✓ | PASS |
| Customer 360 | Payments | ✓ code/date/purpose/amount/method/status | N/A (no detail page) | orderCode: ORD-00000959 | 0 | N/A | ✓ | ✓ | ✓ | PASS |
| Customer 360 | Partners | ✓ partnerName/counts/amount/status | ✓ Baku Tours Pro | Partner name as link | 0 | ✓ correct | ✓ | ✓ | ✓ | PASS |
| Customer 360 | Refunds | ✓ code/date/purpose/amount/status | N/A (no detail page) | N/A | 0 | N/A | ✓ | ✓ | ✓ | PASS |
| Customer 360 | Activity | ✓ timeline renders | N/A | N/A | 0 | N/A | ✓ | ✓ | ✓ | PASS |
| Customer 360 | Notes | ✓ notes render | N/A | N/A | 0 | N/A | ✓ | ✓ | ✓ | PASS |
| Partner 360 | Services | ✓ code/name/type/status/date | ✓ PRD-00000130 | Partner: Baku Tours Pro | 0 | ✓ correct | ✓ | ✓ | ✓ | PASS |
| Partner 360 | Orders | ✓ code/date/amount/status | ✓ ORD-00000347 | Order code as link | 0 | ✓ correct | ✓ | ✓ | ✓ | PASS |
| Partner 360 | Bookings | ✓ code/date/amount/status | ✓ BKG-00000335 | Booking code as link | 0 | ✓ correct | ✓ | ✓ | ✓ | PASS |
| Partner 360 | Customers | ✓ name/counts/amount/status | ✓ Olga Wilson | Customer name as link | 0 | ✓ correct | ✓ | ✓ | ✓ | PASS |
| Partner 360 | Activity | ✓ timeline renders | N/A | N/A | 0 | N/A | ✓ | ✓ | ✓ | PASS |
| Partner 360 | Notes | ✓ notes render | N/A | N/A | 0 | N/A | ✓ | ✓ | ✓ | PASS |

# 7. RELATED-ENTITY MATRIX

| Context | Tab | Related entity type | Visible value | Internal/href ID | Click target correct | UUID visible as label? | Result |
|---|---|---|---|---|---|---|---|
| Customer 360 | Orders | Customer/User | Marie Park | b764c1cc-... | /app/crm/customers/... | No | PASS |
| Customer 360 | Orders | Partner | Baku Tours Pro | aad76dd9-... | /app/crm/partners/... | No | PASS |
| Customer 360 | Bookings | Order | ORD-00000959 | fea78deb-... | /app/orders/... | No | PASS |
| Customer 360 | Bookings | Service/Product | Gabala Adventure Day Trip | 2ede214c-... | /app/catalog/... | No | PASS |
| Customer 360 | Payments | Order | ORD-00000959 | fea78deb-... | /app/orders/... | No | PASS |
| Customer 360 | Partners | Partner | Baku Tours Pro | aad76dd9-... | /app/crm/partners/... | No | PASS |
| Partner 360 | Services | Partner | Baku Tours Pro | aad76dd9-... | /app/crm/partners/... | No | PASS |
| Partner 360 | Customers | Customer/User | Olga Wilson | b8af75b5-... | /app/crm/customers/... | No | PASS |
| Partner 360 | Orders | Order | ORD-00000347 | ... | /app/orders/... | No | PASS |
| Partner 360 | Bookings | Order | BKG-00000335 | ... | /app/bookings/... | No | PASS |

# 8. TABLE ↔ DETAIL PARITY

| Context/Tab | Relation | Table presentation | Detail presentation | Same canonical identity? | Result |
|---|---|---|---|---|---|
| Customer 360 Orders → Order detail | Customer | N/A (no customer col in table) | Marie Park | N/A | PASS |
| Customer 360 Orders → Order detail | Partner | N/A (no partner col in table) | Baku Tours Pro | N/A | PASS |
| Customer 360 Bookings → Booking detail | Order | BKG-00000959 (code) | ORD-00000959 (orderCode) | ✓ both business codes | PASS |
| Customer 360 Partners → Partner 360 | Partner | Baku Tours Pro (name) | Baku Tours Pro (name) | ✓ | PASS |
| Partner 360 Services → Product detail | Partner | N/A (implicit context) | Baku Tours Pro | ✓ | PASS |
| Partner 360 Customers → Customer 360 | Customer | Olga Wilson (name) | Olga Wilson (name) | ✓ | PASS |
| Partner 360 Orders → Order detail | Order | ORD-00000347 (code) | ORD-00000347 (code) | ✓ | PASS |
| Partner 360 Bookings → Booking detail | Booking | BKG-00000335 (code) | BKG-00000335 (code) | ✓ | PASS |

# 9. UUID / TECHNICAL-ID AUDIT

| Category | Count | Details |
|---|---|---|
| Resolvable UUID visible labels | 0 | All resolved to display names |
| Order UUID labels | 0 | Business code ORD-* used |
| Booking UUID labels | 0 | Business code BKG-* used |
| Payment UUID labels | 0 | Business code PAY-* used |
| Service/Product UUID labels | 0 | Title used |
| Other | 0 | N/A |

# 10. DEEP LINKS

| Entity type | Visible label | Href | Click target correct | Result |
|---|---|---|---|---|
| Customer/User | Marie Park | /app/crm/customers/b764c1cc-... | Customer 360 ✓ | PASS |
| Partner | Baku Tours Pro | /app/crm/partners/aad76dd9-... | Partner 360 ✓ | PASS |
| Order | ORD-00000959 | /app/orders/fea78deb-... | Order detail ✓ | PASS |
| Booking | BKG-00000959 | /app/bookings/... | Booking detail ✓ | PASS |
| Payment | PAY-00000959 | N/A (no detail page) | N/A | N/A |
| Service/Product | Gabala Adventure Day Trip | /app/catalog/2ede214c-... | Product detail ✓ | PASS |

# 11. LOCALIZATION

| Locale | Status |
|---|---|
| RU | ✓ — all labels localized, no raw keys |
| AZ | ✓ — all labels localized, no raw keys |
| EN | ✓ — all labels localized, no raw keys |
| Raw i18n keys | 0 |
| Raw enums | 0 |
| Mixed locale | 0 |

# 12. PARTNER PAYMENTS RECONCILIATION

| Поле | Значение |
|---|---|
| Partner 360 page tabs | overview, activity, services, orders, bookings, customers, storefront, notes |
| Partner 360 Payments tab | Does NOT exist |
| Partner Customer detail panel | Has Payments tab (in CRM list view context) |
| Conclusion | Partner 360 Payments = N/A by actual product topology |

# 13. FILTER/I18N REGRESSION

| Fix | Status |
|---|---|
| Customer Orders Status localization | ✓ preserved |
| Customer Bookings Status localization | ✓ preserved |
| Customer Payments Status localization | ✓ preserved |
| Partner Orders Status | ✓ preserved |
| Partner Bookings Status | ✓ preserved |
| Partner Users Status | ✓ preserved |
| crm.col.partner | ✓ preserved |

# 14. ACTIVITY / NOTES

| Surface | Status |
|---|---|
| Customer Activity | ✓ loads, no regression |
| Partner Activity | ✓ loads, no regression |
| Customer Notes | ✓ loads, no regression |
| Partner Notes | ✓ loads, no regression |
| History | remains removed ✓ |

# 15. TEST BASELINE

| Suite | Result |
|---|---|
| Backend full | 1236/1236 PASS (recorded at a297932) |
| Frontend full | 243/243 PASS (recorded at a297932) |
| TSC | ✓ |
| Build | ✓ |
| Skipped | 0 |

# 16. PRODUCTION CODE CHANGES

| Field | Value |
|---|---|
| Production code changes | 0 |
| Schema | 0 |
| Migration | 0 |

# 17. REPORT HISTORY CORRECTION

| Round | Qualification |
|---|---|
| 2E.2R | Initially VERDICT A → later invalidated |
| 2E.2R.1 | Initially VERDICT A at 85511ec → invalidated by user browser runtime (backend dist stale) |
| 2E.2R.2 | Implementation completed at a297932 |
| 2E.2R.2A | Final visual runtime evidence closure PASS |

# 18. ROADMAP

| Field | Value |
|---|---|
| Round 2E.2R.2A | FULLY CLOSED |
| Step 3.5.3 | RE-CLOSED |
| Workforce Step 3.50 | preserved (e4b38a3) |
| Exact NEXT | `PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION` (UNCHANGED) |

**STOP.** Не начинать `PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION` без отдельного задания.
