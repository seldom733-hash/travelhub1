"use client";

import Link from "next/link";

/**
 * Canonical Commerce Entity Link.
 *
 * Same link grammar on every detail page (Request / Order / Booking relations,
 * catalog refs, customer/partner refs). Pass className to add mono/ref styling.
 */
export default function EntityLink({
  href,
  children,
  className,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`font-medium text-blue-600 hover:underline ${className ?? ""}`}
    >
      {children}
    </Link>
  );
}