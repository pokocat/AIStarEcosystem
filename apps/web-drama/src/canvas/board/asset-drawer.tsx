"use client";

// 资产抽屉：按角色 / 场景 / 素材列出画布上的全部东西，点一项视口移过去并选中它（照小云雀的「资产管理」）。
import * as React from "react";
import { ImageIcon, Type, X } from "lucide-react";
import type { DramaCanvasDoc } from "@ai-star-eco/types/drama-canvas";
import { lookLabel, pickedImage } from "@/canvas/core";
import { CanvasImage } from "@/canvas/shell";

export type DrawerPick =
  | { kind: "character"; id: string }
  | { kind: "look"; id: string }
  | { kind: "scene"; id: string }
  | { kind: "material"; id: string };

/** 抽屉里「共 N 项」的 N：造型 + 场景 + 素材（角色本身不算一项，它由造型组成）。 */
export function assetCount(doc: DramaCanvasDoc): number {
  return doc.characters.reduce((n, c) => n + c.looks.length, 0) + doc.scenes.length + doc.materials.length;
}

function Thumb({ asset, alt }: { asset: { key: string; url?: string } | undefined; alt: string }) {
  return (
    <span className="cvb-drawer-thumb">
      <CanvasImage asset={asset} alt={alt} fit="cover" className="cvb-img" placeholder={<ImageIcon size={14} />} />
    </span>
  );
}

export function AssetDrawer({ doc, onClose, onPick }: { doc: DramaCanvasDoc; onClose: () => void; onPick: (p: DrawerPick) => void }) {
  const total = assetCount(doc);
  return (
    <aside className="cvb-drawer" aria-label="全部角色、场景和素材">
      <div className="cvb-drawer-head">
        <span className="cvb-drawer-title">全部</span>
        <span className="cv-count">共 {total} 项</span>
        <span className="cvb-spacer" />
        <button type="button" className="cvb-icon-btn" aria-label="关闭" title="关闭" onClick={onClose}>
          <X size={15} />
        </button>
      </div>
      <div className="cvb-drawer-body">
        {!total && <div className="cv-hint cvb-drawer-empty">画布上还没有角色、场景和素材。回到剧本页拆出角色和场景，或者用「加一个」自己加。</div>}

        {doc.characters.length > 0 && (
          <section className="cvb-drawer-sec">
            <div className="cvb-drawer-sec-title">角色 · {doc.characters.length}</div>
            {doc.characters.map((c) => (
              <div key={c.id} className="cvb-drawer-group">
                <button type="button" className="cvb-drawer-item cvb-drawer-char" onClick={() => onPick({ kind: "character", id: c.id })}>
                  <span className="cvb-drawer-name cv-ellipsis" title={c.name}>
                    {c.name}
                  </span>
                  {c.role === "lead" && <span className="tag tag-accent">主要角色</span>}
                  <span className="cv-count">{c.looks.length} 个造型</span>
                </button>
                {c.looks.map((l) => {
                  const label = lookLabel(c, l);
                  return (
                    <button key={l.id} type="button" className="cvb-drawer-item cvb-drawer-sub" onClick={() => onPick({ kind: "look", id: l.id })}>
                      <Thumb asset={pickedImage(l.images)} alt={label} />
                      <span className="cvb-drawer-name cv-ellipsis" title={label}>
                        {label}
                      </span>
                      {!l.images.versions.length && <span className="cvb-drawer-note">待生成</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </section>
        )}

        {doc.scenes.length > 0 && (
          <section className="cvb-drawer-sec">
            <div className="cvb-drawer-sec-title">场景 · {doc.scenes.length}</div>
            {doc.scenes.map((s) => (
              <button key={s.id} type="button" className="cvb-drawer-item" onClick={() => onPick({ kind: "scene", id: s.id })}>
                <Thumb asset={pickedImage(s.images)} alt={s.name} />
                <span className="cvb-drawer-name cv-ellipsis" title={s.name}>
                  {s.name}
                </span>
                {!s.images.versions.length && <span className="cvb-drawer-note">待生成</span>}
              </button>
            ))}
          </section>
        )}

        {doc.materials.length > 0 && (
          <section className="cvb-drawer-sec">
            <div className="cvb-drawer-sec-title">素材 · {doc.materials.length}</div>
            {doc.materials.map((m) => (
              <button key={m.id} type="button" className="cvb-drawer-item" onClick={() => onPick({ kind: "material", id: m.id })}>
                {m.kind === "image" ? (
                  <Thumb asset={pickedImage(m.images)} alt={m.name} />
                ) : (
                  <span className="cvb-drawer-thumb cvb-drawer-thumb-text">
                    <Type size={14} />
                  </span>
                )}
                <span className="cvb-drawer-name cv-ellipsis" title={m.name}>
                  {m.name}
                </span>
                <span className="cvb-drawer-note">{m.kind === "image" ? "素材图" : "文字"}</span>
              </button>
            ))}
          </section>
        )}
      </div>
    </aside>
  );
}
