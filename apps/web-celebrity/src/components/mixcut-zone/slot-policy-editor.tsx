"use client";

// Per-slot 扰动准入控件。
//  - 默认收起：一行 chip 显示当前锁定状态
//  - 点 chip 展开：4 个 checkbox，按 layer_type 决定哪些可见
//  - 全局算子被关 → 对应行 disabled 灰显（无论 slot 是否勾选都不会生效）
//  - "恢复默认"清空用户覆盖，回到 layer_type 默认

import { useState } from "react";
import { ChevronDown, RotateCcw, Lock, Info } from "lucide-react";
import type {
  TemplateSlot,
  SlotPerturbationPolicy,
  PerturbationOverrides,
} from "./types";
import { defaultPolicyForLayer } from "./lib/perturbation-defaults";
import { cn } from "./lib/utils";

interface Props {
  slot: TemplateSlot;
  /** 用户在此 slot 上的显式覆盖（增量字段，非全量）。 */
  override?: Partial<SlotPerturbationPolicy>;
  onChange: (next: Partial<SlotPerturbationPolicy>) => void;
  /** 任务级算子总开关；某项 false ⇒ 此 slot 对应行禁用。 */
  globalOverrides: Required<PerturbationOverrides>;
}

type OpKey = "allow_mirror" | "allow_position_jitter" | "allow_scale_jitter" | "allow_speed_jitter";

const OP_LABEL: Record<OpKey, { name: string; hint: string }> = {
  allow_mirror: { name: "镜像", hint: "整段左右翻转" },
  allow_position_jitter: { name: "位置抖动", hint: "本槽位坐标小幅漂移" },
  allow_scale_jitter: { name: "缩放抖动", hint: "本槽位尺寸 ±5%" },
  allow_speed_jitter: { name: "速度抖动", hint: "本槽位时长 0.9x–1.1x" },
};

const GLOBAL_KEY: Record<OpKey, keyof PerturbationOverrides> = {
  allow_mirror: "allow_mirror",
  allow_position_jitter: "allow_speed",        // 位置/缩放没有对应全局开关,占位
  allow_scale_jitter: "allow_speed",            // 同上(无全局短路)
  allow_speed_jitter: "allow_speed",
};

// 没有全局开关的算子（位置/缩放）不受全局影响 → 这里标记一下
const HAS_GLOBAL_KILL: Record<OpKey, boolean> = {
  allow_mirror: true,
  allow_position_jitter: false,
  allow_scale_jitter: false,
  allow_speed_jitter: true,
};

/** 当前 layer 适用哪些算子。 */
function applicableOps(layerType: TemplateSlot["layer_type"]): OpKey[] {
  switch (layerType) {
    case "video":
    case "digital_human":
      return ["allow_mirror", "allow_position_jitter", "allow_scale_jitter", "allow_speed_jitter"];
    case "image":
    case "sticker":
    case "text":
      return ["allow_mirror", "allow_position_jitter", "allow_scale_jitter"];
    case "audio":
      return ["allow_speed_jitter"];
    default:
      return [];
  }
}

/** chip 描述当前锁定状态。 */
function chipText(layerType: TemplateSlot["layer_type"], resolved: Required<SlotPerturbationPolicy>): { text: string; tone: "locked" | "info" | "open" } {
  const lockedCount = Object.values(resolved).filter((v) => v === false).length;
  if (layerType === "text" || layerType === "sticker") {
    return lockedCount >= 3
      ? { text: "默认锁定方向 / 位置 / 尺寸", tone: "locked" }
      : { text: `${4 - lockedCount}/4 算子启用`, tone: "info" };
  }
  if (layerType === "image") {
    return resolved.allow_mirror && resolved.allow_scale_jitter
      ? { text: "扰动全开", tone: "open" }
      : { text: "商品图默认不镜像 / 不缩放抖动", tone: "info" };
  }
  if (layerType === "audio") {
    return resolved.allow_speed_jitter ? { text: "音频参与变速", tone: "info" } : { text: "音频锁定原速", tone: "locked" };
  }
  // video / digital_human
  return lockedCount === 0
    ? { text: "扰动全开", tone: "open" }
    : { text: `${4 - lockedCount}/4 算子启用`, tone: "info" };
}

export function SlotPolicyEditor({ slot, override, onChange, globalOverrides }: Props) {
  const [open, setOpen] = useState(false);
  const layerDefault = defaultPolicyForLayer(slot.layer_type);
  // 模板可能在 slot.perturbation_policy 上有显式覆盖；这里合并：layer默认 ∪ 模板 ∪ 用户
  const templateOverride = slot.perturbation_policy ?? {};
  const resolved: Required<SlotPerturbationPolicy> = {
    allow_mirror: override?.allow_mirror ?? templateOverride.allow_mirror ?? layerDefault.allow_mirror,
    allow_position_jitter: override?.allow_position_jitter ?? templateOverride.allow_position_jitter ?? layerDefault.allow_position_jitter,
    allow_scale_jitter: override?.allow_scale_jitter ?? templateOverride.allow_scale_jitter ?? layerDefault.allow_scale_jitter,
    allow_speed_jitter: override?.allow_speed_jitter ?? templateOverride.allow_speed_jitter ?? layerDefault.allow_speed_jitter,
  };

  const ops = applicableOps(slot.layer_type);
  if (ops.length === 0) return null;

  const { text, tone } = chipText(slot.layer_type, resolved);
  const hasOverride = override && Object.keys(override).length > 0;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border transition-colors",
          tone === "locked" && "border-amber-500/30 bg-amber-500/[0.05] text-amber-700 dark:text-amber-300 hover:bg-amber-500/[0.10]",
          tone === "info" && "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary",
          tone === "open" && "border-border bg-transparent text-muted-foreground hover:bg-secondary/50",
        )}
        title="点击展开调整本槽位扰动准入"
      >
        {tone === "locked" && <Lock className="size-3" />}
        {tone === "info" && <Info className="size-3" />}
        <span>{text}</span>
        {hasOverride && <span className="text-[9px] text-brand-500 font-medium">· 已自定义</span>}
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className="mt-2 rounded-lg border border-border bg-secondary/30 p-3 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[11px] text-muted-foreground mb-1">
            勾选 = 该算子可作用于本槽位。文字/贴图默认全锁,商品图默认锁镜像。
          </div>
          {ops.map((k) => {
            const checked = resolved[k];
            const globalKilled = HAS_GLOBAL_KILL[k] && !globalOverrides[GLOBAL_KEY[k]];
            const layerDef = layerDefault[k];
            return (
              <label
                key={k}
                className={cn(
                  "flex items-start gap-2 text-xs cursor-pointer select-none",
                  globalKilled && "opacity-50 cursor-not-allowed"
                )}
                title={globalKilled ? "已在右侧扰动算子里关闭,此处设置不会生效" : undefined}
              >
                <input
                  type="checkbox"
                  checked={checked && !globalKilled}
                  disabled={globalKilled}
                  onChange={(e) => {
                    const next = { ...(override ?? {}) };
                    if (e.target.checked === layerDef && templateOverride[k] === undefined) {
                      // 回到默认 → 移除该键(保持 override 最小化)
                      delete next[k];
                    } else {
                      next[k] = e.target.checked;
                    }
                    onChange(next);
                  }}
                  className="mt-0.5 accent-brand-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium">{OP_LABEL[k].name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      默认 {layerDef ? "✓" : "✗"}
                    </span>
                    {globalKilled && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">全局已关</span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                    {OP_LABEL[k].hint}
                  </div>
                </div>
              </label>
            );
          })}

          <div className="flex items-center justify-between pt-1 border-t border-border/60">
            <button
              type="button"
              disabled={!hasOverride}
              onClick={(e) => {
                e.stopPropagation();
                onChange({});
              }}
              className={cn(
                "inline-flex items-center gap-1 text-[11px] transition-colors",
                hasOverride
                  ? "text-muted-foreground hover:text-foreground"
                  : "text-muted-foreground/40 cursor-not-allowed"
              )}
            >
              <RotateCcw className="size-3" /> 恢复默认
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              收起
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
