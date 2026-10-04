/**
 * WhatsApp integration configuration (мастер-промпт v2.3 §6.3).
 *
 * Fail-closed: WHATSAPP_ENABLED=true с невалидной конфигурацией →
 * WhatsAppConfigError на старте модуля (WhatsApp-слой НЕ поднимается с неполной
 * конфигурацией, причина перечислена в тексте ошибки). При ENABLED=false
 * невалидные значения заменяются дефолтами (фича выключена — падать незачем).
 *
 * Источник значений — только env (`.env.example`); секреты в репо не хранятся.
 */

export type WhatsAppProviderName = "baileys" | "mock";
export type WhatsAppInstanceRole = "api" | "worker" | "all";

/** Throttle / circuit breaker (решение владельца №14). */
export interface WhatsAppThrottleConfig {
  /** Минимальный интервал одному получателю: 1 msg/sec. */
  perRecipientIntervalMs: number;
  /** Лимит сообщений одному получателю в час. */
  perRecipientHourlyLimit: number;
  /** Глобальный лимит отправки: 5 msg/sec. */
  globalRatePerSec: number;
  /** Burst-лимит подряд идущих сообщений. */
  burstLimit: number;
  /** Circuit breaker открывается после N подряд retryable-ошибок. */
  cbFailureThreshold: number;
  /** Сколько CB остаётся открытым (60 сек). */
  cbOpenMs: number;
  /** Максимальная задержка backoff CB (15 мин). */
  cbMaxBackoffMs: number;
  /** Максимальный размер очереди отправки. */
  queueMaxSize: number;
}

/** Session lease / fencing (I13, решение владельца M2). */
export interface WhatsAppLeaseConfig {
  /** TTL аренды: по истечении другой инстанс может перехватить (CAS). */
  ttlMs: number;
  /** Период heartbeat-продления (должен быть заметно меньше TTL). */
  heartbeatMs: number;
}

/** Rate-limit эндпоинта QR (§6.4: rate-limit на endpoint). */
export interface WhatsAppQrRateLimitConfig {
  /** Максимум запросов QR на пользователя в окне. */
  max: number;
  /** Окно скользящего лимита, ms. */
  windowMs: number;
}

export interface WhatsAppConfig {
  /** Feature flag; по умолчанию false (kill-switch). */
  enabled: boolean;
  provider: WhatsAppProviderName;
  /** Роль инстанса: только worker держит lease (WHATSAPP_ROLE=worker). */
  role: WhatsAppInstanceRole;
  /** Persistent storage auth-state (volume), обязательна при enabled+baileys. */
  sessionPath: string;
  /** Ключ шифрования auth-state, обязателен при enabled+baileys (fail-closed). */
  authEncryptionKey: string;
  autoConnect: boolean;
  reconnectEnabled: boolean;
  reconnectBaseDelayMs: number;
  reconnectMaxDelayMs: number;
  maxReconnectAttempts: number;
  sendTimeoutMs: number;
  /** Импорт истории WhatsApp запрещён в v1 (ограничение документировано). */
  importHistory: boolean;
  /** Default region для нормализации телефона (D4, ожидаемо AZ/+994). */
  defaultPhoneRegion: string;
  /** Каталог файлов медиа (M3+): staged-загрузки, входящие/исходящие вложения. */
  mediaDir: string;
  throttle: WhatsAppThrottleConfig;
  lease: WhatsAppLeaseConfig;
  qrRateLimit: WhatsAppQrRateLimitConfig;
}

export class WhatsAppConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(
      `WhatsApp configuration is invalid (WHATSAPP_ENABLED=true, fail-closed): ${issues.join("; ")}`,
    );
    this.name = "WhatsAppConfigError";
    this.issues = issues;
  }
}

const DEFAULTS = {
  provider: "baileys",
  role: "all",
  reconnectBaseDelayMs: 1_000,
  reconnectMaxDelayMs: 60_000,
  maxReconnectAttempts: 10,
  sendTimeoutMs: 30_000,
  defaultPhoneRegion: "AZ",
  mediaDir: ".whatsapp-media",
  leaseTtlMs: 45_000,
  leaseHeartbeatMs: 15_000,
  qrRateMax: 10,
  qrRateWindowMs: 10_000,
} as const;

/** Дефолты throttle — решение владельца №14. */
export const WHATSAPP_THROTTLE_DEFAULTS: WhatsAppThrottleConfig = {
  perRecipientIntervalMs: 1_000,
  perRecipientHourlyLimit: 20,
  globalRatePerSec: 5,
  burstLimit: 10,
  cbFailureThreshold: 5,
  cbOpenMs: 60_000,
  cbMaxBackoffMs: 900_000,
  queueMaxSize: 1_000,
};

type Env = Record<string, string | undefined>;

function parseBool(raw: string | undefined, fallback: boolean): { value: boolean; issue?: string } {
  if (raw === undefined || raw.trim() === "") return { value: fallback };
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return { value: true };
  if (normalized === "false" || normalized === "0") return { value: false };
  return { value: fallback, issue: `expected boolean true/false, got "${raw}"` };
}

function parseInt1(raw: string | undefined, fallback: number, label: string): { value: number; issue?: string } {
  if (raw === undefined || raw.trim() === "") return { value: fallback };
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return { value: fallback, issue: `${label} must be a positive integer, got "${raw}"` };
  }
  return { value: parsed };
}

function pickEnum<T extends string>(raw: string | undefined, allowed: readonly T[], fallback: T, label: string): { value: T; issue?: string } {
  if (raw === undefined || raw.trim() === "") return { value: fallback };
  const normalized = raw.trim().toLowerCase() as T;
  if ((allowed as readonly string[]).includes(normalized)) return { value: normalized };
  return { value: fallback, issue: `${label} must be one of ${allowed.join("|")}, got "${raw}"` };
}

/**
 * Читает и валидирует WHATSAPP_* конфигурацию из env.
 * Бросает WhatsAppConfigError только при enabled=true (fail-closed, §6.3).
 */
export function loadWhatsAppConfig(env: Env = process.env): WhatsAppConfig {
  const issues: string[] = [];

  const enabled = parseBool(env["WHATSAPP_ENABLED"], false);
  if (enabled.issue) issues.push(`WHATSAPP_ENABLED: ${enabled.issue}`);

  const provider = pickEnum(env["WHATSAPP_PROVIDER"], ["baileys", "mock"] as const, DEFAULTS.provider, "WHATSAPP_PROVIDER");
  if (provider.issue) issues.push(provider.issue);

  const role = pickEnum(env["WHATSAPP_ROLE"], ["api", "worker", "all"] as const, DEFAULTS.role, "WHATSAPP_ROLE");
  if (role.issue) issues.push(role.issue);

  const autoConnect = parseBool(env["WHATSAPP_AUTO_CONNECT"], true);
  if (autoConnect.issue) issues.push(`WHATSAPP_AUTO_CONNECT: ${autoConnect.issue}`);

  const reconnectEnabled = parseBool(env["WHATSAPP_RECONNECT_ENABLED"], true);
  if (reconnectEnabled.issue) issues.push(`WHATSAPP_RECONNECT_ENABLED: ${reconnectEnabled.issue}`);

  const reconnectBaseDelayMs = parseInt1(env["WHATSAPP_RECONNECT_BASE_DELAY_MS"], DEFAULTS.reconnectBaseDelayMs, "WHATSAPP_RECONNECT_BASE_DELAY_MS");
  if (reconnectBaseDelayMs.issue) issues.push(reconnectBaseDelayMs.issue);

  const reconnectMaxDelayMs = parseInt1(env["WHATSAPP_RECONNECT_MAX_DELAY_MS"], DEFAULTS.reconnectMaxDelayMs, "WHATSAPP_RECONNECT_MAX_DELAY_MS");
  if (reconnectMaxDelayMs.issue) issues.push(reconnectMaxDelayMs.issue);

  const maxReconnectAttempts = parseInt1(env["WHATSAPP_MAX_RECONNECT_ATTEMPTS"], DEFAULTS.maxReconnectAttempts, "WHATSAPP_MAX_RECONNECT_ATTEMPTS");
  if (maxReconnectAttempts.issue) issues.push(maxReconnectAttempts.issue);

  const sendTimeoutMs = parseInt1(env["WHATSAPP_SEND_TIMEOUT_MS"], DEFAULTS.sendTimeoutMs, "WHATSAPP_SEND_TIMEOUT_MS");
  if (sendTimeoutMs.issue) issues.push(sendTimeoutMs.issue);

  const importHistory = parseBool(env["WHATSAPP_IMPORT_HISTORY"], false);
  if (importHistory.issue) issues.push(`WHATSAPP_IMPORT_HISTORY: ${importHistory.issue}`);

  const throttle: WhatsAppThrottleConfig = { ...WHATSAPP_THROTTLE_DEFAULTS };
  const throttleSpecs: ReadonlyArray<[keyof WhatsAppThrottleConfig, string]> = [
    ["perRecipientIntervalMs", "WHATSAPP_THROTTLE_PER_RECIPIENT_INTERVAL_MS"],
    ["perRecipientHourlyLimit", "WHATSAPP_THROTTLE_PER_RECIPIENT_HOURLY_LIMIT"],
    ["globalRatePerSec", "WHATSAPP_THROTTLE_GLOBAL_RATE_PER_SEC"],
    ["burstLimit", "WHATSAPP_THROTTLE_BURST_LIMIT"],
    ["cbFailureThreshold", "WHATSAPP_THROTTLE_CB_FAILURE_THRESHOLD"],
    ["cbOpenMs", "WHATSAPP_THROTTLE_CB_OPEN_MS"],
    ["cbMaxBackoffMs", "WHATSAPP_THROTTLE_CB_MAX_BACKOFF_MS"],
    ["queueMaxSize", "WHATSAPP_THROTTLE_QUEUE_MAX_SIZE"],
  ];
  for (const [field, envName] of throttleSpecs) {
    const parsed = parseInt1(env[envName], throttle[field], envName);
    if (parsed.issue) issues.push(parsed.issue);
    throttle[field] = parsed.value;
  }

  const sessionPath = (env["WHATSAPP_SESSION_PATH"] ?? "").trim();
  const authEncryptionKey = (env["WHATSAPP_AUTH_ENCRYPTION_KEY"] ?? "").trim();
  const defaultPhoneRegion = (env["WHATSAPP_DEFAULT_PHONE_REGION"] ?? "").trim().toUpperCase() || DEFAULTS.defaultPhoneRegion;
  const mediaDir = (env["WHATSAPP_MEDIA_DIR"] ?? "").trim() || DEFAULTS.mediaDir;

  const leaseTtlMs = parseInt1(env["WHATSAPP_LEASE_TTL_MS"], DEFAULTS.leaseTtlMs, "WHATSAPP_LEASE_TTL_MS");
  if (leaseTtlMs.issue) issues.push(leaseTtlMs.issue);
  const leaseHeartbeatMs = parseInt1(env["WHATSAPP_LEASE_HEARTBEAT_MS"], DEFAULTS.leaseHeartbeatMs, "WHATSAPP_LEASE_HEARTBEAT_MS");
  if (leaseHeartbeatMs.issue) issues.push(leaseHeartbeatMs.issue);

  const qrRateMax = parseInt1(env["WHATSAPP_QR_RATE_LIMIT_MAX"], DEFAULTS.qrRateMax, "WHATSAPP_QR_RATE_LIMIT_MAX");
  if (qrRateMax.issue) issues.push(qrRateMax.issue);
  const qrRateWindowMs = parseInt1(env["WHATSAPP_QR_RATE_LIMIT_WINDOW_MS"], DEFAULTS.qrRateWindowMs, "WHATSAPP_QR_RATE_LIMIT_WINDOW_MS");
  if (qrRateWindowMs.issue) issues.push(qrRateWindowMs.issue);

  // Fail-closed правила только при включённой фиче (§6.3).
  if (enabled.value) {
    if (provider.value === "baileys") {
      if (sessionPath === "") {
        issues.push("WHATSAPP_SESSION_PATH is required when WHATSAPP_ENABLED=true and provider=baileys (persistent auth state on volume)");
      }
      if (authEncryptionKey === "") {
        issues.push("WHATSAPP_AUTH_ENCRYPTION_KEY is required when WHATSAPP_ENABLED=true and provider=baileys (auth state encrypted at rest)");
      } else if (authEncryptionKey.length < 32) {
        issues.push("WHATSAPP_AUTH_ENCRYPTION_KEY must be at least 32 characters");
      }
    }
    if (importHistory.value) {
      issues.push("WHATSAPP_IMPORT_HISTORY=true is not allowed in v1 (history import is disabled; Communication import would be created)");
    }
    if (reconnectMaxDelayMs.value < reconnectBaseDelayMs.value) {
      issues.push("WHATSAPP_RECONNECT_MAX_DELAY_MS must be >= WHATSAPP_RECONNECT_BASE_DELAY_MS");
    }
    if (leaseHeartbeatMs.value * 2 > leaseTtlMs.value) {
      issues.push("WHATSAPP_LEASE_HEARTBEAT_MS must be <= half of WHATSAPP_LEASE_TTL_MS (минимум два heartbeat на TTL)");
    }
    if (issues.length > 0) throw new WhatsAppConfigError(issues);
  }

  return {
    enabled: enabled.value,
    provider: provider.value,
    role: role.value,
    sessionPath,
    authEncryptionKey,
    autoConnect: autoConnect.value,
    reconnectEnabled: reconnectEnabled.value,
    reconnectBaseDelayMs: reconnectBaseDelayMs.value,
    reconnectMaxDelayMs: reconnectMaxDelayMs.value,
    maxReconnectAttempts: maxReconnectAttempts.value,
    sendTimeoutMs: sendTimeoutMs.value,
    importHistory: importHistory.value,
    defaultPhoneRegion,
    mediaDir,
    throttle,
    lease: { ttlMs: leaseTtlMs.value, heartbeatMs: leaseHeartbeatMs.value },
    qrRateLimit: { max: qrRateMax.value, windowMs: qrRateWindowMs.value },
  };
}
