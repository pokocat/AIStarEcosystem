import { describe, expect, it } from "vitest";
import type { DramaCanvasRun } from "@ai-star-eco/types/drama-canvas";
import { SCENES_GROUP_ID, characterGroupId } from "@/canvas/core";
import { CARD, GROUP, applyAutoLayout, resolvePositions } from "./auto-layout";
import { deriveBoard, episodesText, runBadge, stabilizeEdges, stabilizeNodes, type BoardNode } from "./derive";
import { toggleCollapsed } from "./board-ops";
import { sampleDoc } from "./test-fixtures";

// 从文档派生节点 / 连线（文档是唯一真值）：分组、收起、只看角色和场景、隐藏连线、上游线高亮。
// 断结构，不断文案（§8.0.1 ⑩）；episodesText 的格式是术语表定的叫法（drama-ux-copy-pass.md §2.7），所以断。

const gA = characterGroupId("ch_a");

function derive(opts: Partial<Parameters<typeof deriveBoard>[1]> = {}, doc = applyAutoLayout(sampleDoc())) {
  return deriveBoard(doc, { positions: resolvePositions(doc), ...opts });
}

const byId = (nodes: BoardNode[], id: string) => nodes.find((n) => n.id === id)!;

describe("文档 → 节点 / 连线", () => {
  it("每个角色一个分组、场景一个分组；卡片挂在分组下、分组排在它的卡片前面", () => {
    const { nodes } = derive();
    expect(nodes.filter((n) => n.type === "charGroup").map((n) => n.id)).toEqual([gA, characterGroupId("ch_b")]);
    expect(nodes.filter((n) => n.type === "look").map((n) => n.parentId)).toEqual([gA, gA, characterGroupId("ch_b")]);
    expect(nodes.filter((n) => n.type === "scene").every((n) => n.parentId === SCENES_GROUP_ID)).toBe(true);
    for (const n of nodes) {
      if (!n.parentId) continue;
      expect(nodes.findIndex((p) => p.id === n.parentId)).toBeLessThan(nodes.indexOf(n));
    }
    expect(nodes.filter((n) => n.type === "imageMaterial")).toHaveLength(1);
    expect(nodes.filter((n) => n.type === "textMaterial")).toHaveLength(1);
    // 卡片定宽定高，打开就能显示（不等浏览器量）
    const lk = byId(nodes, "lk_a1");
    expect([lk.width, lk.height, lk.measured?.width, lk.measured?.height]).toEqual([CARD.look.w, CARD.look.h, CARD.look.w, CARD.look.h]);
    expect(lk.position).toEqual({ x: GROUP.pad, y: GROUP.header });
  });

  it("造型卡的数据：显示名、集数、挑中的图、候选张数", () => {
    const base = applyAutoLayout(sampleDoc());
    const doc = {
      ...base,
      characters: base.characters.map((c) =>
        c.id === "ch_a"
          ? {
              ...c,
              looks: c.looks.map((l) =>
                l.id === "lk_a2" ? { ...l, images: { versions: [{ key: "a" }, { key: "b" }], pickedKey: "b" } } : l,
              ),
            }
          : c,
      ),
    };
    const { nodes } = derive({}, doc);
    const d = byId(nodes, "lk_a2").data;
    expect(d).toMatchObject({ kind: "look", label: "林微·学生时期", imageCount: 2, image: { key: "b" } });
    expect(byId(nodes, "lk_a1").data).toMatchObject({ label: "林微", imageCount: 0 });
  });

  it("收起的分组：卡片藏起来、分组只剩标题条、连着它们的线也藏", () => {
    const doc = toggleCollapsed(applyAutoLayout(sampleDoc()), gA);
    const { nodes, edges } = derive({}, doc);
    expect(byId(nodes, gA).height).toBe(GROUP.header);
    expect(byId(nodes, "lk_a1").hidden).toBe(true);
    expect(byId(nodes, "lk_a2").hidden).toBe(true);
    expect(byId(nodes, "lk_b1").hidden).toBe(false);
    expect(edges.find((e) => e.id === "ed_1")?.hidden).toBe(true);
    expect(edges.find((e) => e.id === "ed_2")?.hidden).toBe(false);
  });

  it("只看角色和场景：素材节点和它们的线藏起来；隐藏连线：所有线都藏", () => {
    const only = derive({ onlyCast: true });
    expect(only.nodes.filter((n) => n.type === "imageMaterial" || n.type === "textMaterial").every((n) => n.hidden)).toBe(true);
    expect(only.edges.every((e) => e.hidden)).toBe(true); // 两条线都是从素材连出来的
    expect(only.nodes.filter((n) => n.type === "look").every((n) => !n.hidden)).toBe(true);
    const noEdges = derive({ hideEdges: true });
    expect(noEdges.edges.every((e) => e.hidden)).toBe(true);
    expect(noEdges.nodes.every((n) => !n.hidden)).toBe(true);
  });

  it("选中一个节点：它的上游线（target 是它）亮、其余变淡；额外高亮（整个角色）的上游线也亮", () => {
    const { nodes, edges } = derive({ selectedNodeId: "lk_a1" });
    expect(byId(nodes, "lk_a1").selected).toBe(true);
    expect(edges.find((e) => e.id === "ed_1")?.className).toContain("is-up");
    expect(edges.find((e) => e.id === "ed_2")?.className).toContain("is-dim");
    const all = derive({ selectedNodeId: "lk_a2", highlightIds: ["lk_a1", "lk_a2"] });
    expect(all.edges.find((e) => e.id === "ed_1")?.className).toContain("is-up");
    expect(byId(all.nodes, "lk_a1").data).toMatchObject({ highlighted: true });
    const none = derive();
    expect(none.edges.every((e) => !/is-(up|dim)/.test(String(e.className)))).toBe(true);
  });

  it("两头有一头不在的线不画", () => {
    const base = applyAutoLayout(sampleDoc());
    const doc = { ...base, board: { ...base.board, edges: [...base.board.edges, { id: "ed_x", source: "gone", target: "lk_a1" }] } };
    expect(derive({}, doc).edges.map((e) => e.id)).toEqual(["ed_1", "ed_2"]);
  });

  it("生成状态：在跑 → busy；失败 → 原因；文档里记的是另一次时以文档为准", () => {
    const run = (over: Partial<DramaCanvasRun>): DramaCanvasRun => ({
      id: "r1",
      canvasId: "c",
      kind: "image",
      target: "look:lk_a1",
      status: "running",
      cost: 2,
      createdAt: "2026-09-30T00:00:00.000Z",
      ...over,
    });
    expect(runBadge(run({}), { runId: "r1", status: "queued" })).toEqual({ busy: "running" });
    expect(runBadge(run({ status: "queued" }), { runId: "r1", status: "queued" })).toEqual({ busy: "queued" });
    expect(runBadge(run({ status: "failed", errorMessage: "上游超时" }), { runId: "r1", status: "failed" })).toEqual({ busy: null, failed: "上游超时" });
    expect(runBadge(run({ status: "failed" }), { runId: "r2", status: "queued" })).toEqual({ busy: "queued" });
    expect(runBadge(undefined, { runId: "r2", status: "failed" }).failed).toBeTruthy();
    expect(runBadge(undefined, undefined)).toEqual({ busy: null });
    const { nodes } = derive({ runFor: (t) => (t === "look:lk_a1" ? run({}) : undefined) });
    expect(byId(nodes, "lk_a1").data).toMatchObject({ busy: "running" });
  });

  it("提交中（POST 还没回来、还没有运行记录）也算生成中；已有在跑的运行时按运行的状态", () => {
    const run: DramaCanvasRun = { id: "r1", canvasId: "c", kind: "image", target: "look:lk_a1", status: "queued", cost: 2, createdAt: "2026-09-30T00:00:00.000Z" };
    expect(runBadge(undefined, undefined, true)).toEqual({ busy: "running" });
    expect(runBadge(run, { runId: "r1", status: "queued" }, true)).toEqual({ busy: "queued" });
    const { nodes } = derive({ isSubmitting: (t) => t === "scene:sc_1" || t === "material:mt_img" });
    expect(byId(nodes, "sc_1").data).toMatchObject({ busy: "running" });
    expect(byId(nodes, "mt_img").data).toMatchObject({ busy: "running" });
    expect(byId(nodes, "lk_a1").data).toMatchObject({ busy: null });
  });

  it("没变的节点复用上一轮的对象；只换了位置的复用 data", () => {
    const doc = applyAutoLayout(sampleDoc());
    const first = derive({}, doc);
    const prev = new Map(first.nodes.map((n) => [n.id, n]));
    const again = stabilizeNodes(prev, derive({}, doc).nodes);
    again.forEach((n, i) => expect(n).toBe(first.nodes[i]));
    const moved = stabilizeNodes(prev, derive({ positions: { ...resolvePositions(doc), lk_a1: { x: 99, y: 99 } } }, doc).nodes);
    const m = byId(moved, "lk_a1");
    expect(m).not.toBe(byId(first.nodes, "lk_a1"));
    expect(m.data).toBe(byId(first.nodes, "lk_a1").data);
    const prevEdges = new Map(first.edges.map((e) => [e.id, e]));
    stabilizeEdges(prevEdges, derive({}, doc).edges).forEach((e, i) => expect(e).toBe(first.edges[i]));
  });

  it("出现集数：术语表的写法（和列表同一个函数）", () => {
    expect(episodesText([2, 1])).toBe("出现在第 1, 2 集");
    expect(episodesText([])).not.toMatch(/第/);
  });
});
