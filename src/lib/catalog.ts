/** Общая конфигурация каталогов и SELECT для страниц услуг. */

export const SERVICE_SELECT = {
  id: true,
  type: true,
  title: true,
  slug: true,
  price: true,
  discountPrice: true,
  currency: true,
  city: true,
  country: true,
  countryCode: true,
  rating: true,
  reviewCount: true,
  images: true,
  duration: true,
  isHot: true,
  hotDiscount: true,
  languages: true,
  maxGuests: true,
} as const;

/** Нормализация searchParams: string → [string], string[] → string[]. */
export function toArr(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

import type { ServiceCategory } from "@/lib/filterConfig";

export interface CatalogConfig {
  type: string;
  /** Ключ filterConfig для фильтров (tour, hotel, sanatorium, ...) */
  filterCategory: ServiceCategory;
  /** URL-путь каталога, напр. «/tours» */
  path: string;
  /** Множественное число для заголовка, напр. «Туры» */
  title: string;
  /** Единственное число, напр. «Тур» */
  single: string;
  subtitle: string;
  icon: string;
  gradient: string;
}

export const CATALOGS: Record<string, CatalogConfig> = {
  TOUR: {
    type: "TOUR",
    filterCategory: "tour",
    path: "/tours",
    title: "Туры",
    single: "Тур",
    subtitle: "Пляжные, экскурсионные, горнолыжные — путешествия по всему миру",
    icon: "🏖",
    gradient: "from-orange-500 to-amber-500",
  },
  HOTEL: {
    type: "HOTEL",
    filterCategory: "hotel",
    path: "/hotels",
    title: "Отели",
    single: "Отель",
    subtitle: "Лучшие отели и курорты для комфортного отдыха",
    icon: "🏨",
    gradient: "from-blue-500 to-indigo-500",
  },
  SANATORIUM: {
    type: "SANATORIUM",
    filterCategory: "sanatorium",
    path: "/sanatoriums",
    title: "Санатории",
    single: "Санаторий",
    subtitle: "Оздоровление и лечение на лучших курортах",
    icon: "🏥",
    gradient: "from-emerald-500 to-teal-500",
  },
  FLIGHT: {
    type: "FLIGHT",
    filterCategory: "flight",
    path: "/flights",
    title: "Авиабилеты",
    single: "Авиабилет",
    subtitle: "Перелёты по выгодным ценам в любую точку мира",
    icon: "✈",
    gradient: "from-sky-500 to-cyan-500",
  },
  TRAIN: {
    type: "TRAIN",
    filterCategory: "train",
    path: "/trains",
    title: "Ж/д билеты",
    single: "Ж/д билет",
    subtitle: "Путешествуйте на поезде по всему региону",
    icon: "🚄",
    gradient: "from-violet-500 to-purple-500",
  },
  EXCURSION: {
    type: "EXCURSION",
    filterCategory: "excursion",
    path: "/excursions",
    title: "Экскурсии",
    single: "Экскурсия",
    subtitle: "Увлекательные экскурсии с местными гидами",
    icon: "🏛",
    gradient: "from-rose-500 to-pink-500",
  },
  GUIDE: {
    type: "GUIDE",
    filterCategory: "guide",
    path: "/guides",
    title: "Гиды",
    single: "Гид",
    subtitle: "Профессиональные гиды в любом городе мира",
    icon: "🧭",
    gradient: "from-teal-500 to-emerald-500",
  },
  TRANSFER: {
    type: "TRANSFER",
    filterCategory: "transfer",
    path: "/transfers",
    title: "Трансферы",
    single: "Трансфер",
    subtitle: "Комфортные поездки от аэропорта до отеля",
    icon: "🚐",
    gradient: "from-slate-600 to-slate-800",
  },
  PHOTOGRAPHER: {
    type: "PHOTOGRAPHER",
    filterCategory: "photographer",
    path: "/photographers",
    title: "Фотографы",
    single: "Фотограф",
    subtitle: "Профессиональная съёмка для вашего путешествия",
    icon: "📷",
    gradient: "from-fuchsia-500 to-purple-600",
  },
};

export function getCatalog(type: string | undefined): CatalogConfig | undefined {
  return type ? CATALOGS[type] : undefined;
}

export type SortKey = "popular" | "cheap" | "expensive" | "rating";

export const SORT_LABELS: Record<SortKey, string> = {
  popular: "Популярные",
  cheap: "Дешёвые",
  expensive: "Дорогие",
  rating: "Рейтинг",
};

export function orderByFor(sort: string | undefined): Record<string, "asc" | "desc"> {
  switch (sort) {
    case "cheap":
      return { price: "asc" };
    case "expensive":
      return { price: "desc" };
    case "rating":
      return { rating: "desc" };
    default:
      return { reviewCount: "desc" };
  }
}


