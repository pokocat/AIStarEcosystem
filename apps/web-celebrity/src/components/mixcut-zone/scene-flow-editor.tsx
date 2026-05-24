"use client";

// 场景流编辑器 —— 紧凑横向节点条 + 拖拽重排 + 节点间插入。
// v2: 去掉每节点的 mini 缩略图(过小看不清),改用更密集的文字节点。

import { useState } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import type { Template, TemplateScene } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
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
    <Card
      className="shadow-none"
      style={{
        borderColor: "color-mix(in srgb, var(--line-2) 52%, var(--line))",
        background: "color-mix(in srgb, var(--bg-1) 82%, var(--bg-0))",
      }}
    >
      <CardHeader className="pb-1.5">
        <CardTitle className="text-sm flex items-baseline gap-2 min-w-0 tracking-normal">
          <span className="shrink-0">场景流程</span>
          <span className="text-[11px] font-normal text-muted-foreground font-mono">
            {scenes.length} 段 · 共 {totalSec}s
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {/* 节点流(横向滚动,适合 5+ 场景) */}
        <div className="overflow-x-auto -mx-1 px-1 pb-1 scrollbar-thin">
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
                className="shrink-0 w-24 self-stretch rounded-lg border-2 border-dashed border-border/80 text-muted-foreground hover:border-foreground/30 hover:bg-secondary/30 hover:text-foreground transition-colors grid place-items-center"
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
          <div className="pt-3 border-t border-border grid grid-cols-[1fr_88px] gap-2 items-end">
            <div>
              <Label className="text-[10px] text-muted-foreground">第 {currentIdx + 1} 段 · 名称</Label>
              <Input
                value={current.label}
                onChange={(e) => onChange(currentIdx, { label: e.target.value })}
                className="h-8 text-sm mt-0.5"
                placeholder="给这一段起个名字"
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
  const dragging = dragSrc === index;
  const sceneLabel = /^\d+\s*s$/i.test(scene.label.trim()) ? `第 ${index + 1} 段` : scene.label;

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
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onSelect();
      }}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      className={cn(
        "group relative shrink-0 rounded-md border px-3 py-2 transition-all cursor-pointer",
        "flex items-center gap-2 min-w-[10rem] text-left",
        active
          ? "border-violet-300/70 bg-violet-50/70 shadow-none"
          : "border-border bg-transparent hover:border-foreground/25 hover:bg-secondary/35",
        editing && "select-none",
        dragging && "opacity-40"
      )}
    >
      {editing && (
        <div className="text-muted-foreground/60 group-hover:text-muted-foreground transition-colors shrink-0">
          <GripVertical className="size-3.5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums">#{index + 1}</span>
          <span className="text-xs font-medium truncate" title={sceneLabel}>
            {sceneLabel}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">
          {scene.duration}s · {scene.slots.length} 内容位
        </div>
      </div>
      {editing && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="shrink-0 size-5 grid place-items-center rounded-full text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
          title="删除场景"
        >
          <X className="size-3" />
        </button>
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
      <div className="shrink-0 w-5 self-center text-muted-foreground/40 grid place-items-center">
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
        "shrink-0 self-stretch flex items-center justify-center transition-all relative",
        isHover ? "w-12" : dragActive ? "w-10" : isFirst ? "w-6" : "w-8"
      )}
    >
      {/* 静态 hairline divider — 提示这里是间隔 */}
      {!isHover && !dragActive && (
        <div className="absolute left-1/2 top-2 bottom-2 w-px bg-border" />
      )}
      <button
        onClick={onClickInsert}
        className={cn(
          "relative z-10 w-full h-full grid place-items-center rounded-md text-muted-foreground/70 transition-colors",
          isHover && "bg-violet-500/20 text-violet-500 ring-2 ring-violet-500/40",
          !isHover && dragActive && "bg-secondary/50 text-foreground",
          !dragActive && "hover:bg-secondary/60 hover:text-foreground"
        )}
        title="在此插入新场景"
      >
        <Plus className={cn("transition-all", isHover ? "size-5" : "size-3.5")} />
      </button>
    </div>
  );
}
