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

/** 每场景的填写进度，可选；create 页传，view/edit 不传。 */
export type SceneProgress = {
  /** done = 必填都齐了；partial = 部分填；empty = 一个都没填；none = 该场景没有必填项。 */
  state: "done" | "partial" | "empty" | "none";
  filled?: number;
  total?: number;
};

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
  /**
   * 可选：每段必填进度（顺序与 scenes[] 对齐）。
   * 传了 → 节点 chip 内 #N 编号左侧显示一个 1.5px 色点；
   * 不传或长度对不上 → 节点不显示色点，视觉与 v0.27 之前一致。
   * 仅在 create 页使用，view/edit 不传即可。
   */
  progress?: SceneProgress[];
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
  progress,
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
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-baseline justify-between gap-2 min-w-0 tracking-normal">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="shrink-0">场景流程</span>
            <span className="text-[11px] font-normal text-muted-foreground font-mono">
              {scenes.length} 段 · 共 {totalSec}s
            </span>
          </div>
          {/* 当前段相对位置 hint —— 让"我在看第几段"在卡片头部就读到 */}
          {current && (
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
              第 {currentIdx + 1} / {scenes.length} 段
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3.5 pt-1">
        {/*
          节点流 —— 在容器内 flex 填满；节点带 min-w-[12rem] 作为下限。
          - 场景较少时（2~3 段）节点等比例伸展，吃满父容器宽度（v0.30+ 父容器已上提为全宽）
          - 场景较多（5+）时累计宽度超出容器 → 外层 overflow-x-auto 兜底横向滚动
          - w-full 与 min-w-fit 联用：低于阈值用 100%，高于阈值用 content width
        */}
        <div className="overflow-x-auto -mx-1 px-1 pb-1 scrollbar-thin">
          <div className="flex items-stretch gap-0 w-full min-w-fit">
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
                  progress={progress?.[i]}
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

        {/*
          时间分布条 —— 按 scene.duration 等比例填充，给场景流程一个"我占了视频里多长一段"的视觉。
          单 scene 时仍渲染（一根条），仅当 scenes.length === 0 时省略。
          编辑模式下隐藏（避免被拖拽 + 时长频繁变更时反复重排引起视觉抖动）。
        */}
        {!editing && scenes.length > 0 && (
          <DurationStrip
            scenes={scenes}
            totalSec={totalSec}
            currentIdx={currentIdx}
            progress={progress}
            onSelect={onSelect}
          />
        )}

        {/*
          当前选中场景的元信息编辑 (编辑模式专用)
          v0.29 修正：原来用 `grid-cols-[1fr_88px] items-end`，1fr 让名称输入
          拉满到 ~1700px，时长列 88px 被甩到卡片最右；时长下的帮助文案被挤进
          88px 列里强制换 4 行，items-end 又把帮助文案的高度反推回去，于是
          名称 / 时长两个 Label 一上一下错位。
          重写为「两输入框紧贴成对 + 帮助文案独占一行（在下方，不再被绑死在
          时长列里）」。整体宽度 cap 在 max-w-xl，避免在 1600px 容器里被
          强行拉成横向长条。*/}
        {editing && current && (
          <div className="pt-3 border-t border-border space-y-2">
            <div className="flex items-end gap-3 max-w-xl">
              <div className="flex-1 min-w-0">
                <Label className="text-[10px] text-muted-foreground">第 {currentIdx + 1} 段 · 名称</Label>
                <Input
                  value={current.label}
                  onChange={(e) => onChange(currentIdx, { label: e.target.value })}
                  className="h-8 text-sm mt-0.5"
                  placeholder="给这一段起个名字"
                />
              </div>
              <div className="w-24 shrink-0">
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
            <p className="text-[10px] text-muted-foreground leading-snug">
              改时长后，本段内的素材时长会按比例同步缩放。
            </p>
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
  progress,
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
  progress?: SceneProgress;
  onSelect: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const dragging = dragSrc === index;
  const sceneLabel = /^\d+\s*s$/i.test(scene.label.trim()) ? `第 ${index + 1} 段` : scene.label;
  // 进度色点：done = 必填齐 → 翠绿；partial = 部分填 → 琥珀（脉动）；empty = 一个都没填 → 玫红；none / 未传 → 不渲染
  const progressDotClass =
    progress?.state === "done"
      ? "bg-emerald-500"
      : progress?.state === "partial"
        ? "bg-amber-400"
        : progress?.state === "empty"
          ? "bg-rose-400/80"
          : null;

  // 进度比 + 文案（用于 mini bar / a11y label）
  const hasProgress = progress != null && (progress.total ?? 0) > 0;
  const progressRatio =
    hasProgress && progress!.total
      ? Math.min(1, (progress!.filled ?? 0) / progress!.total)
      : 0;

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
        "group relative rounded-lg border px-3.5 py-3 transition-all cursor-pointer",
        // flex-1 basis-0 让节点在容器有余宽时等比例伸展；min-w-[12rem] 是下限，
        // 累计超出后外层 overflow-x-auto 会接管 → 横向滚动。
        "flex items-start gap-2 flex-1 basis-0 min-w-[12rem] text-left",
        active
          ? "border-violet-400/70 bg-violet-50/70 shadow-[var(--shadow-soft)]"
          : "border-border bg-card/40 hover:border-foreground/25 hover:bg-secondary/35",
        editing && "select-none",
        dragging && "opacity-40"
      )}
    >
      {editing && (
        <div className="text-muted-foreground/60 group-hover:text-muted-foreground transition-colors shrink-0 pt-0.5">
          <GripVertical className="size-3.5" />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        {/* row 1 — 编号 + 标题 + 进度点 */}
        <div className="flex items-center gap-1.5 min-w-0">
          {progressDotClass && (
            <span
              className={cn(
                "size-1.5 rounded-full shrink-0",
                progressDotClass,
                progress?.state === "partial" && "animate-pulse",
              )}
              title={
                progress?.total != null && progress?.filled != null
                  ? `必填 ${progress.filled}/${progress.total}`
                  : undefined
              }
              aria-hidden
            />
          )}
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0">
            #{index + 1}
          </span>
          <span className="text-sm font-medium truncate" title={sceneLabel}>
            {sceneLabel}
          </span>
        </div>
        {/* row 2 — 时长 + 内容位 */}
        <div className="text-[11px] text-muted-foreground font-mono tabular-nums">
          {scene.duration}s · {scene.slots.length} 内容位
        </div>
        {/* row 3 — 必填进度条（仅 create 页传 progress 时显示） */}
        {hasProgress && (
          <div className="space-y-0.5 pt-0.5">
            <div className="h-1 rounded-full bg-border/60 overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all",
                  progress!.state === "done"
                    ? "bg-emerald-500"
                    : progress!.state === "partial"
                      ? "bg-amber-400"
                      : "bg-rose-400/70",
                )}
                style={{ width: `${Math.max(progressRatio * 100, 6)}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground font-mono tabular-nums">
              必填 {progress!.filled ?? 0}/{progress!.total ?? 0}
            </div>
          </div>
        )}
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

// ── 时间分布条 ──────────────────────────────────────────────────────────────
//
// 一根横向条按 scene.duration 等比例分段，给"场景流程"一个除了节点列表之外的
// 第二视角："我占了视频里多长一段"。带累计 tick mark + 必填进度色填充。
// 仅 view / create 模式渲染（编辑模式下时长频繁变化会导致视觉抖动）。

function DurationStrip({
  scenes,
  totalSec,
  currentIdx,
  progress,
  onSelect,
}: {
  scenes: TemplateScene[];
  totalSec: number;
  currentIdx: number;
  progress?: SceneProgress[];
  onSelect: (idx: number) => void;
}) {
  // 累计时间点（用于 tick mark）：0s, 5s, 10s, …
  let cumulative = 0;
  const ticks: number[] = [0];
  for (const s of scenes) {
    cumulative += s.duration;
    ticks.push(cumulative);
  }

  return (
    <div className="space-y-1">
      <div className="flex h-6 w-full overflow-hidden rounded-md border border-border bg-card/60">
        {scenes.map((scene, i) => {
          const ratio = totalSec > 0 ? scene.duration / totalSec : 1 / scenes.length;
          const isActive = i === currentIdx;
          const segProgress = progress?.[i];
          // 段填色：done = 翠绿浅底；partial = 琥珀浅底；empty = 玫红浅底；none / 未传 = 中性
          const segBgClass =
            segProgress?.state === "done"
              ? "bg-emerald-500/15"
              : segProgress?.state === "partial"
                ? "bg-amber-400/15"
                : segProgress?.state === "empty"
                  ? "bg-rose-400/15"
                  : "bg-secondary/40";
          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => onSelect(i)}
              title={`第 ${i + 1} 段 · ${scene.label} · ${scene.duration}s`}
              style={{ flexBasis: `${ratio * 100}%` }}
              className={cn(
                "relative min-w-0 border-r border-border/70 last:border-r-0 transition-all cursor-pointer",
                segBgClass,
                isActive && "ring-2 ring-violet-500/60 ring-inset z-10",
                !isActive && "hover:bg-foreground/5",
              )}
            >
              <span className="absolute inset-0 grid place-items-center px-1 text-[10px] font-medium text-foreground/70 truncate">
                {scene.label}
              </span>
            </button>
          );
        })}
      </div>
      {/* tick marks 行：0s ─ 5s ─ 10s ─ …（始终覆盖首尾，避免 ticks 太密塞不下） */}
      <div className="relative h-3 text-[9px] font-mono text-muted-foreground/70 tabular-nums">
        {ticks.map((t, i) => {
          const left = totalSec > 0 ? (t / totalSec) * 100 : 0;
          return (
            <span
              key={`${t}-${i}`}
              className="absolute top-0 -translate-x-1/2 select-none"
              style={{ left: `${Math.min(100, Math.max(0, left))}%` }}
            >
              {t}s
            </span>
          );
        })}
      </div>
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
