#!/usr/bin/env node
// 生成 Flova skill 目录页（catalog.html）。
// 扫描 resources/skills/all_skills_by_id 的全部 skill，按分类分组渲染成单文件 HTML。
// 用法：node scripts/build-catalog.mjs

import { join, basename } from "node:path";
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const SKILLS_ROOT = join(ROOT, "resources", "skills");
const BY_ID = join(SKILLS_ROOT, "all_skills_by_id");

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

// 分类中文名（从 manifest 读取，catch_all 作为「全部」聚合，不单列成 tab）
const manifest = readJson(join(SKILLS_ROOT, "manifest.json"));
const CAT_NAMES = {};
for (const c of manifest.categories) CAT_NAMES[c.id] = c.name;
const TAB_ORDER = manifest.categories
  .filter((c) => c.id !== "catch_all")
  .map((c) => c.id);

// 扫描 skill，构建卡片数据
const skillFiles = readdirSync(BY_ID).filter((f) => f.endsWith(".json") && !f.endsWith(".skill_content.json"));
const skills = [];
for (const f of skillFiles) {
  const id = basename(f, ".json");
  let j;
  try { j = readJson(join(BY_ID, f)); } catch { continue; }
  const coverLocal = join(SKILLS_ROOT, "covers", "by_skill_id", id, "compressed.webp");
  const cover = existsSync(coverLocal)
    ? `covers/by_skill_id/${id}/compressed.webp`
    : (j.cover_standard_url?.compressed ?? "");
  const cats = (j.attrs?.category_ids ?? []).filter((c) => c !== "catch_all" && c !== "all");
  skills.push({
    id,
    name: j.skill_name ?? id,
    desc: (j.description ?? j.skill_description ?? "").trim(),
    cover,
    cats,
    usage: j.stats?.usage_count ?? 0,
    models: (j.attrs?.model_tags ?? []).map((t) => t.name).filter(Boolean),
  });
}

const videoCount = readdirSync(join(SKILLS_ROOT, "videos")).filter((f) => f.endsWith(".mp4")).length;

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// 数据内嵌为 JS 常量，前端过滤/渲染
const DATA_JSON = JSON.stringify(skills);
const CATS_JSON = JSON.stringify(TAB_ORDER.map((id) => ({ id, name: CAT_NAMES[id] })));

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Flova Skill 目录</title>
<style>
  :root {
    --bg: #f7f7f5;
    --card: #ffffff;
    --border: #e9e7e2;
    --text: #1a1a1a;
    --muted: #8a8a86;
    --accent: #111111;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    background: var(--bg);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
    padding: 0 0 80px;
  }
  header {
    position: sticky; top: 0; z-index: 10;
    background: rgba(247,247,245,.9);
    backdrop-filter: saturate(180%) blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 20px 24px;
  }
  .wrap { max-width: 1280px; margin: 0 auto; }
  .title-row { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
  h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
  .stats { color: var(--muted); font-size: 13px; }
  .search { width: 100%; margin-top: 14px; padding: 10px 14px; font-size: 14px;
    border: 1px solid var(--border); border-radius: 10px; background: var(--card);
    outline: none; transition: border .15s; }
  .search:focus { border-color: #bbb8b0; }
  .tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
  .tab { padding: 6px 15px; font-size: 13px; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--border); background: transparent; color: #444; transition: all .15s; }
  .tab:hover { background: #efeee9; }
  .tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }
  .tab .cnt { color: var(--muted); font-size: 12px; margin-left: 4px; }
  .tab.active .cnt { color: #bbb; }
  main { padding: 24px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(215px, 1fr)); gap: 16px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px;
    overflow: hidden; cursor: pointer; transition: transform .15s, box-shadow .15s; }
  .card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,.07); }
  .thumb { position: relative; aspect-ratio: 16/10; background: #ecebe6; overflow: hidden; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .thumb .ph { display: flex; align-items: center; justify-content: center; height: 100%;
    color: #b5b3aa; font-size: 13px; }
  .card-body { padding: 12px 14px 14px; }
  .card-name { font-size: 14px; font-weight: 600; line-height: 1.35;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .card-desc { margin-top: 6px; font-size: 12px; color: var(--muted); line-height: 1.45;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .card-meta { margin-top: 10px; font-size: 11px; color: #b5b3aa; display: flex; justify-content: space-between; }
  .empty { text-align: center; color: var(--muted); padding: 60px 0; font-size: 14px; }
  /* modal */
  .mask { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 50;
    display: none; align-items: center; justify-content: center; padding: 24px; }
  .mask.on { display: flex; }
  .modal { background: #fff; border-radius: 16px; max-width: 640px; width: 100%;
    max-height: 86vh; overflow: auto; padding: 24px; }
  .modal .thumb { border-radius: 10px; aspect-ratio: 16/9; margin-bottom: 18px; }
  .modal h2 { font-size: 20px; font-weight: 700; letter-spacing: -0.2px; }
  .modal .tags { margin: 10px 0 14px; display: flex; gap: 6px; flex-wrap: wrap; }
  .modal .tag { font-size: 11px; padding: 3px 10px; border-radius: 999px; background: #f0efe9; color: #555; }
  .modal .desc { font-size: 14px; line-height: 1.7; color: #333; white-space: pre-wrap; }
  .modal .link { display: inline-block; margin-top: 18px; font-size: 13px; color: #333; text-decoration: none;
    border-bottom: 1px solid #ccc; }
  .modal .close { float: right; border: none; background: #efeee9; width: 32px; height: 32px;
    border-radius: 50%; cursor: pointer; font-size: 15px; color: #555; }
</style>
</head>
<body>
<header>
  <div class="wrap">
    <div class="title-row">
      <h1>Flova Skill 目录</h1>
      <span class="stats">${skills.length} 个 skill · ${TAB_ORDER.length} 个分类 · ${videoCount} 个演示视频</span>
    </div>
    <input class="search" id="q" placeholder="搜索 skill 名称或描述…">
    <div class="tabs" id="tabs"></div>
  </div>
</header>
<main class="wrap"><div class="grid" id="grid"></div><div class="empty" id="empty" style="display:none">没有匹配的 skill</div></main>
<div class="mask" id="mask"><div class="modal" id="modal"></div></div>
<script>
const DATA = ${DATA_JSON};
const CATS = ${CATS_JSON};
let cur = "all", query = "";
const grid = document.getElementById("grid");
const empty = document.getElementById("empty");

function renderTabs() {
  const counts = { all: DATA.length };
  for (const c of CATS) counts[c.id] = DATA.filter(s => s.cats.includes(c.id)).length;
  const tabs = [{ id: "all", name: "全部" }, ...CATS];
  document.getElementById("tabs").innerHTML = tabs.map(t =>
    '<span class="tab' + (cur === t.id ? ' active' : '') + '" data-id="' + t.id + '">' +
    esc(t.name) + '<span class="cnt">' + counts[t.id] + '</span></span>'
  ).join("");
}
function esc(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
function render() {
  const q = query.trim().toLowerCase();
  const list = DATA.filter(s => {
    if (cur !== "all" && !s.cats.includes(cur)) return false;
    if (q && !(s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q))) return false;
    return true;
  });
  empty.style.display = list.length ? "none" : "block";
  grid.innerHTML = list.map(s => {
    const img = s.cover
      ? '<img loading="lazy" src="' + esc(s.cover) + '" alt="">'
      : '<div class="ph">无封面</div>';
    const cats = s.cats.map(c => esc(CATS.find(x => x.id === c)?.name || c)).join(" · ");
    return '<div class="card" data-id="' + esc(s.id) + '">' +
      '<div class="thumb">' + img + '</div>' +
      '<div class="card-body">' +
        '<div class="card-name">' + esc(s.name) + '</div>' +
        '<div class="card-desc">' + esc(s.desc) + '</div>' +
        '<div class="card-meta"><span>' + cats + '</span><span>' + s.usage + ' 次使用</span></div>' +
      '</div></div>';
  }).join("");
}
document.getElementById("tabs").addEventListener("click", e => {
  const t = e.target.closest(".tab"); if (!t) return;
  cur = t.dataset.id; renderTabs();
  [...document.querySelectorAll(".tab")].forEach(x => x.classList.toggle("active", x.dataset.id === cur));
  render();
});
let deb;
document.getElementById("q").addEventListener("input", e => { clearTimeout(deb); deb = setTimeout(() => { query = e.target.value; render(); }, 160); });
grid.addEventListener("click", e => {
  const c = e.target.closest(".card"); if (!c) return;
  const s = DATA.find(x => x.id === c.dataset.id); if (!s) return;
  const img = s.cover ? '<div class="thumb"><img src="' + esc(s.cover) + '"></div>' : '';
  document.getElementById("modal").innerHTML =
    img +
    '<button class="close">×</button>' +
    '<h2>' + esc(s.name) + '</h2>' +
    '<div class="tags">' + (s.models.length ? s.models.map(m => '<span class="tag">' + esc(m) + '</span>').join("") : "") +
      '<span class="tag">' + s.usage + ' 次使用</span></div>' +
    '<div class="desc">' + esc(s.desc) + '</div>' +
    '<a class="link" target="_blank" href="https://www.flova.ai/zh-CN/skill/' + esc(s.id) + '">在 flova.ai 查看 ›</a>';
  document.getElementById("mask").classList.add("on");
});
const mask = document.getElementById("mask");
mask.addEventListener("click", e => { if (e.target.id === "mask" || e.target.closest(".close")) mask.classList.remove("on"); });
document.addEventListener("keydown", e => { if (e.key === "Escape") mask.classList.remove("on"); });
renderTabs(); render();
</script>
</body>
</html>`;

writeFileSync(join(SKILLS_ROOT, "catalog.html"), html, "utf8");
console.log(`已生成 catalog.html：${skills.length} 个 skill，${TAB_ORDER.length} 个分类，${videoCount} 个视频`);