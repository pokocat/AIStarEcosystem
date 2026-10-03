import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { CHARS_AUTOSAVE_DELAY_MS, useCharsAutosave } from "./use-chars-autosave";
import { workshopReducer, type WorkshopState } from "./workshop-shell";
import type { CharacterDef, ProjectData } from "@/mocks/drama-workshop";

// 断行为：落库后文档里有什么（§8.0.1 ⑩，不断言文案）。

const DOC: ProjectData = {
  projectInfo: { title: "T", type: "都市", episodes: 3, duration: "每集 60 秒", ratio: "9:16", logline: "", mainline: "" },
  topicCards: [],
  episodes: [{ no: 1, content: "E1" }],
  characters: [],
  script: { ep: 1, scenes: [] },
  storyboard: { ep: 1, scenes: [] },
  promptPack: { ep: 1, scene: "", shots: [] },
};

const ch = (over: Partial<CharacterDef> = {}): CharacterDef => ({
  id: "c1",
  name: "甲",
  role: "key",
  cast: "",
  desc: "",
  avatar: "a1",
  bound: false,
  ...over,
});

/** 模拟工作台页面的 patchData：按「服务端那份最新文档」合并。 */
function makeCtx() {
  const store = { doc: DOC };
  const patchData = vi.fn(async (patch: (prev: ProjectData) => ProjectData) => {
    store.doc = patch(store.doc);
  });
  return { store, ctx: { patchData, notifyEditing: vi.fn() } };
}

describe("useCharsAutosave（WB2）", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("绑定数字人后的等待期间写进来的成片，不会被角色保存盖掉", () => {
    const { store, ctx } = makeCtx();
    const c0 = [ch()];
    const { rerender } = renderHook(({ chars }) => useCharsAutosave(chars, ctx), { initialProps: { chars: c0 } });

    const c1 = [ch({ bound: true, avatarId: "av1", avatarImage: "https://img.test/a.jpg" })];
    rerender({ chars: c1 });
    // 这 600ms 里某一集生成完写回了文档
    store.doc = { ...store.doc, episodeDocs: { "1": { assembled: { url: "https://v.test/1.mp4" } } } as ProjectData["episodeDocs"] };
    vi.advanceTimersByTime(CHARS_AUTOSAVE_DELAY_MS);

    expect(ctx.patchData).toHaveBeenCalledTimes(1);
    expect(store.doc.characters).toEqual(c1);
    expect(Object.keys(store.doc.episodeDocs ?? {})).toEqual(["1"]);
  });

  it("连着改几次只存最后一次", () => {
    const { store, ctx } = makeCtx();
    const { rerender } = renderHook(({ chars }) => useCharsAutosave(chars, ctx), { initialProps: { chars: [ch()] } });
    rerender({ chars: [ch({ name: "乙" })] });
    vi.advanceTimersByTime(CHARS_AUTOSAVE_DELAY_MS / 2);
    const last = [ch({ name: "丙" })];
    rerender({ chars: last });
    vi.advanceTimersByTime(CHARS_AUTOSAVE_DELAY_MS);
    expect(ctx.patchData).toHaveBeenCalledTimes(1);
    expect(store.doc.characters).toEqual(last);
  });

  it("没到时间就离开工作台：卸载时把这次改动存掉，而不是丢掉", () => {
    const { store, ctx } = makeCtx();
    const { rerender, unmount } = renderHook(({ chars }) => useCharsAutosave(chars, ctx), { initialProps: { chars: [ch()] } });
    const next = [ch({ bound: true, avatarId: "av1" })];
    rerender({ chars: next });
    unmount();
    expect(ctx.patchData).toHaveBeenCalledTimes(1);
    expect(store.doc.characters).toEqual(next);
  });

  it("首次挂载不保存；ctx 换了新对象也不会重排保存", () => {
    const { ctx } = makeCtx();
    const chars = [ch()];
    const { rerender } = renderHook(({ c }) => useCharsAutosave(chars, c), { initialProps: { c: ctx } });
    rerender({ c: { ...ctx } });
    rerender({ c: { ...ctx } });
    vi.advanceTimersByTime(CHARS_AUTOSAVE_DELAY_MS * 3);
    expect(ctx.patchData).not.toHaveBeenCalled();
  });
});

describe("主要角色改成配角（WB8）", () => {
  const state = (c: CharacterDef): WorkshopState => ({ stage: "outline", ep: 1, lockedStages: {}, chars: [c] });

  it("解绑数字人：绑定标记、数字人 id 和那张图都清掉，自己的定妆照和多角度参考图留着", () => {
    const refImages = [{ angle: "front", url: "https://img.test/front.jpg" }] as CharacterDef["refImages"];
    const before = ch({
      bound: true,
      avatarId: "av1",
      avatarImage: "https://img.test/avatar.jpg",
      refUrl: "https://img.test/mine.jpg",
      refCdnKey: "drama/refs/mine.jpg",
      refImages,
    });
    const after = workshopReducer(state(before), { type: "toggleRole", charId: "c1" }).chars[0];
    expect(after.role).toBe("extra");
    expect(after.bound).toBe(false);
    expect(after.avatarId).toBeUndefined();
    expect(after.avatarImage).toBeUndefined();
    expect("avatarId" in after).toBe(false);
    expect(after.refUrl).toBe("https://img.test/mine.jpg");
    expect(after.refCdnKey).toBe("drama/refs/mine.jpg");
    expect(after.refImages).toEqual(refImages);
  });

  it("配角改回主要角色：其他字段原样", () => {
    const before = ch({ role: "extra", refUrl: "https://img.test/mine.jpg" });
    const after = workshopReducer(state(before), { type: "toggleRole", charId: "c1" }).chars[0];
    expect(after).toEqual({ ...before, role: "key" });
  });

  it("patchChar 只改这一个角色，按最新角色表合并", () => {
    const s0: WorkshopState = { stage: "outline", ep: 1, lockedStages: {}, chars: [ch(), ch({ id: "c2", name: "乙" })] };
    // 上传期间先改了乙的名字
    const s1 = workshopReducer(s0, { type: "patchChar", charId: "c2", patch: { name: "乙改" } });
    // 上传完成回写甲
    const s2 = workshopReducer(s1, { type: "patchChar", charId: "c1", patch: { refUrl: "https://img.test/r.jpg" } });
    expect(s2.chars.map((c) => [c.id, c.name, c.refUrl])).toEqual([
      ["c1", "甲", "https://img.test/r.jpg"],
      ["c2", "乙改", undefined],
    ]);
  });
});
