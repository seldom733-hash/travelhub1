/**
 * Канонические имена CRM-партнёров по токенам адаптеров поставщиков.
 *
 * Список поставщиков для поисковых пикеров («Поставщики») берётся из CRM
 * (crm.Partner), а не из кода адаптеров: имя и признак активности партнёра
 * решают, как поставщик называется в форме и показывается ли он вовсе.
 * Единый источник для supplier-aggregator (пикер) и finance (курсы
 * поставщиков) — правится в одном месте.
 */
export const SUPPLIER_TOKEN_CRM_NAMES: Record<string, string> = {
  SUMMERTOUR: "Summertour",
  KOMPAS: "Kompastour",
  KAZUNION: "Kazunion",
  ANEX: "Anextour",
  AZAL: "AZAL",
  AVIASALES: "Aviasales",
};
