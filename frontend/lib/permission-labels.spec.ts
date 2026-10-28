import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  PERMISSION_LABELS,
  permissionGroupLabel,
  permissionLabel,
  humanizePermissionMessage,
} from "./permission-labels";

/**
 * The dictionary must cover every permission actually declared in the backend
 * catalog. The backend identifiers stay untouched; this is display-only.
 */
function backendPermissionCodes(): string[] {
  const source = readFileSync(new URL("../../backend/src/security/permissions.constants.ts", import.meta.url), "utf8");
  return [...source.matchAll(/"([a-z0-9_.-]+)":\s*"/g)].map((m) => m[1]);
}

describe("permission labels", () => {
  it("covers every backend permission with a human-readable Russian name", () => {
    const codes = [...new Set(backendPermissionCodes())];
    expect(codes.length).toBe(184);
    const missing = codes.filter((code) => !PERMISSION_LABELS[code]?.ru);
    expect(missing).toEqual([]);
    for (const code of codes) {
      const label = permissionLabel(code, "ru");
      expect(label.trim().length).toBeGreaterThan(0);
      expect(label).not.toContain(code);
      expect(label).not.toMatch(/own-scope|Product|Step \d|\bKPI\b|Supplier[A-Z]|MarkupRule/);
    }
  });

  it("uses business wording for the required examples", () => {
    expect(permissionLabel("account.booking.read_own")).toBe("Просмотр собственных бронирований");
    expect(permissionLabel("order.read")).toBe("Просмотр заказов");
    expect(permissionLabel("finance.payment.read")).toBe("Просмотр платежей");
    expect(permissionLabel("finance.payment.create")).toBe("Создание платежей");
    expect(permissionLabel("hotel_directory.read")).toBe("Просмотр гостиничного справочника");
  });

  it("is ready for az/en and falls back to Russian", () => {
    expect(permissionLabel("finance.payment.read", "az")).toBe("Просмотр платежей");
    expect(permissionLabel("finance.payment.read", "en")).toBe("Просмотр платежей");
  });

  it("humanizes an unknown code, logs it once and never exposes the dotted identifier", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const first = permissionLabel("custom.unknown.permission");
    const second = permissionLabel("custom.unknown.permission");
    expect(first).toBe("Custom unknown permission");
    expect(first).not.toContain("custom.unknown.permission");
    expect(second).toBe(first);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("localizes backend permission errors", () => {
    expect(humanizePermissionMessage("Missing permission(s): finance.payment.read, catalog.product.write")).toBe(
      "Недостаточно прав: Просмотр платежей, Создание и изменение турпродуктов",
    );
    expect(humanizePermissionMessage("Unknown permission(s): finance.unknown")).toBe(
      "Неизвестные права: Finance unknown",
    );
    expect(humanizePermissionMessage("Forbidden")).toBe("Forbidden");
  });

  it("uses section names instead of technical prefixes", () => {
    expect(permissionGroupLabel("finance")).toBe("Финансы");
    expect(permissionGroupLabel("hotel_directory")).toBe("Гостиничный справочник");
  });
});
