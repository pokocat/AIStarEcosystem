// ─────────────────────────────────────────────────────────────────────────────
// setup-mediapipe.mjs — 把 @mediapipe/tasks-vision 的 WASM 从 node_modules 拷到
// public/mediapipe/wasm/，让精调工作台的人脸关键点检测**同源加载、离线可用、版本永远匹配**
// （避免依赖外网 jsDelivr CDN —— 网络策略一挡就回退到启发式锚点、形变不准）。
//
// 无网络依赖：只读 node_modules（pnpm install 后必然存在）。predev / prebuild 自动跑。
// face_landmarker.task 模型体积小，直接提交在 public/mediapipe/（保证无网构建也可用）。
// ─────────────────────────────────────────────────────────────────────────────
import { createRequire } from "node:module";
import { cpSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

try {
  // package 的 exports 不暴露 ./package.json，故解析 main 入口再向上找含 wasm 的包根。
  const mainEntry = require.resolve("@mediapipe/tasks-vision");
  let dir = path.dirname(mainEntry);
  let root = null;
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, "wasm"))) {
      root = dir;
      break;
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  if (!root) {
    console.warn("[mediapipe] wasm dir not found near", mainEntry, "— 跳过（精调将回退启发式锚点）");
    process.exit(0);
  }
  const dest = path.join(process.cwd(), "public", "mediapipe", "wasm");
  mkdirSync(dest, { recursive: true });
  cpSync(path.join(root, "wasm"), dest, { recursive: true });
  let ver = "?";
  try {
    ver = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
  } catch {
    /* ignore */
  }
  console.log(`[mediapipe] copied tasks-vision@${ver} wasm → ${dest}`);
} catch (e) {
  // 不阻断 dev/build：缺失时运行期回退启发式锚点（仍可用，只是不那么准）。
  console.warn("[mediapipe] setup skipped:", e?.message ?? e);
  process.exit(0);
}
