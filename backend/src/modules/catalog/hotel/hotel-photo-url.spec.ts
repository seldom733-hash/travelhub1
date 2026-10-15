import { hotelPhotoUrl } from "./hotel-photo-url";

/**
 * Единый каталог фотографий отелей: ссылка на фото и её версия.
 *
 * Ключевое свойство — «замена главного фото распространяется на все карточки»:
 * файл на диске остаётся один (`hotel_<hotelId>.webp`), но ссылка получает новую
 * версию, поэтому браузер/CDN не отдают старое изображение из кэша.
 */
describe("hotelPhotoUrl", () => {
  it("даёт одну и ту же ссылку для одной и той же версии", () => {
    const at = new Date("2026-10-15T12:00:00.000Z");
    expect(hotelPhotoUrl("hotel_abc.webp", at)).toBe(hotelPhotoUrl("hotel_abc.webp", at));
  });

  it("меняет ссылку при замене фото (файл тот же) — инвалидация кэша", () => {
    const before = hotelPhotoUrl("hotel_abc.webp", new Date("2026-10-15T12:00:00.000Z"));
    const after = hotelPhotoUrl("hotel_abc.webp", new Date("2026-11-01T09:30:00.000Z"));
    expect(before).toContain("/hotels/hotel_abc.webp");
    expect(after).toContain("/hotels/hotel_abc.webp");
    expect(before).not.toBe(after);
  });

  it("без версии отдаёт чистую ссылку", () => {
    expect(hotelPhotoUrl("hotel_abc.webp", null)).toBe("/hotels/hotel_abc.webp");
    expect(hotelPhotoUrl("hotel_abc.webp", undefined)).toBe("/hotels/hotel_abc.webp");
  });

  it("никогда не отдаёт абсолютный путь файловой системы", () => {
    const url = hotelPhotoUrl("hotel_abc.webp", new Date());
    expect(url.startsWith("/hotels/")).toBe(true);
    expect(url).not.toMatch(/[A-Za-z]:\\/);
  });
});
