#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scripts/check-api-contract.mjs
//
// 校验四个 web app + packages/api-client 中所有 apiFetch(...) 调用是否在
// specs/openapi.yaml 中既有 path 又有匹配的 HTTP method。drift 即报错。
//
// 比旧版 apps/web/scripts/check-api-contract.mjs 多了：
//   - 扫描新 app（web-music / web-drama / web-celebrity / web-aiavatar）+ packages/api-client
//   - 方法级匹配（旧版只看 path）
//
// 用法（在仓库根运行）：
//   node scripts/check-api-contract.mjs
//   pnpm check:api-contract
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");
// 每个扫描根：{ dir, prefix? }。prefix 用于自带 API 基址前缀的 app —— web-aiavatar 的
// proto/api.ts apiFetch 走 /api/v1，openapi path 去掉 /api 基址后是 /v1/*，故补 "/v1"。
// （aiavatar 的 authFetch→/api/auth、apiUpload→/api/v1 不走 apiFetch 正则，暂不纳入；
//  其 auth 端点与其他 app 共用，已被覆盖。）
const SCAN_TARGETS = [
  { dir: "apps/web-music/src" },
  { dir: "apps/web-drama/src" },
  { dir: "apps/web-celebrity/src" },
  { dir: "apps/web-aiavatar/src", prefix: "/v1" },
  { dir: "apps/web-star/src" },
  { dir: "packages/api-client/src" },
];
const OPENAPI_PATH = join(REPO_ROOT, "specs/openapi.yaml");

// ── 1. 提取所有 apiFetch URL + method ───────────────────────────────────────

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(name) && !name.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

/**
 * 把 `${var}` / 查询串归一化为 OpenAPI path 形态：
 *   /products/${id}                            → /products/{id}
 *   /celebrity/stars${suffix}                  → /celebrity/stars
 *   /celebrity/showcases?mode=x                → /celebrity/showcases
 *   /me/songs/${encodeURIComponent(id)}        → /me/songs/{id}
 */
function extractStringConstants(src) {
  const constants = new Map();
  const re = /\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*(["'`])([^"'`]+)\2\s*;/g;
  let m;
  while ((m = re.exec(src)) !== null) constants.set(m[1], m[3]);
  return constants;
}

function normalizeUrl(raw, constants = new Map()) {
  let s = raw;
  for (const [name, value] of constants) {
    s = s.replaceAll("${" + name + "}", value);
  }
  s = s.replace(/\?.*$/, "");
  s = s.replace(/\$\{suffix\}/g, "");
  s = s.replace(/\$\{qs\}/g, "");
  s = s.replace(/\$\{encodeURIComponent\(([^)]+)\)\}/g, (_, v) => `{${v.trim()}}`);
  s = s.replace(/\$\{([^}]+)\}/g, (_, expr) => {
    const m = expr.match(/[a-zA-Z_][a-zA-Z0-9_]*/);
    return m ? `{${m[0]}}` : "{var}";
  });
  // 兜底：嵌套模板字面量（如 `/licenses${status ? `?status=${status}` : ""}`）会被上面的字符串
  // 正则在内层反引号处截断，残留未闭合的 "${…"；把这种残留动态后缀整体砍掉，归一到基础 path。
  s = s.replace(/\$\{.*$/, "");
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

function extractCalls() {
  const calls = [];
  for (const { dir, prefix = "" } of SCAN_TARGETS) {
    const abs = join(REPO_ROOT, dir);
    for (const file of walk(abs)) {
      const src = readFileSync(file, "utf8");
      const constants = extractStringConstants(src);
      // apiFetch<T>(`/...`[, { method: "POST", ... }])
      // 第 2 个参数是对象字面量；跨行需要 [\s\S]*? 才能命中 method。
      const re = /apiFetch[^(]*\(\s*([`"])([^`"]+)\1(?:\s*,\s*(\{[\s\S]*?\}))?/g;
      let m;
      while ((m = re.exec(src)) !== null) {
        const url = m[2];
        const opts = m[3] || "";
        const methodMatch = opts.match(/method:\s*"([A-Z]+)"/);
        const method = methodMatch ? methodMatch[1] : "GET";
        calls.push({
          file: file.replace(REPO_ROOT + "/", ""),
          rawUrl: url,
          method,
          path: prefix + normalizeUrl(url, constants),
        });
      }
    }
  }
  return calls;
}

// ── 2. 提取 openapi.yaml 的 path × method 集合 ──────────────────────────────
// 支持块式 (`get:\n   tags:...`) 与流式 (`{ get: { ... } }`) 两种 YAML。

function extractOpenapi() {
  const yaml = readFileSync(OPENAPI_PATH, "utf8");
  const lines = yaml.split("\n");
  const methodsByPath = new Map();
  const deprecated = new Set();
  let inPaths = false;
  let current = null;
  for (const line of lines) {
    if (/^paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    if (inPaths && /^[a-zA-Z]/.test(line)) {
      inPaths = false;
      break;
    }
    if (!inPaths) continue;

    // 2-space indent path line, optionally followed by inline flow style.
    const pm = line.match(/^ {2}(\/[^:\s]+):\s*(.*)$/);
    if (pm) {
      current = pm[1];
      if (!methodsByPath.has(current)) methodsByPath.set(current, new Set());
      // inline methods
      const rest = pm[2] || "";
      for (const m of rest.matchAll(/\b(get|post|put|patch|delete):/g)) {
        methodsByPath.get(current).add(m[1].toUpperCase());
      }
      if (/deprecated:\s*true/.test(line)) deprecated.add(current);
      continue;
    }
    if (!current) continue;
    // block-style method line, exactly 4-space indent.
    const mm = line.match(/^ {4}(get|post|put|patch|delete):/);
    if (mm) methodsByPath.get(current).add(mm[1].toUpperCase());
    if (/^\s+deprecated:\s*true/.test(line)) deprecated.add(current);
  }
  return { methodsByPath, deprecated };
}

// ── 3. 比对 ─────────────────────────────────────────────────────────────────

function matchPath(callPath, paths) {
  if (paths.has(callPath)) return callPath;
  for (const p of paths) {
    if (!p.includes("{")) continue;
    const re = new RegExp(
      "^" + p.replace(/\{[^}]+\}/g, "[^/]+").replace(/\//g, "\\/") + "$",
    );
    if (re.test(callPath)) return p;
  }
  return null;
}

function main() {
  const calls = extractCalls();
  const { methodsByPath, deprecated } = extractOpenapi();
  const paths = new Set(methodsByPath.keys());

  const missingPath = []; // path 缺失
  const missingMethod = []; // path 在 spec，但 method 不在
  const hitPaths = new Set();
  for (const c of calls) {
    const hit = matchPath(c.path, paths);
    if (!hit) {
      missingPath.push(c);
      continue;
    }
    hitPaths.add(hit);
    const methods = methodsByPath.get(hit) || new Set();
    if (!methods.has(c.method)) {
      missingMethod.push({ ...c, openapiPath: hit, openapiMethods: [...methods] });
    }
  }
  const orphans = [...paths].filter((p) => !hitPaths.has(p));

  console.log("─".repeat(72));
  console.log("API contract check — monorepo");
  console.log(
    `  Scanned : ${calls.length} apiFetch call sites across ${SCAN_TARGETS.length} roots`,
  );
  console.log(
    `  Spec    : ${paths.size} paths in specs/openapi.yaml (${deprecated.size} deprecated)`,
  );
  console.log("─".repeat(72));

  if (missingPath.length === 0) {
    console.log("\n✓  Every apiFetch URL has a matching openapi path.");
  } else {
    console.log(`\n❌  MISSING path in openapi.yaml (${missingPath.length}):`);
    const grouped = new Map();
    for (const m of missingPath) {
      const k = `${m.method} ${m.path}`;
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k).push(m.file);
    }
    for (const [k, files] of [...grouped.entries()].sort()) {
      console.log(`     ${k}`);
      for (const f of files) console.log(`         called from ${f}`);
    }
  }

  if (missingMethod.length === 0) {
    console.log("\n✓  Every apiFetch method matches a method defined on its openapi path.");
  } else {
    console.log(`\n❌  MISSING method in openapi.yaml (${missingMethod.length}):`);
    const grouped = new Map();
    for (const m of missingMethod) {
      const k = `${m.method} ${m.openapiPath}  (openapi has: ${m.openapiMethods.sort().join(",") || "none"})`;
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k).push(m.file);
    }
    for (const [k, files] of [...grouped.entries()].sort()) {
      console.log(`     ${k}`);
      for (const f of files) console.log(`         called from ${f}`);
    }
  }

  if (orphans.length > 0) {
    const visible = orphans.filter((p) => !deprecated.has(p));
    console.log(
      `\n⚠  Orphan paths in openapi.yaml (${orphans.length} — may be public/future/admin; first 20):`,
    );
    for (const p of visible.slice(0, 20).sort()) console.log(`     ${p}`);
    if (visible.length > 20) console.log(`     … ${visible.length - 20} more`);
  }

  console.log();
  if (missingPath.length > 0 || missingMethod.length > 0) {
    console.error(
      `FAIL: ${missingPath.length} missing path(s), ${missingMethod.length} missing method(s). ` +
        `Update specs/openapi.yaml (and TS types in packages/types/) to match the frontend.`,
    );
    process.exit(1);
  }
  console.log("OK.");
}

main();
