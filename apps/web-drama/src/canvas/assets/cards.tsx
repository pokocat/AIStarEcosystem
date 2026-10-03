"use client";

// 角色和场景列表里的三种卡片：角色（竖版定妆照）、场景（场景图）、素材（图或文字摘要）。
// 卡片只显示、只回调；点了去哪（画布定位 / 抽屉 / 多选勾选）由列表决定。
import * as React from "react";
import { Check, FileText, Loader2, TriangleAlert } from "lucide-react";
import type { CanvasCharacter, CanvasMaterial, CanvasScene, DramaCanvasDoc } from "@ai-star-eco/types/drama-canvas";
import { lookLabel, pickedImage } from "@/canvas/core";
import { CanvasImage } from "@/canvas/shell";
import { ROLE_LABEL, type AssetRunView } from "./bits";
import { episodesText } from "./list-ops";

export type RunOf = (kind: "look" | "scene" | "material", id: string) => AssetRunView;

function Placeholder({ children }: { children: React.ReactNode }) {
  return <div className="cva-card-ph">{children}</div>;
}

/** 图区上的状态：在跑 = 进度；失败且没有图 = 原因（有图时失败原因写在卡片下面，不挡图）。 */
function MediaState({ view, hasImage }: { view: AssetRunView; hasImage: boolean }) {
  if (view.pending) {
    return (
      <div className="cva-card-state" role="status">
        <Loader2 size={14} className="cv-spin" />
        <span>{view.queued ? "排队中" : "生成中"}</span>
      </div>
    );
  }
  if (view.failed && !hasImage) {
    return (
      <div className="cva-card-state cva-card-state-failed" role="alert" title={view.errorMessage}>
        <TriangleAlert size={14} />
        <span className="cva-card-state-text">没生成出来：{view.errorMessage}</span>
      </div>
    );
  }
  return null;
}

function SelectMark({ on }: { on: boolean }) {
  return (
    <span className={`cva-check${on ? " on" : ""}`} aria-hidden>
      {on && <Check size={13} />}
    </span>
  );
}

// ── 角色 ─────────────────────────────────────────────────────────────────────

export interface CharacterCardProps {
  character: CanvasCharacter;
  runOf: RunOf;
  selectMode: boolean;
  /** 选中的造型 id。 */
  selected: ReadonlySet<string>;
  onOpen: () => void;
  onToggleLook: (lookId: string) => void;
  onToggleAll: () => void;
}

export function CharacterCard({ character, runOf, selectMode, selected, onOpen, onToggleLook, onToggleAll }: CharacterCardProps) {
  const first = character.looks[0];
  const img = first ? pickedImage(first.images) : undefined;
  const firstView = first ? runOf("look", first.id) : undefined;
  const allOn = character.looks.length > 0 && character.looks.every((l) => selected.has(l.id));
  const someOn = character.looks.some((l) => selected.has(l.id));

  // 卡片下面那一行：其它造型在跑 / 没生成出来；第一个造型有图但这次失败了也写在这里
  const others = character.looks.map((l, i) => ({ look: l, view: i === 0 ? firstView! : runOf("look", l.id), i }));
  const pendingN = others.filter((o) => o.i > 0 && o.view.pending).length;
  const failed = others.find((o) => o.view.failed && (o.i > 0 || !!img));

  return (
    <div className={`cva-card-wrap${selectMode && someOn ? " selected" : ""}`}>
      <button
        type="button"
        className="card cva-card cva-char-card"
        onClick={selectMode ? onToggleAll : onOpen}
        aria-pressed={selectMode ? allOn : undefined}
        aria-label={selectMode ? `选中「${character.name}」的全部造型` : `打开「${character.name}」`}
      >
        <div className="cva-card-media cva-media-portrait">
          <CanvasImage
            asset={img}
            alt={`${character.name} 定妆照`}
            className="cva-card-img cva-card-img-portrait"
            placeholder={<Placeholder>待生成</Placeholder>}
          />
          {firstView && <MediaState view={firstView} hasImage={!!img} />}
          <span className={`tag cva-card-role ${character.role === "lead" ? "tag-accent" : "tag-gray"}`}>{ROLE_LABEL[character.role]}</span>
          {first && first.images.versions.length > 1 && <span className="cva-card-n num">{first.images.versions.length} 张</span>}
          {selectMode && <SelectMark on={allOn} />}
        </div>
        <div className="cva-card-body">
          <div className="cva-card-name" title={character.name}>
            {character.name}
          </div>
          <div className="cva-card-meta">{character.looks.length} 个造型</div>
          {pendingN > 0 && <div className="cva-card-line">{pendingN} 个造型在生成</div>}
          {failed && (
            <div className="cva-card-line cva-card-line-failed" title={failed.view.errorMessage}>
              「{failed.look.name}」没生成出来：{failed.view.errorMessage}
            </div>
          )}
        </div>
      </button>
      {selectMode && character.looks.length > 1 && (
        <div className="cva-look-picks" role="group" aria-label={`选「${character.name}」的哪几个造型`}>
          {character.looks.map((l) => {
            const on = selected.has(l.id);
            return (
              <button key={l.id} type="button" className={`chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => onToggleLook(l.id)} title={lookLabel(character, l)}>
                {on && <Check size={12} />}
                <span className="cv-ellipsis">{l.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 场景 ─────────────────────────────────────────────────────────────────────

export interface SceneCardProps {
  scene: CanvasScene;
  view: AssetRunView;
  portrait: boolean;
  selectMode: boolean;
  selected: boolean;
  onClick: () => void;
}

export function SceneCard({ scene, view, portrait, selectMode, selected, onClick }: SceneCardProps) {
  const img = pickedImage(scene.images);
  const eps = episodesText(scene.episodes);
  return (
    <div className={`cva-card-wrap${selectMode && selected ? " selected" : ""}`}>
      <button
        type="button"
        className="card cva-card cva-scene-card"
        onClick={onClick}
        aria-pressed={selectMode ? selected : undefined}
        aria-label={selectMode ? `选中「${scene.name}」` : `打开「${scene.name}」`}
      >
        <div className={`cva-card-media ${portrait ? "cva-media-portrait" : "cva-media-land"}`}>
          <CanvasImage asset={img} alt={`${scene.name} 场景图`} className="cva-card-img" placeholder={<Placeholder>待生成</Placeholder>} />
          <MediaState view={view} hasImage={!!img} />
          {scene.images.versions.length > 1 && <span className="cva-card-n num">{scene.images.versions.length} 张</span>}
          {selectMode && <SelectMark on={selected} />}
        </div>
        <div className="cva-card-body">
          <div className="cva-card-name" title={scene.name}>
            {scene.name}
          </div>
          <div className="cva-card-meta">{eps ?? "还没标出现在哪几集"}</div>
          {view.failed && img && (
            <div className="cva-card-line cva-card-line-failed" title={view.errorMessage}>
              上次没生成出来：{view.errorMessage}
            </div>
          )}
        </div>
      </button>
    </div>
  );
}

// ── 素材 ─────────────────────────────────────────────────────────────────────

export interface MaterialCardProps {
  doc: DramaCanvasDoc;
  material: CanvasMaterial;
  view: AssetRunView;
  onClick: () => void;
}

export function MaterialCard({ doc, material, view, onClick }: MaterialCardProps) {
  const uses = doc.board.edges.filter((e) => e.source === material.id).length;
  const usesText = uses ? `给 ${uses} 张卡片当参考` : "还没连给谁";
  if (material.kind === "text") {
    const text = (material.text ?? "").trim();
    return (
      <div className="cva-card-wrap">
        <button type="button" className="card cva-card cva-mat-card" onClick={onClick} aria-label={`打开文字「${material.name}」`}>
          <div className="cva-mat-text">
            <FileText size={14} className="cva-mat-icon" />
            <p className={text ? "" : "cva-mat-empty"}>{text || "还没写内容"}</p>
          </div>
          <div className="cva-card-body">
            <div className="cva-card-name" title={material.name}>
              {material.name}
            </div>
            <div className="cva-card-meta">文字 · {usesText}</div>
          </div>
        </button>
      </div>
    );
  }
  const img = pickedImage(material.images);
  return (
    <div className="cva-card-wrap">
      <button type="button" className="card cva-card cva-mat-card" onClick={onClick} aria-label={`打开素材图「${material.name}」`}>
        <div className="cva-card-media cva-media-square">
          <CanvasImage asset={img} alt={material.name} className="cva-card-img" placeholder={<Placeholder>{material.prompt?.trim() ? "待生成" : "还没有图"}</Placeholder>} />
          <MediaState view={view} hasImage={!!img} />
        </div>
        <div className="cva-card-body">
          <div className="cva-card-name" title={material.name}>
            {material.name}
          </div>
          <div className="cva-card-meta">素材图 · {usesText}</div>
        </div>
      </button>
    </div>
  );
}
