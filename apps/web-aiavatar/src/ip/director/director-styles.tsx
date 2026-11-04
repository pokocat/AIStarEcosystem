"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { dialogFocus } from "./director-shared";

export const DEFAULT_STYLE = "真人写实";

type DirectorStyle = { id: string; label: string; style: string; note: string; group: "真人" | "动画" };

/**
 * 画面风格（2026-11-04）。style 是进提示词的那段字（{{style}}风格的…），最多 30 字；
 * 真人类要带「写实 / 电影 / 影视」这些词，服务端按它决定要不要写皮肤质感（DirectorPrompts.liveAction）。
 * 样图（public/studio/director-styles/，id.webp 是小图，id-large.webp 是大图）由 Codex 生图按同一主体生成，方便比较风格；
 * 用户实际出图用作品选的图片模型，效果会有差别。
 */
export const DIRECTOR_STYLES: DirectorStyle[] = [
  { id: "realistic", label: "真人写实", style: "真人写实", note: "自然光，皮肤和衣料都像真实拍摄。", group: "真人" },
  { id: "cinematic", label: "电影质感", style: "电影质感写实", note: "颜色收敛，背景虚化，有明确的主光方向。", group: "真人" },
  { id: "hk-retro", label: "复古港片", style: "复古港片写实", note: "胶片颗粒，霓虹暖色，略带柔焦。", group: "真人" },
  { id: "costume", label: "古装影视", style: "古装影视写实", note: "古装剧的服饰、街景和布光。", group: "真人" },
  { id: "urban-neon", label: "都市霓虹", style: "都市夜景霓虹电影写实", note: "雨夜街头，蓝紫和粉色灯光映在地面。", group: "真人" },
  { id: "cn-3d", label: "国风三维", style: "国风三维动画", note: "三维动画质感，国风服饰和场景。", group: "动画" },
  { id: "anime", label: "日系动画", style: "日系二次元动画", note: "干净的线条和平涂色块，颜色明亮。", group: "动画" },
  { id: "comic", label: "国漫厚涂", style: "国漫厚涂漫画", note: "笔触明显，明暗对比强。", group: "动画" },
  { id: "ink", label: "水墨国风", style: "水墨国风插画", note: "墨色晕染，大量留白，只点淡彩。", group: "动画" },
  { id: "clay", label: "黏土定格", style: "黏土定格动画", note: "手工黏土偶和微缩布景。", group: "动画" },
  { id: "picture-book", label: "手绘绘本", style: "手绘绘本插画", note: "水彩彩铅，有纸张纹理，柔和温暖。", group: "动画" },
  { id: "cyber", label: "赛博朋克", style: "赛博朋克动画", note: "青色和品红高对比，有机械和全息光效。", group: "动画" },
];

const thumbOf = (id: string) => `/studio/director-styles/${id}.webp`;
const largeOf = (id: string) => `/studio/director-styles/${id}-large.webp`;
const HOVER_W = 288, HOVER_H = 216, HOVER_GAP = 8, MENU_W = 348, MENU_H = 212;

/**
 * 表单里只占一行：当前风格的名字。点开是一小块文字标签，指针停留或键盘聚焦时在旁边放大样图，
 * 点击弹出大图，确认后才换风格。手机没有悬停，点一下直接看大图。
 */
export function StyleField({ value, onChange, disabled, note }: { value: string; onChange: (style: string) => void; disabled?: boolean; note?: string }) {
  const preset = DIRECTOR_STYLES.find(s => s.style === value);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number }>();
  const [hover, setHover] = useState<{ style: DirectorStyle; left: number; top: number }>();
  const [previewing, setPreviewing] = useState<DirectorStyle>();
  const open = !!place;
  const close = () => { setPlace(undefined); setHover(undefined); trigger.current?.focus(); };
  const toggle = () => {
    if (open || !trigger.current) return close();
    const r = trigger.current.getBoundingClientRect();
    const below = r.bottom + 6;
    setPlace({ left: Math.max(8, Math.min(r.left, window.innerWidth - MENU_W - 8)), top: below + MENU_H <= window.innerHeight - 8 ? below : Math.max(8, r.top - MENU_H - 6) });
  };
  // 点外面关掉；Esc 一次只关最上面一层（捕获阶段截住，底下的弹窗收不到）。
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (previewing || !(e.target instanceof Node) || menu.current?.contains(e.target) || trigger.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      if (previewing) setPreviewing(undefined); else close();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey, true); };
  }, [open, previewing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) menu.current?.querySelector<HTMLElement>('[aria-pressed="true"], button')?.focus(); }, [open]);
  const showHover = (style: DirectorStyle, el: HTMLElement) => {
    const r = menu.current?.getBoundingClientRect() ?? el.getBoundingClientRect();
    const right = r.right + HOVER_GAP;
    const top = Math.max(8, Math.min(el.getBoundingClientRect().top - 40, window.innerHeight - HOVER_H - 8));
    setHover({ style, top, left: right + HOVER_W <= window.innerWidth - 8 ? right : Math.max(8, r.left - HOVER_W - HOVER_GAP) });
  };
  const chips = (group: DirectorStyle["group"]) => <div className="director-style-chips" role="group" aria-label={group}>
    <small>{group}</small>
    {DIRECTOR_STYLES.filter(s => s.group === group).map(s => <button key={s.id} type="button" className="director-style-chip" aria-pressed={s.style === value} title={s.note}
      onMouseEnter={e => showHover(s, e.currentTarget)} onMouseLeave={() => setHover(undefined)} onFocus={e => showHover(s, e.currentTarget)} onBlur={() => setHover(undefined)}
      onClick={() => { setHover(undefined); setPreviewing(s); }}>{s.label}</button>)}
  </div>;
  return <div className="director-field director-style-field"><span>画面风格</span>
    <button type="button" ref={trigger} className="director-style-trigger" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
      {preset && <img src={thumbOf(preset.id)} alt="" width={22} height={22}/>}
      <b title={value}>{preset?.label ?? (value ? `自定义：${value}` : "请选择")}</b>
      <ChevronDown size={14}/>
    </button>
    {note && <small>{note}</small>}
    {place && <div ref={menu} className="director-style-menu" role="dialog" aria-label="选择画面风格" style={{ left: place.left, top: place.top, width: MENU_W }}>
      {chips("真人")}
      {chips("动画")}
      <input aria-label="自定义风格" value={preset ? "" : value} maxLength={30} placeholder="或者自己写，例如：九十年代文艺片写实" onChange={e => onChange(e.target.value)}/>
    </div>}
    {hover && <div className="director-style-hover" aria-hidden style={{ left: hover.left, top: hover.top, width: HOVER_W, height: HOVER_H }}><img src={largeOf(hover.style.id)} alt=""/></div>}
    {previewing && <StylePreview style={previewing} current={previewing.style === value} onClose={() => setPreviewing(undefined)}
      onUse={() => { onChange(previewing.style); setPreviewing(undefined); close(); }}/>}
  </div>;
}

function StylePreview({ style, current, onClose, onUse }: { style: DirectorStyle; current: boolean; onClose: () => void; onUse: () => void }) {
  return <div className="director-dialog-backdrop director-style-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="director-dialog director-style-preview" role="dialog" aria-modal="true" aria-labelledby="director-style-preview-title" ref={dialogFocus} tabIndex={-1}>
      <header><h2 id="director-style-preview-title">{style.label}</h2><button type="button" aria-label="关闭" onClick={onClose}><X size={18}/></button></header>
      <img src={largeOf(style.id)} alt={`${style.label}风格的样图`}/>
      <p className="director-dialog-note">{style.note}样图由 AI 生成，实际效果还取决于所选的图片和视频模型。</p>
      <footer><button type="button" className="ip-brand-secondary" onClick={onClose}>取消</button>
        <button type="button" className="ip-brand-button" disabled={current} onClick={onUse}>{current ? "正在使用" : "使用这个风格"}</button></footer>
    </div>
  </div>;
}
