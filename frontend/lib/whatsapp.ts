import { auth } from "./api";

/**
 * M3 §19/§22/§25 — операционный WhatsApp Inbox (клиентская часть).
 *
 * Чтение диалогов идёт через общий `api` (cookie-сессия); отправка — отдельный
 * helper с обязательным `Idempotency-Key` (бэкенд: @Idempotent("whatsapp.send"),
 * ключ = единственная защита от дублей клиента, §26).
 */

export type WhatsAppMatchingStatus = "UNMATCHED" | "MATCHED" | "AMBIGUOUS";

export interface WhatsAppConversationRow {
  id: string;
  remoteJid: string;
  canonicalPhone: string | null;
  matchingStatus: WhatsAppMatchingStatus;
  customerId: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastReadAt: string | null;
  unreadCount: number;
  suppressed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppCustomerRef {
  id: string;
  code: string;
  name: string;
  email: string;
}

export interface WhatsAppResolvedContext {
  type: "BOOKING" | "ORDER" | "REQUEST" | "CUSTOMER";
  id: string;
  code: string;
  status: string | null;
}

export interface WhatsAppConversationDetail extends WhatsAppConversationRow {
  customer: WhatsAppCustomerRef | null;
  candidates: WhatsAppCustomerRef[];
  context: WhatsAppResolvedContext | null;
}

export interface WhatsAppTimelineItem {
  id: string;
  origin: "inbound" | "outbound";
  direction: "INBOUND" | "OUTBOUND";
  body: string | null;
  messageType: string;
  occurredAt: string;
  communicationCode: string | null;
  providerMessageId: string | null;
  /** M3+: вложение — имя файла/размер (null у текста). */
  mediaFilename: string | null;
  mediaSize: number | null;
  hasMedia: boolean;
  /** Integration lifecycle (M0-05): null у inbound. */
  status: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
}

export interface WhatsAppUploadResult {
  uploadId: string;
  filename: string;
  mimetype: string;
  size: number;
}

export interface WhatsAppSendResult {
  outboundId: string;
  communicationCode: string;
  status: string;
  providerMessageId: string | null;
}

export interface WhatsAppSendInput {
  conversationId: string;
  text: string;
  /** Ребёнок диалога: customerId ИЛИ phone (ровно один, §19). */
  customerId?: string | null;
  phone?: string | null;
  /** M3+: staged-файл из uploadWhatsAppFile; с ним text может быть пустым. */
  uploadId?: string | null;
}

/** Ошибка HTTP с кодом статуса (409 suppressed, 422 validation и т.д.). */
export class WhatsAppApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WhatsAppApiError";
  }
}

/** Backend IDEMPOTENCY_KEY_RE: ^[A-Za-z0-9._~-]+$, максимум 128 символов. */
export const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._~-]+$/;

/** Уникальный ключ идемпотентности в допустимом формате. */
export function newIdempotencyKey(prefix = "whatsapp.send"): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand()}-${rand()}`.replace(/[^A-Za-z0-9._~-]/g, "-");
}

async function readError(res: Response): Promise<WhatsAppApiError> {
  let message = `HTTP ${res.status}`;
  try {
    const parsed = (await res.json()) as { message?: string };
    if (parsed?.message) message = parsed.message;
  } catch {
    /* ignore */
  }
  return new WhatsAppApiError(message, res.status);
}

async function postSend(body: Record<string, unknown>, operationKey: string): Promise<WhatsAppSendResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Idempotency-Key": operationKey,
  };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  const res = await fetch("/api/v1/whatsapp/messages", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await readError(res);
  return (await res.json()) as WhatsAppSendResult;
}

/**
 * M3+: staged-загрузка вложения ДО отправки (POST /whatsapp/uploads,
 * multipart). Отдельный endpoint без Idempotency-Key — ключ ставится при
 * самой отправке (sendWhatsAppMessage).
 */
export async function uploadWhatsAppFile(file: File): Promise<WhatsAppUploadResult> {
  const form = new FormData();
  form.append("file", file, file.name);
  const headers: Record<string, string> = {};
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  const res = await fetch("/api/v1/whatsapp/uploads", {
    method: "POST",
    headers,
    credentials: "include",
    body: form,
  });
  if (!res.ok) throw await readError(res);
  return (await res.json()) as WhatsAppUploadResult;
}

/** Прямая ссылка на вложение (cookie-сессия браузера, скачивание/просмотр). */
export function whatsappMediaUrl(origin: "inbound" | "outbound", id: string): string {
  return `/api/v1/whatsapp/media/${origin}/${encodeURIComponent(id)}`;
}

/**
 * Отправка в диалог операционного inbox: `conversationId` + получатель.
 *
 * Fallback: телефон привязанного Customer может не совпадать с телефоном
 * диалога (или отсутствовать в E.164) → бэкенд 422; тогда повторяем отправку
 * по телефону самого диалога с НОВЫМ ключом (первый запрос не создал записи —
 * ошибки идемпотентности не кэшируются).
 */
export async function sendWhatsAppMessage(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
  const text = input.text.trim();
  const uploadId = input.uploadId?.trim() || null;
  const base: Record<string, unknown> = { conversationId: input.conversationId, text };
  if (uploadId) base["uploadId"] = uploadId;
  const useCustomer = typeof input.customerId === "string" && input.customerId.trim() !== "";
  try {
    return await postSend(
      useCustomer ? { ...base, customerId: input.customerId } : { ...base, phone: input.phone ?? "" },
      newIdempotencyKey(),
    );
  } catch (err) {
    const recoverable =
      useCustomer &&
      err instanceof WhatsAppApiError &&
      err.status === 422 &&
      (err.message.includes("does not match") || err.message.includes("valid phone number"));
    if (!recoverable) throw err;
    return postSend({ ...base, phone: input.phone ?? "" }, newIdempotencyKey());
  }
}
