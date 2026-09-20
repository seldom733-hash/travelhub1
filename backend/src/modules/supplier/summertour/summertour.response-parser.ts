/**
 * Summer Response Parser — extracts normalized data from SAMO DOM.
 *
 * Handles: tourKey/spoKey/hotelKey/roomKey/mealKey, price/currency,
 * resort vs country, flight seats (fr_place_*), stop-sale (when explicit).
 */

export interface RawSummerOffer {
  hotelKey: string;
  spoKey: string;
  tourKey: string;
  mealKey: string;
  roomKey: string;
  nights: number;
  checkIn: string;
  adults: number;
  children: number;
  claim: string;
  hotel: string;
  price: number;
  currency: string;
  departureDate: string;
  transport: string;
  roomText: string;
  mealText: string;
  flightSeatsAvailable: boolean | null;
  stopSale: boolean | null;
}

export async function parseSummerOffers(page: any): Promise<RawSummerOffer[]> {
  return page.evaluate(() => {
    const rows = document.querySelectorAll("tr.price_info");
    const out: any[] = [];
    for (const row of rows as any) {
      const cls = (row as HTMLElement).className;
      const hotelKey = cls.match(/hotelKey-(\d+)/)?.[1] ?? "";
      const spoKey = cls.match(/spoKey-(\d+)/)?.[1] ?? "";
      const tourKey = cls.match(/tourKey-(\d+)/)?.[1] ?? "";
      const mealKey = cls.match(/mealKey-(\d+)/)?.[1] ?? "";
      const roomKey = cls.match(/roomKey-(\d+)/)?.[1] ?? "";
      const nights = parseInt(cls.match(/nights-(\d+)/)?.[1] ?? "0");
      const checkIn = cls.match(/checkIn-(\d+)/)?.[1] ?? "";
      const adults = parseInt(cls.match(/adult-(\d+)/)?.[1] ?? "0");
      const children = parseInt(cls.match(/child-(\d+)/)?.[1] ?? "0");
      const claim = row.getAttribute("data-cat-claim") ?? "";
      const hotel = (row.querySelector(".link-hotel") as HTMLElement | null)?.textContent?.trim() ?? "";
      const priceEl = row.querySelector("[data-cat-price]") as HTMLElement | null;
      const price = parseFloat(priceEl?.getAttribute("data-cat-price") ?? "0");
      const currency = priceEl?.getAttribute("data-currency_title") ?? "USD";
      const departureDate = (row.querySelector(".sortie") as HTMLElement | null)?.textContent?.trim() ?? "";
      const transport = (row.querySelector(".transport") as HTMLElement | null)?.textContent?.trim() ?? "";
      const cells = row.querySelectorAll("td");
      let roomText = "";
      let mealText = "";
      if (cells.length >= 8) {
        mealText = (cells[6] as HTMLElement)?.textContent?.trim() ?? "";
        roomText = (cells[7] as HTMLElement)?.textContent?.trim() ?? "";
      }
      // Flight seats: look for fr_place attributes on row or hidden fields
      // Summer marks flight availability via data attributes or cell text; we check for Y
      let flightSeatsAvailable: boolean | null = null;
      const frR = (row as HTMLElement).getAttribute("data-fr-place-r") ?? (row as HTMLElement).getAttribute("fr_place_r");
      const frL = (row as HTMLElement).getAttribute("data-fr-place-l") ?? (row as HTMLElement).getAttribute("fr_place_l");
      if (frR === "Y" || frL === "Y") flightSeatsAvailable = true;
      else if (frR === "N" || frL === "N") flightSeatsAvailable = false;

      // Stop-sale: only if explicit marker present, otherwise null (Test 11)
      let stopSale: boolean | null = null;
      const stopEl = row.querySelector("[data-stop-sale], [data-blocked]") as HTMLElement | null;
      if (stopEl) {
        const v = stopEl.getAttribute("data-stop-sale") ?? stopEl.getAttribute("data-blocked");
        if (v === "1" || v === "true") stopSale = true;
        else if (v === "0" || v === "false") stopSale = false;
      }

      out.push({ hotelKey, spoKey, tourKey, mealKey, roomKey, nights, checkIn, adults, children, claim, hotel, price, currency, departureDate, transport, roomText, mealText, flightSeatsAvailable, stopSale });
    }
    return out;
  });
}

export function classifyAvailability(rawCount: number, hasBlockedMarker: boolean): "AVAILABLE" | "NO_RESULT" | "BLOCKED" | "UNKNOWN" {
  if (hasBlockedMarker) return "BLOCKED";
  if (rawCount > 0) return "AVAILABLE";
  return "NO_RESULT";
}
