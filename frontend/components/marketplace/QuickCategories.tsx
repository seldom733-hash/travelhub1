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
      icon: <HouseSimple size={24} weight="light" />,
      label: t("marketplace.category_accommodation", locale),
      href: "/search?category=accommodation",
    },
    {
      icon: <MapPin size={24} weight="light" />,
      label: t("marketplace.category_tours", locale),
      href: "/search?category=tours",
    },
    {
      icon: <Compass size={24} weight="light" />,
      label: t("marketplace.category_excursions", locale),
      href: "/search?category=excursions",
    },
    {
      icon: <Van size={24} weight="light" />,
      label: t("marketplace.category_transfers", locale),
      href: "/search?category=transfers",
    },
    {
      icon: <Star size={24} weight="light" />,
      label: t("marketplace.category_experiences", locale),
      href: "/search?category=experiences",
    },
    {
      icon: <Sun size={24} weight="light" />,
      label: t("marketplace.category_wellness", locale),
      href: "/search?category=wellness",
    },
    {
      icon: <ForkKnife size={24} weight="light" />,
      label: t("marketplace.category_gastronomy", locale),
      href: "/search?category=gastronomy",
    },
    {
      icon: <DotsThree size={24} weight="light" />,
      label: t("marketplace.category_more", locale),
      href: "/search",
    },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {categories.map((cat) => (
        <Link
          key={cat.href}
          href={cat.href}
          className="category-chip flex items-center gap-2 rounded-full bg-dark-card/80 px-4 py-2.5 text-sm text-neutral-300 backdrop-blur-sm transition-all hover:text-white"
        >
          <span className="text-gold">{cat.icon}</span>
          <span>{cat.label}</span>
        </Link>
      ))}
    </div>
  );
}
