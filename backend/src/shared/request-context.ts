import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { BusinessEventActor } from "../eventbus/domain-events";

/**
 * PHASE 1 STEP 1.15 — Correlation / Request ID infrastructure.
 * (Step 1.15A: контекст дополнительно несёт typed actor для business event
 * envelope — см. ADR-0010.)
 *
 * Единый технический correlation/request context, прокидываемый через
 * AsyncLocalStorage (не через десятки сигнатур):
 *
 *   requestId    — конкретный HTTP request / processing invocation.
 *   correlationId — вся логическая causal chain. Для корневого server-
 *                   authoritative HTTP flow равен requestId.
 *   causationId  — непосредственная причина. Для child event, порождённого
 *                  event consumer, равен eventId родителя.
 *   actor        — typed business event actor: null в момент создания контекста
 *                  middleware-ом; JwtAuthGuard (внутри ALS-scope запроса)
 *                  вызывает setRequestActor({type:"USER", id}) после аутенти-
 *                  фикации; publishPending устанавливает {type:"SYSTEM"} для
 *                  обработки событий consumer-ами. emit наследует его как
 *                  envelope.actor (без explicit override).
 *
 * НЕ смешивается с business entity IDs (orderId/bookingId/...), behavioral
 * eventId/sessionId. requestId/correlationId — технические identity, не
 * тайминги (temporal model 1.13A не меняется).
 *
 * correlationId: string | null — consumer, обрабатывающий legacy событие с
 * NULL correlation, наследует NULL (Step 1.15 §17: legacy NULL = unknown,
 * без fake backfill).
 */
export interface RequestContext {
  requestId: string;
  /** string — активная chain; null — legacy/unknown correlation (без fake backfill). */
  correlationId: string | null;
  causationId: string | null;
  /** null — анонимный/не установлен (legacy unknown, без backfill). */
  actor: BusinessEventActor | null;
}

const store = new AsyncLocalStorage<RequestContext>();

/** UUID v4 — единый безопасный формат ID по conventions проекта (как OutboxEvent.id). */
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Валиден ли входящий ID как authoritative (UUID + ограничение длины/символов). */
export function isValidRequestId(input: unknown): input is string {
  return typeof input === "string" && input.length <= 64 && UUID_V4_RE.test(input);
}

/** Новый server-authoritative requestId (UUID v4). */
export function createRequestId(): string {
  return randomUUID();
}

/**
 * Нормализация явно переданного correlation/causation ID перед записью в Outbox
 * (Step 1.15 §6): пустая/whitespace-строка не может быть valid correlation —
 * приводится к null (unknown). undefined — наследование из контекста;
 * null — intentional null (legacy). Не-UUID строки не отвергаются (legacy
 * источники могли использовать произвольные ключи), но пустые — запрещены.
 */
export function normalizeCorrelationId(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Текущий request context (undefined вне какого-либо processing invocation). */
export function getRequestContext(): RequestContext | undefined {
  return store.getStore();
}

/**
 * Step 1.15A: установить typed actor для ТЕКУЩЕГО request context (мутация
 * ALS-store объекта, созданного middleware-ом). Вызывается JwtAuthGuard после
 * успешной аутентификации (внутри ALS-scope запроса) и publishPending для
 * consumer-контекста (SYSTEM). Вне активного контекста — no-op.
 */
export function setRequestActor(actor: BusinessEventActor): void {
  const ctx = store.getStore();
  if (ctx) ctx.actor = actor;
}

/** Выполнить fn в новом processing context (вложенный вызов, например consumer). */
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T>;
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T;
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return store.run(ctx, fn);
}
