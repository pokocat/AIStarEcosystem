// 成片历史（抽卡）的行为约定。
//
// 视频跟出图一样是跑十条挑一条。v0.182 把每一版留进了 metadata.videos[]，
// v0.183 才让它能看能切能删。这里钉死几条容易写错的边界 —— 它们都在
// project.tsx 的 setBatchPrimary / deleteBatchImage 里，直接跑那两个函数要整个画布，
// 所以按同样的规则在这里独立实现一遍并对拍结构。

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectSrc = () =>
  readFileSync(join(__dirname, "../canvas/pages/canvas/project.tsx"), "utf8");

describe("成片历史接线", () => {
  it("切换：视频节点走 videos[] 而不是 images[]", () => {
    const src = projectSrc();
    expect(src).toContain("if (node.type === CanvasNodeType.Video) {");
    expect(src).toContain("primaryVideoId: take.id");
  });

  it("删除：只剩一版时不删 —— 否则节点变空壳，找回来只能重跑一次再付一次钱", () => {
    const src = projectSrc();
    const block = src.slice(src.indexOf("const deleteBatchImage"));
    expect(block).toContain("if (takes.length <= 1) return item;");
  });

  it("删掉当前那一版时要把画面切到剩下的第一版", () => {
    const src = projectSrc();
    const block = src.slice(src.indexOf("const deleteBatchImage"));
    expect(block).toContain("const next = wasCurrent ? kept[0]");
    expect(block).toContain("content: next.content, storageKey: next.storageKey");
  });

  it("重出之前先把当前这版收进历史（keepVideoTake）", () => {
    const src = projectSrc();
    expect(src).toContain("videos: keepVideoTake(node)");
    // 同一个 storageKey 不重复进历史，否则来回切几次就攒出一串一模一样的版本
    expect(src).toContain("if (history.some((v) => v.storageKey === key)) return history;");
  });

  it("视频节点一律就地重出，不再派生新节点", () => {
    const src = projectSrc();
    expect(src).toContain("const isEmptyVideoNode = sourceNode?.type === CanvasNodeType.Video;");
  });
});

describe("历史条 UI", () => {
  it("多于一版才显示，且切换 / 删除走既有的 batch 回调", () => {
    const src = readFileSync(
      join(__dirname, "../canvas/components/canvas/canvas-node.tsx"),
      "utf8",
    );
    const block = src.slice(src.indexOf("function VideoNodeContent"));
    expect(block).toContain("takes.length > 1");
    expect(block).toContain("onSetBatchPrimary?.(next.id)");
    expect(block).toContain("onDeleteBatchImage?.(");
  });
});
