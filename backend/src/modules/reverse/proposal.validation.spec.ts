import { ValidationDomainError } from "../../shared/errors";
import {
  normalizeProposalContent,
  normalizeProposalMoney,
  normalizeProposalValidUntil,
  hasForbiddenText,
  normalizeTextField,
  MAX_AMOUNT,
} from "./proposal.validation";

describe("Step 2.2D — proposal.validation (unit)", () => {
  describe("normalizeProposalMoney", () => {
    it("отсутствие/undefined → PRICE_ON_REQUEST (null amount, null currency)", () => {
      expect(normalizeProposalMoney(undefined)).toEqual({ amount: null, currency: null });
      expect(normalizeProposalMoney(null)).toEqual({ amount: null, currency: null });
    });

    it("валидная сумма (number и string) + currency → toFixed(2)", () => {
      expect(normalizeProposalMoney({ amount: 1234.5, currency: "USD" })).toEqual({
        amount: "1234.50",
        currency: "USD",
      });
      expect(normalizeProposalMoney({ amount: "99.99", currency: "AZN" })).toEqual({
        amount: "99.99",
        currency: "AZN",
      });
      expect(normalizeProposalMoney({ amount: 0, currency: "EUR" })).toEqual({ amount: "0.00", currency: "EUR" });
    });

    it("отрицательная сумма → 422", () => {
      expect(() => normalizeProposalMoney({ amount: -1, currency: "USD" })).toThrow(ValidationDomainError);
    });

    it("NaN/Infinity/строка-мусор → 422", () => {
      expect(() => normalizeProposalMoney({ amount: Number.NaN, currency: "USD" })).toThrow(ValidationDomainError);
      expect(() => normalizeProposalMoney({ amount: Number.POSITIVE_INFINITY, currency: "USD" })).toThrow(
        ValidationDomainError,
      );
      expect(() => normalizeProposalMoney({ amount: "abc", currency: "USD" })).toThrow(ValidationDomainError);
    });

    it("более 2 знаков после запятой → 422", () => {
      expect(() => normalizeProposalMoney({ amount: 1.234, currency: "USD" })).toThrow(ValidationDomainError);
    });

    it(`сумма выше MAX_AMOUNT (${MAX_AMOUNT}) → 422; граница Decimal(12,2) совпадает с БД`, () => {
      expect(() => normalizeProposalMoney({ amount: MAX_AMOUNT + 1, currency: "USD" })).toThrow(ValidationDomainError);
      // Overflow БД: 10_000_000_000.00 > Decimal(12,2) макс (9_999_999_999.99) → 422,
      // а не 500 (валидация совпадает с ёмкостью колонки).
      expect(() => normalizeProposalMoney({ amount: 10_000_000_000, currency: "USD" })).toThrow(ValidationDomainError);
      // Точная граница проходит.
      expect(normalizeProposalMoney({ amount: MAX_AMOUNT, currency: "USD" }).amount).toBe("9999999999.99");
    });

    it("невалидная валюта → 422 (не ISO 4217)", () => {
      expect(() => normalizeProposalMoney({ amount: 10, currency: "usd" })).toThrow(ValidationDomainError);
      expect(() => normalizeProposalMoney({ amount: 10, currency: "USD!" })).toThrow(ValidationDomainError);
      expect(() => normalizeProposalMoney({ amount: 10, currency: "US" })).toThrow(ValidationDomainError);
    });

    it("currency без amount → 422 (нет silent conversion)", () => {
      expect(() => normalizeProposalMoney({ currency: "USD" })).toThrow(ValidationDomainError);
    });

    it("unknown keys / не-объект → 422", () => {
      expect(() => normalizeProposalMoney({ amount: 10, currency: "USD", price: 5 })).toThrow(ValidationDomainError);
      expect(() => normalizeProposalMoney("10")).toThrow(ValidationDomainError);
    });
  });

  describe("normalizeProposalContent", () => {
    it("undefined → все null", () => {
      expect(normalizeProposalContent(undefined)).toEqual({
        description: null,
        includedServices: null,
        exclusions: null,
        conditions: null,
        notes: null,
      });
    });

    it("валидный контент → trim + null для пустых", () => {
      const out = normalizeProposalContent({ description: "  Тур по Баку  ", notes: "Включён трансфер" });
      expect(out.description).toBe("Тур по Баку");
      expect(out.includedServices).toBeNull();
      expect(out.notes).toBe("Включён трансфер");
    });

    it("пустой контент (все поля пустые) → все null (PRICE_ON_REQUEST-only Proposal легален)", () => {
      expect(normalizeProposalContent({ description: "  " })).toEqual({
        description: null,
        includedServices: null,
        exclusions: null,
        conditions: null,
        notes: null,
      });
    });

    it("HTML/script markup → 422 (анти-injection)", () => {
      expect(() => normalizeProposalContent({ description: "<script>alert(1)</script>" })).toThrow(
        ValidationDomainError,
      );
      expect(() => normalizeProposalContent({ description: "<b>жирный</b>" })).toThrow(ValidationDomainError);
      expect(() => normalizeProposalContent({ description: "javascript:alert(1)" })).toThrow(ValidationDomainError);
    });

    it("контакты/URL → 422 (анти-disintermediation)", () => {
      expect(() => normalizeProposalContent({ description: "пишите на sales@test.com" })).toThrow(
        ValidationDomainError,
      );
      expect(() => normalizeProposalContent({ description: "звоните +994 50 123 45 67" })).toThrow(
        ValidationDomainError,
      );
      expect(() => normalizeProposalContent({ description: "сайт www.example.com" })).toThrow(ValidationDomainError);
      expect(() => normalizeProposalContent({ description: "telegram: @travelhub_seller" })).toThrow(
        ValidationDomainError,
      );
    });

    it("unknown keys → 422", () => {
      expect(() => normalizeProposalContent({ description: "x", phone: "123" })).toThrow(ValidationDomainError);
    });

    it("длина > MAX → 422", () => {
      expect(() => normalizeTextField("a".repeat(4001), "description")).toThrow(ValidationDomainError);
    });

    it("не-строка → 422", () => {
      expect(() => normalizeProposalContent({ description: 123 })).toThrow(ValidationDomainError);
    });

    it("control chars (кроме \t\n\r) → 422", () => {
      expect(() => normalizeProposalContent({ description: "нормальный\u0000текст" })).toThrow(ValidationDomainError);
      expect(() => normalizeProposalContent({ description: "разрыв\u0007строка" })).toThrow(ValidationDomainError);
      expect(() => normalizeProposalContent({ description: "\u007F" })).toThrow(ValidationDomainError);
      // Табуляция/переносы строк — легальны (plain text).
      expect(normalizeProposalContent({ description: "строка\nс переносом\tи табом" }).description).toBe(
        "строка\nс переносом\tи табом",
      );
    });
  });

  describe("hasForbiddenText", () => {
    it("детектирует email/phone/url/social", () => {
      expect(hasForbiddenText("mail: a@b.com")).not.toBeNull();
      expect(hasForbiddenText("tel +7 900 123-45-67")).not.toBeNull();
      expect(hasForbiddenText("https://example.com")).not.toBeNull();
      expect(hasForbiddenText("t.me/hub")).not.toBeNull();
    });
    it("обычный текст — чисто", () => {
      expect(hasForbiddenText("Полный тур с завтраками в отеле 5*")).toBeNull();
      expect(hasForbiddenText("Цена включает все налоги")).toBeNull();
    });
    it("ISO-даты (YYYY-MM-DD) в тексте НЕ считаются телефоном (анти-false-positive)", () => {
      expect(hasForbiddenText("даты: 2026-09-01 по 2026-09-07")).toBeNull();
      expect(hasForbiddenText("заезд 2026-12-31")).toBeNull();
      // Но настоящий телефон всё равно ловится рядом с датами.
      expect(hasForbiddenText("даты: 2026-09-01, звоните +994 50 123 45 67")).not.toBeNull();
    });
  });

  describe("normalizeProposalValidUntil", () => {
    it("date-only → UTC midnight", () => {
      const d = normalizeProposalValidUntil("2026-12-31");
      expect(d).not.toBeNull();
      expect(d!.toISOString()).toBe("2026-12-31T00:00:00.000Z");
    });
    it("undefined/null → null", () => {
      expect(normalizeProposalValidUntil(undefined)).toBeNull();
      expect(normalizeProposalValidUntil(null)).toBeNull();
    });
    it("не-дата/не-формат → 422", () => {
      expect(() => normalizeProposalValidUntil("31-12-2026")).toThrow(ValidationDomainError);
      expect(() => normalizeProposalValidUntil("2026-13-01")).toThrow(ValidationDomainError);
      expect(() => normalizeProposalValidUntil("tomorrow")).toThrow(ValidationDomainError);
    });
  });
});
