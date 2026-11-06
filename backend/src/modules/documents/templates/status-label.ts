export function statusRu(status: string | null): string {
  const map: Record<string, string> = {
    UNPAID: "Не оплачен",
    PARTIALLY_PAID: "Частично оплачен",
    PAID: "Оплачен",
    CAPTURED: "Получен",
    CONFIRMED: "Подтверждён",
    PENDING: "Ожидает",
    PROCESSED: "Проведён",
    REQUESTED: "Запрошен",
    APPROVED: "Согласован",
    REFUNDED: "Возвращён",
    CANCELLED: "Отменён",
    FAILED: "Ошибка",
  };
  return status ? map[status] ?? status : "N/A";
}
