// ═══════════════════════════════════════════════════════════════════════════════
// Block Registry — Allowlist of Constructor blocks
// ═══════════════════════════════════════════════════════════════════════════════

export type BlockCategory = "system" | "marketplace" | "content";

export interface BlockDefinition {
  type: string;
  version: number;
  category: BlockCategory;
  displayName: Record<string, string>; // { ru, az, en }
  description: Record<string, string>;
  allowedContexts: string[]; // ["marketplace"] | ["storefront"] | both
  allowedLayouts: string[];
  defaultSettings: Record<string, unknown>;
  defaultLayout: string;
  singleton: boolean;
  removable: boolean; // system blocks are not removable
  dataSourceType: string;
}

export interface BlockRegistryEntry extends BlockDefinition {}

// ─── Marketplace Block Registry ──────────────────────────────────────────────

export const BLOCK_REGISTRY: BlockRegistryEntry[] = [
  {
    type: "hero",
    version: 1,
    category: "marketplace",
    displayName: { ru: "Hero-баннер", az: "Hero banner", en: "Hero Banner" },
    description: { ru: "Главный баннер с видео/изображением", az: "Əsas banner", en: "Main hero banner" },
    allowedContexts: ["marketplace"],
    allowedLayouts: ["full-width"],
    defaultSettings: { autoplay: true, interval: 7000, showIndicators: true, showArrows: true },
    defaultLayout: "full-width",
    singleton: true,
    removable: false,
    dataSourceType: "static-config",
  },
  {
    type: "search",
    version: 1,
    category: "system",
    displayName: { ru: "Поиск", az: "Axtarış", en: "Search" },
    description: { ru: "Глобальный блок поиска", az: "Qlobal axtarış bloku", en: "Global search block" },
    allowedContexts: ["marketplace"],
    allowedLayouts: ["full-width"],
    defaultSettings: { tabs: ["accommodation", "tours", "excursions", "transfers", "car-rental", "cruise", "railway", "sanatorium", "guide", "flight"] },
    defaultLayout: "full-width",
    singleton: true,
    removable: false,
    dataSourceType: "static-config",
  },
  {
    type: "popular-destinations",
    version: 1,
    category: "marketplace",
    displayName: { ru: "Популярные направления", az: "Populyar məkanlar", en: "Popular Destinations" },
    description: { ru: "Популярные туристические направления", az: "Populyar turizm məkanları", en: "Popular travel destinations" },
    allowedContexts: ["marketplace"],
    allowedLayouts: ["full-width", "grid-4", "grid-3"],
    defaultSettings: { pageSize: 8 },
    defaultLayout: "full-width",
    singleton: true,
    removable: true,
    dataSourceType: "static-config",
  },
  {
    type: "hot-tours",
    version: 1,
    category: "marketplace",
    displayName: { ru: "Горящие туры", az: "Günəş turları", en: "Hot Tours" },
    description: { ru: "Лучшие предложения прямо сейчас", az: "Ən yaxşı təkliflər indi", en: "Best offers right now" },
    allowedContexts: ["marketplace"],
    allowedLayouts: ["grid-4", "grid-3", "grid-2", "full-width"],
    defaultSettings: { pageSize: 6 },
    defaultLayout: "grid-4",
    singleton: true,
    removable: true,
    dataSourceType: "product-feed",
  },
  {
    type: "special-offers",
    version: 1,
    category: "marketplace",
    displayName: { ru: "Специальные предложения", az: "Xüsusi təkliflər", en: "Special Offers" },
    description: { ru: "Скидки и специальные предложения", az: "Endirimlər və xüsusi təkliflər", en: "Discounts and special offers" },
    allowedContexts: ["marketplace"],
    allowedLayouts: ["grid-2", "grid-3", "full-width"],
    defaultSettings: { pageSize: 4 },
    defaultLayout: "grid-2",
    singleton: true,
    removable: true,
    dataSourceType: "product-feed",
  },
  {
    type: "tours",
    version: 1,
    category: "marketplace",
    displayName: { ru: "Туры", az: "Turlar", en: "Tours" },
    description: { ru: "Каталог туров", az: "Tur kataloqu", en: "Tours catalog" },
    allowedContexts: ["marketplace"],
    allowedLayouts: ["grid-4", "grid-3", "grid-2", "full-width"],
    defaultSettings: { pageSize: 6 },
    defaultLayout: "grid-4",
    singleton: true,
    removable: true,
    dataSourceType: "product-feed",
  },
  {
    type: "hotels",
    version: 1,
    category: "marketplace",
    displayName: { ru: "Отели", az: "Otellər", en: "Hotels" },
    description: { ru: "Каталог отелей", az: "Otel kataloqu", en: "Hotels catalog" },
    allowedContexts: ["marketplace"],
    allowedLayouts: ["grid-4", "grid-3", "grid-2", "full-width"],
    defaultSettings: { pageSize: 6 },
    defaultLayout: "grid-4",
    singleton: true,
    removable: true,
    dataSourceType: "product-feed",
  },
  {
    type: "flights",
    version: 1,
    category: "marketplace",
    displayName: { ru: "Авиабилеты", az: "Aviabiletlər", en: "Flights" },
    description: { ru: "Поиск авиабилетов", az: "Aviabilet axtarışı", en: "Flight search" },
    allowedContexts: ["marketplace"],
    allowedLayouts: ["grid-4", "grid-3", "grid-2", "full-width"],
    defaultSettings: { pageSize: 6 },
    defaultLayout: "grid-4",
    singleton: true,
    removable: true,
    dataSourceType: "product-feed",
  },
  {
    type: "advertisement",
    version: 1,
    category: "marketplace",
    displayName: { ru: "Реклама", az: "Reklam", en: "Advertisement" },
    description: { ru: "Блок рекламы", az: "Reklam bloku", en: "Advertisement block" },
    allowedContexts: ["marketplace"],
    allowedLayouts: ["full-width"],
    defaultSettings: {},
    defaultLayout: "full-width",
    singleton: true,
    removable: true,
    dataSourceType: "static-config",
  },
  {
    type: "footer",
    version: 1,
    category: "system",
    displayName: { ru: "Подвал", az: "Alt bilgi", en: "Footer" },
    description: { ru: "Подвал страницы", az: "Səhifənin alt bilgisi", en: "Page footer" },
    allowedContexts: ["marketplace"],
    allowedLayouts: ["full-width"],
    defaultSettings: {},
    defaultLayout: "full-width",
    singleton: true,
    removable: false,
    dataSourceType: "static-config",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getBlockDefinition(type: string): BlockRegistryEntry | undefined {
  return BLOCK_REGISTRY.find((b) => b.type === type);
}

export function getBlocksForContext(context: string): BlockRegistryEntry[] {
  return BLOCK_REGISTRY.filter((b) => b.allowedContexts.includes(context));
}

export function isBlockRegistered(type: string): boolean {
  return BLOCK_REGISTRY.some((b) => b.type === type);
}
