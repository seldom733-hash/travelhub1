"use client";

import { useState, useRef } from "react";
import { useLocale, t } from "@/lib/i18n";
import { constructorApi } from "@/lib/constructor-api";
import { Plus, Trash, Upload, ArrowsClockwise, Warning } from "@phosphor-icons/react";

interface HeroSlide {
  id: string;
  imageUrl: string;
  title: Record<string, string>;
  subtitle: Record<string, string>;
  ctaLabel: Record<string, string>;
  ctaUrl: string;
  imageMeta?: { width: number; height: number; format: string; size: number };
}

interface HeroConfig {
  slides: HeroSlide[];
  carousel: {
    autoplay: boolean;
    interval: number;
    showArrows: boolean;
    showIndicators: boolean;
  };
}

interface Props {
  slug: string;
  config: Record<string, unknown> | null;
  onSaved: () => void;
  onSaving: (v: boolean) => void;
  onError: (msg: string | null) => void;
}

const DEFAULT_SLIDES: HeroSlide[] = [
  {
    id: "slide-1",
    imageUrl: "/hero1.png",
    title: { ru: "", az: "", en: "" },
    subtitle: { ru: "", az: "", en: "" },
    ctaLabel: { ru: "", az: "", en: "" },
    ctaUrl: "/search",
  },
  {
    id: "slide-2",
    imageUrl: "/hero2.png",
    title: { ru: "", az: "", en: "" },
    subtitle: { ru: "", az: "", en: "" },
    ctaLabel: { ru: "", az: "", en: "" },
    ctaUrl: "/search",
  },
  {
    id: "slide-3",
    imageUrl: "/hero3.png",
    title: { ru: "", az: "", en: "" },
    subtitle: { ru: "", az: "", en: "" },
    ctaLabel: { ru: "", az: "", en: "" },
    ctaUrl: "/search",
  },
];

const MAX_SLIDES = 8;

function makeEmptySlide(existing: HeroSlide[]): HeroSlide {
  const num = existing.length + 1;
  return {
    id: `slide-${num}-${Date.now()}`,
    imageUrl: "",
    title: { ru: "", az: "", en: "" },
    subtitle: { ru: "", az: "", en: "" },
    ctaLabel: { ru: "", az: "", en: "" },
    ctaUrl: "/search",
  };
}

export default function ConstructorHeroTab({ slug, config, onSaved, onSaving, onError }: Props) {
  const locale = useLocale();
  const [cfg, setCfg] = useState<HeroConfig>(() => {
    const slides = (config?.slides as HeroSlide[] | undefined);
    return {
      slides: slides?.length ? slides : DEFAULT_SLIDES,
      carousel: (config?.carousel as HeroConfig["carousel"]) ?? { autoplay: true, interval: 7000, showArrows: true, showIndicators: true },
    };
  });
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const fileRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  async function handleImageUpload(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIdx(idx);
    onError(null);
    try {
      const result = await constructorApi.uploadMedia(slug, file, "hero-slide");
      setCfg((prev) => {
        const slides = [...prev.slides];
        slides[idx] = { ...slides[idx], imageUrl: result.url, imageMeta: { width: result.width, height: result.height, format: result.format, size: result.size } };
        return { ...prev, slides };
      });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingIdx(null);
      const ref = fileRefs.current.get(idx);
      if (ref) ref.value = "";
    }
  }

  function addSlide() {
    if (cfg.slides.length >= MAX_SLIDES) return;
    setCfg((prev) => ({ ...prev, slides: [...prev.slides, makeEmptySlide(prev.slides)] }));
  }

  function removeSlide(idx: number) {
    if (cfg.slides.length <= 1) return;
    setCfg((prev) => ({ ...prev, slides: prev.slides.filter((_, i) => i !== idx) }));
  }

  function updateSlide(idx: number, patch: Partial<HeroSlide>) {
    setCfg((prev) => {
      const slides = [...prev.slides];
      slides[idx] = { ...slides[idx], ...patch };
      return { ...prev, slides };
    });
  }

  function updateSlideLocale(idx: number, field: "title" | "subtitle" | "ctaLabel", loc: string, value: string) {
    setCfg((prev) => {
      const slides = [...prev.slides];
      slides[idx] = { ...slides[idx], [field]: { ...slides[idx][field], [loc]: value } };
      return { ...prev, slides };
    });
  }

  function moveSlide(from: number, to: number) {
    if (to < 0 || to >= cfg.slides.length) return;
    setCfg((prev) => {
      const slides = [...prev.slides];
      const [moved] = slides.splice(from, 1);
      slides.splice(to, 0, moved);
      return { ...prev, slides };
    });
  }

  async function handleSave() {
    onSaving(true);
    onError(null);
    try {
      await constructorApi.saveHeroConfig(slug, cfg as unknown as Record<string, unknown>);
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      onSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Carousel settings */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">
          <ArrowsClockwise className="mr-1.5 inline h-4 w-4" />
          Carousel
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={cfg.carousel.autoplay} onChange={(e) => setCfg((p) => ({ ...p, carousel: { ...p.carousel, autoplay: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
            <span className="text-sm text-slate-700">{t("constructor.hero_autoplay", locale)}</span>
          </label>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t("constructor.hero_interval", locale)}</label>
            <input type="number" min={3000} max={15000} step={500} value={cfg.carousel.interval} onChange={(e) => setCfg((p) => ({ ...p, carousel: { ...p.carousel, interval: Number(e.target.value) } }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={cfg.carousel.showArrows} onChange={(e) => setCfg((p) => ({ ...p, carousel: { ...p.carousel, showArrows: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
            <span className="text-sm text-slate-700">{t("constructor.hero_show_arrows", locale)}</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={cfg.carousel.showIndicators} onChange={(e) => setCfg((p) => ({ ...p, carousel: { ...p.carousel, showIndicators: e.target.checked } }))} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
            <span className="text-sm text-slate-700">{t("constructor.hero_show_indicators", locale)}</span>
          </label>
        </div>
      </div>

      {/* Slides */}
      {cfg.slides.map((slide, idx) => (
        <div key={slide.id} className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              {t("constructor.tab_hero", locale)} {idx + 1} / {cfg.slides.length}
            </h3>
            <div className="flex items-center gap-1">
              {idx > 0 && (
                <button onClick={() => moveSlide(idx, idx - 1)} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">↑</button>
              )}
              {idx < cfg.slides.length - 1 && (
                <button onClick={() => moveSlide(idx, idx + 1)} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">↓</button>
              )}
              {cfg.slides.length > 1 && (
                <button onClick={() => removeSlide(idx)} className="rounded p-1 text-slate-400 hover:text-red-500" aria-label={t("constructor.hero_delete_slide", locale)}>
                  <Trash className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Image */}
          <div className="mb-4">
            {slide.imageUrl ? (
              <div className="flex items-start gap-3">
                <div className="relative h-28 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="flex-1 text-xs text-slate-500 space-y-1">
                  {slide.imageMeta && (
                    <>
                      <div>{slide.imageMeta.width} × {slide.imageMeta.height} · {slide.imageMeta.format} · {(slide.imageMeta.size / 1024 / 1024).toFixed(1)} MB</div>
                      <div className={slide.imageMeta.width >= 1200 && slide.imageMeta.height >= 400 ? "text-green-600" : "text-red-600"}>
                        {slide.imageMeta.width >= 1200 && slide.imageMeta.height >= 400
                          ? t("constructor.hero_image_valid", locale)
                          : t("constructor.hero_image_invalid", locale)}
                      </div>
                      <div className="text-slate-400">{t("constructor.hero_min_dimensions", locale)}</div>
                    </>
                  )}
                  <button onClick={() => fileRefs.current.get(idx)?.click()} className="mt-1 text-blue-600 hover:underline">
                    {t("constructor.hero_replace_image", locale)}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileRefs.current.get(idx)?.click()}
                disabled={uploadingIdx === idx}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-6 transition-colors hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
              >
                <Upload className="h-5 w-5 text-slate-400" />
                <span className="text-sm text-slate-500">
                  {uploadingIdx === idx ? t("constructor.saving", locale) : t("constructor.hero_upload_image", locale)}
                </span>
              </button>
            )}
            <input
              ref={(el) => { if (el) fileRefs.current.set(idx, el); }}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleImageUpload(idx, e)}
            />
          </div>

          {/* Localized text */}
          <div className="grid gap-3 sm:grid-cols-3">
            {(["ru", "az", "en"] as const).map((loc) => (
              <div key={loc} className="space-y-2">
                <label className="mb-1 block text-xs font-medium text-slate-500 uppercase">{loc}</label>
                <input
                  type="text"
                  placeholder={t("constructor.hero_slide_title", locale)}
                  value={slide.title[loc] ?? ""}
                  onChange={(e) => updateSlideLocale(idx, "title", loc, e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder={t("constructor.hero_slide_subtitle", locale)}
                  value={slide.subtitle[loc] ?? ""}
                  onChange={(e) => updateSlideLocale(idx, "subtitle", loc, e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="CTA"
                  value={slide.ctaLabel[loc] ?? ""}
                  onChange={(e) => updateSlideLocale(idx, "ctaLabel", loc, e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            ))}
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-slate-500">CTA URL</label>
            <input
              type="text"
              value={slide.ctaUrl}
              onChange={(e) => updateSlide(idx, { ctaUrl: e.target.value })}
              placeholder="/search"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
      ))}

      {/* Add slide */}
      {cfg.slides.length < MAX_SLIDES && (
        <button
          onClick={addSlide}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-white px-6 py-4 text-sm text-slate-500 transition-colors hover:border-blue-300 hover:bg-blue-50"
        >
          <Plus className="h-4 w-4" />
          {t("constructor.hero_add_slide", locale)} ({cfg.slides.length}/{MAX_SLIDES})
        </button>
      )}

      {/* Save */}
      <button onClick={handleSave} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
        {t("constructor.hero_save", locale)}
      </button>
    </div>
  );
}
