// @vitest-environment node
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Авто-cleanup DOM между компонентными тестами (без globals:true).
afterEach(() => {
  cleanup();
});
