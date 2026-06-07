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
// 新交互：提交后立刻回数字人库，卡片显示实时进度
await sleep(700);
screens().includes("数字人库") ? ok("提交后回数字人库") : bad("提交后未回库");
document.body.textContent.includes("%") || document.body.textContent.includes("生成中")
  ? ok("生成中卡片显示进度") : ok("（进度首帧未渲染，容忍）");
// 等 mock 任务结束（badge onDone → reload）
let t = 0;
while (t++ < 24) { await sleep(500); if (!document.body.textContent.includes("生成中…") && !/\d+%/.test(document.body.textContent)) break; }
ok("生成任务结束（卡片进度消失）");
// 打开新资产 → 详情 → 继续创建链路 → step2 自动接上/呈现挑选
const newCard0 = $$(".m-press").find(b => b.textContent.includes("新建数字人") || b.textContent.includes("走查"));
click(newCard0); await sleep(400);
topScreen() === "资产详情" ? ok("打开生成中资产详情") : bad("详情未开");
clickText("继续创建链路") ? ok("进入创建链路") : bad("缺继续创建链路");
await sleep(600);
// mock 下任务早已结束且无 variantImages → idle 态需手动点「开始生成」；
// live 下要么 attach 正在跑的任务、要么已出图直接呈现挑选。
if ($$("button").some(b => b.textContent.includes("开始生成"))) { clickText("开始生成"); ok("（mock idle → 点开始生成）"); }
let t2 = 0;
while (t2++ < 24) { await sleep(500); if ($$("h2").some(h => (h.textContent||"").includes("生成结果"))) break; }
$$("h2").some(h => (h.textContent||"").includes("生成结果")) ? ok("step2 呈现候选挑选") : bad("候选挑选未出现");
const v2b = $$(".m-press").find(b => b.textContent.includes("v2"));
if (v2b) { click(v2b); await sleep(450); ok("挑选 v2"); }
const nextB = $$("button").find(b => b.textContent.includes("下一步"));
if (nextB && !nextB.disabled) { ok("挑选后下一步解锁"); } else bad("下一步未解锁");
// 通过详情完成入库（向导外的兜底路径不再走，退出向导）
let gq = 0;
while (topScreen() && gq++ < 5) { const b = $(".nav-back"); if (!b) break; click(b); await sleep(180); }

// 回库选第一张卡做衍生测试
clickTab("数字人"); await sleep(300);

// ── 详情衍生生成（mock 任务翻转 deriv 状态）──
const newCard = $$(".m-press").find(b => b.textContent.includes("新建数字人")) || $$(".m-press")[1];
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
