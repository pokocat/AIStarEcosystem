// apiFetch 的请求体序列化。
//
// 真实事故（v0.178）：`apiFetch("/v1/card/from-avatar", { body: JSON.stringify({ avatarId }) })`
// —— 这一层本来就负责序列化，调用方再 stringify 一遍，服务端收到的就是一个 JSON **字符串**，
// Jackson 报 "no String-argument constructor" 500，用户看到的只有「服务器处理请求失败」。
// 手误很自然：web-aiavatar 的 proto/api.ts 里有个同名 apiFetch，收的是原生 RequestInit，
// 在那边 JSON.stringify 才是对的。双重编码没有任何正当用途，这一层直接吸收掉。

import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./_client";

const ok = () =>
  Promise.resolve(new Response(JSON.stringify({ success: true, data: { ok: 1 } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(ok);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

function sentBody() {
  return fetchMock.mock.calls[0][1].body as string;
}

describe("请求体序列化", () => {
  it("对象 → JSON", async () => {
    await apiFetch("/v1/card/from-avatar", { method: "POST", body: { avatarId: "DH-1" } });
    expect(JSON.parse(sentBody())).toEqual({ avatarId: "DH-1" });
  });

  it("已经是字符串就原样发，不再序列化一遍", async () => {
    await apiFetch("/v1/card/from-avatar", {
      method: "POST",
      body: JSON.stringify({ avatarId: "DH-1" }),
    });
    // 双重编码的话，这里 parse 出来会是一个字符串而不是对象
    expect(JSON.parse(sentBody())).toEqual({ avatarId: "DH-1" });
    expect(typeof JSON.parse(sentBody())).toBe("object");
  });

  it("FormData 原样交给浏览器（不碰 Content-Type，让它自己带 boundary）", async () => {
    const form = new FormData();
    form.append("file", new Blob(["x"]), "a.png");
    await apiFetch("/v1/ip-studio/uploads", { method: "POST", body: form });
    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBe(form);
    expect(init.headers["Content-Type"]).toBeUndefined();
  });
});
