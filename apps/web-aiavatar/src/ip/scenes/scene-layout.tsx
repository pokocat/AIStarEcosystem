"use client";

import { SignedImage } from "@/canvas-bridge/signed-image";
import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Download, FileImage, History, Loader2, PanelLeft, Pencil, Pin, PinOff, X } from "lucide-react";
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

/** 是不是手机形态：读 `<html data-layout>`（CSS 和 JS 用同一个真值，见 shell/layout-mode.ts）。 */
export function useSceneMobile() {
  return useSyncExternalStore(change => {
    const watch = new MutationObserver(change);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-layout"] });
    return () => watch.disconnect();
  }, () => document.documentElement.getAttribute("data-layout") !== "desktop", () => false);
}

export type SceneListItem = { id: string; title: string; description: string; coverUrl?: string | null };
export type SceneGroup = { id: string; title: string; items: SceneListItem[] };

const PIN_KEY = (kind: string) => `aiavatar_scene_drawer_pinned:${kind}`;
/** 全部场景边栏固定在侧边：每个浏览器记一份（只是界面偏好，读写失败当没固定）。 */
export function useSceneDrawerPin(kind: "image" | "video") {
  const [pinned, setPinned] = useState(false);
  useEffect(() => { try { setPinned(window.localStorage.getItem(PIN_KEY(kind)) === "1"); } catch { /* 隐私模式读不到就不固定 */ } }, [kind]);
  const pin = useCallback((on: boolean) => {
    setPinned(on);
    try { if (on) window.localStorage.setItem(PIN_KEY(kind), "1"); else window.localStorage.removeItem(PIN_KEY(kind)); } catch { /* 存不下只影响这一页 */ }
  }, [kind]);
  return [pinned, pin] as const;
}

/**
 * 场景名就是切换按钮（设计稿「点场景名快速切换」）：点开就地换同一组里的场景，分组胶囊换组；
 * 「全部场景」打开边栏。焦点进当前组，Esc 关闭并还给场景名。
 */
export function SceneSwitch({ scene, groups, top, onPick, onAll }: {
  scene: SceneListItem; groups: SceneGroup[]; top?: SceneListItem; onPick: (id: string) => void; onAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const own = groups.find(g => g.items.some(s => s.id === scene.id))?.id ?? groups[0]?.id;
  const [group, setGroup] = useState(own);
  useEffect(() => { if (!open) setGroup(own); }, [open, own]);
  const items = groups.find(g => g.id === group)?.items ?? [];
  return <div className="scene-switch">
    <button type="button" className="scene-switch-button" aria-haspopup="dialog" aria-expanded={open} aria-label={`换场景，当前：${scene.title}`} title="换场景" onClick={() => setOpen(v => !v)}>
      <SceneThumb id={scene.id} title={scene.title} cover={scene.coverUrl} size={40}/>
      <span><strong>{scene.title}<ChevronDown size={14} strokeWidth={1.6}/></strong><small>{scene.description}</small></span>
    </button>
    {open && <SwitchPanel onClose={() => setOpen(false)}>
      <div className="scene-switch-groups" role="group" aria-label="场景分组">
        {top && <button type="button" aria-pressed={false} onClick={() => { setOpen(false); onPick(top.id); }}>{top.title}</button>}
        {groups.map(g => <button key={g.id} type="button" aria-pressed={g.id === group} onClick={() => setGroup(g.id)}>{g.title}</button>)}
      </div>
      <ul className="scene-switch-grid">{items.map(s => <li key={s.id}><button type="button" aria-current={s.id === scene.id ? "true" : undefined} title={s.description}
        onClick={() => { setOpen(false); onPick(s.id); }}>
        <SceneThumb id={s.id} title={s.title} cover={s.coverUrl} size={88}/><span>{s.title}{s.id === scene.id && <Check size={11} strokeWidth={2}/>}</span></button></li>)}</ul>
      <footer><button type="button" onClick={() => { setOpen(false); onAll(); }}><PanelLeft size={14} strokeWidth={1.4}/>全部场景</button></footer>
    </SwitchPanel>}
  </div>;
}
function SwitchPanel({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useScenePopover(panel, onClose);
  return <div ref={panel} className="scene-switch-panel" role="dialog" aria-label="换场景">{children}</div>;
}

/**
 * 全部场景（设计稿「全部场景边栏」）：悬浮在导航旁边，可以固定成页面的第一列。按分组列出场景，点一下换。
 * 悬浮时点外面、按 Esc 关；固定后一直在，取消固定回到悬浮。
 */
export function SceneDrawer({ heading, groups, top, current, onPick, pinned, onPin, onClose }: {
  heading: string; groups: SceneGroup[]; top?: SceneListItem; current: string; onPick: (id: string) => void;
  pinned: boolean; onPin: (on: boolean) => void; onClose: () => void;
}) {
  const box = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    if (pinned) return;
    const away = (e: PointerEvent) => {
      const t = e.target;
      if (t instanceof Element && (box.current?.contains(t) || t.closest(".scene-switch"))) return;
      close.current();
    };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", escape);
    box.current?.querySelector<HTMLElement>('button[aria-current="true"]')?.focus({ preventScroll: true });
    box.current?.querySelector<HTMLElement>('button[aria-current="true"]')?.scrollIntoView?.({ block: "center" });
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", escape); };
  }, [pinned]);
  const item = (s: SceneListItem) => <li key={s.id}><button type="button" aria-current={s.id === current ? "true" : undefined} title={s.description}
    onClick={() => { onPick(s.id); if (!pinned) onClose(); }}>
    <SceneThumb id={s.id} title={s.title} cover={s.coverUrl} size={36}/><span><strong>{s.title}</strong><small>{s.description}</small></span></button></li>;
  return <aside ref={box} className={`scene-drawer${pinned ? " is-pinned" : ""}`} aria-label={`${heading}场景`} role={pinned ? undefined : "dialog"}>
    <header><h2>全部场景</h2>
      <button type="button" className="scene-icon-button is-pin" aria-pressed={pinned} aria-label={pinned ? "取消固定" : "固定在侧边"} title={pinned ? "取消固定" : "固定在侧边"} onClick={() => onPin(!pinned)}>
        {pinned ? <PinOff size={16} strokeWidth={1.4}/> : <Pin size={16} strokeWidth={1.4}/>}</button>
      {!pinned && <button type="button" className="scene-icon-button" aria-label="关闭" onClick={onClose}><X size={16} strokeWidth={1.4}/></button>}
    </header>
    <div className="scene-drawer-body">
      {top && <ul>{item(top)}</ul>}
      {groups.map(g => <section key={g.id}><h3>{g.title}</h3><ul>{g.items.map(item)}</ul></section>)}
    </div>
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
/** 结果区的「作品 / 示例」：方向键、Home、End 在两个标签间移动并切换，只有当前标签在 Tab 顺序里。 */
export function SceneResultTabs({ tab, onTab, count, idBase }: { tab: SceneTab; onTab: (tab: SceneTab) => void; count: number; idBase: string }) {
  const tabs: [SceneTab, ReactNode][] = [["results", <>作品{count ? <small>{count}</small> : null}</>], ["example", "示例"]];
  const move = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const at = tabs.findIndex(([t]) => t === tab);
    const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? (at + 1) % tabs.length : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (at + tabs.length - 1) % tabs.length
      : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onTab(tabs[next][0]);
    e.currentTarget.querySelector<HTMLElement>(`#${idBase}-tab-${tabs[next][0]}`)?.focus();
  };
  return <div className="scene-tabs" role="tablist" aria-label="作品与示例" onKeyDown={move}>
    {tabs.map(([t, label]) => <button key={t} id={`${idBase}-tab-${t}`} type="button" role="tab" aria-selected={tab === t} aria-controls={`${idBase}-panel`}
      tabIndex={tab === t ? 0 : -1} onClick={() => onTab(t)}>{label}</button>)}
  </div>;
}

/** 「最近」：本页建过的草稿（就是普通画布），点开接着做。按钮在结果区右上角，列表就地弹出。 */
export function SceneRecent({ drafts, loading, error, onRetry, current, onOpen, allHref = "/projects", icon = false }: {
  drafts: IpProjectSummary[]; loading: boolean; error?: string; onRetry?: () => void; current?: string; onOpen: (id: string) => void; allHref?: string;
  /** 手机标题栏上只放图标。 */
  icon?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // 读失败不能显示成「做过的会出现在这里」：用户会以为草稿没了（2026-10-30 线上复核）。
  const failed = !loading && !!error;
  return <div className="scene-recent-host">
    <button type="button" className={icon ? "scene-icon-button is-large" : "scene-text-button"} aria-haspopup="dialog" aria-expanded={open} aria-label={icon ? "最近" : undefined}
      onClick={() => setOpen(v => !v)}><History size={icon ? 19 : 14} strokeWidth={1.4}/>{!icon && "最近"}</button>
    {open && <RecentPanel onClose={() => setOpen(false)}>
      <header><strong>最近</strong><Link href={allHref}>全部<ChevronRight size={13}/></Link></header>
      {failed && <div className="scene-recent-empty is-error" role="alert"><span>{drafts.length ? "没读到最新的草稿" : "最近的草稿没读到"}</span>
        {onRetry && <button type="button" onClick={onRetry}>重试</button>}<StudioErrorNotice error={error} label="详情"/></div>}
      {loading && !drafts.length ? <p className="scene-recent-empty"><Loader2 size={15} className="studio-gallery-spinner"/>正在读取</p>
        : failed && !drafts.length ? null
        : drafts.length ? <ul>{drafts.slice(0, 12).map(d => <li key={d.id}><button type="button" aria-current={d.id === current ? "true" : undefined} onClick={() => { setOpen(false); onOpen(d.id); }} title={d.name}>
          <span className="scene-recent-cover">{d.coverUrl ? <img src={d.coverUrl} alt="" loading="lazy"/> : <Pencil size={16} strokeWidth={1.4} aria-hidden="true"/>}</span>
          <span><strong>{d.name.replace(/ · AI (图片|视频)$/, "")}</strong><small>{formatDateTime(d.updatedAt)}</small></span>
        </button></li>)}</ul>
        : <p className="scene-recent-empty">做过的会出现在这里</p>}
    </RecentPanel>}
  </div>;
}
function RecentPanel({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useScenePopover(panel, onClose);
  return <div ref={panel} className="scene-recent" role="dialog" aria-label="最近的草稿">{children}</div>;
}

/** 作品还空着的时候：一句话说清楚，不放装饰。 */
export function SceneEmpty({ title, note }: { title: string; note: ReactNode }) {
  return <div className="scene-empty"><h2>{title}</h2><p>{note}</p></div>;
}

/** 场景的做法拆成几条（「开头…，中间…，结尾…」按逗号分号断开），只有一句时不拆。 */
export const sceneSteps = (structure?: string | null) => (structure ?? "").split(/[，；。]/).map(s => s.trim()).filter(Boolean);

/**
 * 示例：左边一张大图（运营传了参考示例就轮播示例，没传放封面），右边场景名、一句说明、做法几条。都是示意，不是用户的作品。
 */
export function SceneExample({ id, title, group, note, steps = [], cover, examples, ratio = "9:16" }: {
  id: string; title: string; group?: string; note: ReactNode; steps?: string[]; cover?: string | null; examples?: StudioSceneMedia[] | null; ratio?: string;
}) {
  const list = examples ?? [];
  const [index, setIndex] = useState(0);
  const shown = list[Math.min(index, list.length - 1)];
  const [w, h] = ratio.split(":").map(Number);
  const shape = !w || !h ? "is-tall" : w > h ? "is-wide" : w === h ? "is-square" : h / w > 1.5 ? "is-tall" : "is-portrait";
  return <div className={`scene-example ${shape}`}>
    <div className="scene-example-media" style={w && h ? { aspectRatio: `${w} / ${h}` } : undefined}>
      {shown ? shown.mediaType === "video"
          ? <video key={shown.url} src={shown.url} muted loop autoPlay playsInline controls aria-label={`${title}示例`}/>
          : <img key={shown.url} src={shown.url} alt={`${title}示例`}/>
        : <SceneThumb id={id} title={title} cover={cover} size={320}/>}
      <span className="scene-example-tag">示例</span>
      {list.length > 1 && <div className="scene-example-dots" role="group" aria-label="切换示例">{list.map((m, i) =>
        <button key={m.url} type="button" aria-label={`查看示例 ${i + 1}`} aria-current={i === index ? "true" : undefined} onClick={() => setIndex(i)}/>)}</div>}
    </div>
    <div className="scene-example-copy">
      {group && <span className="scene-example-group">{group}</span>}
      <h2>{title}</h2>
      <p>{note}</p>
      {steps.length > 1 && <ol>{steps.map((step, i) => <li key={i}><span>{String(i + 1).padStart(2, "0")}</span>{step}</li>)}</ol>}
    </div>
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
export function SceneViewer({ url, storageKey, name, onDownload, onClose, actions }: {
  url: string; storageKey?: string; name: string; onDownload: () => void; onClose: () => void;
  /** 这张图接着做什么（当参考图、做成视频）：放在下载前面。 */
  actions?: ReactNode;
}) {
  useEffect(() => {
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);
  return <div className="scene-viewer" role="dialog" aria-modal="true" aria-label="查看大图" ref={dialogFocus} tabIndex={-1} onClick={onClose}>
    <SignedImage src={url} storageKey={storageKey} alt={name} onClick={e => e.stopPropagation()}/>
    <div onClick={e => e.stopPropagation()}>
      {actions}
      <button type="button" onClick={onDownload}><Download size={16}/>下载</button>
      <button type="button" onClick={onClose}><X size={16}/>关闭</button>
    </div>
  </div>;
}

/** 画面比例的小方块（竖屏窄、横屏宽）。 */
export function RatioGlyph({ ratio }: { ratio: string }) {
  const [w, h] = ratio.split(":").map(Number);
  const k = 11 / Math.max(w || 1, h || 1);
  return <i className="scene-ratio-glyph" aria-hidden="true" style={{ width: Math.max(5, Math.round((w || 1) * k)), height: Math.max(5, Math.round((h || 1) * k)) }}/>;
}
