"use client";
import * as React from "react";
import { App, Button, Empty, Modal, Spin, Tabs } from "antd";
import { SignedImage } from "@/canvas-bridge/signed-image";
import { formatDateTime } from "@/lib/datetime";
import { nanoid } from "nanoid";
import type { IpRun, IpRevision, IpCandidate } from "@ai-star-eco/types";
import { IpStudioApi } from "@/ip/api";
import { useCanvasStore } from "@/canvas/stores/canvas/use-canvas-store";
import { useAssetStore } from "@/canvas/stores/use-asset-store";
import { insertRecoveredNode } from "@/canvas-bridge/canvas-recovery";
import { CanvasNodeType } from "@/canvas/types/canvas";
import type { SaveOutcome } from "@/canvas-bridge/project-sync";
const time = formatDateTime;
export function ProjectHistory({ projectId, saveNow }: { projectId: string; saveNow: () => Promise<SaveOutcome> }) {
  const [open, setOpen] = React.useState(false);
  const [runs, setRuns] = React.useState<IpRun[]>([]);
  const [versions, setVersions] = React.useState<IpRevision[]>([]);
  const [page, setPage] = React.useState(0);
  const [more, setMore] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const { message, modal } = App.useApp();
  const load = async (next = 0) => {
    setLoading(true); setError("");
    try {
      const [result, history] = await Promise.all([IpStudioApi.listProjectRuns(projectId, next), IpStudioApi.listProjectHistory(projectId)]);
      setRuns((prev) => next ? [...new Map([...prev, ...result.items].map((r) => [r.id, r])).values()] : result.items);
      setVersions(history); setPage(next); setMore(result.hasMore);
    } catch (e) { setError(e instanceof Error ? e.message : "历史记录加载失败"); }
    finally { setLoading(false); }
  };
  const act = async (task: () => Promise<void>) => {
    setBusy(true);
    try { await task(); } catch (e) { message.error(e instanceof Error ? e.message : "操作失败，请重试"); }
    finally { setBusy(false); }
  };
  const add = async (run: IpRun, image: IpCandidate) => {
    const project = useCanvasStore.getState().projects.find((p) => p.id === projectId);
    const viewport = project?.viewport ?? { x: 0, y: 0, k: 1 };
    const width = 280, height = Math.min(560, Math.max(160, width * (image.height || width) / (image.width || width)));
    insertRecoveredNode(projectId, {
      id: nanoid(), type: CanvasNodeType.Image, title: "历史生成图片",
      position: { x: (160 - viewport.x) / viewport.k, y: (160 - viewport.y) / viewport.k }, width, height,
      metadata: { content: image.url, storageKey: image.key, prompt: run.inputs.userPrompt || run.inputs.prompt || "", runId: run.id,
        naturalWidth: image.width, naturalHeight: image.height, mimeType: "image/jpeg" },
    });
    // State update reaches the canvas/store on the next render. Close only after a paint, then await the real PUT.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const result = await saveNow();
    if (result === "failed" || result === "conflict") throw new Error("图片已放回画布，但尚未保存，请先重试保存");
    message.success("图片和指令已恢复到画布"); setOpen(false);
  };
  const restore = (version: IpRevision) => modal.confirm({
    title: "恢复这个画布版本？", content: "当前画布会先保存，可在历史记录里找回。",
    okText: "恢复", cancelText: "取消",
    onOk: () => act(async () => {
      const outcome = await saveNow();
      if (outcome === "failed" || outcome === "conflict") throw new Error("当前画布尚未保存，请先处理保存问题");
      const [current, previous] = await Promise.all([IpStudioApi.getProject(projectId), IpStudioApi.getProjectRevision(projectId, version.id)]);
      await IpStudioApi.updateProject(projectId, { name: previous.name, doc: previous.doc, baseDocVersion: current.docVersion });
      window.location.reload();
    }),
  });
  const prompt = (run: IpRun) => run.inputs.userPrompt || run.inputs.prompt || "";
  return <>
    <button type="button" onClick={() => { setOpen(true); void load(); }} className="h-8 px-3 rounded-full text-[12px] font-semibold whitespace-nowrap" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>历史记录</button>
    <Modal title="历史记录" open={open} onCancel={() => setOpen(false)} footer={null} width={760} getContainer={() => document.querySelector<HTMLElement>(".ip-surface") ?? document.body}>
      {error && <div role="alert" style={{ color: "var(--err)", marginBottom: 12 }}>{error} <Button onClick={() => void load()} disabled={loading}>重试</Button></div>}
      <Tabs items={[
        { key: "runs", label: "生成记录", children: <div style={{ maxHeight: "65vh", overflowY: "auto" }}>
          {!loading && !error && !runs.length && <Empty description="还没有生成记录" />}
          {runs.map((run) => <article key={run.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--line-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}><span>{time(run.createdAt)}</span><span>{run.status === "done" ? "已完成" : run.status === "failed" ? "生成失败" : "生成中"} · {run.cost} 积分</span></div>
            {run.errorMessage && <p role="alert">{run.errorMessage}</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>{(run.output.candidates ?? []).map((image) => <div key={image.key} style={{ width: 180 }}>
              <SignedImage storageKey={image.key} src={image.url} alt="历史生成图片" style={{ width: "100%", height: 150, objectFit: "contain", background: "var(--surface-2)", borderRadius: 8 }} />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}><Button size="small" disabled={busy} onClick={() => void act(() => add(run, image))}>添加到画布</Button><Button size="small" disabled={busy} onClick={() => void act(async () => {
                await useAssetStore.getState().addAsset({ kind: "image", title: "历史生成图片", coverUrl: image.url, tags: [], source: "Canvas", data: { dataUrl: image.url, storageKey: image.key, width: image.width || 0, height: image.height || 0, bytes: 0, mimeType: "image/jpeg" }, metadata: { prompt: prompt(run) } });
                message.success("已保存到资产，可在顶部「资产」页查看");
              })}>保存到资产</Button></div>
            </div>)}</div>
            {run.output.text && <p style={{ whiteSpace: "pre-wrap" }}>{run.output.text}</p>}
            {prompt(run) && <details style={{ marginTop: 10 }}><summary>{run.inputs.userPrompt ? "生成指令" : "完整生成提示词"}</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12, maxHeight: 240, overflowY: "auto" }}>{prompt(run)}</pre></details>}
          </article>)}
          {loading && <Spin style={{ display: "block", margin: 16 }} />}
          {more && <Button block disabled={loading} onClick={() => void load(page + 1)}>加载更多</Button>}
        </div> },
        { key: "versions", label: "画布版本", children: <div style={{ maxHeight: "65vh", overflowY: "auto" }}>
          <p style={{ fontSize: 12, color: "var(--ink-3)" }}>保留最近 50 个内容版本。版本记录从此次更新开始，之前的成图和指令可在「生成记录」找回。</p>
          {!loading && !error && !versions.length && <Empty description="还没有历史版本" />}
          {versions.map((v) => <div key={v.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--line-2)" }}><div><b>{v.name}</b><div style={{ fontSize: 12 }}>{time(v.createdAt)} · {v.nodeCount} 个节点</div></div><Button disabled={busy} onClick={() => restore(v)}>恢复此版本</Button></div>)}
        </div> },
      ]} />
    </Modal>
  </>;
}
