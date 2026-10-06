/**
 * Supplier Markup (PHASE 4 §4.1/§4.2, Gate A) — source-registry spec.
 *
 * Статические проверки: sidebar-пункт с pricing.markup.read; i18n-ключи
 * markup.* резолвятся во всех трёх локалях; страница подключена к matrix/rules
 * API, гейтится pricing.markup.manage и хранит CAS expectedVersion; на
 * клиенте НЕТ хардкод-списков поставщиков (строки/колонки матрицы приходят
 * только из backend-реестров).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { t, type Locale } from "./i18n";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const SHELL = read("components/Shell.tsx");
const I18N = read("lib/i18n.tsx");
const PAGE = read("app/app/pricing/markup/page.tsx");
const API_LIB = read("lib/pricing-api.ts");

const LOCALES: Locale[] = ["ru", "az", "en"];

const REQUIRED_KEYS = [
  "nav.markup_matrix",
  "markup.matrix.title",
  "markup.matrix.supplier",
  "markup.matrix.not_configured",
  "markup.matrix.hint",
  "markup.matrix.empty",
  "markup.rules.title",
  "markup.filter.all_suppliers",
  "markup.filter.all_services",
  "markup.filter.all_statuses",
  "markup.table.code",
  "markup.table.supplier",
  "markup.table.service",
  "markup.table.rate",
  "markup.table.status",
  "markup.table.period",
  "markup.table.version",
  "markup.table.actions",
  "markup.actions.create",
  "markup.actions.edit",
  "markup.actions.activate",
  "markup.actions.archive",
  "markup.actions.history",
  "markup.actions.save",
  "markup.form.create_title",
  "markup.form.edit_title",
  "markup.form.supplier",
  "markup.form.service",
  "markup.form.rate",
  "markup.form.rate_hint",
  "markup.form.effective_from",
  "markup.form.effective_to",
  "markup.form.required",
  "markup.form.rate_invalid",
  "markup.history.title",
  "markup.history.empty",
];

describe("Supplier Markup Phase 4 admin registry — matrix + rules (§4.1/§4.2)", () => {
  it("sidebar: /app/pricing/markup в финансовой группе с правом pricing.markup.read", () => {
    expect(SHELL).toContain('href: "/app/pricing/markup"');
    expect(SHELL).toContain('labelKey: "nav.markup_matrix"');
    expect(SHELL).toContain('permission: "pricing.markup.read"');
  });

  it("i18n: все ключи markup.* определены и резолвятся во всех трёх локалях", () => {
    for (const key of REQUIRED_KEYS) {
      expect(I18N).toContain(`"${key}"`);
      for (const locale of LOCALES) {
        const value = t(key, locale);
        expect(value).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it("page: подключён к matrix/rules API, гейтится manage и хранит CAS-версию", () => {
    expect(PAGE).toContain("pricingApi.matrix()");
    expect(PAGE).toContain('useCan("pricing.markup.manage")');
    expect(PAGE).toContain("pricingApi.rules.create");
    expect(PAGE).toContain("pricingApi.rules.update");
    expect(PAGE).toContain("pricingApi.rules.activate");
    expect(PAGE).toContain("pricingApi.rules.archive");
    expect(PAGE).toContain("pricingApi.rules.history");
    expect(PAGE).toContain("expectedVersion");
  });

  it("api lib: backend-пути /pricing/markup-matrix и /pricing/markup-rules", () => {
    expect(API_LIB).toContain("/markup-matrix");
    expect(API_LIB).toContain("/markup-rules");
    expect(API_LIB).toContain("formatRatePercent");
  });

  it("Gate A: на клиенте нет хардкод-списков поставщиков/сервисов", () => {
    for (const src of [PAGE, API_LIB]) {
      expect(src).not.toMatch(/KOMPAS|SUMMERTOUR|KAZUNION|ANEX|AVIASALES|"AZAL"/);
    }
    // матрица строится ТОЛЬКО из ответа backend-реестров
    expect(PAGE).toContain("matrix?.suppliers");
    expect(PAGE).toContain("matrix?.services");
  });
});
