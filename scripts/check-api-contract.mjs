#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scripts/check-api-contract.mjs
//
// Monorepo 根级别 API 契约门禁。校验三个 web sub-app 与共享 api-client 里所有
// apiFetch(...) URL 是否在 specs/openapi.yaml 中有对应 path 定义。drift 即报错。
//
// 同源策略与 apps/web/scripts/check-api-contract.mjs 一致（legacy 版只覆盖 apps/web，
// 待 Phase 5 删 apps/web 后该 legacy 脚本可一并删除）。
//
// 用法：
//   node scripts/check-api-contract.mjs           strict（drift 即 exit 1）
//   node scripts/check-api-contract.mjs --warn    warn-only（drift 仍打印，但 exit 0）
//   pnpm check:api-contract                       （从仓库根；当前 package.json 走 --warn，
//                                                  待 specs/openapi.yaml 补齐 Script/PublishJob/
//                                                  finance/drama 缺失路径后改 strict）
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const OPENAPI_PATH = join(REPO_ROOT, "specs/openapi.yaml");
const WARN_ONLY = process.argv.includes("--warn");

const SOURCES = [
  { label: "web-music", dir: "apps/web-music/src/api" },
  { label: "web-drama", dir: "apps/web-drama/src/api" },
  { label: "web-celebrity", dir: "apps/web-celebrity/src/api" },
  { label: "api-client", dir: "packages/api-client/src/api" },
];

// ── 1. 提取 apiFetch URL ────────────────────────────────────────────────────

/**
 * 把 `${var}` / 查询串归一化为 OpenAPI path 形态：
 *   /products/${id}              → /products/{id}
 *   /celebrity/stars${suffix}    → /celebrity/stars
 *   /celebrity/showcases?mode=x  → /celebrity/showcases
 *   /me/songs/${encodeURIComponent(id)} → /me/songs/{id}
 */
function normalizeUrl(raw) {
  let s = raw;
  s = s.replace(/\?.*$/, "");
  s = s.replace(/\$\{suffix\}/g, "");
  s = s.replace(/\$\{qs\}/g, "");
  s = s.replace(/\$\{encodeURIComponent\(([^)]+)\)\}/g, (_, v) => `{${v.trim()}}`);
  s = s.replace(/\$\{([^}]+)\}/g, (_, expr) => {
    const m = expr.match(/[a-zA-Z_][a-zA-Z0-9_]*/);
    return m ? `{${m[0]}}` : "{var}";
  });
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

function listTsFiles(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(dir, f))
    .filter((p) => statSync(p).isFile());
}

function extractApiFetchUrls() {
  const calls = []; // { source, file, url }
  for (const src of SOURCES) {
    const abs = join(REPO_ROOT, src.dir);
    if (!existsSync(abs)) {
      console.warn(`[skip] ${src.label}: ${src.dir} not found`);
      continue;
    }
    for (const file of listTsFiles(abs)) {
      const text = readFileSync(file, "utf8");
      const re = /apiFetch[^(]*\(\s*[`"]([^`"]+)[`"]/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        calls.push({
          source: src.label,
          file: file.replace(REPO_ROOT + "/", ""),
          url: m[1],
        });
      }
    }
  }
  return calls;
}

// ── 2. 提取 openapi.yaml path 集合 ──────────────────────────────────────────

function extractOpenapiPaths() {
  const yaml = readFileSync(OPENAPI_PATH, "utf8");
  const paths = new Set();
  const deprecated = new Set();
  let inPaths = false;
  let currentPath = null;
  const lines = yaml.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    if (!inPaths) continue;
    const pathMatch = line.match(/^  (\/[^:\s]+):/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      paths.add(currentPath);
      if (/deprecated:\s*true/.test(line)) deprecated.add(currentPath);
      continue;
    }
    if (currentPath && /^\s+deprecated:\s*true/.test(line)) {
      deprecated.add(currentPath);
    }
  }
  return { paths, deprecated };
}

// ── 3. 比对 ─────────────────────────────────────────────────────────────────

function pathMatches(callUrl, openapiPaths) {
  if (openapiPaths.has(callUrl)) return callUrl;
  for (const p of openapiPaths) {
    if (!p.includes("{")) continue;
    const re = new RegExp(
      "^" +
        p.replace(/\{[^}]+\}/g, "[^/]+").replace(/\//g, "\\/") +
        "$",
    );
    if (re.test(callUrl)) return p;
  }
  return null;
}

function main() {
  const calls = extractApiFetchUrls();
  const { paths: openapiPaths, deprecated } = extractOpenapiPaths();

  const missingBySource = new Map(); // source -> [{ file, url, normalized }]
  const callDestinations = new Map(); // openapi path -> Set<file>
  for (const c of calls) {
    const norm = normalizeUrl(c.url);
    const hit = pathMatches(norm, openapiPaths);
    if (!hit) {
      if (!missingBySource.has(c.source)) missingBySource.set(c.source, []);
      missingBySource.get(c.source).push({ file: c.file, url: c.url, normalized: norm });
    } else {
      if (!callDestinations.has(hit)) callDestinations.set(hit, new Set());
      callDestinations.get(hit).add(c.file);
    }
  }
  const orphanedInOpenapi = [];
  for (const p of openapiPaths) {
    if (!callDestinations.has(p)) orphanedInOpenapi.push(p);
  }

  // ── 输出 ──
  const totalMissing = [...missingBySource.values()].reduce((n, arr) => n + arr.length, 0);
  console.log("─".repeat(72));
  console.log(`API contract check`);
  const bySource = new Map();
  for (const c of calls) bySource.set(c.source, (bySource.get(c.source) ?? 0) + 1);
  for (const src of SOURCES) {
    const n = bySource.get(src.label) ?? 0;
    console.log(`  ${src.label.padEnd(13)} : ${n} apiFetch call sites`);
  }
  console.log(
    `  specs/openapi.yaml : ${openapiPaths.size} paths (${deprecated.size} deprecated)`,
  );
  console.log("─".repeat(72));

  if (totalMissing > 0) {
    console.log(
      `\n❌  MISSING in openapi.yaml (${totalMissing} URL${totalMissing === 1 ? "" : "s"} called by code but not declared in spec):`,
    );
    for (const src of SOURCES) {
      const items = missingBySource.get(src.label);
      if (!items || items.length === 0) continue;
      console.log(`\n  [${src.label}] ${items.length}:`);
      for (const m of items) {
        console.log(`     ${m.normalized}`);
        console.log(`         called from ${m.file}`);
      }
    }
  } else {
    console.log("\n✓  Every apiFetch URL has a matching openapi path.");
  }

  if (orphanedInOpenapi.length > 0) {
    console.log(
      `\n⚠  Orphaned in openapi.yaml (${orphanedInOpenapi.length} path${orphanedInOpenapi.length === 1 ? "" : "s"} the front-end never calls — may be public API or future work):`,
    );
    for (const p of orphanedInOpenapi.slice(0, 30).sort()) {
      const tag = deprecated.has(p) ? " [deprecated]" : "";
      console.log(`     ${p}${tag}`);
    }
    if (orphanedInOpenapi.length > 30) {
      console.log(`     … ${orphanedInOpenapi.length - 30} more`);
    }
  }

  console.log();
  if (totalMissing > 0) {
    const tag = WARN_ONLY ? "WARN" : "FAIL";
    const msg = `${tag}: ${totalMissing} apiFetch URL(s) missing from openapi.yaml. ` +
        `Add the path/schema to specs/openapi.yaml (and the corresponding TS types in packages/types/).`;
    if (WARN_ONLY) {
      console.warn(msg + " (running with --warn; not blocking)");
      return;
    }
    console.error(msg);
    process.exit(1);
  }
  console.log("OK.");
}

main();
