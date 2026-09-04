"use client";

/**
 * Canonical Commerce Entity Field Grid.
 *
 * Unified grid rhythm for EntityField groups inside detail section cards.
 * Column count may be tuned per section via className (same gap/spacing grammar).
 */
export default function EntityFieldGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className ?? ""}`}>
      {children}
    </div>
  );
}