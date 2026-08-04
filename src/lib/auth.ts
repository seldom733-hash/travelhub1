import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, createSessionToken, verifySessionToken } from "@/lib/session-token";

/**
 * Проверка пароля по схеме сида: passwordHash = `hash:${password}`.
 */
export function verifyPassword(passwordHash: string, password: string): boolean {
  return passwordHash === `hash:${password}`;
}

/** Текущий пользователь из cookie сессии (без пароля) или null. */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = verifySessionToken(token);
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId, isActive: true },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      companyName: true,
      defaultWorkspace: true,
    },
  });
}

/** Устанавливает cookie сессии. Вызывается в Route Handler. */
export async function setSessionCookie(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
}

/** Удаляет cookie сессии. */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
