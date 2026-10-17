/**
 * Единый источник истины по услугам универсального поиска.
 *
 * Список услуг раньше был продублирован в трёх местах (тип ServiceType,
 * VALID_SERVICES на странице результатов, TABS в HeroSearch) плюс отдельный
 * урезанный список в конструкторе. Теперь он один: здесь. Конфиг включения
 * услуг приходит из workspace (page-builder → вкладка «Поиск» →
 * ConstructorPage.searchConfig, slug marketplace-home).
 */
import type { ServiceType } from "./search-engine";

export interface SearchServiceDef {
  id: ServiceType;
  /** Ключ словаря с названием услуги (вкладка). */
  labelKey: string;
  priority: "P0" | "P1" | "P2";
}

/** Все услуги поисковика в порядке вкладок. */
export const SEARCH_SERVICES: SearchServiceDef[] = [
  { id: "tours", labelKey: "search.tab_tours", priority: "P0" },
  { id: "hotels", labelKey: "search.tab_hotels", priority: "P0" },
  { id: "flights", labelKey: "search.tab_flights", priority: "P0" },
  { id: "sanatoriums", labelKey: "search.tab_sanatoriums", priority: "P0" },
  { id: "guides", labelKey: "search.tab_guides", priority: "P1" },
  { id: "excursions", labelKey: "search.tab_excursions", priority: "P1" },
  { id: "transfers", labelKey: "search.tab_transfers", priority: "P1" },
  { id: "car-rental", labelKey: "search.tab_car_rental", priority: "P1" },
  { id: "railway", labelKey: "search.tab_railway", priority: "P2" },
  { id: "cruises", labelKey: "search.tab_cruises", priority: "P2" },
];

/**
 * Услуги, включённые по умолчанию: только те, которые реально обслуживаются
 * поставщиками (туры, отели, авиа). Остальные включаются вручную в workspace.
 */
export const DEFAULT_ENABLED_SERVICES: ServiceType[] = ["tours", "hotels", "flights"];

/** Услуга по умолчанию (первая включённая). */
export const DEFAULT_SERVICE: ServiceType = "tours";

/** Форма опубликованного searchConfig (Constructor → searchConfig). */
export interface SearchServicesConfig {
  services?: { id: string; labelKey?: string; enabled: boolean }[];
  defaultService?: string;
}

export interface ResolvedSearchServices {
  /** Включённые услуги в порядке из конфига (или дефолт). */
  enabled: ServiceType[];
  /** Активная по умолчанию услуга — всегда из списка enabled. */
  defaultService: ServiceType;
}

/**
 * Опубликованный searchConfig → включённые услуги.
 * Конфига нет (страница ещё не настраивалась) или в нём нет ни одной включённой
 * услуги → дефолт (tours/hotels/flights).
 */
export function resolveSearchServices(config?: SearchServicesConfig | null): ResolvedSearchServices {
  const known = new Set<string>(SEARCH_SERVICES.map((s) => s.id));
  const fromConfig = (config?.services ?? [])
    .filter((s) => s.enabled && known.has(s.id))
    .map((s) => s.id as ServiceType);
  const enabled = fromConfig.length ? fromConfig : DEFAULT_ENABLED_SERVICES;
  const requested = config?.defaultService as ServiceType | undefined;
  return {
    enabled,
    defaultService: requested && enabled.includes(requested) ? requested : enabled[0] ?? DEFAULT_SERVICE,
  };
}
