"use client";

// 回收站：数字人（保留 30 天、可彻底删除）、导演台作品和画布（可以恢复）。
// 数字人：AvatarApi.trash / restore / purge；导演台：DirectorApi.listTrash / restoreWork；画布：AccountApi.trashedCanvases / restoreCanvas。

import { useEffect, useState } from "react";
import { Modal } from "antd";
import { Clock } from "lucide-react";
import type { DirectorTrashedWork, StudioTrashedCanvas } from "@ai-star-eco/types";
import { AvatarApi } from "@/proto/api";
import { AccountApi, DirectorApi } from "@/ip/api";
import { reportStudioError } from "@/ip/studio-errors";
import { formatDateTime } from "@/lib/datetime";
import { LoadState } from "./account-ui";

type Kind = "avatar" | "director" | "canvas";
interface TrashItem { kind: Kind; id: string; name: string; sub: string; deletedAt: string | null; daysLeft?: number; imageUrl?: string | null }

const KIND_LABEL: Record<Kind, string> = { avatar: "数字人", director: "导演台作品", canvas: "画布" };
const GRADIENT: Record<Kind, string> = {
  avatar: "linear-gradient(160deg,#e9ebfb,#f3eefd)",
  director: "linear-gradient(160deg,#fdf3e3,#f6efe6)",
  canvas: "linear-gradient(160deg,#e6f4ef,#eef1f4)",
};

function avatarItem(a: { id: string; name: string; archetype?: string; path?: string; imageUrl?: string | null; deletedAt?: string | null; daysLeft?: number }): TrashItem {
  return { kind: "avatar", id: a.id, name: a.name, sub: a.archetype || (a.path === "real" ? "真人授权复刻" : "AI 原创形象"), deletedAt: a.deletedAt ?? null, daysLeft: a.daysLeft, imageUrl: a.imageUrl };
}
function workItem(w: DirectorTrashedWork): TrashItem {
  return { kind: "director", id: w.id, name: w.title || "未命名作品", sub: w.episodeCount > 0 ? `${w.episodeCount} 集` : "导演台作品", deletedAt: w.deletedAt, imageUrl: w.coverUrl };
}
function canvasItem(c: StudioTrashedCanvas): TrashItem {
  return { kind: "canvas", id: c.id, name: c.name || "未命名画布", sub: "画布", deletedAt: c.deletedAt };
}

export function AccountTrash() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);
  const [filter, setFilter] = useState<Kind | "all">("all");
  const [busy, setBusy] = useState("");
  const [purge, setPurge] = useState<TrashItem>();
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const sources: [Kind, Promise<TrashItem[]>][] = [
      ["avatar", AvatarApi.trash().then((list: any[]) => (list || []).map(avatarItem))],
      ["director", DirectorApi.listTrash().then(list => list.map(workItem))],
      ["canvas", AccountApi.trashedCanvases().then(list => list.map(canvasItem))],
    ];
    Promise.allSettled(sources.map(([, p]) => p)).then(results => {
      if (!live) return;
      const all: TrashItem[] = [], bad: string[] = [];
      results.forEach((r, i) => r.status === "fulfilled" ? all.push(...r.value) : bad.push(KIND_LABEL[sources[i][0]]));
      all.sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));
      setItems(all); setFailed(bad); setLoading(false);
    });
    return () => { live = false; };
  }, [reload]);

  const restore = async (item: TrashItem) => {
    if (busy) return;
    setBusy(item.id);
    try {
      if (item.kind === "avatar") await AvatarApi.restore(item.id);
      else if (item.kind === "director") await DirectorApi.restoreWork(item.id);
      else await AccountApi.restoreCanvas(item.id);
      setItems(prev => prev.filter(x => !(x.kind === item.kind && x.id === item.id)));
    } catch (error) { reportStudioError(error, { action: "恢复" }); }
    finally { setBusy(""); }
  };
  const confirmPurge = async () => {
    if (!purge || busy) return;
    setBusy(purge.id);
    try {
      if (purge.kind === "avatar") await AvatarApi.purge(purge.id);
      else if (purge.kind === "director") await AccountApi.purgeWork(purge.id);
      else await AccountApi.purgeCanvas(purge.id);
      setItems(prev => prev.filter(x => !(x.kind === purge.kind && x.id === purge.id)));
      setPurge(undefined);
    } catch (error) { reportStudioError(error, { action: "彻底删除" }); }
    finally { setBusy(""); }
  };
  const [retention, setRetention] = useState(0);
  useEffect(() => {
    let live = true;
    AccountApi.trashPolicy().then(p => { if (live) setRetention(p.retentionDays); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const purgeText = !purge ? "" : purge.kind === "avatar"
    ? "该数字人的图集、衍生内容、历史版本和文件将一并删除，且无法恢复。"
    : `${purge.kind === "director" ? "作品" : "画布"}将被永久删除，且无法恢复。已经生成的图片和视频仍保留在资产库。`;
  const policyText = retention > 0
    ? `删除的数字人保留 30 天，导演台作品和画布保留 ${retention} 天，到期后自动彻底删除。`
    : "删除的数字人保留 30 天，到期后连同文件一起彻底删除。导演台作品和画布不会自动清理。";

  const count = (k: Kind) => items.filter(i => i.kind === k).length;
  const shown = filter === "all" ? items : items.filter(i => i.kind === filter);

  return <>
    <div className="account-filters">
      <div className="account-seg" role="group" aria-label="按类型筛选">
        <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>全部<small>{items.length}</small></button>
        {(["avatar", "director", "canvas"] as Kind[]).map(k => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{KIND_LABEL[k]}<small>{count(k)}</small></button>)}
      </div>
      <span className="account-muted" style={{ fontSize: 12.5 }}>{policyText}</span>
    </div>
    {failed.length > 0 && <p className="account-alert" role="alert" style={{ marginBottom: 12 }}>{failed.join("、")}加载失败，请稍后刷新重试。</p>}
    <LoadState loading={loading} empty={!loading && shown.length === 0 ? <><strong>回收站是空的</strong><span>删除的数字人、导演台作品和画布会出现在这里。</span></> : undefined}>
      <div className="account-trash">
        {shown.map(item => {
          const soon = item.daysLeft != null && item.daysLeft <= 3;
          return <article key={`${item.kind}:${item.id}`} className="account-trash-item">
            <div className="account-trash-thumb" style={{ background: GRADIENT[item.kind] }}>
              {item.imageUrl && <img src={item.imageUrl} alt="" />}
              {item.daysLeft != null && <span className="account-tag" style={soon ? { color: "var(--ip-error)" } : undefined}>{soon && <Clock size={11} aria-hidden="true" />}还剩 {item.daysLeft} 天</span>}
              <span className="account-trash-kind">{KIND_LABEL[item.kind]}</span>
            </div>
            <div><strong title={item.name} style={{ display: "block" }}>{item.name}</strong><small>{item.sub}{item.deletedAt ? ` · ${formatDateTime(item.deletedAt)} 删除` : ""}</small></div>
            <div className="account-trash-actions">
              <button type="button" className="account-button" disabled={busy === item.id} onClick={() => void restore(item)}>{busy === item.id ? "处理中…" : "恢复"}</button>
              <button type="button" className="account-button is-danger" disabled={!!busy} onClick={() => setPurge(item)}>彻底删除</button>
            </div>
          </article>;
        })}
      </div>
    </LoadState>
    <Modal open={!!purge} title={purge ? `彻底删除「${purge.name}」？` : ""} onCancel={() => setPurge(undefined)} width={400}
      footer={<div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="account-button" onClick={() => setPurge(undefined)}>取消</button>
        <button type="button" className="account-button is-danger-solid" disabled={!!busy} onClick={() => void confirmPurge()}>{busy ? "删除中…" : "彻底删除"}</button>
      </div>}>
      <p className="account-muted">{purgeText}</p>
    </Modal>
  </>;
}
