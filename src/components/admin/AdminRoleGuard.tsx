"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { canAccessAdminPath } from "@/lib/admin-menu";

/**
 * Ограничение доступа к разделам админки по роли (Гл. 1.2).
 * SALES_MANAGER — Dashboard и «Продажи», OPERATOR — Dashboard и «Исполнение».
 * При попытке открыть чужой раздел — редирект на Dashboard (главный экран).
 * Роль передаётся из серверного layout (getCurrentUser), чтобы нельзя было
 * подделать её на клиенте.
 */
export default function AdminRoleGuard({ role }: { role: string }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!canAccessAdminPath(pathname, role)) {
      router.replace("/admin");
    }
  }, [pathname, role, router]);

  return null;
}
