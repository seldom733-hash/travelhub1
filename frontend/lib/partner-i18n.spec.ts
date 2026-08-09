import { describe, expect, it } from "vitest";
import { pt } from "./partner-i18n";
import { t } from "./i18n";

describe("pt (Partner Cabinet i18n, Step 1.8 §21)", () => {
  it("возвращает локализованные партнёрские ярлыки (RU/AZ/EN)", () => {
    expect(pt("partner.nav.cabinet", "ru")).toBe("Кабинет партнёра");
    expect(pt("partner.nav.cabinet", "az")).toBe("Tərəfdaş kabineti");
    expect(pt("partner.nav.cabinet", "en")).toBe("Partner Cabinet");
    expect(pt("partner.status.PUBLISHED", "ru")).toBe("Опубликован");
    expect(pt("partner.reason.MISLEADING_CONTENT", "ru")).toBe("Вводящее в заблуждение содержимое");
  });

  it("fallback: партнёрский ключ отсутствует → общий marketplace t()", () => {
    // "pagination.prev" живёт в общем DICT (Step 1.7), партнёрский словарь его не дублирует.
    expect(pt("pagination.prev", "ru")).toBe(t("pagination.prev", "ru"));
    expect(pt("pagination.prev", "en")).toBe("Back");
  });

  it("неизвестный ключ → сам ключ (без падения)", () => {
    expect(pt("partner.missing.key", "ru")).toBe("partner.missing.key");
  });

  it("все три локали присутствуют для каждого партнёрского ключа", async () => {
    const { PARTNER_DICT } = await import("./partner-i18n");
    for (const [key, entry] of Object.entries(PARTNER_DICT)) {
      for (const loc of ["ru", "az", "en"] as const) {
        expect(entry[loc], `${key} [${loc}]`).toBeTruthy();
      }
    }
  });
});
