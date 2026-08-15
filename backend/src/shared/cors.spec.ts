import { describe, expect, it } from "@jest/globals";
import { isCorsOriginAllowed, parseCorsOrigins } from "./cors";

describe("Step 2.17 — CORS allowlist (вместо origin:true)", () => {
  it("default (dev): http://localhost:3000; пустая строка → пустой allowlist (fail-closed)", () => {
    expect(parseCorsOrigins(undefined)).toEqual(["http://localhost:3000"]);
    // Явная пустая строка — НЕ default: пустой allowlist → все origins отклонены.
    expect(parseCorsOrigins("")).toEqual([]);
  });

  it("CSV-список парсится, пробелы обрезаются, пустые отбрасываются", () => {
    expect(parseCorsOrigins(" https://app.example.com , https://admin.example.com ")).toEqual([
      "https://app.example.com",
      "https://admin.example.com",
    ]);
    expect(parseCorsOrigins("https://a.example.com, ,https://b.example.com")).toEqual([
      "https://a.example.com",
      "https://b.example.com",
    ]);
  });

  it("разрешённый origin — true; произвольный (не из списка) — false (НЕ wildcard)", () => {
    const origins = parseCorsOrigins("https://app.example.com,http://localhost:3000");
    expect(isCorsOriginAllowed(origins, "https://app.example.com")).toBe(true);
    expect(isCorsOriginAllowed(origins, "http://localhost:3000")).toBe(true);
    // Произвольные origins отклоняются (в т.ч. похожие-но-чужие, схемы, порты).
    expect(isCorsOriginAllowed(origins, "https://evil.example.com")).toBe(false);
    expect(isCorsOriginAllowed(origins, "https://app.example.com.evil.com")).toBe(false);
    expect(isCorsOriginAllowed(origins, "http://app.example.com")).toBe(false);
    expect(isCorsOriginAllowed(origins, "https://app.example.com:8443")).toBe(false);
    expect(isCorsOriginAllowed(origins, "null")).toBe(false);
  });

  it("пустой allowlist → любой origin отклонён (fail-closed CORS)", () => {
    expect(isCorsOriginAllowed([], "https://anything.example.com")).toBe(false);
  });

  it("без Origin (non-CORS) — не через CORS", () => {
    expect(isCorsOriginAllowed(["https://app.example.com"], undefined)).toBe(false);
  });
});
