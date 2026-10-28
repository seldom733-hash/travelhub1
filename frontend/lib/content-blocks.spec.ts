import { describe, expect, it } from "vitest";
import { contentBlockNeedsAttention, parseFaqItems, parseGalleryImages } from "./content-blocks";

describe("shared content block parsing", () => {
  it("parses FAQ with pipe, dash and colon separators", () => {
    expect(parseFaqItems("Как купить? | Оставьте заявку\nКак оплатить? — Картой\nЕсть скидки? : Да")).toEqual([
      { question: "Как купить?", answer: "Оставьте заявку" },
      { question: "Как оплатить?", answer: "Картой" },
      { question: "Есть скидки?", answer: "Да" },
    ]);
  });

  it("does not treat an arbitrary line without an answer as an FAQ item", () => {
    expect(parseFaqItems("ичисми")).toEqual([]);
    expect(contentBlockNeedsAttention("content-faq", { itemsText: "ичисми" })).toBe(true);
  });

  it("filters gallery lines to safe image URLs", () => {
    expect(parseGalleryImages("https://example.com/a.jpg\njavascript:alert(1)\n/images/b.jpg")).toEqual([
      "https://example.com/a.jpg",
      "/images/b.jpg",
    ]);
    expect(contentBlockNeedsAttention("content-gallery", { imagesText: "not-a-url" })).toBe(true);
  });

  it("requires about body before the public block can render", () => {
    expect(contentBlockNeedsAttention("content-about", { body: "  " })).toBe(true);
    expect(contentBlockNeedsAttention("content-about", { body: "О компании" })).toBe(false);
  });
});
