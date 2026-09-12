"use client";

import { useState } from "react";
import { useLocale, t } from "@/lib/i18n";
import { constructorApi } from "@/lib/constructor-api";

interface FooterConfig {
  name?: Record<string, string>;
  description?: Record<string, string>;
  phone?: string;
  email?: string;
  copyright?: Record<string, string>;
}

interface Props {
  slug: string;
  config: Record<string, unknown> | null;
  onSaved: () => void;
  onSaving: (v: boolean) => void;
  onError: (msg: string | null) => void;
}

export default function ConstructorFooterTab({ slug, config, onSaved, onSaving, onError }: Props) {
  const locale = useLocale();
  const year = new Date().getFullYear();

  const [cfg, setCfg] = useState<FooterConfig>(() => ({
    name: (config?.name as Record<string, string>) ?? { ru: "TravelHub", az: "TravelHub", en: "TravelHub" },
    description: (config?.description as Record<string, string>) ?? {
      ru: "Лучшие предложения для путешествий",
      az: "Səyahət üçün ən yaxşı təkliflər",
      en: "Best travel offers",
    },
    phone: (config?.phone as string) ?? "+994 12 345 67 89",
    email: (config?.email as string) ?? "info@travelhub.az",
    copyright: (config?.copyright as Record<string, string>) ?? {
      ru: `© ${year} TravelHub. Все права защищены.`,
      az: `© ${year} TravelHub. Bütün hüquqlar qorunur.`,
      en: `© ${year} TravelHub. All rights reserved.`,
    },
  }));

  async function handleSave() {
    onSaving(true);
    onError(null);
    try {
      await constructorApi.saveFooterConfig(slug, cfg as unknown as Record<string, unknown>);
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      onSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Brand name */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">{t("constructor.footer_brand_name", locale)}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["ru", "az", "en"] as const).map((loc) => (
            <div key={loc}>
              <label className="mb-1 block text-xs font-medium text-slate-500 uppercase">{loc}</label>
              <input
                type="text"
                value={cfg.name?.[loc] ?? ""}
                onChange={(e) => setCfg((prev) => ({ ...prev, name: { ...prev.name, [loc]: e.target.value } }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">{t("constructor.footer_description", locale)}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["ru", "az", "en"] as const).map((loc) => (
            <div key={loc}>
              <label className="mb-1 block text-xs font-medium text-slate-500 uppercase">{loc}</label>
              <textarea
                value={cfg.description?.[loc] ?? ""}
                onChange={(e) => setCfg((prev) => ({ ...prev, description: { ...prev.description, [loc]: e.target.value } }))}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Contacts */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">{t("constructor.footer_phone", locale)} / {t("constructor.footer_email", locale)}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t("constructor.footer_phone", locale)}</label>
            <input type="tel" value={cfg.phone ?? ""} onChange={(e) => setCfg((p) => ({ ...p, phone: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t("constructor.footer_email", locale)}</label>
            <input type="email" value={cfg.email ?? ""} onChange={(e) => setCfg((p) => ({ ...p, email: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">{t("constructor.footer_copyright", locale)}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["ru", "az", "en"] as const).map((loc) => (
            <div key={loc}>
              <label className="mb-1 block text-xs font-medium text-slate-500 uppercase">{loc}</label>
              <input
                type="text"
                value={cfg.copyright?.[loc] ?? ""}
                onChange={(e) => setCfg((prev) => ({ ...prev, copyright: { ...prev.copyright, [loc]: e.target.value } }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
              />
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleSave} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
        {t("constructor.footer_save", locale)}
      </button>
    </div>
  );
}
