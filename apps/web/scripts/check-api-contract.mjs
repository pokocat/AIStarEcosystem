#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// check-api-contract.mjs
//
// 校验 apps/web/src/api/*.ts 中所有 apiFetch(...) URL 是否在 specs/openapi.yaml
// 中有对应的 path 定义。drift 即报错；一份失败的 CI 比一份过期的 diff 文档好用。
//
// 用法：
//   node apps/web/scripts/check-api-contract.mjs
//   npm run check:api-contract        （从 apps/web 目录）
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..", "..");
const API_DIR = join(REPO_ROOT, "apps/web/src/api");
const OPENAPI_PATH = join(REPO_ROOT, "specs/openapi.yaml");

// ── 1. 提取所有 apiFetch URL ────────────────────────────────────────────────

/**
 * 把 `${var}` / 查询串归一化为 OpenAPI path 形态：
 *   /products/${id}              → /products/{id}
 *   /celebrity/stars${suffix}    → /celebrity/stars
 *   /celebrity/showcases?mode=x  → /celebrity/showcases
 *   /me/songs/${encodeURIComponent(id)} → /me/songs/{id}
 */
function normalizeUrl(raw) {
  let s = raw;
  // 砍掉查询串（包含 ${suffix} 这种动态后缀，因为它实际就是 ?xxx）
  s = s.replace(/\?.*$/, "");
  s = s.replace(/\$\{suffix\}/g, "");
  s = s.replace(/\$\{qs\}/g, "");
  // ${encodeURIComponent(name)} → {name}
  s = s.replace(/\$\{encodeURIComponent\(([^)]+)\)\}/g, (_, v) => `{${v.trim()}}`);
  // ${anything} → {anything}（取第一个标识符）
  s = s.replace(/\$\{([^}]+)\}/g, (_, expr) => {
    const m = expr.match(/[a-zA-Z_][a-zA-Z0-9_]*/);
    return m ? `{${m[0]}}` : "{var}";
  });
  // 末尾斜杠归一
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
  const files = listTsFiles(API_DIR);
  const calls = []; // { file, url }
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    // 匹配 apiFetch<T>(`/...`) 或 apiFetch(`/...`) 或 apiFetch("/...")
    const re = /apiFetch[^(]*\(\s*[`"]([^`"]+)[`"]/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      calls.push({ file: file.replace(REPO_ROOT + "/", ""), url: m[1] });
    }
  }
  return calls;
}

// ── 2. 提取 openapi.yaml 的 path 集合（含 deprecated） ──────────────────────

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
    // 顶层 path 以 "  /xxx:" 开头（2 空格缩进 + /）。支持两种 YAML 风格：
    //   - 块式：  /coach/artists:\n  …\n
    //   - 流式：  /coach/artists: { get: { … } }
    const pathMatch = line.match(/^  (\/[^:\s]+):/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      paths.add(currentPath);
      // 流式行内若已经包含 deprecated: true 也要识别
      if (/deprecated:\s*true/.test(line)) deprecated.add(currentPath);
      continue;
    }
    // 检测 deprecated: true 出现在 method 块内（块式）
    if (currentPath && /^\s+deprecated:\s*true/.test(line)) {
      deprecated.add(currentPath);
    }
  }
  return { paths, deprecated };
}

// ── 3. 比对 ─────────────────────────────────────────────────────────────────

function pathMatches(callUrl, openapiPaths) {
  // 直接全等
  if (openapiPaths.has(callUrl)) return callUrl;
  // 把 {id} 类位置参数改成正则匹配
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

  const missingInOpenapi = []; // calls without a matching openapi path
  const callDestinations = new Map(); // openapi path -> set of call sites
  for (const c of calls) {
    const norm = normalizeUrl(c.url);
    const hit = pathMatches(norm, openapiPaths);
    if (!hit) {
      missingInOpenapi.push({ ...c, normalized: norm });
    } else {
      if (!callDestinations.has(hit)) callDestinations.set(hit, new Set());
      callDestinations.get(hit).add(c.file);
    }
  }
  // openapi paths the front-end never calls (potentially obsolete)
  const orphanedInOpenapi = [];
  for (const p of openapiPaths) {
    if (!callDestinations.has(p)) orphanedInOpenapi.push(p);
  }

  // ── 输出 ──
  console.log("─".repeat(72));
  console.log(`API contract check`);
  console.log(`  apps/web/src/api/*.ts  : ${calls.length} apiFetch call sites`);
  console.log(
    `  specs/openapi.yaml     : ${openapiPaths.size} paths (${deprecated.size} deprecated)`,
  );
  console.log("─".repeat(72));

  if (missingInOpenapi.length > 0) {
    console.log("\n❌  MISSING in openapi.yaml (front-end calls a path the spec doesn't define):");
    for (const m of missingInOpenapi) {
      console.log(`     ${m.normalized}`);
      console.log(`         called from ${m.file}`);
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
  if (missingInOpenapi.length > 0) {
    console.error(
      `FAIL: ${missingInOpenapi.length} apiFetch URL(s) missing from openapi.yaml. ` +
        `Add the path/schema to specs/openapi.yaml (and source TS types in apps/web/src/types/).`,
    );
    process.exit(1);
  }
  console.log("OK.");
}

main();
