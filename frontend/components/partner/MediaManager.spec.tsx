// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MediaManager from "./MediaManager";
import { partnerApi, type PartnerMediaItem } from "@/lib/partner-api";

vi.mock("@/lib/partner-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/partner-api")>();
  return { ...actual, partnerApi: { ...actual.partnerApi, listMedia: vi.fn(), schemaRequirementsForProduct: vi.fn(), previewUrl: vi.fn() } };
});

const PUBLISHED: PartnerMediaItem = {
  id: "m1",
  type: "IMAGE",
  mimeType: "image/jpeg",
  size: 100,
  width: 200,
  height: 120,
  sortOrder: 0,
  isPrimary: true,
  caption: null,
  altText: "photo",
  status: "PUBLISHED",
  originalFileName: "a.jpg",
  createdAt: "2026-01-01T00:00:00Z",
};

const DRAFT: PartnerMediaItem = { ...PUBLISHED, id: "m2", isPrimary: false, status: "DRAFT", originalFileName: "b.jpg" };

describe("MediaManager (Step 1.8 §11)", () => {
  it("показывает grid media, primary и status badges", async () => {
    vi.mocked(partnerApi.listMedia).mockResolvedValue([PUBLISHED, DRAFT]);
    vi.mocked(partnerApi.schemaRequirementsForProduct).mockResolvedValue(null);
    vi.mocked(partnerApi.previewUrl).mockResolvedValue({ url: "https://signed/thumb", expiresIn: 300, mediaId: "m2" });

    render(<MediaManager productId="p1" />);

    await waitFor(() => expect(screen.getByText("Главное фото")).toBeTruthy());
    expect(screen.getByText("Опубликовано")).toBeTruthy();
    expect(screen.getByText("Черновик")).toBeTruthy();
    // PUBLISHED media → live-locked note (правки — только через модерацию).
    expect(screen.getByText(/Опубликованные медиа нельзя менять напрямую/)).toBeTruthy();
  });

  it("показывает requirement counters из Partner-safe schema контракта", async () => {
    vi.mocked(partnerApi.listMedia).mockResolvedValue([DRAFT]);
    vi.mocked(partnerApi.schemaRequirementsForProduct).mockResolvedValue({ minImages: 3, primaryImageRequired: true });
    vi.mocked(partnerApi.previewUrl).mockResolvedValue({ url: "https://signed/thumb", expiresIn: 300, mediaId: "m2" });

    render(<MediaManager productId="p1" />);

    await waitFor(() => expect(screen.getByText("Минимум фото: 1/3")).toBeTruthy());
    expect(screen.getByText("Главное фото обязательно")).toBeTruthy();
  });

  it("пустой список → empty state", async () => {
    vi.mocked(partnerApi.listMedia).mockResolvedValue([]);
    vi.mocked(partnerApi.schemaRequirementsForProduct).mockResolvedValue(null);

    render(<MediaManager productId="p1" />);
    await waitFor(() => expect(screen.getByText("Фотографий пока нет.")).toBeTruthy());
  });
});
