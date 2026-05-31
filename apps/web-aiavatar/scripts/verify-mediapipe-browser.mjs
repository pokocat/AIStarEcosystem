// 真浏览器验证：MediaPipe FaceLandmarker 在 Chromium 中实际加载 WASM + 模型，
// 对一张合成正面脸检测出 478 关键点，并验证「眼在脸上方、左右分明」（供 face-warp 锚点驱动）。
//
// 用现有 Chromium（/opt/pw-browsers）+ playwright-core。为不依赖外网且测真实路径，
// 本脚本起一个本地 http 服务，把 node_modules 里的 @mediapipe/tasks-vision（vision_bundle.mjs +
// wasm/* + 已缓存的 model.task）就地伺服 —— 走的就是 app 自托管（NEXT_PUBLIC_MEDIAPIPE_*）那条路径。
// 模型文件若本地不存在则尝试一次性从官方地址下载到 .cache。
//
// 运行：node apps/web-aiavatar/scripts/verify-mediapipe-browser.mjs
// 退出码 0=真实检测通过；1=检测未通过；2=环境不可用（skip，不阻断）。

import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, join, extname } from "node:path";

const APP_DIR = resolve(import.meta.dirname, "..");
const REPO = resolve(APP_DIR, "../..");
const MP = resolve(REPO, "node_modules/.pnpm/@mediapipe+tasks-vision@0.10.35/node_modules/@mediapipe/tasks-vision");
const MODEL_CACHE = resolve(APP_DIR, ".cache/face_landmarker.task");
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

function findChrome() {
  for (const d of readdirSync("/opt/pw-browsers")) {
    if (d.startsWith("chromium-")) return `/opt/pw-browsers/${d}/chrome-linux/chrome`;
  }
  throw new Error("no chromium under /opt/pw-browsers");
}

if (!existsSync(MP)) { console.error("[skip] @mediapipe/tasks-vision 未安装"); process.exit(2); }

// 确保模型在本地（一次性下载缓存）。
if (!existsSync(MODEL_CACHE)) {
  try {
    console.log("下载 face_landmarker 模型 …");
    const r = await fetch(MODEL_URL);
    if (!r.ok) throw new Error("model http " + r.status);
    mkdirSync(resolve(APP_DIR, ".cache"), { recursive: true });
    writeFileSync(MODEL_CACHE, Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    console.error("[skip] 无法获取模型:", String((e && e.message) || e));
    process.exit(2);
  }
}

const MIME = { ".mjs": "text/javascript", ".js": "text/javascript", ".wasm": "application/wasm", ".task": "application/octet-stream", ".html": "text/html" };

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let body, ct;
  if (url.pathname === "/") {
    ct = "text/html";
    body = "<!doctype html><html><head><meta charset=utf-8></head><body>mp</body></html>";
  } else if (url.pathname === "/model.task") {
    ct = MIME[".task"]; body = readFileSync(MODEL_CACHE);
  } else if (url.pathname.startsWith("/mp/")) {
    const p = join(MP, url.pathname.slice(4));
    if (!existsSync(p)) { res.writeHead(404); return res.end("nf"); }
    ct = MIME[extname(p)] || "application/octet-stream"; body = readFileSync(p);
  } else { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "content-type": ct, "access-control-allow-origin": "*" });
  res.end(body);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;

const IN_PAGE = async (origin) => {
  const logs = [];
  try {
    const { FaceLandmarker, FilesetResolver } = await import(`${origin}/mp/vision_bundle.mjs`);
    const fileset = await FilesetResolver.forVisionTasks(`${origin}/mp/wasm`);
    const landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${origin}/model.task`, delegate: "CPU" },
      runningMode: "IMAGE", numFaces: 1,
    });
    logs.push("landmarker ready");
    const W = 360, H = 420;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = "#15161a"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#e8c4a0"; g.beginPath(); g.ellipse(W / 2, H / 2, 110, 145, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#5a3a22"; g.lineWidth = 6;
    g.beginPath(); g.moveTo(120, 165); g.quadraticCurveTo(145, 152, 170, 165); g.stroke();
    g.beginPath(); g.moveTo(190, 165); g.quadraticCurveTo(215, 152, 240, 165); g.stroke();
    for (const ex of [145, 215]) {
      g.fillStyle = "#fff"; g.beginPath(); g.ellipse(ex, 188, 24, 13, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#3a2a1a"; g.beginPath(); g.arc(ex, 188, 8, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = "#b58a64"; g.lineWidth = 4;
    g.beginPath(); g.moveTo(180, 195); g.lineTo(172, 240); g.quadraticCurveTo(180, 250, 192, 242); g.stroke();
    g.strokeStyle = "#a04a3a"; g.lineWidth = 6;
    g.beginPath(); g.moveTo(150, 285); g.quadraticCurveTo(180, 305, 215, 285); g.stroke();
    const res = landmarker.detect(c);
    const faces = res.faceLandmarks || [];
    if (!faces.length) return { ok: false, reason: "no_face", logs };
    const lm = faces[0];
    logs.push("landmarks=" + lm.length);
    const leftEyeX = lm[468].x * W, leftEyeY = lm[468].y * H, rightEyeX = lm[473].x * W, chinY = lm[152].y * H;
    logs.push(`leftEye=(${leftEyeX.toFixed(0)},${leftEyeY.toFixed(0)}) rightEyeX=${rightEyeX.toFixed(0)} chinY=${chinY.toFixed(0)}`);
    return { ok: lm.length >= 468 && leftEyeX < rightEyeX && leftEyeY < chinY, landmarkCount: lm.length, logs };
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e), logs };
  }
};

let browser;
try {
  browser = await chromium.launch({ executablePath: findChrome(), args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage();
  page.on("console", (m) => { if (m.type() === "error") console.error("  [page]", m.text()); });
  await page.goto(`${origin}/`, { waitUntil: "load", timeout: 30000 });
  const result = await page.evaluate(IN_PAGE, origin);
  console.log("=== MediaPipe 真浏览器验证（本地自托管 WASM+模型）===");
  (result.logs || []).forEach((l) => console.log("  " + l));
  console.log("result:", JSON.stringify({ ok: result.ok, landmarkCount: result.landmarkCount, reason: result.reason }));
  await browser.close(); server.close();
  process.exit(result.ok ? 0 : 1);
} catch (e) {
  console.error("[skip] 浏览器不可用:", String((e && e.message) || e));
  if (browser) await browser.close().catch(() => {});
  server.close();
  process.exit(2);
}
