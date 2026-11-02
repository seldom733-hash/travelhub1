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

vi.mock("@/lib/use-user", () => ({
  useCurrentUserStatus: () => ({ user: null, ready: true }),
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

function fillCustomer() {
  fireEvent.change(screen.getByLabelText("Имя *"), { target: { value: "Aysel" } });
  fireEvent.change(screen.getByLabelText("Фамилия *"), { target: { value: "Mammadova" } });
  fireEvent.change(screen.getByLabelText("Телефон *"), { target: { value: "+994501234567" } });
  fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "aysel@example.com" } });
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
  it("shows the traveler form and the «Подать заявку» action", () => {
    renderModal();

    expect(screen.getByText(/перепроверим цену у поставщика/)).toBeTruthy();
    expect(screen.getByText("Данные путешественника")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Подать заявку" })).toBeTruthy();
  });

  it("«Подать заявку» → re-check + create carry customer + country/program/departureCity context", async () => {
    renderModal("Baku");
    fillCustomer();

    fireEvent.click(screen.getByRole("button", { name: "Подать заявку" }));

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
        source: "UNIVERSAL_SEARCH",
        searchId: "SRCH-1",
        customer: {
          firstName: "Aysel",
          lastName: "Mammadova",
          phone: "+994501234567",
          email: "aysel@example.com",
        },
      }),
    );
  });

  it("blocks submission until required customer fields are valid", () => {
    renderModal();
    expect((screen.getByRole("button", { name: "Подать заявку" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
