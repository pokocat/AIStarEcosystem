"use client";

import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Download, FileImage, Loader2, PanelLeftClose, PanelLeftOpen, Pencil, X } from "lucide-react";
import { dialogFocus } from "../dialog-focus";
import { StudioErrorNotice } from "../studio-errors";
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
  /** 把当前场景滚到看得见的地方（只滚列表自己，不动整页）。 */
  const reveal = useCallback(() => {
    const list = body.current, picked = list?.querySelector<HTMLElement>('button[aria-current="true"]');
    if (!list || !picked) return;
    const box = list.getBoundingClientRect(), at = picked.getBoundingClientRect();
    if (at.top < box.top || at.bottom > box.bottom) list.scrollTop += at.top - box.top - 48;
    if (at.left < box.left || at.right > box.right) list.scrollLeft += at.left - box.left - 24;
  }, []);
  // 从首页卡片直达某个场景、或换了场景时滚过去。
  useEffect(reveal, [current, collapsed, reveal]);
  // 手机上列表是横着一排，划走之后靠标题旁的「当前」按钮找回来（2026-10-30 复测）。
  const currentTitle = [top, ...groups.flatMap(g => g.items)].find(s => s?.id === current)?.title;
  const item = (s: SceneListItem) => <li key={s.id}><button type="button" aria-current={s.id === current ? "true" : undefined} onClick={() => onPick(s.id)} aria-label={s.title} title={s.description}>
    <SceneThumb id={s.id} title={s.title} cover={s.coverUrl}/><span><strong>{s.title}</strong><small>{s.description}</small></span>
  </button></li>;
  return <aside className={`scene-list${collapsed ? " is-collapsed" : ""}`} aria-label={`${heading}场景`}>
    <header><h1>{heading}</h1>{currentTitle && <button type="button" className="scene-list-current" onClick={reveal} aria-label={`回到当前场景：${currentTitle}`}>当前：{currentTitle}</button>}<button type="button" className="scene-icon-button" aria-label={collapsed ? "展开场景列表" : "收起场景列表"} onClick={() => setCollapsed(v => !v)}>{collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button></header>
    {!collapsed && <div className="scene-list-body" ref={body}>
      {top && <ul className="scene-list-top">{item(top)}</ul>}
      {groups.map(g => <section key={g.id}><h2>{g.title}</h2><ul>{g.items.map(item)}</ul></section>)}
    </div>}
  </aside>;
}

/**
 * 场景页就地展开的设置面板（图片设置、视频规格）。焦点只在打开那一下进当前选中项：
 * 关闭函数每次渲染都是新的，放进依赖会让每点一个选项就重新聚焦一次（2026-10-30 线上复核：选 4 张后焦点跳回 3:4）。
 * 点面板外关闭；Esc 关闭并把焦点还给打开它的按钮（同一个宿主里带 aria-expanded 的那个）。
 */
export function useScenePopover(panel: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    const host = panel.current?.parentElement;
    const trigger = host?.querySelector<HTMLElement>("[aria-expanded]");
    const away = (e: PointerEvent) => { if (e.target instanceof Node && !host?.contains(e.target)) close.current(); };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const active = document.activeElement;
      const ours = !active || active === document.body || !!host?.contains(active);
      close.current();
      if (ours) trigger?.focus();
    };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", escape);
    panel.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", escape); };
  }, [panel]);
}

export type SceneTab = "results" | "example";
/** 结果区的「生成结果 / 参考示例」：方向键、Home、End 在两个标签间移动并切换，只有当前标签在 Tab 顺序里。 */
export function SceneResultTabs({ tab, onTab, count, idBase }: { tab: SceneTab; onTab: (tab: SceneTab) => void; count: number; idBase: string }) {
  const tabs: [SceneTab, ReactNode][] = [["results", <>生成结果{count ? <small>{count}</small> : null}</>], ["example", "参考示例"]];
  const move = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const at = tabs.findIndex(([t]) => t === tab);
    const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? (at + 1) % tabs.length : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (at + tabs.length - 1) % tabs.length
      : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onTab(tabs[next][0]);
    e.currentTarget.querySelector<HTMLElement>(`#${idBase}-tab-${tabs[next][0]}`)?.focus();
  };
  return <div className="scene-tabs" role="tablist" aria-label="结果与示例" onKeyDown={move}>
    {tabs.map(([t, label]) => <button key={t} id={`${idBase}-tab-${t}`} type="button" role="tab" aria-selected={tab === t} aria-controls={`${idBase}-panel`}
      tabIndex={tab === t ? 0 : -1} onClick={() => onTab(t)}>{label}</button>)}
  </div>;
}

/** 右栏「最近」：本页建过的草稿（就是普通画布），点开接着做。 */
export function SceneRecent({ drafts, loading, error, onRetry, current, onOpen, allHref = "/projects" }: {
  drafts: IpProjectSummary[]; loading: boolean; error?: string; onRetry?: () => void; current?: string; onOpen: (id: string) => void; allHref?: string;
}) {
  // 读失败不能显示成「做过的会出现在这里」：用户会以为草稿没了（2026-10-30 线上复核）。
  const failed = !loading && !!error;
  return <aside className="scene-recent" aria-label="最近的草稿">
    <header><Link href={allHref}>最近<ChevronRight size={15}/></Link></header>
    {failed && <div className="scene-recent-empty is-error" role="alert"><span>{drafts.length ? "没读到最新的草稿" : "最近的草稿没读到"}</span>
      {onRetry && <button type="button" onClick={onRetry}>重试</button>}<StudioErrorNotice error={error} label="详情"/></div>}
    {loading && !drafts.length ? <p className="scene-recent-empty"><Loader2 size={15} className="studio-gallery-spinner"/>正在读取</p>
      : failed && !drafts.length ? null
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

/**
 * 看大图（2026-10-30 复测：Esc 关不掉，Tab 会跑到后面的页面上）。
 * 打开时焦点进来、Tab 在里面循环、关掉还给原来的按钮（dialogFocus，和导演台同一份）；Esc 和点暗处都关。
 */
export function SceneViewer({ url, name, onDownload, onClose }: { url: string; name: string; onDownload: () => void; onClose: () => void }) {
  useEffect(() => {
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);
  return <div className="scene-viewer" role="dialog" aria-modal="true" aria-label="查看大图" ref={dialogFocus} tabIndex={-1} onClick={onClose}>
    <img src={url} alt={name} onClick={e => e.stopPropagation()}/>
    <div onClick={e => e.stopPropagation()}>
      <button type="button" onClick={onDownload}><Download size={16}/>下载</button>
      <button type="button" onClick={onClose}><X size={16}/>关闭</button>
    </div>
  </div>;
}
