// 走查 5：删除 → 回收站 → 恢复 / 彻底删除（软删 30 天链路，mock）
import "./walk-setup.mjs";
import React from "react";
import { createRoot } from "react-dom/client";

const errors = [];
process.on("unhandledRejection", (e) => errors.push("unhandledRejection: " + (e && e.message || e)));

const { App } = await import("./dist/app.js");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const screens = () => $$("[data-screen-label]").map((n) => n.getAttribute("data-screen-label"));
const topScreen = () => screens()[screens().length - 1];
const click = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const clickText = (text, scope) => { const el = [...(scope || document).querySelectorAll("button")].find((b) => (b.textContent || "").includes(text)); click(el); return !!el; };
const clickTab = (label) => { const el = $$(".wx-tab").find((b) => (b.textContent || "").includes(label)); click(el); return !!el; };
let PASS = 0, FAIL = 0;
const ok = (m) => { PASS++; console.log("PASS  walk5:", m); };
const bad = (m) => { FAIL++; console.log("FAIL  walk5:", m, "| top=", topScreen()); };

const root = createRoot(document.getElementById("root"));
root.render(React.createElement(App));
await sleep(400);

// ── 1. 详情删除 → 回收站 ──
clickTab("数字人"); await sleep(250);
const firstCard = $$(".m-press")[0];
const firstName = firstCard ? (firstCard.textContent || "").slice(0, 12) : "";
click(firstCard); await sleep(400);
topScreen() === "资产详情" ? ok("打开资产详情") : bad("详情未开");
const delBtn = $$("button").find(b => (b.getAttribute("title") || "").includes("删除"));
if (delBtn) { click(delBtn); ok("详情 header 有删除入口"); } else bad("缺删除入口");
await sleep(250);
document.body.textContent.includes("移入回收站") ? ok("出现二次确认弹层") : bad("无确认弹层");
clickText("移入回收站"); await sleep(450);
topScreen() !== "资产详情" ? ok("删除后退出详情") : bad("删除后仍停留详情");

// ── 2. 我的 → 回收站 ──
clickTab("我的"); await sleep(300);
clickText("回收站") ? ok("我的页有回收站入口") : bad("缺回收站入口");
await sleep(350);
topScreen() === "回收站" ? ok("进入回收站") : bad("回收站未开");
document.body.textContent.includes("剩") && document.body.textContent.includes("天自动清理")
  ? ok("条目显示剩余天数") : bad("缺剩余天数");

// ── 3. 恢复（限定在回收站覆盖层内点击，避免命中「我的」页 MeRow 副文案）──
const trashScope = () => $$("[data-screen-label]").map(n => n).pop();
clickText("恢复", trashScope()) ? ok("点恢复") : bad("缺恢复按钮");
await sleep(400);
document.body.textContent.includes("回收站是空的") ? ok("恢复后回收站清空") : bad("恢复后仍有条目");
click($(".nav-back")); await sleep(250); // 关回收站（覆盖层打开时底部 TabBar 不渲染）
clickTab("数字人"); await sleep(300);
$$(".m-press").length > 0 ? ok("恢复的数字人回到库") : bad("库为空");

// ── 4. 再删一个 → 彻底删除 ──
click($$(".m-press")[0]); await sleep(350);
click($$("button").find(b => (b.getAttribute("title") || "").includes("删除"))); await sleep(220);
clickText("移入回收站"); await sleep(400);
clickTab("我的"); await sleep(250);
clickText("回收站"); await sleep(350);
clickText("彻底删除", trashScope()) ? ok("回收站有彻底删除") : bad("缺彻底删除");
await sleep(250);
document.body.textContent.includes("不可恢复") ? ok("彻底删除二次确认") : bad("缺二次确认");
// 弹层内的确认按钮（红色主按钮文本同为「彻底删除」→ 取最后一个）
const purgeBtns = $$("button").filter(b => (b.textContent || "").trim() === "彻底删除");
click(purgeBtns[purgeBtns.length - 1]); await sleep(400);
document.body.textContent.includes("回收站是空的") ? ok("彻底删除后清空") : bad("彻底删除未生效");

console.log(`\n----  walk-5 小计: ${PASS} PASS / ${FAIL} FAIL`);
if (errors.length) { console.log("console errors:", errors.slice(0, 3)); }
process.exit(FAIL ? 1 : 0);
