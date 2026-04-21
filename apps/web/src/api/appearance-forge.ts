// ─────────────────────────────────────────────────────────────────────────────
// api/appearance-forge.ts — AI 形象锻造炉 API。
// 形象锻造由"静态选项 + 生成请求 + 结果历史"三部分组成。
// 生成接口在 mock 模式下走随机模版伪实现；真实后端通常以异步任务形式返回。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ForgeOptions,
  ForgeRequest,
  ForgeResult,
} from "@/types/appearance-forge";
import type { ID } from "@/types/_shared";
import {
  FORGE_OPTIONS,
  FORGE_TEMPLATES,
  MOCK_APPEARANCES,
  generateMockAppearancesFor,
  pickDemoForgeVideo,
} from "@/mocks/appearance-forge";
import { MOCK_FORGE_DURATION_MS } from "@/constants/appearance-forge-ui";
import {
  API_BASE_URL,
  apiFetch,
  getAuthToken,
  mockDelay,
  setAuthToken,
  USE_MOCK,
} from "./_client";

export async function getForgeOptions(): Promise<ForgeOptions> {
  if (USE_MOCK) return mockDelay(FORGE_OPTIONS);
  return apiFetch<ForgeOptions>("/appearance-forge/options");
}

export async function listForgeHistory(artistId: ID): Promise<ForgeResult[]> {
  if (USE_MOCK) {
    let scoped = MOCK_APPEARANCES.filter(a => a.artistId === artistId);
    // 新建艺人（孵化器刚产出）没有种子形象时，按 artistId 合成 3 张，
    // 并写回 MOCK_APPEARANCES 以保证会话内后续请求幂等。
    if (scoped.length === 0) {
      const synth = generateMockAppearancesFor(artistId);
      MOCK_APPEARANCES.push(...synth);
      scoped = synth;
    }
    const sorted = [...scoped].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return mockDelay(sorted);
  }
  return apiFetch<ForgeResult[]>(`/appearance-forge/history`, {
    query: { artistId },
  });
}

/**
 * 执行一次锻造生成。
 * mock 模式：延迟后基于 templateId 或随机模版拼装伪结果；
 * 真实后端：预期为异步任务（返回已完成的 ForgeResult 或发起轮询）。
 */
export async function generateForge(req: ForgeRequest): Promise<ForgeResult> {
  if (USE_MOCK) {
    const tpl =
      FORGE_TEMPLATES.find(t => t.id === req.templateId) ??
      FORGE_TEMPLATES[Math.floor(Math.random() * FORGE_TEMPLATES.length)];
    const result: ForgeResult = {
      id: Date.now().toString(),
      artistId: req.artistId,
      image: tpl.image,
      prompt: req.prompt || `自动生成 - ${tpl.name}`,
      mode: req.mode,
      createdAt: new Date().toISOString(),
      locked: [...req.lockedFeatures],
      status: "draft",
      usageCount: 0,
    };
    // 回写到 mock 仓库，让"锻造 → 返回艺人详情页画廊"能看到新图。
    MOCK_APPEARANCES.unshift(result);
    return mockDelay(result, MOCK_FORGE_DURATION_MS);
  }
  return apiFetch<ForgeResult>("/appearance-forge/generate", {
    method: "POST",
    body: req,
  });
}

/**
 * 保存一次锻造结果到艺人形象库，并为其关联一段短视频。
 *
 * 当前 AI 视频生成尚未接入：
 * - mock 模式下从 DEMO_FORGE_VIDEO_POOL 随机挑一个 URL 写入 videoUrl，并回写
 *   MOCK_APPEARANCES 供艺人详情画廊即时呈现。
 * - 真实后端 `POST /api/appearance-forge/save` 行为一致，两个 URL 由 server 端
 *   {@code ForgeController.DEMO_VIDEO_POOL} 维护。
 * 接入真实 AI 后，后端应替换为触发生成任务并回填真实 videoUrl。
 *
 * @param resultId 要保存的 ForgeResult.id
 * @param reassign 为 true 时即使已有 videoUrl 也重抽一次（默认 false，幂等）
 */
export async function saveForgeResult(
  result: ForgeResult,
  reassign = false,
): Promise<ForgeResult> {
  if (USE_MOCK) {
    let stored = MOCK_APPEARANCES.find(a => a.id === result.id);
    if (!stored) {
      stored = { ...result };
      MOCK_APPEARANCES.unshift(stored);
    }
    if (!stored.videoUrl || reassign) {
      stored.videoUrl = pickDemoForgeVideo();
    }
    return mockDelay({ ...stored });
  }
  // upsert：后端按 resultId 找不到则新建，因此把整个 ForgeResult 作为 body 发送。
  return apiFetch<ForgeResult>("/appearance-forge/save", {
    method: "POST",
    body: {
      resultId: result.id,
      artistId: result.artistId,
      image: result.image,
      prompt: result.prompt,
      mode: result.mode,
      createdAt: result.createdAt,
      locked: result.locked,
      reassign,
    },
  });
}

/** 后端返回的蓝图视图。 */
export interface ForgeBlueprintWire {
  id: ID;
  artistId: ID;
  resultId: ID;
  snapshot: Record<string, unknown>;
  createdAt: string;
}

/** 将本次生成存为艺人的固定形象"蓝图"。 */
export async function saveForgeBlueprint(
  artistId: ID,
  resultId: ID,
  snapshot?: Record<string, unknown>,
): Promise<ForgeBlueprintWire> {
  if (USE_MOCK) {
    return mockDelay({
      id: `mock-${Date.now()}`,
      artistId, resultId,
      snapshot: snapshot ?? {},
      createdAt: new Date().toISOString(),
    });
  }
  return apiFetch<ForgeBlueprintWire>("/appearance-forge/blueprint", {
    method: "POST",
    body: { artistId, resultId, snapshot },
  });
}

export async function listBlueprints(artistId: ID): Promise<ForgeBlueprintWire[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<ForgeBlueprintWire[]>("/appearance-forge/blueprints", {
    query: { artistId },
  });
}

export interface ForgeProviderStatus {
  configured: boolean;
  provider: string;
  message: string;
}

export interface ForgeConversationRequest {
  artistId: ID;
  prompt: string;
}

export interface ForgeStreamStatusPayload {
  phase?: string;
  message: string;
  chatId?: string;
  conversationId?: string;
}

export interface ForgeStreamDeltaPayload {
  content: string;
  reply: string;
  imageUrl?: string;
}

export interface ForgeStreamMessagePayload {
  content: string;
  imageUrl?: string;
}

export interface ForgeStreamCompletedPayload extends ForgeStreamStatusPayload {
  content: string;
  imageUrl?: string;
  tokenCount?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export type ForgeStreamEvent =
  | { event: "status"; data: ForgeStreamStatusPayload }
  | { event: "delta"; data: ForgeStreamDeltaPayload }
  | { event: "message"; data: ForgeStreamMessagePayload }
  | { event: "completed"; data: ForgeStreamCompletedPayload }
  | { event: "error"; data: { message: string } }
  | { event: "done"; data: { message: string } };

interface StreamOptions {
  signal?: AbortSignal;
  onEvent: (event: ForgeStreamEvent) => void;
}

export async function getForgeProviderStatus(): Promise<ForgeProviderStatus> {
  if (USE_MOCK) {
    return mockDelay({
      configured: true,
      provider: "mock",
      message: "当前为 mock 模式，将使用本地流式回放",
    });
  }
  return apiFetch<ForgeProviderStatus>("/appearance-forge/coze/status");
}

export async function streamForgeConversation(
  request: ForgeConversationRequest,
  { signal, onEvent }: StreamOptions,
): Promise<void> {
  if (USE_MOCK) {
    await streamMockForgeConversation(request, { signal, onEvent });
    return;
  }

  const token = getAuthToken();
  const res = await fetch(`${API_BASE_URL}/appearance-forge/coze/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(request),
    signal,
    credentials: "include",
    cache: "no-store",
  });

  if (res.status === 401) {
    setAuthToken(null);
    throw new Error("未登录或登录已失效");
  }

  if (!res.ok) {
    let message = `请求失败（HTTP ${res.status}）`;
    try {
      const payload = await res.json();
      message =
        (payload as { error?: { message?: string } })?.error?.message ??
        (payload as { message?: string })?.message ??
        message;
    } catch {
      // ignore JSON parse errors and fall back to HTTP message
    }
    throw new Error(message);
  }

  if (!res.body) {
    throw new Error("流式响应体为空");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    throwIfAborted(signal);
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const event = parseForgeSseEvent(part);
      if (!event) continue;
      onEvent(event);
      if (event.event === "error") {
        throw new Error(event.data.message || "Coze 流式响应失败");
      }
    }
  }

  if (buffer.trim()) {
    const event = parseForgeSseEvent(buffer);
    if (event) onEvent(event);
  }
}

async function streamMockForgeConversation(
  request: ForgeConversationRequest,
  { signal, onEvent }: StreamOptions,
): Promise<void> {
  const reply = buildMockForgeReply(request.prompt);
  onEvent({
    event: "status",
    data: { phase: "validated", message: "Mock 模式已接管，本地开始回放流式锻造" },
  });
  await sleep(180, signal);
  onEvent({
    event: "status",
    data: { phase: "in_progress", message: "Mock 正在逐字回写 Coze 响应" },
  });

  let assembled = "";
  for (const chunk of chunkText(reply, 18)) {
    throwIfAborted(signal);
    assembled += chunk;
    await sleep(45, signal);
    onEvent({
      event: "delta",
      data: { content: chunk, reply: assembled },
    });
  }

  onEvent({ event: "message", data: { content: assembled } });
  onEvent({
    event: "completed",
    data: {
      phase: "completed",
      message: "Mock 响应完成",
      content: assembled,
      tokenCount: Math.max(64, Math.floor(request.prompt.length * 1.6)),
      inputTokens: Math.max(24, request.prompt.length),
      outputTokens: Math.max(40, Math.floor(assembled.length * 0.7)),
    },
  });
  onEvent({ event: "done", data: { message: "mock stream closed" } });
}

function parseForgeSseEvent(rawChunk: string): ForgeStreamEvent | null {
  const lines = rawChunk
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(Boolean);

  if (lines.length === 0) return null;

  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  const rawData = dataLines.join("\n");
  if (!rawData) return null;

  try {
    return {
      event: eventName,
      data: JSON.parse(rawData) as ForgeStreamEvent["data"],
    } as ForgeStreamEvent;
  } catch {
    return {
      event: eventName as ForgeStreamEvent["event"],
      data: { message: rawData },
    } as ForgeStreamEvent;
  }
}

function buildMockForgeReply(prompt: string): string {
  const promptHead = prompt.split("\n").slice(0, 5).join(" ").slice(0, 120);
  return [
    "形象定位：这版形象适合走“高辨识度未来舞台主视觉”路线，兼顾商业代言与内容连载。",
    "视觉关键词：冷感光泽、层次短发、通透瞳色、机能材质、舞台反光、镜头抓脸。",
    "五官与发型建议：建议强化轮廓干净度与眼神穿透感，发型保留轻量飞线和立体层次，让近景镜头更有记忆点。",
    "服饰与材质建议：主服装可采用高定机能风，加入少量金属件、半透明材质和可控发光点，不要堆满复杂装饰。",
    "舞台/镜头表现：适合冷白 + 青紫边光，搭配略低机位和中近景，能把人物主控感推出来。",
    "风险与优化：避免色彩过多、元素过满和妆面过重，否则会削弱虚拟偶像的长期运营统一性。",
    `最终生成提示词：围绕以下需求继续细化并输出图像方案——${promptHead || "保持未来感、商业化和舞台辨识度"}`,
  ].join("\n\n");
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new Error("用户已取消本次锻造"));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new Error("用户已取消本次锻造");
  }
}
