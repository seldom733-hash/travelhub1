// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { probePhotoUrl, resetPhotoProbeCache, useHotelPhoto } from "./hotel-photo";

/**
 * Единый каталог фотографий отелей (Этап E, фронтенд).
 *
 * Проверяем ровно те свойства, за которые отвечает этот модуль:
 *  - ссылку на фото даёт бэкенд (реестр) — она используется как есть;
 *  - отсутствующий файл не ломает карточку (null → иконка-фолбэк);
 *  - legacy-перебора имён (`<tourinc>-<hotelKey>.jpg|png|webp`) больше нет:
 *    без ссылки из реестра хук сразу отдаёт null и не делает ни одного запроса;
 *  - HEAD-проба кешируется (один запрос на URL, включая промах).
 */

function mockFetch(existing: Set<string>) {
  const calls: string[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return { ok: existing.has(url), status: existing.has(url) ? 200 : 404 } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

beforeEach(() => {
  resetPhotoProbeCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("probePhotoUrl", () => {
  it("возвращает URL, если файл есть", async () => {
    mockFetch(new Set(["/hotels/hotel_abc.webp"]));
    await expect(probePhotoUrl("/hotels/hotel_abc.webp")).resolves.toBe("/hotels/hotel_abc.webp");
  });

  it("отсутствующий файл → null и кешируется (один запрос на URL)", async () => {
    const calls = mockFetch(new Set());
    await expect(probePhotoUrl("/hotels/hotel_missing.webp")).resolves.toBeNull();
    await expect(probePhotoUrl("/hotels/hotel_missing.webp")).resolves.toBeNull();
    expect(calls).toHaveLength(1);
  });
});

describe("useHotelPhoto", () => {
  it("показывает единое фото отеля из реестра", async () => {
    mockFetch(new Set(["/hotels/hotel_11111111.webp"]));
    const { result } = renderHook(() => useHotelPhoto("/hotels/hotel_11111111.webp"));
    await waitFor(() => expect(result.current).toBe("/hotels/hotel_11111111.webp"));
  });

  it("фото нет → null (карточка покажет иконку-фолбэк) и ровно одна проба", async () => {
    const calls = mockFetch(new Set());
    const { result } = renderHook(() => useHotelPhoto("/hotels/hotel_missing.webp"));
    await waitFor(() => expect(result.current).toBeNull());
    expect(calls).toEqual(["/hotels/hotel_missing.webp"]);
  });

  it("нет ссылки из реестра → null и ни одного запроса (legacy-перебора нет)", async () => {
    const calls = mockFetch(new Set(["/hotels/5283-31215.jpg"]));
    const { result } = renderHook(() => useHotelPhoto(null));
    await waitFor(() => expect(result.current).toBeNull());
    expect(calls).toEqual([]);
  });
});
