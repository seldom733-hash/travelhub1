import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it } from "@jest/globals";

// ESM/JSX-пакеты SecurityModule-графа (documents → @react-pdf/renderer, react)
// не трансформируются jest-ом — мокаем на уровне модуля (см.
// documents.service.spec).
jest.mock("@react-pdf/renderer", () => ({
  pdf: jest.fn().mockReturnValue({ toBlob: jest.fn() }),
  Document: "Document",
  Page: "Page",
  Text: "Text",
  View: "View",
  StyleSheet: { create: jest.fn((styles: unknown) => styles) },
}));

jest.mock("react", () => ({
  createElement: jest.fn((type: unknown, props: unknown, ...children: unknown[]) => ({
    type,
    props,
    children,
  })),
}));

import { WHATSAPP_CONFIG, WHATSAPP_PROVIDER, WhatsAppModule } from "./whatsapp.module";
import { WhatsAppConfigError, loadWhatsAppConfig, type WhatsAppConfig } from "./whatsapp.config";
import { PrismaModule } from "../../prisma/prisma.module";
import { EventBusModule } from "../../eventbus/eventbus.module";
import { SecurityModule } from "../../security/security.module";
import { MockWhatsAppProvider } from "./provider/mock/mock-whatsapp.provider";
import { BaileysWhatsAppProvider } from "./provider/baileys/baileys-provider";

/** Тестовый контур: WhatsAppModule + глобальные Prisma/EventBus + SecurityModule
 *  (в приложении глобальные модули регистрируются в AppModule; здесь — явно). */
function testingModule() {
  return Test.createTestingModule({ imports: [PrismaModule, EventBusModule, SecurityModule, WhatsAppModule] });
}

describe("WhatsAppModule (M1 «Фундамент» + M2 провайдер)", () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("предоставляет валидированную конфигурацию; фича выключена по умолчанию", async () => {
    const moduleRef = await testingModule().compile();
    const config = moduleRef.get<WhatsAppConfig>(WHATSAPP_CONFIG);
    expect(config.enabled).toBe(false);
    expect(config.provider).toBe("baileys");
    // Kill-switch: провайдер не создаётся при WHATSAPP_ENABLED=false.
    expect(moduleRef.get(WHATSAPP_PROVIDER)).toBeNull();
    await moduleRef.close();
  });

  it("fail-closed: ENABLED=true без session path/key → ошибка при создании модуля", async () => {
    process.env["WHATSAPP_ENABLED"] = "true";
    delete process.env["WHATSAPP_SESSION_PATH"];
    delete process.env["WHATSAPP_AUTH_ENCRYPTION_KEY"];
    await expect(testingModule().compile()).rejects.toThrow(WhatsAppConfigError);
  });

  it("валидная ENABLED=true конфигурация проходит (fail-closed не срабатывает)", () => {
    const config = loadWhatsAppConfig({
      WHATSAPP_ENABLED: "true",
      WHATSAPP_SESSION_PATH: "/data/whatsapp-session",
      WHATSAPP_AUTH_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
    });
    expect(config.enabled).toBe(true);
    expect(config.sessionPath).toBe("/data/whatsapp-session");
  });

  it("M2: WHATSAPP_PROVIDER=mock → WHATSAPP_PROVIDER = MockWhatsAppProvider", async () => {
    process.env["WHATSAPP_ENABLED"] = "true";
    process.env["WHATSAPP_PROVIDER"] = "mock";
    process.env["WHATSAPP_SESSION_PATH"] = "/tmp/whatsapp-module-spec-session";
    process.env["WHATSAPP_AUTH_ENCRYPTION_KEY"] = "0123456789abcdef0123456789abcdef";
    const moduleRef = await testingModule().compile();
    expect(moduleRef.get(WHATSAPP_PROVIDER)).toBeInstanceOf(MockWhatsAppProvider);
    await moduleRef.close();
  });

  it("M2: дефолтный baileys → WHATSAPP_PROVIDER = BaileysWhatsAppProvider", async () => {
    process.env["WHATSAPP_ENABLED"] = "true";
    process.env["WHATSAPP_PROVIDER"] = "baileys";
    process.env["WHATSAPP_SESSION_PATH"] = "/tmp/whatsapp-module-spec-session";
    process.env["WHATSAPP_AUTH_ENCRYPTION_KEY"] = "0123456789abcdef0123456789abcdef";
    const moduleRef = await testingModule().compile();
    expect(moduleRef.get(WHATSAPP_PROVIDER)).toBeInstanceOf(BaileysWhatsAppProvider);
    await moduleRef.close();
  });
});
