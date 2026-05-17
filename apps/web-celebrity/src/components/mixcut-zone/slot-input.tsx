"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, Video, Type, Music, Sparkles, Upload, X, Search, Check, Wand2 } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import type { TemplateSlot, SlotBinding, StarClip, Asset, ProductClip } from "./types";
import { mockStarClips, mockAssets, mockProductClips } from "@/mocks/mixcut";
import { cn } from "./lib/utils";

interface Props {
  slot: TemplateSlot;
  binding?: SlotBinding;
  onChange: (binding: SlotBinding | undefined) => void;
  focused?: boolean;
  onFocus?: () => void;
}

const LAYER_ICON = {
  video: Video,
  image: ImageIcon,
  text: Type,
  sticker: ImageIcon,
  audio: Music,
  digital_human: Sparkles,
};

export function SlotInput({ slot, binding, onChange, focused, onFocus }: Props) {
  const Icon = LAYER_ICON[slot.layer_type] || ImageIcon;
  const filled =
    !!binding &&
    ((binding.source === "input" && binding.text) ||
      (binding.source === "library" && binding.asset_id) ||
      binding.source === "upload");

  return (
    <Card
      onClick={onFocus}
      className={cn(
        "p-4 transition-all cursor-pointer",
        focused ? "ring-2 ring-brand-500/60 border-brand-500/60" : "hover:border-foreground/30",
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
            <Badge variant="muted" className="text-[10px] font-mono">{slot.layer_type}</Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 font-mono">
            {slot.slot_id} · {slot.fill_strategy}
          </div>

          <div className="mt-3">
            {slot.fill_strategy === "user_input" && (
              <TextSlotInput slot={slot} binding={binding} onChange={onChange} />
            )}
            {slot.fill_strategy === "user_upload" && (
              <UploadSlotInput slot={slot} binding={binding} onChange={onChange} />
            )}
            {slot.fill_strategy === "library_select" && slot.layer_type === "video" && (
              <LibrarySlotInput
                slot={slot}
                binding={binding}
                onChange={onChange}
                library="star_clips"
              />
            )}
            {slot.fill_strategy === "library_select" && slot.layer_type === "audio" && (
              <LibrarySlotInput
                slot={slot}
                binding={binding}
                onChange={onChange}
                library="bgm"
              />
            )}
            {slot.fill_strategy === "library_select" && slot.layer_type === "sticker" && (
              <LibrarySlotInput
                slot={slot}
                binding={binding}
                onChange={onChange}
                library="sticker"
              />
            )}
            {slot.fill_strategy === "api_generated" && (
              <ApiGeneratedSlotInput slot={slot} binding={binding} onChange={onChange} />
            )}
            {slot.fill_strategy === "fixed" && (
              <div className="text-xs text-muted-foreground bg-secondary/50 rounded-md p-2 font-mono">
                固定素材 · {slot.asset_id}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============== 文本 ==============

function TextSlotInput({ slot, binding, onChange }: Props) {
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

// ============== 用户上传 ==============

function UploadSlotInput({ slot, binding, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState(false);

  const uploaded = binding?.source === "upload";

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file);
    onChange({ source: "upload", file_url: url, preview_url: url });
  };

  return (
    <div className="space-y-2">
      {uploaded ? (
        <div className="relative rounded-lg overflow-hidden border border-border bg-secondary/50">
          {(binding as any).preview_url && (binding as any).preview_url.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
            <img src={(binding as any).preview_url} className="w-full aspect-video object-contain" alt="" />
          ) : (
            <div className="w-full aspect-video grid place-items-center text-xs text-muted-foreground">
              <div className="flex flex-col items-center gap-1">
                <ImageIcon className="size-6" />
                {((binding as any).file_url as string).split("/").pop()}
              </div>
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
            className="absolute top-2 right-2 size-6 rounded-full bg-black/60 grid place-items-center text-white hover:bg-black/80"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
          className="w-full rounded-lg border-2 border-dashed border-border hover:border-brand-500/60 hover:bg-brand-500/[0.02] transition-colors p-6 flex flex-col items-center justify-center gap-2"
        >
          <Upload className="size-6 text-muted-foreground" />
          <div className="text-xs text-foreground">点击上传或拖放</div>
          <div className="text-[10px] text-muted-foreground">
            {slot.accepts_mime?.join(" / ") || "图片或视频"} · 单文件 ≤ 50MB
          </div>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={slot.accepts_mime?.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            setPicking((v) => !v);
          }}
        >
          <Search className="size-3" /> 从我的素材选
        </Button>
      </div>

      {picking && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
          {mockProductClips.map((p) => (
            <button
              key={p.id}
              onClick={(e) => {
                e.stopPropagation();
                onChange({ source: "upload", file_url: p.file_url, preview_url: p.thumbnail_url });
                setPicking(false);
              }}
              className="text-left group"
            >
              <div className="aspect-square rounded bg-gradient-to-br from-orange-200 to-pink-200 grid place-items-center group-hover:ring-2 group-hover:ring-brand-500 transition-all">
                <ImageIcon className="size-5 text-white/70" />
              </div>
              <div className="text-[10px] mt-1 line-clamp-1">{p.product_name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============== 素材库选择 ==============

function LibrarySlotInput({
  slot,
  binding,
  onChange,
  library,
}: Props & { library: "star_clips" | "bgm" | "sticker" }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const items: any[] =
    library === "star_clips"
      ? mockStarClips.filter((s) => s.authorization_status === "authorized")
      : mockAssets.filter((a) =>
          library === "bgm" ? a.asset_type === "bgm" : a.asset_type === "sticker" || a.asset_type === "title" || a.asset_type === "promo_label"
        );

  const filtered = items.filter((i) => {
    if (!search) return true;
    const text = library === "star_clips" ? `${i.star_name} ${i.script_text} ${i.tags?.join(" ")}` : `${i.name} ${i.category}`;
    return text.includes(search);
  });

  const selected = binding?.source === "library" ? items.find((i) => i.id === binding.asset_id) : null;

  return (
    <div className="space-y-2">
      {selected ? (
        <div className="flex items-center gap-3 p-2 rounded-lg border border-border bg-secondary/30">
          <div
            className={cn(
              "w-12 h-12 rounded shrink-0 grid place-items-center",
              library === "star_clips"
                ? "bg-gradient-to-br from-blue-500 to-purple-500"
                : library === "bgm"
                ? "bg-gradient-to-br from-violet-500 to-fuchsia-500"
                : "bg-gradient-to-br from-amber-500 to-orange-500"
            )}
          >
            {library === "star_clips" && <Video className="size-5 text-white" />}
            {library === "bgm" && <Music className="size-5 text-white" />}
            {library === "sticker" && <ImageIcon className="size-5 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {library === "star_clips" ? (selected as StarClip).star_name : (selected as Asset).name}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {library === "star_clips"
                ? `${(selected as StarClip).duration}s · ${(selected as StarClip).script_text}`
                : (selected as Asset).category}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : null}

      <Button
        variant={selected ? "outline" : "default"}
        size="sm"
        className="w-full"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Search className="size-3" />
        {selected ? "更换素材" : library === "star_clips" ? "从明星素材库选择" : library === "bgm" ? "选择 BGM" : "从素材库选择"}
      </Button>

      {open && (
        <div className="space-y-2 pt-2 border-t border-border">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={library === "star_clips" ? "搜索明星 / 品类 / 关键词…" : "搜索素材名称…"}
            className="h-8 text-xs"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto scrollbar-thin">
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange({ source: "library", asset_id: item.id });
                  setOpen(false);
                }}
                className="text-left p-2 rounded-lg border border-border hover:border-foreground/30 hover:bg-secondary/40 transition-colors"
              >
                <div
                  className={cn(
                    "aspect-square rounded mb-1.5 grid place-items-center",
                    library === "star_clips" && "bg-gradient-to-br from-blue-500 to-purple-600",
                    library === "bgm" && "bg-gradient-to-br from-violet-500 to-fuchsia-500",
                    library === "sticker" && "bg-gradient-to-br from-amber-500 to-orange-500"
                  )}
                >
                  {library === "star_clips" && <Video className="size-5 text-white" />}
                  {library === "bgm" && <Music className="size-5 text-white" />}
                  {library === "sticker" && <ImageIcon className="size-5 text-white" />}
                </div>
                <div className="text-xs font-medium line-clamp-1">
                  {library === "star_clips" ? (item as StarClip).star_name : (item as Asset).name}
                </div>
                <div className="text-[10px] text-muted-foreground line-clamp-2">
                  {library === "star_clips" ? (item as StarClip).script_text : (item as Asset).category}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============== API 生成(数字人)==============

function ApiGeneratedSlotInput({ slot, binding, onChange }: Props) {
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
