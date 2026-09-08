"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 「已经生成、但没落到画布上」的图。
//
// 起因是一次生产事故：一次误报的保存冲突让客户端停掉了自动保存，用户接着跑的 5 次生成
// **服务端全部成功、图也都进了 OSS、积分照扣**，但一张都没能写进项目文档 ——
// 用户看到的是「生图失败」，实际是「生成了、付了钱、存不下来」。
//
// 那次的直接原因（时间戳比对误判）已经修掉，但这个失效模式不止一个入口：
// 保存请求超时、浏览器在写回前被关掉、真的撞上并发冲突……只要产物没写进文档，
// 用户就再也看不到它 —— 而运行记录和图其实都好好地在服务端。
//
// 所以留一条兜底：进画布时对一遍账，把「跑完了但画布上没有」的图找出来，让用户一键放回。
// ─────────────────────────────────────────────────────────────────────────────

import type { IpProject, IpRun } from "@ai-star-eco/types";
import type { CanvasNodeData } from "@/canvas/types/canvas";

export type StrandedImage = {
  runId: string;
  key: string;
  url: string;
  /** 当时送进模型的提示词 —— 放回画布后作为节点标题/提示词，用户才认得出这是哪一张。 */
  prompt?: string;
  createdAt: string;
};

/** 文档里已经出现过的所有 storageKey（节点级 + 候选图集）。 */
function keysInDoc(nodes: CanvasNodeData[]): Set<string> {
  const out = new Set<string>();
  for (const n of nodes) {
    const md = n.metadata;
    if (!md) continue;
    if (typeof md.storageKey === "string" && md.storageKey) out.add(md.storageKey);
    for (const img of md.images ?? []) {
      if (img.storageKey) out.add(img.storageKey);
    }
  }
  return out;
}

/**
 * 找出「跑完了、扣过费、但画布上没有」的图。
 *
 * 只看 `done` 的运行：`running` 的还没出结果，`failed` 的服务端已经退过款。
 */
export function findStrandedImages(project: Pick<IpProject, "doc" | "runsById">): StrandedImage[] {
  const placed = keysInDoc((project.doc?.nodes ?? []) as CanvasNodeData[]);
  const out: StrandedImage[] = [];
  const runs: IpRun[] = Object.values(project.runsById ?? {});
  for (const run of runs) {
    if (run.status !== "done") continue;
    for (const c of run.output?.candidates ?? []) {
      if (!c.key || !c.url || placed.has(c.key)) continue;
      out.push({ runId: run.id, key: c.key, url: c.url, prompt: run.inputs?.prompt, createdAt: run.createdAt });
    }
  }
  // 老的排前面：用户按生成顺序理解自己的画布
  out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return out;
}

const NODE_W = 340;
const NODE_H = 453; // 3:4，跟出图默认画幅一致

/**
 * 把这些图排成一行节点，放在现有内容的下方。
 *
 * 不猜它们原本属于哪个节点 —— 运行记录里 `nodeId` 多半是 `adhoc`（画布出图不绑节点），
 * 猜错了比不猜更糟。放成独立节点，用户自己连线。
 */
export function buildRecoveryNodes(items: StrandedImage[], existing: CanvasNodeData[]): CanvasNodeData[] {
  const bottom = existing.reduce((max, n) => Math.max(max, n.position.y + n.height), 0);
  const left = existing.length ? Math.min(...existing.map((n) => n.position.x)) : 0;
  const gap = 40;
  return items.map((item, i) => ({
    id: `recovered-${item.key.slice(-12)}`,
    type: "image",
    title: item.prompt ? item.prompt.slice(0, 24) : "已生成的图",
    position: { x: left + i * (NODE_W + gap), y: bottom + 120 },
    width: NODE_W,
    height: NODE_H,
    metadata: {
      storageKey: item.key,
      content: item.url,
      prompt: item.prompt,
      status: "success",
    },
  })) as CanvasNodeData[];
}
