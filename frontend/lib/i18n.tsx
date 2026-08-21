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
  "cc_utc": { ru: "UTC", az: "UTC", en: "UTC" },
  // section names
  "cc.section.executive": { ru: "Сводные показатели", az: "İdarəetmə Xülasəsi", en: "Executive Summary" },
  "cc.section.operational": { ru: "Операционная деятельность", az: "Əməliyyat fəaliyyəti", en: "Operational Activity" },
  "cc.section.financial": { ru: "Финансы", az: "Maliyyə", en: "Financial" },
  "cc.section.marketplace": { ru: "Маркетплейс", az: "Bazar yeri", en: "Marketplace" },
  // KPI titles
  "cc.kpi.gmv": { ru: "GMV", az: "GMV", en: "GMV" },
  "cc.kpi.revenue": { ru: "Выручка", az: "Gəlir", en: "Revenue" },
  "cc.kpi.netRevenue": { ru: "Чистая выручка", az: "Xalis gəlir", en: "Net Revenue" },
  "cc.kpi.net-revenue": { ru: "Чистая выручка", az: "Xalis gəlir", en: "Net Revenue" },
  "cc.kpi.orders": { ru: "Заказы", az: "Sifarişlər", en: "Orders" },
  "cc.kpi.bookings": { ru: "Бронирования", az: "Bronlar", en: "Bookings" },
  "cc.kpi.aov": { ru: "Средний чек", az: "Orta çek", en: "Avg Order Value" },
  "cc.kpi.conversion": { ru: "Конверсия", az: "Konversiya", en: "Conversion" },
  "cc.kpi.fulfilled": { ru: "Fulfilled", az: "İcra olunub", en: "Fulfilled" },
  "cc.kpi.confirmed": { ru: "Confirmed", az: "Təsdiqlənib", en: "Confirmed" },
  "cc.kpi.completed": { ru: "Completed", az: "Tamamlanıb", en: "Completed" },
  "cc.kpi.captured": { ru: "Captured", az: "Tutulub", en: "Captured" },
  "cc.kpi.refunds": { ru: "Refunds", az: "Geri qayıtışlar", en: "Refunds" },
  // Operational individual KPIs
  "cc.kpi.orders-fulfilled": { ru: "Выполненные заказы", az: "İcra olunmuş sifarişlər", en: "Orders Fulfilled" },
  "cc.kpi.bookings-confirmed": { ru: "Подтверждённые бронирования", az: "Təsdiqlənmiş bronlar", en: "Bookings Confirmed" },
  "cc.kpi.bookings-completed": { ru: "Завершённые бронирования", az: "Tamamlanmış bronlar", en: "Bookings Completed" },
  "cc.kpi.payments-captured": { ru: "Полученные платежи", az: "Tutulmuş ödənişlər", en: "Payments Captured" },
  "cc.kpi.refunds-processed": { ru: "Возвраты", az: "Emal olunmuş geri qayıtışlar", en: "Refunds Processed" },
  "cc.kpi.funnel": { ru: "Конверсия воронки", az: "Funnel konversiyası", en: "Funnel Conversion" },
  "cc.kpi.funnelConversion": { ru: "Конверсия воронки", az: "Funnel konversiyası", en: "Funnel Conversion" },
  "cc.kpi.commission": { ru: "Комиссия", az: "Komissiya", en: "Commission" },
  "cc.kpi.payments": { ru: "Платежи", az: "Ödənişlər", en: "Payments" },
  "cc.kpi.netPayments": { ru: "Чистые платежи", az: "Xalis ödənişlər", en: "Net Payments" },
  "cc.kpi.net-payments": { ru: "Чистые платежи", az: "Xalis ödənişlər", en: "Net Payments" },
  "cc.kpi.reconciliation": { ru: "Сверка", az: "Uyğunlaşma", en: "Reconciliation" },
  "cc.kpi.sessions": { ru: "Сеансы", az: "Seanslar", en: "Sessions" },
  "cc.kpi.storefrontSessions": { ru: "Сеансы витрины", az: "Vitrin seansları", en: "Storefront Sessions" },
  "cc.kpi.storefront-sessions": { ru: "Сеансы витрины", az: "Vitrin seansları", en: "Storefront Sessions" },
  "cc.kpi.partners": { ru: "Партнёры", az: "Tərəfdaşlar", en: "Partners" },
  "cc.kpi.customers": { ru: "Клиенты", az: "Müştərilər", en: "Customers" },
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


