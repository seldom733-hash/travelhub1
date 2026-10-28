"use client";

import { useState } from "react";

export default function StorefrontRequestForm({
  slug,
  heading,
  body,
  label,
  successMessage,
}: {
  slug: string;
  heading: string;
  body: string;
  label: string;
  successMessage: string;
}) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/public/storefronts/${encodeURIComponent(slug)}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact, message, company, consent }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? "Не удалось отправить заявку");
      }
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="request" className="mx-auto max-w-3xl px-4 py-12">
      <h2 className="text-xl font-bold text-slate-900">{heading}</h2>
      {body && <p className="mt-2 text-sm text-slate-600">{body}</p>}
      {done ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{successMessage}</div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input required minLength={3} maxLength={160} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Телефон или email" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={4} placeholder="Комментарий" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} className="hidden" aria-hidden="true" />
          <label className="flex items-start gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            Согласен на обработку персональных данных
          </label>
          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
          <button type="submit" disabled={!consent || busy} className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Отправка…" : label}
          </button>
        </form>
      )}
    </section>
  );
}
