#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scripts/check-api-contract.mjs
//
// 校验四个 web app + packages/api-client 中所有 apiFetch(...) 调用是否在
// specs/openapi.yaml 中既有 path 又有匹配的 HTTP method。drift 即报错。
//
// 比旧版 apps/web/scripts/check-api-contract.mjs 多了：
//   - 扫描六个子应用（web-music / web-drama / web-celebrity / web-aiavatar / web-star /
//     packages/api-client。真源是下面的 SCAN_TARGETS，加 app 记得同步。
//     （v0.190：web-ipstudio 已并入 web-aiavatar，画布与其 API 层在后者的
//      canvas-bridge/ 与 ip/ 两棵子树下，各自单列扫描根 —— 见下方注释。）
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
  // web-aiavatar 一棵树里有**两种字面量约定**（v0.190 并入 ipstudio 之后）：
  //   proto/*        自己的 apiFetch 会拼 /api/v1，所以字面量写 `/card/mine` → 补 "/v1"
  //   canvas-bridge/ 与 ip/  用共享 apiFetch，字面量本来就写全 `/v1/ip-studio/*` → 不补
  // 混在一个扫描根下，补前缀的那份会把后者算成 /v1/v1/...（30 个调用点全废）。
  // 所以把搬来的两棵子树排除掉，再各自单列一个不带 prefix 的根。
  {
    dir: "apps/web-aiavatar/src",
    prefix: "/v1",
    exclude: ["apps/web-aiavatar/src/canvas-bridge", "apps/web-aiavatar/src/ip"],
  },
  { dir: "apps/web-aiavatar/src/canvas-bridge" },
  { dir: "apps/web-aiavatar/src/ip" },
  { dir: "apps/web-star/src" },
  { dir: "packages/api-client/src" },
];
const OPENAPI_PATH = join(REPO_ROOT, "specs/openapi.yaml");

// 不由本仓 server 实现的前端调用（本仓之外的服务）。加条目要写清楚谁实现它。
const SERVER_CHECK_EXEMPT = [
  /^\/auth\//,        // 统一账号中心 pokocat/aibuzz-id 的 OIDC 端点由它自己实现
];

// ── 1. 提取所有 apiFetch URL + method ───────────────────────────────────────

// exclude：绝对路径前缀列表，命中的子树整棵跳过。
// 用途是「同一棵树里两种字面量约定」——本仓 web-aiavatar 自己的 apiFetch 会拼
// /api/v1，所以字面量写成 /card/mine（靠 SCAN_TARGETS 的 prefix 补 /v1）；而从
// web-ipstudio 搬进来的子树写的是完整的 /v1/ip-studio/*。两者混在一个扫描根下，
// 补前缀的那份会把后者算成 /v1/v1/...。把搬来的子树排除掉、再各自单列一个不带
// prefix 的扫描根，两种约定才能共存。
function walk(dir, acc = [], exclude = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (exclude.some((ex) => p === ex || p.startsWith(`${ex}/`))) continue;
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc, exclude);
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
  for (const { dir, prefix = "", exclude = [] } of SCAN_TARGETS) {
    const abs = join(REPO_ROOT, dir);
    const absExclude = exclude.map((e) => join(REPO_ROOT, e));
    for (const file of walk(abs, [], absExclude)) {
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


// ── 2b. 提取 server 真实的 Spring 路由 ──────────────────────────────────────
//
// 为什么要有这一段（v0.177）：此前这个门只比对「前端 URL ↔ openapi」。
// openapi 是**我们手写的文档**，写了一条服务端根本没实现的路径，它照样全绿 ——
// 画布轮询视频任务打的 `/me/material/videos/jobs/{id}` 就是这么上线的：
// 文档里有、controller 里没有，用户点发送先撞开通闸 403，修了路由还是 404。
// 所以再加一道：前端调的每个 URL，server 里必须真有一个 handler。

const SERVER_JAVA_ROOT = "apps/server/src/main/java";

function javaFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) javaFiles(p, acc);
    else if (name.endsWith(".java")) acc.push(p);
  }
  return acc;
}

/**
 * 注解里的**路径**部分。`@GetMapping("/a/{b:.+}")` → `/a/{b}`，`@RequestMapping(value = "/x")` 也认。
 *
 * 关键是别把别的属性当成路径：`@PostMapping(consumes = {"multipart/form-data"})` 里那个字符串
 * 不是路径，注解也就没有子路径（= 类级路径本身）。一开始把所有引号串都当路径，
 * 于是这类上传接口被算成 `/api/star/profile/uploads/multipart/form-data`，
 * 真实路径反而「查无此 handler」—— 门自己产生假警报，比没有门更糟。
 */
function mappingValue(annotationArgs) {
  if (!annotationArgs || !annotationArgs.trim()) return [""];
  const args = annotationArgs;
  const keyed = args.match(/\b(?:value|path)\s*=\s*(\{[^}]*\}|"[^"]*")/);
  const source = keyed ? keyed[1] : /^\s*(?:"|\{\s*")/.test(args) ? args.split(",").filter((x) => /"/.test(x)).join(",") : null;
  if (source === null) return [""];   // 只有 consumes / produces 之类，没有子路径
  const out = [...source.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  return out.length ? out : [""];
}

function normalizeJavaPath(p) {
  let s = p.replace(/\{([^}:]+)(:[^}]*)?\}/g, "{$1}");
  if (s && !s.startsWith("/")) s = "/" + s;
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

const METHOD_ANNOTATIONS = {
  GetMapping: "GET",
  PostMapping: "POST",
  PutMapping: "PUT",
  DeleteMapping: "DELETE",
  PatchMapping: "PATCH",
};

function extractSpringRoutes() {
  const routes = new Map(); // path → Set(method)
  const add = (path, method) => {
    const key = normalizeJavaPath(path);
    if (!routes.has(key)) routes.set(key, new Set());
    routes.get(key).add(method);
  };
  for (const file of javaFiles(join(REPO_ROOT, SERVER_JAVA_ROOT))) {
    const src = readFileSync(file, "utf8");
    if (!/@(RestController|Controller)\b/.test(src)) continue;
    // 类级 @RequestMapping：取 @RestController 之后、class 声明之前的那一个
    const classAnn = src.match(/@RequestMapping\s*\(([^)]*)\)[\s\S]{0,400}?\b(?:public\s+)?(?:final\s+)?class\b/);
    const bases = classAnn ? mappingValue(classAnn[1]) : [""];
    for (const [ann, method] of Object.entries(METHOD_ANNOTATIONS)) {
      const re = new RegExp("@" + ann + "\\s*(?:\\(([^)]*)\\))?", "g");
      let m;
      while ((m = re.exec(src)) !== null) {
        for (const base of bases) for (const sub of mappingValue(m[1])) add(base + sub, method);
      }
    }
    // 方法级 @RequestMapping(value=..., method = RequestMethod.X)
    const reReq = /@RequestMapping\s*\(([^)]*method\s*=\s*RequestMethod\.[A-Z]+[^)]*)\)/g;
    let m2;
    while ((m2 = reReq.exec(src)) !== null) {
      const args = m2[1];
      const verbs = [...args.matchAll(/RequestMethod\.([A-Z]+)/g)].map((x) => x[1]);
      for (const base of bases) for (const sub of mappingValue(args)) for (const v of verbs) add(base + sub, v);
    }
  }
  return routes;
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

  // 前端调的每个 URL，server 里必须真有 handler（openapi 是手写文档，挡不住这一类）。
  // Spring 路由带 /api 基址，openapi/前端路径不带 —— 比对前先削掉。
  const springRoutes = extractSpringRoutes();
  const serverPaths = new Map();
  for (const [p, verbs] of springRoutes) {
    const rel = p.startsWith("/api/") ? p.slice(4) : p.startsWith("/api") ? p.slice(4) || "/" : null;
    if (rel === null) continue;
    if (!serverPaths.has(rel)) serverPaths.set(rel, new Set());
    for (const v of verbs) serverPaths.get(rel).add(v);
  }
  const serverPathSet = new Set(serverPaths.keys());
  const notImplemented = [];
  for (const c of calls) {
    if (SERVER_CHECK_EXEMPT.some((re) => re.test(c.path))) continue;
    const hit = matchPath(c.path, serverPathSet);
    if (!hit) {
      notImplemented.push({ ...c, why: "no handler" });
      continue;
    }
    if (!serverPaths.get(hit).has(c.method)) {
      notImplemented.push({ ...c, why: `handler exists but not ${c.method} (has ${[...serverPaths.get(hit)].sort().join(",")})` });
    }
  }

  console.log("─".repeat(72));
  console.log("API contract check — monorepo");
  console.log(
    `  Scanned : ${calls.length} apiFetch call sites across ${SCAN_TARGETS.length} roots`,
  );
  console.log(
    `  Spec    : ${paths.size} paths in specs/openapi.yaml (${deprecated.size} deprecated)`,
  );
  console.log("─".repeat(72));

  // server 里没有 handler 的前端调用。**目前是告警不是失败** —— 存量 24 条（多为 web-music
  // 只在 mock 下用的页面），要先分批清完才谈得上做成硬门；新代码不该再往这里加。
  // 它挡的正是 openapi 挡不住的那一类：文档里写了一条服务端根本没实现的路径 ——
  // 画布轮询视频任务的 `/me/material/videos/jobs/{id}` 就是这么上线的（v0.177）。
  if (!notImplemented.length) {
    console.log("\n✓  Every apiFetch URL resolves to a real Spring handler.");
  } else {
    console.log(`\n⚠  No server handler for these apiFetch URLs (${notImplemented.length}) —`);
    console.log("   前端调得到、服务端接不住。openapi 里有 ≠ controller 里有。");
    const seen = new Set();
    for (const n of notImplemented) {
      const k = `${n.method} ${n.path}  [${n.why}]`;
      if (seen.has(k)) continue;
      seen.add(k);
      console.log(`     ${k}  ← ${n.file}`);
    }
  }

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
