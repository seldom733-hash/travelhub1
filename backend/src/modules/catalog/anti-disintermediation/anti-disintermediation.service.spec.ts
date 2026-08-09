import { AntiDisintermediationService } from "./anti-disintermediation.service";
import { ValidationDomainError } from "../../../shared/errors";

describe("AntiDisintermediationService (Phase 1 Step 1.11) — unit", () => {
  const svc = new AntiDisintermediationService();

  it("email детектируется → EXTERNAL_CONTACT_INFO", () => {
    const v = svc.detect("Обращайтесь: info@example.com для вопросов", "description");
    expect(v.some((x) => x.code === "EXTERNAL_CONTACT_INFO" && x.match.includes("info@example.com"))).toBe(true);
  });

  it("URL детектируется → EXTERNAL_CONTACT_INFO (не booking-домен)", () => {
    const v = svc.detect("Подробнее на https://example.org/tour", "description");
    expect(v.some((x) => x.code === "EXTERNAL_CONTACT_INFO")).toBe(true);
  });

  it("внешний booking-домен → EXTERNAL_BOOKING_LINK", () => {
    const v = svc.detect("Бронируйте напрямую: booking.com/hotel123", "description");
    expect(v.some((x) => x.code === "EXTERNAL_BOOKING_LINK" && x.match.includes("booking.com"))).toBe(true);
  });

  it("phone-like → EXTERNAL_CONTACT_INFO", () => {
    const v = svc.detect("Звоните +7 999 123-45-67", "description");
    expect(v.some((x) => x.code === "EXTERNAL_CONTACT_INFO" && x.match.includes("+7"))).toBe(true);
  });

  it("whatsapp/telegram → DISINTERMEDIATION_ATTEMPT", () => {
    const v = svc.detect("Наш WhatsApp: wa.me/79990000000", "description");
    expect(v.some((x) => x.code === "DISINTERMEDIATION_ATTEMPT")).toBe(true);
  });

  it("«напишите напрямую» → DISINTERMEDIATION_ATTEMPT", () => {
    const v = svc.detect("Напишите нам напрямую, мы ответим быстрее", "publicDescription");
    expect(v.some((x) => x.code === "DISINTERMEDIATION_ATTEMPT")).toBe(true);
  });

  it("упоминание QR → QR_CODE_OR_CONTACT_MEDIA", () => {
    const v = svc.detect("QR-код в описании", "description");
    expect(v.some((x) => x.code === "QR_CODE_OR_CONTACT_MEDIA")).toBe(true);
  });

  it("caption/altText сканируются через scanFields", () => {
    const v = svc.scanFields([
      { value: "Фото отеля", field: "caption#1" },
      { value: "Напишите нам: test@mail.ru", field: "altText#2" },
    ]);
    expect(v.some((x) => x.field === "altText#2" && x.code === "EXTERNAL_CONTACT_INFO")).toBe(true);
  });

  it("чистый контент → без нарушений (нет false positive на цену/дни)", () => {
    const v = svc.scanFields([
      { value: "Тур на 7 дней, цена от 100.00 USD, с завтраками", field: "description" },
      { value: "Ранний заезд в 15:00", field: "caption#1" },
    ]);
    expect(v).toHaveLength(0);
  });

  it("assertNoViolations бросает ValidationDomainError с перечнем (не silent mutation)", () => {
    expect(() =>
      svc.assertNoViolations([{ value: "Сайт: www.example.com, телефон +7 900 000-00-00", field: "description" }]),
    ).toThrow(ValidationDomainError);
  });

  it("assertNoViolations не бросает на чистом контенте", () => {
    expect(() => svc.assertNoViolations([{ value: "Экскурсия по Баку на 3 часа", field: "description" }])).not.toThrow();
  });
});
