// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BuilderWorkspace from "./BuilderWorkspace";
import { LocaleProvider } from "@/lib/i18n";
import type { BlockDefinition, SectionView } from "@/lib/constructor-api";

const registry: BlockDefinition[] = [
  {
    type: "content-about",
    version: 1,
    category: "content",
    displayName: { ru: "О компании", az: "Şirkət haqqında", en: "About" },
    description: { ru: "Текст о компании", az: "Şirkət mətni", en: "About text" },
    allowedContexts: ["marketplace", "storefront"],
    allowedLayouts: ["full-width"],
    defaultSettings: { heading: "", body: "" },
    defaultLayout: "full-width",
    singleton: true,
    removable: true,
    dataSourceType: "static-config",
  },
  {
    type: "content-cta",
    version: 1,
    category: "content",
    displayName: { ru: "Призыв к действию", az: "Fəaliyyətə çağırış", en: "CTA" },
    description: { ru: "Кнопка", az: "Düymə", en: "Button" },
    allowedContexts: ["marketplace", "storefront"],
    allowedLayouts: ["full-width"],
    defaultSettings: { heading: "", label: "", href: "#contacts" },
    defaultLayout: "full-width",
    singleton: true,
    removable: true,
    dataSourceType: "static-config",
  },
];

const sections: SectionView[] = [
  {
    id: "s1",
    blockType: "content-about",
    blockInstanceId: "about-1",
    sortOrder: 0,
    enabled: true,
    settings: { heading: "О нас", body: "Текст" },
    style: {},
    responsive: {},
    dataSource: {},
    visibility: null,
    localeContent: {},
  },
];

function renderWorkspace(overrides: Partial<React.ComponentProps<typeof BuilderWorkspace>> = {}) {
  return render(
    <LocaleProvider>
      <BuilderWorkspace
        title="Конструктор"
        description="Соберите сайт"
        previewHref="/preview"
        published={false}
        saving={false}
        tabs={[{ id: "structure", label: "Структура" }]}
        activeTab="structure"
        onTabChange={() => undefined}
        registry={registry}
        sections={sections}
        savingLabel="Сохранение"
        onSave={vi.fn()}
        onPublish={vi.fn()}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onToggle={vi.fn()}
        onReorder={vi.fn()}
        onUpdateSettings={vi.fn()}
        {...overrides}
      />
    </LocaleProvider>,
  );
}

describe("BuilderWorkspace (shared marketplace/Storefront shell)", () => {
  it("renders library, structure and settings for a selected block", () => {
    renderWorkspace();
    expect(screen.getByText("Конструктор")).toBeTruthy();
    expect(screen.getAllByText("О компании").length).toBeGreaterThan(0);
    expect(screen.getByText("Призыв к действию")).toBeTruthy();
    expect((screen.getByLabelText("Заголовок") as HTMLInputElement).value).toBe("О нас");
    expect((screen.getByLabelText("Текст") as HTMLTextAreaElement).value).toBe("Текст");
  });

  it("wires save/publish/add/settings actions", () => {
    const onSave = vi.fn();
    const onPublish = vi.fn();
    const onAdd = vi.fn();
    const onUpdateSettings = vi.fn();
    renderWorkspace({ onSave, onPublish, onAdd, onUpdateSettings });

    fireEvent.click(screen.getByRole("button", { name: "Сохранить черновик" }));
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    fireEvent.click(screen.getByText("Призыв к действию"));
    fireEvent.change(screen.getByLabelText("Заголовок"), { target: { value: "Новый" } });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith("content-cta");
    expect(onUpdateSettings).toHaveBeenCalledWith("about-1", "heading", "Новый");
  });
});
