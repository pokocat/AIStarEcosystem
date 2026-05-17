// ─────────────────────────────────────────────────────────────────────────────
// mocks/_handlers/scripts.ts — 脚本工坊 mock handlers。
// 由 mocks/_register.ts 在 dev 启动时统一 import 注册到 apiFetch 拦截层。
// 业务 api/scripts.ts 不再依赖此文件。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID } from "@ai-star-eco/types/_shared";
import type { Script, ScriptVersion, ScriptStatus } from "@ai-star-eco/types/script";
import { ApiError, mockDelay, registerMocks } from "@ai-star-eco/api-client";
import { SCRIPTS, SCRIPT_VERSIONS } from "@/mocks/scripts";
import type { CreateScriptInput, CommitVersionInput } from "@/api/scripts";

const scriptStore: Script[] = SCRIPTS.map((s) => ({ ...s }));
const versionStore: ScriptVersion[] = SCRIPT_VERSIONS.map((v) => ({ ...v }));

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function notFound(id: ID): ApiError {
  return new ApiError({ code: "drama.not_found", message: `未找到脚本 ${id}` }, 404);
}

registerMocks([
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
