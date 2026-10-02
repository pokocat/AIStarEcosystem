import { beforeEach, describe, expect, it, vi } from "vitest";

// cloneScript 的正文来源（v0.197 第三轮，评审 MK1）：
// 编辑器里复制时传了正文，副本就用它 —— 不再回头读服务端存的旧正文。
const apiFetch = vi.fn();
vi.mock("./_client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  clientError: (message: string) => new Error(message),
}));

import { cloneScript } from "./scripts";

const SERVER_ROW = {
  id: "ds_src",
  title: "原脚本",
  kind: "drama",
  status: "ready",
  content: "服务端存的旧正文",
  scenes: [{ heading: "正文", dialogue: "服务端存的旧正文" }],
};

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockImplementation(async (url: string, init?: { method?: string; body?: Record<string, unknown> }) => {
    if (init?.method === "POST") return { ...init.body, id: "ds_copy" };
    return { ...SERVER_ROW };
  });
});

function postedBody(): Record<string, unknown> {
  const post = apiFetch.mock.calls.find(([, init]) => init?.method === "POST");
  expect(post).toBeTruthy();
  return post![1].body as Record<string, unknown>;
}

describe("cloneScript", () => {
  it("传了正文：副本的 content 与 scenes 都来自传入的正文", async () => {
    await cloneScript("ds_src", { content: "编辑器里还没保存的正文" });
    const body = postedBody();
    expect(body.content).toBe("编辑器里还没保存的正文");
    expect(JSON.stringify(body.scenes)).toContain("编辑器里还没保存的正文");
    expect(JSON.stringify(body.scenes)).not.toContain("服务端存的旧正文");
    expect(body.id).toBeUndefined(); // 新建，不覆盖原脚本
  });

  it("没传正文：原样带上服务端那版", async () => {
    await cloneScript("ds_src");
    const body = postedBody();
    expect(body.content).toBe("服务端存的旧正文");
    expect(body.scenes).toEqual(SERVER_ROW.scenes);
    expect(body.id).toBeUndefined();
  });
});
