// ─────────────────────────────────────────────────────────────────────────────
// mocks/_handlers/scripts.ts — 脚本工坊 mock handlers。
// 由 mocks/_register.ts 在 dev 启动时统一 import 注册到 apiFetch 拦截层。
// 业务 api/scripts.ts 不再依赖此文件。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID } from "@ai-star-eco/types/_shared";
import type { Script, ScriptKind, ScriptVersion, ScriptStatus } from "@ai-star-eco/types/script";
import { ApiError, mockDelay, registerMocks } from "@ai-star-eco/api-client";
import { SCRIPTS, SCRIPT_VERSIONS } from "@/mocks/scripts";
import type { CreateScriptInput, CommitVersionInput } from "@/api/scripts";

const scriptStore: Script[] = SCRIPTS.map((s) => ({ ...s }));
const versionStore: ScriptVersion[] = SCRIPT_VERSIONS.map((v) => ({ ...v }));

interface DramaSceneWire {
  heading?: string;
  summary?: string;
  shot?: string;
  dialogue?: string;
  duration_sec?: number;
}

interface DramaScriptWire {
  id?: string;
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

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function notFound(id: ID): ApiError {
  return new ApiError({ code: "drama.not_found", message: `未找到脚本 ${id}` }, 404);
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

function latestVersion(scriptId: ID): ScriptVersion | undefined {
  const versions = versionStore
    .filter((v) => v.scriptId === scriptId)
    .sort((a, b) => b.version - a.version);
  return versions[0];
}

function currentVersion(script: Script): ScriptVersion | undefined {
  return versionStore.find((v) => v.id === script.currentVersionId) ?? latestVersion(script.id);
}

function toDramaWire(script: Script): DramaScriptWire {
  const version = currentVersion(script);
  const content = version?.content ?? "";
  return {
    id: script.id,
    title: script.title,
    kind: script.kind,
    genre: script.series || (script.kind === "drama" ? "短剧" : script.kind),
    duration_sec: 60,
    status: script.status === "approved" ? "ready" : script.status,
    series: script.series,
    episode: script.episode,
    dramaId: script.dramaId,
    drama_id: script.dramaId,
    content,
    scenes: contentToScenes(content),
    suggestion: script.suggestion,
    created_at: script.createdAt,
    updated_at: script.updatedAt,
    authorName: script.authorName ?? version?.authorName ?? "我",
    author_name: script.authorName ?? version?.authorName ?? "我",
  };
}

function upsertCurrentVersion(scriptId: ID, content: string, authorName: string, note = "当前稿"): string {
  const versions = versionStore.filter((v) => v.scriptId === scriptId);
  const nextVersion = versions.reduce((m, v) => Math.max(m, v.version), 0) + 1;
  const id = `${scriptId}:current`;
  const now = new Date().toISOString();
  const idx = versionStore.findIndex((v) => v.id === id);
  const version: ScriptVersion = {
    id,
    scriptId,
    version: nextVersion,
    content,
    authorName,
    aiAssisted: false,
    createdAt: now,
    note,
  };
  if (idx >= 0) versionStore[idx] = version;
  else versionStore.unshift(version);
  return id;
}

function saveDramaWire(body: DramaScriptWire): DramaScriptWire {
  const now = new Date().toISOString();
  const id = body.id && body.id.trim() ? body.id : nextId("ds_mock");
  const existingIdx = scriptStore.findIndex((s) => s.id === id);
  const existing = existingIdx >= 0 ? scriptStore[existingIdx] : undefined;
  const authorName = body.authorName ?? body.author_name ?? existing?.authorName ?? "我";
  const content = body.content ?? scenesToContent(body.scenes) ?? "";
  const currentVersionId = upsertCurrentVersion(id, content, authorName);
  const status = (body.status === "draft" || body.status === "review" || body.status === "archived")
    ? body.status
    : "approved";
  const script: Script = {
    id,
    title: body.title || existing?.title || "未命名短剧",
    kind: body.kind ?? existing?.kind ?? "drama",
    status,
    series: body.series ?? body.genre ?? existing?.series,
    episode: body.episode ?? existing?.episode,
    dramaId: body.dramaId ?? body.drama_id ?? existing?.dramaId,
    currentVersionId,
    progress: status === "approved" ? 100 : status === "review" ? 72 : 35,
    suggestion: body.suggestion ?? existing?.suggestion,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    authorName,
  };
  if (existingIdx >= 0) scriptStore[existingIdx] = script;
  else scriptStore.unshift(script);
  return { ...toDramaWire(script), status: status === "approved" ? "ready" : status };
}

registerMocks([
  // 真实后端契约：api/scripts.ts 现在只调用 /me/drama/scripts*。
  {
    method: "GET",
    pattern: "/me/drama/scripts",
    handler: () => mockDelay(scriptStore.map(toDramaWire)),
  },
  {
    method: "GET",
    pattern: "/me/drama/scripts/:id",
    handler: ({ params }) => {
      const found = scriptStore.find((s) => s.id === params.id);
      if (!found) throw notFound(params.id);
      return mockDelay(toDramaWire(found));
    },
  },
  {
    method: "POST",
    pattern: "/me/drama/scripts",
    handler: ({ body }) => mockDelay(saveDramaWire((body ?? {}) as DramaScriptWire)),
  },
  {
    method: "DELETE",
    pattern: "/me/drama/scripts/:id",
    handler: ({ params }) => {
      const idx = scriptStore.findIndex((s) => s.id === params.id);
      if (idx >= 0) scriptStore.splice(idx, 1);
      for (let i = versionStore.length - 1; i >= 0; i--) {
        if (versionStore[i]!.scriptId === params.id) versionStore.splice(i, 1);
      }
      return mockDelay(undefined);
    },
  },
  {
    method: "POST",
    pattern: "/me/drama/scripts/ai-draft",
    handler: ({ body }) => {
      const b = (body ?? {}) as { theme?: string; genre?: string; duration_sec?: number; count?: number };
      const count = Math.max(1, Math.min(4, Number(b.count ?? 1)));
      const now = new Date().toISOString();
      return mockDelay(
        Array.from({ length: count }, (_, i): DramaScriptWire => {
          const title = `${b.theme || "短剧灵感"} · AI 草稿 ${i + 1}`;
          const content = [
            `场 1 · ${b.genre || "都市情感"} · 夜`,
            `主角围绕「${b.theme || "未命名主题"}」展开第一轮冲突，开场 3 秒给出强钩子。`,
            "镜头：中近景推进到特写，保留一处情绪停顿。",
            "台词：这一次，我不会再错过真相。",
          ].join("\n");
          return {
            id: `ds_ai_${Date.now()}_${i}`,
            title,
            kind: "drama",
            genre: b.genre || "都市情感",
            duration_sec: b.duration_sec ?? 60,
            status: "draft",
            content,
            scenes: contentToScenes(content),
            suggestion: "本地 mock AI 草稿，保存后进入脚本库。",
            created_at: now,
            updated_at: now,
            authorName: "AI 编剧助手",
          };
        }),
        900,
      );
    },
  },

  // 旧 mock-era 契约：保留给历史页面 / 手动调试入口。
  {
    method: "GET",
    pattern: "/me/scripts",
    handler: () => mockDelay(scriptStore.map((s) => ({ ...s }))),
  },
  {
    method: "GET",
    pattern: "/me/scripts/:id",
    handler: ({ params }) => {
      const found = scriptStore.find((s) => s.id === params.id);
      return mockDelay(found ? { ...found } : null);
    },
  },
  {
    method: "GET",
    pattern: "/me/scripts/:scriptId/versions",
    handler: ({ params }) => {
      const arr = versionStore
        .filter((v) => v.scriptId === params.scriptId)
        .map((v) => ({ ...v }))
        .sort((a, b) => b.version - a.version);
      return mockDelay(arr);
    },
  },
  {
    method: "GET",
    pattern: "/me/script-versions/:versionId",
    handler: ({ params }) => {
      const v = versionStore.find((x) => x.id === params.versionId);
      return mockDelay(v ? { ...v } : null);
    },
  },
  {
    method: "POST",
    pattern: "/me/scripts",
    handler: ({ body }) => {
      const input = body as CreateScriptInput;
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
    },
  },
  {
    method: "POST",
    pattern: "/me/scripts/:scriptId/versions",
    handler: ({ params, body }) => {
      const input = body as CommitVersionInput;
      const idx = scriptStore.findIndex((s) => s.id === params.scriptId);
      if (idx < 0) throw notFound(params.scriptId);
      const versions = versionStore.filter((v) => v.scriptId === params.scriptId);
      const nextVersion = versions.reduce((m, v) => Math.max(m, v.version), 0) + 1;
      const now = new Date().toISOString();
      const v: ScriptVersion = {
        id: `${params.scriptId}-v${nextVersion}`,
        scriptId: params.scriptId,
        version: nextVersion,
        content: input.content,
        authorName: input.authorName ?? "我",
        aiAssisted: input.aiAssisted ?? false,
        createdAt: now,
        note: input.note,
      };
      versionStore.unshift(v);
      const cur = scriptStore[idx]!;
      scriptStore[idx] = {
        ...cur,
        currentVersionId: v.id,
        updatedAt: now,
        progress: Math.min(100, cur.progress + 6),
      };
      return mockDelay({ ...v });
    },
  },
  {
    method: "PATCH",
    pattern: "/me/scripts/:scriptId/status",
    handler: ({ params, body }) => {
      const idx = scriptStore.findIndex((s) => s.id === params.scriptId);
      if (idx < 0) throw notFound(params.scriptId);
      const status = (body as { status: ScriptStatus }).status;
      const updated: Script = {
        ...scriptStore[idx]!,
        status,
        updatedAt: new Date().toISOString(),
      };
      scriptStore[idx] = updated;
      return mockDelay({ ...updated });
    },
  },
  {
    method: "DELETE",
    pattern: "/me/scripts/:scriptId",
    handler: ({ params }) => {
      const idx = scriptStore.findIndex((s) => s.id === params.scriptId);
      if (idx >= 0) scriptStore.splice(idx, 1);
      for (let i = versionStore.length - 1; i >= 0; i--) {
        if (versionStore[i]!.scriptId === params.scriptId) versionStore.splice(i, 1);
      }
      return mockDelay(undefined);
    },
  },
  {
    method: "POST",
    pattern: "/me/scripts/:scriptId/clone",
    handler: ({ params }) => {
      const src = scriptStore.find((s) => s.id === params.scriptId);
      if (!src) throw notFound(params.scriptId);
      const srcVersion = versionStore.find((v) => v.id === src.currentVersionId);
      const now = new Date().toISOString();
      const scriptId = nextId("sc");
      const versionId = `${scriptId}-v1`;
      const v: ScriptVersion = {
        id: versionId,
        scriptId,
        version: 1,
        content: srcVersion?.content ?? "",
        authorName: src.authorName ?? "我",
        aiAssisted: false,
        createdAt: now,
        note: "克隆自 " + src.title,
      };
      const s: Script = {
        ...src,
        id: scriptId,
        title: `${src.title}（副本）`,
        status: "draft",
        currentVersionId: versionId,
        progress: 5,
        createdAt: now,
        updatedAt: now,
      };
      scriptStore.unshift(s);
      versionStore.unshift(v);
      return mockDelay({ ...s });
    },
  },
  {
    method: "POST",
    pattern: "/me/scripts/:scriptId/generate",
    handler: async ({ params, body }) => {
      const prompt = (body as { prompt: string }).prompt;
      await new Promise((r) => setTimeout(r, 900));
      const cur = scriptStore.find((s) => s.id === params.scriptId);
      const src = versionStore.find((v) => v.id === cur?.currentVersionId);
      const ai = `\n\n[AI 续写 · ${new Date().toLocaleTimeString("zh-CN")}]\n（基于「${prompt}」生成）\n${[
        "场景 — 旧式天台。月光把锈红色的栏杆拉成两条长影。",
        "苏念把伞收了，雨水顺着发梢滴在水泥地上，先成了点，再成了行字。",
        "陆烬递过来一杯热的，杯沿沾了她的红，又沾了他的白。",
      ].join("\n")}\n`;
      return { content: (src?.content ?? "") + ai };
    },
  },
]);
