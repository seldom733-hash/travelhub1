"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { useLocale, t } from "@/lib/i18n";
import { supportApi, CASE_TYPES, PRIORITIES } from "@/lib/support";

function CreateCaseContent() {
  const locale = useLocale();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", caseType: "GENERAL", priority: "MEDIUM", source: "" });
  const effectiveLocale = locale as "ru" | "az" | "en";

  const createCase = async () => {
    if (!form.title.trim()) return;
    setCreating(true);
    setError("");
    try {
      const result = await supportApi.create({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        caseType: form.caseType || undefined,
        priority: form.priority || undefined,
        source: form.source.trim() || undefined,
      });
      router.push(`/app/support/${result.id}`);
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHeader
        title={t("support.create_case", effectiveLocale)}
        breadcrumbs={["TravelHub", t("support.title", effectiveLocale), t("support.create_case", effectiveLocale)]}
      />
      <div className="max-w-xl space-y-5 p-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <div className="font-medium">{t("support.error.load_failed", effectiveLocale)}</div>
            <div className="mt-1 text-xs text-red-500">{error}</div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              {t("support.form.title_label", effectiveLocale)} *
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
              maxLength={200}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              {t("support.form.description_label", effectiveLocale)}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              maxLength={5000}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                {t("support.form.type_label", effectiveLocale)}
              </label>
              <select
                value={form.caseType}
                onChange={(e) => setForm({ ...form, caseType: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                {CASE_TYPES.map((ty) => (
                  <option key={ty} value={ty}>{t(`support.type.${ty}`, effectiveLocale)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                {t("support.form.priority_label", effectiveLocale)}
              </label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{t(`support.priority.${p}`, effectiveLocale)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              {t("support.form.source_label", effectiveLocale)}
            </label>
            <input
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              placeholder="email / phone / chat / web"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => router.push("/app/support")}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {t("support.form.cancel", effectiveLocale)}
            </button>
            <button
              onClick={() => void createCase()}
              disabled={creating || !form.title.trim()}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "…" : t("support.form.submit", effectiveLocale)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateCasePage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-8 w-48 animate-pulse rounded bg-slate-100" /></div>}>
      <CreateCaseContent />
    </Suspense>
  );
}
