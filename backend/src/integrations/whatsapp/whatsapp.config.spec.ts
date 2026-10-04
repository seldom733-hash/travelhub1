import { describe, expect, it } from "@jest/globals";
import {
  WHATSAPP_THROTTLE_DEFAULTS,
  WhatsAppConfigError,
  loadWhatsAppConfig,
} from "./whatsapp.config";

const ENABLED_VALID = {
  WHATSAPP_ENABLED: "true",
  WHATSAPP_SESSION_PATH: "/data/whatsapp-session",
  WHATSAPP_AUTH_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
};

describe("§6.3 - WhatsApp configuration", () => {
  it("дефолты: фича выключена, baileys, role=all, region=AZ, history off", () => {
    const config = loadWhatsAppConfig({});
    expect(config.enabled).toBe(false);
    expect(config.provider).toBe("baileys");
    expect(config.role).toBe("all");
    expect(config.defaultPhoneRegion).toBe("AZ");
    expect(config.importHistory).toBe(false);
    expect(config.autoConnect).toBe(true);
    expect(config.reconnectEnabled).toBe(true);
    expect(config.throttle).toEqual(WHATSAPP_THROTTLE_DEFAULTS);
  });

  it("throttle-дефолты соответствуют решению владельца №14", () => {
    expect(WHATSAPP_THROTTLE_DEFAULTS.perRecipientIntervalMs).toBe(1_000);
    expect(WHATSAPP_THROTTLE_DEFAULTS.perRecipientHourlyLimit).toBe(20);
    expect(WHATSAPP_THROTTLE_DEFAULTS.globalRatePerSec).toBe(5);
    expect(WHATSAPP_THROTTLE_DEFAULTS.burstLimit).toBe(10);
    expect(WHATSAPP_THROTTLE_DEFAULTS.cbFailureThreshold).toBe(5);
    expect(WHATSAPP_THROTTLE_DEFAULTS.cbOpenMs).toBe(60_000);
    expect(WHATSAPP_THROTTLE_DEFAULTS.cbMaxBackoffMs).toBe(900_000);
    expect(WHATSAPP_THROTTLE_DEFAULTS.queueMaxSize).toBe(1_000);
  });

  it("ENABLED=true без session path и encryption key → fail-closed ошибка со списком причин", () => {
    let thrown: unknown;
    try {
      loadWhatsAppConfig({ WHATSAPP_ENABLED: "true" });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(WhatsAppConfigError);
    const error = thrown as WhatsAppConfigError;
    expect(error.message).toContain("fail-closed");
    expect(error.issues.some((issue) => issue.includes("WHATSAPP_SESSION_PATH"))).toBe(true);
    expect(error.issues.some((issue) => issue.includes("WHATSAPP_AUTH_ENCRYPTION_KEY"))).toBe(true);
  });

  it("ENABLED=true с коротким ключом (<32) → fail-closed", () => {
    expect(() =>
      loadWhatsAppConfig({
        ...ENABLED_VALID,
        WHATSAPP_AUTH_ENCRYPTION_KEY: "short-key",
      }),
    ).toThrow(WhatsAppConfigError);
  });

  it("ENABLED=true + provider=mock не требует session path/key", () => {
    const config = loadWhatsAppConfig({ WHATSAPP_ENABLED: "true", WHATSAPP_PROVIDER: "mock" });
    expect(config.enabled).toBe(true);
    expect(config.provider).toBe("mock");
  });

  it("ENABLED=true + IMPORT_HISTORY=true запрещён в v1", () => {
    expect(() => loadWhatsAppConfig({ ...ENABLED_VALID, WHATSAPP_IMPORT_HISTORY: "true" })).toThrow(
      WhatsAppConfigError,
    );
  });

  it("ENABLED=true + невалидные значения enum/чисел/bool → fail-closed со всеми причинами", () => {
    let thrown: unknown;
    try {
      loadWhatsAppConfig({
        ...ENABLED_VALID,
        WHATSAPP_PROVIDER: "telegram",
        WHATSAPP_ROLE: "boss",
        WHATSAPP_SEND_TIMEOUT_MS: "abc",
        WHATSAPP_AUTO_CONNECT: "maybe",
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(WhatsAppConfigError);
    const issues = (thrown as WhatsAppConfigError).issues.join(" | ");
    expect(issues).toContain("WHATSAPP_PROVIDER");
    expect(issues).toContain("WHATSAPP_ROLE");
    expect(issues).toContain("WHATSAPP_SEND_TIMEOUT_MS");
    expect(issues).toContain("WHATSAPP_AUTO_CONNECT");
  });

  it("ENABLED=true + reconnectMax < reconnectBase → fail-closed", () => {
    expect(() =>
      loadWhatsAppConfig({
        ...ENABLED_VALID,
        WHATSAPP_RECONNECT_BASE_DELAY_MS: "5000",
        WHATSAPP_RECONNECT_MAX_DELAY_MS: "1000",
      }),
    ).toThrow(WhatsAppConfigError);
  });

  it("ENABLED=false: невалидные значения не роняют приложение (фича выключена)", () => {
    const config = loadWhatsAppConfig({
      WHATSAPP_ENABLED: "false",
      WHATSAPP_PROVIDER: "nonsense",
      WHATSAPP_SEND_TIMEOUT_MS: "-5",
    });
    expect(config.enabled).toBe(false);
    expect(config.provider).toBe("baileys");
    expect(config.sendTimeoutMs).toBe(30_000);
  });

  it("парсинг bool/number/enum из env + throttle переопределяется", () => {
    const config = loadWhatsAppConfig({
      ...ENABLED_VALID,
      WHATSAPP_ROLE: "worker",
      WHATSAPP_AUTO_CONNECT: "0",
      WHATSAPP_RECONNECT_ENABLED: "false",
      WHATSAPP_SEND_TIMEOUT_MS: "15000",
      WHATSAPP_DEFAULT_PHONE_REGION: "ru",
      WHATSAPP_THROTTLE_GLOBAL_RATE_PER_SEC: "3",
      WHATSAPP_THROTTLE_QUEUE_MAX_SIZE: "500",
    });
    expect(config.role).toBe("worker");
    expect(config.autoConnect).toBe(false);
    expect(config.reconnectEnabled).toBe(false);
    expect(config.sendTimeoutMs).toBe(15_000);
    expect(config.defaultPhoneRegion).toBe("RU");
    expect(config.throttle.globalRatePerSec).toBe(3);
    expect(config.throttle.queueMaxSize).toBe(500);
    expect(config.throttle.perRecipientHourlyLimit).toBe(20);
  });

  it("lease/qrRateLimit дефолты (M2, решение владельца: heartbeat*2 <= ttl)", () => {
    const config = loadWhatsAppConfig({});
    expect(config.lease).toEqual({ ttlMs: 45_000, heartbeatMs: 15_000 });
    expect(config.qrRateLimit).toEqual({ max: 10, windowMs: 10_000 });
  });

  it("lease/qrRateLimit переопределяются из env", () => {
    const config = loadWhatsAppConfig({
      ...ENABLED_VALID,
      WHATSAPP_LEASE_TTL_MS: "60000",
      WHATSAPP_LEASE_HEARTBEAT_MS: "20000",
      WHATSAPP_QR_RATE_LIMIT_MAX: "5",
      WHATSAPP_QR_RATE_LIMIT_WINDOW_MS: "30000",
    });
    expect(config.lease).toEqual({ ttlMs: 60_000, heartbeatMs: 20_000 });
    expect(config.qrRateLimit).toEqual({ max: 5, windowMs: 30_000 });
  });

  it("ENABLED=true + heartbeat*2 > ttl → fail-closed", () => {
    let thrown: unknown;
    try {
      loadWhatsAppConfig({
        ...ENABLED_VALID,
        WHATSAPP_LEASE_TTL_MS: "30000",
        WHATSAPP_LEASE_HEARTBEAT_MS: "20000",
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(WhatsAppConfigError);
    expect((thrown as WhatsAppConfigError).issues.join(" | ")).toContain("WHATSAPP_LEASE_HEARTBEAT_MS");
  });

  it("ENABLED=true + нечисловые lease/qr-значения → fail-closed", () => {
    let thrown: unknown;
    try {
      loadWhatsAppConfig({
        ...ENABLED_VALID,
        WHATSAPP_LEASE_TTL_MS: "abc",
        WHATSAPP_QR_RATE_LIMIT_MAX: "x",
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(WhatsAppConfigError);
    const issues = (thrown as WhatsAppConfigError).issues.join(" | ");
    expect(issues).toContain("WHATSAPP_LEASE_TTL_MS");
    expect(issues).toContain("WHATSAPP_QR_RATE_LIMIT_MAX");
  });
});
