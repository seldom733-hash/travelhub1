"use client";

/**
 * PHASE 1 STEP 1.7 — Localization foundation (RU/AZ/EN).
 *
 * Архитектурное решение (§17): locale-состояние БЕЗ URL-префиксов `/ru|/az|/en`
 * (они изменили бы утверждённую routing architecture Step 1.6 → ADR required).
 * Вместо этого: client-side LocaleProvider + localStorage `travelhub.locale` +
 * синхронизация `document.documentElement.lang`.
 *
 * Правила:
 * - технические slug/code НЕ локализуются (product.slug, category.slug, USD…);
 * - currency/date/number formatting — через Intl (locale-aware);
 * - Product content (title/description) локализуется ТОЛЬКО если backend
 *   предоставит перевод; сейчас backend отдаёт единственный язык контента —
 *   fallback документирован: контент показывается как есть (t() локализует
 *   только UI-ярлыки). Машинный перевод «на лету» НЕ делаем.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "ru" | "az" | "en";

export const LOCALES: readonly Locale[] = ["ru", "az", "en"] as const;
export const DEFAULT_LOCALE: Locale = "ru";

/** Отображаемые имена языков (в их собственном написании). */
export const LOCALE_NAMES: Record<Locale, string> = {
  ru: "Русский",
  az: "Azərbaycanca",
  en: "English",
};

/** BCP-47 tags для Intl-форматирования. */
export const LOCALE_TAGS: Record<Locale, string> = {
  ru: "ru-RU",
  az: "az-AZ",
  en: "en-US",
};

const STORAGE_KEY = "travelhub.locale";

/* ── Словарь UI-ярлыков (плоские ключи, все три локали) ────────────────────── */

export const DICT: Record<string, Record<Locale, string>> = {
  // nav
  "nav.services": { ru: "Услуги", az: "Xidmətlər", en: "Services" },
  "nav.search": { ru: "Поиск", az: "Axtar", en: "Search" },
  "nav.categories": { ru: "Категории", az: "Kateqoriyalar", en: "Categories" },
  "nav.login": { ru: "Войти", az: "Daxil ol", en: "Sign in" },
  "nav.logout": { ru: "Выйти", az: "Çıxış", en: "Sign out" },
  "nav.workspace": { ru: "Рабочая область", az: "İş sahəsi", en: "Workspace" },
  "nav.cabinet": { ru: "Кабинет партнёра", az: "Tərəfdaş kabineti", en: "Partner Cabinet" },
  "nav.to_marketplace": { ru: "На витрину", az: "Vitrinə", en: "To marketplace" },
  "nav.locale": { ru: "Язык", az: "Dil", en: "Language" },
  "nav.search_placeholder": { ru: "Поиск услуг…", az: "Xidmət axtar…", en: "Search services…" },
  "nav.find": { ru: "Найти", az: "Axtar", en: "Find" },

  // hero / home
  "home.hero_title": { ru: "Туристические услуги TravelHub", az: "TravelHub turizm xidmətləri", en: "TravelHub travel services" },
  "home.hero_subtitle": {
    ru: "Проверенные модерацией услуги партнёров: туры, отели, экскурсии и больше.",
    az: "Moderasiyadan keçmiş tərəfdaş xidmətləri: turlar, otellər, ekskursiyalar və daha çox.",
    en: "Moderated partner services: tours, accommodation, excursions and more.",
  },
  "home.hero_search_placeholder": { ru: "Что или куда?", az: "Nə və ya hara?", en: "What or where?" },
  "home.hero_find": { ru: "Найти", az: "Axtar", en: "Find" },
  "home.categories_title": { ru: "Категории", az: "Kateqoriyalar", en: "Categories" },
  "home.categories_all": { ru: "Все категории", az: "Bütün kateqoriyalar", en: "All categories" },
  "home.published_title": { ru: "Опубликованные услуги", az: "Dərc olunmuş xidmətlər", en: "Published services" },
  "home.published_all": { ru: "Все услуги", az: "Bütün xidmətlər", en: "All services" },
  "home.published_empty": {
    ru: "Опубликованные услуги появятся после модерации",
    az: "Dərc olunmuş xidmətlər moderasiyadan sonra görünəcək",
    en: "Published services will appear after moderation",
  },
  "home.trust_title": { ru: "Почему TravelHub", az: "Niyə TravelHub", en: "Why TravelHub" },
  "home.trust_1_title": { ru: "Модерация", az: "Moderasiya", en: "Moderation" },
  "home.trust_1_text": { ru: "Каждая услуга проходит проверку перед публикацией.", az: "Hər xidmət dərc olunmazdan əvvəl yoxlanılır.", en: "Every service is reviewed before publishing." },
  "home.trust_2_title": { ru: "Честные цены", az: "Dürüst qiymətlər", en: "Fair prices" },
  "home.trust_2_text": { ru: "Цены от партнёров без скрытых наценок на витрине.", az: "Tərəfdaşların qiymətləri vitrində gizli əlavələr olmadan.", en: "Partner prices with no hidden markups on the marketplace." },
  "home.trust_3_title": { ru: "Разнообразие", az: "Müxtəliflik", en: "Variety" },
  "home.trust_3_text": { ru: "Туры, отели, экскурсии, транспорт и многое другое.", az: "Turlar, otellər, ekskursiyalar, nəqliyyat və daha çox.", en: "Tours, accommodation, excursions, transport and more." },

  // price / card
  "price.from": { ru: "от", az: "dən", en: "from" },
  "price.on_request": { ru: "Цена по запросу", az: "Qiymət sorğu əsasında", en: "Price on request" },
  "card.details": { ru: "Подробнее", az: "Ətraflı", en: "Details" },
  "card.availability_limited": { ru: "Ограниченное количество мест", az: "Məhdud sayda yer", en: "Limited availability" },

  // search
  "search.title": { ru: "Поиск услуг", az: "Xidmət axtarışı", en: "Search services" },
  "search.placeholder": { ru: "Поиск по названию, описанию…", az: "Ad və təsvir üzrə axtar…", en: "Search by name, description…" },
  "search.submit": { ru: "Поиск", az: "Axtar", en: "Search" },
  "search.category_all": { ru: "Все категории", az: "Bütün kateqoriyalar", en: "All categories" },
  "search.found": { ru: "Найдено", az: "Tapıldı", en: "Found" },
  "search.empty": { ru: "Ничего не найдено — попробуйте изменить запрос", az: "Heç nə tapılmadı — sorğunu dəyişməyə çalışın", en: "Nothing found — try changing your query" },
  "search.available_from": { ru: "Доступно с", az: "Mövcuddur", en: "Available from" },

  // filters / sort
  "filters.title": { ru: "Фильтры", az: "Filtrlər", en: "Filters" },
  "filters.apply": { ru: "Применить", az: "Tətbiq et", en: "Apply" },
  "filters.reset": { ru: "Сбросить", az: "Sıfırla", en: "Reset" },
  "filters.no_filters": { ru: "Фильтры для этой категории недоступны", az: "Bu kateqoriya üçün filtrlər yoxdur", en: "No filters available for this category" },
  "sort.label": { ru: "Сортировка", az: "Sıralama", en: "Sort" },
  "sort.newest": { ru: "Сначала новые", az: "Əvvəlcə yenilər", en: "Newest first" },
  "sort.price_asc": { ru: "Цена: по возрастанию", az: "Qiymət: artan", en: "Price: low to high" },
  "sort.price_desc": { ru: "Цена: по убыванию", az: "Qiymət: azalan", en: "Price: high to low" },
  "sort.asc": { ru: "По возрастанию", az: "Artan", en: "Ascending" },
  "sort.desc": { ru: "По убыванию", az: "Azalan", en: "Descending" },
  "sort.sort_by": { ru: "Сортировка по", az: "Sıralama", en: "Sort by" },

  // category page
  "category.not_found_title": { ru: "Категория не найдена", az: "Kateqoriya tapılmadı", en: "Category not found" },
  "category.not_found_hint": { ru: "Категория не существует или недоступна.", az: "Kateqoriya mövcud deyil və ya əlçatan deyil.", en: "The category does not exist or is unavailable." },
  "category.empty": { ru: "В этой категории пока нет опубликованных услуг", az: "Bu kateqoriyada hələ dərc olunmuş xidmət yoxdur", en: "No published services in this category yet" },
  "category.services_count": { ru: "услуг", az: "xidmət", en: "services" },
  "category.back_all": { ru: "Все услуги", az: "Bütün xidmətlər", en: "All services" },

  // PDP
  "pdp.not_found_title": { ru: "Услуга не найдена", az: "Xidmət tapılmadı", en: "Service not found" },
  "pdp.not_found_hint": { ru: "Услуга ещё не опубликована или не существует.", az: "Xidmət hələ dərc olunmayıb və ya mövcud deyil.", en: "The service is not published yet or does not exist." },
  "pdp.price_from": { ru: "Цена от", az: "Qiymət", en: "Price from" },
  "pdp.primary_cta": { ru: "Оформить запрос", az: "Sorğu göndər", en: "Request booking" },
  "pdp.cta_placeholder": {
    ru: "Оформление бронирования и кабинет покупателя появятся в следующих шагах.",
    az: "Bronlaşdırma və alıcı kabineti növbəti addımlarda olacaq.",
    en: "Booking and the buyer cabinet will arrive in upcoming steps.",
  },
  "pdp.description_title": { ru: "Описание", az: "Təsvir", en: "Description" },
  "pdp.description_missing": { ru: "Описание отсутствует.", az: "Təsvir yoxdur.", en: "No description." },
  "pdp.attributes_title": { ru: "Характеристики", az: "Xüsusiyyətlər", en: "Characteristics" },
  "pdp.tariffs_title": { ru: "Варианты и тарифы", az: "Variantlar və tariflər", en: "Options & tariffs" },
  "pdp.tariffs_none": { ru: "Тарифы уточняйте у поставщика", az: "Tariflər üçün təchizatçı ilə əlaqə saxlayın", en: "Contact the provider for tariffs" },
  "pdp.availability_title": { ru: "Доступность", az: "Mövcudluq", en: "Availability" },
  "pdp.availability_from": { ru: "Доступно с", az: "Mövcuddan", en: "Available from" },
  "pdp.availability_dates": { ru: "даты", az: "tarix", en: "dates" },
  "pdp.availability_unknown": { ru: "Нет данных о доступности", az: "Mövcudluq haqqında məlumat yoxdur", en: "No availability data" },
  "pdp.availability_notice": {
    ru: "Доступность указана для ознакомления и не является бронированием.",
    az: "Mövcudluq məlumat məqsədi daşıyır və bronlaşdırma deyil.",
    en: "Availability is shown for discovery only and is not a reservation.",
  },
  "pdp.published_on": { ru: "Опубликовано", az: "Dərc olunub", en: "Published" },
  "pdp.gallery_prev": { ru: "Предыдущее фото", az: "Əvvəlki şəkil", en: "Previous photo" },
  "pdp.gallery_next": { ru: "Следующее фото", az: "Növbəti şəkil", en: "Next photo" },
  "pdp.gallery_main_alt": { ru: "Основное фото услуги", az: "Xidmətin əsas şəkli", en: "Main photo of the service" },
  "pdp.no_media": { ru: "Фотографии появятся позже", az: "Şəkillər daha sonra əlavə olunacaq", en: "Photos will be added later" },
  "pdp.breadcrumb_home": { ru: "Главная", az: "Ana səhifə", en: "Home" },

  // seller identity (Step 1.11 — seller-safe projection; никогда raw CRM)
  "seller.title": { ru: "Продавец", az: "Satıcı", en: "Seller" },
  "seller.anonymous_label": { ru: "Проверенный партнёр TravelHub", az: "Yoxlanmış TravelHub tərəfdaşı", en: "Verified TravelHub partner" },
  "seller.verified_badge": { ru: "Проверено", az: "Təsdiqlənmiş", en: "Verified" },
  "seller.member_since": { ru: "На платформе с", az: "Platformada", en: "On TravelHub since" },
  "seller.moderated_notice": {
    ru: "Публичная информация о продавце проверяется модерацией. Контакты не раскрываются до покупки.",
    az: "Satıcı haqqında ictimai məlumat moderasiyadan keçir. Kontaktlar satınalmadan əvvəl açıqlanmır.",
    en: "Public seller info is moderated. Contacts are not disclosed before purchase.",
  },
  "seller.visibility_anonymous": { ru: "Анонимно", az: "Anonim", en: "Anonymous" },
  "seller.visibility_alias": { ru: "Псевдоним", az: "Ləqəb", en: "Verified alias" },
  "seller.visibility_brand": { ru: "Бренд", az: "Brend", en: "Public brand" },
  "seller.status": { ru: "Статус", az: "Status", en: "Status" },
  "seller.visibility_mode": { ru: "Режим видимости", az: "Görünmə rejimi", en: "Visibility mode" },
  "seller.display_name": { ru: "Публичное имя / псевдоним", az: "İctimai ad / ləqəb", en: "Public display name / alias" },
  "seller.display_name_hint": {
    ru: "Как вас видеть покупателям. Публикация — только после проверки модератором.",
    az: "Alıcıların sizi necə görəcəyi. Dərc yalnız moderator yoxlamasından sonra.",
    en: "How buyers see you. Published only after moderator review.",
  },
  "seller.description": { ru: "Публичное описание", az: "İctimai təsvir", en: "Public description" },
  "seller.country_system": { ru: "Страна (системная)", az: "Ölkə (sistem)", en: "Country (system)" },
  "seller.city_label": { ru: "Город", az: "Şəhər", en: "City" },
  "seller.city_none": { ru: "— не указывать —", az: "— göstərmə —", en: "— none —" },
  "seller.propose_btn": { ru: "Предложить изменения", az: "Dəyişiklik təklif et", en: "Propose changes" },
  "seller.submit_btn": { ru: "Отправить на проверку", az: "Yoxlamaya göndər", en: "Submit for review" },
  "seller.save_btn": { ru: "Сохранить черновик", az: "Qaralama saxla", en: "Save draft" },
  "seller.no_profile": { ru: "Профиль продавца ещё не создан.", az: "Satıcı profili hələ yaradılmayıb.", en: "Seller profile not created yet." },
  "seller.no_proposal": { ru: "Предложений пока нет.", az: "Hələ təklif yoxdur.", en: "No proposals yet." },
  "seller.proposal_status": { ru: "Статус предложения", az: "Təklifin statusu", en: "Proposal status" },
  "seller.policy_notice": {
    ru: "Публичная идентичность модерируется. Не указывайте контакты, ссылки на внешние сайты, WhatsApp/Telegram или QR-коды — это блокируется политикой anti-disintermediation.",
    az: "İctimai kimlik moderasiya olunur. Kontaktlar, xarici sayt linkləri, WhatsApp/Telegram və ya QR-kodlar göstərilməməlidir — bu anti-disintermediasiya siyasəti ilə bloklanır.",
    en: "Public identity is moderated. Do not include contacts, external links, WhatsApp/Telegram or QR codes — blocked by the anti-disintermediation policy.",
  },
  "seller.review_queue_title": { ru: "Публичная идентичность продавцов", az: "Satıcıların ictimai kimliyi", en: "Seller public identity" },
  "seller.review_subtitle": { ru: "Очередь предложений публичной идентичности (не Product moderation)", az: "İctimai kimlik təklifləri növbəsi (Product moderasiyası deyil)", en: "Seller identity proposal queue (not product moderation)" },
  "seller.approve_alias": { ru: "Одобрить псевдоним", az: "Ləqəbi təsdiqlə", en: "Approve alias" },
  "seller.approve_brand": { ru: "Одобрить бренд", az: "Brendi təsdiqlə", en: "Approve brand" },
  "seller.reject": { ru: "Отклонить", az: "Rədd et", en: "Reject" },
  "seller.request_changes": { ru: "Запросить правки", az: "Düzəliş tələb et", en: "Request changes" },
  "seller.hide_identity": { ru: "Скрыть идентичность", az: "Kimliyi gizlət", en: "Hide identity" },
  "seller.unhide_identity": { ru: "Восстановить", az: "Bərpa et", en: "Restore" },
  "seller.reason_code": { ru: "Причина", az: "Səbəb", en: "Reason" },
  "seller.comment": { ru: "Комментарий", az: "Şərh", en: "Comment" },
  "seller.queue_empty": { ru: "Заявок в очереди нет", az: "Növbədə təklif yoxdur", en: "No proposals in queue" },
  "seller.required_display_name": { ru: "Укажите публичное имя (псевдоним или бренд)", az: "İctimai adı göstərin (ləqəb və ya brend)", en: "Provide a public display name (alias or brand)" },
  "seller.created": { ru: "Создано", az: "Yaradılıb", en: "Created" },
  "seller.submitted_at": { ru: "Отправлено", az: "Göndərilib", en: "Submitted" },
  "seller.history": { ru: "История", az: "Tarixçə", en: "History" },
  "seller.reason_insufficient_info": { ru: "Недостаточно информации", az: "Məlumat azdır", en: "Insufficient info" },
  "seller.reason_inappropriate_name": { ru: "Неподходящее имя", az: "Uyğun olmayan ad", en: "Inappropriate name" },
  "seller.reason_misleading": { ru: "Вводящий в заблуждение контент", az: "Yanıltıcı məzmun", en: "Misleading content" },
  "seller.reason_disintermediation": { ru: "Попытка вывода за пределы платформы", az: "Platformadan kənara çıxarma cəhdi", en: "Disintermediation attempt" },
  "seller.reason_other": { ru: "Другое", az: "Digər", en: "Other" },
  "seller.nav": { ru: "Идентичность продавца", az: "Satıcı kimliyi", en: "Seller identity" },

  // attributes sections (из category attributes; fallback labels)
  "attr.location": { ru: "Место и адрес", az: "Məkan və ünvan", en: "Location & address" },
  "attr.duration": { ru: "Длительность", az: "Müddət", en: "Duration" },
  "attr.included": { ru: "Включено", az: "Daxildir", en: "Included" },
  "attr.excluded": { ru: "Не включено", az: "Daxil deyil", en: "Not included" },
  "attr.program": { ru: "Программа", az: "Proqram", en: "Program" },
  "attr.conditions": { ru: "Условия", az: "Şərtlər", en: "Conditions" },
  "attr.cancellation": { ru: "Отмена", az: "Ləğvetmə", en: "Cancellation" },
  "attr.other": { ru: "Дополнительно", az: "Əlavə", en: "Other" },
  "attr.yes": { ru: "Да", az: "Bəli", en: "Yes" },
  "attr.no": { ru: "Нет", az: "Xeyr", en: "No" },

  // states
  "state.loading": { ru: "Загрузка…", az: "Yüklənir…", en: "Loading…" },
  "state.error": { ru: "Не удалось загрузить данные каталога", az: "Kataloq məlumatları yüklənə bilmədi", en: "Failed to load catalog data" },
  "state.back_search": { ru: "Вернуться к поиску", az: "Axtarışa qayıt", en: "Back to search" },

  // pagination
  "pagination.prev": { ru: "Назад", az: "Geri", en: "Back" },
  "pagination.next": { ru: "Вперёд", az: "İrəli", en: "Next" },
  "pagination.page": { ru: "Страница", az: "Səhifə", en: "Page" },
  "pagination.of": { ru: "из", az: "dən", en: "of" },

  // auth / register / account (Step 1.9 — RU/AZ/EN auth UI)
  "nav.register": { ru: "Регистрация", az: "Qeydiyyat", en: "Register" },
  "nav.account": { ru: "Аккаунт", az: "Hesab", en: "Account" },
  "auth.login_title": { ru: "Вход", az: "Daxil ol", en: "Sign in" },
  "auth.login_subtitle": {
    ru: "Войдите, чтобы продолжить",
    az: "Davam etmək üçün daxil olun",
    en: "Sign in to continue",
  },
  "auth.email_label": { ru: "Email", az: "E-poçt", en: "Email" },
  "auth.username_label": { ru: "Логин", az: "İstifadəçi adı", en: "Username" },
  "auth.password_label": { ru: "Пароль", az: "Şifrə", en: "Password" },
  "auth.login_submit": { ru: "Войти", az: "Daxil ol", en: "Sign in" },
  "auth.login_busy": { ru: "Вход…", az: "Daxil olunur…", en: "Signing in…" },
  "auth.no_account": { ru: "Нет аккаунта?", az: "Hesabınız yoxdur?", en: "No account?" },
  "auth.register_link": { ru: "Зарегистрироваться", az: "Qeydiyyatdan keçin", en: "Create account" },
  "auth.has_account": { ru: "Уже есть аккаунт?", az: "Hesabınız var?", en: "Already have an account?" },
  "auth.login_link": { ru: "Войти", az: "Daxil ol", en: "Sign in" },
  "auth.demo_hint": { ru: "Демо-доступ", az: "Demo girişi", en: "Demo access" },
  "auth.back_marketplace": { ru: "← На витрину", az: "← Vitrinə", en: "← Back to marketplace" },
  "register.title": { ru: "Регистрация покупателя", az: "Alıcı qeydiyyatı", en: "Buyer registration" },
  "register.subtitle": {
    ru: "Личный аккаунт для покупки туристических услуг",
    az: "Turizm xidmətləri almaq üçün şəxsi hesab",
    en: "Personal account for booking travel services",
  },
  "register.first_name": { ru: "Имя", az: "Ad", en: "First name" },
  "register.last_name": { ru: "Фамилия", az: "Soyad", en: "Last name" },
  "register.password_confirm": { ru: "Повторите пароль", az: "Şifrəni təkrarlayın", en: "Confirm password" },
  "register.password_mismatch": { ru: "Пароли не совпадают", az: "Şifrələr uyğun gəlmir", en: "Passwords do not match" },
  "register.submit": { ru: "Создать аккаунт", az: "Hesab yarat", en: "Create account" },
  "register.busy": { ru: "Создание…", az: "Yaradılır…", en: "Creating…" },
  "register.by_registering": {
    ru: "Регистрация создаёт учётную запись покупателя (BUYER).",
    az: "Qeydiyyat alıcı (BUYER) hesabı yaradır.",
    en: "Registration creates a buyer (BUYER) account.",
  },
  "account.title": { ru: "Аккаунт", az: "Hesab", en: "Account" },
  "account.overview": { ru: "Обзор", az: "Ümumi baxış", en: "Overview" },
  "account.profile": { ru: "Профиль", az: "Profil", en: "Profile" },
  "account.role": { ru: "Роль", az: "Rol", en: "Role" },
  "account.status": { ru: "Статус", az: "Status", en: "Status" },
  "account.customer_ref": { ru: "Клиентская карточка", az: "Müştəri kartı", en: "Customer card" },
  "account.field.first_name": { ru: "Имя", az: "Ad", en: "First name" },
  "account.field.last_name": { ru: "Фамилия", az: "Soyad", en: "Last name" },
  "account.field.full_name": { ru: "Имя и фамилия", az: "Ad və soyad", en: "Full name" },
  "account.field.email": { ru: "Email", az: "E-poçt", en: "Email" },
  "account.field.phone": { ru: "Телефон", az: "Telefon", en: "Phone" },
  "account.field.username": { ru: "Логин", az: "İstifadəçi adı", en: "Username" },
  "account.save": { ru: "Сохранить", az: "Yadda saxla", en: "Save" },
  "account.saving": { ru: "Сохранение…", az: "Saxlanılır…", en: "Saving…" },
  "account.saved": { ru: "Сохранено", az: "Saxlanıldı", en: "Saved" },
  "account.updated_hint": {
    ru: "Изменения профиля применяются к вашей учётной записи.",
    az: "Profil dəyişiklikləri hesabınıza tətbiq edilir.",
    en: "Profile changes apply to your account.",
  },
  "account.buyer_placeholder": {
    ru: "Здесь появятся ваши заказы и бронирования в следующих шагах.",
    az: "Sifarişləriniz və bronlarınız növbəti addımlarda görünəcək.",
    en: "Your orders and bookings will appear here in upcoming steps.",
  },

  // ── Buyer Cabinet (Step 1.13) ─────────────────────────────────────────────
  "account.menu": { ru: "Меню", az: "Menyu", en: "Menu" },
  "account.buyer_summary": { ru: "Покупатель", az: "Alıcı", en: "Buyer" },
  "account.orders": { ru: "Заказы", az: "Sifarişlər", en: "Orders" },
  "account.bookings": { ru: "Бронирования", az: "Bronlar", en: "Bookings" },
  "account.payments": { ru: "Платежи", az: "Ödənişlər", en: "Payments" },
  "account.documents": { ru: "Документы", az: "Sənədlər", en: "Documents" },
  "account.support": { ru: "Поддержка", az: "Dəstək", en: "Support" },
  "account.orders_title": { ru: "Мои заказы", az: "Sifarişlərim", en: "My orders" },
  "account.bookings_title": { ru: "Мои бронирования", az: "Bronlarım", en: "My bookings" },
  "account.payments_title": { ru: "Мои платежи", az: "Ödənişlərim", en: "My payments" },
  "account.documents_title": { ru: "Мои документы", az: "Sənədlərim", en: "My documents" },
  "account.support_title": { ru: "Поддержка", az: "Dəstək", en: "Support" },
  "account.purchase_sections": { ru: "Покупки", az: "Alış-veriş", en: "Purchases" },
  "account.not_yet": {
    ru: "Раздел станет доступен в следующих шагах.",
    az: "Bölmə növbəti addımlarda əlçatan olacaq.",
    en: "This section will become available in upcoming steps.",
  },
  "account.orders_empty": { ru: "Заказов пока нет", az: "Hələ sifariş yoxdur", en: "No orders yet" },
  "account.bookings_empty": { ru: "Бронирований пока нет", az: "Hələ bron yoxdur", en: "No bookings yet" },
  "account.payments_empty": { ru: "Платежей пока нет", az: "Hələ ödəniş yoxdur", en: "No payments yet" },
  "account.documents_empty": { ru: "Документов пока нет", az: "Hələ sənəd yoxdur", en: "No documents yet" },
  "account.support_empty": { ru: "Обращений пока нет", az: "Hələ müraciət yoxdur", en: "No support requests yet" },
  "account.orders_empty_hint": {
    ru: "Когда вы оформите заказ, он появится здесь.",
    az: "Sifariş verdikdə burada görünəcək.",
    en: "When you place an order it will appear here.",
  },
  "account.bookings_empty_hint": {
    ru: "Бронирования появятся здесь после оформления заказа.",
    az: "Bronlar sifarişdən sonra burada görünəcək.",
    en: "Bookings will appear here after you place an order.",
  },
  "account.profile_completeness": { ru: "Заполненность профиля", az: "Profil tamlığı", en: "Profile completeness" },
  "account.profile_complete": { ru: "Профиль заполнен", az: "Profil tamamlandı", en: "Profile complete" },
  "account.profile_partial": {
    ru: "Дополните данные в разделе «Профиль».",
    az: "«Profil» bölməsində məlumatları tamamlayın.",
    en: "Complete your details in the Profile section.",
  },
  // Order list columns
  "account.order_code": { ru: "Заказ", az: "Sifariş", en: "Order" },
  "account.order_status": { ru: "Статус", az: "Status", en: "Status" },
  "account.order_payment": { ru: "Оплата", az: "Ödəniş", en: "Payment" },
  "account.order_amount": { ru: "Сумма", az: "Məbləğ", en: "Amount" },
  "account.order_created": { ru: "Создан", az: "Yaradılıb", en: "Created" },
  "account.order_service_date": { ru: "Дата услуги", az: "Xidmət tarixi", en: "Service date" },
  "account.booking_order": { ru: "Заказ", az: "Sifariş", en: "Order" },
  "account.booking_status": { ru: "Статус", az: "Status", en: "Status" },
  "account.booking_amount": { ru: "Сумма", az: "Məbləğ", en: "Amount" },
  "account.booking_service_date": { ru: "Дата услуги", az: "Xidmət tarixi", en: "Service date" },
  "account.booking_created": { ru: "Создано", az: "Yaradılıb", en: "Created" },

  // ── Order/Booking/Payment statuses (локализованные статусы, §21) ──────────
  "status.order.NEW": { ru: "Новый", az: "Yeni", en: "New" },
  "status.order.IN_PROCESSING": { ru: "В обработке", az: "Emal olunur", en: "In processing" },
  "status.order.WAITING_FOR_DATA": { ru: "Ожидание данных", az: "Məlumat gözlənilir", en: "Waiting for data" },
  "status.order.READY_FOR_BOOKING": { ru: "Готов к бронированию", az: "Bronlaşdırmaya hazır", en: "Ready for booking" },
  "status.order.SENT_TO_BOOKING": { ru: "Отправлен в бронирование", az: "Bronlaşdırmaya göndərilib", en: "Sent to booking" },
  "status.order.PARTIALLY_FULFILLED": { ru: "Частично выполнен", az: "Qismən icra olunub", en: "Partially fulfilled" },
  "status.order.FULFILLED": { ru: "Выполнен", az: "İcra olunub", en: "Fulfilled" },
  "status.order.READY_TO_CLOSE": { ru: "Готов к закрытию", az: "Bağlanmağa hazır", en: "Ready to close" },
  "status.order.CLOSED": { ru: "Закрыт", az: "Bağlanıb", en: "Closed" },
  "status.order.CANCELLED": { ru: "Отменён", az: "Ləğv edilib", en: "Cancelled" },
  "status.order.PROBLEM": { ru: "Проблема", az: "Problem", en: "Problem" },
  "status.order.SUSPENDED": { ru: "Приостановлен", az: "Dayandırılıb", en: "Suspended" },
  "status.payment.UNPAID": { ru: "Не оплачен", az: "Ödənilməyib", en: "Unpaid" },
  "status.payment.PARTIALLY_PAID": { ru: "Оплачен частично", az: "Qismən ödənilib", en: "Partially paid" },
  "status.payment.PAID": { ru: "Оплачен", az: "Ödənilib", en: "Paid" },
  "status.payment.REFUNDED": { ru: "Возврат", az: "Geri qaytarılıb", en: "Refunded" },
  "status.booking.NEW": { ru: "Новая", az: "Yeni", en: "New" },
  "status.booking.PREPARING_REQUEST": { ru: "Подготовка запроса", az: "Sorğu hazırlanır", en: "Preparing request" },
  "status.booking.SENT_TO_SUPPLIER": { ru: "Отправлен поставщику", az: "Təchizatçıya göndərilib", en: "Sent to supplier" },
  "status.booking.AWAITING_CONFIRMATION": { ru: "Ожидание подтверждения", az: "Təsdiq gözlənilir", en: "Awaiting confirmation" },
  "status.booking.CONFIRMED": { ru: "Подтверждено", az: "Təsdiqlənib", en: "Confirmed" },
  "status.booking.IN_SERVICE": { ru: "В услуге", az: "Xidmətdə", en: "In service" },
  "status.booking.COMPLETED": { ru: "Завершено", az: "Tamamlanıb", en: "Completed" },
  "status.booking.NEEDS_CLARIFICATION": { ru: "Нужно уточнение", az: "Dəqiqləşdirmə tələb olunur", en: "Needs clarification" },
  "status.booking.SUPPLIER_REJECTED": { ru: "Поставщик отклонил", az: "Təchizatçı rədd edib", en: "Rejected by supplier" },
  "status.booking.CHANGE_REQUESTED": { ru: "Запрошено изменение", az: "Dəyişiklik tələb olunub", en: "Change requested" },
  "status.booking.CANCELLATION_REQUESTED": { ru: "Запрошена отмена", az: "Ləğv tələb olunub", en: "Cancellation requested" },
  "status.booking.CANCELLED": { ru: "Отменено", az: "Ləğv edilib", en: "Cancelled" },
  "status.booking.PROBLEM": { ru: "Проблема", az: "Problem", en: "Problem" },

  // partner onboarding (Step 1.10)
  "nav.become_partner": { ru: "Для партнёров", az: "Tərəfdaşlar üçün", en: "Become a partner" },
  "partner.nav.onboarding": { ru: "Onboarding", az: "Onbording", en: "Onboarding" },
  "partner.reg_title": { ru: "Регистрация партнёра", az: "Tərəfdaş qeydiyyatı", en: "Partner registration" },
  "partner.reg_subtitle": {
    ru: "Расскажите о вашем бизнесе — после проверки вы получите доступ к кабинету партнёра.",
    az: "Biznesiniz haqqında məlumat verin — yoxlamadan sonra tərəfdaş kabinetinə giriş əldə edəcəksiniz.",
    en: "Tell us about your business — after review you get access to the Partner Cabinet.",
  },
  "partner.reg_notice": {
    ru: "Регистрация ≠ одобрение. Продажи откроются только после проверки заявки.",
    az: "Qeydiyyat ≠ təsdiq. Satış yalnız müraciət yoxlanıldıqdan sonra açılır.",
    en: "Registration ≠ approval. Selling unlocks only after application review.",
  },
  "partner.identity_section": { ru: "Учётная запись", az: "Hesab", en: "Account" },
  "partner.business_section": { ru: "Бизнес", az: "Biznes", en: "Business" },
  "partner.applicant_type": { ru: "Тип заявителя", az: "Müraciət edənin növü", en: "Applicant type" },
  "partner.type_individual": { ru: "Индивидуальный предприниматель", az: "Fərdi sahibkar", en: "Individual" },
  "partner.type_company": { ru: "Компания", az: "Şirkət", en: "Company" },
  "partner.country": { ru: "Страна", az: "Ölkə", en: "Country" },
  "partner.brand_name": { ru: "Бренд / название", az: "Brend / ad", en: "Brand / name" },
  "partner.legal_name": { ru: "Юридическое название", az: "Hüquqi ad", en: "Legal name" },
  "partner.registration_number": { ru: "Регистрационный номер", az: "Qeydiyyat nömrəsi", en: "Registration number" },
  "partner.tax_id": { ru: "Налоговый номер (INN/TAX ID)", az: "Vergi nömrəsi", en: "Tax ID" },
  "partner.contact_email": { ru: "Контактный email", az: "Əlaqə e-poçtu", en: "Contact email" },
  "partner.contact_phone": { ru: "Телефон", az: "Telefon", en: "Phone" },
  "partner.website": { ru: "Сайт", az: "Vebsayt", en: "Website" },
  "partner.address": { ru: "Адрес", az: "Ünvan", en: "Address" },
  "partner.business_description": { ru: "Описание бизнеса", az: "Biznes təsviri", en: "Business description" },
  "partner.service_categories": { ru: "Категории услуг", az: "Xidmət kateqoriyaları", en: "Service categories" },
  "partner.categories_hint": {
    ru: "Какие категории вы планируете продавать? Это данные для заявки, не привязка продуктов.",
    az: "Hansı kateqoriyaları satmağı planlaşdırırsınız? Bu müraciət üçün məlumatdır.",
    en: "Which categories do you plan to sell? Onboarding metadata, not product ownership.",
  },
  "partner.terms_label": {
    ru: "Я принимаю условия партнёрского соглашения TravelHub и подтверждаю достоверность данных.",
    az: "TravelHub tərəfdaşlıq şərtlərini qəbul edirəm və məlumatların doğruluğunu təsdiq edirəm.",
    en: "I accept the TravelHub partner terms and confirm the data is accurate.",
  },
  "partner.terms_required": { ru: "Необходимо принять условия", az: "Şərtləri qəbul etmək lazımdır", en: "Terms must be accepted" },
  "partner.reg_submit": { ru: "Подать заявку", az: "Müraciət göndər", en: "Submit application" },
  "partner.reg_busy": { ru: "Отправка…", az: "Göndərilir…", en: "Submitting…" },
  "partner.onboarding_title": { ru: "Onboarding партнёра", az: "Tərəfdaş onbordinqi", en: "Partner onboarding" },
  "partner.onboarding_hint": {
    ru: "Статус вашей заявки на регистрацию продавца.",
    az: "Satıcı qeydiyyatı müraciətinizin statusu.",
    en: "Status of your seller registration application.",
  },
  "partner.status_draft": { ru: "Черновик", az: "Qaralama", en: "Draft" },
  "partner.status_submitted": { ru: "На проверке", az: "Yoxlanılır", en: "Submitted" },
  "partner.status_in_review": { ru: "В работе", az: "Baxılır", en: "In review" },
  "partner.status_approved": { ru: "Одобрено", az: "Təsdiqləndi", en: "Approved" },
  "partner.status_rejected": { ru: "Отклонено", az: "Rədd edildi", en: "Rejected" },
  "partner.status_changes_requested": { ru: "Требуются правки", az: "Düzəliş tələb olunur", en: "Changes requested" },
  "partner.status_cancelled": { ru: "Отменено", az: "Ləğv edildi", en: "Cancelled" },
  "partner.review_feedback": { ru: "Комментарий проверки:", az: "Yoxlama şərhi:", en: "Review feedback:" },
  "partner.go_cabinet": { ru: "В кабинет партнёра", az: "Tərəfdaş kabinetinə", en: "Open Partner Cabinet" },
  "partner.edit_application": { ru: "Редактировать", az: "Redaktə et", en: "Edit" },
  "partner.submit_application": { ru: "Отправить на проверку", az: "Yoxlamaya göndər", en: "Submit for review" },
  "partner.submitted_ok": { ru: "Заявка отправлена на проверку.", az: "Müraciət yoxlamaya göndərildi.", en: "Application submitted for review." },
  "partner.readonly_hint": {
    ru: "Заявка на рассмотрении. Редактирование недоступно до решения проверяющего.",
    az: "Müraciət baxılır. Redaktə yoxlama qərarına qədər mümkün deyil.",
    en: "Application under review. Editing is locked until the reviewer decides.",
  },
  "partner.history_title": { ru: "История", az: "Tarixçə", en: "History" },
  "partner.edit_title": { ru: "Редактирование заявки", az: "Müraciətin redaktəsi", en: "Edit application" },
  "partner.edit_hint": {
    ru: "Изменения сохраняются черновиком; отправьте заявку заново, когда будете готовы.",
    az: "Dəyişikliklər qaralama kimi saxlanılır; hazır olduqda yenidən göndərin.",
    en: "Changes are saved as a draft; resubmit when ready.",
  },
  "partner.back_status": { ru: "К статусу", az: "Statusa qayıt", en: "Back to status" },
  "partner.cancel": { ru: "Отмена", az: "Ləğv et", en: "Cancel" },
  "partner.review_title": { ru: "Заявки партнёров", az: "Tərəfdaş müraciətləri", en: "Partner applications" },
  "partner.review_subtitle": { ru: "Очередь onboarding-заявок (не Product moderation)", az: "Onbordinq müraciət növbəsi", en: "Onboarding review queue (not product moderation)" },
  "partner.review_queue": { ru: "Очередь", az: "Növbə", en: "Queue" },
  "partner.review_search": { ru: "Поиск…", az: "Axtar…", en: "Search…" },
  "partner.review_empty": { ru: "Заявок в очереди нет", az: "Növbədə müraciət yoxdur", en: "Queue is empty" },
  "partner.review_detail": { ru: "Детали заявки", az: "Müraciət detalları", en: "Application detail" },
  "partner.review_select_hint": { ru: "Выберите заявку из очереди", az: "Növbədən müraciət seçin", en: "Select an application from the queue" },
  "partner.review_start": { ru: "Взять в работу", az: "Baxışa başla", en: "Start review" },
  "partner.review_approve": { ru: "Одобрить", az: "Təsdiqlə", en: "Approve" },
  "partner.review_reject": { ru: "Отклонить", az: "Rədd et", en: "Reject" },
  "partner.review_request_changes": { ru: "Запросить правки", az: "Düzəliş tələb et", en: "Request changes" },
  "partner.review_confirm": { ru: "Подтвердить", az: "Təsdiqlə", en: "Confirm" },
  "partner.reason_required": { ru: "Укажите причину (мин. 3 символа)", az: "Səbəb göstərin (min 3 simvol)", en: "Provide a reason (min 3 chars)" },
  "partner.reason_placeholder": { ru: "Причина решения…", az: "Qərarın səbəbi…", en: "Reason for decision…" },

  // footer
  "footer.text": {
    ru: "TravelHub — каталог туристических услуг. Marketplace.",
    az: "TravelHub — turizm xidmətləri kataloqu. Vitrin.",
    en: "TravelHub — travel services catalog. Marketplace.",
  },

  // ── Step 1.12.2 — Public Storefront site labels (Storefront-контекст) ─────
  "storefront.products": { ru: "Услуги", az: "Xidmətlər", en: "Services" },
  "storefront.contacts": { ru: "Контакты", az: "Əlaqə", en: "Contacts" },
  "storefront.about": { ru: "О бизнесе", az: "Biznes haqqında", en: "About the business" },
  "storefront.view_products": { ru: "Смотреть услуги", az: "Xidmətlərə bax", en: "View services" },
  "storefront.visit_site": { ru: "Сайт бизнеса", az: "Biznes saytı", en: "Business website" },
  "storefront.no_products": { ru: "Услуг пока нет.", az: "Hələ xidmət yoxdur.", en: "No services yet." },
  "storefront.powered_by": { ru: "Сайт создан на", az: "Sayt hazırlanıb", en: "Site powered by" },
  "storefront.back_home": { ru: "На главную витрины", az: "Vitrinin əsas səhifəsinə", en: "Back to storefront home" },
  "storefront.product_not_found_hint": {
    ru: "Услуга не найдена или недоступна на этой витрине.",
    az: "Xidmət tapılmadı və ya bu vitrində mövcud deyil.",
    en: "Product not found or unavailable on this storefront.",
  },
  // ── Command Center (Step 3.2 Stage B) ──────────────────────────────────
  "cc.title": { ru: "Command Center", az: "İdarəetmə Mərkəzi", en: "Command Center" },
  "cc.subtitle": { ru: "Агрегированные данные Marketplace", az: "Bazar yerinin aggreqasiya olunmuş məlumatları", en: "Aggregated marketplace data" },
  "cc.loading": { ru: "Загрузка данных…", az: "Məlumatlar yüklənir…", en: "Loading data…" },
  "cc.customize": { ru: "Настроить", az: "Tənzimlə", en: "Customize" },
  "cc.cancel": { ru: "Отмена", az: "Ləğv", en: "Cancel" },
  "cc.save": { ru: "Сохранить", az: "Saxla", en: "Save" },
  "cc.reset": { ru: "Сбросить", az: "Sıfırla", en: "Reset" },
  "cc.access_denied": { ru: "Доступ запрещён", az: "Giriş qadağandır", en: "Access denied" },
  "cc.access_denied_hint": { ru: "У вас нет прав analytics.read для доступа к Command Center.", az: "Command Center-ə giriş üçün analytics.read hüququ yoxdur.", en: "You need analytics.read permission to access Command Center." },
  "cc.auth_required": { ru: "Требуется авторизация", az: "Autentifikasiya tələb olunur", en: "Authentication required" },
  "cc.auth_hint": { ru: "Войдите, чтобы получить доступ к Command Center.", az: "Command Center-ə girmək üçün daxil olun.", en: "Sign in to access Command Center." },
  "cc.no_sections": { ru: "Нет доступных разделов. Обратитесь к администратору для настройки прав доступа.", az: "Əlçatan bölmələr yoxdur. Giriş hüquqlarını tənzimləmək üçün administratora müraciət edin.", en: "No available sections. Contact an administrator to configure access permissions." },
  "cc.update_error": { ru: "Ошибка обновления", az: "Yenilənmə xətası", en: "Update error" },
  "cc.layout_unavailable": { ru: "Персональный layout временно недоступен. Показан безопасный read-only режим.", az: "Şəxsi layout müvəqqəti olaraq əlçatan deyil. Təhlükəsiz read-only rejim göstərilir.", en: "Personal layout temporarily unavailable. Showing safe read-only mode." },
  "cc.retry": { ru: "Повторить", az: "Yenidən cəhd et", en: "Retry" },
  "cc.readonly_fallback": { ru: "Layout недоступен — показаны разрешённые данные без настройки.", az: "Layout əlçatandır — icazə verilən məlumatlar tənzimləmə olmadan göstərilir.", en: "Layout unavailable — showing authorized data without customization." },
  "cc.period": { ru: "Период", az: "Dövr", en: "Period" },
  "cc.comparison": { ru: "Сравнение", az: "Müqayisə", en: "Comparison" },
  "cc.no_data": { ru: "Нет данных за выбранный период", az: "Seçilmiş dövr üçün məlumat yoxdur", en: "No data for the selected period" },
  "cc.trend_unsupported": { ru: "Метрика пока не поддерживается backend", az: "Metrika hələ backend tərəfindən dəstəklənmir", en: "Metric not yet supported by backend" },
  "cc.trend_no_access": { ru: "Нет доступа к этой метрике", az: "Bu metrikaya giriş yoxdur", en: "No access to this metric" },
  "cc.trend_error": { ru: "Ошибка загрузки тренда", az: "Trend yükləmə xətası", en: "Failed to load trend" },
  "cc.drag_hint": { ru: "Перетаскивайте для изменения порядка. Клавиша Enter для переупорядочивания.", az: "Sıralamaq üçün sürükləyin. Enter düyməsi ilə dəyişin.", en: "Drag to reorder. Press Enter to reorder." },
  "cc.widget_drag": { ru: "Перетащить", az: "Sürüklə", en: "Drag" },
  "cc.widget_hide": { ru: "Скрыть виджет", az: "Vidgeti gizlət", en: "Hide widget" },
  "cc.widget_show": { ru: "Показать виджет", az: "Vidgeti göstər", en: "Show widget" },
  "cc.widget_remove": { ru: "Удалить виджет", az: "Vidgeti sil", en: "Remove widget" },
  "cc.widget_required": { ru: "(обязательный)", az: "(məcburi)", en: "(required)" },
  "cc.add_widget": { ru: "+ Добавить виджет", az: "+ Vidget əlavə et", en: "+ Add widget" },
  "cc.hide_available": { ru: "Скрыть доступные", az: "Əlçatanları gizlət", en: "Hide available" },
  "cc.all_added": { ru: "Все доступные виджеты уже добавлены", az: "Bütün əlçatan vidgetlər artıq əlavə edilib", en: "All available widgets are already added" },
  "cc.layout_settings": { ru: "Настройка макета", az: "Tərtibat tənzimləməsi", en: "Layout settings" },
  // sidebar navigation
  "nav.dashboard": { ru: "Рабочий стол", az: "İş masası", en: "Dashboard" },
  "nav.command_center": { ru: "Command Center", az: "İdarəetmə mərkəzi", en: "Command Center" },
  "nav.catalog": { ru: "Каталог", az: "Kataloq", en: "Catalog" },
  "nav.orders": { ru: "Заказы", az: "Sifarişlər", en: "Orders" },
  "nav.bookings": { ru: "Бронирования", az: "Bronlar", en: "Bookings" },
  "nav.crm": { ru: "CRM", az: "CRM", en: "CRM" },
  "nav.partner_onboarding": { ru: "Партнёры (онбординг)", az: "Tərəfdaşlar (onboarding)", en: "Partners (onboarding)" },
  "nav.seller_profiles": { ru: "Продавцы", az: "Satıcılar", en: "Sellers" },
  "nav.users": { ru: "Пользователи", az: "İstifadəçilər", en: "Users" },
  "cc_utc": { ru: "UTC", az: "UTC", en: "UTC" },
  // section names
  "cc.section.executive": { ru: "Сводные показатели", az: "İdarəetmə Xülasəsi", en: "Executive Summary" },
  "cc.section.operational": { ru: "Операционная деятельность", az: "Əməliyyat fəaliyyəti", en: "Operational Activity" },
  "cc.section.financial": { ru: "Финансы", az: "Maliyyə", en: "Financial" },
  "cc.section.marketplace": { ru: "Маркетплейс", az: "Bazar yeri", en: "Marketplace" },
  // V3 sections
  "cc.section.catalog": { ru: "Здоровье каталога", az: "Kataloq saglamligi", en: "Catalog Health" },
  "cc.section.channels": { ru: "Здоровье каналов", az: "Kanal saglamligi", en: "Channel Health" },
  "cc.section.attention": { ru: "Требует внимания", az: "Diqqet teleb edir", en: "Needs Attention" },
  "cc.section.insights": { ru: "Лента решений ИИ", az: "AI Qərar Lentesi", en: "AI Decision Feed" },
  // V3 KPI labels — Catalog Health
  "cc.v3.catalog.publishedServices": { ru: "Опубликованные услуги", az: "Dərc olunmus xidmetler", en: "Published Services" },
  "cc.v3.catalog.archivedServices": { ru: "Архивные услуги", az: "Arxiv xidmetler", en: "Archived Services" },
  "cc.v3.catalog.servicesWithoutSales": { ru: "Без продаж", az: "Satis olmadan", en: "Without Sales" },
  "cc.v3.catalog.highDemandServices": { ru: "Высокий спрос", az: "Yuksek telebat", en: "High Demand" },
  "cc.v3.catalog.lowConversionServices": { ru: "Низкая конверсия", az: "Asagi konversiya", en: "Low Conversion" },
  "cc.v3.catalog.totalCategories": { ru: "Категории", az: "Kateqoriyalar", en: "Categories" },
  // V3 KPI labels — Channel Health
  "cc.v3.channels.marketplaceGmv": { ru: "GMV Marketplace", az: "GMV Marketplace", en: "GMV Marketplace" },
  "cc.v3.channels.storefrontGmv": { ru: "GMV Storefront", az: "GMV Storefront", en: "GMV Storefront" },
  "cc.v3.channels.marketplaceRevenue": { ru: "Выручка Marketplace", az: "Marketplace gəliri", en: "Marketplace Revenue" },
  "cc.v3.channels.storefrontRevenue": { ru: "Подписки Storefront", az: "Storefront abunəlikləri", en: "Storefront Subscriptions" },
  "cc.v3.channels.marketplaceOrders": { ru: "Заказы Marketplace", az: "Marketplace sifarişləri", en: "Marketplace Orders" },
  "cc.v3.channels.storefrontOrders": { ru: "Заказы Storefront", az: "Storefront sifarişləri", en: "Storefront Orders" },
  "cc.v3.channels.marketplaceConversion": { ru: "Конверсия Marketplace", az: "Marketplace konvertsiyası", en: "Marketplace Conversion" },
  "cc.v3.channels.storefrontConversion": { ru: "Конверсия Storefront", az: "Storefront konvertsiyası", en: "Storefront Conversion" },
  // V3 KPI labels — Needs Attention
  "cc.v3.attention.pendingConfirmations": { ru: "Ожидают подтверждения", az: "Təsdiq gözləyir", en: "Pending Confirmations" },
  "cc.v3.attention.failedPayments": { ru: "Неудачные платежи", az: "Ugursuz odenisler", en: "Failed Payments" },
  "cc.v3.attention.cancellations": { ru: "Отмены (7 дн.)", az: "Ləğvetmələr (7 gun)", en: "Cancellations (7d)" },
  "cc.v3.attention.pendingRefunds": { ru: "Ожидают возврата", az: "Geri qaytarma gozleyir", en: "Pending Refunds" },
  "cc.v3.attention.upcomingBookings": { ru: "Будущие бронирования", az: "Gələcək bronlar", en: "Upcoming Bookings" },
  "cc.v3.attention.servicesWithoutSales": { ru: "Услуги без продаж", az: "Satis olmadan xidmetler", en: "Services Without Sales" },
  // Decision Queue — Signal titles
  "cc.queue.title": { ru: "Очередь решений", az: "Qərar növbəsi", en: "Decision Queue" },
  "cc.queue.active": { ru: "Активные", az: "Aktiv", en: "Active" },
  "cc.queue.history": { ru: "История", az: "Tarixçə", en: "History" },
  "cc.queue.empty": { ru: "Нет ситуаций, требующих внимания", az: "Diqqət tələb edən vəziyyət yoxdur", en: "No situations requiring attention" },
  "cc.queue.open": { ru: "Открыт", az: "Açıq", en: "Open" },
  "cc.queue.acknowledged": { ru: "Принято к сведению", az: "Qeydə alındı", en: "Acknowledged" },
  "cc.queue.resolved": { ru: "Решено", az: "Həll edildi", en: "Resolved" },
  "cc.queue.dismissed": { ru: "Отклонено", az: "Rədd edildi", en: "Dismissed" },
  "cc.queue.slaBreached": { ru: "Нарушен SLA", az: "SLA pozulub", en: "SLA Breached" },
  "cc.queue.acknowledge": { ru: "Принять", az: "Qəbul et", en: "Acknowledge" },
  "cc.queue.resolve": { ru: "Решить", az: "Həll et", en: "Resolve" },
  "cc.queue.dismiss": { ru: "Отклонить", az: "Rədd et", en: "Dismiss" },
  "cc.queue.detected": { ru: "Обнаружено", az: "Aşkar edildi", en: "Detected" },
  "cc.queue.lastObserved": { ru: "Последнее наблюдение", az: "Son müşahidə", en: "Last observed" },
  "cc.queue.observations": { ru: "Наблюдений", az: "Müşahidələr", en: "Observations" },
  "cc.queue.entities": { ru: "Объектов", az: "Obyektlər", en: "Entities" },
  // Stage F — Actions
  "cc.action.title": { ru: "Действия", az: "Əməliyyatlar", en: "Actions" },
  "cc.action.openDelayedBookings": { ru: "Открыть бронирования", az: "Bronları aç", en: "Open bookings" },
  "cc.action.openDelayedBookings.desc": { ru: "Просмотреть задержанные бронирования", az: "Gecikdirilmiş bronları nəzərdən keçirin", en: "Review delayed bookings" },
  "cc.action.openFailedPayments": { ru: "Открыть платежи", az: "Ödənişləri aç", en: "Open payments" },
  "cc.action.openFailedPayments.desc": { ru: "Просмотреть неуспешные платежи", az: "Uğursuz ödənişləri nəzərdən keçirin", en: "Review failed payments" },
  "cc.action.openCancelledOrders": { ru: "Открыть заказы", az: "Sifarişləri aç", en: "Open orders" },
  "cc.action.openCancelledOrders.desc": { ru: "Просмотреть отменённые заказы", az: "Ləğv edilmiş sifarişləri nəzərdən keçirin", en: "Review cancelled orders" },
  "cc.action.openPendingRefunds": { ru: "Открыть возвраты", az: "Geri qaytarmaları aç", en: "Open refunds" },
  "cc.action.openPendingRefunds.desc": { ru: "Просмотреть ожидающие возвраты", az: "Gözləyən geri qaytarmaları nəzərdən keçirin", en: "Review pending refunds" },
  "cc.action.openUpcomingBookings": { ru: "Открыть предстоящие", az: "Gələcəkləri aç", en: "Open upcoming" },
  "cc.action.openUpcomingBookings.desc": { ru: "Просмотреть предстоящие бронирования", az: "Gələcək bronları nəzərdən keçirin", en: "Review upcoming bookings" },
  "cc.action.openUnsoldServices": { ru: "Открыть услуги", az: "Xidmətləri aç", en: "Open services" },
  "cc.action.openUnsoldServices.desc": { ru: "Просмотреть услуги без продаж", az: "Satışı olmayan xidmətləri nəzərdən keçirin", en: "Review services without sales" },
  "cc.action.reviewAvailability": { ru: "Проверить доступность", az: "Əlçatanlığı yoxla", en: "Review availability" },
  "cc.action.reviewAvailability.desc": { ru: "{count} услуг без настроенной доступности", az: "{count} xidmət tənzimlənmiş əlçatanlıq olmadan", en: "{count} services without availability" },
  // Signal code → title keys
  "cc.signal.title.BOOKING_CONFIRMATION_DELAY": { ru: "Задержка подтверждения бронирований", az: "Bron təsdiqi gecikməsi", en: "Booking Confirmation Delay" },
  "cc.signal.title.FAILED_PAYMENTS": { ru: "Неуспешные платежи", az: "Uğursuz ödənişlər", en: "Failed Payments" },
  "cc.signal.title.RECENT_CANCELLATIONS": { ru: "Недавние отмены заказов", az: "Son ləğvetmələr", en: "Recent Cancellations" },
  "cc.signal.title.PENDING_REFUNDS": { ru: "Ожидают обработки возвраты", az: "Geri qaytarma gözləyir", en: "Pending Refunds" },
  "cc.signal.title.UPCOMING_BOOKINGS": { ru: "Предстоящие бронирования", az: "Gələcək bronlar", en: "Upcoming Bookings" },
  "cc.signal.title.SERVICES_WITHOUT_SALES": { ru: "Услуги без продаж", az: "Satışı olmayan xidmətlər", en: "Services Without Sales" },
  // Signal code → description keys (with params)
  "cc.signal.desc.BOOKING_CONFIRMATION_DELAY": { ru: "{count} бронирований ожидают подтверждения", az: "{count} bron təsdiqi gözləyir", en: "{count} bookings awaiting confirmation" },
  "cc.signal.desc.FAILED_PAYMENTS": { ru: "{count} неуспешных платежей", az: "{count} uğursuz ödəniş", en: "{count} failed payments" },
  "cc.signal.desc.RECENT_CANCELLATIONS": { ru: "{count} отмен за последние 7 дней", az: "{count} son 7 gündə ləğv edilmə", en: "{count} cancellations in last 7 days" },
  "cc.signal.desc.PENDING_REFUNDS": { ru: "{count} возвратов ожидают обработки", az: "{count} geri qaytarma həll gözləyir", en: "{count} refunds awaiting processing" },
  "cc.signal.desc.UPCOMING_BOOKINGS": { ru: "{count} бронирований, ближайшее через {days} дн.", az: "{count} bron, ən yaxın {days} gün sonra", en: "{count} bookings, nearest in {days}d" },
  "cc.signal.desc.SERVICES_WITHOUT_SALES": { ru: "{count} опубликованных услуг без заказов", az: "{count} dərc olunmuş xidmət sifariş olmadan", en: "{count} published services without orders" },
  // Stage D — WHY Attribution
  "cc.why.title": { ru: "Причина", az: "Səbəb", en: "Why" },
  "cc.why.proven_cause": { ru: "Причина", az: "Səbəb", en: "Cause" },
  "cc.why.observed_driver": { ru: "Основной наблюдаемый фактор", az: "Əsas müşahidə olunan amil", en: "Primary observed factor" },
  "cc.why.contributing_factor": { ru: "Дополнительный фактор", az: "Əlavə amil", en: "Contributing factor" },
  "cc.why.insufficient": { ru: "Недостаточно данных для определения причины", az: "Səbəbi müəyyən etmək üçün kifayət qədər məlumat yoxdur", en: "Insufficient data to determine cause" },
  // WHY text keys — Booking
  "cc.why.booking_delay.driver": { ru: "Бронирования ожидают подтверждения сверх SLA", az: "Bronlar SLA-dan çox gözləyir", en: "Bookings awaiting confirmation beyond SLA" },
  "cc.why.booking_delay.factor_gmv": { ru: "Затронутый объём", az: "Təsir olunan həcm", en: "Affected volume" },
  // WHY text keys — Payments
  "cc.why.payment_failure.driver_dominant_method": { ru: "Доминирующий способ оплаты", az: "Dominant ödəniş üsulu", en: "Dominant payment method" },
  "cc.why.payment_failure.driver_count": { ru: "Зафиксированы неуспешные платежи", az: "Uğursuz ödənişlər qeydə alınıb", en: "Failed payments recorded" },
  "cc.why.payment_failure.factor_other_methods": { ru: "Другие способы оплаты", az: "Digər ödəniş üsulları", en: "Other payment methods" },
  // WHY text keys — Cancellations
  "cc.why.cancellation.driver_reason": { ru: "Доминирующая причина отмены", az: "Dominant ləğv səbəbi", en: "Dominant cancellation reason" },
  "cc.why.cancellation.driver_by": { ru: "Инициатор отмены", az: "Ləğv edən tərəf", en: "Cancelled by" },
  "cc.why.cancellation.factor_cancelled_by": { ru: "Распределение по инициаторам", az: "Ləğv edənlərə görə bölgü", en: "Distribution by canceller" },
  // WHY text keys — Services without sales
  "cc.why.unsold.driver_no_availability": { ru: "Опубликованы без настроенной доступности", az: "Tənzimlənmiş əlçatanlıq olmadan dərc olunub", en: "Published without configured availability" },
  "cc.why.unsold.driver_has_availability": { ru: "Опубликованы с настроенной доступностью", az: "Tənzimlənmiş əlçatanlıqla dərc olunub", en: "Published with configured availability" },
  "cc.why.unsold.factor_long_term": { ru: "Опубликованы более 30 дней без продаж", az: "30 gündən çoxdur satılmadan dərc olunub", en: "Published >30 days without sales" },
  "cc.why.unsold.factor_recent": { ru: "Опубликованы недавно", az: "Yeni dərc olunub", en: "Recently published" },
  // ── Evidence field labels (Decision Queue) ──
  "cc.evidence.pendingConfirmationCount": { ru: "Ожидают подтверждения", az: "Təsdiq gözləyir", en: "Awaiting confirmation" },
  "cc.evidence.oldestPendingMinutes": { ru: "Самое длительное ожидание", az: "Ən uzun gözləmə", en: "Longest wait" },
  "cc.evidence.affectedGmv": { ru: "Затронутый объём", az: "Təsir olunan həcm", en: "Affected volume" },
  "cc.evidence.slaThresholdMinutes": { ru: "Порог SLA", az: "SLA həddi", en: "SLA threshold" },
  "cc.evidence.failedCount": { ru: "Неуспешных платежей", az: "Uğursuz ödənişlər", en: "Failed payments" },
  "cc.evidence.oldestFailedMinutes": { ru: "Самый старый сбой", az: "Ən köhnə uğursuzluq", en: "Oldest failure" },
  "cc.evidence.totalFailedAmount": { ru: "Сумма неуспешных", az: "Uğursuzların məbləği", en: "Failed amount" },
  "cc.evidence.paymentMethodGroups": { ru: "Способы оплаты", az: "Ödəniş üsulları", en: "Payment methods" },
  "cc.evidence.cancellationCount": { ru: "Отмен", az: "Ləğv edilmələr", en: "Cancellations" },
  "cc.evidence.oldestCancellationMinutes": { ru: "Самая старая отмена", az: "Ən köhnə ləğv", en: "Oldest cancellation" },
  "cc.evidence.periodDays": { ru: "За период", az: "Dövr ərzində", en: "Over period" },
  "cc.evidence.pendingRefundCount": { ru: "Ожидают возврата", az: "Geri qaytarma gözləyir", en: "Pending refunds" },
  "cc.evidence.totalRefundAmount": { ru: "Сумма возвратов", az: "Geri qaytarma məbləği", en: "Refund amount" },
  "cc.evidence.upcomingCount": { ru: "Предстоящих бронирований", az: "Gələcək bronlar", en: "Upcoming bookings" },
  "cc.evidence.daysUntilNearest": { ru: "До ближайшего", az: "Ən yaxına qədər", en: "Until nearest" },
  "cc.evidence.totalUpcomingGmv": { ru: "Объём предстоящих", az: "Gələcək həcm", en: "Upcoming volume" },
  "cc.evidence.unsoldProductCount": { ru: "Услуг без заказов", az: "Satışı olmayan xidmətlər", en: "Services without orders" },
  "cc.evidence.withAvailabilityCount": { ru: "С доступностью", az: "Mövcudluqla", en: "With availability" },
  "cc.evidence.withoutAvailabilityCount": { ru: "Без доступности", az: "Mövcudluq olmadan", en: "Without availability" },
  "cc.evidence.availabilitySummary": { ru: "Доступность", az: "Əlçatanlıq", en: "Availability" },
  "cc.evidence.productNames": { ru: "Примеры услуг", az: "Xidmət nümunələri", en: "Example services" },
  "cc.evidence.recentlyPublishedCount": { ru: "Недавно опубликовано", az: "Yeni nəşr olunub", en: "Recently published" },
  "cc.evidence.longTermUnsoldCount": { ru: "Долгое время без продаж", az: "Uzun müddət satılmayıb", en: "Long-term unsold" },
  // ── Impact labels (Stage E) ──
  "cc.impact.title": { ru: "Влияние", az: "Təsir", en: "Impact" },
  "cc.impact.insufficient": { ru: "Недостаточно данных для оценки влияния", az: "Təsiri qiymətləndirmək üçün kifayət qədər məlumat yoxdur", en: "Insufficient data to assess impact" },
  "cc.impact.computation_error": { ru: "Ошибка расчёта влияния", az: "Təsir hesablama xətası", en: "Impact computation error" },
  // Stage E — Impact dimension labels per signal
  // Pending Bookings
  "cc.impact.pending_bookings.count": { ru: "Заблокированных бронирований", az: "Bloklanmış bronlar", en: "Blocked bookings" },
  "cc.impact.pending_bookings.gmv": { ru: "GMV затронутых заказов", az: "Təsir olunan sifarişlərin GMV-si", en: "Affected orders GMV" },
  "cc.impact.pending_bookings.sla_breach": { ru: "{count} превысили SLA", az: "{count} SLA-nı keçdi", en: "{count} breached SLA" },
  "cc.impact.pending_bookings.oldest_wait": { ru: "Самое длительное ожидание", az: "Ən uzun gözləmə", en: "Longest wait" },
  "cc.impact.pending_bookings.summary": { ru: "{count} бронирований ожидают подтверждения", az: "{count} bron təsdiqi gözləyir", en: "{count} bookings awaiting confirmation" },
  // Failed Payments
  "cc.impact.failed_payments.count": { ru: "Неуспешных платежей", az: "Uğursuz ödənişlər", en: "Failed payments" },
  "cc.impact.failed_payments.amount": { ru: "Сумма неуспешных попыток", az: "Uğursuz cəhdlərin məbləği", en: "Failed attempts amount" },
  "cc.impact.failed_payments.methods": { ru: "Способы оплаты", az: "Ödəniş üsulları", en: "Payment methods" },
  "cc.impact.failed_payments.oldest": { ru: "Самый старый сбой", az: "Ən köhnə uğursuzluq", en: "Oldest failure" },
  "cc.impact.failed_payments.summary": { ru: "{count} неуспешных платежей", az: "{count} uğursuz ödəniş", en: "{count} failed payments" },
  // Recent Cancellations
  "cc.impact.recent_cancellations.count": { ru: "Отменённых заказов", az: "Ləğv edilmiş sifarişlər", en: "Cancelled orders" },
  "cc.impact.recent_cancellations.gmv": { ru: "Стоимость отменённых заказов", az: "Ləğv edilmiş sifarişlərin dəyəri", en: "Cancelled order value" },
  "cc.impact.recent_cancellations.period": { ru: "За период", az: "Dövr", en: "Period" },
  "cc.impact.recent_cancellations.oldest": { ru: "Самая старая отмена", az: "Ən köhnə ləğv", en: "Oldest cancellation" },
  "cc.impact.recent_cancellations.summary": { ru: "{count} заказов отменено", az: "{count} sifariş ləğv edilib", en: "{count} orders cancelled" },
  // Pending Refunds
  "cc.impact.pending_refunds.count": { ru: "Запросов на возврат", az: "Geri qaytarma sorğuları", en: "Refund requests" },
  "cc.impact.pending_refunds.amount": { ru: "Запрошенная сумма", az: "Sorğu məbləği", en: "Requested amount" },
  "cc.impact.pending_refunds.oldest": { ru: "Самый длительный запрос", az: "Ən uzun sorğu", en: "Longest request" },
  "cc.impact.pending_refunds.summary": { ru: "{count} запросов на возврат", az: "{count} geri qaytarma sorğusu", en: "{count} refund requests" },
  // Upcoming Bookings
  "cc.impact.upcoming_bookings.count": { ru: "Предстоящих бронирований", az: "Gələcək bronlar", en: "Upcoming bookings" },
  "cc.impact.upcoming_bookings.gmv": { ru: "Объём предстоящих", az: "Gələcək həcm", en: "Upcoming volume" },
  "cc.impact.upcoming_bookings.summary": { ru: "{count} предстоящих бронирований", az: "{count} gələcək bron", en: "{count} upcoming bookings" },
  // Services Without Sales
  "cc.impact.services_without_sales.count": { ru: "Услуг без продаж", az: "Satışı olmayan xidmətlər", en: "Services without sales" },
  "cc.impact.services_without_sales.availability": { ru: "Без доступности: {withoutAvail}, с доступностью: {withAvail}", az: "{withoutAvail} mövcudluq olmadan, {withAvail} mövcudluqla", en: "{withoutAvail} without, {withAvail} with availability" },
  "cc.impact.services_without_sales.publication": { ru: "{recentCount} недавно опубликовано, {longTermCount} долгое время без продаж", az: "{recentCount} yaxınlarda dərc olunub, {longTermCount} uzun müddət satılmayıb", en: "{recentCount} recently published, {longTermCount} long-term unsold" },
  "cc.impact.services_without_sales.summary": { ru: "{count} услуг без продаж", az: "{count} satış olmayan xidmət", en: "{count} services without sales" },
  // V3 AI Feed
  "cc.ai.risks": { ru: "Риски", az: "Risklər", en: "Risks" },
  "cc.ai.opportunities": { ru: "Возможности", az: "Imkanlar", en: "Opportunities" },
  "cc.ai.catalog": { ru: "Каталог", az: "Kataloq", en: "Catalog" },
  // AI Feed — Risk items
  "cc.ai.risk.delayed_bookings.title": { ru: "{count} бронирований задержано", az: "{count} bron gecikdirilib", en: "{count} bookings delayed" },
  "cc.ai.risk.delayed_bookings.detail": { ru: "Затронутый объём: {value} ₼", az: "Təsir olunan həcm: {value} ₼", en: "Affected volume: {value} ₼" },
  // AI Feed — Opportunity items
  "cc.ai.opp.high_demand.title": { ru: "{name} — высокий спрос", az: "{name} — yüksək tələbat", en: "{name} — high demand" },
  "cc.ai.opp.high_demand.detail": { ru: "{orders} заказов за {days} дней", az: "{orders} sifariş {days} gündə", en: "{orders} orders in {days} days" },
  // AI Feed — Catalog items
  "cc.ai.cat.low_paid_share.title": { ru: "{name} — низкая доля оплаты", az: "{name} — aşağı ödəniş payı", en: "{name} — low paid share" },
  "cc.ai.cat.low_paid_share.detail": { ru: "{rate}% оплачено ({paid}/{total} заказов)", az: "{rate}% ödənilib ({paid}/{total} sifariş)", en: "{rate}% paid ({paid}/{total} orders)" },
  "cc.ai.cat.historical.title": { ru: "{name} — успешная история", az: "{name} — uğurlu tarixçə", en: "{name} — strong historical performance" },
  "cc.ai.cat.historical.detail": { ru: "{orders} заказов до архивации", az: "{orders} sifariş arxivlənmədən əvvəl", en: "{orders} orders before archiving" },
  // KPI titles
  "cc.kpi.gmv": { ru: "GMV", az: "GMV", en: "GMV" },
  "cc.kpi.gmv.subtitle": { ru: "Полная стоимость квалифицирующих заказов", az: "Keyfiyyətli sifarişlərin ümumi dəyəri", en: "Total value of qualified orders" },
  "cc.kpi.qualifiedGmv": { ru: "Квалифицированный GMV", az: "Keyfiyyətli GMV", en: "Qualified GMV" },
  "cc.kpi.qualifiedGmv.subtitle": { ru: "Заказыкроме NEW и CANCELLED за период", az: "Dövr üçün NEW və CANCELLED istisna olmaqla sifarişlər", en: "Orders excl. NEW/CANCELLED in period" },
  "cc.kpi.collected-gmv": { ru: "Оплачено по GMV", az: "Ödənilmiş GMV", en: "Collected GMV" },
  "cc.kpi.collected-gmv.subtitle": { ru: "Фактически оплаченная часть квалифицирующих заказов", az: "Keyfiyyətli sifarişlərin ödənilmiş hissəsi", en: "Actually paid portion of qualified orders" },
  "cc.kpi.outstanding": { ru: "Остаток к оплате", az: "Ödənilməmiş qalıq", en: "Outstanding GMV" },
  "cc.kpi.outstanding.subtitle": { ru: "Действующие обязательства по квалифицирующим заказам", az: "Keyfiyyətli sifarişlər üzrə cari öhdəliklər", en: "Active obligations from qualified orders" },
  "cc.kpi.completed-gmv": { ru: "Исполненный GMV", az: "Tamamlanmış GMV", en: "Completed GMV" },
  "cc.kpi.completed-gmv.subtitle": { ru: "Исполненные и закрытые заказы", az: "Tamamlanmış və bağlanmış sifarişlər", en: "Fulfilled and closed orders" },
  "cc.kpi.revenue": { ru: "Объём платежей", az: "Ödəniş həcmi", en: "Payment Volume" },
  "cc.kpi.revenue.subtitle": { ru: "Фактически полученные платежи за период", az: "Dövr üçün həqiqətən alınmış ödənişlər", en: "Payments actually received in period" },
  "cc.kpi.refunds": { ru: "Возвраты", az: "Geri qayıtışlar", en: "Refunds" },
  "cc.kpi.refunds.subtitle": { ru: "Сумма возвратов за период", az: "Dövr üçün geri qayıtış məbləği", en: "Refund amount in period" },
  "cc.kpi.orders": { ru: "Заказы", az: "Sifarişlər", en: "Orders" },
  "cc.kpi.bookings": { ru: "Бронирования", az: "Bronlar", en: "Bookings" },
  "cc.kpi.aov": { ru: "Средний чек", az: "Orta çek", en: "Avg Order Value" },
  "cc.kpi.conversion": { ru: "Конверсия", az: "Konversiya", en: "Conversion" },
  "cc.kpi.fulfilled": { ru: "Fulfilled", az: "İcra olunub", en: "Fulfilled" },
  "cc.kpi.confirmed": { ru: "Confirmed", az: "Təsdiqlənib", en: "Confirmed" },
  "cc.kpi.completed": { ru: "Completed", az: "Tamamlanıb", en: "Completed" },
  "cc.kpi.captured": { ru: "Captured", az: "Tutulub", en: "Captured" },
  // Operational individual KPIs
  "cc.kpi.orders-fulfilled": { ru: "Выполненные заказы", az: "İcra olunmuş sifarişlər", en: "Orders Fulfilled" },
  "cc.kpi.bookings-confirmed": { ru: "Подтверждённые бронирования", az: "Təsdiqlənmiş bronlar", en: "Bookings Confirmed" },
  "cc.kpi.bookings-completed": { ru: "Завершённые бронирования", az: "Tamamlanmış bronlar", en: "Bookings Completed" },
  "cc.kpi.payments-captured": { ru: "Полученные платежи", az: "Tutulmuş ödənişlər", en: "Payments Captured" },
  "cc.kpi.refunds-processed": { ru: "Возвраты", az: "Emal olunmuş geri qayıtışlar", en: "Refunds Processed" },
  "cc.kpi.funnel": { ru: "Конверсия воронки", az: "Funnel konversiyası", en: "Funnel Conversion" },
  "cc.kpi.funnelConversion": { ru: "Конверсия воронки", az: "Funnel konversiyası", en: "Funnel Conversion" },
  "cc.kpi.commission": { ru: "Комиссия", az: "Komissiya", en: "Commission" },
  "cc.kpi.commission.subtitle": { ru: "Доход платформы (комиссия за сделки)", az: "Platforma gəliri (əməliyyat komissiyası)", en: "Platform earnings (deal commission)" },
  "cc.kpi.payments": { ru: "Платежи", az: "Ödənişlər", en: "Payments" },
  "cc.kpi.payments.subtitle": { ru: "Объём платежей за период", az: "Dövr üçün ödəniş həcmi", en: "Payment volume in period" },
  "cc.kpi.netPayments": { ru: "Чистые платежи", az: "Xalis ödənişlər", en: "Net Payments" },
  "cc.kpi.net-payments": { ru: "Чистые платежи", az: "Xalis ödənişlər", en: "Net Payments" },
  "cc.kpi.reconciliation": { ru: "Сверка", az: "Uyğunlaşma", en: "Reconciliation" },
  "cc.kpi.total-refunds": { ru: "Обработка возвратов", az: "Geri qaytarmaların emalı", en: "Refunds Processed" },
  "cc.kpi.total-refunds.subtitle": { ru: "Обработанные возвраты за период", az: "Dövr üçün emal olunmuş geri qaytarmalar", en: "Processed refunds in period" },
  "cc.kpi.sessions": { ru: "Сеансы Marketplace", az: "Marketplace Seansları", en: "Marketplace Sessions" },
  "cc.kpi.storefrontSessions": { ru: "Сеансы Storefront", az: "Storefront Seansları", en: "Storefront Sessions" },
  "cc.kpi.storefront-sessions": { ru: "Сеансы Storefront", az: "Storefront Seansları", en: "Storefront Sessions" },
  "cc.kpi.partners": { ru: "Партнёры", az: "Tərəfdaşlar", en: "Partners" },
  "cc.kpi.marketplace-partners": { ru: "Партнёры Marketplace", az: "Marketplace Tərəfdaşları", en: "Marketplace Partners" },
  "cc.kpi.marketplacePartners": { ru: "Партнёры Marketplace", az: "Marketplace Tərəfdaşları", en: "Marketplace Partners" },
  "cc.kpi.storefront-partners": { ru: "Партнёры Storefront", az: "Storefront Tərəfdaşları", en: "Storefront Partners" },
  "cc.kpi.storefrontPartners": { ru: "Партнёры Storefront", az: "Storefront Tərəfdaşları", en: "Storefront Partners" },
  "cc.kpi.customers": { ru: "Клиенты", az: "Müştərilər", en: "Customers" },
  "cc.kpi.marketplace-customers": { ru: "Покупатели Marketplace", az: "Marketplace Alıcıları", en: "Marketplace Buyers" },
  "cc.kpi.marketplaceCustomers": { ru: "Покупатели Marketplace", az: "Marketplace Alıcıları", en: "Marketplace Buyers" },
  "cc.kpi.storefront-customers": { ru: "Покупатели Storefront", az: "Storefront Alıcıları", en: "Storefront Buyers" },
  // Stage I: Storefront SaaS billing metrics
  "cc.kpi.storefront-mrr": { ru: "MRR Storefront", az: "Storefront MRR", en: "Storefront MRR" },
  "cc.kpi.storefront-mrr.subtitle": { ru: "Ежемесячный повторяющийся доход", az: "Aylıq təkrarlanan gəlir", en: "Monthly recurring revenue" },
  "cc.kpi.storefront-arr": { ru: "ARR Storefront", az: "Storefront ARR", en: "Storefront ARR" },
  "cc.kpi.storefront-arr.subtitle": { ru: "Годовой повторяющийся доход", az: "İllik təkrarlanan gəlir", en: "Annual recurring revenue" },
  "cc.kpi.storefront-collected": { ru: "Получено", az: "Toplanmış", en: "Collected" },
  "cc.kpi.storefront-collected.subtitle": { ru: "Фактически полученные платежи за подписки", az: "Abunəliklər üzrə həqiqətən alınmış ödənişlər", en: "Actual subscription payments received" },
  "cc.kpi.storefront-outstanding": { ru: "К оплате", az: "Ödənilməmiş", en: "Outstanding" },
  "cc.kpi.storefront-outstanding.subtitle": { ru: "Неоплаченные счета-фактуры", az: "Ödənilməmiş fakturalar", en: "Unpaid invoices" },
  "cc.kpi.storefrontCustomers": { ru: "Покупатели Storefront", az: "Storefront Alıcıları", en: "Storefront Buyers" },
  // Catalog Health KPIs
  "cc.kpi.published-services": { ru: "Опубликованные услуги", az: "Dərc olunmuş xidmətlər", en: "Published Services" },
  "cc.kpi.archived-services": { ru: "Архивные услуги", az: "Arxiv xidmətlər", en: "Archived Services" },
  "cc.kpi.services-without-sales": { ru: "Без продаж", az: "Satış olmadan", en: "Without Sales" },
  "cc.kpi.high-demand-services": { ru: "Высокий спрос", az: "Yüksək tələbat", en: "High Demand" },
  "cc.kpi.low-conversion-services": { ru: "Низкая конверсия", az: "Aşağı konversiya", en: "Low Conversion" },
  "cc.kpi.total-categories": { ru: "Категории", az: "Kateqoriyalar", en: "Categories" },
  // Channel Health KPIs
  "cc.kpi.marketplace-gmv": { ru: "GMV Marketplace", az: "GMV Marketplace", en: "Marketplace GMV" },
  "cc.kpi.storefront-gmv": { ru: "GMV Storefront", az: "GMV Storefront", en: "Storefront GMV" },
  "cc.kpi.marketplace-revenue": { ru: "Выручка Marketplace", az: "Marketplace gəliri", en: "Marketplace Revenue" },
  "cc.kpi.storefront-revenue": { ru: "Выручка Storefront", az: "Storefront gəliri", en: "Storefront Revenue" },
  "cc.kpi.marketplace-orders": { ru: "Заказы Marketplace", az: "Marketplace sifarişləri", en: "Marketplace Orders" },
  "cc.kpi.storefront-orders": { ru: "Заказы Storefront", az: "Storefront sifarişləri", en: "Storefront Orders" },
  "cc.kpi.marketplace-conversion": { ru: "Конверсия Marketplace", az: "Marketplace konvertsiyası", en: "Marketplace Conversion" },
  "cc.kpi.storefront-conversion": { ru: "Конверсия Storefront", az: "Storefront konvertsiyası", en: "Storefront Conversion" },
  // reconciliation statuses
  "cc.recon.balanced": { ru: "✓ Баланс", az: "✓ Balans", en: "✓ Balanced" },
  "cc.recon.discrepancy": { ru: "⚠ Расхождение", az: "⚠ Fərq", en: "⚠ Discrepancy" },
  "cc.recon.critical": { ru: "✗ Критическое", az: "✗ Kritik", en: "✗ Critical" },
  // funnel labels
  "cc.funnel.ordersFulfilled": { ru: "Orders Fulfilled", az: "İcra olunmuş sifarişlər", en: "Orders Fulfilled" },
  "cc.funnel.bookingsConfirmed": { ru: "Bookings Confirmed", az: "Təsdiqlənmiş bronlar", en: "Bookings Confirmed" },
  "cc.funnel.bookingsCompleted": { ru: "Bookings Completed", az: "Tamamlanmış bronlar", en: "Bookings Completed" },
  "cc.funnel.paymentsCaptured": { ru: "Payments Captured", az: "Tutulmuş ödənişlər", en: "Payments Captured" },
  "cc.funnel.refundsProcessed": { ru: "Refunds Processed", az: "Emal olunmuş geri qayıtışlar", en: "Refunds Processed" },
  "cc.funnel.conversion": { ru: "Funnel Conversion", az: "Funnel konversiyası", en: "Funnel Conversion" },
  "cc.funnel.title": { ru: "Conversion Funnel", az: "Konversiya funneli", en: "Conversion Funnel" },
  // trend titles
  "cc.trend.orders": { ru: "Orders Trend", az: "Sifarişlər trendi", en: "Orders Trend" },
  "cc.trend.bookings": { ru: "Bookings Trend", az: "Bronlar trendi", en: "Bookings Trend" },
  "cc.trend.revenue": { ru: "Revenue Trend", az: "Gəlir trendi", en: "Revenue Trend" },
  // period labels
  "cc.period.TODAY": { ru: "Сегодня", az: "Bu gün", en: "Today" },
  "cc.period.LAST_3_DAYS": { ru: "3 дня", az: "3 gün", en: "3 days" },
  "cc.period.LAST_7_DAYS": { ru: "7 дней", az: "7 gün", en: "7 days" },
  "cc.period.MONTH": { ru: "Месяц", az: "Ay", en: "Month" },
  "cc.period.LAST_6_MONTHS": { ru: "6 месяцев", az: "6 ay", en: "6 months" },
  "cc.period.YEAR": { ru: "Год", az: "İl", en: "Year" },
  "cc.period.CUSTOM": { ru: "Период", az: "Dövr", en: "Custom" },
  "cc.period.start": { ru: "Начало", az: "Başlama", en: "Start" },
  "cc.period.end": { ru: "Конец", az: "Bitiş", en: "End" },

  "storefront.preview_banner": { ru: "Предпросмотр — витрина не публична", az: "Ön baxış — vitrin ictimai deyil", en: "Preview — storefront is not public" },

  // Step 3.5 — CRM
  "crm.title": { ru: "CRM", az: "CRM", en: "CRM" },
  "crm.tab.customers": { ru: "Клиенты", az: "Müştərilər", en: "Customers" },
  "crm.tab.partners": { ru: "Партнёры", az: "Tərəfdaşlar", en: "Partners" },
  "crm.search.placeholder": { ru: "Поиск по email, имени, коду…", az: "E-poçt, ad, kod üzrə axtarış…", en: "Search by email, name, code…" },
  "crm.create_customer": { ru: "Создать клиента", az: "Müştəri yaratmaq", en: "Create customer" },
  "crm.total_customers": { ru: "Всего клиентов", az: "Cəmi müştərilər", en: "Total customers" },
  "crm.persons": { ru: "Физлица", az: "Fiziki şəxslər", en: "Persons" },
  "crm.companies": { ru: "Компании", az: "Şirkətlər", en: "Companies" },
  "crm.total_partners": { ru: "Всего партнёров", az: "Cəmi tərəfdaşlar", en: "Total partners" },
  "crm.active_partners": { ru: "Активные", az: "Aktiv", en: "Active" },
  "crm.customers_empty": { ru: "Клиентов пока нет", az: "Hələ müştəri yoxdur", en: "No customers yet" },
  "crm.partners_empty": { ru: "Партнёров пока нет", az: "Hələ tərəfdaş yoxdur", en: "No partners yet" },
  "crm.col.code": { ru: "Код", az: "Kod", en: "Code" },
  "crm.col.name": { ru: "Имя", az: "Ad", en: "Name" },
  "crm.col.email": { ru: "Email", az: "E-poçt", en: "Email" },
  "crm.col.type": { ru: "Тип", az: "Növ", en: "Type" },
  "crm.col.status": { ru: "Статус", az: "Status", en: "Status" },
  "crm.col.number": { ru: "Номер", az: "Nömrə", en: "Number" },
  "crm.col.amount": { ru: "Сумма", az: "Məbləğ", en: "Amount" },
  "crm.col.payment_code": { ru: "Платёж", az: "Ödəniş", en: "Payment" },
  "crm.col.purpose": { ru: "Что оплачено", az: "Ödənilən", en: "Purpose" },
  "crm.col.method": { ru: "Способ", az: "Üsul", en: "Method" },
  "crm.col.refund_code": { ru: "Возврат", az: "Geri qaytarma", en: "Refund" },
  "crm.col.source_payment": { ru: "Платёж", az: "Ödəniş", en: "Payment" },
  "crm.col.reason": { ru: "Причина", az: "Səbəb", en: "Reason" },
  "crm.col.country": { ru: "Страна", az: "Ölkə", en: "Country" },
  "crm.col.partner": { ru: "Партнёр", az: "Tərəfdaş", en: "Partner" },
  "crm.filter.status.none": { ru: "Нет данных по фильтрам", az: "Filtreyə uyğun məlumat yoxdur", en: "No data matching filters" },
  "crm.type.person": { ru: "Физлицо", az: "Fiziki şəxs", en: "Person" },
  "crm.type.company": { ru: "Компания", az: "Şirkət", en: "Company" },
  "crm.filter.type.all": { ru: "Все типы", az: "Bütün növlər", en: "All types" },
  "crm.filter.status.all": { ru: "Все статусы", az: "Bütün statuslar", en: "All statuses" },
  "crm.filter.clear": { ru: "Сбросить", az: "Təmizlə", en: "Clear" },
  "crm.status.active": { ru: "Активен", az: "Aktiv", en: "Active" },
  "crm.status.inactive": { ru: "Неактивен", az: "Qeyri-aktiv", en: "Inactive" },
  "crm.status.suspended": { ru: "Приостановлен", az: "Dayandırıldı", en: "Suspended" },
  "crm.detail.overview": { ru: "Обзор", az: "İcmal", en: "Overview" },
  "crm.error.load_failed": { ru: "Не удалось загрузить данные", az: "Məlumat yüklənmədi", en: "Failed to load data" },
  "crm.loading": { ru: "Загрузка...", az: "Yüklənir...", en: "Loading..." },
  "crm.not_found": { ru: "Не найдено", az: "Tapılmadı", en: "Not found" },
  "crm.back_to_list": { ru: "К списку", az: "Siyahıya", en: "Back to list" },
  "crm.detail.no_orders": { ru: "Заказов пока нет", az: "Hələ sifariş yoxdur", en: "No orders yet" },
  "crm.detail.no_bookings": { ru: "Бронирований пока нет", az: "Hələ bron yoxdur", en: "No bookings yet" },
  "crm.detail.no_payments": { ru: "Платежей пока нет", az: "Hələ ödəniş yoxdur", en: "No payments yet" },
  "crm.error.retry": { ru: "Повторить", az: "Yenidən cəhd et", en: "Retry" },
  "crm.detail.contacts": { ru: "Контакты", az: "Əlaqələr", en: "Contacts" },
  "crm.detail.orders": { ru: "Заказы", az: "Sifarişlər", en: "Orders" },
  "crm.detail.bookings": { ru: "Бронирования", az: "Bronlar", en: "Bookings" },
  "crm.detail.payments": { ru: "Платежи", az: "Ödənişlər", en: "Payments" },
  "crm.detail.history": { ru: "История", az: "Tarixçə", en: "History" },
  "crm.detail.relations": { ru: "Партнёрские связи", az: "Tərəfdaş əlaqələri", en: "Partner relations" },
  "crm.detail.partners": { ru: "Партнёры", az: "Tərəfdaşlar", en: "Partners" },
  "crm.detail.orders_empty": { ru: "Заказов нет", az: "Sifariş yoxdur", en: "No orders" },
  "crm.detail.bookings_empty": { ru: "Бронирований нет", az: "Bron yoxdur", en: "No bookings" },
  "crm.detail.payments_empty": { ru: "Платежей нет", az: "Ödəniş yoxdur", en: "No payments" },
  "crm.detail.total_orders": { ru: "Всего заказов", az: "Cəmi sifarişlər", en: "Total orders" },
  "crm.detail.total_bookings": { ru: "Всего бронирований", az: "Cəmi bronlar", en: "Total bookings" },
  "crm.detail.total_payments": { ru: "Всего платежей", az: "Cəmi ödənişlər", en: "Total payments" },
  "crm.detail.edit": { ru: "Редактировать", az: "Redaktə etmək", en: "Edit" },
  "crm.detail.save": { ru: "Сохранить", az: "Saxlamaq", en: "Save" },
  "crm.detail.cancel": { ru: "Отмена", az: "Ləğv etmək", en: "Cancel" },
  "crm.detail.saving": { ru: "Сохранение…", az: "Saxlanılır…", en: "Saving…" },
  "crm.detail.creating": { ru: "Создание…", az: "Yaradılır…", en: "Creating…" },
  "crm.detail.refunds": { ru: "Возвраты", az: "Geri qaytarmalar", en: "Refunds" },
  "crm.detail.refunds_hint": { ru: "Возвраты связаны с заказами/платежами клиента.", az: "Geri qaytarmalar müştərinin sifarişləri/ödənişləri ilə əlaqələndirilir.", en: "Refunds are linked to customer orders/payments." },
  "crm.detail.refunds_unavailable": { ru: "Связанные возвраты пока не отображаются — отдельная интеграция.", az: "Əlaqəli geri qaytarmalar hələ göstərilmir — ayrıca inteqrasiya.", en: "Related refunds not yet surfaced — separate integration needed." },
  "crm.detail.no_relations": { ru: "Партнёрских связей нет", az: "Tərəfdaş əlaqəsi yoxdur", en: "No partner relations" },
  "crm.detail.no_history": { ru: "Истории нет", az: "Tarixçə yoxdur", en: "No history" },
  "crm.col.registration_number": { ru: "Регистрационный номер", az: "Qeydiyyat nömrəsi", en: "Registration number" },
  "crm.partner_detail.overview": { ru: "Обзор", az: "İcmal", en: "Overview" },
  "crm.partner_detail.services": { ru: "Услуги", az: "Xidmətlər", en: "Services" },
  "crm.partner_detail.orders": { ru: "Заказы", az: "Sifarişlər", en: "Orders" },
  "crm.partner_detail.bookings": { ru: "Бронирования", az: "Bronlar", en: "Bookings" },
  "crm.partner_detail.customers": { ru: "Клиенты", az: "Müştərilər", en: "Customers" },
  "crm.partner_detail.storefront": { ru: "Витрина", az: "Vitrin", en: "Storefront" },
  "crm.partner_detail.activity": { ru: "Активность", az: "Fəaliyyət", en: "Activity" },
  "crm.partner_detail.notes": { ru: "Примечания", az: "Qeydlər", en: "Notes" },
  "crm.partner_detail.total_relations": { ru: "Клиентских связей", az: "Müştəri əlaqələri", en: "Customer relations" },
  "crm.partner_detail.services_hint": { ru: "Каталог услуг партнёра отображается в каталоге.", az: "Tərəfdaşın xidmət kataloqu kataloqda göstərilir.", en: "Partner services are shown in the catalog." },
  "crm.partner_detail.orders_hint": { ru: "Заказы партнёра отображаются в центре заказов.", az: "Tərəfdaşın sifarişləri sifariş mərkəzində göstərilir.", en: "Partner orders are shown in the order center." },
  "crm.partner_detail.bookings_hint": { ru: "Бронирования партнёра отображаются в центре бронирований.", az: "Tərəfdaşın bronları bronz mərkəzində göstərilir.", en: "Partner bookings are shown in the booking center." },
  "crm.partner_detail.no_customers": { ru: "Клиентских связей пока нет", az: "Hələ müştəri əlaqəsi yoxdur", en: "No customer relations yet" },
  "crm.partner_detail.storefront_hint": { ru: "Витрина и каналы партнёра.", az: "Tərəfdaşın vitrini və kanalları.", en: "Partner storefront and channels." },
  "crm.partner_detail.total_services": { ru: "Услуг", az: "Xidmətlər", en: "Services" },
  "crm.partner_detail.total_orders": { ru: "Заказов", az: "Sifarişlər", en: "Orders" },
  "crm.partner_detail.total_bookings": { ru: "Бронирований", az: "Bronlar", en: "Bookings" },
  "crm.partner_detail.no_services": { ru: "Услуг пока нет", az: "Hələ xidmət yoxdur", en: "No services yet" },
  "crm.partner_detail.no_orders": { ru: "Заказов пока нет", az: "Hələ sifariş yoxdur", en: "No orders yet" },
  "crm.partner_detail.no_bookings": { ru: "Бронирований пока нет", az: "Hələ bron yoxdur", en: "No bookings yet" },
  "crm.partner_detail.no_storefront": { ru: "Витрина не настроена", az: "Vitrin qurulmayıb", en: "Storefront not configured" },
  "crm.partner_detail.storefront_code": { ru: "Код", az: "Kod", en: "Code" },
  "crm.partner_detail.storefront_slug": { ru: "Slug", az: "Slug", en: "Slug" },
  "crm.partner_detail.storefront_name": { ru: "Название бизнеса", az: "Biznes adı", en: "Business name" },
  "crm.partner_detail.storefront_tagline": { ru: "Слоган", az: "Slogan", en: "Tagline" },
  "crm.partner_detail.storefront_status": { ru: "Статус витрины", az: "Vitrin statusu", en: "Storefront status" },
  "crm.partner_detail.storefront_entitlement": { ru: "Entitlement", az: "Entitlement", en: "Entitlement" },
  "crm.partner_detail.storefront_locale": { ru: "Локаль", az: "Lokal", en: "Locale" },
  "crm.detail.total_refunds": { ru: "Возвратов", az: "Geri qaytarmalar", en: "Refunds" },
  "crm.detail.no_refunds": { ru: "Возвратов пока нет", az: "Hələ geri qaytarma yoxdur", en: "No refunds yet" },
  "crm.showing_of": { ru: "Показано первые 20", az: "İlk 20 göstərilir", en: "Showing first 20" },
  "crm.detail.pays_for_order": { ru: "Оплата за заказ", az: "Sifariş üçün ödəniş", en: "Payment for order" },
  "crm.detail.refund_for_order": { ru: "Возврат по заказу", az: "Sifarişə görə geri qaytarma", en: "Refund for order" },
  "crm.detail.source_payment": { ru: "Исходный платёж", az: "Mənbə ödənişi", en: "Source payment" },
  "crm.detail.reason": { ru: "Причина", az: "Səbəb", en: "Reason" },
  "crm.detail.total_partners": { ru: "Партнёров", az: "Tərəfdaşlar", en: "Partners" },
  "crm.detail.no_partners": { ru: "Партнёров пока нет", az: "Hələ tərəfdaş yoxdur", en: "No partners yet" },
  "crm.detail.total_amount": { ru: "Сумма", az: "Məbləğ", en: "Amount" },
  "crm.detail.paid_amount": { ru: "Оплачено", az: "Ödənilib", en: "Paid" },
  "crm.detail.refunded_amount": { ru: "Возвращено", az: "Geri qaytarılıb", en: "Refunded" },
  "crm.col.customer": { ru: "Клиент", az: "Müştəri", en: "Customer" },
  "crm.col.seller_partner": { ru: "Партнёр-продавец", az: "Satıcı tərəfdaş", en: "Seller partner" },
  "crm.col.created": { ru: "Создан", az: "Yaradılıb", en: "Created" },
  "crm.col.updated": { ru: "Обновлён", az: "Yenilənib", en: "Updated" },
  "crm.col.order": { ru: "Заказ", az: "Sifariş", en: "Order" },
  "crm.col.service": { ru: "Услуга", az: "Xidmət", en: "Service" },
  "order.items": { ru: "Позиции заказа", az: "Sifariş mövqeləri", en: "Order items" },
  "catalog.title": { ru: "Каталог", az: "Kataloq", en: "Catalog" },
  "catalog.col.type": { ru: "Тип", az: "Növ", en: "Type" },
  "catalog.col.slug": { ru: "Slug", az: "Slug", en: "Slug" },
  "catalog.col.partner": { ru: "Партнёр", az: "Tərəfdaş", en: "Partner" },
  "catalog.col.description": { ru: "Описание", az: "Təsvir", en: "Description" },
  "catalog.col.published": { ru: "Опубликован", az: "Dərc edilib", en: "Published" },
  "orders.title": { ru: "Заказы", az: "Sifarişlər", en: "Orders" },
  "bookings.title": { ru: "Бронирования", az: "Bronlar", en: "Bookings" },
  // ── Admin list pages localization ──
  "admin.catalog.header": { ru: "Catalog Center", az: "Kataloq Mərkəzi", en: "Catalog Center" },
  "admin.catalog.breadcrumb": { ru: "Catalog Center", az: "Kataloq Mərkəzi", en: "Catalog Center" },
  "admin.catalog.create_btn": { ru: "＋ Создать продукт", az: "＋ Məhsul yarat", en: "＋ Create product" },
  "admin.catalog.refresh": { ru: "⟳ Обновить", az: "⟳ Yenilə", en: "⟳ Refresh" },
  "admin.kpi.total_products": { ru: "Всего продуктов", az: "Cəmi məhsul", en: "Total products" },
  "admin.kpi.published": { ru: "Опубликовано", az: "Dərc edilib", en: "Published" },
  "admin.kpi.drafts": { ru: "Черновики", az: "Qaralamalar", en: "Drafts" },
  "admin.kpi.archived": { ru: "В архиве", az: "Arxivdə", en: "Archived" },
  "admin.kpi.total_orders": { ru: "Всего заказов", az: "Cəmi sifariş", en: "Total orders" },
  "admin.kpi.active": { ru: "Активные", az: "Aktiv", en: "Active" },
  "admin.kpi.ready_booking": { ru: "Готовы к бронированию", az: "Bronlaşdırmaya hazır", en: "Ready for booking" },
  "admin.kpi.closed": { ru: "Закрыто/отменено", az: "Bağlanıb/ləğv edilib", en: "Closed/Cancelled" },
  "admin.kpi.total_bookings": { ru: "Всего броней", az: "Cəmi bron", en: "Total bookings" },
  "admin.kpi.awaiting": { ru: "Ждут поставщика", az: "Təchizatçı gözləyir", en: "Awaiting supplier" },
  "admin.kpi.confirmed": { ru: "Подтверждено", az: "Təsdiqlənib", en: "Confirmed" },
  "admin.kpi.cancelled": { ru: "Отменено/отклонено", az: "Ləğv edilib/rədd edilib", en: "Cancelled/Rejected" },
  "admin.kpi.total_users": { ru: "Всего пользователей", az: "Cəmi istifadəçi", en: "Total users" },
  "admin.search.placeholder_catalog": { ru: "Поиск по названию или коду…", az: "Ad və ya kod ilə axtar…", en: "Search by name or code…" },
  "admin.search.placeholder_orders": { ru: "Поиск: ORD-…, TH-…", az: "Axtar: ORD-…, TH-…", en: "Search: ORD-…, TH-…" },
  "admin.search.placeholder_bookings": { ru: "Поиск: BKG-…, ORD-…", az: "Axtar: BKG-…, ORD-…", en: "Search: BKG-…, ORD-…" },
  "admin.search.placeholder_users": { ru: "Поиск: username, email, имя…", az: "Axtar: username, e-poçt, ad…", en: "Search: username, email, name…" },
  "admin.filter.all_statuses": { ru: "Все статусы", az: "Bütün statuslar", en: "All statuses" },
  "admin.filter.all_types": { ru: "Все типы", az: "Bütün növlər", en: "All types" },
  "admin.filter.all_payments": { ru: "Все оплаты", az: "Bütün ödənişlər", en: "All payments" },
  "admin.filter.all_roles": { ru: "Все роли", az: "Bütün rollar", en: "All roles" },
  "admin.filter.date_from": { ru: "С", az: "Dan", en: "From" },
  "admin.filter.date_to": { ru: "По", az: "Qədər", en: "To" },
  "admin.table.find": { ru: "Найти", az: "Tap", en: "Find" },
  "admin.table.refresh": { ru: "⟳ Обновить", az: "⟳ Yenilə", en: "⟳ Refresh" },
  "admin.table.empty_catalog": { ru: "Продуктов пока нет", az: "Hələ məhsul yoxdur", en: "No products yet" },
  "admin.table.empty_orders": { ru: "Заказов пока нет", az: "Hələ sifariş yoxdur", en: "No orders yet" },
  "admin.table.empty_bookings": { ru: "Бронирований пока нет", az: "Hələ bron yoxdur", en: "No bookings yet" },
  "admin.table.empty_users": { ru: "Пользователей не найдено", az: "İstifadəçi tapılmadı", en: "No users found" },
  "admin.table.loading": { ru: "загрузка…", az: "yüklənir…", en: "loading…" },
  "admin.table.col.code": { ru: "Код", az: "Kod", en: "Code" },
  "admin.table.col.name": { ru: "Название", az: "Ad", en: "Name" },
  "admin.table.col.type": { ru: "Тип", az: "Növ", en: "Type" },
  "admin.table.col.tariffs": { ru: "Тарифы", az: "Tariflər", en: "Tariffs" },
  "admin.table.col.status": { ru: "Статус", az: "Status", en: "Status" },
  "admin.table.col.published_at": { ru: "Публикация", az: "Dərc", en: "Published" },
  "admin.table.col.date": { ru: "Дата", az: "Tarix", en: "Date" },
  "admin.table.col.amount": { ru: "Сумма", az: "Məbləğ", en: "Amount" },
  "admin.table.col.items": { ru: "Позиции", az: "Mövqelər", en: "Items" },
  "admin.table.col.refund": { ru: "Возврат", az: "Geri qaytarma", en: "Refund" },
  "admin.table.col.cancel_date": { ru: "Дата отмены", az: "Ləğv tarixi", en: "Cancel date" },
  "admin.table.col.payment": { ru: "Оплата", az: "Ödəniş", en: "Payment" },
  "admin.table.col.passengers": { ru: "Пассажиры", az: "Sərnişinlər", en: "Passengers" },
  "admin.table.col.user": { ru: "Пользователь", az: "İstifadəçi", en: "User" },
  "admin.table.col.role": { ru: "Роль", az: "Rol", en: "Role" },
  "admin.table.col.last_login": { ru: "Последний вход", az: "Son giriş", en: "Last login" },
  "admin.table.col.order": { ru: "Заказ", az: "Sifariş", en: "Order" },
  "admin.table.col.waiting": { ru: "Ожидание", az: "Gözləmə", en: "Waiting" },
  "admin.table.col.service_date": { ru: "Дата услуги", az: "Xidmət tarixi", en: "Service date" },
  "admin.table.col.created_at": { ru: "Дата регистрации", az: "Qeydiyyat tarixi", en: "Registration date" },
  // Users page — form/create panel
  "admin.form.username_label": { ru: "Логин *", az: "Login *", en: "Username *" },
  "admin.form.username_placeholder": { ru: "operator1", az: "operator1", en: "operator1" },
  "admin.form.password_label": { ru: "Пароль * (мин. 8)", az: "Şifrə * (min. 8)", en: "Password * (min. 8)" },
  "admin.form.fullName_label": { ru: "Имя", az: "Ad", en: "Full name" },
  "admin.form.fullName_placeholder": { ru: "Оператор Иванов", az: "Operator İvanov", en: "Operator Ivanov" },
  "admin.form.email_label": { ru: "Email", az: "Email", en: "Email" },
  "admin.form.email_placeholder": { ru: "user@travelhub.local", az: "user@travelhub.local", en: "user@travelhub.local" },
  "admin.form.role_label": { ru: "Роль *", az: "Rol *", en: "Role *" },
  "admin.form.creating": { ru: "Создание…", az: "Yaradılır…", en: "Creating…" },
  "admin.form.create": { ru: "Создать", az: "Yarat", en: "Create" },
  "admin.form.panel_title": { ru: "Создать пользователя", az: "İstifadəçi yarat", en: "Create user" },
  "admin.form.panel_subtitle": { ru: "Персонал платформы (роль из матрицы RBAC)", az: "Platform personalı (RBAC matrisindən rol)", en: "Platform staff (role from RBAC matrix)" },
  "admin.form.audit_note": { ru: "🔐 Смена роли и статуса аудитируется в security.AuditLog. Новые роли не создаются — только канонические из RBAC Matrix.", az: "🔐 Rol və status dəyişikliyi security.AuditLog-da audit edilir. Yeni rollar yaradılmır — yalnız RBAC Matrix-dən canonical.", en: "🔐 Role and status changes are audited in security.AuditLog. No new roles — only canonical ones from RBAC Matrix." },
  "admin.status.change_title": { ru: "Сменить статус (сейчас: ", az: "Statusu dəyiş (indiki: ", en: "Change status (current: " },
  "admin.table.no_items": { ru: "—", az: "—", en: "—" },
  "admin.table.create_user": { ru: "＋ Создать пользователя", az: "＋ İstifadəçi yarat", en: "＋ Create user" },
  "admin.table.no_search_results": { ru: "Ничего не найдено", az: "Heç nə tapılmadı", en: "Nothing found" },
  "admin.table.no_role_access": { ru: "Изменение продукта недоступно для вашей роли", az: "Məhsul dəyişikliyi sizin rolunuz üçün əlçatan deyil", en: "Product modification is not available for your role" },
  "admin.table.taxi_note": { ru: "Редактирование: PATCH /products/:id — требуется право catalog.product.write", az: "Redaktə: PATCH /products/:id — catalog.product.write hüququ tələb olunur", en: "Editing: PATCH /products/:id — requires catalog.product.write permission" },
  "admin.table.taxi_lock_note": { ru: "🔐 Требуется право catalog.product.write (матрица: ADMIN, MODERATOR). Публикация — отдельным шагом.", az: "🔐 catalog.product.write hüququ tələb olunur (admin, moderator). Dərc ayrıca addımda.", en: "🔐 Requires catalog.product.write permission (ADMIN, MODERATOR). Publishing is a separate step." },
  // Product statuses
  "status.product.DRAFT": { ru: "Черновик", az: "Qaralama", en: "Draft" },
  "status.product.COMPLETE": { ru: "Заполнен", az: "Tamamlandı", en: "Complete" },
  "status.product.REVIEWED": { ru: "Проверен", az: "Yoxlanılıb", en: "Reviewed" },
  "status.product.PUBLISHED": { ru: "Опубликован", az: "Dərc edilib", en: "Published" },
  "status.product.ARCHIVED": { ru: "Архивирован", az: "Arxivlənib", en: "Archived" },
  "status.product.CHANGED": { ru: "Изменён", az: "Dəyişdirilib", en: "Changed" },
  // Common statuses (users, CRM, partners)
  "status.common.ACTIVE": { ru: "Активен", az: "Aktiv", en: "Active" },
  "status.common.INACTIVE": { ru: "Неактивен", az: "Deaktiv", en: "Inactive" },
  "status.common.LOCKED": { ru: "Заблокирован", az: "Kilidlenib", en: "Locked" },
  // CRM statuses
  "status.crm.SUBMITTED": { ru: "На проверке", az: "Yoxlanılır", en: "Submitted" },
  "status.crm.IN_REVIEW": { ru: "В работе", az: "Baxılır", en: "In review" },
  "status.crm.APPROVED": { ru: "Одобрено", az: "Təsdiqləndi", en: "Approved" },
  "status.crm.REJECTED": { ru: "Отклонено", az: "Rədd edildi", en: "Rejected" },
  "status.crm.CHANGES_REQUESTED": { ru: "Требуются правки", az: "Düzəliş tələb olunur", en: "Changes requested" },
  // Product types
  "product.type.TOUR": { ru: "Тур", az: "Tur", en: "Tour" },
  "product.type.HOTEL": { ru: "Отель", az: "Otəl", en: "Hotel" },
  "product.type.SANATORIUM": { ru: "Санаторий", az: "Sanatoriya", en: "Sanatorium" },
  "product.type.FLIGHT": { ru: "Авиаперелёт", az: "Aviareys", en: "Flight" },
  "product.type.TRAIN": { ru: "Ж/д", az: "Dəmiryolu", en: "Train" },
  "product.type.EXCURSION": { ru: "Экскурсия", az: "Ekskursiya", en: "Excursion" },
  "product.type.GUIDE": { ru: "Гид", az: "Bələdçi", en: "Guide" },
  "product.type.TRANSFER": { ru: "Трансфер", az: "Transfer", en: "Transfer" },
  "product.type.PHOTOGRAPHER": { ru: "Фотограф", az: "Fotoreporter", en: "Photographer" },
  // Order statuses
  "order.status.NEW": { ru: "Новый", az: "Yeni", en: "New" },
  "order.status.IN_PROCESSING": { ru: "В обработке", az: "Emal olunur", en: "In processing" },
  "order.status.WAITING_FOR_DATA": { ru: "Ожидание данных", az: "Məlumat gözlənilir", en: "Waiting for data" },
  "order.status.READY_FOR_BOOKING": { ru: "Готов к бронированию", az: "Bronlaşdırmaya hazır", en: "Ready for booking" },
  "order.status.SENT_TO_BOOKING": { ru: "Отправлен в бронирование", az: "Bronlaşdırmaya göndərilib", en: "Sent to booking" },
  "order.status.PARTIALLY_FULFILLED": { ru: "Частично выполнен", az: "Qismən icra olunub", en: "Partially fulfilled" },
  "order.status.FULFILLED": { ru: "Выполнен", az: "İcra olunub", en: "Fulfilled" },
  "order.status.READY_TO_CLOSE": { ru: "Готов к закрытию", az: "Bağlanmağa hazır", en: "Ready to close" },
  "order.status.CLOSED": { ru: "Закрыт", az: "Bağlanıb", en: "Closed" },
  "order.status.CANCELLED": { ru: "Отменён", az: "Ləğv edilib", en: "Cancelled" },
  "order.status.PROBLEM": { ru: "Проблема", az: "Problem", en: "Problem" },
  "order.status.SUSPENDED": { ru: "Приостановлен", az: "Dayandırılıb", en: "Suspended" },
  "order.payment.UNPAID": { ru: "Не оплачен", az: "Ödənilməyib", en: "Unpaid" },
  "order.payment.PARTIALLY_PAID": { ru: "Частично оплачен", az: "Qismən ödənilib", en: "Partially paid" },
  "order.payment.PAID": { ru: "Оплачен", az: "Ödənilib", en: "Paid" },
  "order.payment.REFUNDED": { ru: "Возврат", az: "Geri qaytarılıb", en: "Refunded" },
  // Booking statuses
  "booking.status.SENT_TO_SUPPLIER": { ru: "Отправлен поставщику", az: "Təchizatçıya göndərilib", en: "Sent to supplier" },
  "booking.status.AWAITING_CONFIRMATION": { ru: "Ожидает подтверждения", az: "Təsdiq gözlənilir", en: "Awaiting confirmation" },
  "booking.status.CONFIRMED": { ru: "Подтверждено", az: "Təsdiqlənib", en: "Confirmed" },
  "booking.status.IN_SERVICE": { ru: "В обслуживании", az: "Xidmətdə", en: "In service" },
  "booking.status.COMPLETED": { ru: "Завершено", az: "Tamamlanıb", en: "Completed" },
  "booking.status.CANCELLED": { ru: "Отменено", az: "Ləğv edilib", en: "Cancelled" },
  "booking.status.SUPPLIER_REJECTED": { ru: "Отклонено поставщиком", az: "Təchizatçı rədd edib", en: "Rejected by supplier" },
  // User statuses
  "user.status.ACTIVE": { ru: "Активен", az: "Aktiv", en: "Active" },
  "user.status.INACTIVE": { ru: "Неактивен", az: "Deaktiv", en: "Inactive" },
  "user.status.LOCKED": { ru: "Заблокирован", az: "Kilidlenib", en: "Locked" },
  "user.role.ADMIN": { ru: "Администратор", az: "Adminstrator", en: "Administrator" },
  "user.role.DIRECTOR": { ru: "Директор", az: "Direktor", en: "Director" },
  "user.role.FINANCE": { ru: "Финансы", az: "Maliyyə", en: "Finance" },
  "user.role.MARKETER": { ru: "Маркетолог", az: "Marketoloq", en: "Marketer" },
  "user.role.ANALYST": { ru: "Аналитик", az: "Analitik", en: "Analyst" },
  "user.role.MODERATOR": { ru: "Модератор", az: "Moderator", en: "Moderator" },
  "user.role.SALES_MANAGER": { ru: "Менеджер продаж", az: "Satış meneceri", en: "Sales manager" },
  "user.role.OPERATOR": { ru: "Оператор", az: "Operator", en: "Operator" },
  "user.role.PARTNER": { ru: "Партнёр", az: "Tərəfdaş", en: "Partner" },
  "user.role.BUYER": { ru: "Покупатель", az: "Alıcı", en: "Buyer" },
  "crm.detail.uneditable": { ru: "Email и тип клиента не редактируются (SSOT мастер-данных).", az: "E-poçt və müştəri növü redaktə edilmir (SSOT əsas məlumatları).", en: "Email and customer type are not editable (master data SSOT)." },
  "crm.create.form.type": { ru: "Тип *", az: "Növ *", en: "Type *" },
  "crm.create.form.firstName": { ru: "Имя", az: "Ad", en: "First name" },
  "crm.create.form.lastName": { ru: "Фамилия", az: "Soyad", en: "Last name" },
  "crm.create.form.companyName": { ru: "Компания *", az: "Şirkət *", en: "Company *" },
  "crm.create.form.email": { ru: "Email *", az: "E-poçt *", en: "Email *" },
  "crm.create.form.phone": { ru: "Телефон", az: "Telefon", en: "Phone" },
  "crm.create.form.submit": { ru: "Создать клиента", az: "Müştəri yaratmaq", en: "Create customer" },
  // Step 3.5C — Three-Context CRM
  "crm.title_pro": { ru: "CRM — Storefront Pro", az: "CRM — Storefront Pro", en: "CRM — Storefront Pro" },
  "crm.title_basic": { ru: "Управление клиентами", az: "Müştəri idarəetməsi", en: "Customer Management" },
  "crm.context.platform": { ru: "Платформа", az: "Platforma", en: "Platform" },
  "crm.context.marketplace_basic": { ru: "Marketplace — Базовый", az: "Marketplace — Əsas", en: "Marketplace — Basic" },
  "crm.context.storefront_pro": { ru: "Storefront — Полный CRM", az: "Storefront — Tam CRM", en: "Storefront — Full CRM" },
  "crm.my_customers": { ru: "Мои клиенты", az: "Müştərilərim", en: "My customers" },
  "crm.add_customer": { ru: "Добавить клиента", az: "Müştəri əlavə et", en: "Add customer" },
  "crm.col.lifecycle": { ru: "Этап", az: "Mərhələ", en: "Lifecycle" },
  "crm.col.lead_source": { ru: "Источник", az: "Mənbə", en: "Lead source" },
  "crm.col.tags": { ru: "Теги", az: "Teqlər", en: "Tags" },
  "crm.col.notes": { ru: "Заметки", az: "Qeydlər", en: "Notes" },
  "crm.col.created_at": { ru: "Создан", az: "Yaradılıb", en: "Created" },
  "crm.col.price_from": { ru: "Цена от", az: "Qiymət", en: "Price from" },
  "crm.col.last_activity": { ru: "Последняя активность", az: "Son fəaliyyət", en: "Last activity" },
  "crm.col.order_amount": { ru: "Сумма заказов", az: "Sifariş məbləğləri", en: "Order amount" },
  "crm.col.payment_date": { ru: "Дата оплаты", az: "Ödəniş tarixi", en: "Payment date" },
  "crm.col.refund_date": { ru: "Дата возврата", az: "Geri qaytarma tarixi", en: "Refund date" },
  "crm.col.refund_request_date": { ru: "Дата запроса", az: "Sorğu tarixi", en: "Request date" },
  "crm.detail.your_relation": { ru: "Ваша связь с клиентом", az: "Müştəri ilə əlaqəniz", en: "Your customer relation" },
  "crm.intake.lead_source": { ru: "Источник привлечения", az: "Cəlb mənbəyi", en: "Lead source" },
  "crm.intake.notes": { ru: "Заметки", az: "Qeydlər", en: "Notes" },
  "crm.intake.submit": { ru: "Добавить клиента", az: "Müştəri əlavə et", en: "Add customer" },
  "crm.lead_source.direct": { ru: "Прямой контакт", az: "Birbaşa əlaqə", en: "Direct contact" },
  "crm.lead_source.marketplace": { ru: "Marketplace", az: "Marketplace", en: "Marketplace" },
  "crm.lead_source.storefront": { ru: "Витрина Partner", az: "Partnyor vitrini", en: "Partner Storefront" },
  "crm.lead_source.referral": { ru: "Рекомендация", az: "Tövsiyə", en: "Referral" },
  "crm.lead_source.phone": { ru: "Телефон", az: "Telefon", en: "Phone" },
  "crm.lead_source.office": { ru: "Офис", az: "Ofis", en: "Office" },
  "crm.lead_source.email": { ru: "Email", az: "E-poçt", en: "Email" },
  "crm.lead_source.other": { ru: "Другое", az: "Digər", en: "Other" },
  "crm.intake.title": { ru: "Добавить клиента", az: "Müştəri əlavə et", en: "Add customer" },
  "crm.intake.success.new_customer": { ru: "Новый клиент создан", az: "Yeni müştəri yaradıldı", en: "New customer created" },
  "crm.intake.success.existing_customer": { ru: "Клиент уже существует", az: "Müştəri artıq mövcuddur", en: "Existing customer found" },
  "crm.intake.success.relation_created": { ru: "Связь с партнёром создана", az: "Tərəfdaş əlaqəsi yaradıldı", en: "Partner relationship created" },
  "crm.intake.success.relation_reused": { ru: "Связь с партнёром уже существует", az: "Tərəfdaş əlaqəsi artıq mövcuddur", en: "Partner relationship already exists" },
  "crm.intake.view_customer": { ru: "Открыть клиента", az: "Müştərini aç", en: "View customer" },
  "crm.intake.error.email_invalid": { ru: "Укажите корректный email", az: "Düzgün e-poçt daxil edin", en: "Enter a valid email" },
  // ── Operational Notes (Phase 3 Step 3.5 Round 2C) ─────────────────────────────────────────────────────────────────────────
  "notes.title": { ru: "Примечания", az: "Qeydlər", en: "Notes" },
  "notes.add": { ru: "Добавить примечание", az: "Qeyd əlavə et", en: "Add note" },
  "notes.add_placeholder": { ru: "Текст примечания…", az: "Qeyd mətni…", en: "Note text…" },
  "notes.edit": { ru: "Редактировать", az: "Redaktə et", en: "Edit" },
  "notes.delete": { ru: "Удалить", az: "Sil", en: "Delete" },
  "notes.save": { ru: "Сохранить", az: "Saxla", en: "Save" },
  "notes.cancel": { ru: "Отмена", az: "Lığv et", en: "Cancel" },
  "notes.empty": { ru: "Примечаний пока нет", az: "Hələ qeyd yoxdur", en: "No notes yet" },
  "notes.forbidden": { ru: "Нет доступа к примечаниям", az: "Qeydlərə giriş yoxdur", en: "Access denied" },
  "notes.load_error": { ru: "Не удалось загрузить примечания", az: "Qeydlər yüklənə bilmədi", en: "Failed to load notes" },
  "notes.create_error": { ru: "Ошибка создания примечания", az: "Qeyd yaratmaq xətası", en: "Failed to create note" },
  "notes.edit_error": { ru: "Ошибка сохранения", az: "Saxlama xətası", en: "Failed to save" },
  "notes.creating": { ru: "Создание…", az: "Yaradılır…", en: "Creating…" },
  "notes.saving": { ru: "Сохранение…", az: "Saxlanılır…", en: "Saving…" },
  "notes.created": { ru: "Создано", az: "Yaradılıb", en: "Created" },
  "notes.edited": { ru: "Изменено", az: "Dəyişdirilib", en: "Edited" },
  "notes.delete_confirm": { ru: "Удалить примечание?", az: "Qeydi silmək?", en: "Delete note?" },
  "notes.delete_yes": { ru: "Да", az: "Bəli", en: "Yes" },
  "notes.retry": { ru: "Повторить", az: "Yenidən cəhd et", en: "Retry" },
  "notes.unknown_author": { ru: "Неизвестно", az: "Naməlum", en: "Unknown" },
  "notes.validation_empty": { ru: "Текст не может быть пустым", az: "Mətn boş ola bilməz", en: "Text cannot be empty" },
  "notes.validation_max": { ru: "Текст не может превышать 5000 символов", az: "Mətn 5000 simvoldan çox ola bilməz", en: "Text cannot exceed 5000 characters" },
  "crm.detail.notes": { ru: "Примечания", az: "Qeydlər", en: "Notes" },
  // Phase 3 Round 2D: initial note field in create forms
  "notes.initial_note": { ru: "Примечание", az: "Qeyd", en: "Note" },
  "notes.initial_note_helper": { ru: "Внутренняя заметка для сотрудников", az: "İşçilər üçün daxili qeyd", en: "Internal note for staff" },
  "notes.initial_note_max": { ru: "до 5000 символов", az: "5000 simvola qədər", en: "up to 5000 characters" },
  // Phase 3 Round 2C: Activity Timeline
  "crm.detail.activity": { ru: "Активность", az: "Fəaliyyət", en: "Activity" },
  "activity.all_sources": { ru: "Все источники", az: "Bütün mənbələr", en: "All sources" },
  "activity.all_events": { ru: "Все события", az: "Bütün hadisələr", en: "All events" },
  "activity.load_more": { ru: "Загрузить ещё", az: "Daha çox yüklə", en: "Load more" },
  "activity.loading": { ru: "Загрузка…", az: "Yüklənir…", en: "Loading…" },
  "activity.empty": { ru: "Активность не найдена", az: "Fəaliyyət tapılmadı", en: "No activity found" },
  "activity.forbidden": { ru: "Нет доступа к активности", az: "Fəaliyyətə giriş yoxdur", en: "Access denied" },
  "activity.error": { ru: "Ошибка загрузки активности", az: "Fəaliyyət yüklənmə xətası", en: "Failed to load activity" },
  "activity.by": { ru: "автор", az: "tərəfindən", en: "by" },
  // Source types
  "activity.source.OPERATIONAL_NOTE": { ru: "Примечание", az: "Qeyd", en: "Note" },
  "activity.source.ORDER": { ru: "Заказ", az: "Sifariş", en: "Order" },
  "activity.source.BOOKING": { ru: "Бронирование", az: "Bron", en: "Booking" },
  "activity.source.PAYMENT": { ru: "Платёж", az: "Ödəniş", en: "Payment" },
  "activity.source.REFUND": { ru: "Возврат", az: "Geri qaytarma", en: "Refund" },
  "activity.source.MESSAGE": { ru: "Сообщение", az: "Mesaj", en: "Message" },
  "activity.source.AUDIT_EVENT": { ru: "Аудит", az: "Audit", en: "Audit" },
  "activity.source.CUSTOMER_HISTORY": { ru: "История", az: "Tarixçə", en: "History" },
  "activity.source.BUYER_REQUEST": { ru: "Запрос покупателя", az: "Alıcı sorğusu", en: "Buyer request" },
  "activity.source.PARTNER_APPLICATION": { ru: "Заявка партнёра", az: "Tərəfdaş ərizəsi", en: "Partner application" },
  // Activity types
  "activity.event.NOTE_CREATED": { ru: "Примечание добавлено", az: "Qeyd əlavə edildi", en: "Note added" },
  "activity.event.ORDER_CREATED": { ru: "Заказ создан", az: "Sifariş yaradıldı", en: "Order created" },
  "activity.event.ORDER_STATUS_CHANGED": { ru: "Статус заказа изменён", az: "Sifariş statusu dəyişdi", en: "Order status changed" },
  "activity.event.ORDER_CANCELLED": { ru: "Заказ отменён", az: "Sifariş ləğv edildi", en: "Order cancelled" },
  "activity.event.BOOKING_CREATED": { ru: "Бронирование создано", az: "Bron yaradıldı", en: "Booking created" },
  "activity.event.BOOKING_STATUS_CHANGED": { ru: "Статус бронирования изменён", az: "Bron statusu dəyişdi", en: "Booking status changed" },
  "activity.event.BOOKING_COMPLETED": { ru: "Бронирование завершено", az: "Bron tamamlandı", en: "Booking completed" },
  "activity.event.PAYMENT_CREATED": { ru: "Платёж создан", az: "Ödəniş yaradıldı", en: "Payment created" },
  "activity.event.PAYMENT_CAPTURED": { ru: "Платёж зачислен", az: "Ödəniş qəbul edildi", en: "Payment captured" },
  "activity.event.REFUND_CREATED": { ru: "Возврат создан", az: "Geri qaytarma yaradıldı", en: "Refund created" },
  "activity.event.REFUND_PROCESSED": { ru: "Возврат обработан", az: "Geri qaytarma işləndi", en: "Refund processed" },
  "activity.event.MESSAGE_SENT": { ru: "Сообщение отправлено", az: "Mesaj göndərildi", en: "Message sent" },
  "activity.event.AUDIT_CUSTOMER_CREATED": { ru: "Клиент создан", az: "Müştəri yaradıldı", en: "Customer created" },
  "activity.event.AUDIT_CUSTOMER_STATUS_CHANGED": { ru: "Статус клиента изменён", az: "Müştəri statusu dəyişdi", en: "Customer status changed" },
  "activity.event.AUDIT_PARTNER_APPROVED": { ru: "Партнёр одобрен", az: "Tərəfdaş təsdiqləndi", en: "Partner approved" },
  "activity.event.CUSTOMER_HISTORY_CREATED": { ru: "Клиент создан", az: "Müştəri yaradıldı", en: "Customer created" },
  "activity.event.CUSTOMER_HISTORY_STATUS_CHANGED": { ru: "Статус клиента изменён", az: "Müştəri statusu dəyişdi", en: "Customer status changed" },
  "activity.event.CUSTOMER_HISTORY_UPDATED": { ru: "Данные клиента обновлены", az: "Müştəri məlumatları yeniləndi", en: "Customer data updated" },
  "activity.event.BUYER_REQUEST_CREATED": { ru: "Запрос создан", az: "Sorğu yaradıldı", en: "Request created" },
  "activity.event.BUYER_REQUEST_SUBMITTED": { ru: "Запрос отправлен", az: "Sorğu göndərildi", en: "Request submitted" },
  "activity.event.BUYER_REQUEST_CANCELLED": { ru: "Запрос отменён", az: "Sorğu ləğv edildi", en: "Request cancelled" },
  "activity.event.PARTNER_APPLICATION_SUBMITTED": { ru: "Заявка партнёра отправлена", az: "Tərəfdaş ərizəsi göndərildi", en: "Partner application submitted" },
  "activity.event.PARTNER_APPLICATION_APPROVED": { ru: "Заявка партнёра одобрена", az: "Tərəfdaş ərizəsi təsdiqləndi", en: "Partner application approved" },

  // Step 3.6 — CRM Analytics
  "crm.analytics.tab": { ru: "Аналитика", az: "Analitika", en: "Analytics" },
  "crm.analytics.loading": { ru: "Загрузка аналитики…", az: "Analitika yüklənir…", en: "Loading analytics…" },
  "crm.analytics.error": { ru: "Ошибка загрузки аналитики", az: "Analitika yüklənmə xətası", en: "Failed to load analytics" },
  "crm.analytics.no_data": { ru: "Нет данных", az: "Məlumat yoxdur", en: "No data" },
  "crm.analytics.total_customers": { ru: "Всего клиентов", az: "Ümumi müştərilər", en: "Total customers" },
  "crm.analytics.total_customers.subtitle": { ru: "уникальных клиентов", az: "ünikal müştəri", en: "unique customers" },
  "crm.analytics.total_relationships": { ru: "Связи", az: "Əlaqələr", en: "Relationships" },
  "crm.analytics.total_relationships.subtitle": { ru: "клиент–партнёр", az: "müştəri–tərəfdaş", en: "customer–partner" },
  "crm.analytics.new_relationships": { ru: "Новые связи", az: "Yeni əlaqələr", en: "New relationships" },
  "crm.analytics.new_relationships.subtitle": { ru: "за период", az: "dövr ərzində", en: "in period" },
  "crm.analytics.commercially_active": { ru: "Активные клиенты", az: "Aktiv müştərilər", en: "Commercially active" },
  "crm.analytics.commercially_active.subtitle": { ru: "с заказами", az: "sifarişləri olan", en: "with orders" },
  "crm.analytics.lifecycle": { ru: "Жизненный цикл", az: "Ömür dövrü", en: "Lifecycle" },
  "crm.analytics.source": { ru: "Источник", az: "Mənbə", en: "Source" },
  "crm.analytics.manager": { ru: "Менеджер", az: "Menecer", en: "Manager" },
  "crm.analytics.new_by_source": { ru: "Новые по источнику", az: "Mənbə üzrə yeni", en: "New by source" },
  "crm.analytics.filter.period": { ru: "Период:", az: "Dövr:", en: "Period:" },
  "crm.analytics.filter.from": { ru: "С", az: "Başlama", en: "From" },
  "crm.analytics.filter.to": { ru: "По", az: "Bitiş", en: "To" },
  "analytics.preset.TODAY": { ru: "Сегодня", az: "Bu gün", en: "Today" },
  "analytics.preset.LAST_3_DAYS": { ru: "3 дня", az: "3 gün", en: "3 days" },
  "analytics.preset.LAST_7_DAYS": { ru: "7 дней", az: "7 gün", en: "7 days" },
  "analytics.preset.MONTH": { ru: "Месяц", az: "Ay", en: "Month" },
  "analytics.preset.LAST_6_MONTHS": { ru: "6 месяцев", az: "6 ay", en: "6 months" },
  "analytics.preset.YEAR": { ru: "Год", az: "İl", en: "Year" },

};

/** Локализованная строка по ключу (fallback — сам ключ, затем default locale). */
export function t(key: string, locale: Locale): string {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[locale] ?? entry[DEFAULT_LOCALE] ?? key;
}

/* ── Locale-aware formatting (Intl) ────────────────────────────────────────── */

/**
 * Форматирование цены. amount <= 0 / null → null («Цена по запросу» на уровне UI).
 * Валюта НЕ локализуется (код валюты — технический), локализуется формат числа.
 */
export function formatPrice(
  amount: string | number | null | undefined,
  currency: string | null | undefined,
  locale: Locale,
): string | null {
  if (amount === null || amount === undefined || amount === "") return null;
  const n = Number(amount);
  if (Number.isNaN(n) || n <= 0) return null;
  return new Intl.NumberFormat(LOCALE_TAGS[locale], {
    style: "currency",
    currency: (currency ?? "USD").toUpperCase(),
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], { year: "numeric", month: "long", day: "numeric" }).format(d);
}

/** Локализованный label статуса Order (Buyer Cabinet §21). Неизвестный → код. */
export function orderStatusLabel(status: string, locale: Locale): string {
  return t(`status.order.${status}`, locale);
}

/** Локализованный label статуса Booking (Buyer Cabinet §21). Неизвестный → код. */
export function bookingStatusLabel(status: string, locale: Locale): string {
  return t(`status.booking.${status}`, locale);
}

/** Локализованный label статуса оплаты Order (Buyer Cabinet §21). Неизвестный → код. */
export function paymentStatusLabel(status: string, locale: Locale): string {
  return t(`status.payment.${status}`, locale);
}

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale]).format(n);
}

/* ── Locale persistence + React context ────────────────────────────────────── */

const LOCALE_LIST = LOCALES as readonly string[];

function readStored(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && (LOCALE_LIST as string[]).includes(v)) return v as Locale;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({ locale: DEFAULT_LOCALE, setLocale: () => undefined });

/**
 * LocaleProvider — оборачивает всё приложение (root layout). Hydration-safe:
 * до клиентского mount рендерится DEFAULT_LOCALE (совпадает с SSR), затем
 * применяется сохранённый locale из localStorage и синхронизируется <html lang>.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLocaleState(readStored());
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

export function useSetLocale(): (l: Locale) => void {
  return useContext(LocaleContext).setLocale;
}


