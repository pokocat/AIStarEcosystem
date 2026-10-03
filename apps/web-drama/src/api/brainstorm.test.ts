import { beforeEach, describe, expect, it, vi } from "vitest";

// 聊天页「去制作」（promote）的两条契约（v0.197 评审 HM1 / HM4）：
//   1. 单条短视频要扣开拍费 → 同一段对话无论点几次、并发几次，只建一条草稿；
//      失败不占键，重试照常能建。真实请求体必须带上按对话派生的幂等键。
//   2. 多集短剧 → 大纲里的人物 / 取景参考搬进项目的角色与场景，形状照服务端
//      DramaBrainstormService#charactersFromRoles / scenesFromOutline（mock 与服务端同形，§8.0.1 ⑦）。
//   3. 单条短视频草稿的内容照服务端写：idea = 一句话剧情 + 主线，不写 styleName / styleRef；
//      没带 data 用已存的大纲；没有大纲不建。
//   4. 去制作之后只读：再保存 409，再去制作回原去向且不拿新带来的内容覆盖已封存的对话。
const net = vi.hoisted(() => ({ useMock: true, apiFetch: vi.fn() }));
vi.mock("./_client", async () => ({
  get USE_MOCK() {
    return net.useMock;
  },
  ApiError: (await import("@ai-star-eco/api-client")).ApiError,
  mockDelay: <T,>(v: T) => Promise.resolve(v),
  apiFetch: net.apiFetch,
}));
const shorts = vi.hoisted(() => ({ createDraft: undefined as unknown as ReturnType<typeof vi.fn> }));
vi.mock("./shorts", async (orig) => {
  const real = await orig<typeof import("./shorts")>();
  shorts.createDraft = vi.fn(real.createDraft);
  return { ...real, createDraft: shorts.createDraft };
});

import {
  BRAINSTORM_ALREADY_PROMOTED,
  createBrainstorm,
  generateOutline,
  getBrainstorm,
  promote,
  promoteRequestId,
  saveBrainstorm,
  singleIdea,
  type BrainstormData,
} from "./brainstorm";
import { getProject } from "./projects";
import { getDraft, listDrafts } from "./shorts";

async function brainstormWithOutline(seed: string, form: BrainstormData["settings"]["form"] = "single") {
  const bs = await createBrainstorm(seed);
  const messages = [...bs.data.messages, { role: "user" as const, text: seed }];
  const { outline } = await generateOutline(bs.meta.id, messages);
  const data: BrainstormData = { ...bs.data, messages, outline, settings: { ...bs.data.settings, form } };
  return { id: bs.meta.id, data };
}

beforeEach(() => {
  net.useMock = true;
  net.apiFetch.mockReset();
  shorts.createDraft.mockClear();
});

describe("promoteRequestId", () => {
  it("同一段对话永远是同一个键，不同对话不同，且不超过服务端上限 64", () => {
    expect(promoteRequestId("brs_abc")).toBe(promoteRequestId("brs_abc"));
    expect(promoteRequestId("brs_abc")).not.toBe(promoteRequestId("brs_abd"));
    expect(promoteRequestId("brs_" + "x".repeat(200)).length).toBeLessThanOrEqual(64);
  });
});

describe("聊天转单条短视频：同一个键只建一条", () => {
  it("两个请求并发（两个标签页同时点）→ 同一条草稿，只建一次", async () => {
    const { id, data } = await brainstormWithOutline("外卖小哥捡到一份手稿");
    const before = (await listDrafts()).length;
    const key = promoteRequestId(id);
    const [a, b] = await Promise.all([
      promote(id, "single", data, { clientRequestId: key }),
      promote(id, "single", data, { clientRequestId: key }),
    ]);
    expect(a).toEqual(b);
    expect(a.kind).toBe("short");
    expect(shorts.createDraft).toHaveBeenCalledTimes(1);
    expect((await listDrafts()).length).toBe(before + 1);
  });

  it("第一次失败不占键：用同一个键重试能建出来，而且只建这一次", async () => {
    const { id, data } = await brainstormWithOutline("雨夜便利店的最后一位客人");
    const key = promoteRequestId(id);
    shorts.createDraft.mockRejectedValueOnce(new Error("网络断了"));
    await expect(promote(id, "single", data, { clientRequestId: key })).rejects.toThrow();
    const retry = await promote(id, "single", data, { clientRequestId: key });
    expect(retry.kind).toBe("short");
    const again = await promote(id, "single", data, { clientRequestId: key });
    expect(again).toEqual(retry);
    // 失败那次 + 成功那次；第三次命中键，不再建。
    expect(shorts.createDraft).toHaveBeenCalledTimes(2);
  });

  it("真实请求：幂等键放在 promote 请求体里发给服务端", async () => {
    net.useMock = false;
    net.apiFetch.mockResolvedValue({ kind: "short", shortId: "dvs_1" });
    const data = { messages: [], outline: null, settings: { form: "single", ratio: "9:16" } } as BrainstormData;
    await promote("brs_live", "single", data, { clientRequestId: promoteRequestId("brs_live") });
    expect(net.apiFetch).toHaveBeenCalledTimes(1);
    const [url, init] = net.apiFetch.mock.calls[0];
    expect(url).toBe("/me/drama/brainstorms/brs_live/promote");
    expect(init).toMatchObject({ method: "POST", body: { form: "single", clientRequestId: promoteRequestId("brs_live") } });
  });
});

describe("聊天转多集短剧：人物和场景跟着走", () => {
  it("大纲的人物 / 取景参考按服务端规则搬进角色与场景", async () => {
    const { id, data } = await brainstormWithOutline("走复仇逆袭", "series");
    const outline = data.outline!;
    const withExtras: BrainstormData = {
      ...data,
      outline: {
        ...outline,
        roles: [...outline.roles, { name: "", role: "" }, { name: "管家", role: "老宅主事" }],
        scenes: [...outline.scenes, "  ", "码头仓库"],
      },
    };
    const out = await promote(id, "series", withExtras);
    expect(out.kind).toBe("project");
    if (out.kind !== "project") return;
    const { data: doc } = await getProject(out.projectId);

    const roles = withExtras.outline!.roles;
    expect(doc.characters.map((c) => c.id)).toEqual(roles.map((_, i) => `ch_${i + 1}`));
    // 前两个一定是主要角色；之后的只有身份里带「主」才算。
    expect(doc.characters.map((c) => c.role)).toEqual(
      roles.map((r, i) => (i < 2 || r.role.includes("主") ? "key" : "extra")),
    );
    expect(doc.characters.map((c) => c.cast)).toEqual(roles.map((r) => r.role));
    // 没写名字的给「角色 N」兜底，不留空。
    expect(doc.characters[roles.length - 2].name).toBe(`角色 ${roles.length - 1}`);
    expect(doc.characters.every((c) => c.bound === false && /^a[1-8]$/.test(c.avatar))).toBe(true);

    const sceneNames = withExtras.outline!.scenes.map((s) => s.trim()).filter(Boolean);
    expect(doc.scenes?.map((s) => s.name)).toEqual(sceneNames);
    expect(doc.scenes?.map((s) => s.id)).toEqual(sceneNames.map((_, i) => `scn_${i + 1}`));
    expect(doc.scenes?.every((s) => s.mood === "")).toBe(true);
  });
});

describe("聊天转单条短视频：草稿内容与服务端同形", () => {
  it("点子 = 一句话剧情 + 主线；不把故事名写成风格", async () => {
    const { id, data } = await brainstormWithOutline("外卖小哥捡到一份手稿");
    const o = data.outline!;
    const out = await promote(id, "single", data, { clientRequestId: promoteRequestId(id) });
    if (out.kind !== "short") throw new Error("应当建成短视频");
    const { data: draft } = await getDraft(out.shortId);
    expect(draft.idea).toBe(singleIdea(o.title, o.logline, o.mainline));
    expect(draft.idea).toContain(o.mainline);
    expect(draft.styleName).toBeUndefined();
    expect(draft.styleRef).toBeUndefined();
    expect(draft.fmtName).toBe(o.type);
    expect(draft.title).toBe(o.title);
  });

  it("没带 data：用已经存下的那份大纲，不是空的", async () => {
    const { id, data } = await brainstormWithOutline("雨夜便利店");
    const edited: BrainstormData = { ...data, outline: { ...data.outline!, logline: "改过的一句话剧情", mainline: "甲 → 乙" } };
    await saveBrainstorm(id, edited);
    const out = await promote(id, "single", undefined, { clientRequestId: promoteRequestId(id) });
    if (out.kind !== "short") throw new Error("应当建成短视频");
    expect((await getDraft(out.shortId)).data.idea).toBe(singleIdea(edited.outline!.title, "改过的一句话剧情", "甲 → 乙"));
  });

  it("没有大纲 → DRAMA_BRAINSTORM_NO_OUTLINE，不建草稿", async () => {
    const bs = await createBrainstorm("只聊了一句");
    await expect(promote(bs.meta.id, "single", bs.data, { clientRequestId: promoteRequestId(bs.meta.id) })).rejects.toMatchObject({
      code: "DRAMA_BRAINSTORM_NO_OUTLINE",
      status: 400,
    });
    expect(shorts.createDraft).not.toHaveBeenCalled();
  });

  it("singleIdea 与服务端同规则：已有句末标点不再补句号，缺一样就只用另一样", () => {
    expect(singleIdea("T", "她翻盘了。", "A → B")).toBe("她翻盘了。主线：A → B");
    expect(singleIdea("T", "她翻盘了", "A → B")).toBe("她翻盘了。主线：A → B");
    expect(singleIdea("T", " 只有剧情 ", "")).toBe("只有剧情");
    expect(singleIdea("T", "", "只有主线")).toBe("只有主线");
    expect(singleIdea("T", "", "")).toBe("T");
  });
});

describe("去制作之后这段对话只读", () => {
  it("再保存 → 409 DRAMA_BRAINSTORM_ALREADY_PROMOTED；再去制作回原去向，已封存的大纲不被新内容覆盖", async () => {
    const { id, data } = await brainstormWithOutline("走复仇逆袭", "series");
    const first = await promote(id, "series", data);
    const changed: BrainstormData = { ...data, outline: { ...data.outline!, title: "后来改的标题" } };

    await expect(saveBrainstorm(id, changed)).rejects.toMatchObject({ code: BRAINSTORM_ALREADY_PROMOTED, status: 409 });
    const again = await promote(id, "series", changed);
    expect(again).toEqual(first);

    const sealed = await getBrainstorm(id);
    expect(sealed.meta.status).toBe("promoted");
    expect(sealed.data.outline?.title).toBe(data.outline!.title);
  });

  it("保存一段不存在的对话 → 404 DRAMA_BRAINSTORM_NOT_FOUND，不凭空建一条", async () => {
    const data = { messages: [], outline: null, settings: { form: "series", ratio: "9:16" } } as BrainstormData;
    await expect(saveBrainstorm("brs_nope", data)).rejects.toMatchObject({ code: "DRAMA_BRAINSTORM_NOT_FOUND", status: 404 });
    await expect(getBrainstorm("brs_nope")).rejects.toMatchObject({ code: "DRAMA_BRAINSTORM_NOT_FOUND" });
  });
});
