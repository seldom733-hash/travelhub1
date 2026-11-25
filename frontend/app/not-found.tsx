import Link from "next/link";

/** Step 1.6 §18: контролируемый 404 (вместо error dump). */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center">
      <div className="text-5xl">🧭</div>
      <h1 className="mt-4 text-xl font-bold text-ink">Страница не найдена</h1>
      <p className="mt-2 text-sm text-ink/60">Такой страницы не существует или она была перемещена.</p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          На витрину
        </Link>
        <Link
          href="/app/dashboard"
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-panel"
        >
          Рабочая область
        </Link>
      </div>
    </div>
  );
}
