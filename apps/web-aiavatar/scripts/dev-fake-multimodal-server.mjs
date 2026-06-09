#!/usr/bin/env node
// ============================================================
// 本地 fake 多模态大模型服务器（零依赖，OpenAI 兼容协议子集）
//   数字人资产平台（dap）联调用：在 admin「AI 模型与 Key」把 DAP_* 端点 baseUrl 指向本服务
//   （或用 dap-dev.sh / dap-verify.sh 的 AGNES=fake，自动 dev-seed 到 http://localhost:18181），
//   即可在无外网 / 无真实 key 时让全链路端到端跑通：
//     POST /v1/chat/completions   → 返回人设 JSON / 英文翻译
//     POST /v1/images/generations → 返回真 PNG（程序化纯色渐变，可下载落库）
//     GET  /img/:seed.png         → PNG 字节
//     POST /v1/videos             → 异步任务（两轮 in_progress 后 completed）
//     GET  /v1/videos/:id         → 状态 + video_url（内嵌微型真 mp4）
// 用法：node apps/web-aiavatar/scripts/dev-fake-multimodal-server.mjs   # 端口 18181（FAKE_MULTIMODAL_PORT 覆盖）
// ============================================================
import http from "node:http";
import zlib from "node:zlib";

const PORT = Number(process.env.FAKE_MULTIMODAL_PORT || process.env.FAKE_AGNES_PORT || 18181);
const TINY_MP4 = Buffer.from("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", "base64");

// ── 最小 PNG 编码器（真 PNG，可被 ImageIO/浏览器解码）──────────
// 标准 crc32
const CRC_TABLE = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc(buf) { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, cc]);
}
function makePng(seed, w = 384, h = 512) {
  const r0 = (seed * 73) % 200 + 30, g0 = (seed * 131) % 200 + 30, b0 = (seed * 197) % 200 + 30;
  const raw = Buffer.alloc(h * (w * 3 + 1));
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    for (let x = 0; x < w; x++) {
      const fy = y / h, fx = x / w;
      // 渐变底 + 中央人形剪影色块（让不同 seed 视觉可区分）
      let r = r0 + fy * 50, g = g0 + fx * 40, b = b0 + (1 - fy) * 60;
      const dx = fx - 0.5, dy = fy - 0.34;
      if (dx * dx + dy * dy < 0.025 || (fy > 0.55 && Math.abs(dx) < 0.26 - (fy - 0.55) * 0.1)) { r *= 0.45; g *= 0.45; b *= 0.45; }
      raw[o++] = r & 0xff; raw[o++] = g & 0xff; raw[o++] = b & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── 视频任务表 ────────────────────────────────────────────────
const videoTasks = new Map();
let taskSeq = 1;

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch { resolve({}); } });
  });
}

const PERSONA = {
  name: "星语 Sera",
  codename: "sera-stellar",
  archetype: "AI 原创 · 星界少女",
  tagline: "倾听星辰低语的观测者",
  gender: "female",
  def: {
    "年龄": "约 19 岁", "气质": "清冷 · 灵动 · 治愈", "用途": "IP 衍生 / 立绘 / 短视频",
    "性格": ["温柔", "好奇", "坚定"], "服饰": "星纱长裙 · 银白披帛", "形象来源": "AI 原创虚构",
    "设定语": "她在星轨尽头记录每一次心愿的回响。"
  },
  imagePromptEn: "an original anime-style stellar girl, silver-white hair, star-themed dress, dreamy lighting, portrait, high quality"
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;
  try {
    if (req.method === "POST" && p === "/v1/chat/completions") {
      const body = await readBody(req);
      const userMsg = (body.messages || []).filter(m => m.role === "user").map(m => m.content).join("\n");
      const sysMsg = (body.messages || []).filter(m => m.role === "system").map(m => m.content).join("\n");
      const wantsJson = /JSON|json/.test(sysMsg);
      const content = wantsJson
        ? JSON.stringify({ ...PERSONA, name: /名称：(?!（)/.test(userMsg) ? (userMsg.match(/名称：([^\n（]+)/) || [])[1]?.trim() || PERSONA.name : PERSONA.name })
        : "edit instruction: " + userMsg.slice(0, 120) + " (translated to English, keep identity)";
      return json(res, 200, { id: "chatcmpl-fake", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }], usage: { total_tokens: 64 } });
    }
    if (req.method === "POST" && p === "/v1/images/generations") {
      const body = await readBody(req);
      const seed = (JSON.stringify(body).length * 31 + Date.now()) % 9973;
      return json(res, 200, { created: Date.now(), data: [{ url: "http://localhost:" + PORT + "/img/" + seed + ".png" }] });
    }
    if (req.method === "GET" && /^\/img\/\d+\.png$/.test(p)) {
      const seed = Number(p.match(/(\d+)\.png/)[1]);
      const png = makePng(seed);
      res.writeHead(200, { "Content-Type": "image/png", "Content-Length": png.length });
      return res.end(png);
    }
    if (req.method === "POST" && p === "/v1/videos") {
      const id = "vidtask_" + taskSeq++;
      videoTasks.set(id, { polls: 0 });
      return json(res, 200, { id, status: "queued" });
    }
    if (req.method === "GET" && p.startsWith("/v1/videos/")) {
      const id = p.split("/").pop();
      const t = videoTasks.get(id);
      if (!t) return json(res, 404, { error: { message: "task not found" } });
      t.polls++;
      if (t.polls < 3) return json(res, 200, { id, status: "in_progress" });
      return json(res, 200, { id, status: "completed", video_url: "http://localhost:" + PORT + "/vid/sample.mp4", seconds: 2 });
    }
    if (req.method === "GET" && p === "/vid/sample.mp4") {
      res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": TINY_MP4.length });
      return res.end(TINY_MP4);
    }
    if (p === "/v1/models") return json(res, 200, { data: [{ id: "agnes-2.0-flash" }, { id: "agnes-image-2.1-flash" }, { id: "agnes-video-v2.0" }] });
    json(res, 404, { error: { message: "not found: " + p } });
  } catch (e) {
    json(res, 500, { error: { message: String(e) } });
  }
});

server.listen(PORT, () => console.log("[fake-multimodal] listening on http://localhost:" + PORT));
