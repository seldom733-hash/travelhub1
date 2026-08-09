/**
 * PHASE 1 STEP 1.12.2 §5 — безопасный theme preset whitelist (без arbitrary
 * CSS/JS/HTML). Backend валидирует themePreset (StorefrontService.assertTheme);
 * клиент маппит preset → классы Tailwind (только известные значения, fallback default).
 */
export type StorefrontTheme = "default" | "forest" | "ocean" | "sunset" | "mono";

export const STOREFRONT_THEMES: StorefrontTheme[] = ["default", "forest", "ocean", "sunset", "mono"];

export interface StorefrontThemeStyle {
  /** Акцент (кнопки/ссылки). */
  accent: string;
  accentHover: string;
  /** Тёмный фон hero/header. */
  headerBg: string;
  headerText: string;
  heroBg: string;
  chip: string;
}

const THEME_STYLES: Record<StorefrontTheme, StorefrontThemeStyle> = {
  default: {
    accent: "bg-blue-600 text-white hover:bg-blue-700",
    accentHover: "hover:text-blue-600",
    headerBg: "bg-white/90 backdrop-blur border-b border-slate-200",
    headerText: "text-slate-900",
    heroBg: "from-blue-700 via-blue-600 to-indigo-700",
    chip: "bg-blue-50 text-blue-700",
  },
  forest: {
    accent: "bg-emerald-600 text-white hover:bg-emerald-700",
    accentHover: "hover:text-emerald-600",
    headerBg: "bg-white/90 backdrop-blur border-b border-slate-200",
    headerText: "text-slate-900",
    heroBg: "from-emerald-800 via-emerald-700 to-teal-700",
    chip: "bg-emerald-50 text-emerald-700",
  },
  ocean: {
    accent: "bg-cyan-600 text-white hover:bg-cyan-700",
    accentHover: "hover:text-cyan-600",
    headerBg: "bg-white/90 backdrop-blur border-b border-slate-200",
    headerText: "text-slate-900",
    heroBg: "from-cyan-800 via-sky-700 to-blue-800",
    chip: "bg-cyan-50 text-cyan-700",
  },
  sunset: {
    accent: "bg-orange-600 text-white hover:bg-orange-700",
    accentHover: "hover:text-orange-600",
    headerBg: "bg-white/90 backdrop-blur border-b border-slate-200",
    headerText: "text-slate-900",
    heroBg: "from-orange-700 via-amber-600 to-rose-600",
    chip: "bg-orange-50 text-orange-700",
  },
  mono: {
    accent: "bg-slate-800 text-white hover:bg-slate-900",
    accentHover: "hover:text-slate-800",
    headerBg: "bg-white/90 backdrop-blur border-b border-slate-200",
    headerText: "text-slate-900",
    heroBg: "from-slate-800 via-slate-700 to-slate-600",
    chip: "bg-slate-100 text-slate-700",
  },
};

export function themeStyle(theme: string | null | undefined): StorefrontThemeStyle {
  if (theme && (STOREFRONT_THEMES as string[]).includes(theme)) {
    return THEME_STYLES[theme as StorefrontTheme];
  }
  return THEME_STYLES.default;
}

export const SOCIAL_PLATFORM_ICONS: Record<string, string> = {
  instagram: "📷",
  facebook: "👍",
  telegram: "✈️",
  tiktok: "🎵",
  youtube: "▶️",
  linkedin: "💼",
  x: "𝕏",
  vk: "🅥",
};
