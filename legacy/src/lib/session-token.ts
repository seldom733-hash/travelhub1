import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "th_session";
const SECRET = process.env.SESSION_SECRET || "travelhub-dev-secret";
const TTL_MS = 7 * 24 * 3600 * 1000; // 7 дней

interface SessionPayload {
  userId: string;
  exp: number;
}

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

function encodePayload(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(raw: string): SessionPayload | null {
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
}

/** Создаёт подписанный токен сессии для пользователя. */
export function createSessionToken(userId: string): string {
  const payload: SessionPayload = { userId, exp: Date.now() + TTL_MS };
  const body = encodePayload(payload);
  return `${body}.${sign(body)}`;
}

/** Проверяет токен и возвращает userId, либо null. */
export function verifySessionToken(token: string): string | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const payload = decodePayload(body);
  if (!payload || payload.exp < Date.now()) return null;
  return payload.userId;
}
