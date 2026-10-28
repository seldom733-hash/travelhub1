export interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_SEPARATORS = ["|", " — ", " – ", " - ", ":"];

/**
 * One FAQ item per line. Supports "вопрос | ответ", em/en dash and colon so
 * partners do not lose content because of a formatting detail.
 */
export function parseFaqItems(value: unknown): FaqItem[] {
  if (typeof value !== "string") return [];
  const items: FaqItem[] = [];
  for (const raw of value.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    let index = -1;
    let length = 0;
    for (const sep of FAQ_SEPARATORS) {
      const i = line.indexOf(sep);
      if (i > 0 && (index < 0 || i < index)) {
        index = i;
        length = sep.length;
      }
    }
    if (index <= 0) continue;
    const question = line.slice(0, index).trim();
    const answer = line.slice(index + length).trim();
    if (question && answer) items.push({ question, answer });
  }
  return items;
}

export function hasFaqItems(value: unknown): boolean {
  return parseFaqItems(value).length > 0;
}

export function parseGalleryImages(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((src) => /^(https?:\/\/|\/|media:)/i.test(src));
}

export function hasGalleryImages(value: unknown): boolean {
  return parseGalleryImages(value).length > 0;
}

/** True when a common content block would be invisible on the published page. */
export function contentBlockNeedsAttention(blockType: string, settings: Record<string, unknown>): boolean {
  if (blockType === "content-faq") return !hasFaqItems(settings.itemsText);
  if (blockType === "content-gallery") return !hasGalleryImages(settings.imagesText);
  if (blockType === "content-about") return !String(settings.body ?? "").trim();
  return false;
}
