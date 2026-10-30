"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, FileImage, Loader2, PanelLeftClose, PanelLeftOpen, Pencil } from "lucide-react";
import type { IpProjectSummary, StudioSceneMedia, StudioSceneOptionGroup } from "@ai-star-eco/types";
import { formatDateTime } from "@/lib/datetime";
import { sceneCover } from "./scene-catalog";

/**
 * 场景封面：运营在后台传了就用传的，没传用随包的封面图（按编号），都没有时退回一块带首字的色块，不出现裂图。
 */
export function SceneThumb({ id, title, cover, size = 44 }: { id: string; title: string; cover?: string | null; size?: number }) {
  // 记的是「哪一张」失败了：同一个位置换场景时，新场景的图照样去加载。
  // 「自由出图」没有固定画面（运营没传封面时），直接用色块，不去请求一张不存在的图。
  const src = cover || sceneCover(id);
  const [failed, setFailed] = useState<string>();
  const empty = (!cover && id === "free") || failed === src;
  return <span className="scene-thumb" style={{ width: size, height: size }} aria-hidden="true">
    {empty ? <b>{title.slice(0, 1)}</b> : <img key={src} src={src} alt="" loading="lazy" onError={() => setFailed(src)}/>}
  </span>;
}

export type SceneListItem = { id: string; title: string; description: string; coverUrl?: string | null };

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
    <SceneThumb id={s.id} title={s.title} cover={s.coverUrl}/><span><strong>{s.title}</strong><small>{s.description}</small></span>
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
export function SceneEmpty({ title, note, covers }: { title: string; note: ReactNode; covers: { id: string; title: string; coverUrl?: string | null }[] }) {
  return <div className="scene-empty">
    <h2>{title}</h2><p>{note}</p>
    <div className="scene-empty-collage" aria-hidden="true">{covers.slice(0, 3).map((c, i) => <span key={c.id} className={`is-${i}`}><SceneThumb id={c.id} title={c.title} cover={c.coverUrl} size={i === 1 ? 220 : 168}/></span>)}</div>
  </div>;
}

/**
 * 选了场景时结果区先给看「这个场景做出来大概什么样」：运营传了参考示例就轮播示例（图或视频），没传就放封面。
 * 都是示意，不是用户的作品。
 */
export function SceneExample({ id, title, note, cover, examples, children }: {
  id: string; title: string; note: ReactNode; cover?: string | null; examples?: StudioSceneMedia[] | null; children?: ReactNode;
}) {
  const list = examples ?? [];
  const [index, setIndex] = useState(0);
  const shown = list[Math.min(index, list.length - 1)];
  return <div className="scene-empty scene-example">
    <h2>{title}</h2><p>{note}</p>
    {shown ? <span className="scene-example-media">{shown.mediaType === "video"
        ? <video key={shown.url} src={shown.url} muted loop autoPlay playsInline controls aria-label={`${title}示例`}/>
        : <img key={shown.url} src={shown.url} alt={`${title}示例`}/>}</span>
      : <span className="scene-example-image"><SceneThumb id={id} title={title} cover={cover} size={320}/></span>}
    {list.length > 1 && <div className="scene-example-dots" role="group" aria-label="切换示例">{list.map((m, i) =>
      <button key={m.url} type="button" aria-label={`查看示例 ${i + 1}`} aria-current={i === index ? "true" : undefined} onClick={() => setIndex(i)}/>)}</div>}
    <small>示意，不是你的作品</small>
    {children}
  </div>;
}

export function SceneNoModel({ kind }: { kind: "图片" | "视频" }) {
  return <p className="scene-note" role="status"><FileImage size={15} aria-hidden="true"/>后台还没有配置可用的{kind}模型，暂时不能生成。请联系管理员在「AI 模型」里开通。</p>;
}

/** 拼话被拒（缺图、缺那句话）是给用户的提示，不是故障：去掉追查号再就地显示，追查号留给悬停提示。 */
export function sceneHintText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message.replace(/ · 追查号 \S+$/, "") : fallback;
}

/**
 * 失败原因说人话：模型那边限流、排满时，厂商原话（「实名认证以获取更高 rpm」「video queue is full」之类）对老板没有意义，
 * 原话和追查号留在悬停提示里；其余原因去掉追查号再显示。
 */
export function sceneFailureText(code?: string, details?: string, thing = "图"): string {
  if (code && /_429$|RATE_LIMIT|TOO_MANY/.test(code)) return `模型那边请求太多，稍等一分钟再点「重新生成」；没出来的${thing}不扣积分`;
  if (code && /QUEUE_FULL/.test(code)) return `模型那边正在排满，过几分钟再点「重新生成」；没出来的${thing}不扣积分`;
  return details?.replace(/ · 追查号 \S+$/, "") || `生成失败，没出来的${thing}不扣积分`;
}

/**
 * 场景的选项组（照参考站）：一组组点选，不用写字。没选的组用默认值；选中项那句话由服务端拼进描述 / 要求。
 * 只报「哪组选了哪个」，由页面按函数更新合并：连着点两组时，后一次不能拿渲染时的旧值把前一次盖掉。
 */
export function SceneOptions({ groups, value, onPick }: {
  groups?: StudioSceneOptionGroup[] | null; value: Record<string, string>; onPick: (key: string, choice: string) => void;
}) {
  if (!groups?.length) return null;
  return <div className="scene-options">{groups.map(g => <div key={g.key} className="scene-option-group" role="group" aria-label={g.label}>
    <span>{g.label}</span>
    {g.choices.map(c => <button key={c.value} type="button" aria-pressed={(value[g.key] ?? g.defaultValue) === c.value} title={c.prompt}
      onClick={() => onPick(g.key, c.value)}>{c.label}</button>)}
  </div>)}</div>;
}

/** 交给拼话接口的选项：每组都给（没选的取默认值），没有选项组的场景不带。 */
export function sceneOptionValues(groups: StudioSceneOptionGroup[] | null | undefined, value: Record<string, string>): Record<string, string> | undefined {
  if (!groups?.length) return undefined;
  return Object.fromEntries(groups.map(g => [g.key, value[g.key] ?? g.defaultValue]));
}
