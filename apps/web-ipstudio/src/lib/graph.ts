// ─────────────────────────────────────────────────────────────────────────────
// lib/graph.ts — 画布图算法（纯函数，无 React 依赖）。
//
// 与服务端 `IpRunService.compileGenerate` 是同一套语义（docs/ip-studio-plan.md §4.3）：
// 沿入边**向上多跳**找上游节点、参考图优先级 master → source → reference。前端这份
// 只用于「运行前预检提示」「拓扑序连跑」「属性面板展示」—— 真值判定永远在服务端。
//
// ⚠️ 只看直接父节点会误报「缺特征卡 / 缺风格」：内置模板是一条直链
// （source → identity → style → master → look-N → gen-N），风格与特征卡挂在主形象
// 上游，并不直接连到每个出图节点。跳数上限逐类型对齐服务端 `IpDocs.ancestorsOfType`：
//   identity / style / source / generate(主形象) = 8 跳，look = 2 跳，reference = 3 跳。
// 改这里之前先读 `IpRunService.compileGenerate`，两边必须同步。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  IpEdge, IpGenerateData, IpIdentityData, IpLookData, IpNode, IpNodeType,
  IpProjectDoc, IpReferenceData, IpSourceData, IpStyleData,
} from "@ai-star-eco/types";

export function nodeById(doc: IpProjectDoc, id: string): IpNode | undefined {
  return doc.nodes.find((n) => n.id === id);
}

/** 指向 nodeId 的直接上游节点（按 edges 声明顺序，重复边只算一次）。 */
export function upstream(doc: IpProjectDoc, nodeId: string): IpNode[] {
  const out: IpNode[] = [];
  const seen = new Set<string>();
  for (const e of doc.edges) {
    if (e.target !== nodeId || seen.has(e.source)) continue;
    const n = nodeById(doc, e.source);
    if (!n) continue;
    seen.add(e.source);
    out.push(n);
  }
  return out;
}

/** 逐类型的向上跳数上限 —— 与服务端 `IpRunService` 的 `ANCESTOR_DEPTH` / 字面量一致。 */
export const ANCESTOR_DEPTH = {
  identity: 8,
  style: 8,
  source: 8,
  generate: 8,
  look: 2,
  reference: 3,
} as const;

/**
 * 沿入边向上做有界广度遍历，收集指定类型的祖先节点（不含自己），**近的排前面**。
 *
 * 与服务端 `IpDocs.ancestorsOfType` 同算法：逐层推进、访问过的不再入队（客户端可能
 * 提交环形图，靠 visited + 深度上限双保险），同一层内按 edges 声明顺序 —— 用户的
 * 连线顺序就是用户的优先级。
 */
export function ancestorsOfType<T extends IpNodeType>(
  doc: IpProjectDoc,
  nodeId: string,
  type: T,
  maxDepth: number,
): Array<Extract<IpNode, { type: T }>> {
  const out: Array<Extract<IpNode, { type: T }>> = [];
  const visited = new Set<string>([nodeId]);
  let frontier: string[] = [nodeId];
  const limit = Math.max(1, maxDepth);
  for (let depth = 0; depth < limit && frontier.length > 0; depth += 1) {
    const next: string[] = [];
    for (const cur of frontier) {
      for (const up of upstream(doc, cur)) {
        if (visited.has(up.id)) continue;
        visited.add(up.id);
        next.push(up.id);
        if (up.type === type) out.push(up as Extract<IpNode, { type: T }>);
      }
    }
    frontier = next;
  }
  return out;
}

/** nodeId 的所有下游节点。 */
export function downstream(doc: IpProjectDoc, nodeId: string): IpNode[] {
  const out: IpNode[] = [];
  for (const e of doc.edges) {
    if (e.source !== nodeId) continue;
    const n = nodeById(doc, e.target);
    if (n) out.push(n);
  }
  return out;
}

export interface GenerateInputs {
  identity?: IpNode & { type: "identity"; data: IpIdentityData };
  style?: IpNode & { type: "style"; data: IpStyleData };
  look?: IpNode & { type: "look"; data: IpLookData };
  source?: IpNode & { type: "source"; data: IpSourceData };
  master?: IpNode & { type: "generate"; data: IpGenerateData };
  references: Array<IpNode & { type: "reference"; data: IpReferenceData }>;
}

/**
 * 收集一个 generate 节点的上游输入 —— 每类取**最近的那一个**（跳数上限见
 * `ANCESTOR_DEPTH`，与服务端 `IpRunService.compileGenerate` 逐条对齐）。
 *
 * 主形象（master）取最近一个标了 `isMaster` 的上游 generate；一个都没标时退到
 * 最近的上游 generate —— 服务端 `masterCandidateKey` 就是这个回退顺序。
 */
export function collectGenerateInputs(doc: IpProjectDoc, nodeId: string): GenerateInputs {
  const gens = ancestorsOfType(doc, nodeId, "generate", ANCESTOR_DEPTH.generate);
  const master = gens.find((g) => g.data.isMaster) ?? gens[0];
  return {
    identity: ancestorsOfType(doc, nodeId, "identity", ANCESTOR_DEPTH.identity)[0],
    style: ancestorsOfType(doc, nodeId, "style", ANCESTOR_DEPTH.style)[0],
    look: ancestorsOfType(doc, nodeId, "look", ANCESTOR_DEPTH.look)[0],
    source: ancestorsOfType(doc, nodeId, "source", ANCESTOR_DEPTH.source)[0],
    ...(master ? { master } : {}),
    references: ancestorsOfType(doc, nodeId, "reference", ANCESTOR_DEPTH.reference),
  };
}

/** identity 节点的上游照片（同样向上多跳，取最近的一张）。 */
export function identitySource(doc: IpProjectDoc, nodeId: string): (IpNode & { type: "source" }) | undefined {
  return ancestorsOfType(doc, nodeId, "source", ANCESTOR_DEPTH.source)[0];
}

/** 该项目的主形象 generate 节点（isMaster 为真的第一个）。 */
export function masterGenerateNode(doc: IpProjectDoc): (IpNode & { type: "generate" }) | undefined {
  return doc.nodes.find(
    (n): n is IpNode & { type: "generate" } => n.type === "generate" && n.data.isMaster,
  );
}

export function generateNodes(doc: IpProjectDoc): Array<IpNode & { type: "generate" }> {
  return doc.nodes.filter((n): n is IpNode & { type: "generate" } => n.type === "generate");
}

export function hasSelection(node: IpNode & { type: "generate" }): boolean {
  return Boolean(node.data.selectedRunId) && typeof node.data.selectedIndex === "number";
}

/**
 * 缺什么才不能跑（与服务端 `IP_NODE_INPUT_MISSING` 对齐，用于运行前的中文提示）。
 * 返回用户能看懂的缺失项名称，空数组表示可以跑。
 */
export function missingInputsForRun(doc: IpProjectDoc, node: IpNode): string[] {
  if (node.type === "identity") {
    // 服务端抽特征卡拿的是已上传素材的 assetKey（本地预览 URL 它取不到），这里同口径。
    const src = ancestorsOfType(doc, node.id, "source", ANCESTOR_DEPTH.source)
      .find((s) => (s.data.assetKey ?? "").trim().length > 0);
    if (!src) return ["一张照片"];
    return [];
  }
  if (node.type === "generate") {
    const { identity, style, look } = collectGenerateInputs(doc, node.id);
    const missing: string[] = [];
    if (!identity) missing.push("人物特征卡");
    else if (!identity.data.promptEn.trim() && !identity.data.text.trim()) missing.push("人物特征卡内容");
    if (!style) missing.push("风格");
    else if (!style.data.promptEn.trim() && !style.data.presetId) missing.push("风格内容");
    // 形象卡：主形象节点直接挂在风格之后、本来就没有形象卡（服务端同样豁免）；
    // 接了形象卡但四栏全空，依然算缺 —— 空白造型出不了图。
    if (look) {
      const filled = [look.data.outfit, look.data.pose, look.data.expression, look.data.details, look.data.props]
        .some((v) => (v ?? "").trim().length > 0);
      if (!filled) missing.push("形象卡内容");
    } else if (!node.data.isMaster) {
      missing.push("形象卡");
    }
    return missing;
  }
  return ["这个节点不参与生成"];
}

/** 拓扑序（Kahn；有环时把剩余节点按原顺序补在尾部，不抛错）。 */
export function topoOrder(doc: IpProjectDoc): IpNode[] {
  const indeg = new Map<string, number>();
  for (const n of doc.nodes) indeg.set(n.id, 0);
  const adj = new Map<string, string[]>();
  for (const e of doc.edges) {
    if (!indeg.has(e.source) || !indeg.has(e.target)) continue;
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    adj.set(e.source, [...(adj.get(e.source) ?? []), e.target]);
  }
  const queue = doc.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  const seen = new Set<string>();
  const ordered: IpNode[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const n = nodeById(doc, id);
    if (n) ordered.push(n);
    for (const next of adj.get(id) ?? []) {
      indeg.set(next, (indeg.get(next) ?? 1) - 1);
      if ((indeg.get(next) ?? 0) <= 0) queue.push(next);
    }
  }
  for (const n of doc.nodes) if (!seen.has(n.id)) ordered.push(n);
  return ordered;
}

/** 生成一个新节点 id（可读前缀 + 短随机串，避免与模板节点撞名）。 */
export function newNodeId(type: IpNodeType): string {
  const rand = Math.random().toString(36).slice(2, 7);
  return `${type}-${rand}`;
}

export function newEdgeId(source: string, target: string): string {
  return `e-${source}-${target}`;
}

/**
 * 连线合法性：同一对只连一次、不自连、publish 不出边、照片与参考图是纯输入不接入边。
 *
 * 允许的入边必须**覆盖内置模板画的每一条线**（`graph.test.ts` 逐条盯着）：模板是
 * 一条直链 —— 照片 → 特征卡 → 风格 → 主形象 → 形象卡 → 出图 → 发布，所以
 * 「特征卡 → 风格」「主形象 → 形象卡」这两种也得放行，否则用户照模板的样子加一个
 * 造型时连不上，画布上还会少画几条线。
 */
export function canConnect(doc: IpProjectDoc, source: string, target: string): boolean {
  if (source === target) return false;
  if (doc.edges.some((e) => e.source === source && e.target === target)) return false;
  const s = nodeById(doc, source);
  const t = nodeById(doc, target);
  if (!s || !t) return false;
  if (s.type === "publish") return false;
  // 照片 / 参考图的内容来自上传，没有上游
  if (t.type === "source" || t.type === "reference") return false;
  if (t.type === "identity") return s.type === "source";
  // 风格挂在链上（模板是特征卡之后），形象卡挂在主形象之后
  if (t.type === "style") return s.type === "source" || s.type === "identity";
  if (t.type === "look") return s.type === "generate";
  return true;
}

export function addEdge(doc: IpProjectDoc, source: string, target: string): IpEdge[] {
  return [...doc.edges, { id: newEdgeId(source, target), source, target }];
}
