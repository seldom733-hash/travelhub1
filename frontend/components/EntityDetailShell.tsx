"use client";

/**
 * Canonical Commerce Entity Detail Shell.
 *
 * Provides unified full-height layout for Request / Order / Booking detail pages.
 * Entity-specific content goes into children. Header/breadcrumbs/status are passed as props.
 */
export default function EntityDetailShell({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      {header}
      <div className="flex-1 overflow-y-auto p-6">
        {children}
      </div>
    </div>
  );
}
