"use client";

import { useState } from "react";
import { useLocale, t } from "@/lib/i18n";
import { constructorApi } from "@/lib/constructor-api";

interface DesignConfig {
  typography: {
    fontFamily: string;
    headingFont: string;
    bodyFont: string;
    baseFontSize: number;
    headingWeight: number;
    lineHeight: number;
    letterSpacing: string;
  };
  colors: {
    background: string;
    surface: string;
    text: string;
    mutedText: string;
    accent: string;
    border: string;
  };
  spacing: {
    sectionSpacing: number;
    containerWidth: number;
    internalPadding: number;
  };
  components: {
    cardRadius: number;
    buttonRadius: number;
    inputRadius: number;
  };
}

interface Props {
  slug: string;
  config: Record<string, unknown> | null;
  onSaved: () => void;
  onSaving: (v: boolean) => void;
  onError: (msg: string | null) => void;
}

const DEFAULT_DESIGN: DesignConfig = {
  typography: {
    fontFamily: "Inter, system-ui, sans-serif",
    headingFont: "Georgia, serif",
    bodyFont: "Inter, system-ui, sans-serif",
    baseFontSize: 16,
    headingWeight: 700,
    lineHeight: 1.6,
    letterSpacing: "0",
  },
  colors: {
    background: "#0a0a0a",
    surface: "#1a1a1a",
    text: "#ffffff",
    mutedText: "#a0a0a0",
    accent: "#d4a853",
    border: "#2a2a2a",
  },
  spacing: {
    sectionSpacing: 80,
    containerWidth: 1400,
    internalPadding: 24,
  },
  components: {
    cardRadius: 12,
    buttonRadius: 8,
    inputRadius: 8,
  },
};

export default function ConstructorDesignTab({ slug, config, onSaved, onSaving, onError }: Props) {
  const locale = useLocale();
  const [cfg, setCfg] = useState<DesignConfig>(() => {
    const saved = config as DesignConfig | null;
    return saved?.typography ? saved : DEFAULT_DESIGN;
  });

  function updateTypo<K extends keyof DesignConfig["typography"]>(key: K, value: DesignConfig["typography"][K]) {
    setCfg((prev) => ({ ...prev, typography: { ...prev.typography, [key]: value } }));
  }

  function updateColor<K extends keyof DesignConfig["colors"]>(key: K, value: string) {
    setCfg((prev) => ({ ...prev, colors: { ...prev.colors, [key]: value } }));
  }

  function updateSpacing<K extends keyof DesignConfig["spacing"]>(key: K, value: number) {
    setCfg((prev) => ({ ...prev, spacing: { ...prev.spacing, [key]: value } }));
  }

  function updateComponent<K extends keyof DesignConfig["components"]>(key: K, value: number) {
    setCfg((prev) => ({ ...prev, components: { ...prev.components, [key]: value } }));
  }

  async function handleSave() {
    onSaving(true);
    onError(null);
    try {
      await constructorApi.saveDesignConfig(slug, cfg as unknown as Record<string, unknown>);
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      onSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Typography */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">{t("constructor.design_font_family", locale)}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Heading Font</label>
            <select value={cfg.typography.headingFont} onChange={(e) => updateTypo("headingFont", e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
              <option value="Georgia, serif">Georgia (Serif)</option>
              <option value="'Playfair Display', serif">Playfair Display</option>
              <option value="'Times New Roman', serif">Times New Roman</option>
              <option value="system-ui, sans-serif">System UI</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Body Font</label>
            <select value={cfg.typography.bodyFont} onChange={(e) => updateTypo("bodyFont", e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
              <option value="Inter, system-ui, sans-serif">Inter</option>
              <option value="system-ui, sans-serif">System UI</option>
              <option value="'Segoe UI', sans-serif">Segoe UI</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Base Font Size (px)</label>
            <input type="number" min={12} max={20} value={cfg.typography.baseFontSize} onChange={(e) => updateTypo("baseFontSize", Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Line Height</label>
            <input type="number" min={1} max={2.5} step={0.1} value={cfg.typography.lineHeight} onChange={(e) => updateTypo("lineHeight", Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Colors</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {([
            ["background", t("constructor.design_bg_color", locale)],
            ["surface", "Surface"],
            ["text", t("constructor.design_text_color", locale)],
            ["mutedText", "Muted Text"],
            ["accent", t("constructor.design_accent_color", locale)],
            ["border", "Border"],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <label className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-500">
                <span className="inline-block h-4 w-4 rounded border border-slate-200" style={{ backgroundColor: cfg.colors[key] }} />
                {label}
              </label>
              <div className="flex gap-2">
                <input type="color" value={cfg.colors[key]} onChange={(e) => updateColor(key, e.target.value)} className="h-9 w-9 cursor-pointer rounded border border-slate-200" />
                <input type="text" value={cfg.colors[key]} onChange={(e) => updateColor(key, e.target.value)} className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-mono outline-none focus:border-blue-500" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Spacing */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Spacing & Layout</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t("constructor.design_section_spacing", locale)} (px)</label>
            <input type="number" min={0} max={200} step={8} value={cfg.spacing.sectionSpacing} onChange={(e) => updateSpacing("sectionSpacing", Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t("constructor.design_container_width", locale)} (px)</label>
            <input type="number" min={800} max={1800} step={50} value={cfg.spacing.containerWidth} onChange={(e) => updateSpacing("containerWidth", Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Internal Padding (px)</label>
            <input type="number" min={0} max={64} step={4} value={cfg.spacing.internalPadding} onChange={(e) => updateSpacing("internalPadding", Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
        </div>
      </div>

      {/* Component radii */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Components</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Card Radius (px)</label>
            <input type="number" min={0} max={24} value={cfg.components.cardRadius} onChange={(e) => updateComponent("cardRadius", Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Button Radius (px)</label>
            <input type="number" min={0} max={24} value={cfg.components.buttonRadius} onChange={(e) => updateComponent("buttonRadius", Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Input Radius (px)</label>
            <input type="number" min={0} max={24} value={cfg.components.inputRadius} onChange={(e) => updateComponent("inputRadius", Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
        </div>
      </div>

      <button onClick={handleSave} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
        {t("constructor.design_save", locale)}
      </button>
    </div>
  );
}
