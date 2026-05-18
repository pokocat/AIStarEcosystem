"use client";

// 场景流编辑器 —— 横向节点流 + 拖拽重排 + 节点间插入。
// 用法:
//   <SceneFlowEditor
//     scenes={template.scenes}
//     canvas={template.canvas}
//     currentIdx={selectedSceneIdx}
//     editing={true}
//     onSelect / onAddAt / onRemove / onChange / onMoveTo / onMove
//   />

import { useState } from "react";
import { GripVertical, Plus, Trash2, X } from "lucide-react";
import type { Template, TemplateScene } from "./types";
import { TemplatePreview } from "./template-preview";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { cn } from "./lib/utils";

interface Props {
  scenes: TemplateScene[];
  /** 给缩略图渲染用的 canvas (取 width/height/fps/background_color 即可)。 */
  canvas: Template["canvas"];
  currentIdx: number;
  editing: boolean;
  onSelect: (idx: number) => void;
  /** 在指定 gap (0..N) 处插入新场景。idx=0 表示插入到最前,idx=N 表示追加到末尾。 */
  onAddAt: (idx: number) => void;
  onRemove: (idx: number) => void;
  onChange: (idx: number, patch: Partial<TemplateScene>) => void;
  /** 把 from 位置的场景移到 to gap (0..N)。 */
  onMoveTo: (from: number, to: number) => void;
}

export function SceneFlowEditor({
  scenes,
  canvas,
  currentIdx,
  editing,
  onSelect,
  onAddAt,
  onRemove,
  onChange,
  onMoveTo,
}: Props) {
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const [dragOverGap, setDragOverGap] = useState<number | null>(null);
  const totalSec = scenes.reduce((acc, s) => acc + s.duration, 0);

  const current = scenes[currentIdx];

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">
          场景流程 · {scenes.length} 段 · 总 {totalSec}s
        </CardTitle>
        {editing && (
          <div className="text-[10px] text-muted-foreground">
            拖动节点重排 · 点击 + 在任意位置插入
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 节点流(横向滚动,适合 5+ 场景) */}
        <div className="overflow-x-auto -mx-1 px-1 pb-2 scrollbar-thin">
          <div className="flex items-stretch gap-0 min-w-fit">
            {/* 前置 gap */}
            <InsertGap
              gapIdx={0}
              editing={editing}
              isFirst
              isHover={dragOverGap === 0}
              dragActive={dragSrc != null}
              onClickInsert={() => onAddAt(0)}
              onDragOver={() => setDragOverGap(0)}
              onDragLeave={() => setDragOverGap((g) => (g === 0 ? null : g))}
              onDrop={() => {
                if (dragSrc != null) onMoveTo(dragSrc, 0);
                setDragOverGap(null);
                setDragSrc(null);
              }}
            />
            {scenes.map((scene, i) => (
              <div key={scene.id} className="flex items-stretch">
                <SceneNode
                  scene={scene}
                  index={i}
                  active={i === currentIdx}
                  editing={editing}
                  canvas={canvas}
                  dragSrc={dragSrc}
                  onSelect={() => onSelect(i)}
                  onRemove={() => onRemove(i)}
                  onDragStart={() => setDragSrc(i)}
                  onDragEnd={() => { setDragSrc(null); setDragOverGap(null); }}
                />
                <InsertGap
                  gapIdx={i + 1}
                  editing={editing}
                  isHover={dragOverGap === i + 1}
                  dragActive={dragSrc != null}
                  onClickInsert={() => onAddAt(i + 1)}
                  onDragOver={() => setDragOverGap(i + 1)}
                  onDragLeave={() => setDragOverGap((g) => (g === i + 1 ? null : g))}
                  onDrop={() => {
                    if (dragSrc != null) onMoveTo(dragSrc, i + 1);
                    setDragOverGap(null);
                    setDragSrc(null);
                  }}
                />
              </div>
            ))}
            {/* 末尾"新场景"按钮 — 编辑模式专用 */}
            {editing && (
              <button
                onClick={() => onAddAt(scenes.length)}
                className="shrink-0 w-24 self-stretch rounded-lg border-2 border-dashed border-border hover:border-foreground/40 hover:bg-secondary/40 transition-colors grid place-items-center text-muted-foreground hover:text-foreground"
                title="追加新场景"
              >
                <div className="text-center">
                  <Plus className="size-5 mx-auto mb-1" />
                  <div className="text-[10px]">新场景</div>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* 当前选中场景的元信息编辑 (编辑模式专用) */}
        {editing && current && (
          <div className="pt-3 border-t border-border space-y-2">
            <div className="text-[10px] text-muted-foreground">
              当前选中 · <span className="font-mono">{current.id}</span>
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">场景名</Label>
                <Input
                  value={current.label}
                  onChange={(e) => onChange(currentIdx, { label: e.target.value })}
                  className="h-8 text-sm mt-0.5"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">时长 (秒)</Label>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={current.duration}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 1));
                    onChange(currentIdx, { duration: v });
                  }}
                  className="h-8 text-sm mt-0.5"
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── 单个场景节点 ────────────────────────────────────────────────────────────

function SceneNode({
  scene,
  index,
  active,
  editing,
  canvas,
  dragSrc,
  onSelect,
  onRemove,
  onDragStart,
  onDragEnd,
}: {
  scene: TemplateScene;
  index: number;
  active: boolean;
  editing: boolean;
  canvas: Template["canvas"];
  dragSrc: number | null;
  onSelect: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  // 为缩略图构造一个单场景模板 (canvas.duration 设为本场景的)
  const sceneTemplate: Template = {
    template_id: "_preview",
    name: scene.label,
    version: "0",
    canvas: { ...canvas, duration: scene.duration },
    scenes: [scene],
    perturbation_profile: "moderate",
    output_variants_default: 1,
    quality_gate: { min_phash_distance: 0, max_retries: 0 },
    metadata: { category: "", tags: [], required_tier: "trial" },
  };

  const dragging = dragSrc === index;

  return (
    <div
      draggable={editing}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      role="button"
      className={cn(
        "group relative shrink-0 w-28 rounded-lg border-2 transition-all cursor-pointer",
        active ? "border-brand-500 bg-brand-500/[0.04] shadow-md shadow-brand-500/10" : "border-border hover:border-foreground/30",
        editing && "select-none",
        dragging && "opacity-40"
      )}
    >
      {/* 拖把手 + 删除 (编辑模式 hover 显示) */}
      {editing && (
        <>
          <div className="absolute top-1 left-1 z-10 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="size-3.5" />
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-1 right-1 z-10 size-5 grid place-items-center rounded-full bg-black/40 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-all"
            title="删除场景"
          >
            <X className="size-3" />
          </button>
        </>
      )}

      {/* 缩略图(mini TemplatePreview) */}
      <div className="px-2 pt-2">
        <TemplatePreview
          template={sceneTemplate}
          showSlotChrome={false}
        />
      </div>

      {/* 标签 + 元信息 */}
      <div className="px-2 py-1.5 space-y-0.5">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums">#{index + 1}</span>
          <span className="text-[10px] font-mono text-muted-foreground">{scene.duration}s</span>
        </div>
        <div className="text-xs font-medium truncate" title={scene.label}>
          {scene.label}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {scene.slots.length} 内容位
        </div>
      </div>

      {/* 当前激活指示 */}
      {active && (
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 size-3 rotate-45 bg-brand-500 border-2 border-background" />
      )}
    </div>
  );
}

// ── 节点之间的插入位 ─────────────────────────────────────────────────────────

function InsertGap({
  editing,
  isFirst,
  isHover,
  dragActive,
  onClickInsert,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  gapIdx: number;
  editing: boolean;
  isFirst?: boolean;
  isHover: boolean;
  dragActive: boolean;
  onClickInsert: () => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
}) {
  if (!editing) {
    // 非编辑态:首节点前不要箭头,其余节点之间显示一个简单的 →
    if (isFirst) return <div className="w-2 shrink-0" />;
    return (
      <div className="shrink-0 w-6 self-center text-muted-foreground/60 grid place-items-center">
        →
      </div>
    );
  }

  // 编辑态:可点击的 + ; drag-over 时高亮
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      className={cn(
        "shrink-0 self-stretch flex items-center justify-center transition-all",
        isHover ? "w-12" : dragActive ? "w-8" : isFirst ? "w-3" : "w-6"
      )}
    >
      <button
        onClick={onClickInsert}
        className={cn(
          "w-full h-full grid place-items-center rounded-md text-muted-foreground transition-colors",
          isHover && "bg-brand-500/20 text-brand-500 ring-2 ring-brand-500/40",
          !isHover && dragActive && "bg-secondary/50",
          !dragActive && "hover:bg-secondary/60 hover:text-foreground"
        )}
        title="在此插入新场景"
      >
        <Plus className={cn("transition-all", isHover ? "size-5" : "size-3")} />
      </button>
    </div>
  );
}
