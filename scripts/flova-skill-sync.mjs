#!/usr/bin/env node
// Flova skill 增量同步脚本（继续下载用）。
//
// 用法：
//   node scripts/flova-skill-sync.mjs --check            # 只报告新增/消失 skill（默认，不改文件）
//   node scripts/flova-skill-sync.mjs --write            # 下载新增 skill 的 json/md/skill_content/封面/演示视频
//   node scripts/flova-skill-sync.mjs --write --force    # 重新获取全部技能正文，已有封面和视频继续复用
//
// 认证：目录枚举走 v3（匿名即可）。正文：v3 catalog 的 skill 用 /api/v3/skill/get（匿名即可全文）；
//   v2 旧 catalog 的 skill 用 /api/v2/skill/get + 登录 cookie 拿全文，匿名只有 203 字截断预览。
//   FLOVA_COOKIE=<浏览器里的完整 Cookie 串> node scripts/flova-skill-sync.mjs --write
//   cookie 来源：登录 www.flova.ai 后，浏览器 DevTools → Network → 任意请求复制 Cookie 头。
//
// 数据目录：resources/skills（沿用现有结构：all_skills_by_id/、tabs/<NN>-<cat>/skills/、
//   covers/by_skill_id/<id>/、videos/、manifest.json、README.md）。

import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKILLS_ROOT = join(ROOT, "resources", "skills");
// 目录枚举走 v3（当前站点目录即 v3 catalog，匿名可枚举全部）；v2 仅作旧 catalog skill 的正文兜底。
const V3_BASE = "https://service.flova.ai/api/v3";
const LIST_BASE = process.env.FLOVA_LIST_BASE || "https://service.flova.ai/api/v2";
const COOKIE = process.env.FLOVA_COOKIE || (() => {
  try { return readFileSync(join(ROOT, "scripts", ".flova-cookie"), "utf8").trim(); }
  catch { return ""; }
})();
const GET_BASE = V3_BASE;
const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const FORCE = args.includes("--force");

// ── 请求 ─────────────────────────────────────────────────────────────────────
const cookieHeaders = COOKIE ? { Cookie: COOKIE } : {};
async function get(path) {
  const res = await fetch(`${LIST_BASE}${path}`, { headers: { "X-Lang": "zh-CN", ...cookieHeaders } });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  const j = await res.json();
  if (j.code !== 0) throw new Error(`GET ${path} → code ${j.code}: ${j.message || ""}`);
  return j.data;
}
async function get3(path) {
  const res = await fetch(`${V3_BASE}${path}`, { headers: { "X-Lang": "zh-CN", ...cookieHeaders } });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  const j = await res.json();
  if (j.code !== 0) throw new Error(`GET ${path} → code ${j.code}: ${j.message || ""}`);
  return j.data;
}
async function post(base, path, body) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Lang": "zh-CN", ...cookieHeaders },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  const j = await res.json();
  if (j.code !== 0) throw new Error(`POST ${path} → code ${j.code}: ${j.message || ""}`);
  return j.data;
}
// 优先 v3（v3 catalog 的 skill 匿名即可拿全文）；v3 对 v2 旧 catalog 的 skill 返回
// code 9156 (Skill not found)，此时降级 v2 —— 带 cookie 可拿全文，匿名只有 203 字截断预览。
async function fetchDetail(id) {
  try { return await post(GET_BASE, "/skill/get", { skill_id: id }); }
  catch (e) {
    console.warn(`  · ${id} v3 失败（${e.message}），尝试 v2${COOKIE ? "" : " 匿名预览"}`);
    return await post(LIST_BASE, "/skill/get", { skill_id: id });
  }
}
async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`下载失败 ${res.status}: ${url.split("?")[0]}`);
  mkdirSync(join(dest, ".."), { recursive: true });
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

// ── 文件工具 ─────────────────────────────────────────────────────────────────
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p, v) => {
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
};
const safeName = (s) => String(s ?? "").replace(/[\\/:*?"<>|]/g, "_").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// skill_content 兼容 v2（数组 [{section, content}]）与 v3（整段 markdown 字符串）。
const sectionsOf = (detail) => {
  const sc = detail?.skill_content;
  if (Array.isArray(sc)) return sc;
  if (typeof sc === "string") return [{ section: "full", content: sc }];
  return [];
};

// 生成与现有 all_skills_by_id/<id>.md 一致的 markdown。
function generateMd(data) {
  const head = [
    `# ${data.skill_name ?? "未命名"}`,
    "",
    `skill_id: ${data.skill_id}`,
    `description: ${data.description ?? ""}`,
    `skill_description: ${data.skill_description ?? ""}`,
    `version: ${data.version}`,
    `locale: ${data.locale}`,
    "",
  ];
  if (typeof data.skill_content === "string") {
    return head.join("\n") + data.skill_content.trim() + "\n";
  }
  const body = sectionsOf(data).map((s) => [`## ${s.section}`, "", (s.content ?? "").trim(), ""].join("\n")).join("\n");
  return head.join("\n") + "\n" + body.trimEnd() + "\n";
}

const isTruncated = (detail) => {
  const sc = detail?.skill_content;
  if (typeof sc === "string") return sc.trimEnd().endsWith("...");
  if (!Array.isArray(sc)) return false;
  return sc
    .filter((s) => typeof s === "object")
    .some((s) => typeof s.content === "string" && s.content.trimEnd().endsWith("..."));
};

// ── tab 目录映射（tabs/<NN>-<cat_id>/） ─────────────────────────────────────
const tabsDir = join(SKILLS_ROOT, "tabs");
function tabDirFor(catId) {
  mkdirSync(tabsDir, { recursive: true });
  const existing = readdirSync(tabsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.endsWith(`-${catId}`))
    .map((d) => d.name);
  if (existing.length) return join(tabsDir, existing[0]);
  const maxNo = readdirSync(tabsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => parseInt(d.name.slice(0, 2), 10))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return join(tabsDir, `${String(maxNo + 1).padStart(2, "0")}-${catId}`);
}

// ── 主流程 ───────────────────────────────────────────────────────────────────
const byId = join(SKILLS_ROOT, "all_skills_by_id");
const localIds = existsSync(byId)
  ? readdirSync(byId).filter((f) => f.endsWith(".json") && !f.endsWith(".skill_content.json")).map((f) => basename(f, ".json"))
  : [];

async function fetchAllSkills() {
  const cats = await get3("/skill/categories?locale=zh-CN");
  const map = new Map();
  // v3 列表一次拿全量（brief 自带 attrs.category_ids），无需按分类分页。
  let page = 1, total = Infinity;
  while (true) {
    const d = await get3(`/skill/list_public_v2?page=${page}&page_size=50&locale=zh-CN&only_brief=true&sort=default`);
    for (const it of d.items ?? []) map.set(it.skill_id, { ...it });
    total = d.total ?? d.items.length;
    if (page * 50 >= total || (d.items ?? []).length === 0) break;
    page++;
    await sleep(120);
  }
  return { categories: cats, skills: [...map.values()] };
}

async function saveSkill(detail, brief) {
  const id = detail.skill_id;
  const catIds = (detail.attrs?.category_ids ?? brief?.attrs?.category_ids ?? []);
  const truncated = isTruncated(detail);
  if (truncated) console.warn(`  ⚠ ${id} 内容为截断预览（v3 取不到且未带 FLOVA_COOKIE）——带 cookie 后 --force 可重拿全文`);

  // 1) 核心文件 → all_skills_by_id/
  writeJson(join(byId, `${id}.json`), detail);
  writeJson(join(byId, `${id}.skill_content.json`), detail.skill_content ?? []);
  writeFileSync(join(byId, `${id}.md`), generateMd(detail));

  // 2) 按分类归档 → tabs/<NN>-<cat>/skills/
  for (const catId of catIds) {
    if (catId === "catch_all") continue; // catch_all 是聚合标签，不单独建目录
    const dir = tabDirFor(catId);
    mkdirSync(join(dir, "skills"), { recursive: true });
    writeJson(join(dir, "skills", `${id}.json`), detail);
    writeJson(join(dir, "skills", `${id}.skill_content.json`), detail.skill_content ?? []);
    writeFileSync(join(dir, "skills", `${id}.md`), generateMd(detail));
  }

  // 3) 封面 covers/by_skill_id/<id>/
  const cover = detail.cover_standard_url ?? detail.attrs?.material_resource?.standard_url ?? brief?.cover_standard_url;
  if (cover) {
    for (const size of ["compressed", "large", "medium", "small"]) {
      const url = cover[size];
      if (!url) continue;
      const dest = join(SKILLS_ROOT, "covers", "by_skill_id", id, `${size}.webp`);
      if (existsSync(dest)) continue; // 已有封面不重下
      try { await download(url, dest); } catch (e) { console.warn(`  · 封面 ${size} 下载失败: ${e.message}`); }
      await sleep(100);
    }
  }

  // 4) 演示视频 videos/<id>_<name>.mp4
  const mat = [detail.attrs?.material_resource, brief?.attrs?.material_resource].find((m) => m?.type === "video" && m.url);
  if (mat) {
    const name = safeName(detail.skill_name ?? id);
    const dest = join(SKILLS_ROOT, "videos", `${id}_${name}.mp4`);
    if (!existsSync(dest)) {
      try { await download(mat.url, dest); } catch (e) { console.warn(`  · 视频下载失败: ${e.message}`); }
      await sleep(100);
    }
  }
}

async function rebuildIndexes(categories, briefs, localIds) {
  const localSet = new Set(localIds);
  const inCat = (c) => briefs.filter((s) => localSet.has(s.skill_id) && (s._cat === c.id || (s.attrs?.category_ids ?? []).includes(c.id)));
  const manifest = {
    source_page: "https://www.flova.ai/zh-CN/skill/",
    api_base: GET_BASE,
    downloaded_at: new Date().toISOString(),
    categories: categories.map((c) => {
      const dirName = tabDirFor(c.id).split("/").pop();
      const items = inCat(c);
      return {
        id: c.id, is_default: c.is_default, name: c.name,
        dir: `skills/tabs/${dirName}`,
        total: items.length, item_count: items.length,
        skills: items.map((s) => ({
          skill_id: s.skill_id,
          skill_name: s.skill_name,
          files: {
            json: `skills/tabs/${dirName}/skills/${s.skill_id}.json`,
            skill_content_json: `skills/tabs/${dirName}/skills/${s.skill_id}.skill_content.json`,
            markdown: `skills/tabs/${dirName}/skills/${s.skill_id}.md`,
          },
        })),
      };
    }),
  };
  writeJson(join(SKILLS_ROOT, "manifest.json"), manifest);

  const lines = [
    "# Flova Skill Downloads",
    "",
    "Source: https://www.flova.ai/zh-CN/skill/",
    `Downloaded at: ${new Date().toISOString()}`,
    `Tabs: ${categories.length}`,
    `Tab items: ${briefs.filter((s) => localSet.has(s.skill_id)).length}`,
    `Unique skills: ${localIds.length}`,
    "",
  ];
  for (const c of categories) {
    const items = inCat(c);
    if (!items.length) continue;
    lines.push(`## ${c.name} (${c.id})`, "");
    for (const s of items) lines.push(`- ${s.skill_name} (${s.skill_id})`);
    lines.push("");
  }
  writeFileSync(join(SKILLS_ROOT, "README.md"), lines.join("\n"));
}

// ── 执行 ─────────────────────────────────────────────────────────────────────
console.log(COOKIE ? "✓ 已携带登录 cookie（走 v3，可拿完整正文）" : "未配置 FLOVA_COOKIE，优先匿名获取 v3 正文；旧 v2 内容可能只有截断预览");
const { categories, skills } = await fetchAllSkills();
const apiIds = new Set(skills.map((s) => s.skill_id));
const localSet = new Set(localIds);
const newIds = [...apiIds].filter((id) => !localSet.has(id));
const goneIds = [...localSet].filter((id) => !apiIds.has(id));

console.log(`分类 ${categories.length} 个，API 共 ${apiIds.size} 个唯一 skill，本地已有 ${localIds.length} 个`);
console.log(`新增 ${newIds.length} 个 / 已消失 ${goneIds.length} 个`);
if (newIds.length) console.log(`新增示例：${newIds.slice(0, 10).map((id) => skills.find((s) => s.skill_id === id)?.skill_name ?? id).join("、")}`);

if (!WRITE) {
  console.log("（--check 模式，未写文件。加 --write 下载新增内容）");
  process.exit(0);
}

let ok = 0, fail = 0;
// --force 时重取全部 skill 详情（用于把截断预览刷新成完整正文）；否则只处理新增。
const targets = FORCE ? [...apiIds] : newIds;
for (const id of targets) {
  try {
    const detail = await fetchDetail(id);
    await saveSkill(detail, skills.find((s) => s.skill_id === id));
    console.log(`  ✓ ${id} ${detail.skill_name}`);
    ok++;
  } catch (e) { console.error(`  ✗ ${id}: ${e.message}`); fail++; }
  await sleep(200);
}

// 从磁盘重新统计已入库 id（只看真实存在的文件），再重建索引。
const onDisk = existsSync(byId)
  ? readdirSync(byId).filter((f) => f.endsWith(".json") && !f.endsWith(".skill_content.json")).map((f) => basename(f, ".json"))
  : [];
await rebuildIndexes(categories, skills, onDisk);
console.log(`完成：成功 ${ok} / 失败 ${fail}。manifest.json 与 README.md 已重建。`);
