import { t, type Locale } from "./i18n";

/**
 * Shared localized label helpers for Order/Booking lifecycle audit actions.
 *
 * Single source of truth for Order detail + Order registry quick-preview and
 * Booking detail audit rows. Falls back to the raw action slug when no
 * mapping exists (no visible enum leakage where labels DO exist).
 */

/** Localized human-readable label for an Order lifecycle audit action. */
export function orderActionLabel(a: string, locale: Locale): string {
  const key = `order.action.${a}`;
  const localized = t(key, locale);
  return localized !== key ? localized : a;
}

/** Localized human-readable label for a Booking lifecycle audit action. */
export function bookingActionLabel(a: string, locale: Locale): string {
  const key = `booking.action.${a}`;
  const localized = t(key, locale);
  return localized !== key ? localized : a;
}

/** Localized short action-bar button label for a Booking action. */
export function bookingActionShort(a: string, locale: Locale): string {
  const key = `booking.action_short.${a}`;
  const localized = t(key, locale);
  return localized !== key ? localized : a;
}