// ─────────────────────────────────────────────────────────────────────────────
// api/scripts.ts — 脚本库 API。
//
// 历史上脚本工坊先做了 mock-era 的 `/me/scripts` 契约；生产后端真实落地的是
// `/me/drama/scripts`。这里做一层兼容映射，让页面继续使用通用 Script 视图模型，
// 网络层走已上线的 drama 脚本端点。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID } from "@ai-star-eco/types/_shared";
import type { Script, ScriptVersion, ScriptKind, ScriptStatus } from "@ai-star-eco/types/script";
import { apiFetch, clientError } from "./_client";

interface DramaSceneWire {
  heading?: string;
  summary?: string;
  shot?: string;
  dialogue?: string;
  duration_sec?: number;
}

interface DramaScriptWire {
  id: string;
  title?: string;
  kind?: ScriptKind;
  genre?: string;
  duration_sec?: number;
  status?: string;
  series?: string;
  episode?: string;
  dramaId?: ID;
  drama_id?: ID;
  content?: string;
  suggestion?: string;
  scenes?: DramaSceneWire[];
  created_at?: string | null;
  updated_at?: string | null;
  createdAt?: string;
  updatedAt?: string;
  authorName?: string;
  author_name?: string;
}

const DEFAULT_AUTHOR = "我";

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * 服务端没有「草稿 / 待定稿 / 已定稿」这套流程：DramaScriptService#saveScript 每次保存都把 status 写成
 * `ready`，前端传什么都会被覆盖（v0.197 第三轮核对）。这里的映射只为满足 Script 类型，界面不再展示状态、
 * 也不再提供「标为待定稿 / 确认定稿」—— 那两个按钮点了以后，重新读一次就变回原样。
 */
function toScriptStatus(status?: string): ScriptStatus {
  switch (status) {
    case "draft":
    case "review":
    case "approved":
    case "archived":
      return status;
    case "ready":
      return "approved";
    default:
      return "draft";
  }
}

function progressFor(status: ScriptStatus): number {
  switch (status) {
    case "draft":
      return 35;
    case "review":
      return 72;
    case "approved":
      return 100;
    case "archived":
      return 100;
  }
}

function scenesToContent(scenes?: DramaSceneWire[]): string {
  if (!Array.isArray(scenes) || scenes.length === 0) return "";
  return scenes
    .map((scene, idx) => {
      const lines = [
        `场 ${idx + 1} · ${scene.heading || "未命名场景"}`,
        scene.summary,
        scene.shot ? `镜头：${scene.shot}` : undefined,
        scene.dialogue ? `台词：${scene.dialogue}` : undefined,
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n\n");
}

function contentToScenes(content?: string): DramaSceneWire[] {
  const text = content?.trim();
  if (!text) return [];
  return [
    {
      heading: "正文",
      summary: text.slice(0, 120),
      shot: "按正文拆分镜头",
      dialogue: text,
      duration_sec: 60,
    },
  ];
}

function toWire(input: CreateScriptInput): DramaScriptWire {
  const content = input.initialContent?.trim();
  return {
    title: input.title,
    kind: input.kind,
    genre: input.kind === "drama" ? "短剧" : input.kind,
    duration_sec: 60,
    // 不传 status：服务端保存时一律写 ready，传了也会被覆盖。
    series: input.series,
    episode: input.episode,
    dramaId: input.dramaId,
    drama_id: input.dramaId,
    content,
    scenes: contentToScenes(content),
    authorName: input.authorName ?? DEFAULT_AUTHOR,
  } as DramaScriptWire;
}

function toScript(raw: DramaScriptWire): Script {
  const status = toScriptStatus(raw.status);
  const createdAt = raw.createdAt ?? raw.created_at ?? nowIso();
  const updatedAt = raw.updatedAt ?? raw.updated_at ?? createdAt;
  return {
    id: raw.id,
    title: raw.title || "未命名脚本",
    kind: raw.kind ?? "drama",
    status,
    series: raw.series || raw.genre || undefined,
    episode: raw.episode,
    dramaId: raw.dramaId ?? raw.drama_id,
    currentVersionId: `${raw.id}:current`,
    progress: progressFor(status),
    suggestion: raw.suggestion,
    createdAt,
    updatedAt,
    authorName: raw.authorName ?? raw.author_name ?? DEFAULT_AUTHOR,
  };
}

function toVersion(raw: DramaScriptWire): ScriptVersion {
  const createdAt = raw.updatedAt ?? raw.updated_at ?? raw.createdAt ?? raw.created_at ?? nowIso();
  return {
    id: `${raw.id}:current`,
    scriptId: raw.id,
    version: 1,
    content: raw.content || scenesToContent(raw.scenes) || "",
    authorName: raw.authorName ?? raw.author_name ?? DEFAULT_AUTHOR,
    aiAssisted: false,
    createdAt,
    note: "当前稿",
  };
}

export async function listScripts(): Promise<Script[]> {
  const rows = await apiFetch<DramaScriptWire[]>("/me/drama/scripts");
  return rows.map(toScript);
}

export async function getScript(id: ID): Promise<Script | null> {
  const row = await apiFetch<DramaScriptWire>(`/me/drama/scripts/${encodeURIComponent(id)}`);
  return toScript(row);
}

export async function listVersionsByScript(scriptId: ID): Promise<ScriptVersion[]> {
  const row = await apiFetch<DramaScriptWire>(`/me/drama/scripts/${encodeURIComponent(scriptId)}`);
  return [toVersion(row)];
}

export async function getVersion(versionId: ID): Promise<ScriptVersion | null> {
  const scriptId = String(versionId).split(":")[0];
  if (!scriptId) return null;
  const versions = await listVersionsByScript(scriptId);
  return versions.find((v) => v.id === versionId) ?? versions[0] ?? null;
}

export interface CreateScriptInput {
  title: string;
  kind: ScriptKind;
  series?: string;
  episode?: string;
  dramaId?: ID;
  initialContent?: string;
  authorName?: string;
}

export async function createScript(input: CreateScriptInput): Promise<Script> {
  const row = await apiFetch<DramaScriptWire>("/me/drama/scripts", { method: "POST", body: toWire(input) });
  return toScript(row);
}

export interface CommitVersionInput {
  content: string;
  note?: string;
  authorName?: string;
  aiAssisted?: boolean;
}

export async function commitVersion(scriptId: ID, input: CommitVersionInput): Promise<ScriptVersion> {
  const existing = await apiFetch<DramaScriptWire>(`/me/drama/scripts/${encodeURIComponent(scriptId)}`);
  const row = await apiFetch<DramaScriptWire>("/me/drama/scripts", {
    method: "POST",
    body: {
      ...existing,
      id: scriptId,
      content: input.content,
      scenes: contentToScenes(input.content),
      authorName: input.authorName ?? existing.authorName ?? existing.author_name ?? DEFAULT_AUTHOR,
    },
  });
  return { ...toVersion(row), note: input.note, aiAssisted: input.aiAssisted ?? false };
}

export async function deleteScript(scriptId: ID): Promise<void> {
  await apiFetch<void>(`/me/drama/scripts/${encodeURIComponent(scriptId)}`, { method: "DELETE" });
}

export interface CloneScriptOptions {
  /**
   * 副本用的正文。编辑器里复制时必须传「用户眼前的那份」—— 不传就读服务端存的那版，
   * 没保存的改动不会进副本（v0.197 第三轮修：此前一律读服务端旧正文）。
   */
  content?: string;
}

export async function cloneScript(scriptId: ID, opts: CloneScriptOptions = {}): Promise<Script> {
  const existing = await apiFetch<DramaScriptWire>(`/me/drama/scripts/${encodeURIComponent(scriptId)}`);
  // 传了正文就用它（与「保存」同一套写法：content + 按正文拆出的 scenes）；没传就原样带上服务端那版。
  const body: DramaScriptWire =
    opts.content === undefined
      ? { ...existing }
      : { ...existing, content: opts.content, scenes: contentToScenes(opts.content) };
  const row = await apiFetch<DramaScriptWire>("/me/drama/scripts", {
    method: "POST",
    body: {
      ...body,
      id: undefined,
      title: `${existing.title || "未命名脚本"}（副本）`,
    },
  });
  return toScript(row);
}

/**
 * AI 续写 / 改写：后端调用模型 API。
 * base：编辑器里当前的正文（含没保存的改动）。传了就接在它后面 —— 此前一律接在服务端存的那版后面，
 * 用户没保存的修改会被 AI 结果静默覆盖（v0.197 修）。
 */
export async function generateDraft(scriptId: ID, prompt: string, base?: string): Promise<{ content: string }> {
  const row = await apiFetch<DramaScriptWire>(`/me/drama/scripts/${encodeURIComponent(scriptId)}`);
  const cur = base ?? toVersion(row).content;
  const drafts = await apiFetch<DramaScriptWire[]>("/me/drama/scripts/ai-draft", {
    method: "POST",
    body: {
      theme: prompt,
      genre: row.genre || row.series || "都市情感",
      duration_sec: row.duration_sec || 60,
      count: 1,
    },
  });
  const next = drafts[0]?.content || scenesToContent(drafts[0]?.scenes) || drafts[0]?.suggestion || "";
  if (!next.trim()) {
    throw clientError("AI 这次没写出内容，请重试", 502, "drama.ai_empty_output");
  }
  return {
    content: `${cur}\n\n[AI 续写]\n${next}`,
  };
}
