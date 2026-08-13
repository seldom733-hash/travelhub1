/**
 * PHASE 2 STEP 2.10 — Finance money contract.
 *
 * Финансовые суммы используют ПЛАТФОРМЕННЫЙ денежный контракт (single source
 * of truth): DECIMAL(12,2), half-up 2dp, decimal.js — тот же, что в
 * sales.money (Quote → CheckoutIntent → Sale → Order → Booking → Finance,
 * Roadmap Step 2.10 §7 «Money model — HARD GATE»).
 *
 * Finance НЕ пересчитывает frozen коммерческие факты (суммы Order/Quote
 * потребляются как есть), но при создании собственных финансовых фактов
 * (amount/rate) использует тот же контракт — без JS floating-point.
 *
 * Cross-module import: чистые helper-функции (без сервисов) — прецедент в
 * проекте (reverse импортирует parseServiceDate из sales.checkout).
 */
export {
  toMoney2,
  MONEY_SCALE,
  MONEY_MAX,
  type MoneyInput,
} from "../sales/sales.money";
