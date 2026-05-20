"use client";

// 统一的素材选择组件（v0.16 替换 UploadSlotInput + LibrarySlotInput）。
//
// 三种模式：
//   - mode="upload"   仅自己上传（user_upload 但 slot 不允许跨库选）
//   - mode="library"  仅从素材库选（library_select）
//   - mode="both"     上传 + 库选两个等权入口（user_upload 默认走这条）
//
// 共享外形：
//   · 已选 → 预览 tile + 文件名 + X 删除
//   · 未选 → 一/二个按钮 + 可折叠 inline 面板（搜索 + 上传 + grid）
//
// kind 推导：
//   image + library_filter.asset_type === "sticker" → sticker
//   video → video
//   audio → bgm
//   其他  → image
//
// 复用 MixcutApi.listAssets({kind}) / uploadAsset({kind, file})。

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Video, Music, Upload, X, Search, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { MixcutApi } from "@/api";
import type { TemplateSlot, SlotBinding, MixcutAsset, MixcutAssetKind } from "./types";
import { cn } from "./lib/utils";

interface Props {
  slot: TemplateSlot;
  binding?: SlotBinding;
  onChange: (binding: SlotBinding | undefined) => void;
  mode: "upload" | "library" | "both";
}

function pickAssetKind(slot: TemplateSlot): MixcutAssetKind {
  if (slot.layer_type === "video") return "video";
  if (slot.layer_type === "audio") return "bgm";
  if (slot.library_filter?.asset_type === "sticker") return "sticker";
  return "image";
}

function isImageUrl(url: string | undefined): boolean {
  return !!url && /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(url);
}
function isVideoUrl(url: string | undefined): boolean {
  return !!url && /\.(mp4|mov|m4v|webm|mkv)(\?|$)/i.test(url);
}
function isAudioUrl(url: string | undefined): boolean {
  return !!url && /\.(mp3|wav|m4a|aac|ogg|flac)(\?|$)/i.test(url);
}

function bindingPreviewUrl(b?: SlotBinding): string | undefined {
  if (!b) return undefined;
  if (b.source === "library") return b.preview_url;
  if (b.source === "upload") return b.preview_url ?? b.file_url;
  if (b.source === "picgen") return b.preview_url;
  return undefined;
}

function bindingFileUrl(b?: SlotBinding): string | undefined {
  if (b?.source === "upload") return b.file_url;
  if (b?.source === "library") return b.preview_url;
  return undefined;
}

const KIND_HINT: Record<MixcutAssetKind, string> = {
  image: "图片 (JPG/PNG/WebP)",
  sticker: "贴图 (PNG/GIF，建议透明背景)",
  video: "视频 (MP4/MOV/WebM)",
  bgm: "音频 (MP3/WAV)",
};

const KIND_ACCEPT: Record<MixcutAssetKind, string> = {
  image: "image/*",
  sticker: "image/*",
  video: "video/*",
  bgm: "audio/*",
};

export function MediaSlotInput({ slot, binding, onChange, mode }: Props) {
  const kind = pickAssetKind(slot);
  const accept = slot.accepts_mime?.join(",") || KIND_ACCEPT[kind];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<MixcutAsset[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 已选状态
  const previewUrl = bindingPreviewUrl(binding);
  const fileUrl = bindingFileUrl(binding);
  const filled =
    binding?.source === "upload" ||
    (binding?.source === "library" && !!binding.asset_id);

  useEffect(() => {
    if (picking && items === null) {
      MixcutApi.listAssets({ kind }).then(setItems).catch(() => setItems([]));
    }
  }, [picking, items, kind]);

  const filtered = (items ?? []).filter((i) => {
    if (!search) return true;
    return `${i.name} ${i.tags ?? ""} ${i.original_name ?? ""}`.includes(search);
  });

  const handleUpload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const asset = await MixcutApi.uploadAsset({ file, kind, name: file.name });
      // 优先用 library + asset_id 引用（后端解析最稳）；如果业务方需要直接 file_url 也兼容
      if (mode === "library" || mode === "both") {
        setItems((prev) => (prev ? [asset, ...prev] : [asset]));
        onChange({ source: "library", asset_id: asset.id, preview_url: asset.file_url });
      } else {
        onChange({ source: "upload", file_url: asset.file_url, preview_url: asset.file_url });
      }
      setPicking(false);
    } catch (e: any) {
      setError(e?.message ?? "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handlePickAsset = (a: MixcutAsset) => {
    onChange({ source: "library", asset_id: a.id, preview_url: a.file_url });
    setPicking(false);
  };

  const triggerFilePick = () => fileInputRef.current?.click();

  // ── 渲染：已选预览 ──────────────────────────────────────────────────────────
  const renderPreview = () => {
    if (!filled) return null;
    return (
      <div className="relative rounded-lg overflow-hidden border border-border bg-secondary/30">
        {kind === "bgm" ? (
          <div className="flex items-center gap-2 p-3">
            <div className="size-10 rounded grid place-items-center bg-gradient-to-br from-blue-500 to-purple-600">
              <Music className="size-4 text-white" />
            </div>
            <div className="text-xs truncate flex-1">
              {fileUrl?.split("/").pop() ?? "音频"}
            </div>
          </div>
        ) : isImageUrl(previewUrl ?? fileUrl) ? (
          <img
            src={previewUrl ?? fileUrl}
            className="w-full aspect-video object-contain bg-black/5"
            alt=""
          />
        ) : isVideoUrl(fileUrl) ? (
          <video
            src={fileUrl}
            className="w-full aspect-video object-contain bg-black"
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : isAudioUrl(fileUrl) ? (
          <div className="flex items-center gap-2 p-3">
            <div className="size-10 rounded grid place-items-center bg-gradient-to-br from-blue-500 to-purple-600">
              <Music className="size-4 text-white" />
            </div>
            <div className="text-xs truncate flex-1">{fileUrl?.split("/").pop()}</div>
          </div>
        ) : (
          <div className="w-full aspect-video grid place-items-center text-xs text-muted-foreground">
            <div className="flex flex-col items-center gap-1">
              <ImageIcon className="size-6" />
              {fileUrl?.split("/").pop() ?? "已选素材"}
            </div>
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChange(undefined);
            setError(null);
            setPicking(false);
          }}
          className="absolute top-2 right-2 size-6 rounded-full bg-black/60 grid place-items-center text-white hover:bg-black/80"
          aria-label="移除已选素材"
        >
          <X className="size-3" />
        </button>
      </div>
    );
  };

  // ── 渲染：动作按钮 ───────────────────────────────────────────────────────
  const renderActions = () => {
    const uploadBtn = (
      <Button
        variant={filled ? "ghost" : "outline"}
        size="sm"
        className={cn("h-9 text-xs flex-1", filled && "h-7")}
        disabled={uploading}
        onClick={(e) => {
          e.stopPropagation();
          triggerFilePick();
        }}
      >
        {uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
        {filled ? "更换" : mode === "upload" ? "上传素材" : "上传新素材"}
      </Button>
    );

    const libraryBtn = (
      <Button
        variant={filled ? "ghost" : picking ? "default" : "outline"}
        size="sm"
        className={cn("h-9 text-xs flex-1", filled && "h-7")}
        onClick={(e) => {
          e.stopPropagation();
          setPicking((v) => !v);
        }}
      >
        <Search className="size-3" />
        {filled ? "从素材库换" : mode === "library" ? "从素材库选" : "我的素材库"}
      </Button>
    );

    return (
      <div className="flex items-center gap-2">
        {(mode === "upload" || mode === "both") && uploadBtn}
        {(mode === "library" || mode === "both") && libraryBtn}
      </div>
    );
  };

  // ── 渲染：inline library 面板 ─────────────────────────────────────────────
  const renderLibraryPanel = () => {
    if (!picking) return null;

    // 视频用 2 列宽块，其他用 3 列方块
    const cols = kind === "video" ? "grid-cols-2" : "grid-cols-3";

    return (
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
              triggerFilePick();
            }}
          >
            {uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
            上传
          </Button>
        </div>

        {error && <div className="text-xs text-red-500 px-1">⚠ {error}</div>}

        <div className={cn("grid gap-2 max-h-72 overflow-y-auto scrollbar-thin", cols)}>
          {items === null && (
            <div className={cn("text-center text-xs text-muted-foreground py-6", kind === "video" ? "col-span-2" : "col-span-3")}>
              加载中…
            </div>
          )}
          {items && filtered.length === 0 && (
            <div className={cn("text-center text-xs text-muted-foreground py-6", kind === "video" ? "col-span-2" : "col-span-3")}>
              {items.length === 0 ? `还没有 ${KIND_HINT[kind].split(" ")[0]} 素材，点上传添加` : "没有匹配的素材"}
            </div>
          )}
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                handlePickAsset(item);
              }}
              className="text-left p-1.5 rounded-lg border border-border hover:border-foreground/30 hover:bg-secondary/40 transition-colors"
            >
              <div className="aspect-square rounded mb-1 grid place-items-center overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600">
                {item.preview_url || item.thumbnail_url ? (
                  <img src={item.preview_url ?? item.thumbnail_url} className="w-full h-full object-cover" alt={item.name} />
                ) : item.kind === "video" ? (
                  <Video className="size-5 text-white" />
                ) : item.kind === "bgm" ? (
                  <Music className="size-5 text-white" />
                ) : (
                  <ImageIcon className="size-5 text-white" />
                )}
              </div>
              <div className="text-xs font-medium line-clamp-1">{item.name}</div>
              <div className="text-[10px] text-muted-foreground line-clamp-1">
                {item.duration > 0 ? `${item.duration.toFixed(1)}s` : ""}
                {item.tags ? ` · ${item.tags}` : ""}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ── 渲染：未选时的空态 dropzone (仅 upload-only mode) ──────────────────────
  const renderDropzone = () => {
    if (filled || picking) return null;
    if (mode !== "upload") return null;
    return (
      <button
        type="button"
        disabled={uploading}
        onClick={(e) => {
          e.stopPropagation();
          triggerFilePick();
        }}
        className={cn(
          "w-full rounded-lg border-2 border-dashed border-border transition-colors p-6 flex flex-col items-center justify-center gap-2",
          uploading ? "opacity-60 cursor-wait" : "hover:border-violet-500/60 hover:bg-violet-500/[0.02]",
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
            <div className="text-xs text-foreground">点击上传</div>
            <div className="text-[10px] text-muted-foreground">{KIND_HINT[kind]} · ≤ 200MB</div>
          </>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-2">
      {renderPreview()}
      {renderDropzone()}
      {(filled || mode !== "upload") && renderActions()}
      {renderLibraryPanel()}
      {error && !picking && <div className="text-xs text-red-500 px-1">⚠ {error}</div>}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
