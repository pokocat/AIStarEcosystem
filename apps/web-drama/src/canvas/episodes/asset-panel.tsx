"use client";

// 单集编辑器左栏「本集素材」（plan §2.6）：搜索、「只看这一集 / 全部」，分组列出造型、场景、素材图；
// 点一项 = 在片段文本光标处插入引用。≤1023 收起（改用「@ 引用」浮层）。
import * as React from "react";
import { Search } from "lucide-react";
import { CanvasImage } from "@/canvas/shell";
import { ASSET_GROUP_LABEL, episodesPhrase, filterAssets, type EpisodeAssetItem } from "./derive";

export interface AssetPanelProps {
  items: EpisodeAssetItem[];
  disabled?: boolean;
  onPick: (item: EpisodeAssetItem) => void;
}

const KINDS: EpisodeAssetItem["kind"][] = ["look", "scene", "material"];

export function AssetPanel({ items, disabled, onPick }: AssetPanelProps) {
  const [scope, setScope] = React.useState<"episode" | "all">("episode");
  const [query, setQuery] = React.useState("");
  const shown = React.useMemo(() => filterAssets(items, { scope, query }), [items, scope, query]);
  const inEpisodeCount = React.useMemo(() => items.filter((i) => i.inEpisode).length, [items]);

  return (
    <aside className="card cve-assets" aria-label="本集素材" data-testid="cve-assets">
      <div className="cve-panel-head">
        <span className="cve-panel-title">本集素材</span>
      </div>
      <label className="cve-assets-search">
        <Search size={14} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜名字" aria-label="搜本集素材" />
      </label>
      <div className="cv-seg cve-assets-scope" role="group" aria-label="看哪些">
        <button type="button" className={scope === "episode" ? "on" : ""} aria-pressed={scope === "episode"} onClick={() => setScope("episode")}>
          只看这一集
        </button>
        <button type="button" className={scope === "all" ? "on" : ""} aria-pressed={scope === "all"} onClick={() => setScope("all")}>
          全部
        </button>
      </div>
      <p className="cv-hint cve-assets-tip">点一下，插到片段文本里光标的位置</p>
      <div className="cve-assets-list">
        {KINDS.map((kind) => {
          const list = shown.filter((i) => i.kind === kind);
          if (!list.length) return null;
          return (
            <section key={kind} className="cve-assets-group">
              <div className="cve-assets-group-title">{ASSET_GROUP_LABEL[kind]}</div>
              {list.map((it) => {
                const sub = episodesPhrase(it.episodes);
                return (
                  <button
                    key={`${it.kind}:${it.id}`}
                    type="button"
                    className="cve-asset"
                    disabled={disabled}
                    // 不抢编辑框的焦点：光标位置要留着
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onPick(it)}
                    title={sub ? `${it.label}（${sub}）` : it.label}
                    data-kind={it.kind}
                    data-id={it.id}
                  >
                    <span className={`cve-asset-av cve-asset-av-${it.kind}`}>
                      <CanvasImage
                        asset={it.image}
                        alt={it.label}
                        className="cve-av-img"
                        placeholder={<span className="cve-av-letter">{Array.from(it.label)[0] ?? "@"}</span>}
                      />
                    </span>
                    <span className="cve-asset-copy">
                      <span className="cve-asset-name cv-ellipsis">{it.label}</span>
                      {sub && <span className="cve-asset-sub cv-ellipsis">{sub}</span>}
                    </span>
                  </button>
                );
              })}
            </section>
          );
        })}
        {!shown.length && (
          <div className="cve-assets-empty cv-hint">
            {query
              ? `没找到「${query}」`
              : scope === "episode" && items.length
                ? "这一集还没有标出场的角色和场景，切到「全部」看看"
                : "还没有角色、场景或素材图，先去「角色和场景」加"}
          </div>
        )}
        {scope === "episode" && !query && inEpisodeCount > 0 && inEpisodeCount < items.length && (
          <button type="button" className="btn btn-ghost btn-sm cve-assets-more" onClick={() => setScope("all")}>
            还有 {items.length - inEpisodeCount} 个不在这一集，看全部
          </button>
        )}
      </div>
    </aside>
  );
}
