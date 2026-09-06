"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 画布页主体 —— 顶部工作栏 + 左节点面板 + React Flow 画布 + 右属性面板。
//
// 职责边界：
//   - doc 的唯一写入口是 canvas-store；本组件只调它的 action
//   - 运行永远经服务端（POST run → 轮询 GET run），前端不碰模型也不碰积分
//   - 保存：doc/name 变化防抖 1.2s PUT；运行时把最新 doc 一起送上（避免竟态）
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import {
  Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider,
  applyNodeChanges, useReactFlow,
} from "@xyflow/react";
import type { Edge, OnConnect, OnEdgesChange, OnNodesChange } from "@xyflow/react";
import { AlertCircle, Loader2 } from "lucide-react";
import type {
  IpNodeType, IpPricing, IpProject, IpPublishResult, IpRun, IpStylePreset,
} from "@ai-star-eco/types";
import { AccountApi, isProductNotEnrolledError } from "@ai-star-eco/api-client";
import { EnrollmentGate } from "@ai-star-eco/landing";
import { IpStudioApi } from "@/api";
import { useCanvasStore } from "@/lib/canvas-store";
import { hasSelection, missingInputsForRun, topoOrder } from "@/lib/graph";
import { describeApiError, describeRunError } from "@/lib/node-meta";
import type { IpFlowNode } from "@/lib/flow-types";
import { useToast } from "@/components/common/toast";
import { IP_NODE_TYPES } from "./nodes";
import { NODE_DRAG_MIME, NodePalette } from "./palette";
import { Inspector } from "./inspector";
import { CanvasTopBar } from "./topbar";
import { PublishDialog } from "./publish-dialog";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
// 只收 JPG / PNG —— 服务端白名单就这两种，多列一种只会让用户传完才被退回
const ACCEPTED_TYPES = ["image/jpeg", "image/png"];
const AUTOSAVE_DELAY_MS = 1200;

const ENROLL_THEME = {
  bg: "var(--canvas)", surface: "var(--surface)", fg: "var(--ink)",
  fgMuted: "var(--ink-2)", accent: "var(--primary)", accentFg: "var(--on-primary)",
  border: "var(--line-2)", radius: "15px",
} as const;

export function CanvasShell({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const load = useCanvasStore((s) => s.load);
  const loadedId = useCanvasStore((s) => s.projectId);

  const [phase, setPhase] = React.useState<"loading" | "ready" | "error" | "enroll">("loading");
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [styles, setStyles] = React.useState<IpStylePreset[]>([]);
  const [pricing, setPricing] = React.useState<IpPricing | null>(null);
  const [credits, setCredits] = React.useState<number | null>(null);

  const fetchAll = React.useCallback(async () => {
    setPhase("loading");
    setErrorText(null);
    try {
      const project: IpProject = await IpStudioApi.getProject(projectId);
      load(project);
      setPhase("ready");
      // 附属数据 best-effort：拿不到不挡画布
      void IpStudioApi.listStyles().then(setStyles).catch(() => setStyles([]));
      void IpStudioApi.getPricing().then(setPricing).catch(() => setPricing(null));
      void AccountApi.getMyWallet().then((w) => setCredits(w.totalBalance)).catch(() => setCredits(null));
    } catch (e) {
      if (isProductNotEnrolledError(e)) setPhase("enroll");
      else {
        setErrorText(e instanceof Error ? e.message : "这个项目没能打开");
        setPhase("error");
      }
    }
  }, [projectId, load]);

  React.useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  if (phase === "enroll") {
    return <EnrollmentGate product="aiavatar" productLabel="数字资产平台" onActivated={fetchAll} theme={ENROLL_THEME} />;
  }

  if (phase === "loading" || loadedId !== projectId) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} />
        <p className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>正在打开画布…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-center">
        <AlertCircle className="w-6 h-6" style={{ color: "var(--err)" }} />
        <p className="text-[13px] max-w-sm" style={{ color: "var(--ink-2)" }}>{errorText}</p>
        <button
          onClick={() => void fetchAll()}
          className="px-4 py-2 rounded-xl text-[12.5px] font-bold"
          style={{ background: "var(--primary)", color: "var(--on-primary)" }}
        >
          重新加载
        </button>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <CanvasWorkspace projectId={projectId} styles={styles} pricing={pricing} credits={credits} toast={toast} />
    </ReactFlowProvider>
  );
}

function CanvasWorkspace({
  projectId, styles, pricing, credits, toast,
}: {
  projectId: string;
  styles: IpStylePreset[];
  pricing: IpPricing | null;
  credits: number | null;
  toast: (message: string, tone?: "info" | "ok" | "warn") => void;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const doc = useCanvasStore((s) => s.doc);
  const name = useCanvasStore((s) => s.name);
  const status = useCanvasStore((s) => s.status);
  const runs = useCanvasStore((s) => s.runs);
  const activeRuns = useCanvasStore((s) => s.activeRuns);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const saveState = useCanvasStore((s) => s.saveState);
  const past = useCanvasStore((s) => s.past);
  const future = useCanvasStore((s) => s.future);

  const [uploadingNodeId, setUploadingNodeId] = React.useState<string | null>(null);
  const [runAllBusy, setRunAllBusy] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);

  const selectedNode = React.useMemo(
    () => doc.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [doc.nodes, selectedNodeId],
  );

  // ── 保存 ──────────────────────────────────────────────────────────────────
  //
  // 串行 + 版本号：两个 PUT 同时在飞时，先发的那个可能后到，服务端就把旧文档
  // 盖回去了。所以每次保存领一个序号、排在上一次之后发；只有**最新那一次**
  // 有权改保存状态（旧的失败不该盖掉新的成功，反之亦然）。失败就停在
  // 「没保存上，点这里重试」，绝不假装已保存。
  const saveSeq = React.useRef(0);
  const saveChain = React.useRef<Promise<boolean>>(Promise.resolve(true));

  const save = React.useCallback((): Promise<boolean> => {
    const st = useCanvasStore.getState();
    const mySeq = (saveSeq.current += 1);
    const snapshot = { name: st.name, doc: st.doc };
    st.setSaveState("saving");
    const attempt = async (): Promise<boolean> => {
      const isLatest = () => saveSeq.current === mySeq;
      try {
        await IpStudioApi.updateProject(projectId, snapshot);
        // 保存期间用户可能又改了（saveState 已被置回 dirty）：那就等下一轮，别落 saved
        if (isLatest() && useCanvasStore.getState().saveState === "saving") {
          useCanvasStore.getState().setSaveState("saved");
        }
        return true;
      } catch {
        if (isLatest()) useCanvasStore.getState().setSaveState("error");
        return false;
      }
    };
    const chained = saveChain.current.then(attempt, attempt);
    saveChain.current = chained;
    return chained;
  }, [projectId]);

  React.useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [saveState, doc, name, save]);

  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const st = useCanvasStore.getState().saveState;
      if (st === "dirty" || st === "saving" || st === "error") e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ── 撤销 / 重做快捷键 ─────────────────────────────────────────────────────
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) useCanvasStore.getState().redo();
      else useCanvasStore.getState().undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── React Flow 数据 ───────────────────────────────────────────────────────
  const rfNodes = React.useMemo<IpFlowNode[]>(
    () =>
      doc.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        selected: n.id === selectedNodeId,
        data: { node: n, run: runs[n.id], running: Boolean(activeRuns[n.id]) },
      })),
    [doc.nodes, runs, activeRuns, selectedNodeId],
  );

  const rfEdges = React.useMemo<Edge[]>(
    () =>
      doc.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: Boolean(activeRuns[e.target]),
      })),
    [doc.edges, activeRuns],
  );

  const onNodesChange = React.useCallback<OnNodesChange<IpFlowNode>>((changes) => {
    const st = useCanvasStore.getState();
    for (const change of changes) {
      if (change.type === "position" && change.position) st.moveNode(change.id, change.position);
      else if (change.type === "select") st.select(change.selected ? change.id : null);
      else if (change.type === "remove") st.removeNode(change.id);
    }
    // applyNodeChanges 只为满足受控用法的类型契约，真值仍在 store
    void applyNodeChanges;
  }, []);

  const onEdgesChange = React.useCallback<OnEdgesChange>((changes) => {
    const st = useCanvasStore.getState();
    for (const change of changes) {
      if (change.type === "remove") st.removeEdge(change.id);
    }
  }, []);

  const onConnect = React.useCallback<OnConnect>(
    (conn) => {
      if (!conn.source || !conn.target) return;
      const ok = useCanvasStore.getState().connect(conn.source, conn.target);
      if (!ok) toast("这两个节点不能这样连，换个方向或换个节点试试。", "warn");
    },
    [toast],
  );

  const addNodeAtCenter = React.useCallback((type: IpNodeType) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const point = rect
      ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 120, y: 120 };
    useCanvasStore.getState().addNode(type, { x: Math.round(point.x - 108), y: Math.round(point.y - 60) });
  }, [screenToFlowPosition]);

  const onDrop = React.useCallback(
    (e: React.DragEvent) => {
      const type = e.dataTransfer.getData(NODE_DRAG_MIME) as IpNodeType | "";
      if (!type) return;
      e.preventDefault();
      const point = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      useCanvasStore.getState().addNode(type, { x: Math.round(point.x - 108), y: Math.round(point.y - 40) });
    },
    [screenToFlowPosition],
  );

  // ── 上传 ──────────────────────────────────────────────────────────────────
  const onUpload = React.useCallback(
    async (nodeId: string, file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast("只支持 JPG / PNG 格式的图片。", "warn");
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        toast("图片超过 15MB，压一下再传。", "warn");
        return;
      }
      setUploadingNodeId(nodeId);
      try {
        const result = await IpStudioApi.uploadImage(file);
        const st = useCanvasStore.getState();
        const node = st.doc.nodes.find((n) => n.id === nodeId);
        if (node?.type === "source") {
          st.patchNodeData(nodeId, "source", {
            assetKey: result.key,
            imageUrl: result.url,
            fileName: result.fileName,
            width: result.width,
            height: result.height,
          });
        } else if (node?.type === "reference") {
          st.patchNodeData(nodeId, "reference", { assetKey: result.key, imageUrl: result.url });
        }
      } catch (e) {
        toast(describeApiError(e, "图片没能上传，重试一次。"), "warn");
      } finally {
        setUploadingNodeId(null);
      }
    },
    [toast],
  );

  // ── 运行 ──────────────────────────────────────────────────────────────────
  //
  // 轮询一次运行到终态并落地结果。抽成独立函数是为了「刷新页面后接着看」：
  // 服务端还在跑的运行由下面的恢复 effect 直接续上同一套收尾逻辑。
  // 已经在盯的 runId（同一次运行只能有一个轮询循环，否则进度与提示都会重影）
  const trackedRef = React.useRef<Set<string>>(new Set());

  const settleRun = React.useCallback(
    async (nodeId: string, runId: string, seed?: IpRun): Promise<IpRun | null> => {
      trackedRef.current.add(runId);
      const st = useCanvasStore.getState();
      if (seed) st.putRun(seed);
      st.setActiveRun(nodeId, runId);
      const final = await IpStudioApi.awaitRun(runId, (r) => useCanvasStore.getState().putRun(r));
      const store = useCanvasStore.getState();
      store.putRun(final);
      store.setActiveRun(nodeId, null);
      if (final.status === "done") {
        if (final.kind === "identity") {
          store.patchNodeData(nodeId, "identity", {
            text: final.output.text ?? "",
            promptEn: final.output.promptEn ?? "",
            fromRunId: final.id,
          });
          toast("特征卡抽好了，检查一下再锁定。", "ok");
        } else {
          const candidates = final.output.candidates ?? [];
          if (candidates.length === 1) {
            store.patchNodeData(nodeId, "generate", { selectedRunId: final.id, selectedIndex: 0 });
          } else if (candidates.length > 1) {
            toast(`出了 ${candidates.length} 张候选，在右侧挑一张定稿。`, "info");
          }
        }
      } else {
        toast(describeRunError(final.errorCode, final.errorMessage), "warn");
      }
      return final;
    },
    [toast],
  );

  // 刷新 / 换设备回来时，接着盯服务端仍在跑的那些运行（store.load 已把它们认回
  // activeRuns）。不接着盯的话，节点会一直停在「运行中」，结果也不会落到画布上。
  React.useEffect(() => {
    for (const [nodeId, runId] of Object.entries(activeRuns)) {
      if (trackedRef.current.has(runId)) continue;
      void settleRun(nodeId, runId).catch(() => {
        useCanvasStore.getState().setActiveRun(nodeId, null);
        toast("有一个生成任务没能盯到结果，刷新页面看看最新状态。", "warn");
      });
    }
  }, [activeRuns, settleRun, toast]);

  const runOne = React.useCallback(
    async (nodeId: string) => {
      const st = useCanvasStore.getState();
      const node = st.doc.nodes.find((n) => n.id === nodeId);
      if (!node) return null;
      if (st.activeRuns[nodeId]) {
        toast("这个节点正在生成中，等它跑完再来。", "info");
        return null;
      }
      const missing = missingInputsForRun(st.doc, node);
      if (missing.length > 0) {
        toast(`还缺${missing.join("、")}，接上以后才能运行。`, "warn");
        return null;
      }
      try {
        const started = await IpStudioApi.runNode(projectId, nodeId, st.doc);
        return await settleRun(nodeId, started.id, started);
      } catch (e) {
        useCanvasStore.getState().setActiveRun(nodeId, null);
        toast(describeApiError(e, "这次生成没能完成，重试一次。"), "warn");
        return null;
      }
    },
    [projectId, settleRun, toast],
  );

  const cancelOne = React.useCallback(
    async (nodeId: string) => {
      const runId = useCanvasStore.getState().activeRuns[nodeId];
      if (!runId) return;
      try {
        const run = await IpStudioApi.cancelRun(runId);
        useCanvasStore.getState().putRun(run);
      } catch (e) {
        toast(describeApiError(e, "没能停下这次生成，稍后再试。"), "warn");
      }
    },
    [toast],
  );

  const runAll = React.useCallback(async () => {
    setRunAllBusy(true);
    try {
      const ordered = topoOrder(useCanvasStore.getState().doc).filter(
        (n): n is Extract<typeof n, { type: "generate" }> => n.type === "generate",
      );
      if (ordered.length === 0) {
        toast("画布上还没有生成节点。", "warn");
        return;
      }
      const master = ordered.find((n) => n.data.isMaster);

      // P1 简化（设计文档 §5）：主形象还没定稿时只跑主形象，跑完提示用户先选一张。
      if (master && !hasSelection(master)) {
        const result = await runOne(master.id);
        if (result?.status === "done") {
          toast("主形象生成完成后请先选一张，再运行其余形象", "info");
        }
        return;
      }

      const rest = ordered.filter((n) => n.id !== master?.id);
      let ran = 0;
      let skipped = 0;
      for (const node of rest) {
        const current = useCanvasStore.getState().doc;
        const fresh = current.nodes.find((n) => n.id === node.id);
        if (!fresh) continue;
        if (missingInputsForRun(current, fresh).length > 0) {
          skipped += 1;
          continue;
        }
        const result = await runOne(node.id);
        if (!result || result.status !== "done") return; // 失败就停，不继续烧积分
        ran += 1;
      }
      if (ran === 0 && skipped > 0) toast(`有 ${skipped} 个形象还缺上游内容，先补齐再运行。`, "warn");
      else if (ran > 0) toast(skipped > 0 ? `跑完 ${ran} 个形象，另有 ${skipped} 个还缺上游内容。` : `${ran} 个形象都跑完了。`, "ok");
    } finally {
      setRunAllBusy(false);
    }
  }, [runOne, toast]);

  // ── 发布 ──────────────────────────────────────────────────────────────────
  const publish = React.useCallback(
    async (payload: { avatarName: string; masterNodeId: string; lookNodeIds: string[] }): Promise<IpPublishResult> => {
      // 发布前先把画布存下来，免得服务端读到旧的选图；没存上就不发布
      // （硬来只会拿旧文档发布出一个对不上的资产）。
      const saved = await save();
      if (!saved) throw new Error("画布还没保存成功，先点顶部的重试保存，再发布。");
      const result = await IpStudioApi.publishProject(projectId, payload);
      const store = useCanvasStore.getState();
      store.markPublished(result.avatarId);
      const publishNode = store.doc.nodes.find((n) => n.type === "publish");
      if (publishNode) {
        store.patchNodeData(publishNode.id, "publish", {
          avatarName: payload.avatarName,
          avatarId: result.avatarId,
          publishedAt: new Date().toISOString(),
        });
      }
      return result;
    },
    [projectId, save],
  );

  const templateName = useCanvasStore((s) => s.templateId);

  return (
    <div className="h-full flex flex-col min-h-0">
      <CanvasTopBar
        name={name}
        onNameChange={(v) => useCanvasStore.getState().setName(v)}
        saveState={saveState}
        onRetrySave={() => void save()}
        credits={credits}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onUndo={() => useCanvasStore.getState().undo()}
        onRedo={() => useCanvasStore.getState().redo()}
        onRunAll={() => void runAll()}
        runAllBusy={runAllBusy}
        onPublish={() => setPublishOpen(true)}
        published={status === "published"}
      />

      <div className="flex-1 min-h-0 flex">
        <NodePalette
          onAdd={addNodeAtCenter}
          templateName={templateName ? "内置工作流" : undefined}
          templateSummary="节点已按这套工作流排好：填照片 → 抽特征卡 → 出主形象 → 挑一张 → 跑其余造型 → 发布。"
        />

        <div
          ref={wrapperRef}
          className="flex-1 min-w-0 relative"
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
        >
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={IP_NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStart={() => useCanvasStore.getState().pushHistory()}
            onPaneClick={() => useCanvasStore.getState().select(null)}
            onMoveEnd={(_, viewport) => useCanvasStore.getState().setViewport(viewport)}
            defaultViewport={doc.viewport.zoom > 0 ? doc.viewport : { x: 40, y: 40, zoom: 0.7 }}
            minZoom={0.25}
            maxZoom={1.6}
            proOptions={{ hideAttribution: false }}
            deleteKeyCode={["Backspace", "Delete"]}
            nodesConnectable
            elevateNodesOnSelect
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#cfd7df" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor="#e0e6ec" maskColor="rgba(247,249,251,0.72)" />
          </ReactFlow>

          {doc.nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-8">
              <p className="asset-name text-[20px] mb-2" style={{ color: "var(--ink-3)" }}>空白画布</p>
              <p className="text-[12px] leading-relaxed max-w-xs" style={{ color: "var(--ink-3)" }}>
                从左边把「照片」拖进来开始：照片 → 人物特征卡 → 风格 → 生成 → 形象卡 → 发布。
              </p>
            </div>
          )}
        </div>

        <Inspector
          node={selectedNode}
          run={selectedNode ? runs[selectedNode.id] : undefined}
          running={Boolean(selectedNode && activeRuns[selectedNode.id])}
          styles={styles}
          pricing={pricing}
          uploadingNodeId={uploadingNodeId}
          onRun={(id) => void runOne(id)}
          onCancel={(id) => void cancelOne(id)}
          onUpload={(id, file) => void onUpload(id, file)}
        />
      </div>

      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} onPublish={publish} />
    </div>
  );
}
