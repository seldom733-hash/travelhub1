"use client";

/**
 * Canonical Commerce Entity Section Card.
 *
 * Unified visual container for detail-page sections (Клиент, Поставщик, Финансы, etc.).
 * Different business content, same visual grammar.
 */
export default function EntitySectionCard({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-line bg-white p-4 ${className ?? ""}`}>
      {title && (
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/60">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
