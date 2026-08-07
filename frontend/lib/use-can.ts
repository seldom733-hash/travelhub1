"use client";

import { useCurrentUser } from "./use-user";

/**
 * Проверка granular permission у текущего пользователя (RBAC Matrix §4).
 * Без permission — true (действие не требует прав).
 */
export function useCan(permission?: string): boolean {
  const user = useCurrentUser();
  if (!permission) return true;
  return user?.permissions.includes(permission) ?? false;
}
