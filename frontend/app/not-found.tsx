import Link from "next/link";

/** Step 1.6 §18: контролируемый 404 (вместо error dump). */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center">
      <div className="text-5xl">🧭</div>
      <h1 className="mt-4 text-xl font-bold text-slate-900">Страница не найдена</h1>
      <p className="mt-2 text-sm text-slate-500">Такой страницы не существует или она была перемещена.</p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          На витрину
        </Link>
        <Link
          href="/app/dashboard"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Рабочая область
        </Link>
      </div>
    </div>
  );
}
