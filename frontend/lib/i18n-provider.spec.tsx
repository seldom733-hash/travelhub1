// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { LocaleProvider, useLocale, useSetLocale } from "./i18n";

function Probe() {
  const locale = useLocale();
  const setLocale = useSetLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <button onClick={() => setLocale("en")}>to-en</button>
      <button onClick={() => setLocale("az")}>to-az</button>
    </div>
  );
}

describe("LocaleProvider (Step 1.7 §17 — persistence + html lang)", () => {
  it("default locale = ru; switch сохраняется в localStorage и синхронизирует <html lang>", () => {
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );

    // До mount — ru (hydration-safe).
    expect(screen.getByTestId("locale").textContent).toBe("ru");

    act(() => {
      screen.getByText("to-en").click();
    });
    expect(screen.getByTestId("locale").textContent).toBe("en");
    expect(window.localStorage.getItem("travelhub.locale")).toBe("en");
    expect(document.documentElement.lang).toBe("en");

    act(() => {
      screen.getByText("to-az").click();
    });
    expect(window.localStorage.getItem("travelhub.locale")).toBe("az");
    expect(document.documentElement.lang).toBe("az");
  });

  it("читает сохранённый locale из localStorage при mount", () => {
    window.localStorage.setItem("travelhub.locale", "en");
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("locale").textContent).toBe("en");
  });
});
