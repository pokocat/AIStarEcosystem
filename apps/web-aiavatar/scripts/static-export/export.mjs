#!/usr/bin/env node
// Exports Studio (web-aiavatar) as a static demo: no backend, no login, sample data. See README.md next to this file.
// Works on a throwaway checkout of --ref, so the current working tree is neither read nor changed.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyTransforms } from "./transforms.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", ...opts });
const out = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", ...opts }).trim();
const step = (text) => console.log(`\n── ${text}`);

function options(argv) {
  const o = { ref: "origin/main", out: null, keep: false, verify: true, fetch: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--ref") o.ref = argv[++i];
    else if (a === "--out") o.out = path.resolve(argv[++i]);
    else if (a === "--keep") o.keep = true;
    else if (a === "--no-verify") o.verify = false;
    else if (a === "--no-fetch") o.fetch = false;
    else throw new Error(`不认识的参数：${a}\n用法：export.mjs [--ref origin/main] [--out 目录] [--no-fetch] [--no-verify] [--keep]`);
  }
  return o;
}

async function downloadFonts(app) {
  const css = fs.readFileSync(path.join(app, "src/styles/ip-display-font.css"), "utf8");
  const files = [...new Set([...css.matchAll(/noto-serif-sc\/([^"]+\.woff2)/g)].map((m) => m[1]))];
  const base = "https://aiartist.oss-cn-hangzhou.aliyuncs.com/media/ipstudio/fonts/noto-serif-sc-v36/";
  const dir = path.join(app, "public/ip-fonts/noto-serif-sc");
  fs.mkdirSync(dir, { recursive: true });
  const queue = [...files];
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let name = queue.shift(); name; name = queue.shift()) {
      const res = await fetch(base + name, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`字体下载失败 ${res.status}：${name}`);
      fs.writeFileSync(path.join(dir, name), Buffer.from(await res.arrayBuffer()));
    }
  }));
  console.log(`字体 ${files.length} 个`);
}

/** Five seconds generated from an image already in the app, so no media file lives in git. */
function sampleVideo(app) {
  run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-i", path.join(app, "public/generated/avatar-previews/example-lin-xiaoman.jpg"),
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "5",
    "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0008,1.12)':d=125:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=720x1280:fps=25,format=yuv420p",
    "-c:v", "libx264", "-crf", "28", "-preset", "veryfast", "-c:a", "aac", "-b:a", "48k", "-shortest", "-movflags", "+faststart", path.join(app, "public/sample-video.mp4")]);
}

function assemble({ app, routes, commit, date, zipPath }) {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "studio-static-"));
  const dir = path.join(stage, "Studio静态版");
  fs.cpSync(path.join(here, "package"), dir, { recursive: true });
  fs.cpSync(path.join(app, "out"), path.join(dir, "site"), { recursive: true });
  fs.renameSync(path.join(dir, "pages.html"), path.join(dir, "site/pages.html"));
  fs.writeFileSync(path.join(dir, "routes.json"), JSON.stringify(routes, null, 2));
  const notes = path.join(dir, "使用说明.txt");
  fs.writeFileSync(notes, fs.readFileSync(notes, "utf8").replace("{{COMMIT}}", commit).replace("{{DATE}}", date));
  fs.chmodSync(path.join(dir, "启动-Mac.command"), 0o755);
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  fs.rmSync(zipPath, { force: true });
  run("zip", ["-qry", zipPath, "Studio静态版"], { cwd: stage });
  return stage;
}

const opts = options(process.argv.slice(2));
const repo = out("git", ["rev-parse", "--show-toplevel"], { cwd: here });
const stamp = new Date();
const date = `${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, "0")}-${String(stamp.getDate()).padStart(2, "0")}`;
const zipPath = path.join(opts.out ?? path.join(repo, ".studio-e2e/static-export"), `Studio静态版-${date.replaceAll("-", "")}.zip`);
const checkout = path.join(path.dirname(repo), `${path.basename(repo)}-static-export-${Date.now()}`);
const stages = [];

if (opts.fetch) {
  // A stale ref must not pass for the latest code without anyone noticing.
  try { run("git", ["fetch", "origin", "main", "-q"], { cwd: repo }); }
  catch { console.warn(`\n⚠️ 拉取 origin/main 失败，继续用本机已有的 ${opts.ref}，它可能不是远端最新。`); }
}
const commit = out("git", ["rev-parse", "--short", opts.ref], { cwd: repo });
step(`导出 ${opts.ref}（${commit}）`);

let failed = false;
try {
  run("git", ["worktree", "add", "-q", "--detach", checkout, opts.ref], { cwd: repo });
  const app = path.join(checkout, "apps/web-aiavatar");

  step("修改临时工作区");
  const routes = applyTransforms(checkout, path.join(here, "overlay"));
  console.log(`带参数的页面 ${routes.length} 个：${routes.join("  ")}`);
  await downloadFonts(app);
  sampleVideo(app);

  step("安装依赖");
  run("pnpm", ["install", "--frozen-lockfile", "--filter", "@ai-star-eco/web-aiavatar..."], { cwd: checkout });

  step("构建");
  run("pnpm", ["build"], { cwd: app, env: { ...process.env, NEXT_PUBLIC_USE_MOCK: "1", NEXT_PUBLIC_ENTERPRISE_ENABLED: "1", NEXT_TELEMETRY_DISABLED: "1" } });

  step("打包");
  stages.push(assemble({ app, routes, commit, date, zipPath }));
  console.log(`${zipPath}（${Math.round(fs.statSync(zipPath).size / 1048576)} MB）`);

  if (opts.verify) {
    step("解压后验收");
    const unzipped = fs.mkdtempSync(path.join(os.tmpdir(), "studio-static 验收-"));
    stages.push(unzipped);
    run("unzip", ["-q", zipPath], { cwd: unzipped });
    run(process.execPath, [path.join(here, "verify.mjs"), path.join(unzipped, "Studio静态版"), checkout]);
  } else {
    console.warn("⚠️ 跳过了验收（--no-verify），这个包没有被打开过。");
  }
} catch (error) {
  failed = true;
  console.error(`\n导出失败：${error.message}`);
} finally {
  for (const dir of stages) fs.rmSync(dir, { recursive: true, force: true });
  if (opts.keep) console.log(`临时工作区保留在 ${checkout}`);
  else if (fs.existsSync(checkout)) run("git", ["worktree", "remove", "--force", checkout], { cwd: repo });
}
if (failed) process.exit(1);
console.log(`\n完成：${zipPath}\n代码版本：${opts.ref}（${commit}）`);
