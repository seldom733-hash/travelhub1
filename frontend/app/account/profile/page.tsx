"use client";

import { useEffect, useState } from "react";
import { accountApi, type OwnProfile } from "@/lib/account-api";
import { t, useLocale } from "@/lib/i18n";

/**
 * PHASE 1 STEP 1.9 §10 — own-scope profile.
 * - identity (email) + business (firstName/lastName/phone через CRM Customer);
 * - backend отклоняет любые forbidden поля (role/partnerId/customerId/...);
 * - email — канонический identity, синхронизируется на Customer.
 */
export default function AccountProfilePage() {
  const locale = useLocale();
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    accountApi
      .getProfile()
      .then((p) => {
        if (!alive) return;
        setProfile(p);
        setFirstName(p.customer?.firstName ?? "");
        setLastName(p.customer?.lastName ?? "");
        setFullName(p.user.fullName ?? "");
        setEmail(p.user.email ?? "");
        setPhone(p.customer?.phone ?? "");
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const updated = await accountApi.updateProfile({
        email,
        // Связанный CRM Customer → бизнес-поля; иначе display-проекция User.
        ...(profile?.customer ? { firstName, lastName, phone } : { fullName }),
      });
      setProfile(updated);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !profile) return <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!profile) return <div className="text-sm text-slate-400">{t("state.loading", locale)}</div>;

  const hasCustomer = profile.customer !== null;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("account.profile", locale)}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("account.updated_hint", locale)}</p>
      </div>

      <form onSubmit={(e) => void save(e)} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          {hasCustomer ? (
            <>
              <div>
                <label htmlFor="p-first" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t("account.field.first_name", locale)}
                </label>
                <input
                  id="p-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label htmlFor="p-last" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t("account.field.last_name", locale)}
                </label>
                <input
                  id="p-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </>
          ) : (
            <div className="col-span-2">
              <label htmlFor="p-full" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("account.field.full_name", locale)}
              </label>
              <input
                id="p-full"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}
        </div>

        <div>
          <label htmlFor="p-email" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("account.field.email", locale)}
          </label>
          <input
            id="p-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {hasCustomer && (
          <div>
            <label htmlFor="p-phone" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("account.field.phone", locale)}
            </label>
            <input
              id="p-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>
        )}

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}
        {saved && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">{t("account.saved", locale)}</div>}

        <button
          type="submit"
          disabled={busy || !email}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? t("account.saving", locale) : t("account.save", locale)}
        </button>
      </form>
    </div>
  );
}
