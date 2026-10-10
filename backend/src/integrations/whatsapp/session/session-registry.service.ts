import { Inject, Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import * as fs from "fs/promises";
import * as path from "path";
import { PrismaService } from "../../../prisma/prisma.service";
import { ConflictError, DomainError, NotFoundError } from "../../../shared/errors";
import type { WhatsAppConfig } from "../whatsapp.config";
import { WHATSAPP_CONFIG } from "../whatsapp.tokens";
import {
  WHATSAPP_LEASE_KEY,
  whatsappLeaseKey,
  WhatsAppSessionLeaseService,
} from "../lease/session-lease.service";
import { WhatsAppSessionOwnershipService } from "../ownership/session-ownership.service";
import { MockWhatsAppProvider } from "../provider/mock/mock-whatsapp.provider";
import { BaileysWhatsAppProvider } from "../provider/baileys/baileys-provider";
import type {
  WhatsAppConnectionSnapshot,
  WhatsAppDeliveryUpdate,
  WhatsAppInboundProviderMessage,
  WhatsAppProvider,
} from "../provider/whatsapp-provider";

/**
 * M5 multi-number: реестр WhatsApp-сессий — единая точка правды о том,
 * какие номера подключены и какой провайдер/аренда какому номеру принадлежит.
 *
 *  - один SessionContext на активный номер: провайдер + per-account ownership
 *    (lease-ключ `whatsapp:<accountId>`) + per-account каталог auth-state
 *    (`WHATSAPP_SESSION_PATH/<accountId>/`);
 *  - события провайдера форвардятся наружу С accountId (inbound/state/
 *    delivery/lost) — потребители подписываются один раз и не знают о
 *    количестве номеров;
 *  - legacy auth-файл v1 (`WHATSAPP_SESSION_PATH/auth-state.enc`) при
 *    бутстрапе одноразово переезжает в каталог primary-аккаунта (номер,
 *    подключённый до M5, не отваливается);
 *  - архивный номер (archivedAt != null) контекста не имеет: его история
 *    остаётся в БД (каскад не срабатывает — строка не удаляется), а
 *    отправка/QR/live-операции над ним падают с понятной ошибкой;
 *  - `provideLegacyProvider()` возвращает стабильный прокси для токена
 *    WHATSAPP_PROVIDER: подписки (on*) живут на hub'ах реестра (переживают
 *    смену контекста), методы состояния лениво перенаправляются на
 *    primary-номер. До завершения бутстрапа (и при ошибке БД) прокси
 *    обслуживается placeholder-контекстом с legacy-путём.
 */

export interface WhatsAppAccountRow {
  readonly id: string;
  readonly provider: string;
  readonly state: string;
  readonly label: string | null;
  readonly phone: string | null;
  readonly connectedAt: Date | null;
  readonly lastDisconnectedAt: Date | null;
  readonly lastError: string | null;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface WhatsAppSessionContext {
  readonly accountId: string;
  readonly provider: WhatsAppProvider;
  readonly ownership: WhatsAppSessionOwnershipService;
  /** Каталог auth-state номера (`sessionPath/<accountId>`). */
  readonly sessionPath: string;
  /** true — временный контекст до бутстрапа (не настоящий номер). */
  readonly placeholder: boolean;
}

type Unsub = () => void;
type InboundListener = (accountId: string, message: WhatsAppInboundProviderMessage) => void;
type StateListener = (accountId: string, snapshot: WhatsAppConnectionSnapshot) => void;
type DeliveryListener = (accountId: string, update: WhatsAppDeliveryUpdate) => void;
type LostListener = (accountId: string, reason: string) => void;
type ContextListener = (context: WhatsAppSessionContext) => void;

/** Счётчик для placeholder-идентификатора (не настоящий accountId). */
const LEGACY_PLACEHOLDER_ID = "__legacy__";

@Injectable()
export class WhatsAppSessionRegistryService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly contexts = new Map<string, WhatsAppSessionContext>();
  private readonly contextUnsubs = new Map<string, Unsub[]>();
  private readonly inboundListeners = new Set<InboundListener>();
  private readonly stateListeners = new Set<StateListener>();
  private readonly deliveryListeners = new Set<DeliveryListener>();
  private readonly lostListeners = new Set<LostListener>();
  private readonly contextListeners = new Set<ContextListener>();
  private legacyProxy: WhatsAppProvider | null = null;
  private bootstrapPromise: Promise<void> | null = null;
  private disposed = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly lease: WhatsAppSessionLeaseService,
    @Inject(WHATSAPP_CONFIG) private readonly config: WhatsAppConfig,
  ) {}

  get enabled(): boolean {
    return this.config.enabled;
  }

  // ── account rows ──────────────────────────────────────────────────────────

  /** Все номера (включая архивные — история читается в инбоксе). */
  async listAccounts(): Promise<WhatsAppAccountRow[]> {
    return this.prisma.whatsAppAccount.findMany({ orderBy: { createdAt: "asc" } });
  }

  /** Активные номера (без архива), по порядку создания. */
  async listActiveAccounts(): Promise<WhatsAppAccountRow[]> {
    return this.prisma.whatsAppAccount.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "asc" },
    });
  }

  async getAccount(accountId: string): Promise<WhatsAppAccountRow | null> {
    return this.prisma.whatsAppAccount.findUnique({ where: { id: accountId } });
  }

  /**
   * Primary-номер legacy-поведения: первый активный по createdAt; если
   * активных нет и фича включена — создаётся новая строка (v1-синглтон
   * для `/whatsapp/connect` без идентификатора).
   */
  async ensurePrimaryAccountId(): Promise<string> {
    const primary = await this.prisma.whatsAppAccount.findFirst({
      where: { archivedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const id = primary
      ? primary.id
      : (
          await this.prisma.whatsAppAccount.create({
            data: { provider: this.config.provider, state: "DISCONNECTED" },
            select: { id: true },
          })
        ).id;
    await this.migrateLegacyLeaseRow();
    return id;
  }

  /** Новый номер (POST /whatsapp/sessions). Человекочитаемое имя опционально. */
  async createAccount(label?: string | null): Promise<WhatsAppAccountRow> {
    const trimmed = (label ?? "").trim();
    return this.prisma.whatsAppAccount.create({
      data: { provider: this.config.provider, state: "DISCONNECTED", label: trimmed || null },
    });
  }

  // ── contexts ──────────────────────────────────────────────────────────────

  get(accountId: string): WhatsAppSessionContext | undefined {
    return this.contexts.get(accountId);
  }

  /** Существующий контекст либо построение заново (лениво для новых номеров). */
  async ensureContext(accountId: string): Promise<WhatsAppSessionContext> {
    const existing = this.contexts.get(accountId);
    if (existing && !existing.placeholder) return existing;
    if (!this.config.enabled) {
      throw new DomainError("WhatsApp integration is disabled (WHATSAPP_ENABLED=false)", 503);
    }
    const row = await this.prisma.whatsAppAccount.findUnique({ where: { id: accountId } });
    if (!row) throw new NotFoundError(`WhatsApp account ${accountId} not found`);
    if (row.archivedAt) {
      throw new ConflictError(`WhatsApp number is archived (account ${accountId})`);
    }
    if (existing?.placeholder) await this.teardownContext(accountId, existing, "legacy replaced");
    return this.buildContext(row.id);
  }

  /** Каталог auth-state номера (та же формула, что у провайдера). */
  sessionPathFor(accountId: string): string {
    return path.join(this.config.sessionPath, accountId);
  }

  // ── event hubs (подписка один раз; события несут accountId) ───────────────

  onInbound(listener: InboundListener): Unsub {
    this.inboundListeners.add(listener);
    return () => this.inboundListeners.delete(listener);
  }

  onStateChange(listener: StateListener): Unsub {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onDeliveryUpdate(listener: DeliveryListener): Unsub {
    this.deliveryListeners.add(listener);
    return () => this.deliveryListeners.delete(listener);
  }

  onLost(listener: LostListener): Unsub {
    this.lostListeners.add(listener);
    return () => this.lostListeners.delete(listener);
  }

  /** Номер добавлен в реестр — для поздней подписки. */
  onContextCreated(listener: ContextListener): Unsub {
    this.contextListeners.add(listener);
    return () => this.contextListeners.delete(listener);
  }

  // ── legacy WHATSAPP_PROVIDER (stability-прокси для e2e/внешних потребителей)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Единственный стабильный экземпляр прокси для токена WHATSAPP_PROVIDER.
   * Вызывается фабрикой модуля БЕЗ БД (компиляция модуля) — placeholder
   * создаётся синхронно; настоящие контексты появляются на бутстрапе.
   */
  provideLegacyProvider(): WhatsAppProvider | null {
    if (!this.config.enabled) return null;
    if (this.legacyProxy) return this.legacyProxy;
    if (!this.contexts.has(LEGACY_PLACEHOLDER_ID)) {
      this.buildContext(LEGACY_PLACEHOLDER_ID, this.config.sessionPath, true);
    }
    const resolvePrimary = (): WhatsAppProvider | undefined => {
      for (const [id, ctx] of this.contexts) {
        if (id !== LEGACY_PLACEHOLDER_ID) return ctx.provider;
      }
      return this.contexts.get(LEGACY_PLACEHOLDER_ID)?.provider;
    };
    const self = this;
    this.legacyProxy = new Proxy({} as WhatsAppProvider, {
      // instanceof-совместимость (module spec: toBeInstanceOf Mock/Baileys).
      getPrototypeOf() {
        const provider = resolvePrimary();
        return provider ? Object.getPrototypeOf(provider) : null;
      },
      get(_target, prop) {
        const provider = resolvePrimary();
        // Подписки переживают смену контекста: on* живут на hub'ах реестра,
        // адаптируя сигнатуру legacy-потребителей (без accountId).
        if (prop === "onInbound") {
          return (cb: (message: WhatsAppInboundProviderMessage) => void) =>
            self.onInbound((_accountId, message) => cb(message));
        }
        if (prop === "onStateChange") {
          return (cb: (snapshot: WhatsAppConnectionSnapshot) => void) =>
            self.onStateChange((_accountId, snapshot) => cb(snapshot));
        }
        if (prop === "onDeliveryUpdate") {
          return (cb: (update: WhatsAppDeliveryUpdate) => void) =>
            self.onDeliveryUpdate((_accountId, update) => cb(update));
        }
        if (!provider) return undefined;
        const value = Reflect.get(provider as object, prop, provider);
        return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(provider) : value;
      },
    });
    return this.legacyProxy;
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Идемпотентный бутстрап: переезд legacy auth-файла → контексты всех
   * активных номеров → снятие placeholder'а. `ready()` пережидает его из
   * любого места (runtime auto-connect не зависит от порядка хуков Nest).
   */
  onApplicationBootstrap(): void {
    if (!this.config.enabled || this.bootstrapPromise) return;
    this.bootstrapPromise = this.bootstrap().catch((error: unknown) => {
      // Ошибка БД не должна ронять приложение: placeholder продолжает
      // обслуживать legacy-поведение (root-каталог, как в v1).
      console.error("[whatsapp] registry bootstrap failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    });
  }

  async ready(): Promise<void> {
    if (this.bootstrapPromise) await this.bootstrapPromise;
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    await this.ready();
    for (const [accountId, ctx] of [...this.contexts]) {
      await this.teardownContext(accountId, ctx, "application shutdown");
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.dispose();
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async bootstrap(): Promise<void> {
    if (this.disposed) return;
    // Legacy lease-row "whatsapp" → primary ДО первого acquire (иначе новый
    // lineage стартует с токена 1, а auth-state на диске уже хранит старый).
    await this.migrateLegacyLeaseRow();
    const active = await this.listActiveAccounts();
    // Legacy v1: единственный auth-файл → каталог primary-аккаунта ДО первого
    // построения per-account провайдера (иначе подключённый номер «отвалится»).
    if (this.config.provider === "baileys" && (await this.fileExists(this.legacyAuthFile()))) {
      const primaryId = active[0]?.id ?? (await this.ensurePrimaryAccountId());
      await this.migrateLegacyAuthFile(primaryId);
    }
    const built: string[] = [];
    for (const row of active) {
      if (!this.contexts.has(row.id)) {
        this.buildContext(row.id);
        built.push(row.id);
      }
    }
    // Placeholder нужен только до появления настоящих контекстов.
    if (built.length > 0) {
      const placeholder = this.contexts.get(LEGACY_PLACEHOLDER_ID);
      if (placeholder) await this.teardownContext(LEGACY_PLACEHOLDER_ID, placeholder, "bootstrap done");
    }
  }

  private legacyAuthFile(): string {
    return path.join(this.config.sessionPath, "auth-state.enc");
  }

  private async fileExists(file: string): Promise<boolean> {
    try {
      await fs.access(file);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * M5: одноразовый перенос legacy singleton-строки аренды "whatsapp" на
   * primary-номер (`whatsapp:<id>`) с сохранением fencingToken.
   *
   * Без переноса новый ключ создал бы строку с токеном 1, а auth-state на
   * диске (записанный старым lineage, токен N > 1) отвергал бы ВСЕ записи
   * как stale — primary-номер не смог бы сохранять сессию. Идемпотентно;
   * best-effort (не роняет bootstrap).
   */
  private async migrateLegacyLeaseRow(): Promise<void> {
    let legacy: { key: string; fencingToken: number } | null;
    try {
      legacy = await this.prisma.whatsAppSessionLease.findUnique({ where: { key: WHATSAPP_LEASE_KEY } });
    } catch {
      return;
    }
    if (!legacy) return;
    const primary = await this.prisma.whatsAppAccount.findFirst({
      where: { archivedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!primary) return; // номеров нет — легаси-строка остаётся до первого primary
    const targetKey = whatsappLeaseKey(primary.id);
    try {
      const target = await this.prisma.whatsAppSessionLease.findUnique({ where: { key: targetKey } });
      if (target) {
        // Целевая строка уже есть — токены сливаются (MAX), легаси удаляется:
        // auth-state на диске помнит старый lineage, primary обязан продолжить
        // монотонно с него, иначе все записи отвергаются как stale.
        const merged = Math.max(Number(legacy.fencingToken), Number(target.fencingToken));
        if (merged > Number(target.fencingToken)) {
          await this.prisma.whatsAppSessionLease.update({
            where: { key: targetKey },
            data: { fencingToken: merged },
          });
        }
        await this.prisma.whatsAppSessionLease.delete({ where: { key: WHATSAPP_LEASE_KEY } });
        console.warn("[whatsapp] legacy lease row merged into primary number", {
          accountId: primary.id,
          toKey: targetKey,
          fencingToken: merged,
        });
        return;
      }
      await this.prisma.whatsAppSessionLease.updateMany({
        where: { key: WHATSAPP_LEASE_KEY },
        data: { key: targetKey },
      });
      console.warn("[whatsapp] legacy lease row migrated to primary number", {
        accountId: primary.id,
        fromKey: WHATSAPP_LEASE_KEY,
        toKey: targetKey,
      });
    } catch (error) {
      // Гонка с другим инстансом/bootstraps — перенос уже сделан, ок.
      console.warn("[whatsapp] legacy lease row migration skipped", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  /** Одноразовый переезд `auth-state.enc` → `<accountId>/auth-state.enc`. */
  private async migrateLegacyAuthFile(accountId: string): Promise<void> {
    const legacy = this.legacyAuthFile();
    const targetDir = path.join(this.config.sessionPath, accountId);
    const target = path.join(targetDir, "auth-state.enc");
    if (!(await this.fileExists(legacy))) return;
    if (await this.fileExists(target)) return; // уже мигрировано — легаси не трогаем
    await fs.mkdir(targetDir, { recursive: true });
    await fs.rename(legacy, target);
    if (await this.fileExists(`${legacy}.tmp`)) {
      await fs.rename(`${legacy}.tmp`, `${target}.tmp`);
    }
    console.warn("[whatsapp] legacy auth-state migrated to per-account directory", {
      accountId,
      from: "auth-state.enc",
    });
  }

  private buildContext(
    accountId: string,
    sessionPath = this.sessionPathFor(accountId),
    placeholder = false,
  ): WhatsAppSessionContext {
    const ownership = new WhatsAppSessionOwnershipService(this.lease, this.config, whatsappLeaseKey(accountId));
    const provider = this.createProvider(ownership, sessionPath);

    const unsubs: Unsub[] = [];
    unsubs.push(
      provider.onInbound((message) => {
        for (const listener of [...this.inboundListeners]) listener(accountId, message);
      }),
      provider.onStateChange((snapshot) => {
        for (const listener of [...this.stateListeners]) listener(accountId, snapshot);
      }),
      provider.onDeliveryUpdate((update) => {
        for (const listener of [...this.deliveryListeners]) listener(accountId, update);
      }),
      ownership.onLost((reason) => {
        for (const listener of [...this.lostListeners]) listener(accountId, reason);
      }),
    );

    const context: WhatsAppSessionContext = { accountId, provider, ownership, sessionPath, placeholder };
    this.contexts.set(accountId, context);
    this.contextUnsubs.set(accountId, unsubs);
    for (const listener of [...this.contextListeners]) listener(context);
    return context;
  }

  private createProvider(
    ownership: WhatsAppSessionOwnershipService,
    sessionPath: string,
  ): WhatsAppProvider {
    if (this.config.provider === "mock") {
      return new MockWhatsAppProvider({ instanceId: this.lease.instanceId, startFlow: "connected" });
    }
    // Per-account каталог кредов (M5): тот же config, но свой sessionPath.
    const config: WhatsAppConfig = { ...this.config, sessionPath };
    return new BaileysWhatsAppProvider({
      config,
      instanceId: this.lease.instanceId,
      getFencingToken: () => ownership.current?.fencingToken ?? 0,
    });
  }

  private async teardownContext(
    accountId: string,
    ctx: WhatsAppSessionContext,
    reason: string,
  ): Promise<void> {
    this.contextUnsubs.get(accountId)?.forEach((unsub) => unsub());
    this.contextUnsubs.delete(accountId);
    this.contexts.delete(accountId);
    await ctx.provider.stop(reason).catch((error: unknown) => {
      console.error("[whatsapp] provider stop failed", {
        accountId,
        error: error instanceof Error ? error.message : "unknown",
      });
    });
    await ctx.ownership.release().catch((error: unknown) => {
      console.error("[whatsapp] ownership release failed", {
        accountId,
        error: error instanceof Error ? error.message : "unknown",
      });
    });
  }

  /** Убрать контекст номера (архив/замена): остановить провайдер, отпустить lease. */
  async removeContext(accountId: string, reason: string): Promise<void> {
    const ctx = this.contexts.get(accountId);
    if (!ctx) return;
    await this.teardownContext(accountId, ctx, reason);
  }
}
