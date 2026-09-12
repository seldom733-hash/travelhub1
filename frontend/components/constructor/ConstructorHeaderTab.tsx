"use client";

import { useState, useRef } from "react";
import { useLocale, t } from "@/lib/i18n";
import { constructorApi } from "@/lib/constructor-api";
import { Upload, X, Phone, EnvelopeSimple, MapPin } from "@phosphor-icons/react";

interface HeaderConfig {
  logo?: { url: string; width: number; height: number; size: number; format: string } | null;
  companyName?: Record<string, string>;
  phone?: string;
  email?: string;
  address?: string;
  navVisible?: boolean;
}

interface Props {
  slug: string;
  config: Record<string, unknown> | null;
  onSaved: () => void;
  onSaving: (v: boolean) => void;
  onError: (msg: string | null) => void;
}

export default function ConstructorHeaderTab({ slug, config, onSaved, onSaving, onError }: Props) {
  const locale = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [cfg, setCfg] = useState<HeaderConfig>(() => ({
    logo: (config?.logo as HeaderConfig["logo"]) ?? null,
    companyName: (config?.companyName as Record<string, string>) ?? { ru: "TravelHub", az: "TravelHub", en: "TravelHub" },
    phone: (config?.phone as string) ?? "",
    email: (config?.email as string) ?? "",
    address: (config?.address as string) ?? "",
    navVisible: (config?.navVisible as boolean) ?? true,
  }));

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    onError(null);
    try {
      const result = await constructorApi.uploadMedia(slug, file, "logo");
      setCfg((prev) => ({ ...prev, logo: result }));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeLogo() {
    setCfg((prev) => ({ ...prev, logo: null }));
  }

  async function handleSave() {
    onSaving(true);
    onError(null);
    try {
      await constructorApi.saveHeaderConfig(slug, cfg as unknown as Record<string, unknown>);
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      onSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Logo */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">{t("constructor.header_logo", locale)}</h3>
        {cfg.logo ? (
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cfg.logo.url} alt="Logo" className="h-16 w-auto rounded border border-slate-200 bg-white p-1 object-contain" />
            <div className="flex-1 text-xs text-slate-500 space-y-1">
              <div>{cfg.logo.width} × {cfg.logo.height}</div>
              <div>{cfg.logo.format} · {(cfg.logo.size / 1024).toFixed(0)} KB</div>
            </div>
            <button onClick={removeLogo} className="rounded p-1 text-slate-400 hover:text-red-500" aria-label="Remove logo">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-8 transition-colors hover:border-blue-300 hover:bg-blue-50"
          >
            <Upload className="h-5 w-5 text-slate-400" />
            <span className="text-sm text-slate-500">
              {uploading ? t("constructor.saving", locale) : t("constructor.header_upload_logo", locale)}
            </span>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleLogoUpload} />
      </div>

      {/* Company Name (localized) */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">{t("constructor.header_company_name", locale)}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["ru", "az", "en"] as const).map((loc) => (
            <div key={loc}>
              <label className="mb-1 block text-xs font-medium text-slate-500 uppercase">{loc}</label>
              <input
                type="text"
                value={cfg.companyName?.[loc] ?? ""}
                onChange={(e) => setCfg((prev) => ({ ...prev, companyName: { ...prev.companyName, [loc]: e.target.value } }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Contacts */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">{t("constructor.header_phone", locale)} / {t("constructor.header_email", locale)}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Phone className="h-3 w-3" /> {t("constructor.header_phone", locale)}
            </label>
            <input
              type="tel"
              value={cfg.phone ?? ""}
              onChange={(e) => setCfg((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="+994 12 345 67 89"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <EnvelopeSimple className="h-3 w-3" /> {t("constructor.header_email", locale)}
            </label>
            <input
              type="email"
              value={cfg.email ?? ""}
              onChange={(e) => setCfg((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="info@travelhub.az"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <MapPin className="h-3 w-3" /> {t("constructor.header_address", locale)}
          </label>
          <input
            type="text"
            value={cfg.address ?? ""}
            onChange={(e) => setCfg((prev) => ({ ...prev, address: e.target.value }))}
            placeholder="Баку, Азербайджан"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Navigation visibility */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={cfg.navVisible ?? true}
            onChange={(e) => setCfg((prev) => ({ ...prev, navVisible: e.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700">{t("constructor.tab_header", locale)} — Navigation</span>
        </label>
      </div>

      {/* Save */}
      <button onClick={handleSave} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
        {t("constructor.header_save", locale)}
      </button>
    </div>
  );
}
