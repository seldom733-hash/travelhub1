import { Injectable, Logger } from "@nestjs/common";
import { chromium } from "playwright";
import { parseAviasalesChunk } from "./aviasales.response-parser";
import type { AviasalesChunk, AviasalesStartBody } from "./aviasales.types";
import type { FlightOffer, FlightSearchQuery } from "../azal/flight.types";

/**
 * Aviasales transport.
 *
 * No Playwright, no CDP: the start/poll contract is reachable from plain
 * `fetch` once the request carries the `_awt` fingerprint cookie inside the
 * `x-origin-cookie` header. Everything below is a direct port of the verified
 * spike (`aviasales_verify_awt.cjs`) that ran a full start→poll cycle against
 * the live API on 2026-10-02.
 *
 * `POST /search/v2/start` is the only route the origin host refuses (403), so
 * the regional gateways below are the entry points. A poll answers with an
 * ARRAY of chunks (cumulative) and signals completion through the
 * `X-Stop-Marker` response header.
 */
@Injectable()
export class AviasalesHttpService {
  private readonly logger = new Logger(AviasalesHttpService.name);

  private awt: string | null = null;
  private awtExpiresAt = 0;
  private hostIndex = 0;
  /**
   * Full browser cookie header + AWS WAF token. The API rejects a bare
   * `_awt=...` now: it expects the same cookie string and `x-aws-waf-token`
   * that the site itself sends.
   */
  private session: { cookie: string; waf: string; expiresAt: number } | null = null;

  async search(query: FlightSearchQuery): Promise<FlightOffer[]> {
    const searchId = await this.start(buildAviasalesStartBody(query));
    const chunk = await this.poll(searchId);

    return chunk ? parseAviasalesChunk(chunk, query) : [];
  }

  private async start(body: AviasalesStartBody): Promise<string> {
    const response = await this.post(AviasalesHttpService.START_PATH, JSON.stringify(body));

    if (response.status !== 200) {
      throw new Error(
        `Aviasales start failed (HTTP ${response.status})${response.text ? `: ${response.text.slice(0, 200)}` : ""}`,
      );
    }

    const payload = parseJson(response.text) as { search_id?: unknown } | null;
    const searchId = typeof payload?.search_id === "string" ? payload.search_id : null;

    if (!searchId) {
      throw new Error("Aviasales start response carried no search_id");
    }

    return searchId;
  }

  private async poll(searchId: string): Promise<AviasalesChunk | null> {
    const body = JSON.stringify({ search_id: searchId });
    let best: AviasalesChunk | null = null;

    for (let attempt = 0; attempt < AviasalesHttpService.MAX_POLLS; attempt += 1) {
      const response = await this.post(AviasalesHttpService.POLL_PATH, body);

      if (response.status !== 200) {
        throw new Error(
          `Aviasales poll failed (HTTP ${response.status})${response.text ? `: ${response.text.slice(0, 200)}` : ""}`,
        );
      }

      const chunk = pickResultsChunk(response.text);

      if (chunk && (!best || chunkCount(chunk) > chunkCount(best))) {
        best = chunk;
      }

      if (response.stopMarker) {
        return best;
      }

      if (attempt < AviasalesHttpService.MAX_POLLS - 1) {
        await sleep(AviasalesHttpService.POLL_INTERVAL_MS);
      }
    }

    if (best) {
      this.logger.warn(
        `[AVIASALES POLL] no X-Stop-Marker after ${AviasalesHttpService.MAX_POLLS} attempts — returning ${chunkCount(best)} tickets collected so far`,
      );
      return best;
    }

    throw new Error(
      `Aviasales search ${searchId} produced no results within ${AviasalesHttpService.MAX_POLLS} polls`,
    );
  }

  /**
   * POST against every regional gateway in turn. A 403 means the cached
   * `_awt` was rejected, so it is regenerated once before the next host is
   * tried; 5xx and transport errors fall straight through to the next host.
   */
  private async post(
    path: string,
    body: string,
  ): Promise<{ status: number; text: string; stopMarker: string | null }> {
    const hosts = AviasalesHttpService.HOSTS;
    let lastFailure = "";

    for (let attempt = 0; attempt < hosts.length; attempt += 1) {
      const index = (this.hostIndex + attempt) % hosts.length;
      const host = hosts[index];

      try {
        const response = await this.postOnce(host, path, body);

        if (response.status === 403) {
          this.awt = null;
          this.awtExpiresAt = 0;
          this.session = null;

          const retried = await this.postOnce(host, path, body);

          if (retried.status !== 403) {
            this.hostIndex = index;
            return retried;
          }

          lastFailure = `${host}: HTTP 403 (fingerprint rejected)`;
          continue;
        }

        if (response.status >= 500) {
          lastFailure = `${host}: HTTP ${response.status}`;
          continue;
        }

        this.hostIndex = index;
        return response;
      } catch (error) {
        lastFailure = `${host}: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    throw new Error(`Aviasales request failed on every gateway (${lastFailure})`);
  }

  private async postOnce(
    host: string,
    path: string,
    body: string,
  ): Promise<{ status: number; text: string; stopMarker: string | null }> {
    const awt = await this.ensureAwt(host);
    const session = await this.ensureSession();
    const response = await fetch(`https://${host}${path}`, {
      method: "POST",
      headers: AviasalesHttpService.headers(awt, session),
      body,
      signal: AbortSignal.timeout(AviasalesHttpService.REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();

    return {
      status: response.status,
      text,
      stopMarker: response.headers.get("x-stop-marker"),
    };
  }

  private async ensureAwt(host: string): Promise<string> {
    if (this.awt && Date.now() < this.awtExpiresAt) {
      return this.awt;
    }

    this.awt = await this.generateAwt(host);
    this.awtExpiresAt = Date.now() + AviasalesHttpService.AWT_TTL_MS;

    return this.awt;
  }

  /**
   * The live site sends the whole `document.cookie` string in
   * `x-origin-cookie` plus `x-aws-waf-token`. A generated `_awt` alone is
   * rejected by AWS WAF with 403 "access denied". Read the browser session
   * over CDP (same Chrome used by AZAL); env overrides allow a headless setup.
   */
  private async ensureSession(): Promise<{ cookie: string; waf: string }> {
    const envCookie = process.env.AVIASALES_ORIGIN_COOKIE?.trim();
    const envWaf = process.env.AVIASALES_WAF_TOKEN?.trim();
    if (envCookie && envWaf) {
      return { cookie: envCookie, waf: envWaf };
    }

    if (this.session && Date.now() < this.session.expiresAt) {
      return { cookie: this.session.cookie, waf: this.session.waf };
    }

    const endpoint =
      process.env.AVIASALES_CHROME_CDP_URL ||
      process.env.AZAL_CHROME_CDP_URL ||
      "http://127.0.0.1:9222";

    let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | null = null;
    try {
      browser = await chromium.connectOverCDP(endpoint);
      const context = browser.contexts()[0];
      if (!context) throw new Error("connected Chrome has no browser context");
      const cookies = await context.cookies([
        "https://www.aviasales.az/",
        "https://tickets-api.aviasales.com/",
      ]);
      const cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      const waf = cookies.find((c) => c.name === "aws-waf-token")?.value ?? "";
      if (!cookie.includes("_awt=") || !waf) {
        throw new Error(
          "Aviasales browser session has no _awt/aws-waf-token cookie; open https://www.aviasales.az/ and complete the WAF challenge",
        );
      }
      this.session = { cookie, waf, expiresAt: Date.now() + 5 * 60_000 };
      return { cookie, waf };
    } catch (error) {
      throw new Error(
        `Cannot read Aviasales browser session over CDP at ${endpoint}. ` +
          `Open https://www.aviasales.az/ in Chrome with --remote-debugging-port=9222 and keep it running. ` +
          `Original error: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await browser?.close().catch(() => undefined);
    }
  }

  private async generateAwt(host: string): Promise<string> {
    const response = await fetch(`https://${host}/fp.js?t=${Date.now()}`, {
      signal: AbortSignal.timeout(AviasalesHttpService.FP_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Aviasales fp.js failed (HTTP ${response.status}) on ${host}`);
    }

    const script = await response.text();
    const seed = script.match(/return '([^']+)'/)?.[1];
    const ttl = Number(script.match(/\}\(\),\s*(\d+)\)/)?.[1]);

    if (!seed || !Number.isFinite(ttl) || ttl <= 0) {
      throw new Error(`Aviasales fp.js on ${host} did not expose a seed/ttl`);
    }

    this.logger.log(`[AVIASALES FP] host=${host} seedLength=${seed.length} ttl=${ttl}`);

    return lcgShuffle(seedToInput(seed), ttl);
  }

  private static readonly HOSTS = [
    "tickets-api.eu-north-1.aviasales.com",
    "tickets-api.ru-central-1.aviasales.com",
    "tickets-api.us-east-2.aviasales.com",
  ];

  private static readonly START_PATH = "/search/v2/start";
  private static readonly POLL_PATH = "/search/v3.2/results";
  private static readonly ORIGIN = "https://www.aviasales.az";

  private static readonly MAX_POLLS = 12;
  private static readonly POLL_INTERVAL_MS = 2_500;
  private static readonly REQUEST_TIMEOUT_MS = 30_000;
  private static readonly FP_TIMEOUT_MS = 15_000;
  private static readonly AWT_TTL_MS = 10 * 60_000;

  /** Headers the live site sends. `_awt` is used only as a fallback for the cookie string. */
  private static headers(awt: string, session: { cookie: string; waf: string } | null): Record<string, string> {
    const cookie = session?.cookie || `_awt=${awt}`;
    return {
      "content-type": "application/json",
      accept: "application/json",
      origin: AviasalesHttpService.ORIGIN,
      referer: `${AviasalesHttpService.ORIGIN}/`,
      authorization: "",
      "x-client-type": "web",
      "x-web-client": "web_desktop",
      "x-origin-cookie": cookie,
      ...(session?.waf ? { "x-aws-waf-token": session.waf } : {}),
    };
  }
}

/**
 * Body of `POST /search/v2/start` — every key below is mandatory: without
 * `marker` the API answers 400 `empty-marker`, without `currency_code` it
 * answers `invalid-currency`.
 *
 * RT is never sent here: AviasalesAdapter decomposes round trips into two
 * one-way searches so it can reuse the same combine strategy as AZAL.
 */
export function buildAviasalesStartBody(query: FlightSearchQuery): AviasalesStartBody {
  const origin = query.from.trim().toUpperCase();
  const destination = query.to.trim().toUpperCase();

  return {
    search_params: {
      directions: [
        {
          origin,
          destination,
          date: query.departureDate,
          is_origin_airport: isIataCode(origin),
          is_destination_airport: isIataCode(destination),
        },
      ],
      passengers: {
        adults: Math.max(1, query.passengers?.adults || 1),
        children: Math.max(0, query.passengers?.children || 0),
        infants: Math.max(0, query.passengers?.infants || 0),
      },
      trip_class: "Y",
    },
    client_features: {
      direct_flights: true,
      brand_ticket: false,
      top_filters: true,
      badges: false,
      tour_tickets: true,
      assisted: true,
    },
    market_code: "az",
    marker: "direct",
    citizenship: "AZ",
    currency_code: "azn",
    languages: { az: 1 },
    experiment_groups: {},
    brand: "AS",
    search_source: "search_form",
    subscription_ticket_signatures: [],
    is_internet_restricted: false,
  };
}

/**
 * `_awt = lcgShuffle(hexCharCodes(seed) + "-" + <32 hex>, ttl)` — the second
 * half is never validated server-side, so zeros are enough (verified live).
 */
function seedToInput(seed: string): string {
  const hexCodes = [...seed].map((char) => char.charCodeAt(0).toString(16)).join("");

  return `${hexCodes}-${"0".repeat(32)}`;
}

function lcgShuffle(input: string, ttl: number): string {
  let state = ttl >>> 0;
  const pairs: Array<[string, number]> = [];

  for (const char of input) {
    state = (1664525 * state + 0x3c6ef35f) % 0x100000000;
    pairs.push([char, state >>> 0]);
  }

  pairs.sort((a, b) => a[1] - b[1] || a[0].charCodeAt(0) - b[0].charCodeAt(0));

  return pairs.map(([char]) => char).join("");
}

/** Polls answer with an array of cumulative chunks; prefer `chunk_id: results`. */
function pickResultsChunk(text: string): AviasalesChunk | null {
  const payload = parseJson(text);

  if (Array.isArray(payload)) {
    const candidates = payload.filter(isChunk);
    const results = candidates.find((chunk) => chunk.chunk_id === "results");
    const richest = candidates.sort((a, b) => chunkCount(b) - chunkCount(a))[0];

    return results ?? richest ?? null;
  }

  return isChunk(payload) ? payload : null;
}

function isChunk(value: unknown): value is AviasalesChunk {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as AviasalesChunk).tickets)
  );
}

function chunkCount(chunk: AviasalesChunk): number {
  return chunk.tickets?.length ?? 0;
}

function isIataCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
