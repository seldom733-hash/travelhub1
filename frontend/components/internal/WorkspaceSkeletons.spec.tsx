// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  CanvasPageSkeleton,
  DashboardPageSkeleton,
  DocumentPageSkeleton,
  EntityDetailSkeleton,
  FormPageSkeleton,
  HelpPageSkeleton,
  MetricsPageSkeleton,
  OperationsPageSkeleton,
  QueuePageSkeleton,
  SettingsPageSkeleton,
  TabsPageSkeleton,
  WhatsappPageSkeleton,
  WorkspaceKpiPageSkeleton,
  WorkspacePageSkeleton,
} from "./WorkspaceSkeletons";

/**
 * §SKELETON-PARITY (2026-10-16) — контракт геометрии каркасов загрузки `/app/*`.
 *
 * Тесты фиксируют, что каждый каркас повторяет внешнюю раскладку своей реальной
 * страницы (отступы, полосы-шапки, сетки, радиусы). Источник истины для каждого
 * каркаса указан в комментарии компонента. Тест падает, если раскладку снова
 * отведут от страницы — именно это и было исходной проблемой («страница
 * расходится со скелетоном»).
 */

function markupOf(ui: React.ReactElement): string {
  const { container } = render(ui);
  return container.innerHTML;
}

describe("WorkspaceSkeletons §SKELETON-PARITY", () => {
  it("сегментный каркас = полоса PageHeader + `space-y-4 p-6`, без KPI и без старой геометрии", () => {
    const markup = markupOf(<WorkspacePageSkeleton />);
    // PageHeader.tsx:20
    expect(markup).toContain("border-b border-slate-200 bg-white px-6 py-4");
    // users/catalog/marketing/finance-*: `space-y-4 p-6`
    expect(markup).toContain("space-y-4 p-6");
    // OperationsRegistrySlot: `rounded-xl … shadow-sm`
    expect(markup).toContain("rounded-xl border border-slate-200 bg-white shadow-sm");
    // Прежняя чужая геометрия не должна вернуться.
    expect(markup).not.toContain("lg:p-10");
    expect(markup).not.toContain("h-24");
    expect(markup).not.toContain("rounded-2xl bg-slate-100");
  });

  it("реестровый каркас с `toolbar` добавляет строку фильтров (finance/obligations)", () => {
    expect(markupOf(<WorkspacePageSkeleton />)).not.toContain("flex flex-wrap items-center gap-2");
    const markup = markupOf(<WorkspacePageSkeleton toolbar />);
    expect(markup).toContain("flex flex-wrap items-center gap-2");
    expect(markup).toContain("space-y-4 p-6");
  });

  it("каркас финансового дашборда = `space-y-6 p-6` + сетки карточек, без панели-реестра", () => {
    const markup = markupOf(<MetricsPageSkeleton />);
    // finance/overview/page.tsx:187-205
    expect(markup).toContain("space-y-6 p-6");
    expect(markup).toContain("grid gap-4 sm:grid-cols-2 lg:grid-cols-3");
    expect(markup.match(/grid gap-4 sm:grid-cols-2"/g)?.length).toBe(2);
    expect(markup).toContain("rounded-xl border border-slate-200 bg-white shadow-sm");
    // Панели-реестра (таблицы) на этой странице нет.
    expect(markup).not.toContain("space-y-2 p-4");
  });

  it("KPI-каркас использует сетку `Kpi.tsx` (gap-3 … xl:grid-cols-6), а не старые `gap-4 h-24`", () => {
    const markup = markupOf(<WorkspaceKpiPageSkeleton />);
    expect(markup).toContain("grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6");
    expect(markup).not.toContain("gap-4 sm:grid-cols-2 lg:grid-cols-4");
  });

  it("каркас центра операций повторяет `OperationsCenterShell` (max-w-1440px, таб-полоса, h-9 табы)", () => {
    const markup = markupOf(<OperationsPageSkeleton />);
    expect(markup).toContain("flex h-full flex-col");
    expect(markup).toContain("mx-auto w-full max-w-[1440px] px-6 pt-5");
    expect(markup).toContain("mx-auto w-full max-w-[1440px] px-6 py-5");
    expect(markup).toContain("-mb-px flex items-center gap-1 overflow-x-auto pb-px");
  });

  it("каркас detail-страницы = две полосы-шапки + сетка `lg:grid-cols-3`", () => {
    const markup = markupOf(<EntityDetailSkeleton />);
    expect(markup.match(/border-b border-slate-200 bg-white px-6 py-4/g)?.length).toBe(2);
    expect(markup).toContain("grid grid-cols-1 gap-4 lg:grid-cols-3");
    expect(markup).toContain("lg:col-span-2");
    expect(markup).toContain("flex-1 overflow-y-auto p-6");
  });

  it("каркас дашборда = `p-6 lg:p-10` + сетка карточек `lg:grid-cols-3`, без полосы-шапки", () => {
    const markup = markupOf(<DashboardPageSkeleton />);
    expect(markup).toContain("p-6 lg:p-10");
    expect(markup).toContain("mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3");
    expect(markup).toContain("rounded-2xl border border-slate-200 bg-white");
    expect(markup).not.toContain("border-b border-slate-200 bg-white px-6 py-4");
  });

  it("каркас формы = `mx-auto max-w-3xl`, полосу PageHeader добавляет только `header`", () => {
    expect(markupOf(<FormPageSkeleton />)).toContain("mx-auto w-full max-w-3xl space-y-4 p-6");
    expect(markupOf(<FormPageSkeleton />)).not.toContain("border-b border-slate-200 bg-white px-6 py-4");

    const withHeader = markupOf(<FormPageSkeleton maxWidth="max-w-xl" header />);
    expect(withHeader).toContain("mx-auto w-full max-w-xl space-y-4 p-6");
    expect(withHeader).toContain("border-b border-slate-200 bg-white px-6 py-4");
  });

  it("каркас очереди = `space-y-4` без page-padding + `lg:grid-cols-2`", () => {
    const { container } = render(<QueuePageSkeleton />);
    // У `partners/onboarding` / `seller-profiles` контент идёт БЕЗ page-padding.
    expect((container.firstElementChild as HTMLElement).className).toBe("space-y-4");
    const markup = container.innerHTML;
    expect(markup).toContain("grid gap-4 lg:grid-cols-2");
    expect(markup).toContain("rounded-2xl border border-slate-200 bg-white shadow-sm");
  });

  it("каркас crm = таб-полоса `bg-slate-50 px-6 pt-2` + KPI-строка", () => {
    const markup = markupOf(<TabsPageSkeleton />);
    expect(markup).toContain("flex gap-1 border-b border-slate-200 bg-slate-50 px-6 pt-2");
    expect(markup).toContain("xl:grid-cols-6");
  });

  it("каркас конструктора = `lg:grid-cols-[280px_1fr]` под PageHeader", () => {
    const markup = markupOf(<CanvasPageSkeleton />);
    expect(markup).toContain("flex-1 p-6");
    expect(markup).toContain("grid gap-6 lg:grid-cols-[280px_1fr]");
  });

  it("каркасы контейнерных страниц держат свои max-width: help 1200px, document max-w-4xl, settings `px-6 py-4`", () => {
    expect(markupOf(<HelpPageSkeleton />)).toContain("mx-auto w-full max-w-[1200px] px-6 py-6");
    expect(markupOf(<DocumentPageSkeleton />)).toContain("mx-auto w-full max-w-4xl space-y-6 p-6");
    expect(markupOf(<SettingsPageSkeleton />)).toContain("space-y-4 px-6 py-4");
  });

  it("каркас whatsapp = трёхколоночная сетка `xl:grid-cols-[320px_…_340px]`", () => {
    expect(markupOf(<WhatsappPageSkeleton />)).toContain(
      "xl:grid-cols-[320px_minmax(0,1fr)_340px]",
    );
  });

  it("все каркасы объявляют роль status с aria-busy (тот же контракт, что у loading.tsx)", () => {
    const cases: Array<[string, React.ReactElement]> = [
      ["workspace", <WorkspacePageSkeleton />],
      ["kpi", <WorkspaceKpiPageSkeleton />],
      ["ops", <OperationsPageSkeleton />],
      ["detail", <EntityDetailSkeleton />],
      ["dashboard", <DashboardPageSkeleton />],
      ["form", <FormPageSkeleton />],
      ["queue", <QueuePageSkeleton />],
      ["tabs", <TabsPageSkeleton />],
      ["canvas", <CanvasPageSkeleton />],
      ["help", <HelpPageSkeleton />],
      ["metrics", <MetricsPageSkeleton />],
      ["whatsapp", <WhatsappPageSkeleton />],
      ["settings", <SettingsPageSkeleton />],
      ["document", <DocumentPageSkeleton />],
    ];
    for (const [name, ui] of cases) {
      const { unmount } = render(ui);
      const status = screen.getByRole("status");
      expect(status.getAttribute("aria-busy"), name).toBe("true");
      unmount();
    }
  });
});
