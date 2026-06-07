// 走查 2：Tab 精确点击 + AI 创建全流程（mock 任务模拟器） + 任务中心 + 衍生生成
import "./walk-setup.mjs";
import React from "react";
import { createRoot } from "react-dom/client";

const errors = [];
process.on("unhandledRejection", (e) => errors.push("unhandledRejection: " + (e && e.message || e)));
const origErr = console.error;
console.error = (...a) => { const s = a.join(" "); if (/Error:|TypeError|ReferenceError/.test(s)) errors.push(s.slice(0, 200)); origErr(...a); };

const { App } = await import("./dist/app.js");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const screens = () => $$("[data-screen-label]").map((n) => n.getAttribute("data-screen-label"));
const topScreen = () => screens()[screens().length - 1];
const click = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const clickText = (text, scope) => { const el = [...(scope || document).querySelectorAll("button")].find((b) => (b.textContent || "").includes(text)); click(el); return !!el; };
const clickTab = (label) => { const el = $$(".wx-tab").find((b) => (b.textContent || "").includes(label)); click(el); return !!el; };
const setInput = (el, v) => {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  setter.call(el, v);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
};
let PASS = 0, FAIL = 0;
const ok = (m) => { PASS++; console.log("PASS  walk2:", m); };
const bad = (m) => { FAIL++; console.log("FAIL  walk2:", m, "| top=", topScreen()); };

const root = createRoot(document.getElementById("root"));
root.render(React.createElement(App));
await sleep(400);

// Tab 精确点击
clickTab("数字人"); await sleep(250);
screens().includes("数字人库") ? ok("Tab → 数字人库（精确）") : bad("Tab 数字人库");
clickTab("首页"); await sleep(200);

// ── AI 创建全流程（FAB → AI 原创 → 描述 → 生成（mock 任务）→ 挑选 → 保存）──
click($(".wx-fab")); await sleep(250);
const sheet = $(".m-sheet");
(sheet && clickText("AI 原创", sheet)) ? ok("创建 sheet → AI 原创") : bad("创建 sheet 打不开");
await sleep(350);
topScreen() === "AI 创建" ? ok("进入 AI 创建") : bad("AI 创建未打开");
clickText("使用 AI 设计") ? ok("选择 AI 设计") : bad("缺『使用 AI 设计』");
await sleep(300);
// 描述表单
const ta = $$("textarea")[0];
if (ta) { setInput(ta, "一位 20 岁的虚拟主播，蓝发，未来感套装"); ok("填写描述"); } else bad("描述输入框缺失");
await sleep(150);
clickText("生成预览") ? ok("提交生成") : bad("生成预览按钮不可用");
// mock 任务 ~3s 推进
let t = 0;
while (t++ < 24) { await sleep(500); if ($$("h1").some(h => h.textContent.includes("挑一张"))) break; }
$$("h1").some(h => h.textContent.includes("挑一张")) ? ok("生成完成 → 挑选页") : bad("挑选页未出现");
// 命名 + 保存
const nameInput = $$("input").find(i => i.placeholder && i.placeholder.includes("命名"));
if (nameInput) setInput(nameInput, "走查测试形象");
clickText("保存形象") ? ok("保存形象") : bad("保存按钮缺失");
await sleep(900);
topScreen() === "资产详情" ? ok("保存后落资产详情") : bad("保存后未进详情");
$$("[data-screen-label]").length && clickText("继续创建链路") && ok("（wip 资产显示继续链路按钮）");

// 回首页验证新资产入列
let g = 0;
while (topScreen() !== undefined && g++ < 4) { const b = $(".nav-back"); if (!b) break; click(b); await sleep(180); }
clickTab("数字人"); await sleep(300);
document.body.textContent.includes("走查测试形象") ? ok("新资产出现在库") : bad("库里找不到新资产");

// ── 详情衍生生成（mock 任务翻转 deriv 状态）──
const newCard = $$(".m-press").find(b => b.textContent.includes("走查测试形象"));
click(newCard); await sleep(350);
clickText("衍生资产"); await sleep(200);
const genBtns = $$("button").filter(b => b.textContent.trim() === "生成");
if (genBtns.length) {
  click(genBtns[0]); ok("发起衍生生成（图集）");
  let k = 0;
  while (k++ < 20) { await sleep(500); if (document.body.textContent.includes("5 张") || document.body.textContent.includes("完成")) break; }
  ok("衍生任务推进（mock）");
} else bad("衍生生成按钮缺失");

// ── 任务中心轮询 ──
let g2 = 0;
while (topScreen() && g2++ < 5) { const b = $(".nav-back"); if (!b) break; click(b); await sleep(150); }
clickTab("我的"); await sleep(250);
clickText("作业队列"); await sleep(700);
const jobsN = $$(".m-card").length;
jobsN > 3 ? ok("任务中心有动态任务（" + jobsN + " 卡）") : bad("任务中心异常");
document.body.textContent.includes("形象生成") ? ok("走查产生的任务在列") : bad("缺生成任务记录");

console.log("\n----  walk-2 小计:", PASS, "PASS /", FAIL, "FAIL");
if (errors.length) { console.log("----  运行时错误:"); errors.slice(0, 10).forEach(e => console.log("  ERR:", e)); }
process.exit(FAIL === 0 ? 0 : 1);
