"use client";

// 「@ 引用」浮层：在片段文本里插一个造型 / 场景 / 素材图。两种打开方式：
//   inline —— 在编辑框里敲了 @：查找词跟着编辑框里 @ 后面的字走，上下键 / 回车 / Esc 由编辑框转过来（焦点留在编辑框）；
//   button —— 点「@ 引用」按钮（手机上本集素材栏收起来了，就靠它）：浮层自己带搜索框。
// 挂到 body 上（position: fixed），≤720 变成贴底的面板。
import * as React from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { CanvasImage } from "@/canvas/shell";
import { ASSET_GROUP_LABEL, episodesPhrase, filterAssets, type EpisodeAssetItem } from "./derive";

export const PICKER_MAX_ITEMS = 40;

/**
 * 这一下按键是不是输入法在组字（中文输入法按回车 = 确认候选字、方向键 = 翻候选）。
 * 三道一起判：自己记的 compositionstart/end 状态、浏览器的 isComposing、以及 Safari 组字时报的 keyCode 229。
 */
export function isComposingKey(e: { nativeEvent: { isComposing?: boolean }; keyCode?: number }, composing: boolean): boolean {
  return composing || !!e.nativeEvent.isComposing || e.keyCode === 229;
}

/** 浮层里列哪些：按查找词过滤，这一集的排前面，最多 40 个。 */
export function pickerItems(items: EpisodeAssetItem[], query: string): EpisodeAssetItem[] {
  const hit = filterAssets(items, { scope: "all", query });
  return [...hit.filter((i) => i.inEpisode), ...hit.filter((i) => !i.inEpisode)].slice(0, PICKER_MAX_ITEMS);
}

export interface RefPickerProps {
  mode: "inline" | "button";
  items: EpisodeAssetItem[];
  query: string;
  onQuery?: (q: string) => void;
  active: number;
  onActive: (i: number) => void;
  onPick: (item: EpisodeAssetItem) => void;
  onClose: () => void;
  /** 视口坐标（左上角）。 */
  anchor: { left: number; top: number };
}

export function RefPicker({ mode, items, query, onQuery, active, onActive, onPick, onClose, anchor }: RefPickerProps) {
  const list = React.useMemo(() => pickerItems(items, query), [items, query]);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const safeActive = list.length ? Math.min(Math.max(0, active), list.length - 1) : -1;

  // 点浮层外面关掉（inline 模式下编辑框自己会在失焦时关）
  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  React.useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>(`[data-index="${safeActive}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [safeActive]);

  const composing = React.useRef(false);
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComposingKey(e, composing.current)) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      onActive(Math.min(list.length - 1, safeActive + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      onActive(Math.max(0, safeActive - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (safeActive >= 0) onPick(list[safeActive]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (typeof document === "undefined") return null;
  const width = 300;
  const left = Math.max(8, Math.min(anchor.left, (typeof window !== "undefined" ? window.innerWidth : 1280) - width - 8));
  let lastGroup = "";
  return createPortal(
    <div
      ref={panelRef}
      className={`cve-picker cve-picker-${mode}`}
      style={{ left, top: anchor.top }}
      // inline：别让点选抢走编辑框的焦点（光标位置要留着）
      onMouseDown={(e) => {
        if (mode === "inline") e.preventDefault();
      }}
      data-testid="cve-ref-picker"
    >
      <div className="cve-picker-head">
        <span className="cve-picker-title">@ 引用</span>
        <span className="cve-picker-sub">插入角色、场景或素材图，首帧会参考它们的图</span>
        <button type="button" className="btn btn-icon btn-ghost btn-sm tap-target" aria-label="关闭" title="关闭" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      {mode === "button" && (
        <label className="cve-picker-search">
          <Search size={14} />
          <input
            autoFocus
            value={query}
            placeholder="搜名字"
            aria-label="搜名字"
            onChange={(e) => {
              onQuery?.(e.target.value);
              onActive(0);
            }}
            onKeyDown={onSearchKey}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
          />
        </label>
      )}
      <div className="cve-picker-list" role="listbox" aria-label="可以引用的角色、场景、素材图">
        {list.length === 0 && (
          <div className="cve-picker-empty">{query ? `没找到「${query}」` : "还没有角色、场景或素材图，先去「角色和场景」加"}</div>
        )}
        {list.map((it, i) => {
          const group = it.inEpisode ? ASSET_GROUP_LABEL[it.kind] : `其他${ASSET_GROUP_LABEL[it.kind]}`;
          const showGroup = group !== lastGroup;
          lastGroup = group;
          const sub = episodesPhrase(it.episodes);
          return (
            <React.Fragment key={`${it.kind}:${it.id}`}>
              {showGroup && <div className="cve-picker-group">{group}</div>}
              <button
                type="button"
                role="option"
                aria-selected={i === safeActive}
                data-index={i}
                className={`cve-picker-item${i === safeActive ? " on" : ""}`}
                onMouseEnter={() => onActive(i)}
                onClick={() => onPick(it)}
                title={sub ? `${it.label}（${sub}）` : it.label}
              >
                <span className="cve-picker-av">
                  <CanvasImage asset={it.image} alt={it.label} className="cve-av-img" placeholder={<span className="cve-av-letter">{Array.from(it.label)[0] ?? "@"}</span>} />
                </span>
                <span className="cve-picker-name cv-ellipsis">{it.label}</span>
                {sub && <span className="cve-picker-eps cv-ellipsis">{sub}</span>}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
