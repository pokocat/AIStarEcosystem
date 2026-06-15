#!/usr/bin/env node
// 本地处理：把一个 flova skill 原始导出蒸馏成标准 bundle（data/drama-recipes/<id>/）。
//   产出：recipe.json（meta + 蒸馏 payload + 资源引用）、source.json（flova 原文存档）、cover.<ext>（若本地有）。
//
// 用法：
//   node scripts/drama-recipe/prep.mjs --skill <skillId>            # 蒸馏（需 LLM 凭据，见下）
//   node scripts/drama-recipe/prep.mjs --skill <skillId> --no-distill   # 只建骨架，payload 留空待手填
//   node scripts/drama-recipe/prep.mjs --all --no-distill            # 批量建骨架（所有未建 bundle 的 flova skill）
//   node scripts/drama-recipe/prep.mjs --skill <id> --force          # 覆盖已 reviewed 的 bundle
//
// LLM 凭据（OpenAI 兼容；缺则自动降级为 --no-distill 并告警，绝不塞假内容）：
//   DRAMA_LLM_BASE_URL（如 https://api.openai.com/v1 或自建 gateway）、DRAMA_LLM_API_KEY、DRAMA_LLM_MODEL
// §8.0：这是离线 prep 工具，不是生产运行期；缺凭据时产出的是「空 payload 骨架」（诚实留空），不是伪造蒸馏结果。

import { join, basename } from "node:path";
import { readFileSync, existsSync, readdirSync, mkdirSync, copyFileSync } from "node:fs";
import {
  PATHS, ROOT, readJson, writeJson, bundleDir, exists, nowIso, SCHEMA_VERSION,
} from "./_lib.mjs";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

const PROMPT_PATH = val("--prompt") || join(ROOT, "apps", "server", "src", "main", "resources", "prompts", "material", "drama.recipe_extract.md");
const noDistill = has("--no-distill");
const force = has("--force");

function recipeId(skillId) { return `rcp-official-${skillId.slice(0, 12)}`; }
function readFlova(skillId) {
  const p = join(PATHS.flovaSkills, `${skillId}.json`);
  if (!existsSync(p)) throw new Error(`flova skill 原文不存在：${p}`);
  return readJson(p);
}
function importFlovaCover(id, skillId) {
  // covers/by_skill_id/<skillId>/{compressed,large,medium,small}.webp —— 取 medium（与现有 seed 封面体量一致）。
  const skDir = join(ROOT, "resources", "downloads", "covers", "by_skill_id", skillId);
  if (!existsSync(skDir)) return null;
  const files = readdirSync(skDir);
  const pick = ["medium.webp", "large.webp", "compressed.webp", "small.webp"].find((f) => files.includes(f)) || files[0];
  if (!pick) return null;
  const ext = pick.slice(pick.lastIndexOf(".")) || ".webp";
  const local = "cover" + ext;
  mkdirSync(bundleDir(id), { recursive: true });
  copyFileSync(join(skDir, pick), join(bundleDir(id), local));
  return local;
}

// ── LLM 蒸馏（OpenAI 兼容 chat/completions） ─────────────────────────────────
function loadPrompt() {
  const raw = readFileSync(PROMPT_PATH, "utf8");
  const parts = raw.split(/\n-{3,}\n/);
  return parts.length >= 2 ? { system: parts[0].trim(), userTpl: parts.slice(1).join("\n---\n").trim() }
                           : { system: raw.trim(), userTpl: "{{outline}}" };
}
function fill(tpl, vars) { return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? "")); }

async function distill(flova) {
  const base = process.env.DRAMA_LLM_BASE_URL, key = process.env.DRAMA_LLM_API_KEY, model = process.env.DRAMA_LLM_MODEL;
  if (!base || !key || !model) {
    console.warn("  ⚠ 未配置 DRAMA_LLM_BASE_URL/API_KEY/MODEL → 降级为骨架（payload 留空，非伪造）。配齐后用 --force 重蒸。");
    return null;
  }
  const { system, userTpl } = loadPrompt();
  const user = fill(userTpl, {
    title: flova.skill_name || "",
    type: (flova.attrs?.category_ids || []).join("/") || "风格短片",
    episodes: 1,
    logline: flova.skill_description || flova.description || "",
    mainline: "",
    outline: JSON.stringify(flova.skill_content ?? "").slice(0, 12000),
    characters: "",
  });
  const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, temperature: 0.7, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  let text = j.choices?.[0]?.message?.content ?? "";
  text = text.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "").trim();
  return JSON.parse(text);
}

const EMPTY = { mainline: "", beats: [], characters: [], hooks: [], notes: "" };
function normPayload(p) {
  if (!p || typeof p !== "object") return { ...EMPTY };
  return {
    mainline: p.mainline ?? "",
    beats: Array.isArray(p.beats) ? p.beats.map((b, i) => ({ no: b.no ?? i + 1, hook: b.hook ?? "", beat: b.beat ?? "" })) : [],
    characters: Array.isArray(p.characters) ? p.characters.map((c) => ({ role: c.role === "extra" ? "extra" : "key", archetype: c.archetype ?? "", desc: c.desc ?? "" })) : [],
    hooks: Array.isArray(p.hooks) ? p.hooks.filter((x) => typeof x === "string") : [],
    notes: p.notes ?? "",
  };
}

async function prepOne(skillId) {
  const id = recipeId(skillId);
  if (exists(join(bundleDir(id), "recipe.json")) && !force) {
    const cur = readJson(join(bundleDir(id), "recipe.json"));
    if (cur?.distill?.reviewed) { console.log(`  · 跳过（已 reviewed，加 --force 覆盖）：${id}`); return; }
  }
  const flova = readFlova(skillId);
  let payload = { ...EMPTY }, method = "skeleton", model = null;
  if (!noDistill) {
    const out = await distill(flova);
    if (out) { payload = normPayload(out); method = "llm"; model = process.env.DRAMA_LLM_MODEL; }
  }
  const recipe = {
    schemaVersion: SCHEMA_VERSION,
    id,
    origin: "official",
    status: "published",
    source: {
      provider: "flova",
      skillId,
      skillName: flova.skill_name ?? null,
      description: flova.description ?? null,
      skillDescription: flova.skill_description ?? null,
      url: `https://www.flova.ai/zh-CN/skill/${skillId}`,
    },
    meta: {
      title: flova.skill_name ?? "未命名",
      summary: flova.skill_description || flova.description || "",
      typeKey: "style",
      type: "风格短片",
      ratio: "9:16",
      episodes: 1,
      coverFrom: "#7c3aed",
      coverTo: "#ec4899",
    },
    payload,
    assets: {
      cover: { local: null, publicFallback: `/recipes/${skillId}.webp`, ossKey: `media/seed/drama/recipes/flova/${skillId}.webp` },
      preview: { logicalKey: `seed/flova/skills/${skillId}.mp4`, ossKey: `media/seed/flova/skills/${skillId}.mp4`, publicUrl: null, durationSec: null, width: null, height: null, bytes: null, contentType: null },
    },
    distill: { method, model, promptVersion: "drama.recipe_extract@v1", at: nowIso(), reviewed: false },
  };
  const local = importFlovaCover(id, skillId);
  if (local) recipe.assets.cover.local = local;
  writeJson(join(bundleDir(id), "recipe.json"), recipe);
  writeJson(join(bundleDir(id), "source.json"), flova);
  console.log(`  ✓ ${id}  (${method}${local ? ", cover" : ", no-cover"})  ${recipe.meta.title}`);
}

const targets = has("--all")
  ? readdirSync(PATHS.flovaSkills).filter((f) => f.endsWith(".json")).map((f) => basename(f, ".json"))
  : (val("--skill") ? [val("--skill")] : []);
if (targets.length === 0) { console.error("用法：--skill <skillId> | --all  [--no-distill] [--force] [--prompt <path>]"); process.exit(1); }

console.log(`prep ${targets.length} 个 skill（distill=${noDistill ? "off" : "on"}）：`);
let ok = 0, fail = 0;
for (const s of targets) {
  try { await prepOne(s); ok++; }
  catch (e) { fail++; console.error(`  ✗ ${s}: ${e.message}`); }
}
console.log(`完成：成功 ${ok} / 失败 ${fail}。下一步：人工校对 payload（reviewed→true）后跑 build-seed.mjs。`);
