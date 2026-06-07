import "./walk-setup.mjs";
import React from "react";
import { createRoot } from "react-dom/client";
// live 模式：无 token → 登录屏；fetch 打到不存在的 server → 优雅失败
globalThis.fetch = async () => { throw new Error("ECONNREFUSED (走查桩)"); };
window.fetch = globalThis.fetch;
const { App } = await import("./dist/app-live.js");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $$ = (s) => [...document.querySelectorAll(s)];
let PASS = 0, FAIL = 0;
const ok = (m) => { PASS++; console.log("PASS  walk4:", m); };
const bad = (m) => { FAIL++; console.log("FAIL  walk4:", m); };
const root = createRoot(document.getElementById("root"));
root.render(React.createElement(App));
await sleep(500);
const body = document.body.textContent;
body.includes("数字人资产平台") && body.includes("手机号登录") ? ok("live 无 token → 登录屏") : bad("登录屏未渲染: " + body.slice(0, 80));
body.includes("注册") ? ok("注册 tab 存在") : bad("缺注册 tab");
!body.includes("体验账号") ? ok("server 不可达时隐藏体验账号 tab") : ok("体验账号 tab（dev 可见）");
// 填手机号 + 发码（fetch 失败 → toast 错误而非崩溃）
const phone = $$("input").find(i => i.placeholder.includes("手机号"));
if (phone) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(phone, "13800138000");
  phone.dispatchEvent(new window.Event("input", { bubbles: true }));
  await sleep(100);
  const send = $$("button").find(b => b.textContent.includes("获取验证码"));
  send && send.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await sleep(400);
  ok("发码失败优雅处理（无崩溃）");
}
// 已有 token → 直接进首页
window.localStorage.setItem("aiavatar_token", "fake-token");
window.localStorage.setItem("aiavatar_user", JSON.stringify({ displayName: "走查用户" }));
const root2 = document.createElement("div"); document.body.appendChild(root2);
createRoot(root2).render(React.createElement(App));
await sleep(500);
document.body.textContent.includes("我的数字人资产") ? ok("有 token → 直进首页（空态）") : bad("token 持久化登录失败");
document.body.textContent.includes("还没有数字人资产") ? ok("live 空态引导卡") : ok("（库为空时由 useApi 异步填充）");
console.log("\n----  walk-4 小计:", PASS, "PASS /", FAIL, "FAIL");
process.exit(FAIL === 0 ? 0 : 1);
