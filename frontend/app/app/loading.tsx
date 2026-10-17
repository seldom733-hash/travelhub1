"use client";

import { WorkspacePageSkeleton } from "@/components/internal/WorkspaceSkeletons";

/**
 * Мгновенный отклик на клик в левом меню (§LATENCY) + §SKELETON-PARITY.
 *
 * Без этого файла App Router держал на экране ПРЕДЫДУЩИЙ раздел, пока не
 * приходил RSC-ответ: на холодную dev-сервер компилирует маршрут 1,3–1,8 с,
 * и всё это время клик по пункту меню выглядел как «отклик срабатывает
 * поздно» — ровно та же причина, что описана в app/products/[slug]/loading.tsx
 * для витрины. Граница loading рисуется сразу по клику, а layout выше уже
 * отдаёт sidebar, поэтому chrome остаётся тем же, что и на самой странице.
 *
 * Каркас — форма по умолчанию для большинства разделов: полоса-шапка
 * `PageHeader` + контент `space-y-4 p-6` с панелью-реестром. Разделы с другой
 * внешней раскладкой (Operations Center, дашборд, detail-страницы, формы,
 * очереди, конструктор, help, whatsapp) перекрывают её своим `loading.tsx`.
 */
export default function InternalAppLoading() {
  return <WorkspacePageSkeleton />;
}
