import { describe, expect, it } from "vitest";
import { SCENES_GROUP_ID, characterGroupId } from "@/canvas/core";
import {
  CARD,
  GROUP,
  LAYOUT,
  applyAutoLayout,
  boardNodeIds,
  groupSize,
  hasMissingPositions,
  hugGroup,
  layoutMissing,
  relayoutAll,
  resolvePositions,
  writePositions,
} from "./auto-layout";
import { sampleDoc } from "./test-fixtures";

// 自动排版：只排没位置的、分组里是相对坐标、同样的文档排出同样的结果。

const gA = characterGroupId("ch_a");
const gB = characterGroupId("ch_b");

describe("自动排版", () => {
  it("第一次打开：每个节点都有位置，分组里的卡片是相对分组的坐标、造型横排", () => {
    const d = sampleDoc();
    expect(hasMissingPositions(d)).toBe(true);
    const out = applyAutoLayout(d);
    const pos = out.board.positions;
    for (const id of boardNodeIds(d)) expect(pos[id], id).toBeDefined();
    expect(hasMissingPositions(out)).toBe(false);
    // 林微的两个造型：同一行，第一个在内边距处，第二个紧挨着
    expect(pos.lk_a1).toEqual({ x: GROUP.pad, y: GROUP.header });
    expect(pos.lk_a2).toEqual({ x: GROUP.pad + CARD.look.w + GROUP.gap, y: GROUP.header });
    expect(pos.lk_b1).toEqual({ x: GROUP.pad, y: GROUP.header });
    // 场景卡：网格（两个场景 → 2 列）
    expect(pos.sc_1).toEqual({ x: GROUP.pad, y: GROUP.header });
    expect(pos.sc_2).toEqual({ x: GROUP.pad + CARD.scene.w + GROUP.gap, y: GROUP.header });
  });

  it("角色分组排左边、场景分组在所有角色分组右边、素材在最下面", () => {
    const pos = applyAutoLayout(sampleDoc()).board.positions;
    expect(pos[gA]).toEqual({ x: 0, y: 0 });
    expect(pos[gB].y).toBe(0); // 一行放得下
    expect(pos[gB].x).toBeGreaterThan(pos[gA].x);
    const bRight = pos[gB].x + GROUP.minW;
    expect(pos[SCENES_GROUP_ID].x).toBe(bRight + LAYOUT.areaGap);
    const castBottom = GROUP.header + CARD.look.h + GROUP.pad;
    const scenesBottom = GROUP.header + CARD.scene.h + GROUP.pad;
    expect(pos.mt_img.y).toBe(Math.max(castBottom, scenesBottom) + LAYOUT.areaGap);
    expect(pos.mt_txt.y).toBe(pos.mt_img.y);
    expect(pos.mt_txt.x).toBe(pos.mt_img.x + CARD.image.w + LAYOUT.materialGap);
  });

  it("已有位置的一律不动，只给缺的排；新加的造型接在组里最右边", () => {
    const first = applyAutoLayout(sampleDoc());
    const moved = writePositions(first, { [gA]: { x: 500, y: 900 }, lk_a1: { x: 40, y: 80 }, mt_img: { x: -300, y: -300 } });
    const withNew = {
      ...moved,
      characters: moved.characters.map((c) =>
        c.id === "ch_a" ? { ...c, looks: [...c.looks, { id: "lk_a3", name: "造型 3", prompt: "", episodes: [], images: { versions: [] } }] } : c,
      ),
    };
    const added = layoutMissing(withNew);
    expect(Object.keys(added)).toEqual(["lk_a3"]);
    const lastRight = Math.max(40 + CARD.look.w, moved.board.positions.lk_a2.x + CARD.look.w);
    const top = Math.min(80, moved.board.positions.lk_a2.y);
    expect(added.lk_a3).toEqual({ x: lastRight + GROUP.gap, y: top });
    const out = applyAutoLayout(withNew);
    expect(out.board.positions[gA]).toEqual({ x: 500, y: 900 });
    expect(out.board.positions.mt_img).toEqual({ x: -300, y: -300 });
    expect(applyAutoLayout(out)).toBe(out); // 什么都不缺时原样返回
  });

  it("新拆出来的角色接在已有角色分组下面；只读时 resolvePositions 只显示不写回", () => {
    const first = applyAutoLayout(sampleDoc());
    const more = {
      ...first,
      characters: [...first.characters, { id: "ch_c", name: "同事", role: "extra" as const, looks: [{ id: "lk_c1", name: "基础造型", prompt: "", episodes: [1], images: { versions: [] } }] }],
    };
    const resolved = resolvePositions(more);
    expect(more.board.positions[characterGroupId("ch_c")]).toBeUndefined();
    const castBottom = GROUP.header + CARD.look.h + GROUP.pad;
    expect(resolved[characterGroupId("ch_c")]).toEqual({ x: 0, y: castBottom + LAYOUT.groupGap });
    expect(resolved.lk_c1).toEqual({ x: GROUP.pad, y: GROUP.header });
  });

  it("确定性：同样的文档排两次结果一样；重新排一下 = 清空后重排", () => {
    const a = applyAutoLayout(sampleDoc()).board.positions;
    const b = applyAutoLayout(sampleDoc()).board.positions;
    expect(a).toEqual(b);
    const messy = writePositions(applyAutoLayout(sampleDoc()), { lk_a1: { x: 999, y: 999 }, [gB]: { x: -50, y: 700 } });
    expect(relayoutAll(messy).board.positions).toEqual(a);
    expect(relayoutAll(messy).board.edges).toBe(messy.board.edges);
  });

  it("分组大小：框住所有卡片；收起只剩标题条；太窄时按最小宽度", () => {
    expect(groupSize([{ pos: { x: GROUP.pad, y: GROUP.header }, size: CARD.look }], false)).toEqual({
      w: GROUP.minW,
      h: GROUP.header + CARD.look.h + GROUP.pad,
    });
    const two = groupSize(
      [
        { pos: { x: GROUP.pad, y: GROUP.header }, size: CARD.look },
        { pos: { x: 400, y: 200 }, size: CARD.look },
      ],
      false,
    );
    expect(two).toEqual({ w: 400 + CARD.look.w + GROUP.pad, h: 200 + CARD.look.h + GROUP.pad });
    expect(groupSize([{ pos: { x: 400, y: 200 }, size: CARD.look }], true).h).toBe(GROUP.header);
  });

  it("hugGroup：卡片拖出分组左 / 上边后，分组往外扩、卡片在画布上的位置不变", () => {
    const pos = { g: { x: 100, y: 100 }, a: { x: -60, y: 20 }, b: { x: 200, y: GROUP.header } };
    const out = hugGroup(pos, "g", ["a", "b"]);
    const abs = (p: Record<string, { x: number; y: number }>, id: string) => ({ x: p.g.x + p[id].x, y: p.g.y + p[id].y });
    expect(abs(out, "a")).toEqual(abs(pos, "a"));
    expect(abs(out, "b")).toEqual(abs(pos, "b"));
    expect(out.a).toEqual({ x: GROUP.pad, y: GROUP.header });
    // 已经贴合的原样返回
    expect(hugGroup(out, "g", ["a", "b"])).toBe(out);
  });

  it("writePositions 取整；没有变化时原样返回", () => {
    const d = sampleDoc();
    const a = writePositions(d, { lk_a1: { x: 10.4, y: 20.6 } });
    expect(a.board.positions.lk_a1).toEqual({ x: 10, y: 21 });
    expect(writePositions(a, { lk_a1: { x: 10, y: 21 } })).toBe(a);
  });
});
