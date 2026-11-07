import { computeAvailableOrderActions } from "./order.service";

const base = {
  status: "SENT_TO_BOOKING" as const,
  travelerCount: 1,
  termsAcceptedAt: new Date(),
  finalConfirmedAt: new Date(),
  returnedToRequestAt: null,
  travelers: [{ dataCompleteness: "COMPLETE" }],
};
const granted = ["order.edit_noncritical", "order.request_booking", "order.cancel", "order.suspend", "order.close"];

describe("order action projection — active booking gate", () => {
  it("hides complete/close/cancel/return while a booking is active", () => {
    const actions = computeAvailableOrderActions(base, granted, 1);
    expect(actions).not.toContain("complete");
    expect(actions).not.toContain("close");
    expect(actions).not.toContain("cancel");
    expect(actions).not.toContain("returnToRequest");
    expect(actions).toContain("requestCancellation");
  });

  it("offers complete only after all bookings are terminal", () => {
    const actions = computeAvailableOrderActions(base, granted, 0);
    expect(actions).toContain("complete");
  });
});
