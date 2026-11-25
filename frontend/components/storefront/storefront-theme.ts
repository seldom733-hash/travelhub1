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
    accent: "bg-brand text-white hover:bg-brand-dark",
    accentHover: "hover:text-brand",
    headerBg: "bg-white/90 backdrop-blur border-b border-line",
    headerText: "text-ink",
    heroBg: "from-brand-dark via-brand to-brand-dark",
    chip: "bg-brand/10 text-brand-dark",
  },
  forest: {
    accent: "bg-emerald-600 text-white hover:bg-emerald-700",
    accentHover: "hover:text-emerald-600",
    headerBg: "bg-white/90 backdrop-blur border-b border-line",
    headerText: "text-ink",
    heroBg: "from-emerald-800 via-emerald-700 to-teal-700",
    chip: "bg-emerald-50 text-emerald-700",
  },
  ocean: {
    accent: "bg-brand text-white hover:bg-brand-dark",
    accentHover: "hover:text-brand",
    headerBg: "bg-white/90 backdrop-blur border-b border-line",
    headerText: "text-ink",
    heroBg: "from-panel via-sky-700 to-ink",
    chip: "bg-brand/10 text-brand-dark",
  },
  sunset: {
    accent: "bg-orange-600 text-white hover:bg-orange-700",
    accentHover: "hover:text-orange-600",
    headerBg: "bg-white/90 backdrop-blur border-b border-line",
    headerText: "text-ink",
    heroBg: "from-orange-700 via-amber-600 to-rose-600",
    chip: "bg-orange-50 text-orange-700",
  },
  mono: {
    accent: "bg-ink text-white hover:bg-ink",
    accentHover: "hover:text-ink",
    headerBg: "bg-white/90 backdrop-blur border-b border-line",
    headerText: "text-ink",
    heroBg: "from-panel via-slate-700 to-ink",
    chip: "bg-panel text-ink",
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
