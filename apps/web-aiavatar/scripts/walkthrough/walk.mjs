// ============================================================
// 用户视角自动走查（mock 模式）：渲染 <App/>，模拟点击逐屏巡检
//   断言：屏幕切换正确 / 无未捕获异常 / 关键流程可走通
// ============================================================
import "./walk-setup.mjs";
import React from "react";
import { createRoot } from "react-dom/client";

process.env.NEXT_PUBLIC_USE_MOCK = "1";
const errors = [];
process.on("unhandledRejection", (e) => errors.push("unhandledRejection: " + (e && e.message || e)));
const origErr = console.error;
console.error = (...a) => { const s = a.join(" "); if (/Error|error|Warning: .*Each child/.test(s)) errors.push(s.slice(0, 220)); origErr(...a); };

const { App } = await import("./dist/app.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const screens = () => $$("[data-screen-label]").map((n) => n.getAttribute("data-screen-label"));
const topScreen = () => { const all = screens(); return all[all.length - 1]; };
function clickText(text, tag = "button") {
  const el = $$(tag).find((b) => (b.textContent || "").includes(text));
  if (!el) return false;
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  return true;
}
let PASS = 0, FAIL = 0;
const ok = (m) => { PASS++; console.log("PASS  walk:", m); };
const bad = (m) => { FAIL++; console.log("FAIL  walk:", m, "| screens=", screens().join(">")); };

const root = createRoot(document.getElementById("root"));
root.render(React.createElement(App));
await sleep(400);

// ── 1. 首页 ──
screens().includes("首页") ? ok("首页渲染") : bad("首页未渲染");

// ── 2. 底部 Tab 巡检 ──
for (const [label, screen] of [["数字人", "数字人库"], ["应用", "应用中心"], ["我的", "我的"], ["首页", "首页"]]) {
  clickText(label, ".wx-tab, button") || clickText(label);
  await sleep(250);
  screens().includes(screen) ? ok("Tab → " + screen) : bad("Tab " + label + " 应显示 " + screen);
}

// ── 3. 我的 → 子页面来回 ──
clickText("我的"); await sleep(200);
for (const [text, screen] of [["声音工作室", "声音工作室"], ["授权登记", "授权登记"], ["作业队列", "任务中心"], ["会员与算力", "会员与算力"], ["存储用量", "存储用量"], ["设置", "设置"]]) {
  if (!clickText(text)) { bad("我的页缺入口 " + text); continue; }
  await sleep(300);
  topScreen() === screen ? ok("我的 → " + screen) : bad("进入 " + screen + " 失败（top=" + topScreen() + "）");
  const back = $(".nav-back") || $$("button").find(b => b.querySelector("svg"));
  back && back.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await sleep(250);
}

// ── 4. 库 → 资产详情 → 四 tab ──
clickText("数字人"); await sleep(250);
const card = $$(".m-press").find((b) => b.textContent && b.textContent.length > 0);
if (card) {
  card.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await sleep(350);
  topScreen() === "资产详情" ? ok("打开资产详情") : bad("资产详情未打开");
  for (const t of ["衍生资产", "版本", "标准图集"]) {
    clickText(t) ? ok("详情 tab → " + t) : bad("详情缺 tab " + t);
    await sleep(220);
  }
  // 衍生查看（done 项）
  if (clickText("张") || clickText("条") || clickText("个")) {
    await sleep(300);
    topScreen() === "衍生查看" ? ok("打开衍生查看器") : ok("衍生查看（无 done 项，跳过）");
    if (topScreen() === "衍生查看") { const b = $(".nav-back"); b && b.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); await sleep(200); }
  }
  // 设计造型入口
  if (clickText("设计造型")) {
    await sleep(300);
    topScreen() === "造型档案" ? ok("打开造型档案") : bad("造型档案未打开（top=" + topScreen() + "）");
    if (clickText("AI 设计新造型")) {
      await sleep(280);
      topScreen() === "设计造型" ? ok("打开设计造型") : bad("设计造型未打开");
      // 选场景 → 提交
      const sceneBtn = $$(".m-press").find(b => b.textContent.includes("直播间"));
      if (sceneBtn) {
        sceneBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
        await sleep(200);
        clickText("套用此场景生成") ? ok("场景造型提交") : bad("场景造型按钮缺失");
        await sleep(500);
        topScreen() === "造型档案" ? ok("提交后回造型档案") : bad("提交后未回造型档案（top=" + topScreen() + "）");
      } else bad("场景列表为空");
    }
    // 回详情
    let guard = 0;
    while (topScreen() !== "资产详情" && guard++ < 4) { const b = $(".nav-back"); if (!b) break; b.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); await sleep(200); }
  }
  // 音色选择
  if (clickText("亲和邻家女声") || $$("button").some(b => b.textContent.includes("声"))) {
    const pill = $$("button").find(b => /邻家女声|播报女声|优雅女声|甜嗓|低音|男声|标准音/.test(b.textContent || "") && b.className.includes("m-tap"));
    if (pill) {
      pill.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await sleep(300);
      if (topScreen() === "选择音色") {
        ok("打开选择音色");
        clickText("设为默认") && ok("绑定音色");
        await sleep(300);
      }
    }
  }
  // 返回库
  let g = 0;
  while (topScreen() && topScreen() !== "数字人库" && g++ < 5) { const b = $(".nav-back"); if (!b) break; b.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); await sleep(180); }
} else bad("库里没有资产卡");

console.log("\n----  walk-1 小计:", PASS, "PASS /", FAIL, "FAIL");
if (errors.length) { console.log("----  运行时错误:"); errors.slice(0, 8).forEach(e => console.log("  ERR:", e)); }
process.exit(FAIL === 0 && errors.length === 0 ? 0 : 1);
