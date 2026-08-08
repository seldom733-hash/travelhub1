# TravelHub — Baseline 1.5.1 FINAL SYNC — CHANGELOG

Источник истины: `TravelHub_Architecture_Master_Baseline_1.5_Marketplace_Catalog_Final.docx`.

Комплект синхронизирован после финального аудита Master. Это не изменение архитектуры, а приведение зависимых implementation-файлов к уже утвержденному Baseline.

## Исправлено

1. Architecture Overview теперь явно содержит все домены, включая Dashboard, Analytics и Reports.
2. Полная ID Policy перенесена без пробелов: LED/OPP/QTE/SAL/PRD/ORD/BKG/CUS/CNT/COM/CML/PAR/SUP/PAY/RFD/INV/CMS/CUR/FXR/TAX/TXR/DOC/TPL/VCH/TCK/CMP/CAL/RPT/DSH/MET/USR.
3. Finance prompt больше не оставляет Refund/Commission/Currency/ExchangeRate/Tax/TaxRule без префиксов.
4. Order и Booking получили явное правило `backend code != localized UI label`.
5. Order events закреплены: `OrderReadyForBooking`, `BookingRequested`, `OrderFulfilled`, `OrderClosed`.
6. Booking events закреплены: `BookingCreated`, `BookingConfirmed`, `BookingRejected`, `BookingChanged`, `BookingCancelled`.
7. Screen Design Brief поясняет, что навигационные очереди не обязаны дублировать каждый lifecycle status отдельной вкладкой; все состояния доступны через All/filters/queues.
8. Screen Design Brief дополнен всеми внутренними центрами Master: Dashboard, Analytics, CRM, Marketing, Support, Users, Documents, Calendar, Reports, Integrations, AI, System, Settings.
9. Phase 3 явно разделяет Analytics (`MET-*`), Dashboard (`DSH-*`) и Reports (`RPT-*`).
10. System не получает искусственный business ID.
11. RBAC дополнен правилами для Dashboard/Analytics/Reports/System.
12. Канонические роли остаются неизменными: ADMIN, DIRECTOR, FINANCE, MARKETER, ANALYST, MODERATOR, SALES_MANAGER, OPERATOR, PARTNER, BUYER.
13. `OrderApproved` по-прежнему не является триггером Booking.
14. `SALES_MANAGER` не получает generic `order:write`; `OPERATOR` остается основной операционной ролью Order/Booking/Support.
15. Finance остается единственным владельцем Currency/ExchangeRate/Tax/TaxRule; Settings хранит только references/configuration.
16. Public Marketplace / Buyer Cabinet / Partner Cabinet / Moderation остаются официальным контуром.

## Канонический flow

`Lead → Opportunity → Quote → Sale → OrderRequested → Order → OrderReadyForBooking → BookingRequested → Booking → Fulfillment → Order Closed`

## Файлы комплекта

- Architecture Overview — Baseline 1.5.1 FINAL SYNC
- Implementation Prompt Phase 1 — Baseline 1.5.1 FINAL SYNC
- Implementation Prompt Phase 2 — Baseline 1.5.1 FINAL SYNC
- Implementation Prompt Phase 3 — Baseline 1.5.1 FINAL SYNC
- RBAC Matrix — Baseline 1.5.1 FINAL SYNC
- Screen Design Brief — Baseline 1.5.1 FINAL SYNC

## Baseline 1.5 final corrections

17. Добавлена Legacy Entity Classification & Migration Policy для Payout/Review/Chat*/TourMedia/StripeEvent и любых иных legacy objects без прямого target mapping.
18. При конфликте legacy ID запрещена семантическая переинтерпретация; используется legacyId → canonicalId migration mapping.
19. `TH-YYYY-######`: UTC year + atomic yearly sequence + UNIQUE constraint + idempotency before allocation.
20. `/orders/bootstrap` после Phase 2 удаляется без варианта «оставить как exception».
21. Backend implementation baseline зафиксирован: NestJS с существующим adapter; Jest + Supertest; e2e по DoD обязателен.


## Baseline 1.5 Marketplace/Catalog corrections

22. Public Marketplace fixed as default anonymous route `/`.
23. Product Detail Page made mandatory and fully specified.
24. Canonical top-level tourism service taxonomy added.
25. Category schema governs type-specific attributes, filters, availability, tariffs/options and PDP sections.
26. Partner image upload workflow specified: multi-upload, primary, ordering, caption/alt, replace/delete, validation, optimization/thumbnails and moderation/publication boundary.
27. Product remains universal Catalog.Product; categories do not create new bounded contexts.


## Baseline 1.5.1 FINAL SYNC

Синхронизация без изменения Master:

1. Phase 1 теперь явно закладывает общий Product + category schema.
2. Catalog-owned media record/asset описан как foundation; допустимое имя implementation entity `ProductMedia` не создает новый domain.
3. Добавлены media upload/reorder/set-primary/replace/delete contracts и тесты.
4. Зафиксировано, что media requirements входят в category schema и могут блокировать publication.
5. PARTNER ограничен собственными Product/media.
6. MODERATOR получает review/approve/reject/request-changes и read-for-moderation, но не Product/media write за PARTNER.
7. Draft/unpublished media запрещено отдавать public API.
8. Существенное изменение опубликованного Product/media не меняет публичную версию до нового разрешенного moderation/publish transition.
9. Phase 2 сохраняет Product/category/version references и не создает второй Catalog SSOT внутри Quote/Sale/Order.
10. Phase 3 обязана строить Marketplace поверх этого foundation без параллельной Product-модели.
