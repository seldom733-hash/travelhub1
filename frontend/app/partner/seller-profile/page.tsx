"use client";

import { useCallback, useEffect, useState } from "react";
import { sellerApi, type SellerProfileView, type SellerProposalView } from "@/lib/seller-api";
import { t, useLocale } from "@/lib/i18n";
import { citiesOf, countryName, formatLocation } from "@/lib/locations";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  IN_REVIEW: "IN REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CHANGES_REQUESTED: "CHANGES REQUESTED",
};

const VISIBILITY_LABELS: Record<string, string> = {
  ANONYMOUS: "seller.visibility_anonymous",
  VERIFIED_ALIAS: "seller.visibility_alias",
  PUBLIC_BRAND: "seller.visibility_brand",
};

/**
 * PHASE 1 STEP 1.11 §7 — /partner/seller-profile (own-scope).
 * PARTNER предлагает публичную идентичность (alias/описание/локация);
 * публикация — только после решения MODERATOR (approve/request changes/reject).
 * PARTNER НЕ может self-approve и НЕ может сам переключить visibilityMode.
 * Контакты/ссылки/мессенджеры запрещены (anti-disintermediation, submit → 422).
 */
export default function PartnerSellerProfilePage() {
  const locale = useLocale();
  const [profile, setProfile] = useState<SellerProfileView | null>(null);
  const [latest, setLatest] = useState<SellerProposalView | null>(null);
  const [proposals, setProposals] = useState<SellerProposalView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [cityCode, setCityCode] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const own = await sellerApi.getOwnProfile();
      setProfile(own.profile);
      setLatest(own.latestProposal);
      setProposals(await sellerApi.ownProposals());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const editable = latest !== null && (latest.status === "DRAFT" || latest.status === "CHANGES_REQUESTED");

  const createDraft = async () => {
    if (!displayName.trim()) {
      setError(t("seller.required_display_name", locale));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const prop = await sellerApi.createProposal({
        publicDisplayName: displayName.trim(),
        publicDescription: description.trim() || undefined,
        cityCode: cityCode.trim() || undefined,
      });
      setLatest(prop);
      setProposals(await sellerApi.ownProposals());
      await refreshAfter(prop.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const refreshAfter = async (id: string) => {
    const own = await sellerApi.getOwnProfile();
    setProfile(own.profile);
    setLatest(own.latestProposal);
    setProposals(await sellerApi.ownProposals());
  };

  const submit = async () => {
    if (!latest) return;
    setBusy(true);
    setError("");
    try {
      await sellerApi.submitProposal(latest.id);
      await refreshAfter(latest.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const visibilityKey = profile ? (VISIBILITY_LABELS[profile.visibilityMode] ?? "seller.visibility_anonymous") : "seller.visibility_anonymous";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t("seller.nav", locale)}</h1>
        <p className="text-xs text-slate-500">{t("seller.policy_notice", locale)}</p>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-400">{t("state.loading", locale)}</div>
      ) : !profile ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">{t("seller.no_profile", locale)}</div>
      ) : (
        <>
          {/* ── Current public identity ── */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t("seller.status", locale)}</div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-400">{t("seller.visibility_mode", locale)}</dt>
                <dd className="font-semibold text-slate-800">
                  {t(visibilityKey, locale)}
                  {profile.status === "HIDDEN" && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">HIDDEN</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">{t("seller.display_name", locale)}</dt>
                <dd className="font-medium text-slate-700">{profile.publicDisplayName ?? t("seller.anonymous_label", locale)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">{t("seller.member_since", locale)}</dt>
                <dd className="text-slate-700">{new Date(profile.memberSince).toLocaleDateString(locale === "en" ? "en-GB" : locale)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Public ID</dt>
                <dd className="font-mono text-slate-700">{profile.publicId}</dd>
              </div>
              {profile.publicDescription && (
                <div className="col-span-2">
                  <dt className="text-xs text-slate-400">{t("seller.description", locale)}</dt>
                  <dd className="whitespace-pre-line text-slate-600">{profile.publicDescription}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* ── Proposal form ── */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {latest ? `${t("seller.proposal_status", locale)}: ${STATUS_LABELS[latest.status] ?? latest.status}` : t("seller.propose_btn", locale)}
            </div>

            {latest && (latest.status === "SUBMITTED" || latest.status === "IN_REVIEW") && (
              <div className="mb-3 rounded-lg border border-blue-500/30 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                {latest.status === "SUBMITTED" ? t("seller.submitted_at", locale) : "IN REVIEW"} — {t("seller.policy_notice", locale)}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-500">{t("seller.display_name", locale)}</label>
                <input
                  value={displayName || latest?.requestedDisplayName || ""}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={!editable && latest !== null}
                  placeholder={t("seller.display_name_hint", locale)}
                  maxLength={120}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:opacity-60"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-500">{t("seller.description", locale)}</label>
                <textarea
                  value={description || latest?.requestedDescription || ""}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!editable && latest !== null}
                  rows={3}
                  maxLength={1000}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">{t("seller.country_system", locale)}</label>
                {/* FIX 2: страна — системная identity (crm.Partner), партнёр НЕ может
                    её подменить locale-значением. Locale меняет только label. */}
                <input
                  value={countryName(profile.systemCountryCode ?? profile.countryCode, locale) ?? "—"}
                  disabled
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">{t("seller.city_label", locale)}</label>
                <select
                  value={cityCode || latest?.requestedCityCode || ""}
                  onChange={(e) => setCityCode(e.target.value)}
                  disabled={!editable && latest !== null}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:opacity-60"
                >
                  <option value="">{t("seller.city_none", locale)}</option>
                  {citiesOf(profile.systemCountryCode ?? profile.countryCode).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {formatLocation(profile.systemCountryCode ?? profile.countryCode, c.code, locale)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(!latest || editable) && (
                <button onClick={() => void createDraft()} disabled={busy} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {latest ? t("seller.save_btn", locale) : t("seller.propose_btn", locale)}
                </button>
              )}
              {latest && (latest.status === "DRAFT" || latest.status === "CHANGES_REQUESTED") && (
                <button onClick={() => void submit()} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {t("seller.submit_btn", locale)}
                </button>
              )}
            </div>
          </section>

          {/* ── History ── */}
          {proposals.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t("seller.history", locale)}</div>
              <ol className="space-y-2">
                {proposals.slice(0, 10).map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono text-slate-400">{p.code}</span>
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${p.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : p.status === "REJECTED" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                    {p.requestedDisplayName && <span>«{p.requestedDisplayName}»</span>}
                    {p.decisionReason && <span className="text-slate-400">— {p.decisionReason}</span>}
                    {p.approvedVisibilityMode && <span className="text-slate-400">→ {p.approvedVisibilityMode}</span>}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </div>
  );
}
