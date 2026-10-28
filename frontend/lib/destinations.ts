import type { PublicDestination } from "./public-api";

/** ISO 3166-1 alpha-2 → flag image (works even when the OS has no color emoji font). */
export function countryFlagUrl(code: string): string {
  const normalized = code.trim().toLowerCase();
  return /^[a-z]{2}$/.test(normalized) ? `https://flagcdn.com/w160/${normalized}.png` : "";
}

/** ISO 3166-1 alpha-2 → emoji flag (fallback / text contexts). */
export function countryFlag(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return "🌍";
  return String.fromCodePoint(...[...normalized].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
}

export function countryName(names: Record<string, string> | null | undefined, locale: string): string {
  if (!names) return "";
  return names[locale] || names.ru || names.en || names.az || "";
}

export function destinationLabel(destination: PublicDestination, locale: string): string {
  return countryName(destination.names, locale) || destination.code;
}
