"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clapperboard, Loader2, Plus, RefreshCw, X } from "lucide-react";
import type { DirectorWorkSummary } from "@ai-star-eco/types";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { formatDateTime } from "@/lib/datetime";
import { DirectorApi } from "../api";
import { StudioPage } from "../studio-page";
import { GalleryState, useStudioList } from "../studio-gallery";
import { InlineError, errorText, useEscape, dialogFocus } from "./director-shared";

function progressText(w: DirectorWorkSummary) {
  if (!w.hasScript) return "待写剧本";
  if (w.episodeCount === 0) return "待拆分集";
  if (w.clipCount === 0) return `${w.episodeCount} 集 · ${w.assetCount} 个资产`;
  return `${w.episodeCount} 集 · 分镜图 ${w.boardCount}/${w.clipCount}`;
}

export function DirectorWorks() {
  const auth = useRequireAuth();
  const works = useStudioList(DirectorApi.listWorks, auth === "ok");
  const [creating, setCreating] = useState(false);
  if (auth === "no-platform" || works.notEnrolled) return <PlatformGateScreen/>;
  return <StudioPage title="AI 导演台" description="从创意到成片" className="director-page"
    actions={<button type="button" className="ip-brand-button" onClick={() => setCreating(true)}><Plus size={16}/>新建作品</button>}>
    {creating && <CreateWork onClose={() => setCreating(false)}/>}
    {auth !== "ok" || works.loading ? <GalleryState loading/> : works.error ? <GalleryState error={works.error} retry={works.reload}/> :
      works.data.length === 0 ? <div className="director-empty">
        <Clapperboard size={28}/>
        <h2>还没有作品</h2>
        <p>输入一句创意，AI 写剧本、拆分集、准备角色场景，生成分镜与片段视频。已有剧本可直接导入。</p>
        <button type="button" className="ip-brand-button" onClick={() => setCreating(true)}><Plus size={16}/>新建作品</button>
      </div> :
      <>
        <div className="director-list-toolbar"><span>{works.data.length} 部作品</span><button className="studio-page-refresh" aria-label="刷新" onClick={works.reload}><RefreshCw size={16}/></button></div>
        <div className="director-work-grid">{works.data.map(w => <Link key={w.id} href={`/director/${encodeURIComponent(w.id)}`} className="director-work-card">
          <div className="director-work-cover">{w.coverUrl ? <img src={w.coverUrl} alt=""/> : <Clapperboard size={26}/>}{w.running && <span className="director-work-badge"><Loader2 size={12} className="ip-loading-icon"/>制作中</span>}</div>
          <div className="director-work-copy"><h3 title={w.title}>{w.title}</h3><p>{progressText(w)}</p><small>{formatDateTime(w.updatedAt)}</small></div>
        </Link>)}</div>
      </>}
  </StudioPage>;
}

function CreateWork({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idea" | "script">("idea");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEscape(() => { if (!busy) onClose(); });
  const submit = async () => {
    if (busy || !text.trim()) return;
    setBusy(true); setError("");
    try {
      const work = await DirectorApi.createWork({ title: title.trim() || undefined, ...(mode === "idea" ? { idea: text.trim() } : { script: text }) });
      router.push(`/director/${encodeURIComponent(work.id)}`);
    } catch (e) { setError(errorText(e)); setBusy(false); }
  };
  return <div className="director-dialog-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && !busy && onClose()}>
    <div className="director-dialog" role="dialog" aria-modal="true" aria-labelledby="director-create-title" ref={dialogFocus} tabIndex={-1}>
      <header><h2 id="director-create-title">新建作品</h2><button type="button" aria-label="关闭" onClick={onClose} disabled={busy}><X size={18}/></button></header>
      <div className="director-segmented" role="tablist" aria-label="创建方式">
        <button type="button" role="tab" aria-selected={mode === "idea"} onClick={() => setMode("idea")}>从创意开始</button>
        <button type="button" role="tab" aria-selected={mode === "script"} onClick={() => setMode("script")}>导入剧本</button>
      </div>
      <label className="director-field"><span>作品名（选填）</span><input value={title} maxLength={60} onChange={e => setTitle(e.target.value)} placeholder="留空将根据内容命名"/></label>
      <label className="director-field"><span>{mode === "idea" ? "创意" : "剧本正文"}</span>
        <textarea autoFocus rows={mode === "idea" ? 5 : 12} value={text} maxLength={mode === "idea" ? 2000 : 60000} onChange={e => setText(e.target.value)}
          placeholder={mode === "idea" ? "例如：深夜的旧书店，店员林夏发现一封写给自己的红信封，门外传来敲门声。" : "支持场次、动作与对白，导入后可拆分为多集"}/>
      </label>
      <p className="director-dialog-note">{mode === "idea" ? "下一步：确认创意、看清所需积分，再由 AI 写剧本。" : "下一步：选择作为一集，或由 AI 拆分为多集。"}</p>
      <InlineError message={error}/>
      <footer><button type="button" className="ip-brand-secondary" onClick={onClose} disabled={busy}>取消</button>
        <button type="button" className="ip-brand-button" disabled={busy || !text.trim()} onClick={() => void submit()}>{busy ? <><Loader2 size={15} className="ip-loading-icon"/>创建中</> : "创建并继续"}</button></footer>
    </div>
  </div>;
}
