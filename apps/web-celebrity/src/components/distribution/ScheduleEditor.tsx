"use client";

// v0.22: ScheduleEditor 从 mixcut-zone/BatchPublishDrawer.tsx 抽出来共享。
//   - 混剪批量发布抽屉用它选「立即 / 定时 / 分期」三种 strategy
//   - 任务追踪「重新调度未开始」对话框用它给整批 QUEUED 子集换新节奏
//
// 行为与抽屉里旧版 1:1 对齐；前端预览算法与后端 ScheduleExpander 必须一致
// （apps/server/.../service/publish/ScheduleExpander.java）。

import { useState } from "react";
import { Clock, AlertCircle, Calendar, Sparkles, Plus, X } from "lucide-react";
import { cn } from "@/components/mixcut-zone/lib/utils";

export type StrategyKind = "immediate" | "single" | "daily_recurring";

export interface DailyRecurringPreview {
  totalJobs: number;
  totalDays: number;
  firstSlotAt: Date;
  lastSlotAt: Date;
  /** 若起始日期 + 前几个 slot 已过去，标 true —— 这些会 clamp 到 now。 */
  firstSlotInPast: boolean;
}

export interface ScheduleEditorProps {
  strategy: StrategyKind;
  onStrategyChange: (s: StrategyKind) => void;
  singleAt: string;
  onSingleAtChange: (s: string) => void;
  startDate: string;
  onStartDateChange: (s: string) => void;
  timeSlots: string[];
  onTimeSlotsChange: (slots: string[]) => void;
  capMode: "exhaust" | "days";
  onCapModeChange: (m: "exhaust" | "days") => void;
  maxDays: number;
  onMaxDaysChange: (n: number) => void;
  jitterEnabled: boolean;
  onJitterEnabledChange: (b: boolean) => void;
  jitterMinutes: number;
  onJitterMinutesChange: (n: number) => void;
  preview: DailyRecurringPreview | null;
  capacityShortfall: { selected: number; cap: number; maxDays: number; slotCount: number } | null;
  selectedOutputCount: number;
  /**
   * 哪些 strategy 应该展示。默认全部三种。
   * 任务追踪的 RescheduleBatchDialog 可以传 ["single", "daily_recurring"] 把「立即分发」
   * 隐掉（重新调度场景"立即"等于直接派单，没有意义）。
   */
  allowedStrategies?: StrategyKind[];
}

export function ScheduleEditor(props: ScheduleEditorProps) {
  const {
    strategy, onStrategyChange,
    singleAt, onSingleAtChange,
    startDate, onStartDateChange,
    timeSlots, onTimeSlotsChange,
    capMode, onCapModeChange,
    maxDays, onMaxDaysChange,
    jitterEnabled, onJitterEnabledChange,
    jitterMinutes, onJitterMinutesChange,
    preview, capacityShortfall,
    selectedOutputCount,
    allowedStrategies = ["immediate", "single", "daily_recurring"],
  } = props;

  const [showAddSlot, setShowAddSlot] = useState(false);
  const [newSlot, setNewSlot] = useState("09:00");

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const slotCount = sortDedupSlots(timeSlots).length;

  const applyPreset = (slots: string[]) => onTimeSlotsChange(slots);
  const removeSlot = (s: string) => onTimeSlotsChange(timeSlots.filter((x) => x !== s));
  const addSlot = () => {
    onTimeSlotsChange(sortDedupSlots([...timeSlots, newSlot]));
    setShowAddSlot(false);
  };

  const gridColsClass =
    allowedStrategies.length === 3
      ? "grid-cols-3"
      : allowedStrategies.length === 2
        ? "grid-cols-2"
        : "grid-cols-1";

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Clock className="size-3.5" />
        分发节奏
      </div>

      <div className={cn("grid gap-1.5", gridColsClass)}>
        {allowedStrategies.includes("immediate") && (
          <StrategyPill
            active={strategy === "immediate"}
            label="立即分发"
            desc="马上开始发布"
            onClick={() => onStrategyChange("immediate")}
          />
        )}
        {allowedStrategies.includes("single") && (
          <StrategyPill
            active={strategy === "single"}
            label="定时分发"
            desc="所有任务同一时刻"
            onClick={() => onStrategyChange("single")}
          />
        )}
        {allowedStrategies.includes("daily_recurring") && (
          <StrategyPill
            active={strategy === "daily_recurring"}
            label="分期分发"
            desc="按节奏跨天发"
            onClick={() => onStrategyChange("daily_recurring")}
          />
        )}
      </div>

      {strategy === "single" && (
        <div className="space-y-1 pl-1">
          <input
            type="datetime-local"
            value={singleAt}
            onChange={(e) => onSingleAtChange(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-md border border-border bg-background"
          />
          <p className="text-[11px] text-muted-foreground">
            按你的本地时间（{tz}）执行；到点后系统会自动开始分发。
          </p>
        </div>
      )}

      {strategy === "daily_recurring" && (
        <div className="space-y-3 pl-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="size-3.5 text-muted-foreground" />
            <label className="text-xs text-muted-foreground">起始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="px-2 py-1 text-sm rounded-md border border-border bg-background"
            />
            <span className="text-[10px] text-muted-foreground">
              过去日期会立即起飞
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">一键预设</label>
            <div className="flex flex-wrap gap-1.5">
              {SLOT_PRESETS.map((p) => {
                const active = arraysEqual(sortDedupSlots(p.slots), sortDedupSlots(timeSlots));
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p.slots)}
                    className={cn(
                      "px-2.5 py-1 text-[11px] rounded-full border transition-colors",
                      active
                        ? "bg-violet-500 border-violet-500 text-white"
                        : "bg-background border-border text-foreground hover:border-violet-300",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              时段（{slotCount} 个）
            </label>
            <div className="flex flex-wrap gap-1.5 items-center">
              {sortDedupSlots(timeSlots).map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono rounded-md bg-violet-50 border border-violet-200 text-violet-700"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSlot(s)}
                    aria-label={`移除 ${s}`}
                    className="text-violet-400 hover:text-rose-500"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {showAddSlot ? (
                <span className="inline-flex items-center gap-1">
                  <input
                    type="time"
                    value={newSlot}
                    onChange={(e) => setNewSlot(e.target.value)}
                    className="px-2 py-0.5 text-[11px] rounded border border-border bg-background"
                  />
                  <button
                    type="button"
                    onClick={addSlot}
                    className="text-[11px] text-violet-600 hover:underline"
                  >
                    添加
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddSlot(false)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    取消
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddSlot(true)}
                  className="inline-flex items-center gap-0.5 px-2 py-1 text-[11px] rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-violet-300"
                >
                  <Plus className="size-3" />
                  自定义
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">持续</label>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={capMode === "exhaust"}
                  onChange={() => onCapModeChange("exhaust")}
                  className="accent-violet-500"
                />
                直到视频用完
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={capMode === "days"}
                  onChange={() => onCapModeChange("days")}
                  className="accent-violet-500"
                />
                持续
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={maxDays}
                  onChange={(e) => onMaxDaysChange(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                  onFocus={() => onCapModeChange("days")}
                  className="w-14 px-1.5 py-0.5 text-sm rounded border border-border bg-background"
                />
                天
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={jitterEnabled}
                onChange={(e) => onJitterEnabledChange(e.target.checked)}
                className="accent-violet-500"
              />
              <Sparkles className="size-3.5" />
              让发帖时间更像人工
            </label>
            {jitterEnabled && (
              <div className="pl-6 flex items-center gap-2 text-xs text-muted-foreground">
                <span>±</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={jitterMinutes}
                  onChange={(e) => onJitterMinutesChange(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                  className="w-14 px-1.5 py-0.5 text-sm rounded border border-border bg-background"
                />
                <span>分钟随机偏移（最大 30 分钟）</span>
              </div>
            )}
          </div>

          {capacityShortfall ? (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-md p-2.5 flex items-start gap-2">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
              <div>
                视频超过容量：{capacityShortfall.selected} 条 &gt;{" "}
                {capacityShortfall.maxDays} 天 × {capacityShortfall.slotCount} 时段 ={" "}
                {capacityShortfall.cap} 条容量。
                <br />
                请增加天数 / 时段，或减少所选视频。
              </div>
            </div>
          ) : preview && selectedOutputCount > 0 ? (
            <div className="text-[11px] text-violet-700 bg-violet-50 border border-violet-200 rounded-md p-2.5 space-y-0.5">
              <div>
                共 <b>{preview.totalJobs}</b> 条视频 · 跨{" "}
                <b>{preview.totalDays}</b> 天
              </div>
              <div>
                首条 {formatPreviewSlot(preview.firstSlotAt, preview.firstSlotInPast)} · 末条{" "}
                {formatPreviewSlot(preview.lastSlotAt, false)}
                {jitterEnabled && jitterMinutes > 0 && (
                  <span className="text-violet-500"> · ±{jitterMinutes} 分钟内随机</span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground">
                按勾选顺序铺开 · 时区 {tz}
              </div>
            </div>
          ) : slotCount === 0 ? (
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2.5">
              至少留 1 个时段；点上面预设或「+ 自定义」补一条。
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function StrategyPill({
  active, label, desc, onClick,
}: { active: boolean; label: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-2 rounded-md border text-left transition-colors",
        active
          ? "bg-violet-500/10 border-violet-500 text-violet-700"
          : "bg-background border-border text-foreground hover:border-violet-300",
      )}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-[10px] text-muted-foreground">{desc}</div>
    </button>
  );
}

// ─── 工具函数（与后端 ScheduleExpander.expandDailyRecurring 1:1 对齐） ──────

/** 时段排序去重，丢弃格式不合法的。后端会做同样的 normalize。 */
export function sortDedupSlots(slots: string[]): string[] {
  const re = /^([01]\d|2[0-3]):[0-5]\d$/;
  const set = new Set<string>();
  for (const s of slots) if (re.test(s)) set.add(s);
  return Array.from(set).sort();
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** 「每天 N 次」一键预设。 */
export const SLOT_PRESETS: { label: string; slots: string[] }[] = [
  { label: "每天 3 次 · 09/12/18", slots: ["09:00", "12:00", "18:00"] },
  { label: "每天 2 次 · 12/19", slots: ["12:00", "19:00"] },
  { label: "每天 1 次 · 19:00", slots: ["19:00"] },
  { label: "晚间高峰 · 19/21/22:30", slots: ["19:00", "21:00", "22:30"] },
];

/** 计算 daily_recurring 的预览信息（不模拟 jitter；jitter 只在 UI 文案里提示）。 */
export function expandDailyRecurringPreview(
  outputs: number,
  slots: string[],
  startDate: string,
  tz: string,
): DailyRecurringPreview | null {
  if (outputs <= 0 || slots.length === 0 || !startDate) return null;
  const sortedSlots = sortDedupSlots(slots);
  if (sortedSlots.length === 0) return null;
  const k = sortedSlots.length;
  const totalDays = Math.ceil(outputs / k);
  const firstSlotAt = slotToDate(startDate, sortedSlots[0], tz);
  const lastIdx = outputs - 1;
  const lastDayOffset = Math.floor(lastIdx / k);
  const lastSlot = sortedSlots[lastIdx % k];
  const lastDate = addDays(startDate, lastDayOffset);
  const lastSlotAt = slotToDate(lastDate, lastSlot, tz);
  return {
    totalJobs: outputs,
    totalDays,
    firstSlotAt,
    lastSlotAt,
    firstSlotInPast: firstSlotAt.getTime() < Date.now(),
  };
}

/** "YYYY-MM-DD" + "HH:MM" 在指定 IANA 时区下解释为绝对时间 Date。 */
function slotToDate(date: string, slot: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = slot.split(":").map(Number);
  const candidate = new Date(y, m - 1, d, hh, mm, 0, 0);
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz === localTz) return candidate;
  const asString = candidate.toLocaleString("en-US", { timeZone: tz });
  const reinterpreted = new Date(asString);
  const diffMs = candidate.getTime() - reinterpreted.getTime();
  return new Date(candidate.getTime() + diffMs);
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(y, m - 1, d + days);
  return toLocalDateInput(next);
}

function formatPreviewSlot(at: Date, isPast: boolean): string {
  if (isPast) return "立即";
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const hm = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  const today = now;
  const tomorrow = new Date(now.getTime() + 86400000);
  if (sameDay(at, today)) return `今 ${hm}`;
  if (sameDay(at, tomorrow)) return `明 ${hm}`;
  return `${at.getMonth() + 1}月${at.getDate()}日 ${hm}`;
}

/** Date → "YYYY-MM-DDTHH:mm" 本地时区字符串（datetime-local input 用）。 */
export function toLocalDateTimeInput(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

/** Date → "YYYY-MM-DD"（date input 用）。 */
export function toLocalDateInput(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
