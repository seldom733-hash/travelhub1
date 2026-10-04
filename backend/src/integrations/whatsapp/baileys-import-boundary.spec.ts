import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "@jest/globals";

/**
 * Статическая проверка границы I1: Baileys импортируется ТОЛЬКО из
 * `integrations/whatsapp/provider/baileys/` (реализация провайдера, M2+).
 * Ни один business-домен (crm/booking/order/finance/communication/...) и ни
 * один инфраструктурный модуль не может импортировать Baileys напрямую.
 */

const SRC_ROOT = path.resolve(__dirname, "..", "..", "..");
const BAILEYS_IMPL_DIR = path.join(SRC_ROOT, "integrations", "whatsapp", "provider", "baileys");

const IMPORT_PATTERN =
  /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)["']baileys["']/;

function listTypeScriptFiles(dir: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "generated") continue;
      result.push(...listTypeScriptFiles(full));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      result.push(full);
    }
  }
  return result;
}

describe("I1 - Baileys import boundary (static check)", () => {
  it('baileys импортируется только из integrations/whatsapp/provider/baileys/', () => {
    const offenders: string[] = [];
    for (const file of listTypeScriptFiles(SRC_ROOT)) {
      // Сам файл проверки (само-тест) содержит baileys только в строках.
      if (file === __filename) continue;
      const content = fs.readFileSync(file, "utf8");
      if (!IMPORT_PATTERN.test(content)) continue;
      if (!file.startsWith(BAILEYS_IMPL_DIR)) offenders.push(path.relative(SRC_ROOT, file));
    }
    expect(offenders).toEqual([]);
  });

  it("проверка работает: файл с baileys-импортом вне разрешённой директории падает", () => {
    const sample = 'import type { BaileysEventMap } from "baileys";';
    expect(IMPORT_PATTERN.test(sample)).toBe(true);
    expect(IMPORT_PATTERN.test('const baileys = require("baileys");')).toBe(true);
    expect(IMPORT_PATTERN.test("import('baileys')")).toBe(true);
    // Комментарии/строки без реального импорта не считаются нарушением.
    expect(IMPORT_PATTERN.test("// провайдер baileys подключается в M2")).toBe(false);
  });
});
