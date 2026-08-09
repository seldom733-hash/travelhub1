/**
 * E2E MinIO emulator (Phase 1 Step 1.2).
 *
 * ТЗ §19-20: local/test storage — MinIO (S3-compatible), e2e используют отдельный
 * TEST bucket и никогда не трогают dev/prod bucket.
 *
 * REVIEW FIX #2 (reproducibility): раньше e2e зависели от вручную скопированного
 * `.tools/minio.exe` (`.tools/` в .gitignore → новый checkout/CI не мог запустить
 * media e2e). Теперь бинарь АВТОМАТИЧЕСКИ bootstraps-ится:
 *   - version-pinned MinIO release: MINIO_VERSION (GitHub release asset);
 *   - SHA-256 сверяется с официальным `<asset>.sha256sum` — подмена/битый файл
 *     ОТКЛОНЯЮТСЯ (checksum mismatch = hard fail, без fallback);
 *   - повторные запуски идут из кэша `.tools/minio/<MINIO_VERSION>/` (без сети);
 *   - РУЧНОЕ копирование minio.exe НЕ требуется. Fallback на системный `minio`
 *     допустим ТОЛЬКО при сетевой недоступности (не является требованием).
 *
 * GUARD: bucket жёстко фиксирован `travelhub-media-test` (суффикс `-test`) и
 * никогда не создаётся/не чистится для других имён — dev/prod bucket не
 * затрагивается. Port также изолирован от dev-MinIO (9000).
 */

import { createHash } from "crypto";
import { execSync, spawn, type ChildProcess } from "child_process";
import { chmodSync, createReadStream, createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import * as os from "os";
import * as path from "path";
import { CreateBucketCommand, DeleteBucketCommand, ListBucketsCommand, S3Client } from "@aws-sdk/client-s3";

export const MINIO_TEST_PORT = 19000;
export const MINIO_TEST_BUCKET = "travelhub-media-test";
// Разные access/secret ключи — чтобы тест 24 мог проверить, что secret НЕ
// попадает в signed URL (X-Amz-Credential содержит только access key).
export const MINIO_TEST_ACCESS_KEY = "travelhub-media-access";
export const MINIO_TEST_SECRET_KEY = "travelhub-media-secret-7k";

/**
 * Пиннированный релиз MinIO server (полный GitHub release tag). Верифицирован на
 * windows-amd64 / linux-amd64 / linux-arm64 / darwin-arm64 / darwin-amd64
 * (github.com/minio/minio/releases). Обновлять осознанно: bump = новый артефакт +
 * его .sha256sum проверяется автоматически.
 */
export const MINIO_VERSION = "RELEASE.2025-04-22T22-12-26Z";

const MINIO_BASE_URL = "https://github.com/minio/minio/releases/download";

let proc: ChildProcess | null = null;
let client: S3Client | null = null;
let stderrBuf = "";

/** Артефакт для текущей платформы (имя GitHub-ассета + локальное имя файла). */
function minioArtifact(): { url: string; sha256Url: string; fileName: string } {
  const key = `${process.platform}-${process.arch}`;
  const asset = (() => {
    switch (key) {
      case "win32-x64":
        return `minio.windows-amd64.${MINIO_VERSION}.exe`;
      case "linux-x64":
        return `minio.linux-amd64.${MINIO_VERSION}`;
      case "linux-arm64":
        return `minio.linux-arm64.${MINIO_VERSION}`;
      case "darwin-arm64":
        return `minio.darwin-arm64.${MINIO_VERSION}`;
      case "darwin-x64":
        return `minio.darwin-amd64.${MINIO_VERSION}`;
      default:
        throw new Error(`[e2e] Unsupported platform for pinned MinIO ${MINIO_VERSION}: ${key}`);
    }
  })();
  const fileName = key === "win32-x64" ? "minio.exe" : "minio";
  return {
    url: `${MINIO_BASE_URL}/${MINIO_VERSION}/${asset}`,
    sha256Url: `${MINIO_BASE_URL}/${MINIO_VERSION}/${asset}.sha256sum`,
    fileName,
  };
}

function sha256OfFile(file: string): Promise<string> {
  const hash = createHash("sha256");
  return pipeline(createReadStream(file), hash).then(() => hash.digest("hex"));
}

async function downloadText(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} GET ${url}`);
  return res.text();
}

async function downloadBinary(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} GET ${url}`);
  await pipeline(Readable.fromWeb(res.body as import("stream/web").ReadableStream<Uint8Array>), createWriteStream(dest));
}

/** Только сетевые ошибки подключения (fallback-условие) — не HTTP/checksum ошибки. */
function isNetworkError(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err);
  return /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|getaddrinfo|ECONNRESET/i.test(msg);
}

/**
 * Reproducible bootstrap: скачать version-pinned MinIO binary (если не в кэше),
 * проверить SHA-256 по официальному .sha256sum, вернуть путь к бинарю.
 * Кэш: `.tools/minio/<MINIO_VERSION>/` — gitignored, повторные запуски без сети.
 */
async function ensureMinioBinary(): Promise<string> {
  const { url, sha256Url, fileName } = minioArtifact();
  const cacheDir = path.resolve(__dirname, "..", "..", ".tools", "minio", MINIO_VERSION);
  const binPath = path.join(cacheDir, fileName);
  const marker = `${binPath}.sha256`; // кэшированный expected checksum

  // 1. Уже в кэше и checksum совпадает → reuse (без сети).
  if (existsSync(binPath) && existsSync(marker)) {
    if ((await sha256OfFile(binPath)) === readFileSync(marker, "utf8").trim()) return binPath;
    console.warn(`[e2e] MinIO binary checksum mismatch — re-downloading ${MINIO_VERSION}...`);
    rmSync(binPath, { force: true });
  }

  console.log(`[e2e] Bootstrapping pinned MinIO ${MINIO_VERSION} (${fileName}) → ${cacheDir}`);
  try {
    mkdirSync(cacheDir, { recursive: true });

    // Официальный checksum (первый токен файла = hex).
    const expected = (await downloadText(sha256Url)).split(/\s+/)[0].toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(expected)) {
      throw new Error(`Unexpected sha256sum content from ${sha256Url}`);
    }

    const part = `${binPath}.part`;
    rmSync(part, { force: true });
    await downloadBinary(url, part);
    const actual = await sha256OfFile(part);
    if (actual !== expected) {
      rmSync(part, { force: true });
      throw new Error(`SHA-256 mismatch for ${fileName}: expected ${expected}, got ${actual}`);
    }
    renameSync(part, binPath);
    writeFileSync(marker, expected);
    if (process.platform !== "win32") chmodSync(binPath, 0o755);
    return binPath;
  } catch (err) {
    // Fallback на системный `minio` ТОЛЬКО при сетевой недоступности. HTTP-ошибки и
    // SHA-256 mismatch (целостность артефакта) — всегда hard fail: reproducibility
    // важнее удобства, подменённый/битый бинарь не должен молча заменяться.
    if (!isNetworkError(err)) {
      throw new Error(
        `[e2e] Cannot bootstrap pinned MinIO ${MINIO_VERSION}: ${(err as Error).message}. ` +
          `Verify the artifact at ${MINIO_BASE_URL}/${MINIO_VERSION} — no fallback is used for integrity errors.`,
      );
    }
    try {
      execSync("minio --version", { stdio: "ignore" });
      console.warn(`[e2e] MinIO download failed (network: ${(err as Error).message}); falling back to system "minio".`);
      return "minio";
    } catch {
      throw new Error(
        `[e2e] Cannot bootstrap pinned MinIO ${MINIO_VERSION}: ${(err as Error).message}. ` +
          `First run needs network access to ${MINIO_BASE_URL}; afterwards the binary is cached in .tools/minio/.`,
      );
    }
  }
}

async function waitForReady(): Promise<void> {
  const deadline = Date.now() + 20000;
  const probe = new S3Client({
    region: "us-east-1",
    endpoint: `http://127.0.0.1:${MINIO_TEST_PORT}`,
    forcePathStyle: true,
    credentials: { accessKeyId: MINIO_TEST_ACCESS_KEY, secretAccessKey: MINIO_TEST_SECRET_KEY },
  });
  for (;;) {
    try {
      await probe.send(new ListBucketsCommand({}));
      break;
    } catch {
      if (Date.now() > deadline) throw new Error("[e2e] MinIO did not become ready in 20s");
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  client = probe;
}

/**
 * Убить висящий процесс, слушающий test-порт (Windows: netstat + taskkill).
 * Защита от "orphaned" MinIO после прерванного прогона — иначе следующий run
 * падает на занятом порту (наблюдалось в этой сессии).
 */
function killPortListener(): void {
  if (process.platform !== "win32") return;
  try {
    const out = execSync(`netstat -ano | findstr :${MINIO_TEST_PORT} | findstr LISTENING`, { encoding: "utf8" });
    const pids = new Set<string>();
    for (const line of out.split(/\r?\n/)) {
      const m = line.trim().match(/\s(\d+)\s*$/);
      if (m) pids.add(m[1]);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      } catch {
        // процесс мог уже завершиться — best-effort
      }
    }
  } catch {
    // порт свободен — нечего убивать
  }
}

/** Запустить standalone MinIO + создать ИЗОЛИРОВАННЫЙ test bucket. Идемпотентно. */
export async function startTestMinIO(): Promise<void> {
  if (proc) return;
  killPortListener();
  const binary = await ensureMinioBinary();
  // MinIO (Windows) не понимает backslash-пути из os.tmpdir() — нормализуем в forward slashes.
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "travelhub-minio-")).replace(/\\/g, "/");
  stderrBuf = "";
  proc = spawn(binary, ["server", dataDir, "--address", `127.0.0.1:${MINIO_TEST_PORT}`], {
    env: {
      ...process.env,
      MINIO_ROOT_USER: MINIO_TEST_ACCESS_KEY,
      MINIO_ROOT_PASSWORD: MINIO_TEST_SECRET_KEY,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stderr!.on("data", (d) => {
    stderrBuf += d.toString();
  });
  proc.on("exit", (code) => {
    if (code !== 0 && stderrBuf.length === 0) stderrBuf = `minio exited with code ${code}`;
  });
  try {
    await waitForReady();
  } catch (err) {
    proc.kill();
    proc = null;
    throw new Error(`[e2e] MinIO failed to start: ${(err as Error).message}. MinIO stderr: ${stderrBuf.slice(-400)}`);
  }

  // GUARD: создаём/чистим ТОЛЬКО test bucket.
  if (!MINIO_TEST_BUCKET.endsWith("-test")) {
    throw new Error(`[e2e] Refusing: test bucket "${MINIO_TEST_BUCKET}" must end with "-test"`);
  }
  try {
    await client!.send(new CreateBucketCommand({ Bucket: MINIO_TEST_BUCKET }));
  } catch (err) {
    if ((err as { name?: string }).name !== "BucketAlreadyOwnedByYou" && (err as { name?: string }).name !== "BucketAlreadyExists") {
      throw err;
    }
  }
}

/** Остановить MinIO (best-effort) и удалить test bucket. */
export async function stopTestMinIO(): Promise<void> {
  if (client) {
    try {
      await client.send(new DeleteBucketCommand({ Bucket: MINIO_TEST_BUCKET }));
    } catch {
      // bucket может содержать объекты — best-effort
    }
    client = null;
  }
  if (proc) {
    try {
      proc.kill();
    } catch {
      // best-effort
    }
    proc = null;
  }
}
