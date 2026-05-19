"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Video, Type, Music, Sparkles, Upload, X, Search, Check, Wand2, Loader2 } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import type {
  TemplateSlot,
  SlotBinding,
  MixcutAsset,
  MixcutAssetKind,
  SlotPerturbationPolicy,
  PerturbationOverrides,
} from "./types";
import { MixcutApi } from "@/api";
import { cn } from "./lib/utils";
import { LAYER_LABELS, FILL_STRATEGY_LABELS } from "@/constants/mixcut-ui";
import { SlotPolicyEditor } from "./slot-policy-editor";

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
}: Props) {
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
            {FILL_STRATEGY_LABELS[slot.fill_strategy]}
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
            {slot.fill_strategy === "library_select" &&
              slot.layer_type === "image" &&
              slot.library_filter?.asset_type === "sticker" && (
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

/** 根据 slot.layer_type / library_filter / accepts_mime 推断要 POST 到 server 的 kind。
 *  layer_type 收缩到 4 类后,贴图(透明 PNG)走 image layer 但 library_filter.asset_type === "sticker"
 *  的 slot 仍上传为 sticker kind,保留素材库分类。 */
function pickAssetKind(slot: TemplateSlot): MixcutAssetKind {
  if (slot.layer_type === "video") return "video";
  if (slot.layer_type === "audio") return "bgm";
  if (slot.library_filter?.asset_type === "sticker") return "sticker";
  // image / text / 其他 → image
  return "image";
}

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(url);
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|m4v|webm|mkv)(\?|$)/i.test(url);
}

function UploadSlotInput({ slot, binding, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myAssets, setMyAssets] = useState<MixcutAsset[] | null>(null);
  const kind = pickAssetKind(slot);

  const uploaded = binding?.source === "upload" || (binding?.source === "library" && !!binding.asset_id);

  const handleFile = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const asset = await MixcutApi.uploadAsset({ file, kind, name: file.name });
      // 上传后用 library 引用方式（带 asset_id 后端解析最稳）；同时附 file_url 便于前端预览
      onChange({ source: "upload", file_url: asset.file_url, preview_url: asset.file_url });
    } catch (e: any) {
      setError(e?.message ?? "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const togglePick = async () => {
    setPicking((prev) => {
      const next = !prev;
      if (next && myAssets === null) {
        // 异步拉一次
        MixcutApi.listAssets({ kind }).then(setMyAssets).catch(() => setMyAssets([]));
      }
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {uploaded ? (
        <div className="relative rounded-lg overflow-hidden border border-border bg-secondary/50">
          {(binding as any).preview_url || (binding as any).file_url ? (
            (isImageUrl((binding as any).preview_url ?? (binding as any).file_url) ? (
              <img
                src={(binding as any).preview_url ?? (binding as any).file_url}
                className="w-full aspect-video object-contain"
                alt=""
              />
            ) : isVideoUrl((binding as any).file_url) ? (
              <video
                src={(binding as any).file_url}
                className="w-full aspect-video object-contain bg-black"
                muted
                loop
                playsInline
                preload="metadata"
              />
            ) : (
              <div className="w-full aspect-video grid place-items-center text-xs text-muted-foreground">
                <div className="flex flex-col items-center gap-1">
                  <ImageIcon className="size-6" />
                  {((binding as any).file_url as string)?.split("/").pop()}
                </div>
              </div>
            ))
          ) : null}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
              setError(null);
            }}
            className="absolute top-2 right-2 size-6 rounded-full bg-black/60 grid place-items-center text-white hover:bg-black/80"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
          className={cn(
            "w-full rounded-lg border-2 border-dashed border-border transition-colors p-6 flex flex-col items-center justify-center gap-2",
            uploading
              ? "opacity-60 cursor-wait"
              : "hover:border-violet-500/60 hover:bg-violet-500/[0.02]"
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="size-6 text-violet-500 animate-spin" />
              <div className="text-xs text-foreground">上传中…</div>
            </>
          ) : (
            <>
              <Upload className="size-6 text-muted-foreground" />
              <div className="text-xs text-foreground">点击上传或拖放</div>
              <div className="text-[10px] text-muted-foreground">
                {slot.accepts_mime?.join(" / ") || (kind === "video" ? "视频" : kind === "bgm" ? "音频" : "图片")} · 单文件 ≤ 200MB
              </div>
            </>
          )}
        </button>
      )}

      {error && (
        <div className="text-xs text-red-500 px-1">⚠ {error}</div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={slot.accepts_mime?.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          // reset so same file can be re-selected
          e.target.value = "";
        }}
      />

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            togglePick();
          }}
        >
          <Search className="size-3" /> 从我的素材选
        </Button>
      </div>

      {picking && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border max-h-64 overflow-y-auto scrollbar-thin">
          {myAssets === null && (
            <div className="col-span-3 text-center text-xs text-muted-foreground py-4">加载中…</div>
          )}
          {myAssets && myAssets.length === 0 && (
            <div className="col-span-3 text-center text-xs text-muted-foreground py-4">
              还没有上传过 {kind} 类型素材
            </div>
          )}
          {myAssets?.map((a) => (
            <button
              key={a.id}
              onClick={(e) => {
                e.stopPropagation();
                onChange({ source: "library", asset_id: a.id, preview_url: a.file_url });
                setPicking(false);
              }}
              className="text-left group"
            >
              <div className="aspect-square rounded overflow-hidden bg-gradient-to-br from-orange-200 to-pink-200 grid place-items-center group-hover:ring-2 group-hover:ring-violet-500 transition-all">
                {a.thumbnail_url ? (
                  <img src={a.thumbnail_url} className="w-full h-full object-cover" alt={a.name} />
                ) : a.kind === "video" ? (
                  <Video className="size-5 text-white/80" />
                ) : a.kind === "bgm" ? (
                  <Music className="size-5 text-white/80" />
                ) : (
                  <ImageIcon className="size-5 text-white/80" />
                )}
              </div>
              <div className="text-[10px] mt-1 line-clamp-1">{a.name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============== 素材库选择（真后端） ==============

function LibrarySlotInput({
  slot,
  binding,
  onChange,
  library,
}: Props & { library: "star_clips" | "bgm" | "sticker" }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<MixcutAsset[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // library → MixcutAssetKind
  const kind: MixcutAssetKind =
    library === "star_clips" ? "video" : library === "bgm" ? "bgm" : "sticker";

  useEffect(() => {
    if (open && items === null) {
      MixcutApi.listAssets({ kind }).then(setItems).catch(() => setItems([]));
    }
  }, [open, items, kind]);

  const filtered = (items ?? []).filter((i) => {
    if (!search) return true;
    return `${i.name} ${i.tags ?? ""} ${i.original_name ?? ""}`.includes(search);
  });

  const selected = binding?.source === "library"
    ? (items ?? []).find((i) => i.id === binding.asset_id)
    : null;

  const handleUpload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const created = await MixcutApi.uploadAsset({ file, kind, name: file.name });
      setItems((prev) => (prev ? [created, ...prev] : [created]));
      onChange({ source: "library", asset_id: created.id, preview_url: created.file_url });
      setOpen(false);
    } catch (e: any) {
      setError(e?.message ?? "上传失败");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {selected ? (
        <div className="flex items-center gap-3 p-2 rounded-lg border border-border bg-secondary/30">
          <div className="w-12 h-12 rounded shrink-0 grid place-items-center overflow-hidden bg-gradient-to-br from-blue-500 to-purple-500">
            {selected.thumbnail_url ? (
              <img src={selected.thumbnail_url} className="w-full h-full object-cover" alt={selected.name} />
            ) : library === "star_clips" ? (
              <Video className="size-5 text-white" />
            ) : library === "bgm" ? (
              <Music className="size-5 text-white" />
            ) : (
              <ImageIcon className="size-5 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{selected.name}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {selected.duration > 0 ? `${selected.duration.toFixed(1)}s · ` : ""}
              {selected.tags || selected.kind}
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
        {selected
          ? "更换素材"
          : library === "star_clips"
            ? "从素材库选择视频"
            : library === "bgm"
              ? "选择 BGM"
              : "选择贴图"}
      </Button>

      {open && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索名称 / 标签…"
              className="h-8 text-xs flex-1"
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs shrink-0"
              disabled={uploading}
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              {uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
              上传
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept={
                kind === "video" ? "video/*" : kind === "bgm" ? "audio/*" : "image/*"
              }
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
          </div>
          {error && <div className="text-xs text-red-500 px-1">⚠ {error}</div>}

          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto scrollbar-thin">
            {items === null && (
              <div className="col-span-2 text-center text-xs text-muted-foreground py-6">加载中…</div>
            )}
            {items && filtered.length === 0 && (
              <div className="col-span-2 text-center text-xs text-muted-foreground py-6">
                {items.length === 0 ? "还没有 " + kind + " 素材，点上传添加" : "没有匹配的素材"}
              </div>
            )}
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange({ source: "library", asset_id: item.id, preview_url: item.file_url });
                  setOpen(false);
                }}
                className="text-left p-2 rounded-lg border border-border hover:border-foreground/30 hover:bg-secondary/40 transition-colors"
              >
                <div className="aspect-square rounded mb-1.5 grid place-items-center overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600">
                  {item.thumbnail_url ? (
                    <img src={item.thumbnail_url} className="w-full h-full object-cover" alt={item.name} />
                  ) : library === "star_clips" ? (
                    <Video className="size-5 text-white" />
                  ) : library === "bgm" ? (
                    <Music className="size-5 text-white" />
                  ) : (
                    <ImageIcon className="size-5 text-white" />
                  )}
                </div>
                <div className="text-xs font-medium line-clamp-1">{item.name}</div>
                <div className="text-[10px] text-muted-foreground line-clamp-2">
                  {item.duration > 0 ? `${item.duration.toFixed(1)}s` : ""}
                  {item.tags ? ` · ${item.tags}` : ""}
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
