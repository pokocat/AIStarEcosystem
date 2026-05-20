"use client";

import { useState } from "react";
import { Image as ImageIcon, Video, Type, Music, Sparkles, Wand2, Check } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import type {
  TemplateSlot,
  SlotBinding,
  SlotPerturbationPolicy,
  PerturbationOverrides,
} from "./types";
import { cn } from "./lib/utils";
import { LAYER_LABELS, FILL_STRATEGY_LABELS } from "@/constants/mixcut-ui";
import { SlotPolicyEditor } from "./slot-policy-editor";
import { MediaSlotInput } from "./media-slot-input";
import { PicgenSlotInput } from "./picgen-slot-input";

interface Props {
  slot: TemplateSlot;
  binding?: SlotBinding;
  onChange: (binding: SlotBinding | undefined) => void;
  focused?: boolean;
  onFocus?: () => void;
  /** 用户对本 slot 的扰动准入覆盖 (可选；不传则不显示编辑器)。 */
  policyOverride?: Partial<SlotPerturbationPolicy>;
  onPolicyChange?: (next: Partial<SlotPerturbationPolicy>) => void;
  /** 任务级算子总开关，用于在 editor 里禁用对应行。 */
  globalOverrides?: Required<PerturbationOverrides>;
  /** 画布尺寸（picgen 出图按 slot.rect × canvas 折算实际像素）。 */
  canvasWidth?: number;
  canvasHeight?: number;
}

const LAYER_ICON = {
  video: Video,
  image: ImageIcon,
  text: Type,
  audio: Music,
};

export function SlotInput({
  slot,
  binding,
  onChange,
  focused,
  onFocus,
  policyOverride,
  onPolicyChange,
  globalOverrides,
  canvasWidth,
  canvasHeight,
}: Props) {
  const Icon = LAYER_ICON[slot.layer_type] || ImageIcon;
  // 兜底：DB 里可能有"文字 + 自己上传"这种历史脏数据（编辑器之前没做联动）。
  // 渲染时按 layer_type 强制纠正 fill_strategy，避免出现"文字 chip + 上传按钮"
  // 这种交互错乱的 UI。新数据由模板编辑器的 reconcileFill 联动保证不再产生脏组合。
  const effectiveFill: typeof slot.fill_strategy =
    slot.layer_type === "text" &&
    (slot.fill_strategy === "user_upload" || slot.fill_strategy === "library_select")
      ? "user_input"
      : slot.layer_type !== "text" && slot.fill_strategy === "user_input"
        ? "user_upload"
        : slot.fill_strategy;
  const filled =
    !!binding &&
    ((binding.source === "input" && binding.text.trim().length > 0) ||
      (binding.source === "library" && !!binding.asset_id) ||
      binding.source === "upload" ||
      (binding.source === "picgen" && binding.title.trim().length > 0));

  return (
    <Card
      onClick={onFocus}
      className={cn(
        "p-4 transition-all cursor-pointer",
        focused ? "ring-2 ring-violet-500/60 border-violet-500/60" : "hover:border-foreground/30",
        filled && "border-emerald-500/30 bg-emerald-500/[0.02]"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "size-9 rounded-lg grid place-items-center shrink-0 transition-colors",
            filled ? "bg-emerald-500/15 text-emerald-500" : "bg-secondary text-muted-foreground"
          )}
        >
          {filled ? <Check className="size-4" /> : <Icon className="size-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-medium text-sm">{slot.label || slot.slot_id}</div>
            {slot.required && <Badge variant="danger" className="text-[10px]">必填</Badge>}
            <Badge variant="muted" className="text-[10px]">{LAYER_LABELS[slot.layer_type]}</Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {FILL_STRATEGY_LABELS[effectiveFill]}
          </div>

          <div className="mt-3">
            {effectiveFill === "user_input" && (
              <TextSlotInput slot={slot} binding={binding} onChange={onChange} />
            )}
            {effectiveFill === "user_upload" && (
              <MediaSlotInput slot={slot} binding={binding} onChange={onChange} mode="both" />
            )}
            {effectiveFill === "library_select" && (
              <MediaSlotInput slot={slot} binding={binding} onChange={onChange} mode="library" />
            )}
            {effectiveFill === "picgen_text" && (
              <PicgenSlotInput
                slot={slot}
                binding={binding}
                onChange={onChange}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
              />
            )}
            {effectiveFill === "api_generated" && (
              <ApiGeneratedSlotInput slot={slot} binding={binding} onChange={onChange} />
            )}
            {effectiveFill === "fixed" && (
              <div className="text-xs text-muted-foreground bg-secondary/50 rounded-md p-2">
                由系统自动填充,无需操作
              </div>
            )}
          </div>

          {onPolicyChange && globalOverrides && slot.fill_strategy !== "fixed" && (
            <SlotPolicyEditor
              slot={slot}
              override={policyOverride}
              onChange={onPolicyChange}
              globalOverrides={globalOverrides}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

// ============== 文本 ==============

function TextSlotInput({
  slot,
  binding,
  onChange,
}: {
  slot: TemplateSlot;
  binding?: SlotBinding;
  onChange: (binding: SlotBinding | undefined) => void;
}) {
  const current = binding?.source === "input" ? binding.text : slot.default_value || "";
  const [aiOpen, setAiOpen] = useState(false);

  const aiSuggestions = [
    "比专柜便宜 70% 闭眼冲",
    "工厂直发 · 这个价不卖了",
    "9.9 拿下别人 99 的同款",
    "回购第三次的好东西",
    "再不囤来不及了",
  ];

  return (
    <div className="space-y-2">
      <Textarea
        value={current}
        onChange={(e) => onChange({ source: "input", text: e.target.value })}
        placeholder={slot.default_value || "输入文案…"}
        rows={2}
        className="text-sm"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          样式预设 <span className="font-mono">{slot.style_preset}</span> · 最多 18 字
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            setAiOpen((v) => !v);
          }}
        >
          <Wand2 className="size-3" /> AI 生成
        </Button>
      </div>
      {aiOpen && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <div className="text-[10px] text-muted-foreground">推荐文案(基于 8000w GMV 爆款数据)</div>
          {aiSuggestions.map((s) => (
            <button
              key={s}
              onClick={(e) => {
                e.stopPropagation();
                onChange({ source: "input", text: s });
                setAiOpen(false);
              }}
              className="w-full text-left text-xs px-2.5 py-1.5 rounded bg-secondary/50 hover:bg-secondary border border-transparent hover:border-border"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============== API 生成(数字人)==============

function ApiGeneratedSlotInput({
  slot,
  binding,
  onChange,
}: {
  slot: TemplateSlot;
  binding?: SlotBinding;
  onChange: (binding: SlotBinding | undefined) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="size-4 text-cyan-400" />
          <span className="text-sm font-medium">AI 数字人 · 自动生成</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          系统会基于您填写的字幕文案,通过外部 API(HeyGen / 硅基智能)生成对应的数字人讲解视频。
          约耗时 60-90 秒,消耗 1 个数字人配额。
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">形象选择</Label>
          <select className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-xs">
            <option>白领女青年</option>
            <option>电商主播男</option>
            <option>知识博主</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">音色</Label>
          <select className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-xs">
            <option>明亮女声</option>
            <option>沉稳男声</option>
            <option>东北豪爽</option>
          </select>
        </div>
      </div>
    </div>
  );
}
