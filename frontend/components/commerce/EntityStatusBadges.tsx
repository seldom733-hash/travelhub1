"use client";

/**
 * Canonical Commerce Entity Status Badges.
 *
 * Unified flex-wrap container for lifecycle / payment / refund badges
 * in detail headers and relation rows.
 */
export default function EntityStatusBadges({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}