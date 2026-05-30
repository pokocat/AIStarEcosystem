"use client";

// v0.13+ 扰动贴图池选择器
//
// 用法：
//   <StickerPoolPicker value={slot.perturbation_sticker_pool}
//                      onChange={(b) => updateSlot({...slot, perturbation_sticker_pool: b})} />
//
// 行为：
//  - 自动 fetch /api/mixcut/assets?kind=sticker&preset=true，按 preset_group 分 tab
//  - 多选 → 写回 pool_ids；空 → onChange(undefined) 清除整个绑定
//  - 选中后展开配置面板（coverage / 不透明度 / 大小 / 每变体抽样数）
//  - 加载中 / 空池都给提示

import { useEffect, useMemo, useState } from "react";
import { Sparkles, RefreshCw, X } from "lucide-react";
import { listPresetStickers } from "@/api/mixcut";
import type { MixcutAsset, StickerPoolBinding } from "./types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Slider } from "./ui/slider";
import { cn } from "./lib/utils";

interface Props {
  value?: StickerPoolBinding;
  onChange: (next: StickerPoolBinding | undefined) => void;
  disabled?: boolean;
  /** 标题文本，默认"动态贴图"。 */
  label?: string;
}

const COVERAGE_OPTIONS: { value: StickerPoolBinding["coverage"]; label: string; hint: string }[] = [
  { value: "intro", label: "开头 3 秒", hint: "片头吸睛装饰" },
  { value: "outro", label: "结尾 3 秒", hint: "片尾收束氛围" },
  { value: "loop", label: "整片", hint: "持续装饰整段" },
  { value: "random_3s", label: "随机 3 秒", hint: "每条视频随机时段出现" },
];

const GROUP_LABELS: Record<string, string> = {
  sparkle: "闪光",
  ribbon: "色带",
  emoji_burst: "表情",
  star: "星星",
  heart: "爱心",
};

function groupLabel(g: string): string {
  return GROUP_LABELS[g] ?? g;
}

export function StickerPoolPicker({ value, onChange, disabled, label = "动态贴图" }: Props) {
  const [presets, setPresets] = useState<MixcutAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>("");

  const loadPresets = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listPresetStickers();
      setPresets(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPresets();
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, MixcutAsset[]>();
    for (const a of presets) {
      const g = a.preset_group ?? "_misc";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(a);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [presets]);

  useEffect(() => {
    if (!activeGroup && groups.length > 0) setActiveGroup(groups[0][0]);
  }, [groups, activeGroup]);

  const selectedIds = value?.pool_ids ?? [];

  const toggleAsset = (id: string) => {
    if (disabled) return;
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    if (next.length === 0) {
      onChange(undefined);
    } else {
      onChange({
        pool_ids: next,
        coverage: value?.coverage ?? "loop",
        opacity: value?.opacity ?? 0.85,
        scale_pct: value?.scale_pct ?? 18,
        pick_count: value?.pick_count ?? 1,
      });
    }
  };

  const updateConfig = (patch: Partial<StickerPoolBinding>) => {
    if (!value || disabled) return;
    onChange({ ...value, ...patch });
  };

  const clearAll = () => {
    if (disabled) return;
    onChange(undefined);
  };

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="size-3.5 text-violet-500" />
          {label}
          {selectedIds.length > 0 && (
            <span className="text-xs text-violet-500 font-normal">
              已选 {selectedIds.length} 张 · 每条视频随机抽 {value?.pick_count ?? 1} 张
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={loadPresets}
            disabled={loading || disabled}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            title="刷新预置池"
          >
            <RefreshCw className={cn("size-3", loading && "animate-spin")} /> 刷新
          </button>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-rose-500"
              title="清空所选"
            >
              <X className="size-3" /> 清空
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="text-xs text-muted-foreground py-4 text-center">正在加载贴图…</div>
      )}
      {error && (
        <div className="text-xs text-rose-500 py-4 text-center">加载贴图失败：{error}</div>
      )}
      {!loading && !error && groups.length === 0 && (
        <div className="text-xs text-muted-foreground py-4 text-center">
          暂无可用的装饰贴图，请联系团队管理员配置。
        </div>
      )}

      {!loading && !error && groups.length > 0 && (
        <Tabs value={activeGroup} onValueChange={setActiveGroup}>
          <TabsList className="flex-wrap h-auto">
            {groups.map(([g, items]) => (
              <TabsTrigger key={g} value={g} className="text-xs">
                {groupLabel(g)}
                <span className="ml-1.5 text-[10px] opacity-60">{items.length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {groups.map(([g, items]) => (
            <TabsContent key={g} value={g} className="mt-2">
              <div className="grid grid-cols-4 gap-2">
                {items.map((a) => {
                  const sel = selectedIds.includes(a.id);
                  const src = a.preview_url ?? a.thumbnail_url ?? a.file_url;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAsset(a.id)}
                      disabled={disabled}
                      className={cn(
                        "relative rounded-md border-2 overflow-hidden transition-colors bg-secondary/50",
                        sel
                          ? "border-violet-500 ring-2 ring-violet-500/30"
                          : "border-transparent hover:border-border"
                      )}
                      title={a.name}
                    >
                      <div className="aspect-square flex items-center justify-center bg-grid">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={a.name}
                          className="max-w-full max-h-full object-contain"
                          loading="lazy"
                        />
                      </div>
                      <div className="text-[10px] py-0.5 px-1 truncate bg-background/60 text-muted-foreground">
                        {a.name}
                      </div>
                      {sel && (
                        <div className="absolute top-1 right-1 size-4 rounded-full bg-violet-500 text-white text-[10px] flex items-center justify-center font-bold">
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {value && (
        <div className="space-y-3 pt-3 border-t border-border/60">
          <div>
            <div className="text-xs font-medium mb-1.5">时间覆盖</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
              {COVERAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateConfig({ coverage: opt.value })}
                  disabled={disabled}
                  className={cn(
                    "px-2 py-1.5 text-[11px] rounded border transition-colors",
                    value.coverage === opt.value
                      ? "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                      : "border-border bg-background hover:bg-secondary/50"
                  )}
                  title={opt.hint}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-xs font-medium mb-1.5">
                每条抽样
                <span className="ml-1 text-[10px] text-muted-foreground">
                  ({value.pick_count ?? 1} 张)
                </span>
              </div>
              <div className="flex gap-1">
                {[1, 2].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => updateConfig({ pick_count: n })}
                    disabled={disabled}
                    className={cn(
                      "flex-1 px-2 py-1.5 text-[11px] rounded border transition-colors",
                      (value.pick_count ?? 1) === n
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-border bg-background hover:bg-secondary/50"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium mb-1.5">
                不透明度
                <span className="ml-1 text-[10px] text-muted-foreground">
                  {Math.round(value.opacity * 100)}%
                </span>
              </div>
              <Slider
                value={[value.opacity]}
                min={0.1}
                max={1}
                step={0.05}
                onValueChange={(vs) => updateConfig({ opacity: vs[0] })}
                disabled={disabled}
              />
            </div>
            <div>
              <div className="text-xs font-medium mb-1.5">
                大小
                <span className="ml-1 text-[10px] text-muted-foreground">{value.scale_pct}%</span>
              </div>
              <Slider
                value={[value.scale_pct]}
                min={5}
                max={50}
                step={1}
                onValueChange={(vs) => updateConfig({ scale_pct: vs[0] })}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground leading-tight">
            每条视频会随机抽选不同的贴图组合，让每条看起来都不一样。
          </div>
        </div>
      )}
    </div>
  );
}
