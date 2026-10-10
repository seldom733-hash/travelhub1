import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { t, type Locale } from "./i18n";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const SHELL = read("components/Shell.tsx");
const I18N = read("lib/i18n.tsx");
const PAGE = read("app/app/whatsapp/page.tsx");
const LIB = read("lib/whatsapp.ts");

const LOCALES: Locale[] = ["ru", "az", "en"];

/** Все ключи, используемые в whatsapp/page.tsx (статические + шаблонные). */
const REQUIRED_KEYS = [
  "nav.whatsapp",
  "whatsapp.title",
  "whatsapp.subtitle",
  "whatsapp.refresh",
  "whatsapp.list_title",
  "whatsapp.filter.all",
  "whatsapp.filter.UNMATCHED",
  "whatsapp.filter.MATCHED",
  "whatsapp.filter.AMBIGUOUS",
  "whatsapp.account.all",
  "whatsapp.badge.UNMATCHED",
  "whatsapp.badge.MATCHED",
  "whatsapp.badge.AMBIGUOUS",
  "whatsapp.empty_list",
  "whatsapp.no_selection",
  "whatsapp.no_selection_hint",
  "whatsapp.messages_empty",
  "whatsapp.unread_count",
  "whatsapp.suppressed",
  "whatsapp.send_placeholder",
  "whatsapp.send",
  "whatsapp.sending",
  "whatsapp.need_text",
  "whatsapp.attach",
  "whatsapp.attach_remove",
  "whatsapp.attach_uploading",
  "whatsapp.file",
  "whatsapp.send_no_permission",
  "whatsapp.context.title",
  "whatsapp.context.none",
  "whatsapp.context.BOOKING",
  "whatsapp.context.ORDER",
  "whatsapp.context.REQUEST",
  "whatsapp.context.CUSTOMER",
  "whatsapp.customer.title",
  "whatsapp.customer.none",
  "whatsapp.unknown_phone",
  "whatsapp.candidates.title",
  "whatsapp.link",
  "whatsapp.link_action",
  "whatsapp.link_search_placeholder",
  "whatsapp.link_search",
  "whatsapp.link_none",
  "whatsapp.link_no_permission",
  "whatsapp.linked_ok",
  "whatsapp.bind_phone",
  "whatsapp.bind_phone_placeholder",
  "whatsapp.bind_phone_ok",
  "whatsapp.bind_phone_cancel",
  "whatsapp.bind_phone_done",
  "whatsapp.bind_phone_no_permission",
  "whatsapp.error",
  "whatsapp.outstatus.CREATED",
  "whatsapp.outstatus.QUEUED",
  "whatsapp.outstatus.SENDING",
  "whatsapp.outstatus.SENT",
  "whatsapp.outstatus.DELIVERED",
  "whatsapp.outstatus.READ",
  "whatsapp.outstatus.FAILED_RETRYABLE",
  "whatsapp.outstatus.FAILED_PERMANENT",
  "whatsapp.outstatus.UNKNOWN",
];

describe("M3 UI registry — WhatsApp Inbox (§25)", () => {
  it("sidebar: /app/whatsapp в группе SERVICE с правом whatsapp.read", () => {
    expect(SHELL).toContain('href: "/app/whatsapp"');
    expect(SHELL).toContain('labelKey: "nav.whatsapp"');
    expect(SHELL).toContain('permission: "whatsapp.read"');
  });

  it("i18n: все ключи inbox определены и резолвятся во всех трёх локалях", () => {
    for (const key of REQUIRED_KEYS) {
      expect(I18N).toContain(`"${key}"`);
      for (const locale of LOCALES) {
        const value = t(key, locale);
        expect(value).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it("i18n: nav.whatsapp — строка словаря содержит ru/az/en", () => {
    const line = I18N.split("\n").find((l) => l.includes('"nav.whatsapp"'));
    expect(line).toBeDefined();
    expect(line).toContain("ru:");
    expect(line).toContain("az:");
    expect(line).toContain("en:");
  });

  it("page: три колонки — list/detail/messages/read/link/send эндпоинты (§25)", () => {
    expect(PAGE).toContain("/whatsapp/conversations");
    expect(PAGE).toContain("/messages");
    expect(PAGE).toContain("/read");
    expect(PAGE).toContain("/customer");
    expect(PAGE).toContain("/whatsapp/customer-search");
    // §10 LID→PN: бинд номера к lid-диалогу.
    expect(PAGE).toContain("bindWhatsAppConversationPhone");
    expect(PAGE).toContain('canonicalPhone === null && detail.remoteJid.endsWith("@lid")');
    expect(LIB).toContain("/phone");
    expect(LIB).toContain("bindWhatsAppConversationPhone");
    expect(PAGE).toContain("sendWhatsAppMessage");
    expect(PAGE).toContain('useCan("whatsapp.send")');
    expect(PAGE).toContain('useCan("whatsapp.manage")');
    // §18: опрос непрочитанных.
    expect(PAGE).toContain("setInterval");
    expect(PAGE).toContain('params.set("matchingStatus"');
    // M5: фильтр по номеру + список номеров для бейджей.
    expect(PAGE).toContain('params.set("accountId"');
    expect(PAGE).toContain("fetchWhatsAppSessions");
    expect(LIB).toContain("/whatsapp/sessions");
  });

  it("lib: отправка идёт с Idempotency-Key (§26) через POST /whatsapp/messages", () => {
    expect(LIB).toContain('"Idempotency-Key"');
    expect(LIB).toContain("/api/v1/whatsapp/messages");
    expect(LIB).toContain("credentials: \"include\"");
  });
});
