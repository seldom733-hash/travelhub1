/**
 * Дефолтные курсы валют нового поставщика: «1 sourceCurrency = N AZN».
 *
 * Вынесены в нейтральный shared-модуль, чтобы И crm.service (авто-курсы при
 * создании поставщика), и supplier-fx-rate.service (FX-админка/валидация)
 * читали ОДИН источник правды без петли импортов crm ↔ finance.
 */
export const DEFAULT_SUPPLIER_FX_RATES: ReadonlyArray<readonly [string, string]> = [
  ["USD", "1.7"],
  ["EUR", "1.91"],
];
