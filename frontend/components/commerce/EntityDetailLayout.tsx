"use client";

/**
 * Canonical Commerce Entity Detail Layout.
 *
 * Single source of truth for the desktop two-zone page composition used by
 * Request / Order / Booking detail pages:
 *
 *   MAIN (≈2/3)                          |  ASIDE context column (≈1/3)
 *   primary + secondary business cards   |  timeline + details/meta cards
 *   ──────────────────────────────────────────────────────────────────
 *   WIDE lower slots (full width): Relations / Notes / Audit
 *
 * One grid contract (lg:grid-cols-3, gap-4), one main/aside ratio (2:1),
 * one responsive stacking order (Main → Aside → Wide) on all three pages.
 * Page files supply business content into these slots — never competing
 * page-level grid grammars.
 */

export function EntityDetailLayout({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">{children}</div>;
}

export function EntityDetailMain({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 space-y-4 lg:col-span-2 ${className ?? ""}`}>
      {children}
    </div>
  );
}

export function EntityDetailAside({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 space-y-4 lg:col-span-1 ${className ?? ""}`}>
      {children}
    </div>
  );
}

export function EntityDetailWide({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 lg:col-span-3 ${className ?? ""}`}>
      {children}
    </div>
  );
}

export default EntityDetailLayout;