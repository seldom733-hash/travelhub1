"use client";

import Link from "next/link";
import {
  HouseSimple,
  MapPin,
  Compass,
  Van,
  Star,
  Sun,
  ForkKnife,
  DotsThree,
} from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";

interface CategoryItem {
  icon: React.ReactNode;
  label: string;
  href: string;
}

export default function QuickCategories() {
  const locale = useLocale();

  const categories: CategoryItem[] = [
    {
      icon: <HouseSimple size={20} weight="light" />,
      label: t("marketplace.category_accommodation", locale),
      href: "/search?category=accommodation",
    },
    {
      icon: <MapPin size={20} weight="light" />,
      label: t("marketplace.category_tours", locale),
      href: "/search?category=tours",
    },
    {
      icon: <Compass size={20} weight="light" />,
      label: t("marketplace.category_excursions", locale),
      href: "/search?category=excursions",
    },
    {
      icon: <Van size={20} weight="light" />,
      label: t("marketplace.category_transfers", locale),
      href: "/search?category=transfers",
    },
    {
      icon: <Star size={20} weight="light" />,
      label: t("marketplace.category_experiences", locale),
      href: "/search?category=experiences",
    },
    {
      icon: <Sun size={20} weight="light" />,
      label: t("marketplace.category_wellness", locale),
      href: "/search?category=wellness",
    },
    {
      icon: <ForkKnife size={20} weight="light" />,
      label: t("marketplace.category_gastronomy", locale),
      href: "/search?category=gastronomy",
    },
    {
      icon: <DotsThree size={20} weight="light" />,
      label: t("marketplace.category_more", locale),
      href: "/search",
    },
  ];

  return (
    <div className="flex justify-center gap-1.5 sm:gap-2 lg:gap-3">
      {categories.map((cat) => (
        <Link
          key={cat.href}
          href={cat.href}
          className="category-chip flex flex-col items-center gap-1.5 rounded-2xl bg-dark-card/80 px-2.5 py-2 text-neutral-300 backdrop-blur-sm transition-all hover:text-white sm:px-3 sm:py-2.5 lg:flex-row lg:gap-2"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-gold/10 text-gold lg:size-7">
            {cat.icon}
          </span>
          <span className="text-[11px] font-medium sm:text-xs">{cat.label}</span>
        </Link>
      ))}
    </div>
  );
}
