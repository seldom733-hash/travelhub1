/**
 * Центр бизнес-аналитики (Гл. 2) — единый вход для всех модулей.
 */
export { getOverviewData } from "./overview";
export { getSalesData } from "./sales";
export { getOrdersData } from "./orders";
export { getBookingsData } from "./bookings";
export { getFinanceData } from "./finance";
export { getCrmData } from "./crm";
export { getPartnersData } from "./partners";
export { getCatalogData } from "./catalog";
export { getMarketingData } from "./marketing";
export * from "@/lib/analytics";

import type { AnalyticsFilters, AnalyticsSection } from "@/lib/analytics";
import type { AnalyticsSectionData } from "@/lib/analytics";
import { getOverviewData } from "./overview";
import { getSalesData } from "./sales";
import { getOrdersData } from "./orders";
import { getBookingsData } from "./bookings";
import { getFinanceData } from "./finance";
import { getCrmData } from "./crm";
import { getPartnersData } from "./partners";
import { getCatalogData } from "./catalog";
import { getMarketingData } from "./marketing";

export const ANALYTICS_SECTIONS: { key: AnalyticsSection; title: string; icon: string }[] = [
  { key: "overview", title: "Общая аналитика", icon: "🏛️" },
  { key: "sales", title: "Продажи", icon: "💼" },
  { key: "orders", title: "Заказы", icon: "📦" },
  { key: "bookings", title: "Бронирования", icon: "📑" },
  { key: "finance", title: "Финансы", icon: "💰" },
  { key: "crm", title: "Клиенты (CRM)", icon: "👥" },
  { key: "partners", title: "Партнёры", icon: "🤝" },
  { key: "catalog", title: "Каталог услуг", icon: "🗂️" },
  { key: "marketing", title: "Маркетинг", icon: "📣" },
];

const BUILDERS: Record<AnalyticsSection, (f: AnalyticsFilters) => Promise<AnalyticsSectionData>> = {
  overview: getOverviewData,
  sales: getSalesData,
  orders: getOrdersData,
  bookings: getBookingsData,
  finance: getFinanceData,
  crm: getCrmData,
  partners: getPartnersData,
  catalog: getCatalogData,
  marketing: getMarketingData,
};

export function isAnalyticsSection(value: string): value is AnalyticsSection {
  return value in BUILDERS;
}

export async function buildAnalyticsSection(section: AnalyticsSection, filters: AnalyticsFilters): Promise<AnalyticsSectionData> {
  return BUILDERS[section](filters);
}
