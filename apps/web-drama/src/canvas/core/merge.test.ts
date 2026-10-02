import { describe, expect, it } from "vitest";
import type { DramaCanvasDoc, DramaCanvasRun } from "@ai-star-eco/types/drama-canvas";
import { emptyDoc, findLook, findSegment } from "./doc-ops";
import {
  applyRunRef,
  applyRunResult,
  collectRunRefs,
  pushScriptHistory,
  restoreScriptVersion,
  runRefAt,
  SCRIPT_HISTORY_LIMIT,
} from "./merge";

// 合并规则（契约：drama-canvas.ts 红线 3 + contract.ts merge.ts 一节）。
// 断的是文档结构与幂等性，不断界面文案（§8.0.1 ⑩）。fixture 照服务端 DTO 形状写（§8.0.1 ⑦）。

function baseDoc(): DramaCanvasDoc {
  const d = emptyDoc();
  return {
    ...d,
    source: "idea",
    script: {
      idea: "一句话",
      targetEpisodes: 2,
      setting: { text: "旧的故事大纲" },
      episodes: [
        { no: 1, title: "第一集", text: "旧的第一集正文" },
        { no: 2, title: "第二集", text: "锁住的正文", locked: true },
      ],
      history: [],
    },
    characters: [
      {
        id: "ch_1",
        name: "林微",
        role: "lead",
        looks: [{ id: "lk_1", name: "基础造型", prompt: "用户改过的描述", episodes: [1], images: { versions: [{ key: "k/old.png" }] } }],
      },
    ],
    scenes: [{ id: "sc_1", name: "旧教室", prompt: "场景描述", episodes: [1], images: { versions: [] } }],
    episodes: [
      {
        no: 1,
        segments: [{ id: "sg_1", text: "（4 秒）甲", durationSec: 4, frame: { versions: [] }, video: { versions: [] } }],
      },
    ],
  };
}

function run(over: Partial<DramaCanvasRun> & Pick<DramaCanvasRun, "id" | "kind" | "target">): DramaCanvasRun {
  return {
    canvasId: "dcv_1",
    status: "succeeded",
    cost: 2,
    createdAt: "2026-09-30T01:00:00.000Z",
    finishedAt: "2026-09-30T01:00:05.000Z",
    ...over,
  };
}

describe("applyRunRef", () => {
  it("把引用写到目标上；同一个再写一次原样返回", () => {
    const r = run({ id: "r1", kind: "image", target: "look:lk_1", status: "queued" });
    const d1 = applyRunRef(baseDoc(), r);
    expect(runRefAt(d1, "look:lk_1")).toEqual({ runId: "r1", status: "queued" });
    expect(applyRunRef(d1, r)).toBe(d1);
  });

  it("运行已经是终态时只写 running（终态只由 applyRunResult 写，写上 = 合过了）", () => {
    const r = run({ id: "r1", kind: "image", target: "look:lk_1", status: "succeeded", result: { images: [{ key: "k/new.png" }] } });
    const d1 = applyRunRef(baseDoc(), r);
    expect(runRefAt(d1, "look:lk_1")?.status).toBe("running");
    const d2 = applyRunResult(d1, r);
    expect(runRefAt(d2, "look:lk_1")?.status).toBe("succeeded");
    expect(findLook(d2, "lk_1")!.look.images.versions.map((v) => v.key)).toEqual(["k/new.png", "k/old.png"]);
    // 合过之后再走一遍 ref + result，文档不变
    expect(applyRunResult(applyRunRef(d2, r), r)).toBe(d2);
  });

  it("目标不存在（造型删了）→ 原样返回", () => {
    const d = baseDoc();
    expect(applyRunRef(d, run({ id: "r1", kind: "image", target: "look:gone", status: "queued" }))).toBe(d);
  });

  it("剧本某一集还没有记录时顺手建一条（写分集剧本前）", () => {
    const d = applyRunRef(baseDoc(), run({ id: "r1", kind: "script", target: "script:episode:3", status: "queued" }));
    expect(d.script.episodes.map((e) => e.no)).toEqual([1, 2, 3]);
    expect(d.script.episodes[2].run).toEqual({ runId: "r1", status: "queued" });
  });
});

describe("applyRunResult · 幂等", () => {
  it("出图：新图放最前并挑中；同一次运行合两次不变", () => {
    const r = run({ id: "r1", kind: "image", target: "look:lk_1", result: { images: [{ key: "k/a.png" }, { key: "k/b.png" }] } });
    const d0 = applyRunRef(baseDoc(), r);
    const d1 = applyRunResult(d0, r);
    const images = findLook(d1, "lk_1")!.look.images;
    expect(images.versions.map((v) => v.key)).toEqual(["k/a.png", "k/b.png", "k/old.png"]);
    expect(images.pickedKey).toBe("k/a.png");
    expect(images.versions[0].runId).toBe("r1");
    expect(applyRunResult(d1, r)).toBe(d1);
  });

  it("引用被新的一次顶掉了：图照样按 key 去重合进候选，但不动引用", () => {
    const newer = run({ id: "r2", kind: "image", target: "look:lk_1", status: "running" });
    const older = run({ id: "r1", kind: "image", target: "look:lk_1", result: { images: [{ key: "k/a.png" }] } });
    const d0 = applyRunRef(baseDoc(), newer);
    const d1 = applyRunResult(d0, older);
    expect(findLook(d1, "lk_1")!.look.images.versions.map((v) => v.key)).toContain("k/a.png");
    expect(runRefAt(d1, "look:lk_1")).toEqual({ runId: "r2", status: "running" });
    expect(applyRunResult(d1, older)).toBe(d1);
  });

  it("失败：只改引用状态，内容不动", () => {
    const r = run({ id: "r1", kind: "image", target: "scene:sc_1", status: "failed", errorCode: "X", errorMessage: "没出来" });
    const d0 = applyRunRef(baseDoc(), r);
    const d1 = applyRunResult(d0, r);
    expect(runRefAt(d1, "scene:sc_1")?.status).toBe("failed");
    expect(d1.scenes[0].images.versions).toEqual([]);
    expect(applyRunResult(d1, r)).toBe(d1);
  });

  it("同一次运行先记成失败、之后服务端对账恢复成成功：照样合一次（再合仍不变）", () => {
    const failed = run({ id: "r1", kind: "video", target: "video:1:sg_1", status: "failed", errorCode: "X" });
    const d1 = applyRunResult(applyRunRef(baseDoc(), failed), failed);
    expect(findSegment(d1, 1, "sg_1")!.videoRun?.status).toBe("failed");
    expect(applyRunResult(d1, failed)).toBe(d1); // 失败再来一次：不动
    const ok = run({
      id: "r1",
      kind: "video",
      target: "video:1:sg_1",
      result: { video: { key: "k/v.mp4", durationSec: 4, runId: "r1", createdAt: "2026-09-30T01:00:05.000Z" } },
    });
    const d2 = applyRunResult(d1, ok);
    const seg = findSegment(d2, 1, "sg_1")!;
    expect(seg.video.versions.map((v) => v.key)).toEqual(["k/v.mp4"]);
    expect(seg.videoRun).toEqual({ runId: "r1", status: "succeeded" });
    expect(applyRunResult(d2, ok)).toBe(d2);
    expect(applyRunResult(d2, failed)).toBe(d2); // 成功合过了，不会被一条失败盖回去
  });

  it("还没到终态：只推进引用上的状态", () => {
    const q = run({ id: "r1", kind: "video", target: "video:1:sg_1", status: "queued" });
    const d0 = applyRunRef(baseDoc(), q);
    const d1 = applyRunResult(d0, { ...q, status: "running" });
    expect(findSegment(d1, 1, "sg_1")!.videoRun).toEqual({ runId: "r1", status: "running" });
    expect(applyRunResult(d1, { ...q, status: "running" })).toBe(d1);
  });

  it("视频：新版本放最前并挑中（带末帧）", () => {
    const r = run({
      id: "r1",
      kind: "video",
      target: "video:1:sg_1",
      result: { video: { key: "k/v.mp4", lastFrameKey: "k/last.png", durationSec: 4, runId: "r1", createdAt: "2026-09-30T01:00:05.000Z" } },
    });
    const d1 = applyRunResult(applyRunRef(baseDoc(), r), r);
    const seg = findSegment(d1, 1, "sg_1")!;
    expect(seg.video.pickedKey).toBe("k/v.mp4");
    expect(seg.video.versions[0].lastFrameKey).toBe("k/last.png");
    expect(applyRunResult(d1, r)).toBe(d1);
  });
});

describe("applyRunResult · 剧本", () => {
  it("AI 覆盖故事大纲前自动存一版（存的是旧正文），合两次只存一版", () => {
    const r = run({ id: "r1", kind: "script", target: "script:setting", result: { setting: { text: "新的故事大纲" } } });
    const d1 = applyRunResult(applyRunRef(baseDoc(), r), r);
    expect(d1.script.setting?.text).toBe("新的故事大纲");
    expect(d1.script.history).toHaveLength(1);
    expect(d1.script.history[0].setting).toBe("旧的故事大纲");
    expect(applyRunResult(d1, r)).toBe(d1);
  });

  it("AI 重写某一集前也存一版；锁住的集不被覆盖", () => {
    const r1 = run({ id: "r1", kind: "script", target: "script:episode:1", result: { episode: { no: 1, title: "新标题", text: "新正文" } } });
    const d1 = applyRunResult(applyRunRef(baseDoc(), r1), r1);
    expect(d1.script.episodes[0]).toMatchObject({ title: "新标题", text: "新正文" });
    expect(d1.script.history[0].episodes.find((e) => e.no === 1)?.text).toBe("旧的第一集正文");

    const r2 = run({ id: "r2", kind: "script", target: "script:episode:2", result: { episode: { no: 2, title: "x", text: "不该写进去" } } });
    const d2 = applyRunResult(applyRunRef(d1, r2), r2);
    expect(d2.script.episodes[1].text).toBe("锁住的正文");
    expect(runRefAt(d2, "script:episode:2")?.status).toBe("succeeded");
  });

  it("引用指着别的运行时，文字类结果不合（旧结果不许盖掉新结果）", () => {
    const newer = run({ id: "r2", kind: "script", target: "script:setting", status: "running" });
    const older = run({ id: "r1", kind: "script", target: "script:setting", result: { setting: { text: "旧运行的结果" } } });
    const d0 = applyRunRef(baseDoc(), newer);
    expect(applyRunResult(d0, older)).toBe(d0);
  });

  it("分集剧情：整体替换、清掉通过时间", () => {
    const d = { ...baseDoc(), script: { ...baseDoc().script, outline: { episodes: [{ no: 1, title: "a", hook: "b", summary: "c" }], approvedAt: "2026-09-30T00:00:00.000Z" } } };
    const r = run({ id: "r1", kind: "script", target: "script:outline", result: { outline: { episodes: [{ no: 1, title: "新", hook: "钩子", summary: "梗概" }] } } });
    const d1 = applyRunResult(applyRunRef(d, r), r);
    expect(d1.script.outline?.episodes[0].title).toBe("新");
    expect(d1.script.outline?.approvedAt).toBeUndefined();
    expect(d1.script.history[0].outline?.[0].title).toBe("a");
  });
});

describe("applyRunResult · 拆出角色和场景（按名字合并）", () => {
  const r = run({
    id: "dcr_x1",
    kind: "extract",
    target: "extract",
    result: {
      extract: {
        characters: [
          {
            name: "林微",
            role: "support",
            bio: "不该覆盖",
            looks: [
              { name: "基础造型", prompt: "AI 的新描述", episodes: [1, 2] },
              { name: "学生时期", prompt: "学生", episodes: [2] },
            ],
          },
          { name: "陈屹", role: "lead", bio: "新角色", looks: [{ name: "基础造型", prompt: "陈屹描述", episodes: [2] }] },
        ],
        scenes: [
          { name: "旧教室", prompt: "AI 新场景描述", episodes: [2] },
          { name: "天台", prompt: "天台描述", episodes: [2] },
        ],
        notes: [],
      },
    },
  });

  it("已有的保留（只补出现集数），新的追加并分配 id；记下拆的时间", () => {
    const d1 = applyRunResult(applyRunRef(baseDoc(), r), r);
    const lin = d1.characters.find((c) => c.name === "林微")!;
    expect(lin.id).toBe("ch_1");
    expect(lin.role).toBe("lead");
    expect(lin.looks[0]).toMatchObject({ id: "lk_1", prompt: "用户改过的描述", episodes: [1, 2] });
    expect(lin.looks[0].images.versions.map((v) => v.key)).toEqual(["k/old.png"]);
    expect(lin.looks[1]).toMatchObject({ name: "学生时期", prompt: "学生", episodes: [2] });
    expect(lin.looks[1].id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);

    const chen = d1.characters.find((c) => c.name === "陈屹")!;
    expect(chen.id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(chen.looks).toHaveLength(1);

    expect(d1.scenes.find((s) => s.id === "sc_1")).toMatchObject({ prompt: "场景描述", episodes: [1, 2] });
    expect(d1.scenes.map((s) => s.name)).toEqual(["旧教室", "天台"]);
    expect(d1.script.extractedAt).toBe(r.finishedAt);
  });

  it("同一次运行合两次不变；即使引用丢了重跑一遍合并，id 也是同一个（不会拆出两个陈屹）", () => {
    const d1 = applyRunResult(applyRunRef(baseDoc(), r), r);
    expect(applyRunResult(d1, r)).toBe(d1);
    const d2 = applyRunResult(applyRunRef(baseDoc(), r), r);
    expect(d2.characters.map((c) => c.id)).toEqual(d1.characters.map((c) => c.id));
  });
});

describe("applyRunResult · 分镜脚本", () => {
  it("整集替换片段，片段 id 由运行 id 派生；合两次不变", () => {
    const r = run({
      id: "r1",
      kind: "storyboard",
      target: "storyboard:1",
      result: { storyboard: { episodeNo: 1, segments: [{ text: "（4 秒）甲\n（3 秒）乙", durationSec: 7 }, { text: "（5 秒）丙", durationSec: 0 }], notes: [] } },
    });
    const d1 = applyRunResult(applyRunRef(baseDoc(), r), r);
    const segs = d1.episodes[0].segments;
    expect(segs).toHaveLength(2);
    expect(segs.map((s) => s.durationSec)).toEqual([7, 5]);
    expect(new Set(segs.map((s) => s.id)).size).toBe(2);
    expect(applyRunResult(d1, r)).toBe(d1);
  });
});

describe("pushScriptHistory / restoreScriptVersion", () => {
  it("最新的在最前，最多 10 版", () => {
    let d = baseDoc();
    for (let i = 0; i < SCRIPT_HISTORY_LIMIT + 3; i++) d = pushScriptHistory(d, `第 ${i} 版`, `2026-09-30T00:00:${String(i).padStart(2, "0")}.000Z`, `hv_${i}`);
    expect(d.script.history).toHaveLength(SCRIPT_HISTORY_LIMIT);
    expect(d.script.history[0].id).toBe(`hv_${SCRIPT_HISTORY_LIMIT + 2}`);
  });

  it("恢复前先存一版；锁按集号保留", () => {
    const d0 = pushScriptHistory(baseDoc(), "那一版", "2026-09-30T00:00:00.000Z", "hv_a");
    const changed = { ...d0, script: { ...d0.script, setting: { text: "改过了" }, episodes: d0.script.episodes.map((e) => ({ ...e, text: "改过了" })) } };
    const d1 = restoreScriptVersion(changed, "hv_a");
    expect(d1.script.setting?.text).toBe("旧的故事大纲");
    expect(d1.script.episodes.map((e) => e.text)).toEqual(["旧的第一集正文", "锁住的正文"]);
    expect(d1.script.episodes[1].locked).toBe(true);
    expect(d1.script.history[0].setting).toBe("改过了");
    expect(restoreScriptVersion(d1, "nope")).toBe(d1);
  });
});

describe("collectRunRefs", () => {
  it("收集文档里所有挂着的运行引用", () => {
    let d = baseDoc();
    d = applyRunRef(d, run({ id: "a", kind: "image", target: "look:lk_1", status: "queued" }));
    d = applyRunRef(d, run({ id: "b", kind: "video", target: "video:1:sg_1", status: "running" }));
    d = applyRunRef(d, run({ id: "c", kind: "extract", target: "extract", status: "queued" }));
    expect(collectRunRefs(d).map((r) => [r.target, r.ref.runId]).sort()).toEqual([
      ["extract", "c"],
      ["look:lk_1", "a"],
      ["video:1:sg_1", "b"],
    ]);
  });
});
