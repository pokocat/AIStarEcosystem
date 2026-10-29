"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, FileImage, Loader2, PanelLeftClose, PanelLeftOpen, Pencil } from "lucide-react";
import type { IpProjectSummary } from "@ai-star-eco/types";
import { formatDateTime } from "@/lib/datetime";
import { sceneCover } from "./scene-catalog";

/** 场景封面；图没到（或加载失败）时退回一块带首字的色块，不出现裂图。 */
export function SceneThumb({ id, title, size = 44 }: { id: string; title: string; size?: number }) {
  // 记的是「哪一张」失败了：同一个位置换场景时，新场景的图照样去加载。
  // 「自由出图」没有固定画面，直接用色块，不去请求一张不存在的图。
  const [failedId, setFailedId] = useState<string>();
  const failed = id === "free" || failedId === id;
  return <span className="scene-thumb" style={{ width: size, height: size }} aria-hidden="true">
    {failed ? <b>{title.slice(0, 1)}</b> : <img key={id} src={sceneCover(id)} alt="" loading="lazy" onError={() => setFailedId(id)}/>}
  </span>;
}

export type SceneListItem = { id: string; title: string; description: string };

/** 左栏：按分组列出场景，点一下换场景。 */
export function SceneList({ heading, groups, current, onPick, top }: {
  heading: string; current: string; onPick: (id: string) => void; top?: SceneListItem;
  groups: { id: string; title: string; items: SceneListItem[] }[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  // 从首页卡片直达某个场景时，列表里把它滚到看得见的地方（只滚列表自己，不动整页）。
  useEffect(() => {
    const list = body.current, picked = list?.querySelector<HTMLElement>('button[aria-current="true"]');
    if (!list || !picked) return;
    const box = list.getBoundingClientRect(), at = picked.getBoundingClientRect();
    if (at.top < box.top || at.bottom > box.bottom) list.scrollTop += at.top - box.top - 48;
    if (at.left < box.left || at.right > box.right) list.scrollLeft += at.left - box.left - 24;
  }, [current, collapsed]);
  const item = (s: SceneListItem) => <li key={s.id}><button type="button" aria-current={s.id === current ? "true" : undefined} onClick={() => onPick(s.id)} aria-label={s.title} title={s.description}>
    <SceneThumb id={s.id} title={s.title}/><span><strong>{s.title}</strong><small>{s.description}</small></span>
  </button></li>;
  return <aside className={`scene-list${collapsed ? " is-collapsed" : ""}`} aria-label={`${heading}场景`}>
    <header><h1>{heading}</h1><button type="button" className="scene-icon-button" aria-label={collapsed ? "展开场景列表" : "收起场景列表"} onClick={() => setCollapsed(v => !v)}>{collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button></header>
    {!collapsed && <div className="scene-list-body" ref={body}>
      {top && <ul className="scene-list-top">{item(top)}</ul>}
      {groups.map(g => <section key={g.id}><h2>{g.title}</h2><ul>{g.items.map(item)}</ul></section>)}
    </div>}
  </aside>;
}

/** 右栏「最近」：本页建过的草稿（就是普通画布），点开接着做。 */
export function SceneRecent({ drafts, loading, current, onOpen, allHref = "/projects" }: {
  drafts: IpProjectSummary[]; loading: boolean; current?: string; onOpen: (id: string) => void; allHref?: string;
}) {
  return <aside className="scene-recent" aria-label="最近的草稿">
    <header><Link href={allHref}>最近<ChevronRight size={15}/></Link></header>
    {loading && !drafts.length ? <p className="scene-recent-empty"><Loader2 size={15} className="studio-gallery-spinner"/>正在读取</p>
      : drafts.length ? <ul>{drafts.slice(0, 12).map(d => <li key={d.id}><button type="button" aria-current={d.id === current ? "true" : undefined} onClick={() => onOpen(d.id)} title={d.name}>
        <span className="scene-recent-cover">{d.coverUrl ? <img src={d.coverUrl} alt="" loading="lazy"/> : <Pencil size={20} aria-hidden="true"/>}</span>
        <span><strong>{d.name.replace(/ · AI (图片|视频)$/, "")}</strong><small>{formatDateTime(d.updatedAt)}</small></span>
      </button></li>)}</ul>
      : <p className="scene-recent-empty">做过的会出现在这里</p>}
  </aside>;
}

/** 结果区空着的时候：讲清这一页能做什么，配几张场景图。 */
export function SceneEmpty({ title, note, covers }: { title: string; note: ReactNode; covers: { id: string; title: string }[] }) {
  return <div className="scene-empty">
    <h2>{title}</h2><p>{note}</p>
    <div className="scene-empty-collage" aria-hidden="true">{covers.slice(0, 3).map((c, i) => <span key={c.id} className={`is-${i}`}><SceneThumb id={c.id} title={c.title} size={i === 1 ? 220 : 168}/></span>)}</div>
  </div>;
}

export function SceneNoModel({ kind }: { kind: "图片" | "视频" }) {
  return <p className="scene-note" role="status"><FileImage size={15} aria-hidden="true"/>后台还没有配置可用的{kind}模型，暂时不能生成。请联系管理员在「AI 模型」里开通。</p>;
}
