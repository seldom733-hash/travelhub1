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
  statuses: PhotoStatus[];
  force: boolean;
  dryRun: boolean;
  report: boolean;
  width: number;
  quality: number;
  concurrency: number;
}

interface HotelTask {
  id: string;
  name: string;
  cityName: string;
  countryName: string;
  countryCode: string;
  refs: Array<{ name: string; cityName: string; countryCode: string }>;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const opts: CliOptions = {
    limit: 25,
    only: [],
    statuses: ["NONE", "FAILED"],
    force: false,
    dryRun: false,
    report: false,
    width: 1200,
    quality: 82,
    concurrency: DEFAULT_CONCURRENCY,
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
    const st = a.match(/^--status=([A-Z,]+)$/);
    if (st) opts.statuses = st[1].split(",").map((s) => s.trim()) as PhotoStatus[];
    if (a === "--force") opts.force = true;
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

/** Поиск CDN-фото отеля через Bing Images (plain GET, без браузера). */
async function searchHotelPhoto(query: string): Promise<string | null> {
  const q = encodeURIComponent(`${query} tripadvisor`.trim());
  const { status, body } = await httpGet(`https://www.bing.com/images/search?q=${q}&qft=+filterui%3aphoto-photo`);
  if (status !== 200) return null;
  const murls = [...body.matchAll(/&quot;murl&quot;:&quot;(.*?)&quot;/g)].map((m) =>
    m[1].replace(/&amp;/g, "&"),
  );
  const ta = murls.filter((u) => /(?:media-cdn|dynamic-media-cdn)\.tripadvisor\.com/.test(u));
  const ranked = ta
    .filter((u) => !/default-avatar|user_photo/i.test(u))
    .sort((a, b) => (b.includes("/photo-o/") ? 1 : 0) - (a.includes("/photo-o/") ? 1 : 0));
  for (const raw of ranked) {
    const upgraded = raw.includes("/photo-o/") ? raw : raw.replace(/\/photo-[a-z]\//, "/photo-o/");
    const withSize = upgraded.includes("?")
      ? upgraded.replace(/w=\d+/, "w=1200").replace(/h=\d+/, "h=-1")
      : `${upgraded}?w=1200&h=-1&s=1`;
    if (pickPhotoUrl(withSize)) return withSize;
  }
  return null;
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
        cityName: true,
        countryName: true,
        countryCode: true,
        refs: { select: { name: true, cityName: true, countryCode: true } },
      },
      orderBy: { name: "asc" },
    })) as HotelTask[];

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
      const name = (ref?.name || h.name).replace(/[,\s]+$/, "");
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

      const query = [name, city, country || countryCode].filter(Boolean).join(" ");
      const sourceUrl = await searchHotelPhoto(query);
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
          photoSource: "tripadvisor",
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
        file: fileName,
        bytes: converted.length,
        width,
        height,
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
