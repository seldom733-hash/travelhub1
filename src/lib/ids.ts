/**
 * Каноническая ID Policy (Baseline 1.1, §0.8).
 *
 * Бизнес-идентификаторы неизменяемы и генерируются только доменом-владельцем:
 *   PRD-* Product/Service, ORD-* Order, BKG-* Booking, CUS-* Customer,
 *   USR-* User; следующие фазы: LED-*, OPP-*, QTE-*, SAL-* (Sales Center).
 * Order дополнительно имеет пользовательский номер TH-YYYY-######.
 *
 * Формат номера: PREFIX-00000001 (8 цифр, слева нулями).
 */

/** Следующий бизнес-код: префикс + максимальный существующий номер + 1. */
export function nextBusinessCode(prefix: string, existing: string[]): string {
  let seq = 0;
  for (const code of existing) {
    const m = /^([A-Z]+)-(\d+)$/.exec(code);
    if (m && m[1] === prefix) {
      const n = parseInt(m[2], 10);
      if (n > seq) seq = n;
    }
  }
  return `${prefix}-${String(seq + 1).padStart(8, "0")}`;
}

/**
 * Пользовательский номер заказа TH-YYYY-###### (Baseline §0.8).
 * Последовательность ###### — сквозная (по максимальному существующему номеру
 * за выбранный год), а не по числу заказов года: номера не повторяются.
 */
export function orderUserNumber(year: number, existing: string[]): string {
  let seq = 0;
  for (const code of existing) {
    const m = new RegExp(`^TH-${year}-(\\d{6})$`).exec(code);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > seq) seq = n;
    }
  }
  return `TH-${year}-${String(seq + 1).padStart(6, "0")}`;
}

/** Код пользователя: USR-* для персонала, CUS-* для клиентов/партнёров. */
export function userBusinessCode(role: string, existing: string[]): string {
  const prefix = role === "BUYER" || role === "PARTNER" ? "CUS" : "USR";
  return nextBusinessCode(prefix, existing);
}
