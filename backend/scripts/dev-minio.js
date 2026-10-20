/**
 * Dev MinIO bootstrap — persistent local object storage for media uploads.
 *
 * Downloads the SAME version-pinned MinIO binary the e2e suite uses
 * (test/e2e.minio.ts → MINIO_VERSION), verifies the official SHA-256, caches it
 * in .tools/minio/<version>/ (gitignored) and starts a server on the endpoint
 * configured in backend/.env (S3_ENDPOINT, default http://localhost:9000) with
 * the S3_ACCESS_KEY / S3_SECRET_KEY credentials, creating S3_BUCKET if needed.
 *
 *   node scripts/dev-minio.js          # start (fails loudly)
 *   node scripts/dev-minio.js --soft   # start, warn instead of failing
 *
 * Data lives in backend/data/minio (gitignored, matches the existing
 * `backend/data/` convention), NOT in the OS temp dir, so uploaded logos
 * survive reboots and temp cleanups.
 *
 * Idempotent: reuses the cached binary, reuses a running server, skips bucket
 * creation when the bucket already exists.
 */
const { createHash } = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { S3Client, CreateBucketCommand, ListBucketsCommand } = require('@aws-sdk/client-s3');

const SOFT = process.argv.includes('--soft');
const MINIO_VERSION = 'RELEASE.2025-04-22T22-12-26Z';
const BASE = 'https://github.com/minio/minio/releases/download';
const BACKEND_ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(BACKEND_ROOT, '.tools', 'minio', MINIO_VERSION);
const BIN = path.join(CACHE, 'minio.exe');
const MARKER = `${BIN}.sha256`;
const DATA_DIR = path.join(BACKEND_ROOT, 'data', 'minio');

function loadEnv() {
  const envPath = path.join(BACKEND_ROOT, '.env');
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };
const endpoint = (env.S3_ENDPOINT || 'http://localhost:9000').replace(/\/$/, '');
const bucket = env.S3_BUCKET || 'travelhub-media';
const accessKey = env.S3_ACCESS_KEY || 'minioadmin';
const secretKey = env.S3_SECRET_KEY || 'minioadmin';
const region = env.S3_REGION || 'us-east-1';

const url = new URL(endpoint);
const port = url.port || '9000';
const host = url.hostname;

const sha256 = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');

async function ensureBinary() {
  if (fs.existsSync(BIN) && fs.existsSync(MARKER)) {
    if (sha256(BIN) === fs.readFileSync(MARKER, 'utf8').trim()) {
      console.log(`[dev-minio] cached binary OK → ${BIN}`);
      return;
    }
    console.warn('[dev-minio] checksum mismatch, re-downloading');
    fs.rmSync(BIN, { force: true });
  }

  fs.mkdirSync(CACHE, { recursive: true });
  const asset = `minio.windows-amd64.${MINIO_VERSION}.exe`;
  const binUrl = `${BASE}/${MINIO_VERSION}/${asset}`;
  const shaUrl = `${binUrl}.sha256sum`;

  console.log(`[dev-minio] downloading ${asset} (one-time, ~115 MB) …`);
  const shaRes = await fetch(shaUrl);
  if (!shaRes.ok) throw new Error(`checksum download failed: HTTP ${shaRes.status}`);
  const expected = (await shaRes.text()).split(/\s+/)[0].toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expected)) throw new Error('unexpected sha256sum payload');

  const res = await fetch(binUrl);
  if (!res.ok) throw new Error(`binary download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const actual = createHash('sha256').update(buf).digest('hex');
  if (actual !== expected) throw new Error(`SHA-256 mismatch: expected ${expected}, got ${actual}`);

  fs.writeFileSync(BIN, buf);
  fs.writeFileSync(MARKER, expected);
  console.log(`[dev-minio] downloaded and verified (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}

async function isAlive() {
  try {
    const res = await fetch(`${endpoint}/minio/health/live`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  if (await isAlive()) {
    console.log(`[dev-minio] already running at ${endpoint}`);
  } else {
    await ensureBinary();
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`[dev-minio] starting on ${host}:${port}, data=${DATA_DIR}`);
    const child = spawn(BIN, ['server', DATA_DIR.replace(/\\/g, '/'), '--address', `${host}:${port}`], {
      env: { ...process.env, MINIO_ROOT_USER: accessKey, MINIO_ROOT_PASSWORD: secretKey },
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();

    const deadline = Date.now() + 25000;
    for (;;) {
      if (await isAlive()) break;
      if (Date.now() > deadline) throw new Error('MinIO did not become ready in 25s');
      await new Promise((r) => setTimeout(r, 500));
    }
    console.log('[dev-minio] ready');
  }

  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: (env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });

  const existing = await client.send(new ListBucketsCommand({}));
  const names = (existing.Buckets || []).map((b) => b.Name);
  if (names.includes(bucket)) {
    console.log(`[dev-minio] bucket "${bucket}" already exists`);
  } else {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`[dev-minio] bucket "${bucket}" created`);
  }

  console.log(`[dev-minio] OK — ${endpoint} / bucket=${bucket}`);
}

main().catch((err) => {
  if (SOFT) {
    console.warn(`[dev-minio] WARN: ${err.message}`);
    console.warn('[dev-minio] Media uploads will fail until the storage is running.');
    process.exit(0);
  }
  console.error('[dev-minio] FAILED:', err.message);
  process.exit(1);
});
