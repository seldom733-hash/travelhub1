// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DynamicSchemaForm, { validateField } from "./DynamicSchemaForm";
import type { PartnerSchemaAttribute } from "@/lib/partner-api";

const ALL_TYPES: PartnerSchemaAttribute[] = [
  { key: "s", type: "string", label: "Строка" },
  { key: "t", type: "text", label: "Текст" },
  { key: "n", type: "number", label: "Число", min: 1, max: 10 },
  { key: "i", type: "integer", label: "Целое" },
  { key: "b", type: "boolean", label: "Булево", required: true },
  { key: "d", type: "date", label: "Дата" },
  { key: "tm", type: "time", label: "Время" },
  { key: "e", type: "enum", label: "Выбор", options: ["ru", "en"] },
  { key: "c", type: "currency", label: "Валюта" },
];

describe("DynamicSchemaForm (Step 1.8 §8)", () => {
  it("рендерит все типы attribute из ACTIVE Category Schema", () => {
    render(<DynamicSchemaForm attributes={ALL_TYPES} value={{}} onChange={() => undefined} />);
    expect(screen.getByLabelText("Строка")).toBeTruthy();
    expect(screen.getByLabelText("Текст").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Число").getAttribute("type")).toBe("number");
    expect(screen.getByLabelText("Целое").getAttribute("type")).toBe("number");
    expect(screen.getByLabelText("Булево").getAttribute("type")).toBe("checkbox");
    expect(screen.getByLabelText("Дата").getAttribute("type")).toBe("date");
    expect(screen.getByLabelText("Время").getAttribute("type")).toBe("time");
    expect(screen.getByLabelText("Выбор").tagName).toBe("SELECT");
    expect(screen.getByLabelText("Валюта").getAttribute("type")).toBe("text");
  });

  it("enum: рендерит options из схемы", () => {
    render(<DynamicSchemaForm attributes={ALL_TYPES} value={{}} onChange={() => undefined} />);
    const select = screen.getByLabelText("Выбор") as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain("ru");
    expect(options).toContain("en");
  });

  it("required: отсутствие значения → локализованная ошибка + aria-invalid + aria-describedby", () => {
    render(<DynamicSchemaForm attributes={[{ key: "name", type: "string", label: "Имя", required: true }]} value={{}} onChange={() => undefined} />);
    expect(screen.getByText("Заполните это поле")).toBeTruthy();
    // Label text содержит маркер обязательности «*» (testing-library label-query по textContent).
    const input = screen.getByLabelText("Имя", { exact: false });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("attr-name-error");
  });

  it("min/max: выход за границы → ошибка с границей", () => {
    render(<DynamicSchemaForm attributes={ALL_TYPES} value={{ n: 99 }} onChange={() => undefined} />);
    expect(screen.getByText("Максимум 10")).toBeTruthy();
  });

  it("boolean: чекбокс переключает значение (required boolean не отмечен → ошибка)", () => {
    const onChange = vi.fn();
    render(<DynamicSchemaForm attributes={ALL_TYPES} value={{}} onChange={onChange} />);
    const cb = screen.getByLabelText("Булево") as HTMLInputElement;
    fireEvent.click(cb);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ b: true }));
    // Required boolean не отмечен — ошибка.
    expect(screen.getByText("Заполните это поле")).toBeTruthy();
  });

  it("number: ввод передаёт Number, пустое → undefined", () => {
    const onChange = vi.fn();
    render(<DynamicSchemaForm attributes={[{ key: "n", type: "number", label: "Число" }]} value={{}} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Число"), { target: { value: "42" } });
    expect(onChange).toHaveBeenCalledWith({ n: 42 });
  });

  it("validateField: чистая валидация (required/enum/min/integer/pattern)", () => {
    expect(validateField({ key: "a", type: "string", required: true }, undefined)?.code).toBe("required");
    expect(validateField({ key: "a", type: "string" }, "")).toBeNull();
    expect(validateField({ key: "a", type: "enum", options: ["x"] }, "y")?.code).toBe("enum");
    expect(validateField({ key: "a", type: "integer" }, 2.5)?.code).toBe("integer");
    expect(validateField({ key: "a", type: "number", max: 5 }, 6)?.code).toBe("max");
    expect(validateField({ key: "a", type: "string", pattern: "^[A-Z]{3}$" }, "gy")?.code).toBe("pattern");
    expect(validateField({ key: "a", type: "time" }, "25:00")?.code).toBe("time");
  });
});
