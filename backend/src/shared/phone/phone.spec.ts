import { describe, expect, it } from "@jest/globals";
import { isValidPhone, normalizePhoneE164 } from "./phone";

describe("D4 - phone normalization (canonical E.164)", () => {
  it("валидные форматы → канонический E.164 (таблица из мастер-промпта §7)", () => {
    expect(normalizePhoneE164("+994501234567")).toBe("+994501234567");
    expect(normalizePhoneE164("994501234567")).toBe("+994501234567");
    expect(normalizePhoneE164("050 123 45 67")).toBe("+994501234567");
    expect(normalizePhoneE164("(050) 123-45-67")).toBe("+994501234567");
    expect(normalizePhoneE164("00994501234567")).toBe("+994501234567");
    expect(normalizePhoneE164("+994 (50) 123-45-67")).toBe("+994501234567");
  });

  it("невалидные значения → null (никогда не угадывать)", () => {
    expect(normalizePhoneE164("abc")).toBeNull();
    expect(normalizePhoneE164("")).toBeNull();
    expect(normalizePhoneE164("   ")).toBeNull();
    expect(normalizePhoneE164(null)).toBeNull();
    expect(normalizePhoneE164(undefined)).toBeNull();
    expect(normalizePhoneE164("123")).toBeNull();
    expect(normalizePhoneE164("+99450")).toBeNull();
  });

  it("default region участвует в разборе национального формата", () => {
    // AZ: ведущий 0 — национальный формат.
    expect(normalizePhoneE164("0501234567", "AZ")).toBe("+994501234567");
    // Другой регион — другой разбор (RU национальный формат).
    expect(normalizePhoneE164("9171234567", "RU")).toBe("+79171234567");
    expect(normalizePhoneE164("0501234567", "RU")).toBeNull();
  });

  it("isValidPhone согласован с normalizePhoneE164", () => {
    expect(isValidPhone("+994501234567")).toBe(true);
    expect(isValidPhone("garbage")).toBe(false);
    expect(isValidPhone(null)).toBe(false);
  });
});
