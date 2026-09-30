/**
 * Hotel photo downloader CLI:
 *   cd backend && npx tsx scripts/fetch-hotel-photos.ts [--limit=N] [--only=slug,...] [--dry-run]
 *
 * Скачивает фото отелей с tripadvisor.ru для витрины туров и сохраняет в
 * frontend/public/hotels/<tourinc>-<hotelKey>.jpg (или .png, если Tripadvisor
 * отдал PNG). Имя файла — по явному требованию заказчика.
 *
 * Источник пар: catalog.Product (type=TOUR, поставщики KOMPAS/KAZUNION/SUMMERTOUR).
 * tourinc/hotelKey извлекаются из slug продукта (`<supplier>-<tourinc>-<hotelKey>…`);
 * для поиска используется attributes.hotelName + country.
 *
 * Архитектура (проверено live) — ПОЛНОСТЬЮ БЕЗ БРАУЗЕРА:
 *  - HTML tripadvisor.* закрыт DataDome (403 даже для curl/CDP-Chrome),
 *    но CDN картинок (media-cdn / dynamic-media-cdn.tripadvisor.com) ОТКРЫТ.
 *  - Bing Images (plain GET) в метаданных murl отдаёт ПРЯМЫЕ CDN-URL фото
 *    отеля. Brave Search тоже работал, но жёстко лимитирует (429). Ничего не
 *    открывается на машине — только HTTP-запросы к Bing и CDN.
 */
import * as fs from "fs";
import * as path from "path";

// __dirname при tsx = backend/scripts → две ступени вверх до корня проекта.
const OUTPUT_DIR = path.resolve(__dirname, "../../frontend/public/hotels");
// Bing Images устойчив к частым запросам — 2 воркера безопасно.
const CONCURRENCY = 2;
const FETCH_TIMEOUT_MS = 30_000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface ProductPair {
  slug: string;
  tourInc: string;
  hotelKey: string;
  hotelName: string;
  country: string | null;
}

function parseArgs(): { limit: number; only: Set<string>; dryRun: boolean } {
  const args = process.argv.slice(2);
  let limit = 25;
  const only = new Set<string>();
  let dryRun = false;
  for (const a of args) {
    const m = a.match(/^--limit=(\d+)$/);
    if (m) limit = parseInt(m[1], 10);
    const o = a.match(/^--only=(.+)$/);
    if (o) o[1].split(",").forEach((s) => only.add(s.trim()));
    if (a === "--dry-run") dryRun = true;
  }
  return { limit, only, dryRun };
}

async function loadPairs(): Promise<ProductPair[]> {
  // Prisma client standalone — без поднятия Nest-контекста (быстрее и без DI-проблем tsx).
  // Путь src/generated/prisma/client — custom output из schema.prisma (@prisma/client default не сгенерирован).
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/travelhub1" });
  const prisma = new PrismaClient({ adapter });
  try {
    const rows = await prisma.$queryRaw<
      Array<{ slug: string; attributes: Record<string, unknown> | null }>
    >`
      SELECT "slug", "attributes"
      FROM "catalog"."Product"
      WHERE "type" = 'TOUR'::"catalog"."ProductType"
        AND "slug" ~ '^[a-z]+-[0-9]+-[0-9]+'
    `;
    const pairs: ProductPair[] = [];
    for (const row of rows) {
      const m = row.slug.match(/^[a-z]+-(\d+)-(\d+)/);
      if (!m) continue;
      const attrs = (row.attributes ?? {}) as Record<string, unknown>;
      pairs.push({
        slug: row.slug,
        tourInc: m[1],
        hotelKey: m[2],
        // Ключ отеля может лежать под hotelName (новые синки) или hotel (summer-синк).
        hotelName: ((attrs.hotelName as string) ?? (attrs.hotel as string) ?? "")
          .replace(/\s*\(.*?\)\s*$/, "") // «ALAIYE KLEOPATRA 4* (Аланья)» → без города
          .replace(/\d\s*\*+\s*$/, "") // хвост «4*» мешает поиску
          .trim(),
        country: (attrs.country as string) ?? null,
      });
    }
    return pairs;
  } finally {
    await prisma.$disconnect();
  }
}

/** Валидация CDN-URL фото: только tripadvisor photo-*, не мелкие аватары. */
function pickPhotoUrl(src: string): string | null {
  if (!src || !/^https?:\/\//.test(src)) return null;
  if (!/\/photo-[a-z]\//.test(src)) return null;
  if (/default-avatar|user_photo/i.test(src)) return null;
  return src;
}

/** Общий plain-GET (без браузера). */
async function httpGet(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<{ status: number; body: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    return { status: resp.status, body: await resp.text() };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Поиск CDN-фото отеля через Bing Images (plain GET, БЕЗ браузера, устойчив к
 * частым запросам — проверено live, в отличие от Brave с его 429).
 * В выдаче есть поле murl — исходный URL картинки; фильтруем tripadvisor CDN.
 * Возвращаем первую крупную photo-o/… ссылку (мелкие размеры поднимаем до photo-o).
 */
async function searchHotelPhoto(pair: ProductPair): Promise<string | null> {
  const q = encodeURIComponent(`${pair.hotelName} ${pair.country ?? ""} tripadvisor`.trim());
  const { status, body } = await httpGet(
    `https://www.bing.com/images/search?q=${q}&qft=+filterui%3aphoto-photo`,
  );
  if (status !== 200) {
    console.log(`BING ${status} ${pair.hotelName}`);
    return null;
  }
  // murl — исходный URL изображения в метаданных Bing (HTML-escaped).
  const murls = [...body.matchAll(/&quot;murl&quot;:&quot;(.*?)&quot;/g)].map(
    (m) => m[1].replace(/&amp;/g, "&"),
  );
  const ta = murls.filter((u) => /(?:media-cdn|dynamic-media-cdn)\.tripadvisor\.com/.test(u));
  // Приоритет photo-o (оригинал); аватары/иконки отсекаем.
  const ranked = ta
    .filter((u) => !/default-avatar|user_photo/i.test(u))
    .sort((a, b) => (b.includes("/photo-o/") ? 1 : 0) - (a.includes("/photo-o/") ? 1 : 0));
  for (const raw of ranked) {
    const upgraded = raw.includes("/photo-o/")
      ? raw
      : raw.replace(/\/photo-[a-z]\//, "/photo-o/");
    const withSize = upgraded.includes("?")
      ? upgraded.replace(/w=\d+/, "w=1200").replace(/h=\d+/, "h=-1")
      : `${upgraded}?w=1200&h=-1&s=1`;
    if (pickPhotoUrl(withSize)) return withSize;
  }
  return null;
}

/** Скачивает файл по URL (plain GET, без браузера). */
async function downloadTo(
  url: string,
  destBase: string,
): Promise<{ file: string; mime: string } | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const resp = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const mime = (resp.headers.get("content-type") ?? "").split(";")[0].trim();
    const ext = mime === "image/png" ? "png" : mime === "image/jpeg" || mime === "image/jpg" ? "jpg" : null;
    if (!ext) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length < 5_000) return null; // пиксели/заглушки
    const file = `${destBase}.${ext}`;
    fs.writeFileSync(file, buf);
    return { file, mime };
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const { limit, only, dryRun } = parseArgs();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let pairs = await loadPairs();
  if (only.size > 0) pairs = pairs.filter((p) => only.has(p.slug));
  // Не перекачиваем: пропускаем пары, у которых уже есть файл.
  pairs = pairs.filter(
    (p) =>
      !fs.existsSync(path.join(OUTPUT_DIR, `${p.tourInc}-${p.hotelKey}.jpg`)) &&
      !fs.existsSync(path.join(OUTPUT_DIR, `${p.tourInc}-${p.hotelKey}.png`)),
  );
  pairs = pairs.slice(0, limit);

  if (pairs.length === 0) {
    console.log("Nothing to do: all photos already downloaded (or no products matched).");
    return;
  }

  if (dryRun) {
    console.log(`Would fetch ${pairs.length} photos:`);
    for (const p of pairs) console.log(`  ${p.tourInc}-${p.hotelKey}  ${p.hotelName} (${p.country ?? "?"}) [${p.slug}]`);
    return;
  }

  // Полностью без браузера: Brave Search (plain GET) → CDN tripadvisor (plain GET).
  let downloaded = 0;
  let failed = 0;

  async function worker(queue: ProductPair[]) {
    for (;;) {
      const pair = queue.shift();
      if (!pair) return;
      if (!pair.hotelName) { failed++; continue; }
      try {
        const photoUrl = await searchHotelPhoto(pair);
        if (!photoUrl) { failed++; console.log(`MISS  ${pair.tourInc}-${pair.hotelKey}  ${pair.hotelName}`); continue; }
        const base = path.join(OUTPUT_DIR, `${pair.tourInc}-${pair.hotelKey}`);
        const saved = await downloadTo(photoUrl, base);
        if (saved) {
          downloaded++;
          console.log(`OK    ${path.basename(saved.file)}  (${saved.mime}, ${pair.hotelName})`);
        } else {
          failed++;
          console.log(`DLFAIL ${pair.tourInc}-${pair.hotelKey}  ${photoUrl.slice(0, 90)}`);
        }
      } catch (err) {
        failed++;
        console.log(`ERR   ${pair.tourInc}-${pair.hotelKey}  ${(err as Error).message}`);
      }
      // Небольшая пауза между поисками (вежливость к Bing).
      await new Promise((r) => setTimeout(r, 2_000));
    }
  }

  const queue = [...pairs];
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

  console.log(`\nDone: downloaded=${downloaded} failed=${failed} total=${pairs.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
