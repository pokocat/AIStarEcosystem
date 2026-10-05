"use client";

// ─────────────────────────────────────────────────────────────────────────────
// canvas/board/board-view.tsx —— 「角色和场景」的画布看法（v0.198，照小云雀资产画布，docs/drama-canvas-plan.md §1.5 / §2.4）。
// 角色和场景页在 ?view=board 时用 dynamic(..., { ssr: false }) 加载它（只在桌面上；手机上不进画布，§8）。
//
// 规矩：
// - **文档是唯一真值**：节点和连线每次从 useCanvasDoc().doc 派生（derive.ts）。拖动时 React Flow 的位置
//   先放在本组件的临时状态里，**拖完才写回 board.positions**；连线增删走 update()。
// - **平移 / 缩放不写文档**，只防抖记进本机 localStorage（viewport-store.ts）：视口一变就写文档 = 每拖一下画布就保存一次，
//   两个标签页同时开着时，光在这边拖画布就会让另一边下一次保存撞 409、进只读。doc.board.viewport 字段保留
//  （老文档里可能有值：本机没记录时进页用它），但不再维护。进页顺序：focus > 本机记录 > doc.board.viewport > fitView。
// - 没有位置的节点第一次打开时自动排版（auto-layout.ts），排完一次写回；只读时只显示、不写回。
// - 生成、造型详情都用 assets 块的共享组件（AssetGenPanel docked / LookDetailDialog），这里不另写一份。
// - 删除一律 dramaConfirm，写清会删掉什么。
// - 只读（别处改过 / 打不开）时：能看、能平移缩放，不能拖、连线、编辑、生成。
// ─────────────────────────────────────────────────────────────────────────────

import "@xyflow/react/dist/style.css";
import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CanvasCharacterRole } from "@ai-star-eco/types/drama-canvas";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeMouseHandler,
  type IsValidConnection,
  type NodeChange,
  type NodeMouseHandler,
  type OnMoveEnd,
  type OnNodeDrag,
  type Viewport,
} from "@xyflow/react";
import { CanvasApi } from "@/api/canvas";
import {
  SCENES_GROUP_ID,
  addCharacter,
  addLook,
  addMaterial,
  addScene,
  characterGroupId,
  defaultNewRole,
  findCharacter,
  findLook,
  findMaterial,
  findScene,
  mapMaterial,
  useCanvasDoc,
  useCanvasRuns,
  type AssetGenPanelProps,
} from "@/canvas/core";
import { AssetGenPanel, LookDetailDialog } from "@/canvas/assets";
import { dramaConfirm } from "@/components/drama-ui/confirm-dialog";
import { aiErrorMessage } from "@/lib/ai-error";
import { toast } from "@/lib/toast";
import { AddBar, AddCharacterDialog, type BoardMode } from "./add-bar";
import { AssetDrawer, type DrawerPick } from "./asset-drawer";
import { BoardActionsProvider, type BoardActions, type RenameTarget } from "./board-context";
import {
  absolutePosition,
  childIdsOf,
  deletePlan,
  expandGroup,
  isInitialViewport,
  nameFromFile,
  parentGroupOf,
  renameCharacter,
  renameMaterial,
  renameScene,
  setMaterialText,
  toggleCollapsed,
} from "./board-ops";
import { readStoredViewport, writeStoredViewport } from "./viewport-store";
import { CARD, GROUP, applyAutoLayout, hasMissingPositions, hugGroup, relayoutAll, resolvePositions, writePositions, type XY } from "./auto-layout";
import { ConnectTip } from "./connect-tip";
import { addBoardEdge, checkConnection, nodeKindOf, removeBoardEdge } from "./connect";
import { deriveBoard, stabilizeEdges, stabilizeNodes, type BoardEdge, type BoardNode } from "./derive";
import { NODE_TYPES } from "./nodes";
import { BoardToolbar, FIT_PADDING } from "./toolbar";

const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

/** 节点多于这个数时只渲染视口里看得见的（少的时候全渲染反而更顺）。 */
const VISIBLE_ONLY_THRESHOLD = 80;
/** 平移 / 缩放停下多久后记进本机。 */
const VIEWPORT_SAVE_MS = 400;

type Selection = { node: string | null; edge: string | null; highlight: string[] };
const NO_SELECTION: Selection = { node: null, edge: null, highlight: [] };

type GenTarget = AssetGenPanelProps["target"];

function isEditable(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT";
}

/** focus 参数：`look:<id>` / `scene:<id>` / `character:<id>`（也认 `material:<id>`）；认不得返回 null。 */
function parseFocus(f: string): DrawerPick | null {
  const i = f.indexOf(":");
  if (i < 0) return null;
  const kind = f.slice(0, i);
  const id = f.slice(i + 1);
  if (!id) return null;
  if (kind === "look" || kind === "scene" || kind === "character" || kind === "material") return { kind, id };
  return null;
}

function minimapColor(n: { type?: string }): string {
  switch (n.type) {
    case "charGroup":
    case "sceneGroup":
      return "#e7e5e4";
    case "look":
      return "#fdba74";
    case "scene":
      return "#a8a29e";
    default:
      return "#d6d3d1";
  }
}

/** 默认导出：角色和场景页 `dynamic(() => import("@/canvas/board/board-view"), { ssr: false })`。 */
export default function BoardView({ focus }: { focus?: string }) {
  const { status } = useCanvasDoc();
  // 外壳的 CanvasGate 已经保证加载完才渲染页面；这里再挡一次，免得拿空文档自动排版、写回（会覆盖服务端）。
  if (status === "loading" || status === "not-found" || status === "error") return <div className="cv-fill cvb-root" />;
  return (
    <ReactFlowProvider>
      <Board focus={focus} />
    </ReactFlowProvider>
  );
}

function Board({ focus }: { focus?: string }) {
  const { canvasId, doc, getDoc, update, readOnly } = useCanvasDoc();
  const { runFor, isSubmitting } = useCanvasRuns();
  const rf = useReactFlow<BoardNode, BoardEdge>();
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  const [sel, setSel] = React.useState<Selection>(NO_SELECTION);
  const selRef = React.useRef(sel);
  selRef.current = sel;
  const [mode, setMode] = React.useState<BoardMode>("pointer");
  const [hideEdges, setHideEdges] = React.useState(false);
  const [onlyCast, setOnlyCast] = React.useState(false);
  const [showMinimap, setShowMinimap] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [addCharOpen, setAddCharOpen] = React.useState(false);
  const [detailLookId, setDetailLookId] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [dragPos, setDragPos] = React.useState<Record<string, XY>>({});

  const canEdit = !readOnly;
  const interactive = canEdit && mode === "pointer";
  const readOnlyRef = React.useRef(readOnly);
  readOnlyRef.current = readOnly;

  const clearSelection = React.useCallback(() => setSel(NO_SELECTION), []);
  const select = React.useCallback((id: string) => setSel({ node: id, edge: null, highlight: [] }), []);

  // ── 位置：已有的 + 缺的现排；拖动中叠上临时位置 ─────────────────────────────
  const resolved = React.useMemo(() => resolvePositions(doc), [doc]);
  const positions = React.useMemo(() => (Object.keys(dragPos).length ? { ...resolved, ...dragPos } : resolved), [resolved, dragPos]);

  // 缺位置的节点排好后一次写回（新拆出来的角色 / 场景、刚加的造型）
  React.useEffect(() => {
    if (readOnly || !hasMissingPositions(doc)) return;
    update((d) => applyAutoLayout(d));
  }, [doc, readOnly, update]);

  // ── 节点 / 连线（从文档派生；没变的复用上一轮的对象）──────────────────────────
  const derived = React.useMemo(
    () =>
      deriveBoard(doc, {
        positions,
        hideEdges,
        onlyCast,
        selectedNodeId: sel.node,
        selectedEdgeId: sel.edge,
        highlightIds: sel.highlight,
        runFor,
        isSubmitting,
        draggable: interactive,
      }),
    [doc, positions, hideEdges, onlyCast, sel, runFor, isSubmitting, interactive],
  );
  const nodeCache = React.useRef(new Map<string, BoardNode>());
  const edgeCache = React.useRef(new Map<string, BoardEdge>());
  const nodes = React.useMemo(() => {
    const out = stabilizeNodes(nodeCache.current, derived.nodes);
    nodeCache.current = new Map(out.map((n) => [n.id, n]));
    return out;
  }, [derived.nodes]);
  const edges = React.useMemo(() => {
    const out = stabilizeEdges(edgeCache.current, derived.edges);
    edgeCache.current = new Map(out.map((e) => [e.id, e]));
    return out;
  }, [derived.edges]);

  // 选中的东西被删了（在详情弹窗里、或别的地方）：收起
  React.useEffect(() => {
    if (sel.node && !nodeKindOf(doc, sel.node)) setSel(NO_SELECTION);
    else if (sel.edge && !doc.board.edges.some((e) => e.id === sel.edge)) setSel(NO_SELECTION);
    if (detailLookId && !findLook(doc, detailLookId)) setDetailLookId(null);
  }, [doc, sel, detailLookId]);

  // ── 视口 ──────────────────────────────────────────────────────────────────
  const reveal = React.useCallback(
    (ids: string[], zoom: "keep" | "fit") => {
      if (!ids.length) return;
      requestAnimationFrame(() => {
        const z = rf.getZoom();
        void rf.fitView({
          nodes: ids.map((id) => ({ id })),
          padding: 0.3,
          duration: 300,
          ...(zoom === "keep" ? { minZoom: z, maxZoom: z } : { maxZoom: 1 }),
        });
      });
    },
    [rf],
  );

  const viewportCenter = React.useCallback((): XY => {
    const el = wrapRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }, [rf]);

  // 进页用哪个视口：本机记录 > 文档里的老值 > 没有（null = 铺满所有卡片）
  const [initialViewport] = React.useState<Viewport | null>(
    () => readStoredViewport(canvasId) ?? (isInitialViewport(doc.board.viewport) ? null : doc.board.viewport),
  );
  const vpPending = React.useRef<Viewport | null>(null);
  const vpTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushViewport = React.useCallback(() => {
    if (vpTimer.current) clearTimeout(vpTimer.current);
    vpTimer.current = null;
    const v = vpPending.current;
    vpPending.current = null;
    if (v) writeStoredViewport(canvasId, v); // 只记本机，不调 update()（见头注释）
  }, [canvasId]);
  const onMoveEnd: OnMoveEnd = React.useCallback(
    (_e, vp) => {
      vpPending.current = vp;
      if (vpTimer.current) clearTimeout(vpTimer.current);
      vpTimer.current = setTimeout(flushViewport, VIEWPORT_SAVE_MS);
    },
    [flushViewport],
  );
  // 离开画布（切到列表 / 别的步骤）时，没来得及记的视口补上
  const flushViewportRef = React.useRef(flushViewport);
  flushViewportRef.current = flushViewport;
  React.useEffect(() => () => flushViewportRef.current(), []);

  const resetView = React.useCallback(() => {
    void rf.fitView({ padding: FIT_PADDING, maxZoom: 1, duration: 250 });
  }, [rf]);

  // ── 定位（focus / 抽屉点一项）─────────────────────────────────────────────
  const locate = React.useCallback(
    (p: DrawerPick): boolean => {
      const d = getDoc();
      if (p.kind === "look") {
        const hit = findLook(d, p.id);
        if (!hit) return false;
        update((x) => expandGroup(x, characterGroupId(hit.character.id)));
        setSel({ node: p.id, edge: null, highlight: [] });
        reveal([p.id], "fit");
        return true;
      }
      if (p.kind === "character") {
        const c = findCharacter(d, p.id);
        if (!c || !c.looks.length) return false;
        const gid = characterGroupId(c.id);
        update((x) => expandGroup(x, gid));
        setSel({ node: c.looks[0].id, edge: null, highlight: c.looks.map((l) => l.id) });
        reveal([gid], "fit");
        return true;
      }
      if (p.kind === "scene") {
        if (!findScene(d, p.id)) return false;
        update((x) => expandGroup(x, SCENES_GROUP_ID));
        setSel({ node: p.id, edge: null, highlight: [] });
        reveal([p.id], "fit");
        return true;
      }
      if (!findMaterial(d, p.id)) return false;
      setOnlyCast(false);
      setSel({ node: p.id, edge: null, highlight: [] });
      reveal([p.id], "fit");
      return true;
    },
    [getDoc, update, reveal],
  );

  const initDone = React.useRef(false);
  const lastFocus = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (!initDone.current) {
      initDone.current = true;
      lastFocus.current = focus;
      const f = focus ? parseFocus(focus) : null;
      if (f && locate(f)) return;
      if (!initialViewport) requestAnimationFrame(() => void rf.fitView({ padding: FIT_PADDING, maxZoom: 1 }));
      return;
    }
    if (focus && focus !== lastFocus.current) {
      lastFocus.current = focus;
      const f = parseFocus(focus);
      if (f) locate(f);
    }
  }, [focus, locate, rf, initialViewport]);

  // ── 编辑动作 ─────────────────────────────────────────────────────────────
  const requestDelete = React.useCallback(
    async (nodeId: string) => {
      if (readOnlyRef.current) return;
      const plan = deletePlan(getDoc(), nodeId);
      if (!plan) return;
      const ok = await dramaConfirm({ title: plan.title, body: plan.body, tone: "danger", confirmLabel: "删除" });
      if (!ok) return;
      update(plan.apply);
      setSel((s) => (s.node && plan.ids.includes(s.node) ? NO_SELECTION : s));
      setDetailLookId((id) => (id && plan.ids.includes(id) ? null : id));
    },
    [getDoc, update],
  );

  const addLookTo = React.useCallback(
    (characterId: string) => {
      let lookId = "";
      update((d) => {
        const r = addLook(expandGroup(d, characterGroupId(characterId)), characterId);
        lookId = r.lookId;
        return r.doc;
      });
      if (lookId) {
        select(lookId);
        reveal([lookId], "keep");
      }
    },
    [update, select, reveal],
  );

  const addSceneAction = React.useCallback(() => {
    let id = "";
    const c = viewportCenter();
    update((d) => {
      const first = d.scenes.length === 0;
      const r = addScene(expandGroup(d, SCENES_GROUP_ID), "");
      id = r.id;
      // 第一个场景：场景分组放在视口中间；已经有分组时新卡片接在组里（自动排版）
      return first
        ? writePositions(r.doc, {
            [SCENES_GROUP_ID]: { x: c.x - GROUP.minW / 2, y: c.y - (GROUP.header + CARD.scene.h + GROUP.pad) / 2 },
            [r.id]: { x: GROUP.pad, y: GROUP.header },
          })
        : r.doc;
    });
    if (id) {
      select(id);
      reveal([id], "keep");
    }
  }, [update, viewportCenter, select, reveal]);

  const addCharacterAction = React.useCallback(
    (name: string, role: CanvasCharacterRole) => {
      let lookId = "";
      const c = viewportCenter();
      update((d) => {
        const r = addCharacter(d, name, role);
        lookId = r.lookId;
        const h = GROUP.header + CARD.look.h + GROUP.pad;
        return writePositions(r.doc, {
          [characterGroupId(r.characterId)]: { x: c.x - GROUP.minW / 2, y: c.y - h / 2 },
          [r.lookId]: { x: GROUP.pad, y: GROUP.header },
        });
      });
      setAddCharOpen(false);
      if (lookId) {
        select(lookId);
        reveal([lookId], "keep");
      }
    },
    [update, viewportCenter, select, reveal],
  );

  /** 新素材放在视口中间附近（同一处连着加几个时错开一点，别叠在一起）。 */
  const materialSpot = React.useCallback(
    (kind: "image" | "text"): XY => {
      const c = viewportCenter();
      const size = kind === "image" ? CARD.image : CARD.text;
      const off = (getDoc().materials.length % 5) * 24;
      return { x: c.x - size.w / 2 + off, y: c.y - size.h / 2 + off };
    },
    [viewportCenter, getDoc],
  );

  const addTextAction = React.useCallback(() => {
    let id = "";
    const spot = materialSpot("text");
    update((d) => {
      const r = addMaterial(d, "text");
      id = r.id;
      return writePositions(r.doc, { [r.id]: spot });
    });
    if (id) {
      setOnlyCast(false);
      select(id);
    }
  }, [materialSpot, update, select]);

  const addImageAction = React.useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("只能传图片", { description: "选一张图片文件，比如 JPG、PNG。" });
        return;
      }
      setUploading(true);
      try {
        const asset = await CanvasApi.uploadImage(file, "其他");
        let id = "";
        const spot = materialSpot("image");
        update((d) => {
          const r = addMaterial(d, "image");
          id = r.id;
          const name = nameFromFile(file.name);
          const withImage = mapMaterial(r.doc, r.id, (m) => ({
            ...m,
            ...(name ? { name } : {}),
            images: { versions: [{ key: asset.key, ...(asset.url ? { url: asset.url } : {}) }] },
          }));
          return writePositions(withImage, { [r.id]: spot });
        });
        if (id) {
          setOnlyCast(false);
          select(id);
        }
      } catch (e) {
        toast.error("图没传上去", { description: aiErrorMessage(e, "请稍后再试。") });
      } finally {
        setUploading(false);
      }
    },
    [materialSpot, update, select],
  );

  /** 出图面板里「+ 上传参考」传完：新素材放到目标左边，并连一条线过去（面板已经连过就不重复）。 */
  const onReferenceAdded = React.useCallback(
    (materialId: string) => {
      const target = selRef.current.node;
      if (!target) return;
      update((d) => {
        const abs = absolutePosition(d, resolvePositions(d), target);
        if (!abs) return d;
        const already = d.board.edges.filter((e) => e.target === target && e.source !== materialId).length;
        const spot = { x: abs.x - CARD.image.w - 72, y: abs.y + already * (CARD.image.h + 16) };
        return addBoardEdge(writePositions(d, { [materialId]: spot }), materialId, target);
      });
      setOnlyCast(false);
    },
    [update],
  );

  const actions = React.useMemo<BoardActions>(
    () => ({
      readOnly,
      getDoc,
      openLookDetail: (lookId) => setDetailLookId(lookId),
      addLookTo,
      addScene: addSceneAction,
      toggleCollapsed: (groupId) => update((d) => toggleCollapsed(d, groupId)),
      requestDelete: (id) => void requestDelete(id),
      setMaterialText: (id, text) => update((d) => setMaterialText(d, id, text)),
      rename: (t: RenameTarget, name: string) =>
        update((d) =>
          t.kind === "character" ? renameCharacter(d, t.id, name) : t.kind === "scene" ? renameScene(d, t.id, name) : renameMaterial(d, t.id, name),
        ),
      select,
    }),
    [readOnly, getDoc, addLookTo, addSceneAction, update, requestDelete, select],
  );

  // ── React Flow 回调 ───────────────────────────────────────────────────────
  /** 把位置写回文档；动到的是分组里的卡片时，分组跟着贴合（卡片拖到分组外面，分组就扩出去）。 */
  const commitPositions = React.useCallback(
    (patch: Record<string, XY>) => {
      update((d) => {
        let next = writePositions(applyAutoLayout(d), patch);
        const groups = new Set(Object.keys(patch).map((id) => parentGroupOf(next, id)).filter((g): g is string => !!g));
        for (const gid of groups) {
          const hugged = hugGroup(next.board.positions, gid, childIdsOf(next, gid));
          if (hugged !== next.board.positions) next = { ...next, board: { ...next.board, positions: hugged } };
        }
        return next;
      });
    },
    [update],
  );

  // 拖动中：位置先放在临时状态里（React Flow 要受控的位置才会动），拖完才写回文档
  const draggingRef = React.useRef(false);
  const dragRef = React.useRef<Record<string, XY>>({});
  const onNodesChange = React.useCallback(
    (changes: NodeChange<BoardNode>[]) => {
      let patch: Record<string, XY> | null = null;
      for (const c of changes) {
        if (c.type === "position" && c.position) (patch ??= {})[c.id] = c.position;
      }
      if (!patch) return;
      if (!draggingRef.current) {
        // 不是拖出来的位置变化（选中卡片后按方向键挪）：直接写回
        commitPositions(patch);
        return;
      }
      dragRef.current = { ...dragRef.current, ...patch };
      setDragPos(dragRef.current);
    },
    [commitPositions],
  );

  const onNodeDragStart: OnNodeDrag<BoardNode> = React.useCallback(() => {
    draggingRef.current = true;
  }, []);

  const onNodeDragStop: OnNodeDrag<BoardNode> = React.useCallback(
    (_e, _node, dragged) => {
      draggingRef.current = false;
      const patch: Record<string, XY> = {};
      for (const n of dragged) patch[n.id] = dragRef.current[n.id] ?? n.position;
      commitPositions(patch);
      dragRef.current = {};
      setDragPos({});
    },
    [commitPositions],
  );

  const onNodeClick: NodeMouseHandler<BoardNode> = React.useCallback(
    (_e, node) => {
      if (mode === "hand") return;
      if (node.type === "charGroup" || node.type === "sceneGroup") setSel(NO_SELECTION);
      else setSel({ node: node.id, edge: null, highlight: [] });
    },
    [mode],
  );

  const onEdgeClick: EdgeMouseHandler<BoardEdge> = React.useCallback(
    (_e, edge) => {
      if (mode === "hand") return;
      setSel({ node: null, edge: edge.id, highlight: [] });
    },
    [mode],
  );

  const isValidConnection: IsValidConnection<Edge> = React.useCallback(
    (c) => checkConnection(getDoc(), c.source, c.target).ok,
    [getDoc],
  );
  const onConnect = React.useCallback((c: Connection) => update((d) => addBoardEdge(d, c.source, c.target)), [update]);

  // ── 键盘：Esc 收起面板；Delete 删选中的线（或卡片，先确认）──────────────────
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isEditable(e.target)) return;
      if (document.querySelector('[aria-modal="true"]')) return; // 有弹窗时交给弹窗
      if (e.key === "Escape") {
        if (selRef.current.node || selRef.current.edge) setSel(NO_SELECTION);
        else setDrawerOpen(false);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !readOnlyRef.current) {
        const s = selRef.current;
        if (s.edge) {
          e.preventDefault();
          const id = s.edge;
          update((d) => removeBoardEdge(d, id));
          setSel(NO_SELECTION);
        } else if (s.node) {
          e.preventDefault();
          void requestDelete(s.node);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [update, requestDelete]);

  const relayout = React.useCallback(async () => {
    const ok = await dramaConfirm({
      title: "重新排一下？",
      body: "所有卡片会按角色、场景、素材重新摆放，手动拖过的位置会丢掉。连线和内容都不变。",
      confirmLabel: "重新排",
    });
    if (!ok) return;
    update((d) => relayoutAll(d));
    requestAnimationFrame(() => void rf.fitView({ padding: FIT_PADDING, maxZoom: 1, duration: 300 }));
  }, [update, rf]);

  // ── 选中了什么：出图面板停在下面 ─────────────────────────────────────────
  const genTarget = React.useMemo<GenTarget | null>(() => {
    const id = sel.node;
    if (!id) return null;
    const k = nodeKindOf(doc, id);
    if (k === "look") return { kind: "look", id };
    if (k === "scene") return { kind: "scene", id };
    if (k === "imageMaterial") return { kind: "material", id };
    return null;
  }, [sel.node, doc]);

  const empty = !doc.characters.length && !doc.scenes.length && !doc.materials.length;
  const idEnc = encodeURIComponent(canvasId);

  return (
    <div ref={wrapRef} className={cx("cv-fill cvb-root", readOnly && "is-readonly")}>
      <BoardActionsProvider value={actions}>
        <ReactFlow<BoardNode, BoardEdge>
          className={cx("cvb-flow", mode === "hand" && "is-hand")}
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={clearSelection}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onMoveEnd={onMoveEnd}
          defaultViewport={initialViewport ?? undefined}
          minZoom={0.1}
          maxZoom={2}
          nodesDraggable={interactive}
          nodesConnectable={interactive}
          elementsSelectable={mode === "pointer"}
          edgesFocusable={interactive}
          deleteKeyCode={null}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
          selectionOnDrag={false}
          zoomOnDoubleClick={false}
          nodeDragThreshold={3}
          panOnDrag
          onlyRenderVisibleElements={nodes.length > VISIBLE_ONLY_THRESHOLD}
          connectionLineStyle={{ stroke: "#f97316", strokeWidth: 2 }}
          attributionPosition="top-right"
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#d6d3d1" />
          {showMinimap && (
            <MiniMap className="cvb-minimap" position="bottom-right" pannable zoomable nodeColor={minimapColor} nodeStrokeWidth={0} ariaLabel="小地图" />
          )}
        </ReactFlow>
        <ConnectTip />

        {empty && (
          <div className="cvb-empty">
            <div className="cvb-empty-title">画布上还没有角色和场景</div>
            <div className="cvb-empty-sub">回到剧本页「拆出角色和场景」，或者用「加一个」自己加。</div>
            <Link className="btn btn-line btn-sm" href={`/canvas/${idEnc}/script`}>
              去剧本
            </Link>
          </div>
        )}

        {drawerOpen && (
          <AssetDrawer
            doc={doc}
            onClose={() => setDrawerOpen(false)}
            onPick={(p) => {
              locate(p);
            }}
          />
        )}

        <BoardToolbar
          drawerOpen={drawerOpen}
          onToggleDrawer={() => setDrawerOpen((v) => !v)}
          onResetView={resetView}
          onRelayout={canEdit ? () => void relayout() : undefined}
          hideEdges={hideEdges}
          onToggleEdges={() => setHideEdges((v) => !v)}
          onlyCast={onlyCast}
          onToggleOnlyCast={() => setOnlyCast((v) => !v)}
          showMinimap={showMinimap}
          onToggleMinimap={() => setShowMinimap((v) => !v)}
        />

        <AddBar
          mode={mode}
          onMode={(m) => {
            setMode(m);
            if (m === "hand") setSel(NO_SELECTION);
          }}
          canEdit={canEdit}
          uploading={uploading}
          onAddCharacter={() => setAddCharOpen(true)}
          onAddScene={addSceneAction}
          onPickImage={(f) => void addImageAction(f)}
          onAddText={addTextAction}
        />

        <Link className="cvb-next" href={`/canvas/${idEnc}/episodes`}>
          <span className="cvb-next-hint">角色和场景都定好了</span>
          <span className="cvb-next-go">
            进入逐集制作
            <ArrowRight size={14} />
          </span>
        </Link>

        {genTarget && canEdit && (
          <div className="cvb-dock">
            <AssetGenPanel
              key={`${genTarget.kind}:${genTarget.id}`}
              target={genTarget}
              variant="docked"
              onClose={clearSelection}
              onReferenceAdded={onReferenceAdded}
            />
          </div>
        )}

        {detailLookId && <LookDetailDialog lookId={detailLookId} open onClose={() => setDetailLookId(null)} />}

        <AddCharacterDialog
          open={addCharOpen}
          existingNames={doc.characters.map((c) => c.name)}
          defaultRole={defaultNewRole(doc.characters)}
          onClose={() => setAddCharOpen(false)}
          onSubmit={addCharacterAction}
        />
      </BoardActionsProvider>
    </div>
  );
}
