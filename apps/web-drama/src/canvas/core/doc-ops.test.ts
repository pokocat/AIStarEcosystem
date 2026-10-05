import { describe, expect, it } from "vitest";
import type { DramaCanvasDoc } from "@ai-star-eco/types/drama-canvas";
import {
  addCharacter,
  addLook,
  addMaterial,
  addScene,
  canvasStep,
  characterGroupId,
  defaultNewRole,
  emptyDoc,
  episodeProgress,
  findLook,
  insertSegment,
  lookLabel,
  parseRunTarget,
  pickedImage,
  pickedVideo,
  removeCharacter,
  removeLook,
  removeScene,
  removeSegment,
  setPicked,
  stripAssetUrls,
  updateSegment,
} from "./doc-ops";

// 常用编辑（四块共用）。断结构不断文案（§8.0.1 ⑩）。

describe("doc-ops", () => {
  it("canvasStep：没拆过 → 剧本；没有片段 → 角色和场景；否则逐集制作", () => {
    const d = emptyDoc();
    expect(canvasStep(d)).toBe("script");
    const extracted = { ...d, script: { ...d.script, extractedAt: "2026-09-30T00:00:00.000Z" } };
    expect(canvasStep(extracted)).toBe("assets");
    expect(canvasStep(insertSegment(extracted, 1, 0).doc)).toBe("episodes");
  });

  it("pickedImage / pickedVideo：缺省第一版，pickedKey 指不到时也回第一版", () => {
    expect(pickedImage({ versions: [] })).toBeUndefined();
    expect(pickedImage({ versions: [{ key: "a" }, { key: "b" }], pickedKey: "b" })?.key).toBe("b");
    expect(pickedImage({ versions: [{ key: "a" }], pickedKey: "gone" })?.key).toBe("a");
    expect(pickedVideo(undefined)).toBeUndefined();
  });

  it("加角色带一个基础造型；加造型、场景、素材都给合法 id", () => {
    const a = addCharacter(emptyDoc(), "林微");
    expect(findLook(a.doc, a.lookId)?.character.id).toBe(a.characterId);
    const b = addLook(a.doc, a.characterId);
    expect(b.doc.characters[0].looks).toHaveLength(2);
    const c = addScene(b.doc, "天台");
    const m = addMaterial(c.doc, "text");
    for (const id of [a.characterId, a.lookId, b.lookId, c.id, m.id]) expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(addLook(emptyDoc(), "nope").lookId).toBe("");
  });

  it("手动加角色的分级：没给时还没有主要角色就是主要角色、有了就是配角；给了就按给的存", () => {
    expect(defaultNewRole([])).toBe("lead");
    expect(defaultNewRole([{ role: "support" }, { role: "extra" }])).toBe("lead");
    expect(defaultNewRole([{ role: "support" }, { role: "lead" }])).toBe("support");
    const a = addCharacter(emptyDoc(), "林微");
    expect(a.doc.characters[0].role).toBe("lead");
    const b = addCharacter(a.doc, "陈屹");
    expect(b.doc.characters[1].role).toBe("support");
    const c = addCharacter(b.doc, "路人", "extra");
    expect(c.doc.characters[2].role).toBe("extra");
    expect(addCharacter(c.doc, "第二主角", "lead").doc.characters[3].role).toBe("lead");
  });

  it("删造型连带删连线和位置；删最后一个造型 = 删整个角色（含分组位置）", () => {
    const a = addCharacter(emptyDoc(), "林微");
    const b = addLook(a.doc, a.characterId);
    const s = addScene(b.doc, "天台");
    let d: DramaCanvasDoc = {
      ...s.doc,
      board: {
        ...s.doc.board,
        positions: { [b.lookId]: { x: 1, y: 1 }, [characterGroupId(a.characterId)]: { x: 0, y: 0 }, [s.id]: { x: 2, y: 2 } },
        edges: [
          { id: "e1", source: s.id, target: b.lookId },
          { id: "e2", source: s.id, target: a.lookId },
        ],
      },
    };
    d = removeLook(d, b.lookId);
    expect(d.board.edges.map((e) => e.id)).toEqual(["e2"]);
    expect(d.board.positions[b.lookId]).toBeUndefined();
    d = removeLook(d, a.lookId);
    expect(d.characters).toEqual([]);
    expect(d.board.edges).toEqual([]);
    expect(d.board.positions[characterGroupId(a.characterId)]).toBeUndefined();
    d = removeScene(d, s.id);
    expect(d.board.positions).toEqual({});
    expect(removeCharacter(d, "nope")).toBe(d);
  });

  it("setPicked：按 RunTarget 写法挑图 / 挑视频；key 不在候选里原样返回", () => {
    const a = addCharacter(emptyDoc(), "林微");
    const withImgs: DramaCanvasDoc = {
      ...a.doc,
      characters: a.doc.characters.map((c) => ({ ...c, looks: c.looks.map((l) => ({ ...l, images: { versions: [{ key: "x" }, { key: "y" }] } })) })),
    };
    const d1 = setPicked(withImgs, `look:${a.lookId}`, "y");
    expect(findLook(d1, a.lookId)?.look.images.pickedKey).toBe("y");
    expect(setPicked(d1, `look:${a.lookId}`, "zzz")).toBe(d1);
    expect(setPicked(d1, "bogus", "y")).toBe(d1);
  });

  it("片段：插入 / 改文本同步时长（文本里没写时长就保留原值）/ 删除", () => {
    const { doc, segmentId } = insertSegment(emptyDoc(), 2, 5);
    expect(doc.episodes.map((e) => e.no)).toEqual([2]);
    const d1 = updateSegment(doc, 2, segmentId, { text: "（4 秒）甲\n（3 秒）乙" });
    expect(d1.episodes[0].segments[0].durationSec).toBe(7);
    const d2 = updateSegment(d1, 2, segmentId, { text: "没写时长" });
    expect(d2.episodes[0].segments[0].durationSec).toBe(7);
    const d3 = updateSegment(d2, 2, segmentId, { text: "（9 秒）丙", durationSec: 5 });
    expect(d3.episodes[0].segments[0].durationSec).toBe(5);
    expect(updateSegment(d3, 2, segmentId, { durationSec: 5 })).toBe(d3);
    expect(removeSegment(d3, 2, segmentId).episodes[0].segments).toEqual([]);
  });

  it("episodeProgress：挑中的视频和合成时用的对不上 = 成片过期", () => {
    const { doc, segmentId } = insertSegment(emptyDoc(), 1, 0);
    const withVideo = updateSegment(doc, 1, segmentId, {
      video: { versions: [{ key: "v2", runId: "r2", createdAt: "2026-09-30T00:00:00.000Z" }, { key: "v1", runId: "r1", createdAt: "2026-09-29T00:00:00.000Z" }], pickedKey: "v2" },
    });
    const assembled: DramaCanvasDoc = {
      ...withVideo,
      episodes: withVideo.episodes.map((e) => ({ ...e, assembled: { key: "a", durationSec: 4, at: "2026-09-30T00:00:00.000Z", videoKeys: ["v1"], runId: "ra" } })),
    };
    expect(episodeProgress(assembled, 1)).toEqual({ segments: 1, withVideo: 1, assembledStale: true });
    expect(episodeProgress(setPicked(assembled, `video:1:${segmentId}`, "v1"), 1).assembledStale).toBe(false);
    expect(episodeProgress(assembled, 9)).toEqual({ segments: 0, withVideo: 0, assembledStale: false });
  });

  it("lookLabel：基础造型只显示角色名", () => {
    expect(lookLabel({ name: "林微" }, { name: "基础造型" })).toBe("林微");
    expect(lookLabel({ name: "林微" }, { name: "学生时期" })).toBe("林微·学生时期");
  });

  it("parseRunTarget：认得所有写法，认不得的回 null", () => {
    expect(parseRunTarget("script:episode:3")).toEqual({ kind: "script:episode", no: 3 });
    expect(parseRunTarget("frame:2:sg_1")).toEqual({ kind: "frame", no: 2, segmentId: "sg_1" });
    expect(parseRunTarget("assemble:4")).toEqual({ kind: "assemble", no: 4 });
    expect(parseRunTarget("look:lk_1")).toEqual({ kind: "look", id: "lk_1" });
    expect(parseRunTarget("video:x:sg")).toBeNull();
    expect(parseRunTarget("what")).toBeNull();
  });

  it("stripAssetUrls：递归去掉 url / lastFrameUrl，别的不动", () => {
    const out = stripAssetUrls({ a: [{ key: "k", url: "u", lastFrameKey: "l", lastFrameUrl: "lu" }], b: { url: "x", n: 1 } });
    expect(out).toEqual({ a: [{ key: "k", lastFrameKey: "l" }], b: { n: 1 } });
  });
});
