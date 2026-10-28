"use client";

import { permissionLabel, type PermissionLocale } from "@/lib/permission-labels";

/** Display-only permission name; the authorization code remains on the backend. */
export default function PermissionLabel({
  code,
  locale = "ru",
  className,
}: {
  code: string;
  locale?: PermissionLocale;
  className?: string;
}) {
  return <span className={className}>{permissionLabel(code, locale)}</span>;
}
