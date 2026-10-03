import { describe, it, expect } from "vitest";
import {
  buildCondition,
  epDisplayTitle,
  evalCondition,
  flagUsages,
  flagsInCondition,
  parseCondition,
  projectToStory,
  validateStory,
  writeStoryToProject,
} from "./interactive-graph";
import type { ProjectData } from "@/mocks/drama-workshop";
import type { InteractiveStoryData } from "./interactive-types";

// 断言契约（错误码 / 结构 / 数据往返），不断言可视文案（AGENTS.md §8.0.1 ⑩）。

const base: ProjectData = {
  projectInfo: { title: "星核纪元", type: "科幻", episodes: 60, duration: "每集 80 秒", ratio: "9:16", logline: "", mainline: "" },
  topicCards: [],
  episodes: [
    { no: 1, content: "废土追猎中,凌霄掌心第一次亮起星核蓝光。被机械猎兵逼入绝境。" },
    { no: 2, title: "伊塔睁眼", content: "残破终端里,AI 伊塔睁开了眼睛。" },
  ],
  characters: [],
  script: { ep: 1, scenes: [] },
  storyboard: { ep: 1, scenes: [] },
  promptPack: { ep: 1, scene: "", shots: [] },
};

describe("projectToStory ⇄ writeStoryToProject", () => {
  it("没有标题的集往返一次，不会把派生出来的截断标题写回大纲", () => {
    const back = writeStoryToProject(base, projectToStory(base));
    expect(back.episodes[0].title).toBeUndefined();
    expect(back.episodes[0].content).toBe(base.episodes[0].content);
    expect(back.episodes[1].title).toBe("伊塔睁眼");
  });

  it("显示用的集名仍有兜底（空标题不显示成空白）", () => {
    const story = projectToStory(base);
    expect(story.episodes[0].title).toBe("");
    expect(epDisplayTitle(story.episodes[0]).length).toBeGreaterThan(0);
  });

  it("互动剧集数按分支图算（写回 projectInfo.episodes）", () => {
    const back = writeStoryToProject(base, projectToStory(base));
    expect(back.projectInfo.episodes).toBe(2);
  });
});

describe("剧情状态允许中文名", () => {
  const story: InteractiveStoryData = {
    schema: "story-config/v2",
    startEpisodeId: "ep1",
    globalFlags: { 拿到钥匙: false },
    episodes: [
      {
        episodeId: "ep1",
        no: 1,
        title: "门厅",
        durationSec: 30,
        videoUrl: "https://example.test/1.mp4",
        isEnding: false,
        nextVideoId: null,
        interactions: [
          {
            id: "i1",
            triggerTime: 10,
            interactionType: "choice",
            condition: buildCondition({ flag: "拿到钥匙", op: "==", value: false }),
            uiConfig: {
              question: "开哪扇门？",
              options: [
                { id: "A", text: "左门", nextVideoId: "ep2", setFlags: { 拿到钥匙: true } },
                { id: "B", text: "右门", nextVideoId: "ep2" },
              ],
            },
          },
        ],
      },
      { episodeId: "ep2", no: 2, title: "结局", durationSec: 20, videoUrl: "https://example.test/2.mp4", isEnding: true, nextVideoId: null, interactions: [] },
    ],
  };

  it("条件和选项引用中文名不会被判成「未添加」", () => {
    const r = validateStory(story);
    expect(r.errors.map((e) => e.code)).not.toContain("UNDECLARED_FLAG");
    expect(r.ok).toBe(true);
  });

  it("条件字符串可以拆开再拼回去，并能判定", () => {
    const cond = buildCondition({ flag: "好感度", op: ">=", value: 3 });
    expect(parseCondition(cond)).toEqual({ flag: "好感度", op: ">=", value: 3 });
    expect(evalCondition(cond, { 好感度: 4 })).toBe(true);
    expect(evalCondition(cond, { 好感度: 1 })).toBe(false);
    const text = buildCondition({ flag: "暗号", op: "==", value: "芝麻开门" });
    expect(parseCondition(text)?.value).toBe("芝麻开门");
  });

  it("走得到的集没成片时给 NO_VIDEO 提醒（不阻断导出）", () => {
    const noVideo: InteractiveStoryData = {
      ...story,
      episodes: story.episodes.map((e) => (e.no === 2 ? { ...e, videoUrl: null, durationSec: 0 } : e)),
    };
    const r = validateStory(noVideo);
    expect(r.warnings.map((w) => w.code)).toContain("NO_VIDEO");
    expect(r.ok).toBe(true);
  });
});

describe("条件的拼与拆互逆（WB5）", () => {
  const texts = ['他说"好"', "C:\\temp\\new", "引号'和\\反斜杠\"都有", "", "true", "12", "  前后有空格  ", "第一行\n第二行", "段落\u2028分隔"];
  it.each(texts)("文字值 %j 拼回去再拆开还是它，试玩判定成立", (value) => {
    const cond = buildCondition({ flag: "暗号", op: "==", value });
    expect(parseCondition(cond)).toEqual({ flag: "暗号", op: "==", value });
    expect(evalCondition(cond, { 暗号: value })).toBe(true);
    expect(evalCondition(cond, { 暗号: value + "x" })).toBe(false);
  });

  it("是否 / 数字的值照旧（含小数、负数、科学计数）", () => {
    for (const value of [true, false, 0, -3, 2.5, 1e21]) {
      expect(parseCondition(buildCondition({ flag: "x", op: "==", value }))?.value).toBe(value);
    }
  });

  it("老数据：单引号串和裸词也能读", () => {
    expect(parseCondition("globalFlags.x == 'it\\'s'")?.value).toBe("it's");
    expect(parseCondition("globalFlags.x == abc")?.value).toBe("abc");
  });

  it("文字值里写着 globalFlags.y 不算引用了 y", () => {
    const cond = buildCondition({ flag: "x", op: "==", value: "globalFlags.y" });
    expect(flagsInCondition(cond)).toEqual(["x"]);
  });
});

describe("剧情状态改类型 / 删除（WB6 / WB7）", () => {
  const ep = (over: Partial<InteractiveStoryData["episodes"][number]>): InteractiveStoryData["episodes"][number] => ({
    episodeId: "ep1",
    no: 1,
    title: "门厅",
    durationSec: 30,
    videoUrl: "https://example.test/1.mp4",
    isEnding: false,
    nextVideoId: null,
    interactions: [],
    ...over,
  });
  const story = (flags: InteractiveStoryData["globalFlags"]): InteractiveStoryData => ({
    schema: "story-config/v2",
    startEpisodeId: "ep1",
    globalFlags: flags,
    episodes: [
      ep({
        interactions: [
          {
            id: "i1",
            triggerTime: 10,
            interactionType: "choice",
            condition: buildCondition({ flag: "钥匙", op: "==", value: true }),
            uiConfig: {
              question: "开门？",
              options: [
                { id: "A", text: "开", nextVideoId: "ep2", setFlags: { 钥匙: false } },
                { id: "B", text: "不开", nextVideoId: "ep2" },
              ],
            },
          },
          {
            id: "i2",
            triggerTime: 20,
            interactionType: "input",
            uiConfig: { question: "说点什么", inputKey: "钥匙" },
          },
        ],
      }),
      ep({ episodeId: "ep2", no: 2, title: "结局", isEnding: true, interactions: [] }),
    ],
  });
  const codes = (s: InteractiveStoryData) => validateStory(s).warnings.map((w) => w.code);

  it("类型没变：不提醒", () => {
    expect(codes(story({ 钥匙: false }))).not.toContain("FLAG_TYPE_MISMATCH");
  });

  it("「是否」改成「数字」后，旧条件和旧选项值都提醒要改（不拦导出）", () => {
    const s = story({ 钥匙: 0 });
    const mismatches = validateStory(s).warnings.filter((w) => w.code === "FLAG_TYPE_MISMATCH");
    expect(mismatches).toHaveLength(2);
    expect(mismatches.every((w) => w.episodeId === "ep1")).toBe(true);
    expect(validateStory(s).errors.map((e) => e.code)).not.toContain("FLAG_TYPE_MISMATCH");
  });

  it("比较方式这种类型用不了（数字改成文字后还是「大于」）也算对不上", () => {
    const s = story({ 钥匙: "" });
    s.episodes[0].interactions[0].condition = buildCondition({ flag: "钥匙", op: ">", value: "a" });
    s.episodes[0].interactions[0].uiConfig.options = [{ id: "A", text: "开", nextVideoId: "ep2" }];
    expect(codes(s)).toContain("FLAG_TYPE_MISMATCH");
  });

  it("flagUsages 列出每一处用到它的地方", () => {
    const u = flagUsages(story({ 钥匙: false }), "钥匙");
    expect(u.map((x) => [x.episodeId, x.kind])).toEqual([
      ["ep1", "condition"],
      ["ep1", "setFlags"],
      ["ep1", "inputKey"],
    ]);
    expect(u.every((x) => !x.stale)).toBe(true);
    expect(flagUsages(story({ 钥匙: false }), "没用到的")).toEqual([]);
    // 改成数字后：条件和选项那两处标成要重新设，填空记录不算
    expect(flagUsages(story({ 钥匙: 0 }), "钥匙").map((x) => [x.kind, x.stale])).toEqual([
      ["condition", true],
      ["setFlags", true],
      ["inputKey", false],
    ]);
  });
});
