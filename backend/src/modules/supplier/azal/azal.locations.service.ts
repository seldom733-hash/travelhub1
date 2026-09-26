import { Injectable, Logger, OnModuleInit } from "@nestjs/common";

export interface AzalDirectoryEntry {
  code: string;
  city: string;
  country: string;
  airport: string;
  search: string;
}

export interface AzalDirectoryResult {
  source: string;
  collectedAt: string;
  count: number;
  entries: AzalDirectoryEntry[];
}

/**
 * AZAL network directory served to the storefront flight search.
 *
 * Source: the public AZAL config-proxy locations endpoint (the same source
 * the AZAL website search uses). The directory refreshes automatically:
 *  - once at module startup (background, never blocks boot),
 *  - every TTL via timer,
 *  - on demand when a request arrives with an empty/stale cache,
 *  - manually via GET /supplier/azal/locations?refresh=true.
 *
 * A failed refresh never wipes the previous cache.
 */
@Injectable()
export class AzalLocationsService implements OnModuleInit {
  private readonly logger = new Logger(AzalLocationsService.name);

  private static readonly ENDPOINT =
    "https://config-proxy.azal.az/api/locations?enabled=true";
  private static readonly TTL_MS = 24 * 60 * 60 * 1000;
  private static readonly FETCH_TIMEOUT_MS = 30_000;

  private cache: { fetchedAt: number; entries: AzalDirectoryEntry[] } | null =
    null;
  private inflight: Promise<AzalDirectoryEntry[]> | null = null;

  onModuleInit(): void {
    void this.refresh("startup");
    const timer = setInterval(() => {
      void this.refresh("scheduled");
    }, AzalLocationsService.TTL_MS);
    if (typeof (timer as unknown as { unref?: unknown }).unref === "function") {
      (timer as unknown as { unref: () => void }).unref();
    }
  }

  async getLocations(forceRefresh = false): Promise<AzalDirectoryResult> {
    const entries = forceRefresh
      ? await this.refresh("manual")
      : await this.getCachedOrRefresh();

    return {
      source: "AZAL",
      collectedAt: new Date().toISOString(),
      count: entries.length,
      entries,
    };
  }

  private async getCachedOrRefresh(): Promise<AzalDirectoryEntry[]> {
    if (
      this.cache &&
      Date.now() - this.cache.fetchedAt < AzalLocationsService.TTL_MS
    ) {
      return this.cache.entries;
    }
    return this.refresh("on-demand");
  }

  private async refresh(reason: string): Promise<AzalDirectoryEntry[]> {
    if (this.inflight) {
      return this.inflight;
    }

    this.inflight = this.fetchDirectory()
      .then((entries) => {
        this.cache = { fetchedAt: Date.now(), entries };
        this.logger.log(
          `[AZAL DIRECTORY] refreshed (${reason}): ${entries.length} cities`,
        );
        return entries;
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `[AZAL DIRECTORY] refresh failed (${reason}), keeping previous cache: ${message}`,
        );
        return this.cache?.entries ?? [];
      })
      .finally(() => {
        this.inflight = null;
      });

    return this.inflight;
  }

  private async fetchDirectory(): Promise<AzalDirectoryEntry[]> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      AzalLocationsService.FETCH_TIMEOUT_MS,
    );

    try {
      const response = await fetch(AzalLocationsService.ENDPOINT, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(
          `AZAL locations endpoint responded with ${response.status}`,
        );
      }
      const data = (await response.json()) as unknown;
      return AzalLocationsService.extractVisibleCities(data);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * The endpoint returns a country -> city -> airport tree.
   * Only cities flagged visible are bookable on azal.az — those are
   * the destinations served from Azerbaijan.
   */
  private static extractVisibleCities(data: unknown): AzalDirectoryEntry[] {
    const root =
      data && typeof data === "object"
        ? (data as Record<string, unknown>)
        : {};
    const countries = Array.isArray(root.locations) ? root.locations : [];
    const entries: AzalDirectoryEntry[] = [];

    const walk = (node: unknown, country: Record<string, unknown> | null): void => {
      if (!node || typeof node !== "object") {
        return;
      }
      const current = node as Record<string, unknown>;
      const nextCountry =
        current.type === "country" ? current : (country ?? null);

      if (current.type === "city" && current.visible === true) {
        const names = AzalLocationsService.names(current);
        const countryNames = AzalLocationsService.names(nextCountry ?? {});
        const kids = Array.isArray(current.children)
          ? (current.children as Record<string, unknown>[])
          : [];
        const kidCodes = kids
          .map((kid) => (typeof kid.code === "string" ? kid.code : ""))
          .filter(Boolean);
        const kidNames = kids
          .map((kid) => AzalLocationsService.names(kid).en)
          .filter(Boolean);
        const code = typeof current.code === "string" ? current.code : "";
        if (code) {
          const terms = [
            code,
            names.en,
            names.ru,
            ...kidCodes,
            ...kidNames,
          ].filter(Boolean) as string[];
          entries.push({
            code,
            city: names.ru || names.en || code,
            country: countryNames.ru || countryNames.en || "",
            airport:
              kidNames.length > 0
                ? kidNames.join(" / ")
                : names.en || code,
            search: [...new Set(terms.map((term) => term.toLowerCase()))].join(
              " ",
            ),
          });
        }
      }

      const children = Array.isArray(current.children)
        ? (current.children as unknown[])
        : [];
      for (const child of children) {
        walk(child, nextCountry);
      }
    };

    for (const country of countries as unknown[]) {
      walk(country, null);
    }
    return entries;
  }

  private static names(node: Record<string, unknown>): {
    en: string;
    ru: string;
  } {
    const names =
      node.names && typeof node.names === "object"
        ? (node.names as Record<string, unknown>)
        : {};
    return {
      en: typeof names.en === "string" ? names.en : "",
      ru: typeof names.ru === "string" ? names.ru : "",
    };
  }
}
