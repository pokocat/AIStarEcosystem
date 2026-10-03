import { describe, expect, it } from "vitest";
import type { CanvasOutlineEpisode, DramaCanvasDoc } from "@ai-star-eco/types/drama-canvas";
import { emptyDoc } from "@/canvas/core";
import {
  addScriptEpisode,
  approveOutline,
  approveSetting,
  canRenumberEpisodes,
  charCount,
  episodesToWrite,
  episodeProduction,
  fillEpisodesFromOutline,
  formatEpisodeList,
  maxUsedEpisodeNo,
  patchScriptEpisode,
  removeScriptEpisode,
  scriptHeading,
  setEpisodeLocked,
  versionSummary,
} from "./script-ops";

// 断文档结构与数字，不断界面文案（§8.0.1 ⑩）。修改记录的 label 是契约里写明的（plan §2.3「通过 = pushScriptHistory(doc,"通过故事大纲")」），所以断。

const AT = "2026-09-30T08:00:00.000Z";

function outline(n: number, over: Partial<CanvasOutlineEpisode>[] = []): CanvasOutlineEpisode[] {
  return Array.from({ length: n }, (_, i) => ({ no: i + 1, title: `大纲${i + 1}`, hook: `钩子${i + 1}`, summary: `梗概${i + 1}`, ...over[i] }));
}

function ideaDoc(script: Partial<DramaCanvasDoc["script"]> = {}): DramaCanvasDoc {
  const base = emptyDoc();
  return { ...base, source: "idea", script: { ...base.script, idea: "一句话", targetEpisodes: 3, ...script } };
}

describe("fillEpisodesFromOutline：分集剧情 → 分集剧本补齐", () => {
  it("没有的集按集号补上（标题取分集剧情、正文空着），结果按集号排序", () => {
    const d = ideaDoc({ outline: { episodes: outline(3) }, episodes: [{ no: 2, title: "大纲2", text: "已有正文" }] });
    const next = fillEpisodesFromOutline(d);
    expect(next.script.episodes.map((e) => [e.no, e.title, e.text])).toEqual([
      [1, "大纲1", ""],
      [2, "大纲2", "已有正文"],
      [3, "大纲3", ""],
    ]);
  });

  it("已有正文的集：正文、标题、锁、运行引用都保留；只有标题空着 / 还是占位时才补", () => {
    const d = ideaDoc({
      outline: { episodes: outline(3, [{ title: "新标题1" }, { title: "新标题2" }, { title: "新标题3" }]) },
      episodes: [
        { no: 1, title: "我改过的标题", text: "正文一", locked: true, run: { runId: "r1", status: "succeeded" } },
        { no: 2, title: "第 2 集", text: "正文二" },
        { no: 3, title: "旧标题", text: "  " },
      ],
    });
    const next = fillEpisodesFromOutline(d);
    expect(next.script.episodes[0]).toEqual({ no: 1, title: "我改过的标题", text: "正文一", locked: true, run: { runId: "r1", status: "succeeded" } });
    expect(next.script.episodes[1]).toEqual({ no: 2, title: "新标题2", text: "正文二" });
    // 还没有正文的集，标题跟分集剧情走
    expect(next.script.episodes[2]).toEqual({ no: 3, title: "新标题3", text: "  " });
  });

  it("分集剧本里有、分集剧情里没有的集保留；已经对齐的原样返回（引用不变）", () => {
    const d = ideaDoc({
      outline: { episodes: outline(1) },
      episodes: [
        { no: 1, title: "大纲1", text: "正文" },
        { no: 5, title: "我自己加的", text: "正文五" },
      ],
    });
    expect(fillEpisodesFromOutline(d)).toBe(d);
  });

  it("不改入参", () => {
    const d = ideaDoc({ outline: { episodes: outline(2) }, episodes: [] });
    const snapshot = JSON.stringify(d);
    fillEpisodesFromOutline(d);
    expect(JSON.stringify(d)).toBe(snapshot);
  });
});

describe("通过", () => {
  it("通过故事大纲：先存一版（在 approvedAt 写上之前），再写 approvedAt；再点一次不重复存", () => {
    const d = ideaDoc({ setting: { text: "大纲正文" } });
    const next = approveSetting(d, AT);
    expect(next.script.setting).toEqual({ text: "大纲正文", approvedAt: AT });
    expect(next.script.history).toHaveLength(1);
    expect(next.script.history[0]).toMatchObject({ label: "通过故事大纲", at: AT, setting: "大纲正文" });
    expect(approveSetting(next, AT)).toBe(next);
  });

  it("没有正文的故事大纲不能通过", () => {
    const d = ideaDoc({ setting: { text: "   " } });
    expect(approveSetting(d, AT)).toBe(d);
  });

  it("通过分集剧情：存一版 + approvedAt + 把各集补进分集剧本，已有正文不丢", () => {
    const d = ideaDoc({
      setting: { text: "大纲", approvedAt: AT },
      outline: { episodes: outline(3) },
      episodes: [{ no: 1, title: "大纲1", text: "第一集的正文" }],
    });
    const next = approveOutline(d, AT);
    expect(next.script.outline?.approvedAt).toBe(AT);
    expect(next.script.history[0]).toMatchObject({ label: "通过分集剧情" });
    // 存的那一版是补齐之前的样子
    expect(next.script.history[0].episodes).toEqual([{ no: 1, title: "大纲1", text: "第一集的正文" }]);
    expect(next.script.episodes.map((e) => [e.no, e.text])).toEqual([
      [1, "第一集的正文"],
      [2, ""],
      [3, ""],
    ]);
  });
});

describe("要写哪几集 / 锁 / 加减集", () => {
  it("写全部：只挑没正文、没锁、不在写的集，含分集剧情里有但分集剧本里还没有的", () => {
    const d = ideaDoc({
      outline: { episodes: outline(5) },
      episodes: [
        { no: 1, title: "", text: "有正文" },
        { no: 2, title: "", text: "", locked: true },
        { no: 3, title: "", text: "", run: { runId: "r3", status: "running" } },
        { no: 4, title: "", text: "", run: { runId: "r4", status: "failed" } },
      ],
    });
    expect(episodesToWrite(d)).toEqual([4, 5]);
  });

  it("锁 / 解锁：不锁时不留 locked 字段", () => {
    const d = ideaDoc({ episodes: [{ no: 1, title: "t", text: "x" }] });
    const locked = setEpisodeLocked(d, 1, true);
    expect(locked.script.episodes[0].locked).toBe(true);
    const unlocked = setEpisodeLocked(locked, 1, false);
    expect("locked" in unlocked.script.episodes[0]).toBe(false);
    expect(patchScriptEpisode(d, 1, { text: "x" })).toBe(d);
  });

  it("加一集接在最后；删一集时没有下游引用就补号（补过号的清掉旧运行引用）", () => {
    const base: DramaCanvasDoc = {
      ...emptyDoc(),
      script: {
        episodes: [
          { no: 1, title: "一", text: "a" },
          { no: 2, title: "二", text: "b" },
          { no: 3, title: "三", text: "c", run: { runId: "r3", status: "succeeded" } },
        ],
        history: [],
      },
    };
    const { doc: added, no } = addScriptEpisode(base);
    expect(no).toBe(4);
    expect(added.script.episodes[3]).toEqual({ no: 4, title: "第 4 集", text: "" });

    expect(canRenumberEpisodes(base)).toBe(true);
    const removed = removeScriptEpisode(base, 2);
    expect(removed.script.episodes).toEqual([
      { no: 1, title: "一", text: "a" },
      { no: 2, title: "三", text: "c" },
    ]);
  });

  it("拆过角色和场景之后删集不补号（造型记着出现在第几集）", () => {
    const base: DramaCanvasDoc = {
      ...emptyDoc(),
      script: {
        episodes: [
          { no: 1, title: "一", text: "a" },
          { no: 2, title: "二", text: "b" },
          { no: 3, title: "三", text: "c" },
        ],
        history: [],
        extractedAt: AT,
      },
    };
    expect(canRenumberEpisodes(base)).toBe(false);
    expect(removeScriptEpisode(base, 2).script.episodes.map((e) => e.no)).toEqual([1, 3]);
  });
});

describe("删集后再加一集不复用集号（Codex 评审 #6）", () => {
  const segment = { id: "sg_1", text: "（4 秒）……", durationSec: 4, frame: { versions: [] }, video: { versions: [] } };

  it("删掉的末集在逐集制作里还有片段 / 成片：加一集跳过这个号，不会接上旧片段", () => {
    const base: DramaCanvasDoc = {
      ...emptyDoc(),
      script: {
        episodes: [
          { no: 1, title: "一", text: "a" },
          { no: 2, title: "二", text: "b" },
          { no: 3, title: "三", text: "c" },
        ],
        history: [],
      },
      episodes: [
        {
          no: 3,
          segments: [segment],
          assembled: { key: "k", durationSec: 4, at: AT, videoKeys: ["v"], runId: "ra" },
        },
      ],
    };
    expect(episodeProduction(base, 3)).toEqual({ segments: 1, assembled: true });
    const removed = removeScriptEpisode(base, 3);
    expect(removed.script.episodes.map((e) => e.no)).toEqual([1, 2]);
    expect(removed.episodes).toBe(base.episodes); // 制作数据不动
    const { doc: added, no } = addScriptEpisode(removed);
    expect(no).toBe(4);
    expect(added.episodes.find((e) => e.no === no)).toBeUndefined();
  });

  it("造型 / 场景记着的出现集数也算用过的集号", () => {
    const d: DramaCanvasDoc = {
      ...emptyDoc(),
      script: { episodes: [{ no: 1, title: "一", text: "a" }], history: [], extractedAt: AT },
      characters: [{ id: "ch", name: "甲", role: "lead", looks: [{ id: "lk", name: "基础造型", prompt: "", episodes: [1, 2], images: { versions: [] } }] }],
      scenes: [{ id: "sc", name: "教室", prompt: "", episodes: [5], images: { versions: [] } }],
    };
    expect(maxUsedEpisodeNo(d)).toBe(5);
    expect(addScriptEpisode(d).no).toBe(6);
  });
});

describe("小工具", () => {
  it("标题、字数、集号列表、修改记录摘要", () => {
    expect(scriptHeading(ideaDoc())).toBe("还没有分集剧本");
    expect(scriptHeading(ideaDoc({ episodes: [{ no: 1, title: "", text: "" }] }))).toBe("共 1 集");
    expect(charCount("第1集😀")).toBe(4);
    expect(formatEpisodeList([3, 2, 4])).toBe("第 2–4 集");
    expect(formatEpisodeList([1, 3])).toBe("第 1、3 集");
    expect(formatEpisodeList([7])).toBe("第 7 集");
    expect(
      versionSummary({ id: "h", at: AT, label: "x", setting: "s", outline: outline(2), episodes: [{ no: 1, title: "", text: "t" }] }),
    ).toBe("故事大纲 · 分集剧情 2 集 · 分集剧本 1 集");
  });
});
