// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  fetchHotelPhoto,
  hotelPhotoKeyFromSlug,
  probePhotoUrl,
  resetPhotoProbeCache,
  useHotelPhoto,
} from "./hotel-photo";

/**
 * Единый каталог фотографий отелей (Этап E, фронтенд).
 *
 * Проверяем ровно те свойства, за которые отвечает этот модуль:
 *  - ссылку на фото даёт бэкенд (реестр) — она используется как есть;
 *  - отсутствующий файл не ломает карточку (null → иконка-фолбэк);
 *  - legacy-имя `<tourinc>-<hotelKey>` всё ещё находится (jpg|png|webp);
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

describe("hotelPhotoKeyFromSlug (legacy-совместимость)", () => {
  it("тур: <supplier>-<tourinc>-<hotelKey> → <tourinc>-<hotelKey>", () => {
    expect(hotelPhotoKeyFromSlug("kompas-5283-31215")).toBe("5283-31215");
    expect(hotelPhotoKeyFromSlug("summertour-4220-1205-resort")).toBe("4220-1205");
  });

  it("отель услуги: kompas-hotel-<iso>-<hotelKey> → htl-<hotelKey>", () => {
    expect(hotelPhotoKeyFromSlug("kompas-hotel-tr-46890")).toBe("htl-46890");
  });

  it("нерелевантный slug → null", () => {
    expect(hotelPhotoKeyFromSlug("manual-product")).toBeNull();
  });
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

describe("fetchHotelPhoto (legacy-файлы)", () => {
  it("ищет jpg → png → webp и возвращает первый найденный", async () => {
    const calls = mockFetch(new Set(["/hotels/5283-31215.png"]));
    await expect(fetchHotelPhoto("5283-31215")).resolves.toBe("/hotels/5283-31215.png");
    expect(calls).toEqual(["/hotels/5283-31215.jpg", "/hotels/5283-31215.png"]);
  });

  it("нет ни одного расширения → null", async () => {
    mockFetch(new Set());
    await expect(fetchHotelPhoto("9999-9999")).resolves.toBeNull();
  });
});

describe("useHotelPhoto", () => {
  it("показывает единое фото отеля из реестра", async () => {
    mockFetch(new Set(["/hotels/hotel_11111111.webp"]));
    const { result } = renderHook(() => useHotelPhoto("/hotels/hotel_11111111.webp", "kompas-5283-31215"));
    await waitFor(() => expect(result.current).toBe("/hotels/hotel_11111111.webp"));
  });

  it("фото нет → null (карточка покажет иконку-фолбэк)", async () => {
    mockFetch(new Set());
    const { result } = renderHook(() => useHotelPhoto("/hotels/hotel_missing.webp", "kompas-5283-31215"));
    await waitFor(() => expect(result.current).toBeNull());
  });

  it("нет ссылки из реестра → падает на legacy-файл по slug", async () => {
    mockFetch(new Set(["/hotels/5283-31215.jpg"]));
    const { result } = renderHook(() => useHotelPhoto(null, "kompas-5283-31215"));
    await waitFor(() => expect(result.current).toBe("/hotels/5283-31215.jpg"));
  });
});
