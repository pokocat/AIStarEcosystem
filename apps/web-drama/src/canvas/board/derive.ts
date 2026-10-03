// ─────────────────────────────────────────────────────────────────────────────
// canvas/board/derive.ts —— 文档 → React Flow 的节点和连线（v0.198，纯函数，有单测）。
//
// **文档是唯一真值**：节点和连线每次都从 useCanvasDoc().doc 派生，画布不另存一份再整份写回。
// 拖动中的临时位置由调用方叠在 positions 上传进来（拖完才写回 board.positions）。
//
// 节点数据只放**原始值和文档里的原对象**（图、集数数组）：没改过的东西引用不变，
// stabilizeNodes 就能把上一轮的节点对象原样复用，React Flow 与 memo 过的卡片都跳过重画 —— 上百张卡片不卡。
// ─────────────────────────────────────────────────────────────────────────────

import type { Edge, Node } from "@xyflow/react";
import type { CanvasAsset, CanvasCharacterRole, CanvasRunRef, DramaCanvasDoc, DramaCanvasRun, DramaCanvasRunTarget } from "@ai-star-eco/types/drama-canvas";
import { RunTarget, SCENES_GROUP_ID, characterGroupId, lookLabel, pickedImage } from "@/canvas/core";
import { assetRunView, episodesText as listEpisodesText } from "@/canvas/assets";
import { CARD, GROUP, groupSize, materialSize, type Size, type XY } from "./auto-layout";

// ── 节点数据 ─────────────────────────────────────────────────────────────────

/** 卡片上的生成状态：在跑（排队 / 生成中）、失败原因。 */
export type RunBusy = "queued" | "running" | null;

export type CharGroupData = {
  kind: "charGroup";
  characterId: string;
  name: string;
  role: CanvasCharacterRole;
  lookCount: number;
  collapsed: boolean;
};

export type SceneGroupData = {
  kind: "sceneGroup";
  count: number;
  collapsed: boolean;
};

export type LookData = {
  kind: "look";
  lookId: string;
  characterId: string;
  label: string;
  episodesText: string;
  image?: CanvasAsset;
  imageCount: number;
  busy: RunBusy;
  failed?: string;
  highlighted: boolean;
};

export type SceneData = {
  kind: "scene";
  sceneId: string;
  name: string;
  episodesText: string;
  image?: CanvasAsset;
  imageCount: number;
  busy: RunBusy;
  failed?: string;
  highlighted: boolean;
};

export type ImageMaterialData = {
  kind: "imageMaterial";
  materialId: string;
  name: string;
  image?: CanvasAsset;
  imageCount: number;
  busy: RunBusy;
  failed?: string;
  highlighted: boolean;
};

export type TextMaterialData = {
  kind: "textMaterial";
  materialId: string;
  name: string;
  text: string;
  highlighted: boolean;
};

export type CharGroupNode = Node<CharGroupData, "charGroup">;
export type SceneGroupNode = Node<SceneGroupData, "sceneGroup">;
export type LookNode = Node<LookData, "look">;
export type SceneNode = Node<SceneData, "scene">;
export type ImageMaterialNode = Node<ImageMaterialData, "imageMaterial">;
export type TextMaterialNode = Node<TextMaterialData, "textMaterial">;
export type BoardNode = CharGroupNode | SceneGroupNode | LookNode | SceneNode | ImageMaterialNode | TextMaterialNode;
export type BoardEdge = Edge;

// ── 小工具 ───────────────────────────────────────────────────────────────────

/** 「出现在第 1, 2 集」（和列表同一个写法，同一个函数）；没标集数时说清楚。 */
export function episodesText(episodes: number[]): string {
  return listEpisodesText(episodes) ?? "还没标出现在哪几集";
}

export type RunBadge = { busy: RunBusy; failed?: string };
const NO_BADGE: RunBadge = { busy: null };

/**
 * 卡片上的生成状态（和列表共用 assetRunView 的判断：以文档里记着的运行引用为准，
 * runFor 拿到的运行只有 id 对得上才用它的细节）。这里只摘出卡片要的两个原始值，memo 才比得动。
 * submitting = 请求正在提交（POST 还没回来，还没有运行记录可看）：也算「生成中」。
 */
export function runBadge(run: DramaCanvasRun | undefined, ref: CanvasRunRef | undefined, submitting = false): RunBadge {
  const v = assetRunView(run, ref);
  if (v.pending) return { busy: v.queued ? "queued" : "running" };
  if (submitting) return { busy: "running" };
  if (v.failed) return { busy: null, failed: v.errorMessage };
  return NO_BADGE;
}

// ── 派生 ─────────────────────────────────────────────────────────────────────

export interface DeriveOptions {
  /** 所有节点的位置（resolvePositions 的结果，拖动中再叠上临时位置）。 */
  positions: Record<string, XY>;
  hideEdges?: boolean;
  /** 只看角色和场景：素材节点和连着它们的线都藏起来。 */
  onlyCast?: boolean;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  /** 额外高亮的节点（从列表点角色进来：这个角色的全部造型）。 */
  highlightIds?: readonly string[];
  /** 生成状态（缺省只看文档里的运行引用）。 */
  runFor?: (target: DramaCanvasRunTarget) => DramaCanvasRun | undefined;
  /** 这个目标是否正在提交（useCanvasRuns().isSubmitting）；提交中也显示「生成中」。 */
  isSubmitting?: (target: DramaCanvasRunTarget) => boolean;
  /** 能不能拖（只读 / 抓手模式下 false）。缺省 true。 */
  draggable?: boolean;
}

const ORIGIN: XY = { x: 0, y: 0 };

function sized<T extends { width?: number; height?: number; measured?: { width?: number; height?: number } }>(n: T, s: Size): T {
  n.width = s.w;
  n.height = s.h;
  n.measured = { width: s.w, height: s.h };
  return n;
}

export function deriveBoard(doc: DramaCanvasDoc, o: DeriveOptions): { nodes: BoardNode[]; edges: BoardEdge[] } {
  const pos = o.positions;
  const collapsed = new Set(doc.board.collapsed);
  const selected = o.selectedNodeId ?? null;
  const highlight = new Set(o.highlightIds ?? []);
  if (selected) highlight.add(selected);
  const draggable = o.draggable ?? true;
  const badge = (target: DramaCanvasRunTarget, ref: CanvasRunRef | undefined) =>
    runBadge(o.runFor?.(target), ref, o.isSubmitting?.(target) ?? false);

  const nodes: BoardNode[] = [];
  const hidden = new Set<string>();
  const known = new Set<string>();

  // 角色分组 + 造型卡（分组必须排在它的卡片前面：React Flow 的 parentId 约定）
  for (const c of doc.characters) {
    const gid = characterGroupId(c.id);
    const isCollapsed = collapsed.has(gid);
    const size = groupSize(
      c.looks.map((l) => ({ pos: pos[l.id], size: CARD.look })),
      isCollapsed,
    );
    known.add(gid);
    nodes.push(
      sized<CharGroupNode>(
        {
          id: gid,
          type: "charGroup",
          position: pos[gid] ?? ORIGIN,
          data: { kind: "charGroup", characterId: c.id, name: c.name, role: c.role, lookCount: c.looks.length, collapsed: isCollapsed },
          className: "cvb-n-group",
          draggable,
          zIndex: 0,
        },
        size,
      ),
    );
    for (const l of c.looks) {
      known.add(l.id);
      if (isCollapsed) hidden.add(l.id);
      const b = badge(RunTarget.look(l.id), l.run);
      nodes.push(
        sized<LookNode>(
          {
            id: l.id,
            type: "look",
            parentId: gid,
            position: pos[l.id] ?? { x: GROUP.pad, y: GROUP.header },
            hidden: isCollapsed,
            selected: selected === l.id,
            draggable,
            data: {
              kind: "look",
              lookId: l.id,
              characterId: c.id,
              label: lookLabel(c, l),
              episodesText: episodesText(l.episodes),
              image: pickedImage(l.images),
              imageCount: l.images.versions.length,
              busy: b.busy,
              failed: b.failed,
              highlighted: highlight.has(l.id),
            },
          },
          CARD.look,
        ),
      );
    }
  }

  // 场景分组 + 场景卡
  if (doc.scenes.length) {
    const isCollapsed = collapsed.has(SCENES_GROUP_ID);
    const size = groupSize(
      doc.scenes.map((s) => ({ pos: pos[s.id], size: CARD.scene })),
      isCollapsed,
    );
    known.add(SCENES_GROUP_ID);
    nodes.push(
      sized<SceneGroupNode>(
        {
          id: SCENES_GROUP_ID,
          type: "sceneGroup",
          position: pos[SCENES_GROUP_ID] ?? ORIGIN,
          data: { kind: "sceneGroup", count: doc.scenes.length, collapsed: isCollapsed },
          className: "cvb-n-group",
          draggable,
          zIndex: 0,
        },
        size,
      ),
    );
    for (const s of doc.scenes) {
      known.add(s.id);
      if (isCollapsed) hidden.add(s.id);
      const b = badge(RunTarget.scene(s.id), s.run);
      nodes.push(
        sized<SceneNode>(
          {
            id: s.id,
            type: "scene",
            parentId: SCENES_GROUP_ID,
            position: pos[s.id] ?? { x: GROUP.pad, y: GROUP.header },
            hidden: isCollapsed,
            selected: selected === s.id,
            draggable,
            data: {
              kind: "scene",
              sceneId: s.id,
              name: s.name,
              episodesText: episodesText(s.episodes),
              image: pickedImage(s.images),
              imageCount: s.images.versions.length,
              busy: b.busy,
              failed: b.failed,
              highlighted: highlight.has(s.id),
            },
          },
          CARD.scene,
        ),
      );
    }
  }

  // 素材
  for (const m of doc.materials) {
    known.add(m.id);
    const isHidden = !!o.onlyCast;
    if (isHidden) hidden.add(m.id);
    const common = {
      id: m.id,
      position: pos[m.id] ?? ORIGIN,
      hidden: isHidden,
      selected: selected === m.id,
      draggable,
    };
    if (m.kind === "image") {
      const b = badge(RunTarget.material(m.id), m.run);
      nodes.push(
        sized<ImageMaterialNode>(
          {
            ...common,
            type: "imageMaterial",
            data: {
              kind: "imageMaterial",
              materialId: m.id,
              name: m.name,
              image: pickedImage(m.images),
              imageCount: m.images?.versions.length ?? 0,
              busy: b.busy,
              failed: b.failed,
              highlighted: highlight.has(m.id),
            },
          },
          materialSize("image"),
        ),
      );
    } else {
      nodes.push(
        sized<TextMaterialNode>(
          {
            ...common,
            type: "textMaterial",
            data: { kind: "textMaterial", materialId: m.id, name: m.name, text: m.text ?? "", highlighted: highlight.has(m.id) },
          },
          materialSize("text"),
        ),
      );
    }
  }

  // 连线：被选中 / 高亮节点的**上游线**（target 是它）亮成主色，其余变淡。颜色全在 canvas-board.css（.cvb-edge）。
  // 不画箭头：方向由卡片两侧的圆点表示（线从右边的点出、进左边的点，照小云雀）。
  const anyHighlight = highlight.size > 0;
  const edges: BoardEdge[] = [];
  for (const e of doc.board.edges) {
    if (!known.has(e.source) || !known.has(e.target)) continue; // 两头有一头不在了：不画
    const isUp = highlight.has(e.target);
    const isSelected = o.selectedEdgeId === e.id;
    const cls = ["cvb-edge", isUp ? "is-up" : anyHighlight ? "is-dim" : "", isSelected ? "is-picked" : ""].filter(Boolean).join(" ");
    edges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      hidden: !!o.hideEdges || hidden.has(e.source) || hidden.has(e.target),
      selected: isSelected,
      className: cls,
    });
  }

  return { nodes, edges };
}

// ── 复用上一轮的对象（性能）─────────────────────────────────────────────────

export function shallowEqual(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

function sameNode(a: BoardNode, b: BoardNode): boolean {
  return (
    a.type === b.type &&
    a.data === b.data &&
    a.parentId === b.parentId &&
    a.position.x === b.position.x &&
    a.position.y === b.position.y &&
    a.width === b.width &&
    a.height === b.height &&
    !!a.hidden === !!b.hidden &&
    !!a.selected === !!b.selected &&
    a.draggable === b.draggable &&
    a.className === b.className &&
    a.zIndex === b.zIndex
  );
}

/**
 * 这一轮派生出来的节点里，和上一轮一模一样的，换回上一轮的对象；数据没变只是位置变了的，至少复用 data。
 * React Flow 按对象引用判断节点有没有变，卡片的 memo 按 data 引用判断要不要重画。
 */
export function stabilizeNodes(prev: ReadonlyMap<string, BoardNode>, next: BoardNode[]): BoardNode[] {
  return next.map((n) => {
    const p = prev.get(n.id);
    if (!p || p.type !== n.type) return n;
    const data = shallowEqual(p.data as Record<string, unknown>, n.data as Record<string, unknown>) ? p.data : n.data;
    const merged = (data === n.data ? n : { ...n, data }) as BoardNode;
    return sameNode(p, merged) ? p : merged;
  });
}

function sameEdge(a: BoardEdge, b: BoardEdge): boolean {
  return (
    a.source === b.source &&
    a.target === b.target &&
    !!a.hidden === !!b.hidden &&
    !!a.selected === !!b.selected &&
    a.className === b.className &&
    a.zIndex === b.zIndex
  );
}

export function stabilizeEdges(prev: ReadonlyMap<string, BoardEdge>, next: BoardEdge[]): BoardEdge[] {
  return next.map((e) => {
    const p = prev.get(e.id);
    return p && sameEdge(p, e) ? p : e;
  });
}
