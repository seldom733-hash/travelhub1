# PHASE 1 — STEP 1.13B — STRICT IMPLEMENTATION REVIEW

## Цель
Провести строгий review фактически реализованного Step 1.13B. Implementation report не считать доказательством. Проверять код, Prisma schema, migration SQL, backend/frontend producers, validators, public resolvers, tests, ADR/docs, dev DB и browser behavior.

Не переходить к Step 1.14 / 1.15 / Phase 2.

## 1. Marketplace vs Storefront behavioral architecture
Сравнить `MarketplaceBehavioralEvent` и `StorefrontBehavioralEvent` side-by-side:
- eventId/dedup;
- occurredAt/receivedAt;
- sessionId;
- acquisitionSource;
- locale/path;
- payload validation;
- skew;
- neutral-drop;
- public predicates;
- privacy;
- persistence failure.
Отдельные таблицы допустимы только как storage separation, не как два разных telemetry standards.

## 2. Session model — CRITICAL
Проверить фактические localStorage/session keys Marketplace и Storefront.
Отдельно описать сценарий Marketplace → Product → Storefront → Storefront Product.

Нужно явно определить:
- sessions intentionally isolated; либо
- используется shared ephemeral anonymous session.

Не вводить visitorId, fingerprint, User/Customer linkage или cross-device graph.
Если выбор нельзя вывести из ADR/privacy contract — `ARCHITECTURE DECISION REQUIRED`.

## 3. Event taxonomy
Перечислить все 8 event types и для каждого доказать реальный frontend producer и точное user action.
Минимально ожидаются VIEWED, PRODUCT_IMPRESSION, PRODUCT_VIEWED, SEARCH_PERFORMED, CATEGORY_VIEWED.
FILTER/SORT/CTA/SELLER допустимы только при реально существующем UI. Никаких speculative conversion/checkout/booking/payment events.

## 4. Search privacy — CRITICAL
Проверить validator на:
- normal и spaced/obfuscated email;
- обычный/spaced phone;
- wa.me, t.me, Telegram, WhatsApp;
- http(s), domain;
- encoded/contact-like strings;
- long/control/newline input.
Проверить порядок normalize/validate/truncate: truncation не должна скрывать опасную часть original input.
Если raw query нельзя безопасно хранить — хранить metadata вместо raw text.

## 5. Public predicates / neutral drop
Marketplace Product event persist только для реально public Product с MARKETPLACE channel.
STOREFRONT-only, DRAFT, ARCHIVED/non-public, unknown/stale → 202 accepted + 0 rows.
Category — только canonical public resolution.
Использовать shared `PublicCatalogService`, не копию visibility logic.

## 6. Acquisition source
Для Marketplace interaction server-authoritative `MARKETPLACE`.
Для Product BOTH source всё равно MARKETPLACE.
Client не может forged acquisitionSource/productId/categoryId/partnerId/sellerId/storefrontId/customerId/userId/actorId.

## 7. Impression semantics — CRITICAL
Подтвердить: impression = реально committed/rendered ProductCard, если viewport tracking не реализован.
Проверить StrictMode, rerender, locale/state changes, pagination/new result set.
Live `4× IMPRESSION` должно означать ровно 4 реально rendered cards, не дубли.
Fire-once key должен блокировать rerender duplicate, но не legitimate impression в новом context.

## 8. Search/Home/PDP/Category semantics
- Home Viewed — только home, не layout/SSR/prefetch.
- ProductViewed — реальное открытие PDP.
- SearchPerformed — один committed search, не каждый keystroke и не двойной producer.
- CategoryViewed — реальное открытие category surface.
- FILTER/SORT — только user action, не initial state.
- CTA — только реальный CTA; click ≠ conversion.

## 9. Legacy telemetry removal
Repo-wide проверить удаление `analytics-events.ts`: imports, endpoints, event names, localStorage keys, duplicate producers/consumers, tests/docs.
Одно действие не должно уходить одновременно в old/new telemetry.

## 10. AuditLog / Outbox / publication isolation
Behavioral event:
- не пишет AuditLog;
- не создаёт domain OutboxEvent;
- не меняет ProductPublicationChannel;
- не пишет acquisitionSource в Order/Booking/Payment.

## 11. Dedup / persistence / API privacy
Duplicate eventId → одна row, 202; retry не мутирует original.
По возможности проверить concurrent duplicate.
DB failure должен быть observable server error; frontend telemetry failure не ломает navigation.
Response не раскрывает persisted/drop/internal IDs/status.

## 12. Temporal
occurredAt = client UTC action time; receivedAt = server time; shared skew contract; no updatedAt; dedup сохраняет original event.

## 13. Auth/privacy
Public endpoint без Authorization. Logged BUYER не добавляет User/customerId. Session opaque, no PII/IP/fingerprint/cross-device identity.

## 14. Migration/indexes
Проверить `20260809130000_add_marketplace_behavioral_events`:
- additive;
- no destructive/fake historical rows;
- Storefront data untouched;
- unique eventId;
- justified indexes;
- no payload JSON index без need;
- clean replay;
- migrate status clean;
- diff no drift;
- no edited applied migration/db push.

## 15. Storefront regression
Повторно доказать Storefront: PARTNER_STOREFRONT source, dedup, neutral predicates, privacy, contact click без contact value, preview off, no AuditLog/Outbox.

## 16. Required E2E
Минимум:
1. MarketplaceViewed persisted.
2. Impression persisted.
3. ProductViewed persisted.
4. BOTH → MARKETPLACE.
5. STOREFRONT-only neutral.
6. DRAFT neutral.
7. ARCHIVED/non-public neutral.
8. unknown product neutral.
9. public category persisted.
10. unknown category neutral.
11. valid search.
12. search PII/contact abuse.
13. forged canonical/internal fields.
14. malformed session.
15. duplicate eventId.
16. arbitrary type/payload.
17. skew/locale/path.
18. AuditLog unchanged.
19. Outbox unchanged.
20. channels unchanged.
21. no Authorization.
22. response privacy.
23. Storefront regression.
24. persistence failure.

## 17. Required frontend/browser checks
Проверить home once; N cards = N impressions; rerender no duplicate; PDP once; hero/header/results search exactly once per committed action; filter/sort/CTA exact semantics; category once; StrictMode; no SSR/prefetch telemetry; no Authorization; logged BUYER no identity; failure/navigation safe; RU/AZ/EN; Storefront regression; console errors 0; smoke cleanup.

## 18. Cross-surface journey — обязательный вывод
В отчёте отдельным пунктом указать:
- shared или isolated session;
- почему;
- privacy implication;
- analytics limitation;
- future owner, если deferred.
Не оставлять это случайным implementation detail.

## 19. Approval criteria
APPROVED recommendation только если architecture compatible, session decision explicit, taxonomy non-speculative, search privacy safe enough, impressions non-duplicating, predicates authoritative, source server-authoritative, neutral-drop proven, legacy telemetry removed, AuditLog/Outbox isolated, migration clean, regression green.

Локальные проблемы исправить как `FIX N` с problem/risk/root cause/files/fix/tests/regression.
Architecture/privacy ownership change → `ARCHITECTURE DECISION REQUIRED`.

## 20. Full regression
Backend: tsc, unit, marketplace/storefront behavioral, temporal readiness, public catalog, category, moderation, media, seller identity, storefront, buyer identity/cabinet, auth/RBAC, full serial e2e.
Frontend: tsc, vitest, production build.
Migration: fresh DB deploy/status/diff.

## Формат отчёта
Вернуть `PHASE 1 — STEP 1.13B — STRICT REVIEW — ОТЧЁТ` с verdict, inspected files, architecture matrix, ownership, taxonomy/producers, session/journey decision, privacy/search probes, predicates, source isolation, impressions/fire-once, legacy telemetry removal, AuditLog/Outbox, migration/indexes, tests/browser/regression, fixes/debt и architecture status.

Не переходить к Step 1.14 / 1.15 / Phase 2.

Если fixes были:
`PHASE 1 STEP 1.13B REVIEW FIXES COMPLETED — WAITING FOR APPROVAL`

Если fixes не нужны:
`PHASE 1 STEP 1.13B REVIEW PASSED — WAITING FOR APPROVAL`
