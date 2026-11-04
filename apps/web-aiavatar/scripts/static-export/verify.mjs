// Opens the unzipped package the way a person would: every page, then the flows that have to work. Exit 1 on any problem.
// usage: node verify.mjs <unzipped package dir> <checkout with node_modules>
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";

const [packageDir, checkout] = process.argv.slice(2);
const pnpmDir = path.join(checkout, "node_modules/.pnpm");
const entry = fs.readdirSync(pnpmDir).find((d) => d.startsWith("puppeteer-core@"));
if (!entry) throw new Error("依赖里没有 puppeteer-core，无法验收");
const puppeteerPath = path.join(pnpmDir, entry, "node_modules/puppeteer-core");
const puppeteer = createRequire(path.join(puppeteerPath, "package.json"))(puppeteerPath);
const chrome = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.on("error", reject);
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const port = await freePort();
const base = `http://localhost:${port}`;
const server = spawn("python3", ["-I", "serve.py", String(port), "--no-open"], { cwd: packageDir, stdio: "ignore" });
const problems = [];
const check = (name, ok, detail = "") => { console.log(`${ok ? "通过" : "失败"}  ${name}${detail ? "  " + detail : ""}`); if (!ok) problems.push(name); };

async function until(fn, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await fn().catch(() => false);
    if (value || Date.now() > end) return value;
    await wait(300);
  }
}

let browser;
try {
  const up = await until(() => fetch(`${base}/pages.html`).then((r) => r.ok));
  if (!up) throw new Error("serve.py 没有启动");
  browser = await puppeteer.launch({ headless: true, executablePath: chrome, defaultViewport: { width: 1440, height: 900 } });

  const watch = (page, bad) => {
    page.on("response", (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().replace(base, "").slice(0, 110)}`); });
    page.on("requestfailed", (r) => { if (!/fonts\.g|aborted/i.test(r.url() + r.failure()?.errorText)) bad.push(`网络失败 ${r.url().replace(base, "").slice(0, 110)}`); });
    page.on("pageerror", (e) => bad.push(`脚本错误 ${String(e.message).slice(0, 110)}`));
  };

  // ── every page: loads without a stalled load event, no missing endpoint, no script error, no crash screen ──
  const pages = ["/", "/dashboard", "/video", "/image", "/create", "/scenes", "/projects", "/projects/demos", "/projects/IPP-0001mock", "/projects/IPP-0002mock", "/projects/IPP-0003mock", "/templates", "/assets", "/assets/DH-2041", "/ips", "/market/PA-01", "/stars/auth-mk01", "/distribution", "/distribution/accounts", "/distribution/records", "/director", "/director/DW-demo01", "/director/trash", "/enterprise", "/enterprise/invite#token=demo", "/invitations", "/invite/demo", "/licenses", "/me", "/studio", "/cards", "/cards/demo/edit", "/card/p/demo", "/discover", "/shared/conversations/demo"];
  for (const url of pages) {
    const page = await browser.newPage();
    const bad = [];
    watch(page, bad);
    await page.goto(base + url, { waitUntil: "load", timeout: 20000 }).catch((e) => bad.push(String(e.message).slice(0, 80)));
    await wait(1800);
    const text = await page.evaluate(() => document.body.innerText || "");
    check(url, !bad.length && !text.includes("couldn’t load") && text.trim().length > 0, [...new Set(bad)].join(" | "));
    await page.close();
  }

  // ── flows ──
  const p = await browser.newPage();
  const bad = [];
  watch(p, bad);
  p.on("dialog", (d) => d.accept()); // "Leave site?" when moving on from a canvas with unsaved edits
  const open = async (url) => { await p.goto(base + url, { waitUntil: "load", timeout: 20000 }); await wait(1500); };
  const clickText = (text) => until(() => p.evaluate((t) => {
    const e = [...document.querySelectorAll("button,a")].find((x) => (x.innerText || "").includes(t) && x.offsetParent && !x.disabled);
    if (!e) return false;
    e.click();
    return true;
  }, text));
  const placeholderImage = () => until(() => p.evaluate(() => !!document.querySelector('img[src^="data:image/svg"]')));
  const typeInto = async (selector, text) => { const box = await p.waitForSelector(selector, { timeout: 8000 }); await box.click(); await p.keyboard.type(text); await wait(500); };

  await open("/create");
  check("新建画布：进入一个没有预生成页面的画布", (await clickText("新建画布")) && await until(() => p.evaluate(() => /^\/projects\/IPP-/.test(location.pathname))));
  const canvasUrl = p.url();
  await wait(2000);
  await p.reload({ waitUntil: "load" });
  await wait(2000);
  check("新建画布：刷新后还在", p.url() === canvasUrl && await until(() => p.evaluate(() => !!document.querySelector("textarea"))));

  await typeInto("textarea", "帮我做一张海报：一只橘猫坐在窗台上");
  await p.keyboard.press("Enter");
  check("助手：给出确认卡", await clickText("开始制作"));
  check("助手：结果落到画布上", await placeholderImage());

  await open("/image?scene=free");
  await typeInto("textarea", "一只橘猫坐在窗台上");
  check("AI 图片：确认费用", (await clickText("生成")) && await clickText("确认并支付"));
  check("AI 图片：出现结果", await placeholderImage());

  const catalog = JSON.parse(fs.readFileSync(path.join(checkout, "apps/server/src/main/resources/ipstudio/scenes.json"), "utf8"));
  const scene = catalog.video.find((v) => !v.images?.required && !v.video?.required);
  await open(`/video?scene=${scene.id}`);
  await typeInto('[contenteditable="true"],textarea', "第1镜（0–5 秒）：一只橘猫走过窗台");
  check("AI 视频：确认费用", (await clickText("生成视频")) && await clickText("确认并支付"));
  check("AI 视频：能播放结果", await until(() => p.evaluate(() => [...document.querySelectorAll("video")].some((v) => v.src.includes("sample-video") && v.readyState >= 1)), 20000));

  await open("/director/DW-demo01");
  check("导演台：打开示例作品", await until(() => p.evaluate(() => !!document.querySelector("video,img"))));

  await open("/dashboard?ui=new");
  check("新版界面：切换生效", await p.evaluate(() => document.documentElement.getAttribute("data-ui") === "next"));
  await open("/dashboard?ui=old");

  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await open("/dashboard");
  check("手机版：按手机形态显示", await p.evaluate(() => document.documentElement.getAttribute("data-layout") !== "desktop"));

  check("流程中没有缺接口或脚本错误", !bad.length, [...new Set(bad)].join(" | "));
} finally {
  await browser?.close();
  server.kill();
}

if (problems.length) {
  console.error(`\n验收失败 ${problems.length} 项：\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("\n验收全部通过");
