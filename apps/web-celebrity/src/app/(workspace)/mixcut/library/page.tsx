"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search,
  Video,
  Image as ImageIcon,
  Music,
  Sticker as StickerIcon,
  Upload,
  Trash2,
  Plus,
  Loader2,
  AlertCircle,
  Play,
} from "lucide-react";
import { Card, CardContent } from "@/components/mixcut-zone/ui/card";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Badge } from "@/components/mixcut-zone/ui/badge";
import { Input } from "@/components/mixcut-zone/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/mixcut-zone/ui/tabs";
import { MixcutApi } from "@/api";
import type { MixcutAsset, MixcutAssetKind } from "@/components/mixcut-zone/types";
import { formatDuration, relativeTime, formatBytes } from "@/components/mixcut-zone/lib/utils";

type TabKind = "video" | "image" | "sticker" | "bgm";

const TAB_LABEL: Record<TabKind, string> = {
  video: "明星片段 / 视频",
  image: "商品图",
  sticker: "贴图",
  bgm: "背景音乐",
};

const ACCEPT_MIME: Record<TabKind, string> = {
  video: "video/*",
  image: "image/*",
  sticker: "image/*",
  bgm: "audio/*",
};

export default function MixcutLibraryPage() {
  const [tab, setTab] = useState<TabKind>("video");
  const [assets, setAssets] = useState<Record<TabKind, MixcutAsset[] | null>>({
    video: null,
    image: null,
    sticker: null,
    bgm: null,
  });
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 切 tab 时按需懒加载
  useEffect(() => {
    if (assets[tab] === null) {
      MixcutApi.listAssets({ kind: tab })
        .then((list) => setAssets((s) => ({ ...s, [tab]: list })))
        .catch(() => setAssets((s) => ({ ...s, [tab]: [] })));
    }
  }, [tab, assets]);

  const handleUpload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const created = await MixcutApi.uploadAsset({
        file,
        kind: tab,
        name: file.name,
      });
      setAssets((s) => ({ ...s, [tab]: [created, ...(s[tab] ?? [])] }));
    } catch (e: any) {
      setError(e?.message ?? "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该素材？已使用此素材的任务不受影响（仅影响新任务）。")) return;
    try {
      await MixcutApi.deleteAsset(id);
      setAssets((s) => ({ ...s, [tab]: (s[tab] ?? []).filter((a) => a.id !== id) }));
    } catch (e: any) {
      setError(e?.message ?? "删除失败");
    }
  };

  const filterFn = (a: MixcutAsset) => {
    if (!search) return true;
    return `${a.name} ${a.original_name ?? ""} ${a.tags ?? ""}`.includes(search);
  };

  const current = assets[tab];
  const filtered = (current ?? []).filter(filterFn);

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">素材库</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理上传的视频、商品图、贴图与背景音乐；生成任务时从这里挑素材
          </p>
        </div>
        <Button
          variant="gradient"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          上传到「{TAB_LABEL[tab]}」
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_MIME[tab]}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/[0.04]">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="size-4 shrink-0" /> {error}
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKind)}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="video" className="gap-1">
              <Video className="size-3" />
              视频
              <Badge variant="muted" className="ml-1 text-[10px]">
                {assets.video?.length ?? "…"}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="image" className="gap-1">
              <ImageIcon className="size-3" />
              商品图
              <Badge variant="muted" className="ml-1 text-[10px]">
                {assets.image?.length ?? "…"}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="sticker" className="gap-1">
              <StickerIcon className="size-3" />
              贴图
              <Badge variant="muted" className="ml-1 text-[10px]">
                {assets.sticker?.length ?? "…"}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="bgm" className="gap-1">
              <Music className="size-3" />
              背景音乐
              <Badge variant="muted" className="ml-1 text-[10px]">
                {assets.bgm?.length ?? "…"}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索素材名 / 标签…"
              className="pl-9 h-9"
            />
          </div>
        </div>

        <TabsContent value="video">
          <AssetGrid
            assets={current}
            filtered={filtered}
            kind="video"
            onDelete={handleDelete}
            onUploadClick={() => inputRef.current?.click()}
          />
        </TabsContent>
        <TabsContent value="image">
          <AssetGrid
            assets={current}
            filtered={filtered}
            kind="image"
            onDelete={handleDelete}
            onUploadClick={() => inputRef.current?.click()}
          />
        </TabsContent>
        <TabsContent value="sticker">
          <AssetGrid
            assets={current}
            filtered={filtered}
            kind="sticker"
            onDelete={handleDelete}
            onUploadClick={() => inputRef.current?.click()}
          />
        </TabsContent>
        <TabsContent value="bgm">
          <AssetGrid
            assets={current}
            filtered={filtered}
            kind="bgm"
            onDelete={handleDelete}
            onUploadClick={() => inputRef.current?.click()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AssetGrid({
  assets,
  filtered,
  kind,
  onDelete,
  onUploadClick,
}: {
  assets: MixcutAsset[] | null;
  filtered: MixcutAsset[];
  kind: MixcutAssetKind;
  onDelete: (id: string) => void;
  onUploadClick: () => void;
}) {
  if (assets === null) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground text-sm">
          <Loader2 className="size-6 animate-spin mx-auto mb-2 text-violet-500" />
          加载中…
        </CardContent>
      </Card>
    );
  }

  if (assets.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-12 text-center text-muted-foreground text-sm">
          <Upload className="size-8 mx-auto mb-3" />
          <div className="mb-3">还没有「{TAB_LABEL[kind]}」素材</div>
          <Button variant="outline" size="sm" onClick={onUploadClick}>
            <Plus className="size-3" /> 上传第一个
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (filtered.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground text-sm">
          没有匹配的素材，试试调整搜索关键词
        </CardContent>
      </Card>
    );
  }

  const isMedia = kind === "video";
  const isImage = kind === "image" || kind === "sticker";
  const isAudio = kind === "bgm";

  return (
    <div
      className={
        isMedia
          ? "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
          : isImage
            ? "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4"
            : "grid grid-cols-1 md:grid-cols-2 gap-3"
      }
    >
      {filtered.map((a) => (
        <Card key={a.id} className="overflow-hidden group hover:border-foreground/30 transition-colors">
          {isMedia && <VideoThumb asset={a} />}
          {isImage && (
            <div className="aspect-square bg-secondary/30 grid place-items-center overflow-hidden">
              <img src={a.file_url} alt={a.name} className="w-full h-full object-cover" />
            </div>
          )}
          {isAudio && (
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-12 rounded-lg bg-violet-500 grid place-items-center shrink-0">
                <Music className="size-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {a.duration > 0 ? formatDuration(a.duration) : ""} · {formatBytes(a.file_size)}
                </div>
                <audio src={a.file_url} controls className="mt-2 w-full h-7" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => onDelete(a.id)}
              >
                <Trash2 className="size-3.5 text-muted-foreground" />
              </Button>
            </CardContent>
          )}

          {!isAudio && (
            <CardContent className="p-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <div className="text-sm font-medium line-clamp-1 flex-1">{a.name}</div>
                <button
                  onClick={() => onDelete(a.id)}
                  className="size-6 rounded grid place-items-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                  title="删除"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="muted" className="text-[10px]">{TAB_LABEL[a.kind as TabKind] ?? a.kind}</Badge>
                {a.tags && <span className="text-[10px] text-muted-foreground">#{a.tags}</span>}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {formatBytes(a.file_size)} · {relativeTime(a.uploaded_at)}
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

// 视频缩略图:
//  - 默认状态:16:9 容器 + object-cover 中心裁切(无黑边、视觉像图片画廊),叠 play 按钮 + 时长徽标
//  - 点击激活:切到 object-contain 显示完整画面 + 原生 controls(含进度条)
// 改造点:
//  ① 去掉 hover 自动播放(扫视列表不会被打扰)
//  ② 进度条 / 暂停 / 音量 / 全屏走浏览器原生 controls,免造轮子
//  ③ 容器保持 aspect-video 不变高,避免「太长」;但用 object-cover 化掉竖屏黑边
function VideoThumb({ asset }: { asset: MixcutAsset }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activated, setActivated] = useState(false);

  const handleActivate = () => {
    setActivated(true);
    // controls 切到 visible 后,下一 tick 调 play 避免被叠层吞掉
    requestAnimationFrame(() => {
      videoRef.current?.play().catch(() => {});
    });
  };

  return (
    <div className="aspect-video bg-black relative overflow-hidden">
      <video
        ref={videoRef}
        src={asset.file_url}
        className={`w-full h-full transition-[object-fit] ${activated ? "object-contain" : "object-cover"}`}
        playsInline
        preload="metadata"
        controls={activated}
        onPlay={() => setActivated(true)}
      />
      {!activated && (
        <>
          <button
            type="button"
            onClick={handleActivate}
            className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/40 via-transparent to-black/10 hover:from-black/60 hover:to-black/20 transition-colors"
            aria-label="播放预览"
          >
            <span className="size-11 rounded-full bg-white/95 grid place-items-center shadow-lg transition-transform group-hover:scale-105">
              <Play className="size-4 text-black translate-x-0.5" fill="currentColor" />
            </span>
          </button>
          {asset.duration > 0 && (
            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono pointer-events-none">
              {formatDuration(asset.duration)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
