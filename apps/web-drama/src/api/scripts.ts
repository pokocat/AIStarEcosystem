// ─────────────────────────────────────────────────────────────────────────────
// api/scripts.ts — 脚本工坊 API。
// USE_MOCK=1 时使用 mutable 内存缓存（scripts + versions 双 store）。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID } from "@ai-star-eco/types/_shared";
import type { Script, ScriptVersion, ScriptKind, ScriptStatus } from "@ai-star-eco/types";
import { SCRIPTS, SCRIPT_VERSIONS } from "@/mocks/scripts";
import { apiFetch, USE_MOCK, mockDelay, clientError } from "./_client";

const scriptStore: Script[] = SCRIPTS.map((s) => ({ ...s }));
const versionStore: ScriptVersion[] = SCRIPT_VERSIONS.map((v) => ({ ...v }));

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function listScripts(): Promise<Script[]> {
  if (USE_MOCK) return mockDelay(scriptStore.map((s) => ({ ...s })));
  return apiFetch<Script[]>("/me/scripts");
}

export async function getScript(id: ID): Promise<Script | null> {
  if (USE_MOCK) {
    const found = scriptStore.find((s) => s.id === id);
    return mockDelay(found ? { ...found } : null);
  }
  return apiFetch<Script | null>(`/me/scripts/${encodeURIComponent(id)}`);
}

export async function listVersionsByScript(scriptId: ID): Promise<ScriptVersion[]> {
  if (USE_MOCK) {
    const arr = versionStore.filter((v) => v.scriptId === scriptId);
    return mockDelay(arr.map((v) => ({ ...v })).sort((a, b) => b.version - a.version));
  }
  return apiFetch<ScriptVersion[]>(`/me/scripts/${encodeURIComponent(scriptId)}/versions`);
}

export async function getVersion(versionId: ID): Promise<ScriptVersion | null> {
  if (USE_MOCK) {
    const v = versionStore.find((x) => x.id === versionId);
    return mockDelay(v ? { ...v } : null);
  }
  return apiFetch<ScriptVersion | null>(`/me/script-versions/${encodeURIComponent(versionId)}`);
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
  if (USE_MOCK) {
    const now = new Date().toISOString();
    const scriptId = nextId("sc");
    const versionId = `${scriptId}-v1`;
    const v: ScriptVersion = {
      id: versionId,
      scriptId,
      version: 1,
      content: input.initialContent ?? "（新脚本，开始写作吧。）",
      authorName: input.authorName ?? "我",
      aiAssisted: false,
      createdAt: now,
      note: "初稿",
    };
    const s: Script = {
      id: scriptId,
      title: input.title,
      kind: input.kind,
      status: "draft",
      series: input.series,
      episode: input.episode,
      dramaId: input.dramaId,
      currentVersionId: versionId,
      progress: 5,
      createdAt: now,
      updatedAt: now,
      authorName: input.authorName ?? "我",
    };
    scriptStore.unshift(s);
    versionStore.unshift(v);
    return mockDelay({ ...s });
  }
  return apiFetch<Script>("/me/scripts", { method: "POST", body: input });
}

export interface CommitVersionInput {
  content: string;
  note?: string;
  authorName?: string;
  aiAssisted?: boolean;
}

export async function commitVersion(scriptId: ID, input: CommitVersionInput): Promise<ScriptVersion> {
  if (USE_MOCK) {
    const idx = scriptStore.findIndex((s) => s.id === scriptId);
    if (idx < 0) throw clientError(`未找到脚本 ${scriptId}`, 404, "drama.not_found");
    const versions = versionStore.filter((v) => v.scriptId === scriptId);
    const nextVersion = (versions.reduce((m, v) => Math.max(m, v.version), 0) ?? 0) + 1;
    const now = new Date().toISOString();
    const v: ScriptVersion = {
      id: `${scriptId}-v${nextVersion}`,
      scriptId,
      version: nextVersion,
      content: input.content,
      authorName: input.authorName ?? "我",
      aiAssisted: input.aiAssisted ?? false,
      createdAt: now,
      note: input.note,
    };
    versionStore.unshift(v);
    // 更新脚本：currentVersionId + updatedAt + progress（每个新版本 +6）
    const cur = scriptStore[idx]!;
    const updated: Script = {
      ...cur,
      currentVersionId: v.id,
      updatedAt: now,
      progress: Math.min(100, cur.progress + 6),
    };
    scriptStore[idx] = updated;
    return mockDelay({ ...v });
  }
  return apiFetch<ScriptVersion>(`/me/scripts/${encodeURIComponent(scriptId)}/versions`, {
    method: "POST",
    body: input,
  });
}

export async function setScriptStatus(scriptId: ID, status: ScriptStatus): Promise<Script> {
  if (USE_MOCK) {
    const idx = scriptStore.findIndex((s) => s.id === scriptId);
    if (idx < 0) throw clientError(`未找到脚本 ${scriptId}`, 404, "drama.not_found");
    const updated: Script = { ...scriptStore[idx]!, status, updatedAt: new Date().toISOString() };
    scriptStore[idx] = updated;
    return mockDelay({ ...updated });
  }
  return apiFetch<Script>(`/me/scripts/${encodeURIComponent(scriptId)}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export async function archiveScript(scriptId: ID): Promise<Script> {
  return setScriptStatus(scriptId, "archived");
}

export async function deleteScript(scriptId: ID): Promise<void> {
  if (USE_MOCK) {
    const idx = scriptStore.findIndex((s) => s.id === scriptId);
    if (idx >= 0) scriptStore.splice(idx, 1);
    // 同时删版本
    for (let i = versionStore.length - 1; i >= 0; i--) {
      if (versionStore[i]!.scriptId === scriptId) versionStore.splice(i, 1);
    }
    return mockDelay(undefined);
  }
  await apiFetch<void>(`/me/scripts/${encodeURIComponent(scriptId)}`, { method: "DELETE" });
}

export async function cloneScript(scriptId: ID): Promise<Script> {
  if (USE_MOCK) {
    const src = scriptStore.find((s) => s.id === scriptId);
    if (!src) throw clientError(`未找到脚本 ${scriptId}`, 404, "drama.not_found");
    const srcVersion = versionStore.find((v) => v.id === src.currentVersionId);
    return createScript({
      title: `${src.title}（副本）`,
      kind: src.kind,
      series: src.series,
      episode: src.episode,
      dramaId: src.dramaId,
      initialContent: srcVersion?.content,
      authorName: src.authorName,
    });
  }
  return apiFetch<Script>(`/me/scripts/${encodeURIComponent(scriptId)}/clone`, { method: "POST" });
}

/**
 * AI 续写 / 改写：mock 端拼接一段标记过的内容；真后端调用模型 API。
 */
export async function generateDraft(scriptId: ID, prompt: string): Promise<{ content: string }> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 900));
    const src = versionStore.find((v) => v.id === scriptStore.find((s) => s.id === scriptId)?.currentVersionId);
    const ai = `\n\n[AI 续写 · ${new Date().toLocaleTimeString("zh-CN")}]\n（基于「${prompt}」生成）\n${
      [
        "场景 — 旧式天台。月光把锈红色的栏杆拉成两条长影。",
        "苏念把伞收了，雨水顺着发梢滴在水泥地上，先成了点，再成了行字。",
        "陆烬递过来一杯热的，杯沿沾了她的红，又沾了他的白。",
      ].join("\n")
    }\n`;
    return mockDelay({ content: (src?.content ?? "") + ai });
  }
  return apiFetch<{ content: string }>(`/me/scripts/${encodeURIComponent(scriptId)}/generate`, {
    method: "POST",
    body: { prompt },
  });
}
