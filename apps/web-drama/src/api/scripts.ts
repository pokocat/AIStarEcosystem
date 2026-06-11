// ─────────────────────────────────────────────────────────────────────────────
// api/scripts.ts — 脚本工坊 API。
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
    status: "draft",
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
    content: raw.content || scenesToContent(raw.scenes) || "（暂无正文）",
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

export async function setScriptStatus(scriptId: ID, status: ScriptStatus): Promise<Script> {
  if (status === "archived") {
    await deleteScript(scriptId);
    return {
      id: scriptId,
      title: "已归档脚本",
      kind: "drama",
      status: "archived",
      currentVersionId: `${scriptId}:current`,
      progress: 100,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      authorName: DEFAULT_AUTHOR,
    };
  }
  const existing = await apiFetch<DramaScriptWire>(`/me/drama/scripts/${encodeURIComponent(scriptId)}`);
  const row = await apiFetch<DramaScriptWire>("/me/drama/scripts", {
    method: "POST",
    body: { ...existing, id: scriptId, status },
  });
  return toScript({ ...row, status });
}

export async function archiveScript(scriptId: ID): Promise<Script> {
  return setScriptStatus(scriptId, "archived");
}

export async function deleteScript(scriptId: ID): Promise<void> {
  await apiFetch<void>(`/me/drama/scripts/${encodeURIComponent(scriptId)}`, { method: "DELETE" });
}

export async function cloneScript(scriptId: ID): Promise<Script> {
  const existing = await apiFetch<DramaScriptWire>(`/me/drama/scripts/${encodeURIComponent(scriptId)}`);
  const row = await apiFetch<DramaScriptWire>("/me/drama/scripts", {
    method: "POST",
    body: {
      ...existing,
      id: undefined,
      title: `${existing.title || "未命名脚本"}（副本）`,
      status: "draft",
    },
  });
  return toScript({ ...row, status: "draft" });
}

/** AI 续写 / 改写：后端调用模型 API。 */
export async function generateDraft(scriptId: ID, prompt: string): Promise<{ content: string }> {
  const row = await apiFetch<DramaScriptWire>(`/me/drama/scripts/${encodeURIComponent(scriptId)}`);
  const cur = toVersion(row).content;
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
    throw clientError("AI 续写返回为空，请重试", 502, "drama.ai_empty_output");
  }
  return {
    content: `${cur}\n\n[AI 续写]\n${next}`,
  };
}
