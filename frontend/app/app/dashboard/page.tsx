"use client";

/**
 * Platform Workspace Home — /app/dashboard
 *
 * Navigation hub for internal platform users.
 * Shows cards for actually implemented workspace centers.
 * NOT a duplicate of Command Center or Analytics.
 */

import Link from "next/link";
import { useCurrentUser } from "@/lib/use-user";
import { useLocale, t } from "@/lib/i18n";
import { NAV_BY_HREF, canAccess } from "@/lib/nav";

const CARDS = [
  {
    href: "/app/catalog",
    icon: "📚",
    titleKey: "workspace.card.catalog",
    descKey: "workspace.card.catalog.desc",
    color: "from-brand to-brand-dark",
    permission: "catalog.product.read",
  },
  {
    href: "/app/finance/deals",
    icon: "🧾",
    titleKey: "workspace.card.registry",
    descKey: "workspace.card.registry.desc",
    color: "from-violet-500 to-purple-600",
    permission: "order.read",
  },
  {
    href: "/app/crm",
    icon: "🤝",
    titleKey: "workspace.card.crm",
    descKey: "workspace.card.crm.desc",
    color: "from-emerald-500 to-teal-600",
    permission: "crm.customer.read",
  },
  {
    href: "/app/marketing",
    icon: "📣",
    titleKey: "workspace.card.marketing",
    descKey: "workspace.card.marketing.desc",
    color: "from-pink-500 to-rose-600",
    permission: "marketing.campaign.read",
  },
  {
    href: "/app/command-center",
    icon: "📊",
    titleKey: "workspace.card.command_center",
    descKey: "workspace.card.command_center.desc",
    color: "from-brand to-brand-dark",
    permission: "analytics.read",
  },
  {
    href: "/app/analytics/sales",
    icon: "📈",
    titleKey: "workspace.card.analytics",
    descKey: "workspace.card.analytics.desc",
    color: "from-brand to-brand",
    permission: "analytics.read",
  },
  {
    href: "/app/support",
    icon: "🎫",
    titleKey: "workspace.card.support",
    descKey: "workspace.card.support.desc",
    color: "from-orange-500 to-red-500",
    permission: "support.case.read",
  },
  {
    href: "/app/references",
    icon: "📚",
    titleKey: "workspace.card.references",
    descKey: "workspace.card.references.desc",
    color: "from-teal-500 to-emerald-600",
    permission: "hotel_directory.read",
  },
  {
    href: "/app/users",
    icon: "👥",
    titleKey: "workspace.card.users",
    descKey: "workspace.card.users.desc",
    color: "from-brand to-brand",
    permission: "settings.write",
  },
];

export default function OverviewPage() {
  const user = useCurrentUser();
  const locale = useLocale();

  const visible = user
    ? CARDS.filter((c) => {
        const access = NAV_BY_HREF[c.href];
        return access ? canAccess(user, access) : user.permissions.includes(c.permission);
      })
    : CARDS;
  const hiddenCount = CARDS.length - visible.length;

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-2xl font-bold text-ink">{t("nav.dashboard", locale)}</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group rounded-2xl border border-line bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <div className={`flex size-12 items-center justify-center rounded-xl bg-gradient-to-br text-xl text-white ${c.color}`}>
              {c.icon}
            </div>
            <div className="mt-3 text-base font-bold text-ink group-hover:text-brand">
              {t(c.titleKey, locale)}
            </div>
            <div className="mt-1 text-xs text-ink/60">
              {t(c.descKey, locale)}
            </div>
          </Link>
        ))}
        {hiddenCount > 0 && (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-line bg-panel p-5 text-center text-xs text-ink/60">
            {t("workspace.hidden_count", locale).replace("{n}", String(hiddenCount))}
          </div>
        )}
      </div>
    </div>
  );
}
