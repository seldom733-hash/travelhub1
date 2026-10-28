import type { PageSectionInput, SectionView } from "./constructor-api";

export interface BuilderTemplate {
  id: string;
  title: string;
  description: string;
  sections: Array<Pick<PageSectionInput, "blockType" | "settings">>;
}

export const STOREFRONT_TEMPLATES: BuilderTemplate[] = [
  {
    id: "travel-agency",
    title: "Турагентство",
    description: "Hero, о компании, туры, FAQ, контакты",
    sections: [
      { blockType: "storefront-hero", settings: { heading: "Путешествия, которые запоминаются", subheading: "Подберём тур под ваш бюджет и даты", ctaLabel: "Смотреть туры", ctaHref: "#products" } },
      { blockType: "storefront-products", settings: { heading: "Туры и услуги", pageSize: 12 } },
      { blockType: "content-about", settings: { heading: "О нас", body: "Расскажите о вашей компании, опыте и преимуществах." } },
      { blockType: "content-faq", settings: { heading: "Вопросы и ответы", itemsText: "Как забронировать тур? | Оставьте заявку, и менеджер свяжется с вами.\nМожно ли оплатить картой? | Да, оплата картой или переводом." } },
      { blockType: "storefront-cta", settings: { heading: "Готовы подобрать путешествие?", label: "Связаться", href: "#contacts" } },
      { blockType: "content-form", settings: { heading: "Оставить заявку", body: "Оставьте контакт — мы свяжемся с вами.", label: "Отправить", successMessage: "Спасибо! Заявка отправлена." } },
      { blockType: "storefront-contacts", settings: { heading: "Контакты" } },
      { blockType: "storefront-footer", settings: { text: "" } },
    ],
  },
  {
    id: "tour-operator",
    title: "Туроператор",
    description: "Упор на направления и продукты",
    sections: [
      { blockType: "storefront-hero", settings: { heading: "Направления, которые вдохновляют", subheading: "Авторские туры и готовые маршруты", ctaLabel: "Выбрать направление", ctaHref: "#products" } },
      { blockType: "content-about", settings: { heading: "Кто мы", body: "Команда, которая знает направления изнутри." } },
      { blockType: "storefront-products", settings: { heading: "Популярные направления", pageSize: 9 } },
      { blockType: "content-gallery", settings: { heading: "Галерея", imagesText: "" } },
      { blockType: "storefront-contacts", settings: { heading: "Обсудим путешествие?" } },
      { blockType: "storefront-footer", settings: { text: "" } },
    ],
  },
  {
    id: "minimal",
    title: "Минимальный",
    description: "Только главное: продукты и контакты",
    sections: [
      { blockType: "storefront-hero", settings: { heading: "Добро пожаловать", subheading: "Ваш помощник в путешествиях", ctaLabel: "Смотреть каталог", ctaHref: "#products" } },
      { blockType: "storefront-products", settings: { heading: "Каталог", pageSize: 12 } },
      { blockType: "storefront-contacts", settings: { heading: "Контакты" } },
      { blockType: "storefront-footer", settings: { text: "" } },
    ],
  },
];

export const MARKETPLACE_TEMPLATES: BuilderTemplate[] = [
  {
    id: "marketplace-content",
    title: "Marketplace + контент",
    description: "Hero, поиск, каталоги и общие контентные блоки",
    sections: [
      { blockType: "hero", settings: { autoplay: true, interval: 7000, showIndicators: true, showArrows: true } },
      { blockType: "search", settings: {} },
      { blockType: "tours", settings: { pageSize: 6 } },
      { blockType: "hotels", settings: { pageSize: 6 } },
      { blockType: "content-about", settings: { heading: "О платформе", body: "TravelHub объединяет туры, отели и сервисы для путешествий." } },
      { blockType: "content-cta", settings: { heading: "Начните путешествие", label: "Найти тур", href: "/search" } },
      { blockType: "content-faq", settings: { heading: "Вопросы и ответы", itemsText: "Как забронировать? | Выберите тур и оставьте заявку.\nКак оплатить? | Картой или переводом." } },
      { blockType: "footer", settings: {} },
    ],
  },
];

export function instantiateTemplate(template: BuilderTemplate, prefix: string): SectionView[] {
  return template.sections.map((section, index) => {
    const blockInstanceId = `${prefix}-${template.id}-${index}-${section.blockType}`;
    return {
      id: `tpl-${blockInstanceId}`,
      blockType: section.blockType,
      blockInstanceId,
      sortOrder: index,
      enabled: true,
      settings: { ...(section.settings ?? {}) },
      style: {},
      responsive: {},
      dataSource: {},
      visibility: null,
      localeContent: {},
    };
  });
}
