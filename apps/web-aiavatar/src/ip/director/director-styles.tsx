"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { dialogFocus, useEscape } from "./director-shared";

export const DEFAULT_STYLE = "真人写实";

/**
 * 画面风格卡（2026-11-04）。style 是进提示词的那段字（{{style}}风格的…），最多 30 字；
 * 真人类要带「写实 / 电影 / 影视」这些词，服务端按它决定要不要写皮肤质感（DirectorPrompts.liveAction）。
 * 样图是用同一段字真实出的图（public/studio/director-styles/），不是效果图。
 */
export const DIRECTOR_STYLES: { id: string; label: string; style: string; group: "真人" | "动画" }[] = [
  { id: "realistic", label: "真人写实", style: "真人写实", group: "真人" },
  { id: "cinematic", label: "电影质感", style: "电影质感写实", group: "真人" },
  { id: "hk-retro", label: "复古港片", style: "复古港片写实", group: "真人" },
  { id: "costume", label: "古装影视", style: "古装影视写实", group: "真人" },
  { id: "urban-neon", label: "都市霓虹", style: "都市夜景霓虹电影写实", group: "真人" },
  { id: "cn-3d", label: "国风三维", style: "国风三维动画", group: "动画" },
  { id: "anime", label: "日系动画", style: "日系二次元动画", group: "动画" },
  { id: "comic", label: "国漫厚涂", style: "国漫厚涂漫画", group: "动画" },
  { id: "ink", label: "水墨国风", style: "水墨国风插画", group: "动画" },
  { id: "clay", label: "黏土定格", style: "黏土定格动画", group: "动画" },
  { id: "picture-book", label: "手绘绘本", style: "手绘绘本插画", group: "动画" },
  { id: "cyber", label: "赛博朋克", style: "赛博朋克动画", group: "动画" },
];

const imageOf = (id: string) => `/studio/director-styles/${id}.webp`;

/** 表单里的一行：当前风格的样图和名字，点开选。 */
export function StyleField({ value, onChange, disabled, note }: { value: string; onChange: (style: string) => void; disabled?: boolean; note?: string }) {
  const [open, setOpen] = useState(false);
  const preset = DIRECTOR_STYLES.find(s => s.style === value);
  return <div className="director-field"><span>画面风格</span>
    <button type="button" className="director-style-field" disabled={disabled} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      {preset ? <img src={imageOf(preset.id)} alt=""/> : <i aria-hidden/>}
      <b title={value}>{preset?.label ?? (value || "未选择")}</b>
      <em>{preset ? "" : "自定义"}</em>
      <ChevronRight size={15}/>
    </button>
    {note && <small>{note}</small>}
    {open && <StyleDialog value={value} onClose={() => setOpen(false)} onPick={style => { onChange(style); setOpen(false); }}/>}
  </div>;
}

function StyleDialog({ value, onPick, onClose }: { value: string; onPick: (style: string) => void; onClose: () => void }) {
  useEscape(onClose);
  const isCustom = !DIRECTOR_STYLES.some(s => s.style === value);
  const [custom, setCustom] = useState(isCustom ? value : "");
  useEffect(() => { if (isCustom) setCustom(value); }, [isCustom, value]);
  const card = (s: typeof DIRECTOR_STYLES[number]) => <button key={s.id} type="button" className="director-style-card" aria-pressed={s.style === value} onClick={() => onPick(s.style)}>
    <img src={imageOf(s.id)} alt="" loading="lazy"/>
    <span>{s.label}</span>
    {s.style === value && <i aria-hidden><Check size={13}/></i>}
  </button>;
  return <div className="director-dialog-backdrop director-style-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="director-dialog director-style-dialog" role="dialog" aria-modal="true" aria-labelledby="director-style-title" ref={dialogFocus} tabIndex={-1}>
      <header><h2 id="director-style-title">选择画面风格</h2><button type="button" aria-label="关闭" onClick={onClose}><X size={18}/></button></header>
      <p className="director-dialog-note">资产图、分镜图和视频都按这个风格生成。样图由 AI 按风格生成，实际效果还取决于所选的图片和视频模型。</p>
      <div className="director-style-scroll">
        <h3>真人</h3>
        <div className="director-style-grid">{DIRECTOR_STYLES.filter(s => s.group === "真人").map(card)}</div>
        <h3>动画</h3>
        <div className="director-style-grid">{DIRECTOR_STYLES.filter(s => s.group === "动画").map(card)}</div>
      </div>
      <form className="director-style-custom" onSubmit={e => { e.preventDefault(); if (custom.trim()) onPick(custom.trim()); }}>
        <label className="director-field"><span>自定义风格</span>
          <input value={custom} maxLength={30} placeholder="例如：九十年代台湾文艺片写实" onChange={e => setCustom(e.target.value)}/></label>
        <button type="submit" className="ip-brand-secondary" disabled={!custom.trim()}>使用</button>
      </form>
    </div>
  </div>;
}
