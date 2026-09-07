/**
 * UI-C1.2H — Help / Business Dictionary i18n bridge (RU/AZ/EN).
 *
 * All user-facing Help strings (short definitions for popovers and full
 * business definitions for the Help Center) live HERE — never as hardcoded
 * JSX strings. Title keys reuse the canonical registry-page label keys from
 * the main DICT (requests.kpi.*, order.status.*, status.entity.*, …), so a
 * KPI card title and its Help title can never diverge.
 *
 * `helpT(key, locale)` resolves from HELP_DICT first and falls back to the
 * main i18n `t()` — titles always resolve through the same source the pages
 * use. A missing key is a contract error caught by help-registry tests.
 */

import { t, type Locale } from "./i18n";

export const HELP_DICT: Record<string, Record<Locale, string>> = {
  // ── Generic Help UI labels ────────────────────────────────────────────────
  "help.title": { ru: "Справка / Бизнес-словарь", az: "Kömək / Biznes lüğəti", en: "Help / Business Dictionary" },
  "help.intro": {
    ru: "Канонические определения KPI, статусов и правил Commerce Center. Справка описывает существующую серверную бизнес-семантику и никогда её не меняет.",
    az: "Commerce Center KPI, status və qaydalarının kanonik tərifləri. Kömək mövcud server biznes semantikasını təsvir edir və onu heç vaxt dəyişmir.",
    en: "Canonical definitions of Commerce Center KPIs, statuses and rules. Help describes the existing server-side business semantics and never changes them.",
  },
  "help.domains_title": { ru: "Разделы", az: "Bölmələr", en: "Sections" },
  "help.topic_not_found": { ru: "Тема не найдена", az: "Mövzu tapılmadı", en: "Topic not found" },
  "help.topic_not_found_hint": {
    ru: "Запрошенный идентификатор темы отсутствует в реестре справки. Выберите тему из списка ниже.",
    az: "Tələb olunan mövzu identifikatoru kömək reyestrində yoxdur. Aşağıdakı siyahıdan mövzu seçin.",
    en: "The requested topic ID is not in the help registry. Choose a topic from the list below.",
  },
  "help.trigger_aria": { ru: "Справка: {label}", az: "Kömək: {label}", en: "Help: {label}" },
  "help.trigger_symbol": { ru: "?", az: "?", en: "?" },
  "help.details_link": { ru: "Подробное определение", az: "Ətraflı tərif", en: "Full definition" },
  "help.back_topics": { ru: "← Ко всем темам", az: "← Bütün mövzulara", en: "← All topics" },
  "help.metadata.source": { ru: "Источник данных", az: "Məlumat mənbəyi", en: "Data source" },
  "help.metadata.scope": { ru: "Область", az: "Əhatə", en: "Scope" },
  "help.metadata.formula": { ru: "Формула", az: "Formula", en: "Formula" },
  "help.metadata.period": { ru: "Период", az: "Dövr", en: "Period" },
  "help.metadata.group": { ru: "Группа", az: "Qrup", en: "Group" },
  "help.metadata.contract": { ru: "Версия контракта", az: "Müqavilə versiyası", en: "Contract version" },
  "help.metadata.inclusions": { ru: "Включает", az: "Daxildir", en: "Includes" },
  "help.scope.global": {
    ru: "Глобальный scope (KPI-обзор)",
    az: "Qlobal əhatə (KPI icmalı)",
    en: "Global scope (KPI overview)",
  },
  "help.scope.table": { ru: "Scope таблицы (фильтр)", az: "Cədvəl əhatəsi (filtr)", en: "Table scope (filter)" },
  "help.period.global": {
    ru: "Общий период Operations Center (Header Period)",
    az: "Operations Center ümumi dövrü (Header Period)",
    en: "Operations Center global period (Header Period)",
  },
  "help.type.kpi": { ru: "KPI", az: "KPI", en: "KPI" },
  "help.type.status": { ru: "Статус", az: "Status", en: "Status" },
  "help.type.group": { ru: "Группа", az: "Qrup", en: "Group" },
  "help.entry_count": { ru: "{n} тем", az: "{n} mövzu", en: "{n} topics" },

  // ── UI-C1.2H.2 — Global Help Center UX / Business Dictionary navigation ──
  "help.search_placeholder": { ru: "Поиск по справке…", az: "Kömək axtarışı…", en: "Search help…" },
  "help.search_aria": { ru: "Поиск по справке", az: "Kömək axtarışı", en: "Search help" },
  "help.search_clear": { ru: "Очистить поиск", az: "Axtarışı təmizlə", en: "Clear search" },
  "help.search_no_results": { ru: "Ничего не найдено", az: "Heç nə tapılmadı", en: "No results found" },
  "help.search_no_results_hint": {
    ru: "Попробуйте изменить запрос или сбросить фильтры.",
    az: "Sorğunu dəyişməyə və ya filtrləri sıfırlamağa çalışın.",
    en: "Try a different query or clear the filters.",
  },
  "help.filter_all_topics": { ru: "Все темы", az: "Bütün mövzular", en: "All topics" },
  "help.filter_metrics": { ru: "Метрики", az: "Metriklər", en: "Metrics" },
  "help.filter_statuses": { ru: "Статусы", az: "Statuslar", en: "Statuses" },
  "help.filter_type_aria": { ru: "Фильтр по типу темы", az: "Mövzu növünə görə filtr", en: "Filter by topic type" },
  "help.filter_all_sections": { ru: "Все разделы", az: "Bütün bölmələr", en: "All sections" },
  "help.filter_section_aria": { ru: "Фильтр по разделу", az: "Bölməyə görə filtr", en: "Filter by section" },
  "help.future_sections": { ru: "Будущие разделы", az: "Gələcək bölmələr", en: "Future sections" },
  "help.future_area_note": {
    ru: "Контент появится после запуска соответствующего раздела.",
    az: "Məzmun müvafiq bölmə işə salındıqdan sonra görünəcək.",
    en: "Content will appear once the corresponding section is launched.",
  },
  "help.finance_center_status": {
    ru: "Финансовый центр — NOT STARTED; реализован только раздел «Платежи».",
    az: "Maliyyə mərkəzi — NOT STARTED; yalnız «Ödənişlər» bölməsi mövcuddur.",
    en: "Finance Center — NOT STARTED; only the Payments section is implemented.",
  },
  "help.payments_finance_ownership": {
    ru: "Платежи — текущая финансовая capability с зоной ответственности Finance (не Finance Center).",
    az: "Ödənişlər — Finance məsuliyyəti olan cari maliyyə imkanı (Finance Center deyil).",
    en: "Payments — current financial capability with Finance ownership (not a Finance Center).",
  },
  // area labels (canonical HelpArea taxonomy, UI-C1.2H.1 / H.2)
  "help.area.platform": { ru: "Платформа", az: "Platforma", en: "Platform" },
  "help.area.command-center": { ru: "Command Center", az: "Command Center", en: "Command Center" },
  "help.area.analytics": { ru: "Аналитика", az: "Analitika", en: "Analytics" },
  "help.area.operations": { ru: "Операции", az: "Əməliyyatlar", en: "Operations" },
  "help.area.finance": { ru: "Финансы", az: "Maliyyə", en: "Finance" },
  "help.area.sales": { ru: "Продажи", az: "Satış", en: "Sales" },
  "help.area.catalog": { ru: "Каталог", az: "Kataloq", en: "Catalog" },
  "help.area.crm": { ru: "CRM", az: "CRM", en: "CRM" },
  "help.area.marketing": { ru: "Маркетинг", az: "Marketinq", en: "Marketing" },
  "help.area.support": { ru: "Поддержка", az: "Dəstək", en: "Support" },
  "help.area.admin": { ru: "Администрирование", az: "Administrasiya", en: "Administration" },
  "help.area.marketplace": { ru: "Marketplace", az: "Marketplace", en: "Marketplace" },
  "help.area.shared": { ru: "Общие понятия", az: "Ümumi anlayışlar", en: "Shared concepts" },

  /* ═══════════════════ REQUESTS ═══════════════════ */
  "help.requests.kpi.total.short": {
    ru: "Общее количество заявок в текущем глобальном scope (рабочая область + период).",
    az: "Cari qlobal əhatədə (iş sahəsi + dövr) sorğuların ümumi sayı.",
    en: "Total number of requests in the current global scope (workspace + period).",
  },
  "help.requests.kpi.total.description": {
    ru: "Общее количество заявок, рассчитанное сервером в глобальном scope: рабочая область и общий период Operations Center. Значение приходит с серверного KPI-эндпоинта и не вычисляется на фронтенде. Клик по карточке сбрасывает фильтр статуса и возвращает таблицу к полному списку.",
    az: "Server tərəfindən qlobal əhatədə hesablanan sorğuların ümumi sayı: iş sahəsi və Operations Center ümumi dövrü. Dəyər server KPI endpointindən gəlir və frontenddə hesablanmır. Karta klik status filtrini sıfırlayır və cədvəli tam siyahıya qaytarır.",
    en: "Total number of requests computed by the server in the global scope: workspace and the shared Operations Center period. The value comes from the server KPI endpoint and is never computed on the frontend. Clicking the card clears the status filter and returns the table to the full list.",
  },
  "help.requests.status.new.short": {
    ru: "Заявки, созданные и ожидающие первичной обработки.",
    az: "Yaradılmış və ilkin emalı gözləyən sorğular.",
    en: "Requests created and awaiting initial handling.",
  },
  "help.requests.status.new.description": {
    ru: "Серверный счётчик заявок со статусом NEW в глобальном scope (рабочая область + период). Клик по карточке активирует фильтр статуса в таблице.",
    az: "Qlobal əhatədə (iş sahəsi + dövr) NEW statuslu sorğuların server sayğacı. Karta klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of requests with status NEW in the global scope (workspace + period). Clicking the card activates the status filter in the table.",
  },
  "help.requests.status.checking.short": {
    ru: "Заявки, находящиеся на проверке.",
    az: "Yoxlamada olan sorğular.",
    en: "Requests under review.",
  },
  "help.requests.status.checking.description": {
    ru: "Серверный счётчик заявок со статусом CHECKING — заявка проверяется оператором. Клик по карточке активирует фильтр статуса в таблице.",
    az: "CHECKING statuslu sorğuların server sayğacı — sorğu operator tərəfindən yoxlanılır. Karta klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of requests with status CHECKING — the request is being checked by an operator. Clicking the card activates the status filter in the table.",
  },
  "help.requests.status.price_changed.short": {
    ru: "Заявки с изменённой ценой, ожидающие решения клиента.",
    az: "Qiyməti dəyişmiş və müştəri qərarını gözləyən sorğular.",
    en: "Requests with a changed price awaiting a customer decision.",
  },
  "help.requests.status.price_changed.description": {
    ru: "Серверный счётчик заявок со статусом PRICE_CHANGED — поставщик изменил цену, требуется решение клиента. Клик по карточке активирует фильтр статуса в таблице.",
    az: "PRICE_CHANGED statuslu sorğuların server sayğacı — təchizatçı qiyməti dəyişib, müştəri qərarı tələb olunur. Karta klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of requests with status PRICE_CHANGED — the supplier changed the price and a customer decision is required. Clicking the card activates the status filter in the table.",
  },
  "help.requests.status.customer_accepted.short": {
    ru: "Заявки, по которым клиент принял условия.",
    az: "Müştərinin şərtləri qəbul etdiyi sorğular.",
    en: "Requests whose terms were accepted by the customer.",
  },
  "help.requests.status.customer_accepted.description": {
    ru: "Серверный счётчик заявок со статусом CUSTOMER_ACCEPTED — клиент принял предложенные условия. Клик по карточке активирует фильтр статуса в таблице.",
    az: "CUSTOMER_ACCEPTED statuslu sorğuların server sayğacı — müştəri təklif olunan şərtləri qəbul edib. Karta klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of requests with status CUSTOMER_ACCEPTED — the customer accepted the offered terms. Clicking the card activates the status filter in the table.",
  },
  "help.requests.status.confirmed.short": {
    ru: "Подтверждённые заявки.",
    az: "Təsdiqlənmiş sorğular.",
    en: "Confirmed requests.",
  },
  "help.requests.status.confirmed.description": {
    ru: "Серверный счётчик заявок со статусом CONFIRMED. Клик по карточке активирует фильтр статуса в таблице.",
    az: "CONFIRMED statuslu sorğuların server sayğacı. Karta klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of requests with status CONFIRMED. Clicking the card activates the status filter in the table.",
  },
  "help.requests.status.converted.short": {
    ru: "Заявки, конвертированные в заказ.",
    az: "Sifarişə keçirilmiş sorğular.",
    en: "Requests converted into an order.",
  },
  "help.requests.status.converted.description": {
    ru: "Серверный счётчик заявок со статусом CONVERTED — заявка конвертирована в заказ. Клик по карточке активирует фильтр статуса в таблице.",
    az: "CONVERTED statuslu sorğuların server sayğacı — sorğu sifarişə keçirilib. Karta klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of requests with status CONVERTED — the request was converted into an order. Clicking the card activates the status filter in the table.",
  },
  "help.requests.status.supplier_timeout.short": {
    ru: "Заявки, по которым поставщик не ответил в срок.",
    az: "Təchizatçının müddətində cavab vermədiyi sorğular.",
    en: "Requests where the supplier did not respond in time.",
  },
  "help.requests.status.supplier_timeout.description": {
    ru: "Серверный счётчик заявок со статусом SUPPLIER_TIMEOUT — истёк срок ответа поставщика. Клик по карточке активирует фильтр статуса в таблице.",
    az: "SUPPLIER_TIMEOUT statuslu sorğuların server sayğacı — təchizatçının cavab müddəti bitib. Karta klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of requests with status SUPPLIER_TIMEOUT — the supplier response deadline expired. Clicking the card activates the status filter in the table.",
  },
  "help.requests.status.customer_payment_timeout.short": {
    ru: "Заявки, по которым клиент не оплатил в срок.",
    az: "Müştərinin müddətində ödəmədiyi sorğular.",
    en: "Requests where the customer did not pay in time.",
  },
  "help.requests.status.customer_payment_timeout.description": {
    ru: "Серверный счётчик заявок со статусом CUSTOMER_PAYMENT_TIMEOUT — истёк срок оплаты клиентом. Клик по карточке активирует фильтр статуса в таблице.",
    az: "CUSTOMER_PAYMENT_TIMEOUT statuslu sorğuların server sayğacı — müştərinin ödəniş müddəti bitib. Karta klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of requests with status CUSTOMER_PAYMENT_TIMEOUT — the customer payment deadline expired. Clicking the card activates the status filter in the table.",
  },
  "help.requests.status.rejected.short": {
    ru: "Отклонённые заявки.",
    az: "Rədd edilmiş sorğular.",
    en: "Rejected requests.",
  },
  "help.requests.status.rejected.description": {
    ru: "Серверный счётчик заявок со статусом REJECTED. Клик по карточке активирует фильтр статуса в таблице.",
    az: "REJECTED statuslu sorğuların server sayğacı. Karta klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of requests with status REJECTED. Clicking the card activates the status filter in the table.",
  },
  "help.requests.status.unavailable.short": {
    ru: "Заявки, по которым услуга недоступна.",
    az: "Xidmətin mövcud olmadığı sorğular.",
    en: "Requests where the service is unavailable.",
  },
  "help.requests.status.unavailable.description": {
    ru: "Серверный счётчик заявок со статусом UNAVAILABLE — запрошенная услуга недоступна. Клик по карточке активирует фильтр статуса в таблице.",
    az: "UNAVAILABLE statuslu sorğuların server sayğacı — tələb olunan xidmət mövcud deyil. Karta klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of requests with status UNAVAILABLE — the requested service is unavailable. Clicking the card activates the status filter in the table.",
  },
  "help.requests.status.expired.short": {
    ru: "Заявки с истёкшим сроком действия.",
    az: "Müddəti bitmiş sorğular.",
    en: "Expired requests.",
  },
  "help.requests.status.expired.description": {
    ru: "Серверный счётчик заявок со статусом EXPIRED. Клик по карточке активирует фильтр статуса в таблице.",
    az: "EXPIRED statuslu sorğuların server sayğacı. Karta klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of requests with status EXPIRED. Clicking the card activates the status filter in the table.",
  },
  "help.requests.status.cancelled_by_customer.short": {
    ru: "Заявки, отменённые клиентом.",
    az: "Müştəri tərəfindən ləğv edilmiş sorğular.",
    en: "Requests cancelled by the customer.",
  },
  "help.requests.status.cancelled_by_customer.description": {
    ru: "Серверный счётчик заявок со статусом CANCELLED_BY_CUSTOMER — заявка отменена клиентом. Клик по карточке активирует фильтр статуса в таблице.",
    az: "CANCELLED_BY_CUSTOMER statuslu sorğuların server sayğacı — sorğu müştəri tərəfindən ləğv edilib. Karta klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of requests with status CANCELLED_BY_CUSTOMER — the request was cancelled by the customer. Clicking the card activates the status filter in the table.",
  },
  "help.requests.group.lifecycle.short": {
    ru: "Группа KPI-карточек жизненного цикла заявки.",
    az: "Sorğunun həyat dövrü KPI kartları qrupu.",
    en: "Request lifecycle KPI card group.",
  },
  "help.requests.group.lifecycle.description": {
    ru: "Семантическая группа, объединяющая карточки статусов активного жизненного цикла заявки. Группа не является статусом и не влияет на фильтрацию.",
    az: "Sorğunun aktiv həyat dövrü status kartlarını birləşdirən semantik qrup. Qrup status deyil və filtrasiyaya təsir etmir.",
    en: "Semantic group that unites the active lifecycle status cards of a request. The group is not a status and does not affect filtering.",
  },
  "help.requests.group.exceptions.short": {
    ru: "Группа KPI-карточек проблем и завершений заявки.",
    az: "Sorğunun problem və son nəticə KPI kartları qrupu.",
    en: "Request issue and completion KPI card group.",
  },
  "help.requests.group.exceptions.description": {
    ru: "Семантическая группа, объединяющая карточки исключений и завершающих исходов заявки. Группа не является статусом и не влияет на фильтрацию.",
    az: "Sorğunun istisna və son nəticə kartlarını birləşdirən semantik qrup. Qrup status deyil və filtrasiyaya təsir etmir.",
    en: "Semantic group that unites the exception and terminal outcome cards of a request. The group is not a status and does not affect filtering.",
  },

  /* ═══════════════════ ORDERS ═══════════════════ */
  "help.orders.kpi.total.short": {
    ru: "Общее количество заказов в глобальном scope.",
    az: "Qlobal əhatədə sifarişlərin ümumi sayı.",
    en: "Total number of orders in the global scope.",
  },
  "help.orders.kpi.total.description": {
    ru: "Общее количество заказов, рассчитанное сервером в глобальном scope: рабочая область и общий период Operations Center. Значение приходит в aggregates серверного списка и не вычисляется на фронтенде. Клик очищает фильтры жизненного цикла и оплаты.",
    az: "Server tərəfindən qlobal əhatədə (iş sahəsi + Operations Center ümumi dövrü) hesablanan sifarişlərin ümumi sayı. Dəyər server siyahısının aggregates hissəsində gəlir və frontenddə hesablanmır. Klik lifecycle və ödəniş filtrlərini təmizləyir.",
    en: "Total number of orders computed by the server in the global scope: workspace and the shared Operations Center period. The value arrives in the aggregates of the server list and is never computed on the frontend. Clicking clears the lifecycle and payment filters.",
  },
  "help.orders.status.new.short": {
    ru: "Новые заказы.",
    az: "Yeni sifarişlər.",
    en: "New orders.",
  },
  "help.orders.status.new.description": {
    ru: "Серверный счётчик заказов со статусом жизненного цикла NEW. Клик активирует lifecycle-фильтр в таблице.",
    az: "NEW həyat dövrü statuslu sifarişlərin server sayğacı. Klik cədvəldə lifecycle filtrini aktivləşdirir.",
    en: "Server count of orders with lifecycle status NEW. Clicking activates the lifecycle filter in the table.",
  },
  "help.orders.status.in_processing.short": {
    ru: "Заказы, находящиеся в обработке.",
    az: "Emal olunan sifarişlər.",
    en: "Orders in processing.",
  },
  "help.orders.status.in_processing.description": {
    ru: "Серверный счётчик заказов со статусом жизненного цикла IN_PROCESSING — заказ принят и обрабатывается. Клик активирует lifecycle-фильтр в таблице.",
    az: "IN_PROCESSING həyat dövrü statuslu sifarişlərin server sayğacı — sifariş qəbul edilib və emal olunur. Klik cədvəldə lifecycle filtrini aktivləşdirir.",
    en: "Server count of orders with lifecycle status IN_PROCESSING — the order was accepted and is being processed. Clicking activates the lifecycle filter in the table.",
  },
  "help.orders.status.ready_for_booking.short": {
    ru: "Заказы, готовые к бронированию.",
    az: "Bronlaşdırmaya hazır sifarişlər.",
    en: "Orders ready for booking.",
  },
  "help.orders.status.ready_for_booking.description": {
    ru: "Серверный счётчик заказов со статусом жизненного цикла READY_FOR_BOOKING — данные полны, заказ готов к передаче в бронирование. Клик активирует lifecycle-фильтр в таблице.",
    az: "READY_FOR_BOOKING həyat dövrü statuslu sifarişlərin server sayğacı — məlumatlar tamdır, sifariş bronlaşdırmaya ötürülməyə hazırdır. Klik cədvəldə lifecycle filtrini aktivləşdirir.",
    en: "Server count of orders with lifecycle status READY_FOR_BOOKING — data is complete and the order is ready to be sent to booking. Clicking activates the lifecycle filter in the table.",
  },
  "help.orders.status.sent_to_booking.short": {
    ru: "Заказы, отправленные в бронирование.",
    az: "Bronlaşdırmaya göndərilmiş sifarişlər.",
    en: "Orders sent to booking.",
  },
  "help.orders.status.sent_to_booking.description": {
    ru: "Серверный счётчик заказов со статусом жизненного цикла SENT_TO_BOOKING. Клик активирует lifecycle-фильтр в таблице.",
    az: "SENT_TO_BOOKING həyat dövrü statuslu sifarişlərin server sayğacı. Klik cədvəldə lifecycle filtrini aktivləşdirir.",
    en: "Server count of orders with lifecycle status SENT_TO_BOOKING. Clicking activates the lifecycle filter in the table.",
  },
  "help.orders.status.fulfilled.short": {
    ru: "Выполненные заказы.",
    az: "İcra edilmiş sifarişlər.",
    en: "Fulfilled orders.",
  },
  "help.orders.status.fulfilled.description": {
    ru: "Серверный счётчик заказов со статусом жизненного цикла FULFILLED — услуга исполнена. Клик активирует lifecycle-фильтр в таблице.",
    az: "FULFILLED həyat dövrü statuslu sifarişlərin server sayğacı — xidmət icra edilib. Klik cədvəldə lifecycle filtrini aktivləşdirir.",
    en: "Server count of orders with lifecycle status FULFILLED — the service was fulfilled. Clicking activates the lifecycle filter in the table.",
  },
  "help.orders.status.closed.short": {
    ru: "Закрытые заказы.",
    az: "Bağlanmış sifarişlər.",
    en: "Closed orders.",
  },
  "help.orders.status.closed.description": {
    ru: "Серверный счётчик заказов со статусом жизненного цикла CLOSED. Клик активирует lifecycle-фильтр в таблице.",
    az: "CLOSED həyat dövrü statuslu sifarişlərin server sayğacı. Klik cədvəldə lifecycle filtrini aktivləşdirir.",
    en: "Server count of orders with lifecycle status CLOSED. Clicking activates the lifecycle filter in the table.",
  },
  "help.orders.status.waiting_for_data.short": {
    ru: "Заказы, ожидающие недостающие данные.",
    az: "Çatışmayan məlumatı gözləyən sifarişlər.",
    en: "Orders waiting for missing data.",
  },
  "help.orders.status.waiting_for_data.description": {
    ru: "Серверный счётчик заказов со статусом жизненного цикла WAITING_FOR_DATA. Статус относится к группе rework — это не линейный путь жизненного цикла. Клик активирует lifecycle-фильтр в таблице.",
    az: "WAITING_FOR_DATA həyat dövrü statuslu sifarişlərin server sayğacı. Status rework qrupuna aiddir — bu xətti həyat dövrü yolu deyil. Klik cədvəldə lifecycle filtrini aktivləşdirir.",
    en: "Server count of orders with lifecycle status WAITING_FOR_DATA. The status belongs to the rework group — it is not a linear lifecycle path. Clicking activates the lifecycle filter in the table.",
  },
  "help.orders.status.partially_fulfilled.short": {
    ru: "Частично выполненные заказы.",
    az: "Qismən icra edilmiş sifarişlər.",
    en: "Partially fulfilled orders.",
  },
  "help.orders.status.partially_fulfilled.description": {
    ru: "Серверный счётчик заказов со статусом жизненного цикла PARTIALLY_FULFILLED. Статус относится к группе rework — это не линейный путь жизненного цикла. Клик активирует lifecycle-фильтр в таблице.",
    az: "PARTIALLY_FULFILLED həyat dövrü statuslu sifarişlərin server sayğacı. Status rework qrupuna aiddir. Klik cədvəldə lifecycle filtrini aktivləşdirir.",
    en: "Server count of orders with lifecycle status PARTIALLY_FULFILLED. The status belongs to the rework group. Clicking activates the lifecycle filter in the table.",
  },
  "help.orders.status.ready_to_close.short": {
    ru: "Заказы, готовые к закрытию.",
    az: "Bağlanmağa hazır sifarişlər.",
    en: "Orders ready to close.",
  },
  "help.orders.status.ready_to_close.description": {
    ru: "Серверный счётчик заказов со статусом жизненного цикла READY_TO_CLOSE. Статус относится к группе rework — это не линейный путь жизненного цикла. Клик активирует lifecycle-фильтр в таблице.",
    az: "READY_TO_CLOSE həyat dövrü statuslu sifarişlərin server sayğacı. Status rework qrupuna aiddir. Klik cədvəldə lifecycle filtrini aktivləşdirir.",
    en: "Server count of orders with lifecycle status READY_TO_CLOSE. The status belongs to the rework group. Clicking activates the lifecycle filter in the table.",
  },
  "help.orders.status.problem.short": {
    ru: "Заказы с проблемой.",
    az: "Problemli sifarişlər.",
    en: "Orders with a problem.",
  },
  "help.orders.status.problem.description": {
    ru: "Серверный счётчик заказов со статусом жизненного цикла PROBLEM — заказ требует внимания. Клик активирует lifecycle-фильтр в таблице.",
    az: "PROBLEM həyat dövrü statuslu sifarişlərin server sayğacı — sifariş diqqət tələb edir. Klik cədvəldə lifecycle filtrini aktivləşdirir.",
    en: "Server count of orders with lifecycle status PROBLEM — the order requires attention. Clicking activates the lifecycle filter in the table.",
  },
  "help.orders.status.suspended.short": {
    ru: "Приостановленные заказы.",
    az: "Dayandırılmış sifarişlər.",
    en: "Suspended orders.",
  },
  "help.orders.status.suspended.description": {
    ru: "Серверный счётчик заказов со статусом жизненного цикла SUSPENDED. Клик активирует lifecycle-фильтр в таблице.",
    az: "SUSPENDED həyat dövrü statuslu sifarişlərin server sayğacı. Klik cədvəldə lifecycle filtrini aktivləşdirir.",
    en: "Server count of orders with lifecycle status SUSPENDED. Clicking activates the lifecycle filter in the table.",
  },
  "help.orders.status.cancelled.short": {
    ru: "Отменённые заказы.",
    az: "Ləğv edilmiş sifarişlər.",
    en: "Cancelled orders.",
  },
  "help.orders.status.cancelled.description": {
    ru: "Серверный счётчик заказов со статусом жизненного цикла CANCELLED. Клик активирует lifecycle-фильтр в таблице.",
    az: "CANCELLED həyat dövrü statuslu sifarişlərin server sayğacı. Klik cədvəldə lifecycle filtrini aktivləşdirir.",
    en: "Server count of orders with lifecycle status CANCELLED. Clicking activates the lifecycle filter in the table.",
  },
  "help.orders.payment.unpaid.short": {
    ru: "Заказы без оплаты.",
    az: "Ödənilməmiş sifarişlər.",
    en: "Orders with no payment.",
  },
  "help.orders.payment.unpaid.description": {
    ru: "Серверный счётчик заказов с paymentStatus UNPAID — paidAmount равен нулю. Payment-измерение отделено от жизненного цикла. Клик активирует payment-фильтр в таблице.",
    az: "paymentStatus UNPAID olan sifarişlərin server sayğacı — paidAmount sıfırdır. Payment ölçüsü həyat dövründən ayrıdır. Klik cədvəldə payment filtrini aktivləşdirir.",
    en: "Server count of orders with paymentStatus UNPAID — paidAmount is zero. The payment dimension is separate from the lifecycle. Clicking activates the payment filter in the table.",
  },
  "help.orders.payment.partially_paid.short": {
    ru: "Частично оплаченные заказы.",
    az: "Qismən ödənilmiş sifarişlər.",
    en: "Partially paid orders.",
  },
  "help.orders.payment.partially_paid.description": {
    ru: "Серверный счётчик заказов с paymentStatus PARTIALLY_PAID — оплачена часть суммы. Payment-измерение отделено от жизненного цикла. Клик активирует payment-фильтр в таблице.",
    az: "paymentStatus PARTIALLY_PAID olan sifarişlərin server sayğacı — məbləğin bir hissəsi ödənilib. Klik cədvəldə payment filtrini aktivləşdirir.",
    en: "Server count of orders with paymentStatus PARTIALLY_PAID — part of the amount is paid. Clicking activates the payment filter in the table.",
  },
  "help.orders.payment.paid.short": {
    ru: "Полностью оплаченные заказы.",
    az: "Tam ödənilmiş sifarişlər.",
    en: "Fully paid orders.",
  },
  "help.orders.payment.paid.description": {
    ru: "Серверный счётчик заказов с paymentStatus PAID — сумма оплачена полностью. Payment-измерение отделено от жизненного цикла. Клик активирует payment-фильтр в таблице.",
    az: "paymentStatus PAID olan sifarişlərin server sayğacı — məbləğ tam ödənilib. Klik cədvəldə payment filtrini aktivləşdirir.",
    en: "Server count of orders with paymentStatus PAID — the amount is fully paid. Clicking activates the payment filter in the table.",
  },
  "help.orders.payment.refunded.short": {
    ru: "Заказы с полным возвратом.",
    az: "Tam geri qaytarılmış sifarişlər.",
    en: "Orders with a full refund.",
  },
  "help.orders.payment.refunded.description": {
    ru: "Серверный счётчик заказов с paymentStatus REFUNDED — средства возвращены. Payment-измерение отделено от жизненного цикла. Клик активирует payment-фильтр в таблице.",
    az: "paymentStatus REFUNDED olan sifarişlərin server sayğacı — vəsait geri qaytarılıb. Klik cədvəldə payment filtrini aktivləşdirir.",
    en: "Server count of orders with paymentStatus REFUNDED — funds were returned. Clicking activates the payment filter in the table.",
  },
  "help.orders.group.lifecycle.short": {
    ru: "Группа KPI-карточек жизненного цикла заказа.",
    az: "Sifarişin həyat dövrü KPI kartları qrupu.",
    en: "Order lifecycle KPI card group.",
  },
  "help.orders.group.lifecycle.description": {
    ru: "Семантическая группа happy-path статусов жизненного цикла заказа. Группа не является статусом и не влияет на фильтрацию.",
    az: "Sifarişin həyat dövrü happy-path statuslarının semantik qrupu. Qrup status deyil və filtrasiyaya təsir etmir.",
    en: "Semantic group of the order's happy-path lifecycle statuses. The group is not a status and does not affect filtering.",
  },
  "help.orders.group.rework.short": {
    ru: "Группа KPI-карточек rework/альтернативных статусов заказа.",
    az: "Sifarişin rework/alternativ status KPI kartları qrupu.",
    en: "Order rework / alternative status KPI card group.",
  },
  "help.orders.group.rework.description": {
    ru: "Семантическая группа, объединяющая альтернативные статусы заказа. Не линейный путь, стрелок между карточками нет. Группа не является статусом.",
    az: "Sifarişin alternativ statuslarını birləşdirən semantik qrup. Xətti yol deyil, kartlar arasında oxlar yoxdur. Qrup status deyil.",
    en: "Semantic group uniting alternative order statuses. Not a linear path — no arrows between cards. The group is not a status.",
  },
  "help.orders.group.exceptions.short": {
    ru: "Группа KPI-карточек исключений заказа.",
    az: "Sifarişin istisna KPI kartları qrupu.",
    en: "Order exception KPI card group.",
  },
  "help.orders.group.exceptions.description": {
    ru: "Семантическая группа исключительных состояний заказа. Группа не является статусом и не влияет на фильтрацию.",
    az: "Sifarişin istisna hallarının semantik qrupu. Qrup status deyil və filtrasiyaya təsir etmir.",
    en: "Semantic group of exceptional order states. The group is not a status and does not affect filtering.",
  },
  "help.orders.group.payment.short": {
    ru: "Группа KPI-карточек статусов оплаты заказа.",
    az: "Sifarişin ödəniş statusu KPI kartları qrupu.",
    en: "Order payment status KPI card group.",
  },
  "help.orders.group.payment.description": {
    ru: "Семантическая группа payment-измерения заказа. Payment-измерение отделено от жизненного цикла. Группа не является статусом.",
    az: "Sifarişin payment ölçüsünün semantik qrupu. Payment ölçüsü həyat dövründən ayrıdır. Qrup status deyil.",
    en: "Semantic group of the order's payment dimension. The payment dimension is separate from the lifecycle. The group is not a status.",
  },

  /* ═══════════════════ BOOKINGS ═══════════════════ */
  "help.bookings.kpi.total.short": {
    ru: "Общее количество бронирований в глобальном scope.",
    az: "Qlobal əhatədə bronların ümumi sayı.",
    en: "Total number of bookings in the global scope.",
  },
  "help.bookings.kpi.total.description": {
    ru: "Общее количество бронирований, рассчитанное сервером в глобальном scope: рабочая область и общий период Operations Center. Значение приходит в aggregates серверного списка и не вычисляется на фронтенде. Клик сбрасывает фильтр статуса.",
    az: "Server tərəfindən qlobal əhatədə (iş sahəsi + Operations Center ümumi dövrü) hesablanan bronların ümumi sayı. Dəyər server siyahısının aggregates hissəsində gəlir və frontenddə hesablanmır. Klik status filtrini sıfırlayır.",
    en: "Total number of bookings computed by the server in the global scope: workspace and the shared Operations Center period. The value arrives in the aggregates of the server list and is never computed on the frontend. Clicking clears the status filter.",
  },
  "help.bookings.status.new.short": {
    ru: "Новые бронирования.",
    az: "Yeni bronlar.",
    en: "New bookings.",
  },
  "help.bookings.status.new.description": {
    ru: "Серверный счётчик бронирований со статусом NEW. Клик активирует фильтр статуса в таблице.",
    az: "NEW statuslu bronların server sayğacı. Klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of bookings with status NEW. Clicking activates the status filter in the table.",
  },
  "help.bookings.status.preparing_request.short": {
    ru: "Бронирования, по которым готовится запрос поставщику.",
    az: "Təchizatçıya sorğusu hazırlanan bronlar.",
    en: "Bookings whose supplier request is being prepared.",
  },
  "help.bookings.status.preparing_request.description": {
    ru: "Серверный счётчик бронирований со статусом PREPARING_REQUEST. Клик активирует фильтр статуса в таблице.",
    az: "PREPARING_REQUEST statuslu bronların server sayğacı. Klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of bookings with status PREPARING_REQUEST. Clicking activates the status filter in the table.",
  },
  "help.bookings.status.sent_to_supplier.short": {
    ru: "Бронирования, отправленные поставщику.",
    az: "Təchizatçıya göndərilmiş bronlar.",
    en: "Bookings sent to the supplier.",
  },
  "help.bookings.status.sent_to_supplier.description": {
    ru: "Серверный счётчик бронирований со статусом SENT_TO_SUPPLIER — запрос отправлен поставщику, ожидается ответ. Клик активирует фильтр статуса в таблице.",
    az: "SENT_TO_SUPPLIER statuslu bronların server sayğacı — sorğu təchizatçıya göndərilib, cavab gözlənilir. Klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of bookings with status SENT_TO_SUPPLIER — the request was sent to the supplier and an answer is expected. Clicking activates the status filter in the table.",
  },
  "help.bookings.status.awaiting_confirmation.short": {
    ru: "Бронирования, ожидающие подтверждения поставщика.",
    az: "Təchizatçı təsdiqini gözləyən bronlar.",
    en: "Bookings awaiting supplier confirmation.",
  },
  "help.bookings.status.awaiting_confirmation.description": {
    ru: "Серверный счётчик бронирований со статусом AWAITING_CONFIRMATION. Статус ожидания без текущего производителя — карточка не имеет входящей стрелки. Клик активирует фильтр статуса в таблице.",
    az: "AWAITING_CONFIRMATION statuslu bronların server sayğacı. Cari istehsalçısı olmayan gözləmə statusu — kartda giriş oxu yoxdur. Klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of bookings with status AWAITING_CONFIRMATION. A waiting status with no current producer — the card has no incoming arrow. Clicking activates the status filter in the table.",
  },
  "help.bookings.status.confirmed.short": {
    ru: "Подтверждённые бронирования.",
    az: "Təsdiqlənmiş bronlar.",
    en: "Confirmed bookings.",
  },
  "help.bookings.status.confirmed.description": {
    ru: "Серверный счётчик бронирований со статусом CONFIRMED — поставщик подтвердил бронирование. Клик активирует фильтр статуса в таблице.",
    az: "CONFIRMED statuslu bronların server sayğacı — təchizatçı bronu təsdiqləyib. Klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of bookings with status CONFIRMED — the supplier confirmed the booking. Clicking activates the status filter in the table.",
  },
  "help.bookings.status.in_service.short": {
    ru: "Бронирования в услуге.",
    az: "Xidmətdə olan bronlar.",
    en: "Bookings in service.",
  },
  "help.bookings.status.in_service.description": {
    ru: "Серверный счётчик бронирований со статусом IN_SERVICE — услуга началась. Клик активирует фильтр статуса в таблице.",
    az: "IN_SERVICE statuslu bronların server sayğacı — xidmət başlayıb. Klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of bookings with status IN_SERVICE — the service has started. Clicking activates the status filter in the table.",
  },
  "help.bookings.status.completed.short": {
    ru: "Завершённые бронирования.",
    az: "Tamamlanmış bronlar.",
    en: "Completed bookings.",
  },
  "help.bookings.status.completed.description": {
    ru: "Серверный счётчик бронирований со статусом COMPLETED — услуга оказана. Клик активирует фильтр статуса в таблице.",
    az: "COMPLETED statuslu bronların server sayğacı — xidmət göstərilib. Klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of bookings with status COMPLETED — the service was delivered. Clicking activates the status filter in the table.",
  },
  "help.bookings.status.needs_clarification.short": {
    ru: "Бронирования, требующие уточнения.",
    az: "Dəqiqləşdirmə tələb edən bronlar.",
    en: "Bookings that need clarification.",
  },
  "help.bookings.status.needs_clarification.description": {
    ru: "Серверный счётчик бронирований со статусом NEEDS_CLARIFICATION. Операционный статус без последовательного пути. Клик активирует фильтр статуса в таблице.",
    az: "NEEDS_CLARIFICATION statuslu bronların server sayğacı. Ardıcıl yolu olmayan operativ status. Klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of bookings with status NEEDS_CLARIFICATION. An operational status with no sequential path. Clicking activates the status filter in the table.",
  },
  "help.bookings.status.supplier_rejected.short": {
    ru: "Бронирования, отклонённые поставщиком.",
    az: "Təchizatçı tərəfindən rədd edilmiş bronlar.",
    en: "Bookings rejected by the supplier.",
  },
  "help.bookings.status.supplier_rejected.description": {
    ru: "Серверный счётчик бронирований со статусом SUPPLIER_REJECTED — поставщик отклонил запрос. Терминальный исход. Клик активирует фильтр статуса в таблице.",
    az: "SUPPLIER_REJECTED statuslu bronların server sayğacı — təchizatçı sorğunu rədd edib. Son nəticə. Klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of bookings with status SUPPLIER_REJECTED — the supplier rejected the request. A terminal outcome. Clicking activates the status filter in the table.",
  },
  "help.bookings.status.change_requested.short": {
    ru: "Бронирования с запрошенным изменением.",
    az: "Dəyişiklik tələb olunan bronlar.",
    en: "Bookings with a requested change.",
  },
  "help.bookings.status.change_requested.description": {
    ru: "Серверный счётчик бронирований со статусом CHANGE_REQUESTED. Операционный статус без последовательного пути. Клик активирует фильтр статуса в таблице.",
    az: "CHANGE_REQUESTED statuslu bronların server sayğacı. Ardıcıl yolu olmayan operativ status. Klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of bookings with status CHANGE_REQUESTED. An operational status with no sequential path. Clicking activates the status filter in the table.",
  },
  "help.bookings.status.cancellation_requested.short": {
    ru: "Бронирования с запрошенной отменой.",
    az: "Ləğv tələb olunan bronlar.",
    en: "Bookings with a requested cancellation.",
  },
  "help.bookings.status.cancellation_requested.description": {
    ru: "Серверный счётчик бронирований со статусом CANCELLATION_REQUESTED. Операционный статус без последовательного пути. Клик активирует фильтр статуса в таблице.",
    az: "CANCELLATION_REQUESTED statuslu bronların server sayğacı. Ardıcıl yolu olmayan operativ status. Klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of bookings with status CANCELLATION_REQUESTED. An operational status with no sequential path. Clicking activates the status filter in the table.",
  },
  "help.bookings.status.cancelled.short": {
    ru: "Отменённые бронирования.",
    az: "Ləğv edilmiş bronlar.",
    en: "Cancelled bookings.",
  },
  "help.bookings.status.cancelled.description": {
    ru: "Серверный счётчик бронирований со статусом CANCELLED. Терминальный исход. Клик активирует фильтр статуса в таблице.",
    az: "CANCELLED statuslu bronların server sayğacı. Son nəticə. Klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of bookings with status CANCELLED. A terminal outcome. Clicking activates the status filter in the table.",
  },
  "help.bookings.status.problem.short": {
    ru: "Бронирования с проблемой.",
    az: "Problemli bronlar.",
    en: "Bookings with a problem.",
  },
  "help.bookings.status.problem.description": {
    ru: "Серверный счётчик бронирований со статусом PROBLEM. Операционный статус без последовательного пути. Клик активирует фильтр статуса в таблице.",
    az: "PROBLEM statuslu bronların server sayğacı. Ardıcıl yolu olmayan operativ status. Klik cədvəldə status filtrini aktivləşdirir.",
    en: "Server count of bookings with status PROBLEM. An operational status with no sequential path. Clicking activates the status filter in the table.",
  },
  "help.bookings.group.lifecycle.short": {
    ru: "Группа KPI-карточек основного процесса бронирования.",
    az: "Bronun əsas proses KPI kartları qrupu.",
    en: "Booking main-process KPI card group.",
  },
  "help.bookings.group.lifecycle.description": {
    ru: "Семантическая группа фаз запроса и исполнения бронирования. Группа не является статусом и не влияет на фильтрацию.",
    az: "Bronun sorğu və icra fazalarının semantik qrupu. Qrup status deyil və filtrasiyaya təsir etmir.",
    en: "Semantic group of the booking request and fulfilment phases. The group is not a status and does not affect filtering.",
  },
  "help.bookings.group.awaiting.short": {
    ru: "Группа ожидания подтверждения.",
    az: "Təsdiq gözləmə qrupu.",
    en: "Awaiting-confirmation group.",
  },
  "help.bookings.group.awaiting.description": {
    ru: "Семантическая группа статусов ожидания без текущего производителя. Группа не является статусом и не влияет на фильтрацию.",
    az: "Cari istehsalçısı olmayan gözləmə statuslarının semantik qrupu. Qrup status deyil və filtrasiyaya təsir etmir.",
    en: "Semantic group of waiting statuses with no current producer. The group is not a status and does not affect filtering.",
  },
  "help.bookings.group.decisions.short": {
    ru: "Группа операционных статусов бронирования.",
    az: "Bronun operativ statuslar qrupu.",
    en: "Booking operational-status group.",
  },
  "help.bookings.group.decisions.description": {
    ru: "Семантическая группа операционных/решаемых состояний бронирования. Без последовательного пути. Группа не является статусом.",
    az: "Bronun operativ/həll edilən hallarının semantik qrupu. Ardıcıl yol yoxdur. Qrup status deyil.",
    en: "Semantic group of operational/decision booking states. No sequential path. The group is not a status.",
  },
  "help.bookings.group.terminal.short": {
    ru: "Группа конечных исходов бронирования.",
    az: "Bronun son nəticə qrupu.",
    en: "Booking terminal-outcome group.",
  },
  "help.bookings.group.terminal.description": {
    ru: "Семантическая группа терминальных исходов бронирования. Группа не является статусом и не влияет на фильтрацию.",
    az: "Bronun son nəticələrinin semantik qrupu. Qrup status deyil və filtrasiyaya təsir etmir.",
    en: "Semantic group of terminal booking outcomes. The group is not a status and does not affect filtering.",
  },

  /* ═══════════════════ PAYMENTS ═══════════════════ */
  "help.payments.kpi.total.short": {
    ru: "Общее количество платежей в глобальном scope.",
    az: "Qlobal əhatədə ödənişlərin ümumi sayı.",
    en: "Total number of payments in the global scope.",
  },
  "help.payments.kpi.total.description": {
    ru: "Общее количество платежей, рассчитанное сервером в глобальном scope: рабочая область и общий период Operations Center. Значение приходит в aggregates и не вычисляется на фронтенде. Клик очищает все три table-only KPI-измерения: paymentStatus, refundStatus и currencyCard.",
    az: "Server tərəfindən qlobal əhatədə (iş sahəsi + Operations Center ümumi dövrü) hesablanan ödənişlərin ümumi sayı. Dəyər aggregates hissəsində gəlir və frontenddə hesablanmır. Klik hər üç table-only KPI ölçüsünü təmizləyir: paymentStatus, refundStatus və currencyCard.",
    en: "Total number of payments computed by the server in the global scope: workspace and the shared Operations Center period. The value arrives in the aggregates and is never computed on the frontend. Clicking clears all three table-only KPI dimensions: paymentStatus, refundStatus and currencyCard.",
  },
  "help.payments.status.pending.short": {
    ru: "Платежи, ожидающие обработки.",
    az: "Emalı gözləyən ödənişlər.",
    en: "Payments awaiting processing.",
  },
  "help.payments.status.pending.description": {
    ru: "Серверный счётчик платежей с PaymentStatus PENDING — платёж создан и ожидает обработки. Клик активирует paymentStatus-фильтр в таблице.",
    az: "PaymentStatus PENDING olan ödənişlərin server sayğacı — ödəniş yaradılıb və emalı gözləyir. Klik cədvəldə paymentStatus filtrini aktivləşdirir.",
    en: "Server count of payments with PaymentStatus PENDING — the payment was created and awaits processing. Clicking activates the paymentStatus filter in the table.",
  },
  "help.payments.status.authorized.short": {
    ru: "Авторизованные платежи.",
    az: "İcazə verilmiş ödənişlər.",
    en: "Authorized payments.",
  },
  "help.payments.status.authorized.description": {
    ru: "Серверный счётчик платежей с PaymentStatus AUTHORIZED — средства авторизованы, но ещё не зачислены. Клик активирует paymentStatus-фильтр в таблице.",
    az: "PaymentStatus AUTHORIZED olan ödənişlərin server sayğacı — vəsait icazələnib, lakin hələ kapitallaşdırılmayıb. Klik cədvəldə paymentStatus filtrini aktivləşdirir.",
    en: "Server count of payments with PaymentStatus AUTHORIZED — funds are authorized but not yet captured. Clicking activates the paymentStatus filter in the table.",
  },
  "help.payments.status.captured.short": {
    ru: "Зачисленные платежи (успешно завершённые).",
    az: "Kapitallaşdırılmış (uğurla tamamlanmış) ödənişlər.",
    en: "Captured (successfully completed) payments.",
  },
  "help.payments.status.captured.description": {
    ru: "Серверный счётчик платежей с PaymentStatus CAPTURED — средства зачислены, платёж завершён. Клик активирует paymentStatus-фильтр в таблице.",
    az: "PaymentStatus CAPTURED olan ödənişlərin server sayğacı — vəsait kapitallaşdırılıb, ödəniş tamamlanıb. Klik cədvəldə paymentStatus filtrini aktivləşdirir.",
    en: "Server count of payments with PaymentStatus CAPTURED — funds were captured and the payment is complete. Clicking activates the paymentStatus filter in the table.",
  },
  "help.payments.status.failed.short": {
    ru: "Неуспешные платежи.",
    az: "Uğursuz ödənişlər.",
    en: "Failed payments.",
  },
  "help.payments.status.failed.description": {
    ru: "Серверный счётчик платежей с PaymentStatus FAILED — попытка платежа неуспешна. Клик активирует paymentStatus-фильтр в таблице.",
    az: "PaymentStatus FAILED olan ödənişlərin server sayğacı — ödəniş cəhdi uğursuzdur. Klik cədvəldə paymentStatus filtrini aktivləşdirir.",
    en: "Server count of payments with PaymentStatus FAILED — the payment attempt failed. Clicking activates the paymentStatus filter in the table.",
  },
  "help.payments.status.cancelled.short": {
    ru: "Отменённые платежи.",
    az: "Ləğv edilmiş ödənişlər.",
    en: "Cancelled payments.",
  },
  "help.payments.status.cancelled.description": {
    ru: "Серверный счётчик платежей с PaymentStatus CANCELLED. Клик активирует paymentStatus-фильтр в таблице.",
    az: "PaymentStatus CANCELLED olan ödənişlərin server sayğacı. Klik cədvəldə paymentStatus filtrini aktivləşdirir.",
    en: "Server count of payments with PaymentStatus CANCELLED. Clicking activates the paymentStatus filter in the table.",
  },
  "help.payments.status.refunded.short": {
    ru: "Полностью возвращённые платежи.",
    az: "Tam geri qaytarılmış ödənişlər.",
    en: "Fully refunded payments.",
  },
  "help.payments.status.refunded.description": {
    ru: "Серверный счётчик платежей с PaymentStatus REFUNDED — платёж полностью возвращён. Клик активирует paymentStatus-фильтр в таблице.",
    az: "PaymentStatus REFUNDED olan ödənişlərin server sayğacı — ödəniş tam geri qaytarılıb. Klik cədvəldə paymentStatus filtrini aktivləşdirir.",
    en: "Server count of payments with PaymentStatus REFUNDED — the payment was fully refunded. Clicking activates the paymentStatus filter in the table.",
  },
  "help.payments.refund.status.requested.short": {
    ru: "Возвраты, ожидающие обработки.",
    az: "Emalı gözləyən geri qaytarmalar.",
    en: "Refunds awaiting processing.",
  },
  "help.payments.refund.status.requested.description": {
    ru: "Серверный счётчик платежей с RefundStatus REQUESTED — возврат запрошен. RefundStatus отделён от PaymentStatus. Клик активирует refundStatus-фильтр в таблице.",
    az: "RefundStatus REQUESTED olan ödənişlərin server sayğacı — geri qaytarma istənilib. RefundStatus PaymentStatus-dan ayrıdır. Klik cədvəldə refundStatus filtrini aktivləşdirir.",
    en: "Server count of payments with RefundStatus REQUESTED — a refund was requested. RefundStatus is separate from PaymentStatus. Clicking activates the refundStatus filter in the table.",
  },
  "help.payments.refund.status.approved.short": {
    ru: "Одобренные возвраты.",
    az: "Təsdiqlənmiş geri qaytarmalar.",
    en: "Approved refunds.",
  },
  "help.payments.refund.status.approved.description": {
    ru: "Серверный счётчик платежей с RefundStatus APPROVED — возврат одобрен. RefundStatus отделён от PaymentStatus. Клик активирует refundStatus-фильтр в таблице.",
    az: "RefundStatus APPROVED olan ödənişlərin server sayğacı — geri qaytarma təsdiqlənib. Klik cədvəldə refundStatus filtrini aktivləşdirir.",
    en: "Server count of payments with RefundStatus APPROVED — the refund was approved. Clicking activates the refundStatus filter in the table.",
  },
  "help.payments.refund.status.processed.short": {
    ru: "Обработанные возвраты.",
    az: "Emal edilmiş geri qaytarmalar.",
    en: "Processed refunds.",
  },
  "help.payments.refund.status.processed.description": {
    ru: "Серверный счётчик платежей с RefundStatus PROCESSED — возврат обработан. RefundStatus отделён от PaymentStatus. Клик активирует refundStatus-фильтр в таблице.",
    az: "RefundStatus PROCESSED olan ödənişlərin server sayğacı — geri qaytarma emal edilib. Klik cədvəldə refundStatus filtrini aktivləşdirir.",
    en: "Server count of payments with RefundStatus PROCESSED — the refund was processed. Clicking activates the refundStatus filter in the table.",
  },
  "help.payments.refund.status.failed.short": {
    ru: "Неуспешные возвраты.",
    az: "Uğursuz geri qaytarmalar.",
    en: "Failed refunds.",
  },
  "help.payments.refund.status.failed.description": {
    ru: "Серверный счётчик платежей с RefundStatus FAILED — попытка возврата неуспешна. RefundStatus отделён от PaymentStatus. Клик активирует refundStatus-фильтр в таблице.",
    az: "RefundStatus FAILED olan ödənişlərin server sayğacı — geri qaytarma cəhdi uğursuzdur. Klik cədvəldə refundStatus filtrini aktivləşdirir.",
    en: "Server count of payments with RefundStatus FAILED — the refund attempt failed. Clicking activates the refundStatus filter in the table.",
  },
  "help.payments.group.payment_statuses.short": {
    ru: "Группа KPI-карточек статусов платежей.",
    az: "Ödəniş statusu KPI kartları qrupu.",
    en: "PaymentStatus KPI card group.",
  },
  "help.payments.group.payment_statuses.description": {
    ru: "Семантическая группа PaymentStatus (6 значений). PaymentStatus отделён от RefundStatus. Действует инвариант одной активной KPI: paymentStatus > refundStatus > currencyCard.",
    az: "PaymentStatus (6 dəyər) semantik qrupu. PaymentStatus RefundStatus-dan ayrıdır. Bir aktiv KPI invariantı qüvvədədir: paymentStatus > refundStatus > currencyCard.",
    en: "Semantic group of PaymentStatus (6 values). PaymentStatus is separate from RefundStatus. The one-active-KPI invariant applies: paymentStatus > refundStatus > currencyCard.",
  },
  "help.payments.group.refund_statuses.short": {
    ru: "Группа KPI-карточек статусов возвратов.",
    az: "Geri qaytarma statusu KPI kartları qrupu.",
    en: "RefundStatus KPI card group.",
  },
  "help.payments.group.refund_statuses.description": {
    ru: "Семантическая группа RefundStatus (4 значения), отделённая от PaymentStatus. Действует инвариант одной активной KPI: paymentStatus > refundStatus > currencyCard.",
    az: "PaymentStatus-dan ayrılmış RefundStatus (4 dəyər) semantik qrupu. Bir aktiv KPI invariantı qüvvədədir: paymentStatus > refundStatus > currencyCard.",
    en: "Semantic group of RefundStatus (4 values), separate from PaymentStatus. The one-active-KPI invariant applies: paymentStatus > refundStatus > currencyCard.",
  },
  "help.payments.group.currencies.short": {
    ru: "Динамические агрегаты по валютам платежей.",
    az: "Ödəniş valyutaları üzrə dinamik aqreqatlar.",
    en: "Dynamic per-currency payment aggregates.",
  },
  "help.payments.group.currencies.description": {
    ru: "Группа показывает серверные агрегаты по валютам из общего обзора. Валюты — это данные, а не статусы. Действует инвариант одной активной KPI: paymentStatus > refundStatus > currencyCard.",
    az: "Qrup ümumi icmaldan valyutalar üzrə server aqreqatlarını göstərir. Valyutalar status deyil, məlumatdır. Bir aktiv KPI invariantı qüvvədədir: paymentStatus > refundStatus > currencyCard.",
    en: "The group shows server per-currency aggregates from the overview. Currencies are data, not statuses. The one-active-KPI invariant applies: paymentStatus > refundStatus > currencyCard.",
  },
};

/** Resolve a help key: HELP_DICT first, then the main i18n dictionary. */
export function helpT(key: string, locale: Locale): string {
  const entry = HELP_DICT[key];
  if (entry) return entry[locale] ?? entry.ru ?? key;
  return t(key, locale);
}
