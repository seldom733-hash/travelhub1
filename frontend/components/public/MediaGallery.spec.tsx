// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import MediaGallery from "./MediaGallery";
import type { PublicMedia } from "@/lib/public-api";

function media(id: string, sortOrder: number, isPrimary = false): PublicMedia {
  return {
    id,
    type: "IMAGE",
    mimeType: "image/webp",
    width: 1200,
    height: 800,
    sortOrder,
    isPrimary,
    caption: null,
    altText: null,
    url: { thumb: `/api/v1/public/media/${id}/thumb`, large: `/api/v1/public/media/${id}/large` },
  };
}

describe("MediaGallery (Step 1.7 §13)", () => {
  it("без media — нейтральный fallback, без кнопок навигации", () => {
    render(<MediaGallery media={[]} />);
    expect(screen.getByText("🏝")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("одна media — main image со stable large URL", () => {
    render(<MediaGallery media={[media("m1", 1)]} />);
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("/api/v1/public/media/m1/large");
  });

  it("несколько media: primary-первой, кнопки prev/next переключают", () => {
    const { container } = render(<MediaGallery media={[media("m2", 2), media("m1", 1, true)]} />);
    // main img (role=img с alt) + 2 thumbnail img (alt="" → presentationally hidden).
    const allImgs = Array.from(container.querySelectorAll("img"));
    expect(allImgs.length).toBe(3);
    expect((allImgs[0] as HTMLImageElement).src).toContain("/m1/large");

    const next = screen.getByRole("button", { name: /следующее/i });
    fireEvent.click(next);
    expect((container.querySelectorAll("img")[0] as HTMLImageElement).src).toContain("/m2/large");
  });

  it("thumbnails-кнопки имеют атрибут aria-current", () => {
    render(<MediaGallery media={[media("m1", 1), media("m2", 2)]} />);
    const thumbs = screen.getAllByRole("button").filter((b) => b.querySelector("img"));
    expect(thumbs.length).toBe(2);
    expect(thumbs[0].getAttribute("aria-current")).toBe("true");
    expect(thumbs[1].getAttribute("aria-current")).toBe("false");
  });
});
