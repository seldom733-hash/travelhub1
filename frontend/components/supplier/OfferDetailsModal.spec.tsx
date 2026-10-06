// @vitest-environment jsdom
/**
 * Phase 4 — service-card offer window (OfferDetailsModal):
 *  - explicit hint on HOW to submit a request from this window;
 *  - «Оформить заказ» carries the full contract (country/departureCity/program
 *    context) to BOTH the re-check and createTourRequest — parity with the
 *    OfferModal path (KAZUNION/ANEX/KOMPAS state resolution).
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import OfferDetailsModal from "./OfferDetailsModal";
import type { AggregatedOffer } from "@/lib/supplier-api";
import {
  createTourRequest,
  refreshSupplierPrice,
  refreshSupplierAvailability,
} from "@/lib/supplier-api";

vi.mock("@/lib/supplier-api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/supplier-api")>();
  return {
    ...mod,
    createTourRequest: vi.fn(),
    refreshSupplierPrice: vi.fn(),
    refreshSupplierAvailability: vi.fn(),
  };
});

vi.mock("@/lib/supplier-registry", () => ({
  useSupplierLabels: vi.fn(() => ({ KOMPAS: "Kompas" })),
}));

const createTourRequestMock = createTourRequest as Mock;
const refreshSupplierPriceMock = refreshSupplierPrice as Mock;
const refreshSupplierAvailabilityMock = refreshSupplierAvailability as Mock;

const NOW = new Date().toISOString();
const LATER = new Date(Date.now() + 600_000).toISOString();

const OFFER: AggregatedOffer = {
  supplierCode: "KOMPAS",
  service: "tours",
  externalOfferId: "35000",
  hotel: "Rixos Dubai",
  hotelExternalId: "2807",
  country: "Turkey",
  destination: "Antalya",
  departureDate: "2026-09-19",
  nights: 7,
  room: "DBL",
  meal: "AI",
  adults: 2,
  children: 0,
  childAges: [],
  price: { amount: 1050, currency: "USD", fetchedAt: NOW, expiresAt: LATER, source: "KOMPAS" },
  availability: "AVAILABLE",
  tourIncValue: "15614",
  tourIncName: "TR: Antalya 2026",
  fetchedAt: NOW,
  expiresAt: LATER,
};

function renderModal(departureCity?: string) {
  return render(
    <OfferDetailsModal offer={OFFER} searchId="SRCH-1" departureCity={departureCity} onClose={vi.fn()} />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  refreshSupplierPriceMock.mockResolvedValue({
    amount: 1050,
    currency: "USD",
    fetchedAt: NOW,
    expiresAt: LATER,
    source: "KOMPAS",
  });
  refreshSupplierAvailabilityMock.mockResolvedValue({ availability: "AVAILABLE" });
  createTourRequestMock.mockResolvedValue({ id: "r1", code: "REQ-1", referenceNumber: "R-1", status: "NEW" });
});

describe("OfferDetailsModal — request hint + contract fields (Phase 4)", () => {
  it("shows an explicit hint on how to submit a request from this window", () => {
    renderModal();

    expect(screen.getByText(/перепроверим цену у поставщика/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Оформить заказ" })).toBeTruthy();
  });

  it("«Оформить заказ» → re-check + create carry country/program/departureCity context", async () => {
    renderModal("Baku");

    fireEvent.click(screen.getByRole("button", { name: "Оформить заказ" }));

    await waitFor(() => expect(refreshSupplierPriceMock).toHaveBeenCalled());
    expect(refreshSupplierPriceMock).toHaveBeenCalledWith(
      "KOMPAS",
      "35000",
      undefined,
      expect.objectContaining({
        country: "Turkey",
        destination: "Antalya",
        departureCity: "Baku",
        tourIncValue: "15614",
        tourIncName: "TR: Antalya 2026",
      }),
    );

    await waitFor(() => expect(createTourRequestMock).toHaveBeenCalled());
    expect(createTourRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierCode: "KOMPAS",
        externalOfferId: "35000",
        hotel: "Rixos Dubai",
        destination: "Antalya",
        country: "Turkey",
        departureCity: "Baku",
        tourIncValue: "15614",
        tourIncName: "TR: Antalya 2026",
        price: 1050,
      }),
    );
  });
});
