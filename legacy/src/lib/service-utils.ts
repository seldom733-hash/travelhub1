/** Утилиты для отображения услуг на главной странице. */

export function parseImages(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

export function formatPrice(price: number, currency = "USD"): string {
  const sym: Record<string, string> = { USD: "$", EUR: "€", AZN: "₼", RUB: "₽", TRY: "₺", GBP: "£" };
  const n = Math.round(price).toLocaleString("ru-RU");
  return `${sym[currency] || currency + " "}${n}`;
}

export const TYPE_META: Record<string, { label: string; icon: string; per: string }> = {
  TOUR: { label: "Тур", icon: "🏖", per: "за человека" },
  HOTEL: { label: "Отель", icon: "🏨", per: "за ночь" },
  SANATORIUM: { label: "Санаторий", icon: "🏥", per: "за день" },
  FLIGHT: { label: "Авиабилет", icon: "✈", per: "за билет" },
  TRAIN: { label: "Ж/д билет", icon: "🚄", per: "за билет" },
  EXCURSION: { label: "Экскурсия", icon: "🏛", per: "за человека" },
  GUIDE: { label: "Гид", icon: "🧭", per: "в час" },
  TRANSFER: { label: "Трансфер", icon: "🚐", per: "за поездку" },
  PHOTOGRAPHER: { label: "Фотограф", icon: "📷", per: "в час" },
};

export const TYPE_LIST = Object.keys(TYPE_META);
