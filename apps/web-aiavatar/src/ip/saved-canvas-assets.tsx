"use client";
import * as React from "react";
import { SignedAudio } from "@/canvas-bridge/signed-audio";
import { SignedImage } from "@/canvas-bridge/signed-image";
import Link from "next/link";
import { useAssetStore } from "@/canvas/stores/use-asset-store";
import { useIdentity } from "@/proto/api";
import { Card, EmptyState, LoadingBlock, SectionHeader } from "@/components/hub/ui";
import { downloadMedia } from "@/canvas-bridge/download-media";
export function SavedCanvasAssets() {
  const assets = useAssetStore((s) => s.assets);
  const loading = useAssetStore((s) => s.loading);
  const error = useAssetStore((s) => s.error);
  const identity = useIdentity();
  const [actionError, setActionError] = React.useState("");
  React.useEffect(() => { const store = useAssetStore.getState(); store.reset(); void store.loadAssets(); return () => store.reset(); }, [identity?.uid]);
  return <section style={{ margin: "20px 16px 0" }}>
    <SectionHeader title="画布素材" hint="在画布中加入我的资产的图片、视频、音频和文本" count={loading ? undefined : assets.length} />
    {loading ? <LoadingBlock /> : error ? <Card><p role="alert">{error}</p><button onClick={() => void useAssetStore.getState().loadAssets()}>重试</button></Card> : !assets.length ? <Card><EmptyState text="还没有保存的画布素材" actionHref="/projects" actionLabel="打开画布" /></Card> :
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>{assets.map((a) => <Card key={a.id}>
        {a.kind === "image" ? <a href={a.data.dataUrl} target="_blank" rel="noreferrer"><SignedImage storageKey={a.data.storageKey} src={a.data.dataUrl} alt={a.title} style={{ width: "100%", height: 160, objectFit: "contain", borderRadius: 8 }} /></a> : a.kind === "video" ? <video src={a.data.url} controls preload="none" style={{ width: "100%", height: 160 }} /> : a.kind === "audio" ? <SignedAudio src={a.data.url} storageKey={a.data.storageKey} controls style={{ width: "100%" }}/> : <p style={{ maxHeight: 160, overflowY: "auto", whiteSpace: "pre-wrap" }}>{a.data.content}</p>}
        <p style={{ fontSize: 13, fontWeight: 600, overflowWrap: "anywhere" }}>{a.title}</p>
        {typeof a.metadata?.prompt === "string" && a.metadata.prompt && <details><summary style={{ fontSize: 12 }}>查看指令</summary><p style={{ fontSize: 12, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>{a.metadata.prompt}</p></details>}
        {a.kind !== "text" && <button style={{ marginTop: 8 }} onClick={() => void downloadMedia(a.kind === "image" ? a.data.dataUrl : a.data.url, a.title, a.data.mimeType, a.data.storageKey).catch((e: unknown) => setActionError(e instanceof Error ? e.message : "下载失败"))}>下载</button>}
      </Card>)}</div>}
    {actionError && <p role="alert" style={{ color: "var(--err)" }}>{actionError}</p>}
    <p style={{ fontSize: 12, marginTop: 8 }}><Link href="/projects">返回自由画布 ›</Link></p>
  </section>;
}
