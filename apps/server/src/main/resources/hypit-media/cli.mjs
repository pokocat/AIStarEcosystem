/* Hypit media adapter. Upstream dc2b7a8f31b1ef1443a79ca448548d69e3ceb6a0; see tools/hypit-media/vendor/LICENSE and UPSTREAM.json. */

// tools/hypit-media/entry.ts
import { mkdir as mkdir2, writeFile } from "node:fs/promises";
import { resolve, join as join2 } from "node:path";

// tools/hypit-media/vendor/media-local/file-frames.ts
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// tools/hypit-media/vendor/media-local/process.ts
import { spawn } from "node:child_process";
import { once } from "node:events";
function run(executable, args, input, timeoutMs, onStderrLine, maxStdoutBytes = Number.POSITIVE_INFINITY, environment) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(executable, [...args], {
      stdio: [input === void 0 ? "ignore" : "pipe", "pipe", "pipe"],
      windowsHide: true,
      ...environment === void 0 ? {} : { env: environment }
    });
    const out = [];
    let stdoutBytes = 0;
    let err = "";
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error === void 0) resolveRun({ stdout: Buffer.concat(out), stderr: err });
      else reject(error);
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error(`${executable} timed out after ${timeoutMs} ms`));
    }, timeoutMs);
    child.stdout?.on("data", (chunk) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > maxStdoutBytes) {
        child.kill("SIGKILL");
        finish(new Error(`${executable} output exceeded the configured limit`));
        return;
      }
      out.push(chunk);
    });
    let pendingLine = "";
    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      err = `${err}${text}`.slice(-1e5);
      if (onStderrLine !== void 0) {
        const lines = `${pendingLine}${text}`.split(/\r?\n/u);
        pendingLine = lines.pop();
        for (const line of lines) onStderrLine(line);
      }
    });
    child.on("error", (error) => finish(new Error(`${executable} could not start: ${error.message}`)));
    child.on("close", (code) => {
      if (code === 0) finish();
      else finish(new Error(`${executable} exited with ${code}: ${err.trim()}`));
    });
    if (input !== void 0 && child.stdin !== null) {
      child.stdin.on("error", (error) => {
        if (error.code !== "EPIPE") finish(new Error(`${executable} input failed: ${error.message}`));
      });
      void (async () => {
        const chunks = input instanceof Uint8Array ? [input] : input;
        for await (const chunk of chunks) {
          if (!child.stdin.write(chunk)) await once(child.stdin, "drain");
        }
        child.stdin.end();
      })().catch((error) => {
        if (!(error instanceof Error && "code" in error && error.code === "EPIPE")) {
          child.kill("SIGKILL");
          finish(error instanceof Error ? error : new Error(String(error)));
        }
      });
    }
  });
}
async function runProcess(executable, args, timeoutMs = 3e5) {
  return (await run(executable, args, void 0, timeoutMs)).stdout;
}
function runProcessOutput(executable, args, timeoutMs = 3e5, onStderrLine) {
  return run(executable, args, void 0, timeoutMs, onStderrLine);
}

// tools/hypit-media/vendor/media-local/file-frames.ts
async function decodeMediaFrames(source, start, end, directory) {
  if (!Number.isFinite(start) || start < 0 || !Number.isFinite(end) || end <= start) throw new Error("Native frames need 0 <= start < end");
  await mkdir(directory, { recursive: true });
  const times = [];
  let numerator = 0, denominator = 0;
  await runProcessOutput("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "info",
    "-nostdin",
    "-copyts",
    "-start_at_zero",
    ...start > 0 ? ["-ss", String(start)] : [],
    "-i",
    source,
    "-map",
    "0:v:0",
    "-an",
    "-vf",
    `trim=start=${start}:end=${end},showinfo=checksum=0`,
    "-fps_mode",
    "passthrough",
    "-pix_fmt",
    "yuvj420p",
    "-q:v",
    "3",
    "-start_number",
    "0",
    join(directory, "%09d.jpg")
  ], 3e5, (line) => {
    const base = /config in time_base:\s*(\d+)\/(\d+)/u.exec(line);
    if (base !== null) {
      numerator = Number(base[1]);
      denominator = Number(base[2]);
    }
    const pts = /\bn:\s*\d+\s+pts:\s*(-?\d+)/u.exec(line);
    if (pts !== null && denominator > 0) times.push(Number(pts[1]) * numerator / denominator);
  });
  if (times.length === 0) throw new Error(`No video frames in [${start}, ${end}) s`);
  return times.map((at, index) => ({ at, path: join(directory, `${String(index).padStart(9, "0")}.jpg`) }));
}

// tools/hypit-media/vendor/media-local/files.ts
function round(value) {
  return Number(value.toFixed(3));
}
var DEFAULT_BOUNDARY_RATE = 12;
var DEFAULT_BOUNDARY_THRESHOLD = 0.1;
async function visualBoundaries(source, sampleRate = DEFAULT_BOUNDARY_RATE, threshold = DEFAULT_BOUNDARY_THRESHOLD) {
  const bytes = await runProcess("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    source,
    "-vf",
    `fps=${sampleRate},scale=32:32,format=rgb24`,
    "-f",
    "rawvideo",
    "-"
  ]);
  const stride = 32 * 32 * 3;
  const frames = [];
  for (let index = 0; index + stride <= bytes.byteLength; index += stride) frames.push(bytes.subarray(index, index + stride));
  const candidates = [];
  for (let index = 1; index < frames.length; index += 1) {
    const before = frames[index - 1];
    const after = frames[index];
    let total = 0;
    for (let byte = 0; byte < after.length; byte += 1) total += Math.abs(after[byte] - before[byte]);
    const score = total / after.length / 255;
    if (score >= threshold) candidates.push({ at: round(index / sampleRate), score: round(score) });
  }
  return candidates;
}

// tools/hypit-media/entry.ts
if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("Node.js 22+ required");
var revision = "dc2b7a8f31b1ef1443a79ca448548d69e3ceb6a0";
if (process.argv.includes("--version")) {
  process.stdout.write(JSON.stringify({ engine: "hypit-media", revision }) + "\n");
} else {
  const [sourceArg, directoryArg, durationArg] = process.argv.slice(2);
  if (!sourceArg || !directoryArg || !durationArg) throw new Error("Expected source, temporary directory and duration");
  const source = resolve(sourceArg), directory = resolve(directoryArg), duration = Number(durationArg);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 60) throw new Error("Unsupported duration");
  await mkdir2(directory, { recursive: true });
  const proxy = join2(directory, "proxy.mp4");
  await runProcess("ffmpeg", ["-nostdin", "-v", "error", "-copyts", "-start_at_zero", "-threads", "2", "-i", source, "-map", "0:v:0", "-an", "-vf", "scale=640:640:force_original_aspect_ratio=decrease", "-fps_mode", "passthrough", "-frames:v", "18001", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-threads", "2", "-y", proxy], 18e4);
  const frames = await decodeMediaFrames(proxy, 0, duration + 1e-3, join2(directory, "native"));
  if (frames.length > 18e3) throw new Error("Too many source frames");
  const sampleRate = Math.min(120, Math.max(24, Math.round(frames.length / duration)));
  const candidates = await visualBoundaries(proxy, sampleRate, 0.08);
  await writeFile(join2(directory, "hypit-evidence.json"), JSON.stringify({ engine: "hypit-media", revision, frames, candidates, sampleRate }));
}
