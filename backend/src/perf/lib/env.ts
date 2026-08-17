/**
 * Step 2.17B — environment metadata.
 *
 * Every run must emit machine-readable environment metadata (Node/PostgreSQL
 * versions, OS, CPU/memory, git SHA/branch/dirty, DB classification, tool
 * version, worker config). Results without environment metadata are
 * non-portable evidence. Secrets are scrubbed before serialization.
 */

import { execSync } from "child_process";
import os from "os";
import { extractDbHost, extractDbName } from "./guard";

export interface EnvMetadata {
  runId: string;
  timestamp: string;
  gitSha: string;
  branch: string;
  dirtyWorktree: boolean;
  nodeVersion: string;
  platform: string;
  arch: string;
  cpus: number;
  cpuModel: string;
  totalMemMb: number;
  postgresVersion: string;
  dbName: string | null;
  dbHostClass: string;
  baseUrl: string;
  profile: string;
  seed: number;
  datasetClass: string;
  appInstances: number;
  workerInstances: number;
  toolName: string;
  toolVersion: string;
  loggingMode: string;
  workerIntervalMs: number;
  workerBatch: number;
  requestTimeoutMs: number;
}

function git(cmd: string, fallback: string): string {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || fallback;
  } catch {
    return fallback;
  }
}

export interface EnvOptions {
  runId: string;
  dbUrl?: string;
  baseUrl: string;
  profile: string;
  seed: number;
  datasetClass: string;
  appInstances: number;
  workerInstances: number;
  postgresVersion: string;
  requestTimeoutMs: number;
}

export function collectEnv(opts: EnvOptions): EnvMetadata {
  const dbName = opts.dbUrl ? extractDbName(opts.dbUrl) : null;
  const host = opts.dbUrl ? extractDbHost(opts.dbUrl) : null;
  const dbHostClass = !host ? "unknown" : host === "localhost" || host === "127.0.0.1" || host === "::1" ? "local" : "non-local";
  return {
    runId: opts.runId,
    timestamp: new Date().toISOString(),
    gitSha: git("git rev-parse HEAD", "unknown"),
    branch: git("git branch --show-current", "unknown"),
    dirtyWorktree: git("git status --porcelain", "").length > 0,
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model ?? "unknown",
    totalMemMb: Math.round(os.totalmem() / (1024 * 1024)),
    postgresVersion: opts.postgresVersion,
    dbName,
    dbHostClass,
    baseUrl: opts.baseUrl,
    profile: opts.profile,
    seed: opts.seed,
    datasetClass: opts.datasetClass,
    appInstances: opts.appInstances,
    workerInstances: opts.workerInstances,
    toolName: "travelhub-perf-harness",
    toolVersion: "1.0.0",
    loggingMode: String(process.env.LOG_LEVEL ?? "info"),
    // Step 2.17B remediation (Workstream A): default 2000 → 500ms, в синхроне
    // с OutboxWorkerService (OUTBOX_WORKER_INTERVAL_MS ?? 500).
    workerIntervalMs: Number(process.env.OUTBOX_WORKER_INTERVAL_MS ?? 500),
    workerBatch: Number(process.env.OUTBOX_WORKER_BATCH ?? 100),
    requestTimeoutMs: opts.requestTimeoutMs,
  };
}
