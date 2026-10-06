/**
 * §4.8 Request Modal re-check — AnexProvider flexible state resolution.
 *
 * resolveStateFlexible: country/ISO match first, then a probe of the per-state
 * Towns dictionaries (price calendars carry resort/city labels like
 * «Султанахмет-Фатих» as destination). resolveHotelStateFlexible: same probe
 * against the HOTELS dictionaries (hotelStates/hotelTowns) — disjoint id
 * spaces, so the hotel adapter must never probe the tour dictionaries.
 */
import { AnexProvider } from "./anex.provider";
import type { AnexState, AnexTown } from "./anex.provider";

const TURKEY: AnexState = { id: 85, name: "Turkey", nameAlt: "Турция", stateISO: "TR" };
const GEORGIA: AnexState = { id: 88, name: "Georgia", nameAlt: "Грузия", stateISO: "GE" };
const EGYPT: AnexState = { id: 90, name: "Egypt", nameAlt: "Египет", stateISO: "EG" };

type ProviderMock = {
  states: jest.Mock;
  towns: jest.Mock;
  hotelStates: jest.Mock;
  hotelTowns: jest.Mock;
};

function makeProvider(): ProviderMock {
  const mock: ProviderMock = {
    states: jest.fn().mockResolvedValue([TURKEY, GEORGIA]),
    towns: jest.fn().mockImplementation(async (stateInc: string): Promise<AnexTown[]> =>
      stateInc === "85"
        ? [{ id: 1, name: "Istanbul" }]
        : [],
    ),
    hotelStates: jest.fn().mockResolvedValue([EGYPT, TURKEY]),
    hotelTowns: jest.fn().mockImplementation(async (stateInc: string): Promise<AnexTown[]> =>
      stateInc === "90"
        ? [{ id: 2, name: "Sharm El Sheikh" }]
        : [],
    ),
  };
  const provider = Object.create(AnexProvider.prototype) as AnexProvider;
  Object.assign(provider, mock);
  return mock;
}

function attached(): AnexProvider {
  const mock = makeProvider();
  return Object.assign(Object.create(AnexProvider.prototype) as AnexProvider, mock);
}

describe("AnexProvider.resolveStateFlexible (tour dictionaries)", () => {
  it("resolves a country name via the strict path", async () => {
    const p = attached();
    await expect(p.resolveStateFlexible("Turkey")).resolves.toMatchObject({ id: 85 });
  });

  it("resolves a resort/city label via the town probe", async () => {
    const p = attached();
    await expect(p.resolveStateFlexible("Istanbul")).resolves.toMatchObject({ id: 85 });
  });

  it("throws the descriptive UNSUPPORTED error for an unknown label", async () => {
    const p = attached();
    await expect(p.resolveStateFlexible("Nowhere")).rejects.toThrow(/UNSUPPORTED destination/);
  });

  it("throws the required-field error when the candidate is empty", async () => {
    const p = attached();
    await expect(p.resolveStateFlexible(undefined)).rejects.toThrow(
      /country\/destination is required/,
    );
    await expect(p.resolveStateFlexible("   ")).rejects.toThrow(
      /country\/destination is required/,
    );
  });
});

describe("AnexProvider.resolveHotelStateFlexible (hotel dictionaries)", () => {
  it("resolves a hotel-country name via the strict path", async () => {
    const p = attached();
    await expect(p.resolveHotelStateFlexible("Egypt")).resolves.toMatchObject({ id: 90 });
  });

  it("probes hotelTowns (never the tour towns) for a resort label", async () => {
    const p = attached();
    await expect(p.resolveHotelStateFlexible("Sharm El Sheikh")).resolves.toMatchObject({
      id: 90,
    });
  });

  it("throws the descriptive UNSUPPORTED error for an unknown label", async () => {
    const p = attached();
    await expect(p.resolveHotelStateFlexible("Nowhere")).rejects.toThrow(
      /UNSUPPORTED destination/,
    );
  });

  it("throws the required-field error when the candidate is empty", async () => {
    const p = attached();
    await expect(p.resolveHotelStateFlexible("")).rejects.toThrow(
      /country\/destination is required/,
    );
  });
});
