// @vitest-environment jsdom
/**
 * §4.9.4 Request Modal — component contract of the rich OfferModal (§4.8):
 * tour/date header, registered autofill (4.8.6), guest empty state (4.8.7),
 * phone/email validation (4.8.8/4.8.9), per-offer submit (4.8.4/4.8.12),
 * no verify-price step (4.8.10), captcha retained, duplicate standalone
 * form removed from the tour branch (4.8.2).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import OfferModal from "./OfferModal";
import type { SupplierPriceCalendarEntryOffer } from "@/lib/supplier-api";
import { createTourRequest } from "@/lib/supplier-api";
import { useCurrentUser } from "@/lib/use-user";

vi.mock("@/lib/supplier-api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/supplier-api")>();
  return { ...mod, createTourRequest: vi.fn() };
});
vi.mock("@/lib/use-user", () => ({ useCurrentUser: vi.fn(() => null) }));

const createTourRequestMock = createTourRequest as ReturnType<typeof vi.fn>;
const useCurrentUserMock = useCurrentUser as ReturnType<typeof vi.fn>;

function makeOffer(
  overrides: Partial<SupplierPriceCalendarEntryOffer> = {},
): SupplierPriceCalendarEntryOffer {
  return {
    tourIncValue: "t1",
    tourIncName: "TR: Rixos Dubai 2026",
    externalOfferId: "offer-1",
    hotel: "Rixos Dubai\n(Бараш)",
    hotelExternalId: "2807",
    departureDate: "2026-09-19",
    nights: 7,
    room: "DBL",
    meal: "AI",
    adults: 2,
    children: 0,
    childAges: [],
    availability: "AVAILABLE",
    price: 1050,
    currency: "USD",
    ...overrides,
  };
}

const OFFERS: SupplierPriceCalendarEntryOffer[] = [
  makeOffer({ externalOfferId: "offer-1" }),
  makeOffer({ externalOfferId: "offer-2", room: "SUITE", price: 1300 }),
];

function baseProps() {
  return {
    date: "2026-09-19",
    tour: "Rixos Dubai",
    offers: OFFERS,
    supplierCode: "KOMPAS",
    summary: {
      departureCity: "Baku",
      destination: "Turkey",
      country: "Turkey",
      adults: 2,
      children: 0,
      childAges: [] as number[],
      nights: 7,
    },
    onClose: vi.fn(),
  };
}

const CREATED_RESULT = {
  id: "r1",
  code: "REQ-1",
  referenceNumber: "R-1",
  status: "NEW",
  displayedPrice: 1050,
  displayedCurrency: "USD",
  createdAt: "2026-10-06T10:00:00.000Z",
};

function setInput(id: string, value: string) {
  const input = document.getElementById(id) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
}

function submitButtons(): HTMLButtonElement[] {
  return screen.getAllByRole("button", { name: "Подать заявку" }) as HTMLButtonElement[];
}

beforeEach(() => {
  vi.clearAllMocks();
  useCurrentUserMock.mockReturnValue(null);
  createTourRequestMock.mockResolvedValue(CREATED_RESULT);
});

describe("OfferModal header (4.8.1) — correct tour/date", () => {
  it("renders title, tour and date/nights/travelers summary", () => {
    render(<OfferModal {...baseProps()} />);

    expect(screen.getByRole("heading", { name: "Подать заявку" })).toBeTruthy();
    // Header (tour + date) specifically — not the offer-row cells.
    const header = screen.getByRole("heading", { name: "Подать заявку" })
      .parentElement as HTMLElement;
    expect(header.textContent).toContain("Rixos Dubai");
    expect(header.textContent).toContain("2026-09-19");
    expect(header.textContent).toMatch(/7\s+ночей/);
    expect(header.textContent).toMatch(/2\s+взр\./);
  });
});

describe("OfferModal customer block (4.8.6/4.8.7)", () => {
  it("registered user: autofills name/phone/email and shows the account hint", () => {
    useCurrentUserMock.mockReturnValue({
      id: "u1",
      code: "USR-1",
      username: "ali",
      phone: "+994501112233",
      email: "ali@example.com",
      fullName: "Ali Veliev",
      role: "TRAVELER",
      roleTitle: "Traveler",
      partnerId: null,
      customerId: "c1",
      permissions: [],
    });

    render(<OfferModal {...baseProps()} />);

    expect((document.getElementById("offer-first-name") as HTMLInputElement).value).toBe("Ali");
    expect((document.getElementById("offer-last-name") as HTMLInputElement).value).toBe("Veliev");
    expect((document.getElementById("offer-phone") as HTMLInputElement).value).toBe(
      "+994501112233",
    );
    expect((document.getElementById("offer-email") as HTMLInputElement).value).toBe(
      "ali@example.com",
    );
    expect(screen.getByText(/Используем данные вашего аккаунта/)).toBeTruthy();
  });

  it("guest: empty state, no account hint", () => {
    render(<OfferModal {...baseProps()} />);

    expect((document.getElementById("offer-first-name") as HTMLInputElement).value).toBe("");
    expect((document.getElementById("offer-last-name") as HTMLInputElement).value).toBe("");
    expect((document.getElementById("offer-phone") as HTMLInputElement).value).toBe("");
    expect((document.getElementById("offer-email") as HTMLInputElement).value).toBe("");
    expect(screen.queryByText(/Используем данные вашего аккаунта/)).toBeNull();
  });
});

describe("OfferModal validation (4.8.7/4.8.8/4.8.9)", () => {
  it("invalid phone → error message, buttons stay disabled", () => {
    render(<OfferModal {...baseProps()} />);
    setInput("offer-phone", "abc");

    expect(screen.getByRole("alert").textContent).toContain(
      "Номер телефона указан неверно.",
    );
    const buttons = submitButtons();
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect(b.disabled).toBe(true);
  });

  it("invalid email → error message, buttons stay disabled", () => {
    render(<OfferModal {...baseProps()} />);
    setInput("offer-phone", "+994501112233");
    setInput("offer-email", "nope");

    expect(screen.getByRole("alert").textContent).toContain(
      "Пожалуйста, введите корректный адрес электронной почты.",
    );
    for (const b of submitButtons()) expect(b.disabled).toBe(true);
  });

  it("guest empty state: all offer buttons disabled", () => {
    render(<OfferModal {...baseProps()} />);

    const buttons = submitButtons();
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect(b.disabled).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("valid guest data (phone only, empty email allowed) enables every offer button", () => {
    render(<OfferModal {...baseProps()} />);
    setInput("offer-phone", "+994 50 111 22 33");

    const buttons = submitButtons();
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect(b.disabled).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("OfferModal per-offer submit (4.8.4/4.8.12)", () => {
  it("offer #1 → createTourRequest called with offer #1 (and customer block)", async () => {
    const onRequestCreated = vi.fn();
    render(<OfferModal {...baseProps()} onRequestCreated={onRequestCreated} />);
    setInput("offer-phone", "+994501112233");
    setInput("offer-first-name", "Ali");

    fireEvent.click(submitButtons()[0]);

    await waitFor(() =>
      expect(createTourRequestMock).toHaveBeenCalledTimes(1),
    );
    expect(createTourRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        externalOfferId: "offer-1",
        supplierCode: "KOMPAS",
        price: 1050,
        // 4.8 re-check contract: supplier/program hints travel with the payload;
        // destination is a city only — a country lands in `country`, never here
        destination: undefined,
        departureCity: "Baku",
        country: "Turkey",
        tourIncValue: "t1",
        tourIncName: "TR: Rixos Dubai 2026",
        customer: expect.objectContaining({
          phone: "+994501112233",
          firstName: "Ali",
        }),
      }),
    );
    await screen.findByText(/✓ Запрос создан — R-1/);
    expect(onRequestCreated).toHaveBeenCalledTimes(1);
  });

  it("offer #2 → createTourRequest called with offer #2 exact offer", async () => {
    render(<OfferModal {...baseProps()} />);
    setInput("offer-phone", "+994501112233");

    fireEvent.click(submitButtons()[1]);

    await waitFor(() =>
      expect(createTourRequestMock).toHaveBeenCalledTimes(1),
    );
    expect(createTourRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        externalOfferId: "offer-2",
        room: "SUITE",
        price: 1300,
        tourIncValue: "t1",
        country: "Turkey",
      }),
    );
    await screen.findByText(/✓ Запрос создан — R-1/);
  });

  it("server 422 on phone → field-specific error under the row (fallback mapping)", async () => {
    createTourRequestMock.mockRejectedValue(
      new Error('Supplier API 422: {"statusCode":422,"message":"Invalid phone number"}'),
    );
    render(<OfferModal {...baseProps()} />);
    setInput("offer-phone", "+994501112233");

    fireEvent.click(submitButtons()[0]);

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((a) => a.textContent).join(" ")).toContain(
      "Номер телефона указан неверно.",
    );
  });
});

describe("§4.8 source guards (4.8.2/4.8.10)", () => {
  it("duplicate standalone GuestCheckoutForm removed from the tour branch (only non-tour remains)", () => {
    const page = readFileSync(
      resolve(process.cwd(), "app/products/[slug]/page.tsx"),
      "utf8",
    );
    const occurrences = page.split("<GuestCheckoutForm").length - 1;
    expect(occurrences).toBe(1);
  });

  it("no pre-submission verify-price UI; captcha modal retained", () => {
    // §4.8.4 create flow: since the inline-panel refactor (2026-10-13) the
    // request creation + captcha handling live in the SHARED OfferRow (used by
    // both this modal and DayTariffsPanel). The guard covers BOTH files: the
    // modal must stay free of verify-price UI, and the row must keep captcha.
    const modal = readFileSync(
      resolve(process.cwd(), "components/supplier/OfferModal.tsx"),
      "utf8",
    );
    expect(modal).not.toContain("handleVerifyPrice");
    expect(modal).not.toContain("offer.verify_price");
    expect(modal).not.toContain("verificationState");

    const row = readFileSync(
      resolve(process.cwd(), "components/supplier/OfferRow.tsx"),
      "utf8",
    );
    expect(row).not.toContain("handleVerifyPrice");
    expect(row).not.toContain("offer.verify_price");
    expect(row).not.toContain("verificationState");
    expect(row).toContain("KompasCaptchaModal");
    expect(row).toContain("isCaptchaRequired(result)");
  });

  it("request creation passes the service category to the backend", () => {
    // §SERVICE-PASSTHROUGH: a hotel offer must be re-checked against the
    // hotels adapter — a stay-only offer has no departure city, so verifying
    // it as a tour always fails PRICE_UNAVAILABLE.
    const row = readFileSync(
      resolve(process.cwd(), "components/supplier/OfferRow.tsx"),
      "utf8",
    );
    expect(row).toContain("service: service || \"tours\"");
  });
});
