import { describe, expect, it, vi } from "vitest";
import type { ShortDraftData, ShortDraftDetail, ShortDraftShot } from "@/api/shorts";
import { createDraftSync, type DraftSyncApi } from "./draft-sync";

// 离页后的两条补存互相覆盖（评审复核 P2）：服务端 PUT 整份替换、没有版本比较（DramaShortService.save），
// 所以这里用一个「整份替换」的假服务端，断的是**最后落库的内容**（行为），不断文案（§8.0.1 ⑩）。

const baseShot = (id: string, patch: Partial<ShortDraftShot> = {}): ShortDraftShot => ({
  id,
  no: 1,
  dur: 4,
  visual: "",
  size: "",
  move: "",
  voWho: "口播",
  voText: "",
  sfx: "",
  bgm: "",
  fx: "",
  refs: [],
  sub: false,
  flow: "frame",
  engine: "",
  frameIdx: 0,
  frameUrl: "f",
  ...patch,
});

const draft = (shots: ShortDraftShot[], title = "t"): ShortDraftData => ({ title, shots } as unknown as ShortDraftData);

/** 整份替换的假服务端；每次 PUT 可以指定晚多久落库（模拟响应先后）。 */
function fakeServer(initial: ShortDraftData) {
  let stored = initial;
  const delays: number[] = [];
  const puts: ShortDraftData[] = [];
  const api: DraftSyncApi = {
    getDraft: vi.fn(async () => ({ meta: { status: "draft" }, data: structuredClone(stored) }) as unknown as ShortDraftDetail),
    saveDraft: vi.fn(async (_id: string, data: ShortDraftData) => {
      const ms = delays.shift() ?? 0;
      await new Promise((r) => setTimeout(r, ms));
      stored = structuredClone(data);
      puts.push(stored);
    }),
  };
  return { api, delays, puts, get stored() { return stored; } };
}

const pj = { jobId: "mvj_late", kind: "clip" as const };

describe("同一条草稿的保存排队", () => {
  it("先发的慢、后发的快：仍按调用顺序落库，后发的那份是最终结果", async () => {
    const srv = fakeServer(draft([baseShot("a")]));
    const sync = createDraftSync(srv.api);
    srv.delays.push(30, 0);
    const first = sync.enqueue("d1", () => srv.api.saveDraft("d1", draft([baseShot("a")], "旧")));
    const second = sync.enqueue("d1", () => srv.api.saveDraft("d1", draft([baseShot("a")], "新")));
    await Promise.all([first, second]);
    expect((srv.stored as unknown as { title: string }).title).toBe("新");
  });

  it("前一个失败不挡后一个", async () => {
    const srv = fakeServer(draft([baseShot("a")]));
    const sync = createDraftSync(srv.api);
    const failed = sync.enqueue("d1", () => Promise.reject(new Error("boom")));
    const ok = sync.enqueue("d1", () => srv.api.saveDraft("d1", draft([baseShot("a")], "后")));
    await expect(failed).rejects.toThrow("boom");
    await ok;
    expect((srv.stored as unknown as { title: string }).title).toBe("后");
  });
});

describe("离页后迟到的任务号：只补这一镜，不整份覆盖", () => {
  it("点生成后立刻离页：卸载补存（没任务号、落得慢）和补记任务号都在路上，最后库里有任务号", async () => {
    const srv = fakeServer(draft([baseShot("a")]));
    const sync = createDraftSync(srv.api);
    srv.delays.push(40); // 卸载补存很慢
    void sync.enqueue("d1", () => srv.api.saveDraft("d1", draft([baseShot("a")], "离页时")));
    await sync.reportLateJob("d1", "a", pj);
    expect(srv.stored.shots[0].pendingJob).toEqual(pj);
    expect((srv.stored as unknown as { title: string }).title).toBe("离页时");
  });

  it("离页后又打开改了别的：补记任务号读的是最新一版，新编辑不被旧页面的快照盖掉", async () => {
    const srv = fakeServer(draft([baseShot("a"), baseShot("b", { visual: "旧画面" })]));
    const sync = createDraftSync(srv.api);
    // 新页面存下的编辑
    await sync.enqueue("d1", () => srv.api.saveDraft("d1", draft([baseShot("a"), baseShot("b", { visual: "新画面" })], "新")));
    await sync.reportLateJob("d1", "a", pj);
    expect(srv.stored.shots[1].visual).toBe("新画面");
    expect(srv.stored.shots[0].pendingJob).toEqual(pj);
  });

  it("这条草稿正开着：交给开着的页面，不自己读写（页面会带着它的最新状态立刻落库）", async () => {
    const srv = fakeServer(draft([baseShot("a")]));
    const sync = createDraftSync(srv.api);
    const got: Array<[string, typeof pj]> = [];
    const off = sync.subscribe("d1", (shotId, job) => got.push([shotId, job as typeof pj]));
    await sync.reportLateJob("d1", "a", pj);
    expect(got).toEqual([["a", pj]]);
    expect(srv.api.getDraft).not.toHaveBeenCalled();
    expect(srv.api.saveDraft).not.toHaveBeenCalled();
    off();
  });

  it("补记先于打开：打开的页面挂载时还能认领（即使补存没存上）", async () => {
    const srv = fakeServer(draft([baseShot("a")]));
    srv.api.getDraft = vi.fn(async () => {
      throw new Error("offline");
    });
    const sync = createDraftSync(srv.api);
    await sync.reportLateJob("d1", "a", pj);
    const got: string[] = [];
    sync.subscribe("d1", (shotId) => got.push(shotId));
    expect(got).toEqual(["a"]);
  });

  it("这一镜已经有别的任务 / 已经有视频：不补，库里不动", async () => {
    const srv = fakeServer(draft([baseShot("a", { pendingJob: { jobId: "other", kind: "clip" } }), baseShot("b", { flow: "clip", videoUrl: "v.mp4", jobId: "x" })]));
    const sync = createDraftSync(srv.api);
    await sync.reportLateJob("d1", "a", pj);
    await sync.reportLateJob("d1", "b", { jobId: "mvj_2", kind: "clip" });
    expect(srv.api.saveDraft).not.toHaveBeenCalled();
    expect(srv.stored.shots[0].pendingJob).toEqual({ jobId: "other", kind: "clip" });
  });
});
