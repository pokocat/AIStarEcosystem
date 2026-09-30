import { describe, expect, it } from "vitest";
import type { DramaCanvasDoc } from "@ai-star-eco/types/drama-canvas";
import { emptyDoc, findLook } from "@/canvas/core";
import {
  BATCH_MAX_IMAGES,
  BATCH_MAX_ITEMS,
  batchLimitReason,
  episodeOptions,
  episodesText,
  filterCharacters,
  filterMaterials,
  filterScenes,
  moveEmptiesCharacter,
  moveLook,
  planBatch,
  skippedText,
  toggleEpisode,
} from "./list-ops";
import { addUploadedReference, disconnectReference, materialNameFromFile, referencesOf } from "./references";

function doc(): DramaCanvasDoc {
  return {
    ...emptyDoc(),
    script: {
      episodes: [
        { no: 1, title: "一", text: "" },
        { no: 2, title: "二", text: "" },
      ],
      history: [],
    },
    characters: [
      {
        id: "ch_a",
        name: "林微",
        role: "lead",
        bio: "旧教室的老师",
        looks: [
          { id: "lk_a1", name: "基础造型", prompt: "成年", episodes: [1], images: { versions: [] } },
          { id: "lk_a2", name: "学生时期", prompt: "高中", episodes: [3], images: { versions: [] } },
        ],
      },
      { id: "ch_b", name: "陈屹", role: "support", looks: [{ id: "lk_b1", name: "基础造型", prompt: "", episodes: [2], images: { versions: [] } }] },
    ],
    scenes: [
      { id: "sc_1", name: "旧教室", prompt: "黄昏的教室", episodes: [1, 2], images: { versions: [] } },
      { id: "sc_2", name: "天台", prompt: "", episodes: [2], images: { versions: [] } },
    ],
    materials: [
      { id: "mt_1", name: "旧照片", kind: "image", images: { versions: [{ key: "k/photo.png" }] } },
      { id: "mt_2", name: "全剧色调", kind: "text", text: "冷蓝夜色" },
    ],
    board: {
      positions: { lk_a2: { x: 10, y: 20 }, "group:char:ch_b": { x: 0, y: 0 }, lk_b1: { x: 5, y: 5 } },
      edges: [
        { id: "ed_1", source: "mt_1", target: "lk_a1" },
        { id: "ed_2", source: "mt_2", target: "lk_a1" },
        { id: "ed_3", source: "lk_b1", target: "sc_1" },
      ],
      collapsed: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
}

describe("列表过滤", () => {
  it("按集：角色任一造型出现在这一集就算；场景看自己的集数", () => {
    const d = doc();
    expect(filterCharacters(d.characters, { episode: 2, query: "" }).map((c) => c.id)).toEqual(["ch_b"]);
    expect(filterCharacters(d.characters, { episode: 3, query: "" }).map((c) => c.id)).toEqual(["ch_a"]);
    expect(filterCharacters(d.characters, { episode: null, query: "" })).toHaveLength(2);
    expect(filterScenes(d.scenes, { episode: 1, query: "" }).map((s) => s.id)).toEqual(["sc_1"]);
    expect(filterScenes(d.scenes, { episode: 2, query: "" }).map((s) => s.id)).toEqual(["sc_1", "sc_2"]);
  });

  it("搜索：角色名、人物小传、造型名；场景名和描述；素材名和正文（不分大小写、去首尾空格）", () => {
    const d = doc();
    expect(filterCharacters(d.characters, { episode: null, query: " 学生 " }).map((c) => c.id)).toEqual(["ch_a"]);
    expect(filterCharacters(d.characters, { episode: null, query: "老师" }).map((c) => c.id)).toEqual(["ch_a"]);
    expect(filterScenes(d.scenes, { episode: null, query: "黄昏" }).map((s) => s.id)).toEqual(["sc_1"]);
    expect(filterMaterials(d.materials, { query: "夜色" }).map((m) => m.id)).toEqual(["mt_2"]);
    expect(filterMaterials(d.materials, { query: "" })).toHaveLength(2);
  });

  it("集数和搜索同时生效", () => {
    const d = doc();
    expect(filterCharacters(d.characters, { episode: 1, query: "陈" })).toHaveLength(0);
    expect(filterScenes(d.scenes, { episode: 2, query: "天台" }).map((s) => s.id)).toEqual(["sc_2"]);
  });

  it("集数选项：剧本里的集号 + 造型 / 场景里写到的，升序去重", () => {
    expect(episodeOptions(doc())).toEqual([1, 2, 3]);
    expect(episodesText([2, 1, 2])).toBe("出现在第 1, 2 集");
    expect(episodesText([])).toBeNull();
    expect(toggleEpisode([1, 3], 2)).toEqual([1, 2, 3]);
    expect(toggleEpisode([1, 2, 3], 2)).toEqual([1, 3]);
  });
});

describe("planBatch", () => {
  it("每项一张；没写描述的、正在生成的、已经删掉的跳过，并说清跳过了谁", () => {
    const d = doc();
    const plan = planBatch(
      d,
      [
        { kind: "look", id: "lk_a1" },
        { kind: "look", id: "lk_a2" },
        { kind: "look", id: "lk_b1" },
        { kind: "scene", id: "sc_1" },
        { kind: "scene", id: "sc_2" },
        { kind: "scene", id: "sc_gone" },
        { kind: "look", id: "lk_a1" },
      ],
      (p) => (p.id === "lk_a2" ? "running" : p.id === "sc_1" ? "failed" : undefined),
    );
    expect(plan.items).toEqual([
      { target: { kind: "look", id: "lk_a1" }, count: 1 },
      { target: { kind: "scene", id: "sc_1" }, count: 1 },
    ]);
    expect(plan.skipped.map((s) => [s.label, s.reason])).toEqual([
      ["林微·学生时期", "running"],
      ["陈屹", "no-prompt"],
      ["天台", "no-prompt"],
      ["已删掉的场景", "missing"],
    ]);
    expect(skippedText(plan.skipped)).toBe("「陈屹」「天台」还没写描述，「林微·学生时期」正在生成，这次跳过。");
    expect(skippedText([])).toBeNull();
  });
});

describe("batchLimitReason（服务端 image-batch 上限 20 项 / 40 张）", () => {
  const items = (n: number, count = 1) => Array.from({ length: n }, () => ({ count }));
  it("20 项以内不拦；21 项拦下并说清楚", () => {
    expect(BATCH_MAX_ITEMS).toBe(20);
    expect(batchLimitReason(items(20))).toBeNull();
    expect(batchLimitReason(items(21))).toBe("一次最多 20 个，先取消几个。");
  });
  it("项数没超但总张数超过 40 也拦", () => {
    expect(BATCH_MAX_IMAGES).toBe(40);
    expect(batchLimitReason(items(10, 4))).toBeNull();
    expect(batchLimitReason(items(11, 4))).toBe("一次最多出 40 张，先取消几个。");
  });
});

describe("moveLook", () => {
  it("挪到别的角色下：接在最后、画布位置作废，原角色还有别的造型就保留", () => {
    const d = doc();
    const next = moveLook(d, "lk_a2", "ch_b");
    expect(next.characters.find((c) => c.id === "ch_a")?.looks.map((l) => l.id)).toEqual(["lk_a1"]);
    expect(next.characters.find((c) => c.id === "ch_b")?.looks.map((l) => l.id)).toEqual(["lk_b1", "lk_a2"]);
    expect(next.board.positions.lk_a2).toBeUndefined();
    expect(findLook(next, "lk_a2")?.character.id).toBe("ch_b");
    expect(d.characters[0].looks).toHaveLength(2); // 不改入参
  });

  it("原角色因此一个造型都不剩：整个角色删掉（分组位置一起去掉），造型自己的连线保留", () => {
    const d = doc();
    expect(moveEmptiesCharacter(d, "lk_b1")).toBe(true);
    expect(moveEmptiesCharacter(d, "lk_a1")).toBe(false);
    const next = moveLook(d, "lk_b1", "ch_a");
    expect(next.characters.map((c) => c.id)).toEqual(["ch_a"]);
    expect(next.characters[0].looks.map((l) => l.id)).toEqual(["lk_a1", "lk_a2", "lk_b1"]);
    expect(next.board.positions["group:char:ch_b"]).toBeUndefined();
    expect(next.board.edges.some((e) => e.source === "lk_b1")).toBe(true);
  });

  it("挪到自己所在的角色 / 不存在的角色：原样返回", () => {
    const d = doc();
    expect(moveLook(d, "lk_a1", "ch_a")).toBe(d);
    expect(moveLook(d, "lk_a1", "ch_x")).toBe(d);
    expect(moveLook(d, "lk_x", "ch_b")).toBe(d);
  });
});

describe("参考连线", () => {
  it("referencesOf：按连线顺序列出连进来的图和文字", () => {
    const refs = referencesOf(doc(), "lk_a1");
    expect(refs.map((r) => [r.sourceId, r.kind, r.label])).toEqual([
      ["mt_1", "image", "旧照片"],
      ["mt_2", "text", "全剧色调"],
    ]);
    expect(refs[0].asset?.key).toBe("k/photo.png");
    expect(referencesOf(doc(), "sc_1").map((r) => [r.kind, r.label])).toEqual([["look", "陈屹"]]);
  });

  it("上传参考：多一张素材图（放上传的那张）和一条 素材图 → 目标 的线", () => {
    const d = doc();
    const { doc: next, materialId } = addUploadedReference(d, "sc_2", { key: "k/up.png", url: "blob:x" }, "道具");
    const m = next.materials.find((x) => x.id === materialId);
    expect(m).toMatchObject({ kind: "image", name: "道具", images: { versions: [{ key: "k/up.png", url: "blob:x" }] } });
    expect(next.board.edges).toHaveLength(d.board.edges.length + 1);
    expect(next.board.edges.at(-1)).toMatchObject({ source: materialId, target: "sc_2" });
  });

  it("断开：只去掉那一条线", () => {
    const next = disconnectReference(doc(), "ed_2");
    expect(next.board.edges.map((e) => e.id)).toEqual(["ed_1", "ed_3"]);
  });

  it("上传文件名 → 素材图名：去扩展名；相机 / 临时文件名不用", () => {
    expect(materialNameFromFile("旧车票.png")).toBe("旧车票");
    expect(materialNameFromFile("IMG_2031.JPG")).toBeUndefined();
    expect(materialNameFromFile("0f3a9c2b1d4e5f60718293a4.webp")).toBeUndefined();
    expect(materialNameFromFile("一张非常非常长的名字一张非常非常长的名字还有更多.png")).toBe("一张非常非常长的名字一张非常非常长的名字…");
  });
});
