import { describe, expect, it } from "vitest";
import { createDocHistory } from "./stale-save";
import { withEpisodeDoc, type CharacterDef, type EpisodeDoc, type ProjectData } from "@/mocks/drama-workshop";

// 整份保存的旧快照回正（v0.197 复核）。断落库后文档里有什么（§8.0.1 ⑩）。
// 每个用例都照页面的真实顺序走：commit = record(旧, 新) 后换成新文档；saveData = rebase(调用方拼的, 最新) 再 commit。

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

const epDoc = (tag: string): EpisodeDoc =>
  ({
    script: { ep: 1, scenes: [] },
    storyboard: { ep: 1, scenes: [{ id: tag, shots: [] }] },
  }) as unknown as EpisodeDoc;

const DOC0: ProjectData = {
  projectInfo: { title: "T", type: "都市", episodes: 3, duration: "每集 60 秒", ratio: "9:16", logline: "", mainline: "" },
  topicCards: [],
  episodes: [{ no: 1, content: "E1" }, { no: 2, content: "E2" }],
  characters: [ch()],
  script: { ep: 1, scenes: [] },
  storyboard: { ep: 1, scenes: [] },
  promptPack: { ep: 1, scene: "", shots: [] },
  episodeDocs: { "1": epDoc("ep1-v0"), "2": epDoc("ep2-v0") },
};

/** 页面的保存漏斗（与 page.tsx 同语义）。 */
function makeFunnel(initial: ProjectData) {
  const h = createDocHistory();
  let cur = initial;
  const commit = (next: ProjectData) => {
    h.record(cur, next);
    cur = next;
  };
  return {
    get cur() {
      return cur;
    },
    patchData: (patch: (prev: ProjectData) => ProjectData) => commit(patch(cur)),
    saveData: (next: ProjectData) => commit(h.rebase(next, cur)),
  };
}

describe("整份保存的旧快照回正", () => {
  it("合成成片期间原地绑了数字人：合成结果落库，绑定不会被写回未绑定", () => {
    const f = makeFunnel(DOC0);
    const snapshot = f.cur; // 点「合成」那一刻的 data
    // 合成期间：右侧角色面板绑了数字人（角色自动保存走 patchData）
    const bound = [ch({ bound: true, avatarId: "av1", avatarImage: "https://img.test/a.jpg" })];
    f.patchData((prev) => ({ ...prev, characters: bound }));
    // 合成回来：assemble.tsx 用点击时的 data 拼整份
    const assembled = { ...snapshot.episodeDocs!["1"], assembled: { url: "https://v.test/1.mp4" } } as EpisodeDoc;
    f.saveData(withEpisodeDoc(snapshot, 1, assembled));

    expect(f.cur.characters).toEqual(bound);
    expect(f.cur.episodeDocs?.["1"]).toBe(assembled);
  });

  it("合成第 1 集期间第 2 集的分镜改了：第 2 集不会被旧快照写回", () => {
    const f = makeFunnel(DOC0);
    const snapshot = f.cur;
    const ep2 = epDoc("ep2-v1");
    f.saveData(withEpisodeDoc(f.cur, 2, ep2)); // 第 2 集分镜防抖落库（快照是最新的）
    f.saveData(withEpisodeDoc(snapshot, 1, epDoc("ep1-v1"))); // 第 1 集合成回来（旧快照）

    expect(f.cur.episodeDocs?.["2"]).toBe(ep2);
    expect(f.cur.episodeDocs?.["1"]).toEqual(epDoc("ep1-v1"));
  });

  it("快照之后才新建的那一集、才加的场景：旧快照不会把它们丢掉", () => {
    const f = makeFunnel(DOC0);
    const snapshot = f.cur;
    const ep3 = epDoc("ep3-v0");
    f.patchData((prev) => withEpisodeDoc(prev, 3, ep3));
    const scenes = [{ id: "s1", name: "天台", mood: "" }];
    f.patchData((prev) => ({ ...prev, scenes }));
    f.saveData(withEpisodeDoc(snapshot, 1, epDoc("ep1-v1")));

    expect(f.cur.episodeDocs?.["3"]).toBe(ep3);
    expect(f.cur.scenes).toBe(scenes);
  });

  it("调用方真改了的字段照常写入；快照是最新的时候什么都不动", () => {
    const f = makeFunnel(DOC0);
    const episodes = [{ no: 1, content: "改过的 E1" }];
    const next = { ...withEpisodeDoc(f.cur, 1, epDoc("ep1-v1")), episodes };
    f.saveData(next);
    expect(f.cur.episodes).toBe(episodes);
    expect(f.cur.characters).toBe(DOC0.characters);
    expect(f.cur.episodeDocs?.["2"]).toBe(DOC0.episodeDocs!["2"]);
  });

  it("快照之后被删掉的那一集，旧快照不能把它带回来", () => {
    const f = makeFunnel(DOC0);
    const snapshot = f.cur;
    f.patchData((prev) => {
      const { "2": _gone, ...rest } = prev.episodeDocs ?? {};
      return { ...prev, episodeDocs: rest };
    });
    f.saveData(withEpisodeDoc(snapshot, 1, epDoc("ep1-v1")));
    expect(Object.keys(f.cur.episodeDocs ?? {})).toEqual(["1"]);
  });

  it("patchData 不回正：它删掉的字段就是删掉", () => {
    const f = makeFunnel({ ...DOC0, scenes: [{ id: "s1", name: "天台", mood: "" }] });
    f.patchData((prev) => {
      const { scenes: _s, ...rest } = prev;
      return rest as ProjectData;
    });
    expect(f.cur.scenes).toBeUndefined();
  });
});
