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

const CARDS = [
  {
    href: "/app/catalog",
    icon: "📚",
    titleKey: "workspace.card.catalog",
    descKey: "workspace.card.catalog.desc",
    color: "from-blue-500 to-blue-600",
    permission: "catalog.product.read",
  },
  {
    href: "/app/orders",
    icon: "🧾",
    titleKey: "workspace.card.orders",
    descKey: "workspace.card.orders.desc",
    color: "from-violet-500 to-purple-600",
    permission: "order.read",
  },
  {
    href: "/app/bookings",
    icon: "📑",
    titleKey: "workspace.card.bookings",
    descKey: "workspace.card.bookings.desc",
    color: "from-amber-500 to-orange-600",
    permission: "booking.read",
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
    color: "from-indigo-500 to-blue-600",
    permission: "analytics.read",
  },
  {
    href: "/app/analytics",
    icon: "📈",
    titleKey: "workspace.card.analytics",
    descKey: "workspace.card.analytics.desc",
    color: "from-cyan-500 to-blue-500",
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
    href: "/app/partners/onboarding",
    icon: "📋",
    titleKey: "workspace.card.partners",
    descKey: "workspace.card.partners.desc",
    color: "from-teal-500 to-emerald-600",
    permission: "partner.onboarding.review",
  },
  {
    href: "/app/seller-profiles",
    icon: "🛡",
    titleKey: "workspace.card.sellers",
    descKey: "workspace.card.sellers.desc",
    color: "from-slate-500 to-slate-600",
    permission: "seller_public_profile.review",
  },
  {
    href: "/app/users",
    icon: "👥",
    titleKey: "workspace.card.users",
    descKey: "workspace.card.users.desc",
    color: "from-sky-500 to-indigo-500",
    permission: "settings.write",
  },
];

export default function OverviewPage() {
  const user = useCurrentUser();
  const locale = useLocale();

  const visible = user ? CARDS.filter((c) => user.permissions.includes(c.permission)) : CARDS;
  const hiddenCount = CARDS.length - visible.length;

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-2xl font-bold text-slate-900">{t("nav.dashboard", locale)}</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          >
            <div className={`flex size-12 items-center justify-center rounded-xl bg-gradient-to-br text-xl text-white ${c.color}`}>
              {c.icon}
            </div>
            <div className="mt-3 text-base font-bold text-slate-900 group-hover:text-blue-600">
              {t(c.titleKey, locale)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {t(c.descKey, locale)}
            </div>
          </Link>
        ))}
        {hiddenCount > 0 && (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-400">
            {t("workspace.hidden_count", locale).replace("{n}", String(hiddenCount))}
          </div>
        )}
      </div>
    </div>
  );
}
