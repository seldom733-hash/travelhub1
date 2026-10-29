/**
 * Единый каталог фотографий отелей (Этап C): одна фотография на ФИЗИЧЕСКУЮ
 * гостиницу из реестра `catalog."Hotel"`.
 *
 *   cd backend && npx tsx scripts/hotel-photo-catalog.ts [опции]
 *
 * Опции:
 *   --limit=N          сколько отелей обработать за запуск (по умолчанию 25)
 *   --only=<id|name>   только эти отели (id записи или подстрока имени)
 *   --status=A,B       какие статусы брать (по умолчанию NONE,FAILED)
 *   --force            перекачать даже те, у которых файл уже есть
 *   --dry-run          только показать, что будет скачано
 *   --width=N          ширина WebP (по умолчанию 1200)
 *   --quality=N        качество WebP (по умолчанию 82)
 *   --concurrency=N    одновременных отелей (по умолчанию 2)
 *   --report           ничего не качать: сводка «сколько без фото»
 *
 * Инварианты (требования заказчика):
 *  - ОДИН файл на отель: `frontend/public/hotels/hotel_<hotelId>.webp`. Тур с
 *    этим отелем, карточка в услуге «Отели», поиск и конструктор ссылаются на
 *    тот же файл — копий для туров/поставщиков не создаётся.
 *  - Повторный запуск не создаёт дубликатов: цель — стабильное имя, пропуск уже
 *    готовых, журнал в backend/data/hotels/photo-journal.jsonl.
 *  - Файл пишется атомарно (tmp → rename) и только после успешной валидации
 *    формата/размера/целостности; битый/слишком мелкий результат отбрасывается.
 *  - Существующий файл не перезаписывается без `--force`.
 *
 * Источник (проверено live, без браузера): HTML tripadvisor.* закрыт DataDome,
 * но CDN картинок открыт; Bing Images в метаданных `murl` отдаёт прямые CDN-URL.
 * Права на такое использование должен подтвердить заказчик — см.
 * docs/prompts/HOTEL_PHOTO_CATALOG_PLAN.md §4; журнал хранит источник каждой
 * фотографии (`photoSourceUrl`) для последующей атрибуции/замены.
 */
import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = path.resolve(__dirname, "../../frontend/public/hotels");
const DATA_DIR = path.resolve(__dirname, "../data/hotels");
const JOURNAL = path.join(DATA_DIR, "photo-journal.jsonl");

const DEFAULT_CONCURRENCY = 2;
const FETCH_TIMEOUT_MS = 30_000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type PhotoStatus = "NONE" | "PENDING" | "OK" | "FAILED" | "REVIEW";

interface CliOptions {
  limit: number;
  only: string[];
  idsFile: string | null;
  statuses: PhotoStatus[];
  force: boolean;
  dryRun: boolean;
  report: boolean;
  width: number;
  quality: number;
  concurrency: number;
  /** Второй проход: мягкое совпадение по названию (ядро + половина слов). */
  relaxed: boolean;
  /** Only hotels referenced by this supplier code (post-sync backfill). */
  supplier: string | null;
}

interface HotelTask {
  id: string;
  name: string;
  normalizedName: string;
  cityName: string;
  countryName: string;
  countryCode: string;
  refs: Array<{ name: string; cityName: string; countryCode: string; supplierCode: string; externalKey: string }>;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const opts: CliOptions = {
    limit: 25,
    only: [],
    idsFile: null,
    statuses: ["NONE", "FAILED"],
    force: false,
    dryRun: false,
    report: false,
    width: 1200,
    quality: 82,
    concurrency: DEFAULT_CONCURRENCY,
    relaxed: false,
    supplier: null,
  };
  for (const a of args) {
    const num = (re: RegExp, set: (n: number) => void) => {
      const m = a.match(re);
      if (m) set(parseInt(m[1], 10));
    };
    num(/^--limit=(\d+)$/, (n) => (opts.limit = n));
    num(/^--width=(\d+)$/, (n) => (opts.width = n));
    num(/^--quality=(\d+)$/, (n) => (opts.quality = n));
    num(/^--concurrency=(\d+)$/, (n) => (opts.concurrency = Math.max(1, n)));
    const only = a.match(/^--only=(.+)$/);
    if (only) opts.only.push(...only[1].split(",").map((s) => s.trim()).filter(Boolean));
    const idsFile = a.match(/^--ids-file=(.+)$/);
    if (idsFile) opts.idsFile = idsFile[1].trim();
    const st = a.match(/^--status=([A-Z,]+)$/);
    if (st) opts.statuses = st[1].split(",").map((s) => s.trim()) as PhotoStatus[];
    const supplier = a.match(/^--supplier=([A-Za-z0-9_-]+)$/);
    if (supplier) opts.supplier = supplier[1].toUpperCase();
    if (a === "--force") opts.force = true;
    if (a === "--relaxed") opts.relaxed = true;
    if (a === "--dry-run") opts.dryRun = true;
    if (a === "--report") opts.report = true;
  }
  return opts;
}

/** Абсолютный путь файла отеля (имя детерминировано — один файл на отель). */
function photoFileName(hotelId: string): string {
  return `hotel_${hotelId}.webp`;
}

function journal(entry: Record<string, unknown>): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(JOURNAL, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, "utf8");
}

/** Валидация CDN-URL: только фото tripadvisor, не аватары/иконки. */
function pickPhotoUrl(src: string): string | null {
  if (!src || !/^https?:\/\//.test(src)) return null;
  if (!/\/photo-[a-z]\//.test(src)) return null;
  if (/default-avatar|user_photo/i.test(src)) return null;
  return src;
}

async function httpGet(
  url: string,
  timeoutMs = FETCH_TIMEOUT_MS,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*", ...headers },
      signal: ctrl.signal,
      redirect: "follow",
    });
    return { status: resp.status, body: await resp.text() };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Значимые слова названия отеля для проверки релевантности результата.
 * Служебные слова («hotel», «resort», «spa»…) отбрасываются: они есть почти в
 * любом названии и не помогают отличить один отель от другого.
 */
const STOP_WORDS = new Set([
  "hotel", "hotels", "resort", "resorts", "spa", "guest", "house", "guesthouse",
  "apartments", "apartment", "suites", "suite", "inn", "hostel", "villa", "villas",
  "club", "beach", "by", "the", "and", "of", "at", "in", "city", "center", "centre",
]);

function normalizeForMatch(raw: string): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(name: string): string[] {
  return normalizeForMatch(name)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

interface ImageResult {
  image: string;
  title: string;
}

/**
 * Bing Images (async-эндпоинт). Обычная страница `/images/search` стала JS-only
 * и `murl` в HTML не отдаёт, но `/images/async` возвращает HTML-фрагмент, где
 * каждый результат — JSON-блоб `m="{…}"` с `murl` (прямой URL картинки) и `t`
 * (заголовок). Работает без браузера.
 */
async function bingImageResults(query: string): Promise<ImageResult[]> {
  const url = `https://www.bing.com/images/async?q=${encodeURIComponent(query)}&first=1&count=35&mmasync=1&qft=+filterui%3aphoto-photo`;
  const { status, body } = await httpGet(url);
  if (status !== 200) return [];
  const out: ImageResult[] = [];
  for (const m of body.matchAll(/m="([^"]*)"/g)) {
    const decoded = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    try {
      const o = JSON.parse(decoded) as { murl?: string; t?: string };
      if (typeof o.murl === "string" && o.murl) out.push({ image: o.murl, title: o.t ?? "" });
    } catch {
      // не JSON — пропускаем
    }
  }
  if (out.length === 0) {
    // Резервная разметка, если блобы не распарсились.
    for (const m of body.matchAll(/&quot;murl&quot;:&quot;(.*?)&quot;/g)) {
      out.push({ image: m[1].replace(/&amp;/g, "&"), title: "" });
    }
  }
  return out;
}

/**
 * DuckDuckGo Images (plain GET): HTML отдаёт `vqd`-токен, JSON-эндпоинт `i.js`
 * — прямые URL картинок. DuckDuckGo быстро включает бот-защиту (HTTP 202) при
 * частых запросах, поэтому используется только как резерв к Bing.
 */
async function ddgImageResults(query: string): Promise<ImageResult[]> {
  const page = await httpGet(
    `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
  );
  if (page.status !== 200) return [];
  const vqd = page.body.match(/vqd=["']?([\d-]+)["']?/)?.[1];
  if (!vqd) return [];
  const json = await httpGet(
    `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,&p=1`,
    FETCH_TIMEOUT_MS,
    { Accept: "application/json", Referer: "https://duckduckgo.com/" },
  );
  if (json.status !== 200) return [];
  try {
    const parsed = JSON.parse(json.body) as { results?: Array<{ image?: string; title?: string }> };
    return (parsed.results ?? [])
      .filter((r): r is { image: string; title?: string } => typeof r.image === "string")
      .map((r) => ({ image: r.image, title: r.title ?? "" }));
  } catch {
    return [];
  }
}

/** Приводит CDN-ссылку Tripadvisor к «оригиналу» нужного размера. */
function upgradePhotoUrl(raw: string): string {
  const clean = raw.replace(/&amp;/g, "&");
  const upgraded = clean.includes("/photo-o/") ? clean : clean.replace(/\/photo-[a-z]\//, "/photo-o/");
  return upgraded.includes("?")
    ? upgraded.replace(/w=\d+/, "w=1200").replace(/h=\d+/, "h=-1")
    : `${upgraded}?w=1200&h=-1&s=1`;
}

/**
 * Поиск CDN-фото отеля. Источник — Tripadvisor CDN; сами ссылки ищутся через
 * Bing Images (async), при отказе — через DuckDuckGo Images. Результат
 * принимается только если ВСЕ значимые слова названия отеля встречаются в
 * заголовке/URL: лучше оставить карточку без фото, чем подставить чужое.
 *
 * `--relaxed` (второй проход): требование «все слова» снимается — берётся
 * первое значимое слово (ядро названия) + не менее половины слов. Нужен для
 * длинных названий вида «MAIKHAO HOTEL MANAGED BY CENTARA», где в заголовке
 * TripAdvisor есть «Maikhao» и «Centara», но нет «Managed».
 */
async function searchHotelPhoto(
  query: string,
  hotelName: string,
  relaxed = false,
): Promise<string | null> {  const tokens = nameTokens(hotelName);
  // Запрос с русским/локализованным городом Bing часто уводит в ноль результатов
  // Tripadvisor, поэтому сначала пробуем чистое название отеля.
  const queries = [`${hotelName} tripadvisor`, `${query} tripadvisor`];
  const providers: Array<(q: string) => Promise<ImageResult[]>> = [bingImageResults, ddgImageResults];
  const minScore = relaxed ? Math.max(1, Math.ceil(tokens.length / 2)) : tokens.length;

  for (const provider of providers) {
    for (const q of queries) {
      const results = await provider(q);
      const candidates = results
        .filter((r) => /(?:media-cdn|dynamic-media-cdn)\.tripadvisor\.com/.test(r.image))
        .filter((r) => !/default-avatar|user_photo/i.test(r.image))
        .map((r) => {
          const hay = normalizeForMatch(`${r.title} ${r.image}`);
          const score = tokens.filter((t) => hay.includes(t)).length;
          const coreHit = tokens.length === 0 ? true : hay.includes(tokens[0]);
          return { ...r, score, coreHit };
        })
        .filter((r) => (tokens.length === 0 ? true : r.score >= minScore))
        // В мягком режиме ядро названия обязательно: без него совпадение
        // случайное (например, «Crown» из «Crown Plaza»).
        .filter((r) => (relaxed ? r.coreHit : true))
        .sort((a, b) => {
          if (relaxed && a.coreHit !== b.coreHit) return a.coreHit ? -1 : 1;
          return (b.image.includes("/photo-o/") ? 1 : 0) - (a.image.includes("/photo-o/") ? 1 : 0);
        });

      for (const best of candidates) {
        const withSize = upgradePhotoUrl(best.image);
        if (pickPhotoUrl(withSize)) return withSize;
      }
    }
  }
  return null;
}

/**
 * Anextour hotel page fallback. Anextour embeds its own lodging gallery
 * (i.travelapi.com) on /hotel/<hotelKey>; use the first validated image when
 * the Tripadvisor CDN search has no result for this hotel.
 */
async function anexHotelPhotoUrl(hotelKey: string): Promise<string | null> {
  if (!hotelKey) return null;
  // Do NOT send an explicit Accept header: agent.anextour.ru serves a reduced
  // bot page (no gallery) when Accept is present, but the normal SSR page with
  // the travelapi gallery when only the browser UA is sent.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(
      `https://agent.anextour.ru/hotel/${encodeURIComponent(hotelKey)}`,
      { headers: { "User-Agent": UA }, signal: ctrl.signal, redirect: "follow" },
    );
    if (!resp.ok) return null;
    const body = await resp.text();
    const direct = body.match(
      /https:\/\/i\.travelapi\.com\/lodging\/[^"'\\\s<>]+?\.(?:jpg|jpeg|webp|png)(?:\?[^"'\\\s<>]*)?/i,
    );
    if (direct?.[0]) return direct[0];
    // Georgia/other Anextour hotel pages serve the gallery from
    // files.anextour.com (the travelapi CDN is absent there).
    const gallery = body.match(
      /https:\/\/files\.anextour\.com\/Content\/uploads\/images\/b2c\/galleries\/[^"'\\\s<>]+?\.(?:jpg|jpeg|webp|png)(?:\?[^"'\\\s<>]*)?/i,
    );
    // Shared generic gallery asset used by Anextour for hotels without their
    // own gallery; do not stamp it onto unrelated hotels.
    const GENERIC_GALLERY = /\/galleries\/20191217_150418_6a9f423b-6721-42dc-9f3b-82b695872740\.(?:png|jpg|jpeg|webp)(?:\?|$)/i;
    if (gallery?.[0] && !GENERIC_GALLERY.test(gallery[0])) return gallery[0];
    // Anextour's SSR payload carries hotel-specific room photos under
    // files.anextour.ru/hotel/<country>/hotel/<slug>/room/.../<id>. These are
    // unique per hotel and are the reliable fallback when the page's
    // "galleries" block is a shared generic banner (observed for 249 Egypt
    // hotels, all pointing at the same 20191217… placeholder).
    const roomPhoto = body.match(
      /https:\/\/files\.anextour\.(?:ru|com)\/hotel\/[^"'\\\s<>]+\/room\/[^"'\\\s<>]+?\/\d+/i,
    );
    return roomPhoto?.[0] ?? null;
  } finally {
    clearTimeout(timer);
  }
}

/** Скачивает оригинал CDN (в память) — 200 + image/*, не мельче 5 КБ. */
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const resp = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const mime = (resp.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!/^image\//.test(mime)) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    return buf.length >= 5_000 ? buf : null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const opts = parseArgs();
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const sharp = (await import("sharp")).default;

  const envPath = path.resolve(__dirname, "../.env");
  if (!process.env.DATABASE_URL && fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"]*)"?\s*$/);
      if (m) process.env.DATABASE_URL = m[1];
    }
  }
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
  const prisma = new PrismaClient({ adapter });

  try {
    if (opts.report) {
      const [total, withFile, ok, failed, none] = await Promise.all([
        prisma.hotel.count(),
        prisma.hotel.count({ where: { NOT: { photoFile: null } } }),
        prisma.hotel.count({ where: { photoStatus: "OK" } }),
        prisma.hotel.count({ where: { photoStatus: "FAILED" } }),
        prisma.hotel.count({ where: { photoStatus: "NONE" } }),
      ]);
      console.log(JSON.stringify({ total, withFile, ok, failed, none }, null, 2));
      return;
    }

    let tasks = (await prisma.hotel.findMany({
      where: { photoStatus: { in: opts.statuses } },
      select: {
        id: true,
        name: true,
        normalizedName: true,
        cityName: true,
        countryName: true,
        countryCode: true,
        refs: { select: { name: true, cityName: true, countryCode: true, supplierCode: true, externalKey: true } },
      },
      orderBy: { name: "asc" },
    })) as HotelTask[];

    if (opts.supplier) {
      tasks = tasks.filter((h) => h.refs.some((r) => r.supplierCode === opts.supplier));
    }

    if (opts.idsFile) {
      const raw = fs.readFileSync(path.resolve(opts.idsFile), "utf8");
      const ids = new Set(
        raw.split(/[\r\n,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean),
      );
      tasks = tasks.filter((h) => ids.has(h.id.toLowerCase()));
    }

    if (opts.only.length > 0) {
      const wanted = opts.only.map((s) => s.toLowerCase());
      tasks = tasks.filter(
        (h) => wanted.includes(h.id.toLowerCase()) || wanted.some((w) => h.name.toLowerCase().includes(w)),
      );
    }

    // Пропускаем готовые (файл на диске) — если не --force.
    if (!opts.force) {
      tasks = tasks.filter((h) => !fs.existsSync(path.join(OUTPUT_DIR, photoFileName(h.id))));
    }
    tasks = tasks.slice(0, opts.limit);

    console.log(`hotels to process: ${tasks.length} (statuses=${opts.statuses.join(",")}, force=${opts.force})`);
    if (tasks.length === 0) return;

    if (opts.dryRun) {
      for (const h of tasks) console.log(`  would fetch: ${h.id}  ${h.name} (${h.countryCode} ${h.cityName})`);
      return;
    }

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    let saved = 0;
    let missed = 0;

    const processOne = async (h: HotelTask): Promise<void> => {
      // Для поиска берём самое «латинское» имя рефа: у KOMPAS в справочнике
      // поставщика label может быть на русском, а в продукте — на английском.
      const ref = h.refs.find((r) => /[a-zA-Z]/.test(r.name)) ?? h.refs[0];
      const name = (ref?.name || h.name)
        .replace(/[,\s]+$/, "")
        // «… 4*+», «… 5 *» — хвост звёздности мешает поиску.
        .replace(/\s*\d*\s*\*+\s*\+?\s*$/, "")
        .trim();
      // Имя для поиска: убираем скобочные пометки («(ex. …)», «(Город)»),
      // хвостовую звёздность с суффиксом («5*lux») и пунктуацию — они уводят
      // поиск в ноль и мешают проверке совпадения.
      const searchName = name
        .replace(/\([^()]*\)/g, " ")
        .replace(/\s*\d*\s*\*+\s*\w*\s*$/, "")
        .replace(/[.,;:]+\s*$/, "")
        .replace(/\s+/g, " ")
        .trim();
      const city = ref?.cityName || h.cityName;
      const country = h.countryName;
      const countryCode = ref?.countryCode || h.countryCode;
      if (!name) {
        missed += 1;
        await prisma.hotel.update({
          where: { id: h.id },
          data: { photoStatus: "FAILED", photoUpdatedAt: new Date() },
        });
        journal({ hotelId: h.id, name: h.name, result: "no-name" });
        console.log(`NONAME ${h.id} ${h.name}`);
        return;
      }

      // Фото уже есть у отеля с тем же названием и страной: поставщики пишут
      // город по-разному («Северный Мале Атолл» / «North Male' Atoll»), из-за
      // чего в реестре появляется вторая запись той же гостиницы. Переиспользуем
      // готовый файл — не качаем заново и не плодим копии.
      const sibling = await prisma.hotel.findFirst({
        where: {
          id: { not: h.id },
          normalizedName: h.normalizedName,
          countryCode: h.countryCode,
          NOT: { photoFile: null },
        },
        orderBy: { photoUpdatedAt: "desc" },
        select: {
          photoFile: true,
          photoSource: true,
          photoSourceUrl: true,
          photoWidth: true,
          photoHeight: true,
          photoBytes: true,
        },
      });
      if (sibling?.photoFile && fs.existsSync(path.join(OUTPUT_DIR, sibling.photoFile))) {
        await prisma.hotel.update({
          where: { id: h.id },
          data: {
            photoFile: sibling.photoFile,
            photoStatus: "OK",
            photoSource: sibling.photoSource ?? "tripadvisor",
            photoSourceUrl: sibling.photoSourceUrl,
            photoWidth: sibling.photoWidth,
            photoHeight: sibling.photoHeight,
            photoBytes: sibling.photoBytes,
            photoUpdatedAt: new Date(),
          },
        });
        saved += 1;
        journal({
          hotelId: h.id,
          name: h.name,
          file: sibling.photoFile,
          sourceUrl: sibling.photoSourceUrl,
          result: "reused",
        });
        console.log(`REUSE  ${h.id}  ${sibling.photoFile}  (${h.name})`);
        return;
      }

      const query = [searchName || name, city, country || countryCode].filter(Boolean).join(" ");
      let sourceUrl: string | null = null;
      let photoSource: "tripadvisor" | "anextour" = "tripadvisor";
      const anexRef = h.refs.find((r) => r.supplierCode === "ANEX");
      if (anexRef) {
        // ANEX policy: take the exact hotel gallery from Anextour first.
        // Tripadvisor CDN remains a fallback when the supplier page has no
        // usable gallery.
        sourceUrl = await anexHotelPhotoUrl(anexRef.externalKey);
        if (sourceUrl) photoSource = "anextour";
      }
      if (!sourceUrl) {
        sourceUrl = await searchHotelPhoto(query, searchName || name, opts.relaxed);
      }
      // Never reuse one photo URL for two different physical hotels: image
      // search sometimes returns a generic overview/placeholder for several
      // properties. Same normalized name + country is handled by the sibling
      // reuse above; different names must not share a URL.
      if (sourceUrl) {
        const usedByOther = await prisma.hotel.findFirst({
          where: {
            id: { not: h.id },
            photoSourceUrl: sourceUrl,
            normalizedName: { not: h.normalizedName },
          },
          select: { id: true },
        });
        if (usedByOther) {
          journal({
            hotelId: h.id,
            name,
            query,
            sourceUrl,
            result: "duplicate-photo",
          });
          console.log(`DUPE   ${h.id}  ${sourceUrl.slice(0, 90)}  (${h.name})`);
          sourceUrl = null;
        }
      }
      if (!sourceUrl) {
        missed += 1;
        await prisma.hotel.update({
          where: { id: h.id },
          data: { photoStatus: "FAILED", photoUpdatedAt: new Date() },
        });
        journal({ hotelId: h.id, name, query, result: "not-found" });
        console.log(`MISS   ${h.id}  ${query}`);
        return;
      }

      const original = await downloadImage(sourceUrl);
      if (!original) {
        missed += 1;
        await prisma.hotel.update({
          where: { id: h.id },
          data: { photoStatus: "FAILED", photoUpdatedAt: new Date() },
        });
        journal({ hotelId: h.id, name, query, sourceUrl, result: "download-failed" });
        console.log(`DLFAIL ${h.id}  ${sourceUrl.slice(0, 90)}`);
        return;
      }

      // Конвертация в WebP + валидация целостности/размера.
      let converted: Buffer;
      let width = 0;
      let height = 0;
      try {
        const pipeline = sharp(original, { failOn: "error" }).rotate();
        const meta = await pipeline.metadata();
        const resized = pipeline.resize({ width: opts.width, withoutEnlargement: true });
        converted = await resized.webp({ quality: opts.quality }).toBuffer();
        const outMeta = await sharp(converted).metadata();
        width = outMeta.width ?? meta.width ?? 0;
        height = outMeta.height ?? meta.height ?? 0;
      } catch (err) {
        missed += 1;
        await prisma.hotel.update({
          where: { id: h.id },
          data: { photoStatus: "FAILED", photoUpdatedAt: new Date() },
        });
        journal({ hotelId: h.id, name, sourceUrl, result: "invalid-image", error: (err as Error).message });
        console.log(`BADIMG ${h.id}  ${(err as Error).message}`);
        return;
      }

      if (converted.length < 5_000 || width < 400 || height < 300) {
        missed += 1;
        await prisma.hotel.update({
          where: { id: h.id },
          data: { photoStatus: "FAILED", photoUpdatedAt: new Date() },
        });
        journal({ hotelId: h.id, name, sourceUrl, result: "too-small", bytes: converted.length, width, height });
        console.log(`SMALL  ${h.id}  ${width}x${height} ${converted.length}B`);
        return;
      }

      const fileName = photoFileName(h.id);
      const dest = path.join(OUTPUT_DIR, fileName);
      // Атомарная запись: сначала tmp рядом, потом rename — оборванный запуск не
      // оставит половинчатый файл под рабочим именем.
      const tmp = `${dest}.tmp-${process.pid}`;
      fs.writeFileSync(tmp, converted);
      fs.renameSync(tmp, dest);

      await prisma.hotel.update({
        where: { id: h.id },
        data: {
          photoFile: fileName,
          photoStatus: "OK",
          photoSource,
          photoSourceUrl: sourceUrl,
          photoWidth: width,
          photoHeight: height,
          photoBytes: converted.length,
          photoUpdatedAt: new Date(),
        },
      });
      saved += 1;
      journal({
        hotelId: h.id,
        name,
        query,
        sourceUrl,
        source: photoSource,
        file: fileName,
        bytes: converted.length,
        width,
        height,
        relaxed: opts.relaxed,
        result: "ok",
      });
      console.log(`OK     ${fileName}  ${width}x${height}  (${name})`);
    };

    const queue = [...tasks];
    const worker = async (): Promise<void> => {
      for (;;) {
        const task = queue.shift();
        if (!task) return;
        try {
          await processOne(task);
        } catch (err) {
          journal({ hotelId: task.id, name: task.name, result: "error", error: (err as Error).message });
          console.log(`ERR    ${task.id}  ${(err as Error).message}`);
        }
        await new Promise((r) => setTimeout(r, 2_000));
      }
    };
    await Promise.all(Array.from({ length: opts.concurrency }, () => worker()));

    console.log(`\nDone: saved=${saved} missed=${missed} total=${tasks.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
