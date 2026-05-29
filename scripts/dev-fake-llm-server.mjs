#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// dev-fake-llm-server.mjs — 本地联调用的「假大模型」(v0.43+)。
//
// 一个零依赖的 OpenAI 兼容 + 视频异步任务 的 fake server，让「真连后端大模型」的
// 整条链路（形象锻造对话 / 短剧脚本起草 / 视频生成）在没有真实 API key 时也能端到端跑通。
//
// 端点：
//   GET  /v1/models                 → 模型列表
//   POST /v1/chat/completions       → OpenAI 兼容；按 prompt 内容返回中文方案 / 结构化 JSON
//   POST /v1/videos/generations     → 提交视频任务，返回 task id
//   GET  /v1/async-result/{taskId}  → 轮询任务（立即返回 succeeded + 一个示例视频 URL）
//
// 启动：node scripts/dev-fake-llm-server.mjs   （默认端口 8091，可用 FAKE_LLM_PORT 覆盖）
// server 侧 application-dev.yml 默认 aep.dev-fake-llm.base-url=http://localhost:8091/v1。
// ─────────────────────────────────────────────────────────────────────────────

import http from "node:http";

const PORT = Number(process.env.FAKE_LLM_PORT || 8091);
const SAMPLE_VIDEO_URL =
  process.env.FAKE_LLM_SAMPLE_VIDEO ||
  "http://localhost:8080/static/videos/showreel-01.mp4";

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

// ── 中文方案（形象锻造 / 通用） ───────────────────────────────────────────────
function buildProse(text) {
  const wantsForge = /形象|锻造|艺人|歌手|外观|造型|视觉/.test(text);
  if (wantsForge) {
    return [
      "形象定位：一句话——冷感未来主舞台型虚拟歌手，兼顾商业代言与长内容连载。",
      "视觉关键词：冷光泽、层次短发、通透瞳色、机能材质、舞台反光、近景抓脸。",
      "五官与发型：强化轮廓干净度与眼神穿透感；发型保留轻量飞线与立体层次，让近景更有记忆点。",
      "服饰与材质：主装走高定机能风，点缀少量金属件与半透明材质，控制发光点，不堆砌装饰。",
      "舞台与镜头：冷白 + 青紫边光，略低机位、中近景，把人物主控感推出来。",
      "风险与优化：避免色彩过多、元素过满、妆面过重，否则削弱长期运营的统一性。",
      "（本回复由本地联调模型生成，仅用于打通链路。）",
    ].join("\n\n");
  }
  return "（本地联调模型回复）已收到你的请求：" + text.slice(0, 80) + " … 这是一段用于打通链路的占位回答。";
}

// ── 结构化 JSON（短剧脚本 / 变量 / 卖点等 json_object 模式） ──────────────────
function buildJsonContent(text) {
  // 短剧脚本起草
  if (/短剧|剧本|分镜|scenes|episode|台词|镜头/.test(text)) {
    return JSON.stringify({
      scripts: [
        {
          title: "误会重逢",
          logline: "失忆的总裁在咖啡馆偶遇前妻，一杯拿铁勾起被尘封的回忆。",
          genre: "都市情感",
          duration_sec: 60,
          scenes: [
            {
              heading: "日 · 咖啡馆 · 内",
              summary: "总裁排队点单，与前妻擦肩。",
              shot: "中近景，手持轻微晃动，暖色调，聚焦两人交错的瞬间",
              dialogue: "（旁白）有些人一转身，就是一辈子。",
              duration_sec: 12,
            },
            {
              heading: "日 · 咖啡馆 · 卡座",
              summary: "前妻认出他，欲言又止。",
              shot: "正反打特写，浅景深，强调眼神",
              dialogue: "前妻：你……还喝三分糖吗？",
              duration_sec: 16,
            },
            {
              heading: "日 · 咖啡馆 · 窗边",
              summary: "总裁记忆闪回，握紧杯子。",
              shot: "面部特写 + 回忆叠化，冷暖对比",
              dialogue: "总裁：（低声）我好像……在哪里见过你。",
              duration_sec: 16,
            },
            {
              heading: "日 · 咖啡馆 · 门口",
              summary: "两人并肩走出，留下悬念。",
              shot: "背影中景，逆光，缓推",
              dialogue: "（旁白）这一次，他不想再转身。",
              duration_sec: 16,
            },
          ],
        },
      ],
    });
  }
  // 变量抽取
  if (/变量|variable|可替换/.test(text)) {
    return JSON.stringify({ variables: [] });
  }
  // 卖点
  if (/卖点|selling/.test(text)) {
    return JSON.stringify({ selling_points: ["示例卖点 A", "示例卖点 B", "示例卖点 C"] });
  }
  return JSON.stringify({ result: "ok", note: "本地联调模型占位 JSON" });
}

function chatResponse(body) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const all = messages.map((m) => (m && m.content) || "").join("\n");
  const jsonMode = body.response_format && body.response_format.type === "json_object";
  const content = jsonMode ? buildJsonContent(all) : buildProse(all);
  return {
    id: "fakecmpl-" + Date.now(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: body.model || "fake-model-v1",
    choices: [
      { index: 0, message: { role: "assistant", content }, finish_reason: "stop" },
    ],
    usage: {
      prompt_tokens: all.length,
      completion_tokens: content.length,
      total_tokens: all.length + content.length,
    },
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Authorization,Content-Type",
    });
    return res.end();
  }

  // 模型列表
  if (path.endsWith("/models") && req.method === "GET") {
    return send(res, 200, {
      object: "list",
      data: [
        { id: "fake-model-v1", object: "model", owned_by: "dev-fake" },
        { id: "fake-video-v1", object: "model", owned_by: "dev-fake" },
      ],
    });
  }

  // chat
  if (path.endsWith("/chat/completions") && req.method === "POST") {
    const body = await readBody(req);
    return send(res, 200, chatResponse(body));
  }

  // 视频任务提交
  if ((path.includes("/videos") || path.includes("/generations")) && req.method === "POST") {
    const taskId = "faketask-" + Date.now() + "-" + Math.floor(Math.random() * 1e4);
    return send(res, 200, {
      id: taskId,
      task_id: taskId,
      request_id: taskId,
      status: "processing",
    });
  }

  // 视频任务轮询（立即 succeeded）
  if (
    (path.includes("/async-result") || path.includes("/tasks/") || path.includes("/result")) &&
    req.method === "GET"
  ) {
    const taskId = path.split("/").filter(Boolean).pop();
    return send(res, 200, {
      id: taskId,
      task_id: taskId,
      task_status: "SUCCESS",
      status: "succeeded",
      video_result: [{ url: SAMPLE_VIDEO_URL, cover_image_url: "" }],
      video_url: SAMPLE_VIDEO_URL,
    });
  }

  return send(res, 404, { error: { message: "fake-llm: no route for " + req.method + " " + path } });
});

server.listen(PORT, () => {
  console.log(`[dev-fake-llm] listening on http://localhost:${PORT}  (OpenAI-compatible + video stub)`);
});
