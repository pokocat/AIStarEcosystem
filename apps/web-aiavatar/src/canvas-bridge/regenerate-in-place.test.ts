// 「换了参考图、换了提示词，画布上还是同一张图」的回归。
//
// 真实事故（v0.175 修）：服务端每一次都真出了新图、也真扣了钱，坏在画布写回那一步 ——
// 就地重出把 images[] 整个换成新的占位项，却留着旧的 primaryImageId；写回成图的代码
// 看见 primaryImageId 就只更新候选数组、直接 return，节点显示用的 metadata.content
// 一直是第一次那张。用户于是重出多少次都看到同一张。
//
// 生产文档里逮到的原样：primaryImageId=ScymwTLZ… 在候选里不存在，
// node.storageKey=…b0e522b8.png（旧），images[0]=…107b2d32.png（这次刚出的，没人看）。

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { healDanglingPrimary } from "./project-sync";

const node = (metadata: Record<string, unknown>) =>
  ({ id: "n-master", type: "image", title: "主形象", position: { x: 0, y: 0 }, width: 340, height: 240, metadata }) as never;

describe("就地重出", () => {
  it("重出时必须清掉旧的 primaryImageId —— 否则新图只进候选、节点还显示旧的那张", () => {
    const src = readFileSync(
      join(__dirname, "../canvas/pages/canvas/project.tsx"),
      "utf8",
    );
    // 就地重出那条分支（isEmptyImageNode）合并 metadata 时必须显式抹掉旧 primary
    expect(src).toContain("primaryImageId: undefined, errorDetails: undefined");
  });
});

describe("已经存坏的画布要能自己修回来", () => {
  it("primary 指向不存在的候选时，扶正最后一张成功的候选并更新显示用的字段", () => {
    const [fixed] = healDanglingPrimary([
      node({
        primaryImageId: "ScymwTLZ4OhW",
        content: "https://cdn/old.png",
        storageKey: "ipstudio_gen/u/b0e522b8.png",
        images: [
          { id: "old", status: "success", storageKey: "ipstudio_gen/u/zzz.png", content: "https://cdn/zzz.png" },
          { id: "iqkB8OjjS42M", status: "success", storageKey: "ipstudio_gen/u/107b2d32.png", content: "https://cdn/new.png", naturalWidth: 1664, naturalHeight: 2224 },
        ],
      }),
    ]);
    const m = fixed.metadata as Record<string, unknown>;
    expect(m.primaryImageId).toBe("iqkB8OjjS42M");
    expect(m.storageKey).toBe("ipstudio_gen/u/107b2d32.png");
    expect(m.content).toBe("https://cdn/new.png");
    expect(m.naturalHeight).toBe(2224);
  });

  it("候选都没成功时只摘掉悬空的 primary —— 不拿失败的候选冒充成图", () => {
    const [fixed] = healDanglingPrimary([
      node({
        primaryImageId: "gone",
        content: "https://cdn/old.png",
        storageKey: "ipstudio_gen/u/old.png",
        images: [{ id: "a", status: "error" }],
      }),
    ]);
    const m = fixed.metadata as Record<string, unknown>;
    expect(m.primaryImageId).toBeUndefined();
    expect(m.storageKey).toBe("ipstudio_gen/u/old.png");
  });

  it("primary 正常的节点原样返回（连引用都不换，免得白白触发一次自动保存）", () => {
    const nodes = [
      node({ primaryImageId: "a", images: [{ id: "a", status: "success", storageKey: "k" }] }),
    ];
    expect(healDanglingPrimary(nodes)).toBe(nodes);
  });
});
