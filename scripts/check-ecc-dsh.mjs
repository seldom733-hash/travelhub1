#!/usr/bin/env node
/**
 * Validate the curated ECC -> DSH bridge.
 * Read-only: never installs, executes hooks, or fetches remote code.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = resolve(root, "tools/ecc-dsh/catalog.json");
const errors = [];

const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));

if (catalog.mode !== "curated-skills") {
  errors.push(`mode must be "curated-skills", got ${JSON.stringify(catalog.mode)}`);
}
if (!/^[a-f0-9]{40}$/.test(String(catalog.upstream?.commit ?? ""))) {
  errors.push("upstream.commit must be a pinned 40-character commit SHA");
}
if (!Array.isArray(catalog.skills) || catalog.skills.length === 0) {
  errors.push("skills must be a non-empty array");
}

const forbiddenKeys = ["hooks", "install", "postinstall", "prepare", "mcp", "command"];
const walk = (value, path = "") => {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.includes(key.toLowerCase())) {
      errors.push(`forbidden executable/install field: ${path}${key}`);
    }
    walk(child, `${path}${key}.`);
  }
};
walk(catalog);

for (const skill of catalog.skills ?? []) {
  if (!skill.local || !skill.path) {
    errors.push("each skill needs local + path");
    continue;
  }
  const file = resolve(root, skill.path);
  if (!existsSync(file)) {
    errors.push(`missing skill file: ${skill.path}`);
    continue;
  }
  const text = readFileSync(file, "utf8");
  if (!/^---\r?\n[\s\S]*?name:\s*\S+[\s\S]*?description:\s*\S+/m.test(text)) {
    errors.push(`invalid SKILL.md frontmatter: ${skill.path}`);
  }
  if (!Array.isArray(skill.upstream) || skill.upstream.length === 0) {
    errors.push(`skill ${skill.local} needs upstream mapping`);
  }
}

if (errors.length) {
  console.error("ECC-DSH validation failed:");
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`ECC-DSH OK: ${catalog.skills.length} curated skills @ ${catalog.upstream.commit.slice(0, 8)}`);
