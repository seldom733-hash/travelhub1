// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PermissionLabel from "./PermissionLabel";

describe("PermissionLabel", () => {
  it("renders the human name and never the technical code", () => {
    render(<PermissionLabel code="account.booking.read_own" />);
    expect(screen.getByText("Просмотр собственных бронирований")).toBeTruthy();
    expect(screen.queryByText("account.booking.read_own")).toBeNull();
  });

  it("renders a safe fallback for an unknown permission", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(<PermissionLabel code="custom.unknown.permission" />);
    expect(screen.getByText("Custom unknown permission")).toBeTruthy();
    expect(screen.queryByText("custom.unknown.permission")).toBeNull();
    warn.mockRestore();
  });
});
