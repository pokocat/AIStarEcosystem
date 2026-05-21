"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/mixcut-zone/ui/card";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Badge } from "@/components/mixcut-zone/ui/badge";
import { Input } from "@/components/mixcut-zone/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/mixcut-zone/ui/tabs";
import { MixcutApi } from "@/api";
import type {
  MixcutAsset,
  MixcutAssetKind,
  RenderJob,
  RenderOutput,
} from "@/components/mixcut-zone/types";
import { formatDuration, relativeTime, formatBytes } from "@/components/mixcut-zone/lib/utils";
import { useConfirm } from "@/components/common/confirm-dialog";

type TopTab = "assets" | "videos" | "official";

// v0.21+: 顶层三分区
//   - assets   我的素材  ← 自己上传的视频 / 商品图 / 贴图 / 背景音乐
//   - videos   我的视频  ← 已生成的混剪成片（可软删 30 天）
//   - official 官方明星片段  ← 后台运营上传的直播切片等（只读消费）
export default function MixcutLibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 lg:px-8 py-12 max-w-[1600px] mx-auto text-center text-muted-foreground text-sm">
          加载中…
        </div>
      }
    >
      <LibraryShell />
    </Suspense>
  );
}

function LibraryShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams?.get("tab") as TopTab) ?? "assets";
  const [topTab, setTopTab] = useState<TopTab>(
    initialTab === "videos" || initialTab === "official" ? initialTab : "assets",
  );

  const handleTabChange = (v: TopTab) => {
    setTopTab(v);
    // 软同步 URL（不刷新页面），便于深链分享
    const url = new URL(window.location.href);
    if (v === "assets") url.searchParams.delete("tab");
    else url.searchParams.set("tab", v);
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  };

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">我的混剪库</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理自己上传的素材、生成的视频，以及平台提供的官方明星片段
        </p>
      </div>

      <Tabs value={topTab} onValueChange={(v) => handleTabChange(v as TopTab)}>
        <TabsList>
          <TabsTrigger value="assets">我的素材</TabsTrigger>
          <TabsTrigger value="videos">我的视频</TabsTrigger>
          <TabsTrigger value="official">官方明星片段</TabsTrigger>
        </TabsList>

        <TabsContent value="assets">
          <AssetsTab />
        </TabsContent>
        <TabsContent value="videos">
          <MyVideosTab />
        </TabsContent>
        <TabsContent value="official">
          <OfficialClipsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── 我的素材 tab：原有 4 个 sub-tab（视频 / 商品图 / 贴图 / 背景音乐） ───────────

type SubTab = "video" | "image" | "sticker" | "bgm";

const TAB_LABEL: Record<SubTab, string> = {
  video: "明星片段 / 视频",
  image: "商品图",
  sticker: "贴图",
  bgm: "背景音乐",
};

const ACCEPT_MIME: Record<SubTab, string> = {
  video: "video/*",
  image: "image/*",
  sticker: "image/*",
  bgm: "audio/*",
};

function AssetsTab() {
  const [sub, setSub] = useState<SubTab>("video");
  const [assets, setAssets] = useState<Record<SubTab, MixcutAsset[] | null>>({
    video: null,
    image: null,
    sticker: null,
    bgm: null,
  });
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { confirm, ConfirmHost } = useConfirm();

  useEffect(() => {
    if (assets[sub] === null) {
      MixcutApi.listAssets({ kind: sub })
        .then((list) => setAssets((s) => ({ ...s, [sub]: list })))
        .catch(() => setAssets((s) => ({ ...s, [sub]: [] })));
    }
  }, [sub, assets]);

  const handleUpload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const created = await MixcutApi.uploadAsset({
        file,
        kind: sub,
        name: file.name,
      });
      setAssets((s) => ({ ...s, [sub]: [created, ...(s[sub] ?? [])] }));
    } catch (e: any) {
      setError(e?.message ?? "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "删除该素材？",
      description: "已使用此素材的历史任务不受影响，仅影响后续新任务。",
      confirmText: "删除",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await MixcutApi.deleteAsset(id);
      setAssets((s) => ({ ...s, [sub]: (s[sub] ?? []).filter((a) => a.id !== id) }));
    } catch (e: any) {
      setError(e?.message ?? "删除失败");
    }
  };

  const filterFn = (a: MixcutAsset) => {
    if (!search) return true;
    return `${a.name} ${a.original_name ?? ""} ${a.tags ?? ""}`.includes(search);
  };

  const current = assets[sub];
  const filtered = (current ?? []).filter(filterFn);

  return (
    <div className="space-y-5 mt-4">
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="gradient"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          上传到「{TAB_LABEL[sub]}」
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_MIME[sub]}
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

      <Tabs value={sub} onValueChange={(v) => setSub(v as SubTab)}>
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

        {(["video", "image", "sticker", "bgm"] as SubTab[]).map((k) => (
          <TabsContent key={k} value={k}>
            <AssetGrid
              assets={current}
              filtered={filtered}
              kind={k as MixcutAssetKind}
              onDelete={handleDelete}
              onUploadClick={() => inputRef.current?.click()}
            />
          </TabsContent>
        ))}
      </Tabs>
      <ConfirmHost />
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
          <div className="mb-3">还没有「{TAB_LABEL[kind as SubTab]}」素材</div>
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
                <Badge variant="muted" className="text-[10px]">{TAB_LABEL[a.kind as SubTab] ?? a.kind}</Badge>
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

// 视频缩略图（保持原行为：点击激活 controls + 中心裁切预览）
function VideoThumb({ asset }: { asset: MixcutAsset }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activated, setActivated] = useState(false);

  const handleActivate = () => {
    setActivated(true);
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

// ── 我的视频 tab：展示已生成的混剪成片，支持软删 ───────────────────────────

type EligibleOutput = RenderOutput & {
  cdn_url?: string;
  cdn_thumbnail_url?: string;
  publish_count?: number;
};

interface VideoItem {
  jobId: string;
  templateName: string;
  output: EligibleOutput;
}

function MyVideosTab() {
  const [jobs, setJobs] = useState<RenderJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { confirm, ConfirmHost } = useConfirm();

  const load = async () => {
    try {
      const list = await MixcutApi.listJobs();
      setJobs(list ?? []);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "加载失败");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const items: VideoItem[] = (() => {
    if (!jobs) return [];
    const result: VideoItem[] = [];
    for (const j of jobs) {
      if (j.status !== "success") continue;
      const outs = (j.outputs ?? []) as EligibleOutput[];
      for (const o of outs) {
        // 仅展示渲染完成的（含未上传 CDN 的也允许删除）
        if (!o.file_url && !o.cdn_url) continue;
        result.push({
          jobId: j.id,
          templateName: j.template_name ?? j.template_id,
          output: o,
        });
      }
    }
    result.sort((a, b) => {
      const ta = new Date(a.output.created_at).getTime();
      const tb = new Date(b.output.created_at).getTime();
      return tb - ta;
    });
    return result;
  })();

  const filtered = items.filter((it) => {
    const ql = search.trim().toLowerCase();
    if (!ql) return true;
    return (
      it.templateName.toLowerCase().includes(ql) ||
      it.jobId.toLowerCase().includes(ql)
    );
  });

  const handleDelete = async (outputId: string) => {
    if (deletingId) return;
    const ok = await confirm({
      title: "删除这条视频？",
      description: (
        <>
          <p>删除后 30 天内可联系客服恢复，30 天后将自动清理。</p>
          <p className="text-muted-foreground/80 mt-1">已分发的历史任务不受影响。</p>
        </>
      ),
      confirmText: "删除",
      tone: "danger",
    });
    if (!ok) return;
    setDeletingId(outputId);
    try {
      await MixcutApi.deleteOutput(outputId);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  if (jobs === null && !error) {
    return (
      <Card className="mt-4">
        <CardContent className="p-12 text-center text-muted-foreground text-sm">
          <Loader2 className="size-6 animate-spin mx-auto mb-2 text-violet-500" />
          加载中…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground">
          共 <span className="font-mono text-foreground">{filtered.length}</span> 条已生成视频；删除后 30 天内可恢复
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索模板 / 任务名…"
            className="pl-9 h-9"
          />
        </div>
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/[0.04]">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="size-4 shrink-0" /> {error}
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 && !error ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-muted-foreground text-sm">
            <Sparkles className="size-6 mx-auto mb-2 text-zinc-400" />
            还没有已生成的视频。先去模板库挑一个模板，生成一批吧。
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((it) => (
            <VideoCard
              key={it.output.id}
              item={it}
              deleting={deletingId === it.output.id}
              onDelete={() => handleDelete(it.output.id)}
            />
          ))}
        </div>
      )}
      <ConfirmHost />
    </div>
  );
}

function VideoCard({
  item,
  deleting,
  onDelete,
}: {
  item: VideoItem;
  deleting: boolean;
  onDelete: () => void;
}) {
  const thumb = item.output.cdn_thumbnail_url || item.output.thumbnail_url;
  const publishCount = item.output.publish_count ?? 0;
  return (
    <Card className="overflow-hidden group hover:border-foreground/30 transition-colors">
      <div className="relative aspect-[9/16] bg-secondary/40">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground text-xs">
            无预览
          </div>
        )}
        <div className="absolute top-1.5 left-1.5">
          <span className="text-[10px] font-mono bg-black/65 text-white px-1.5 py-0.5 rounded">
            第 {item.output.variant_index + 1} 条
          </span>
        </div>
        {publishCount > 0 && (
          <div className="absolute top-1.5 right-1.5">
            <span className="text-[10px] bg-emerald-500/85 text-white px-1.5 py-0.5 rounded">
              已分发 ×{publishCount}
            </span>
          </div>
        )}
      </div>
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start gap-2">
          <div className="text-sm font-medium line-clamp-1 flex-1" title={item.templateName}>
            {item.templateName}
          </div>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="size-6 rounded grid place-items-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0 disabled:opacity-50"
            title="删除视频"
          >
            {deleting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </button>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {relativeTime(item.output.created_at)}
        </div>
      </CardContent>
    </Card>
  );
}

// ── 官方明星片段 tab：运营后台上传，用户只读消费 ─────────────────────────────

function OfficialClipsTab() {
  const [clips, setClips] = useState<MixcutAsset[] | null>(null);
  const [category, setCategory] = useState<string>("全部");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    MixcutApi.listOfficialClips()
      .then((list) => setClips(list ?? []))
      .catch((e: any) => {
        setError(e?.message ?? "加载失败");
        setClips([]);
      });
  }, []);

  const allCategories = (() => {
    const set = new Set<string>();
    for (const a of clips ?? []) {
      if (a.official_category) set.add(a.official_category);
    }
    return ["全部", ...Array.from(set).sort()];
  })();

  const filtered = (clips ?? []).filter(
    (a) => category === "全部" || a.official_category === category,
  );

  if (clips === null && !error) {
    return (
      <Card className="mt-4">
        <CardContent className="p-12 text-center text-muted-foreground text-sm">
          <Loader2 className="size-6 animate-spin mx-auto mb-2 text-violet-500" />
          加载中…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground">
          由平台运营整理的明星直播切片 / 综艺 / 访谈片段，可直接用作混剪素材
        </div>
      </div>

      {allCategories.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {allCategories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={
                "px-3 py-1 rounded-full text-xs transition-colors border " +
                (category === c
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground")
              }
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {error && (
        <Card className="border-red-500/30 bg-red-500/[0.04]">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="size-4 shrink-0" /> {error}
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 && !error ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-muted-foreground text-sm space-y-2">
            <Sparkles className="size-6 mx-auto text-violet-500" />
            <p>暂无官方片段。运营正在上传首批内容，敬请期待。</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((a) => (
            <Card key={a.id} className="overflow-hidden hover:border-foreground/30 transition-colors">
              <div className="aspect-video bg-black relative overflow-hidden">
                <VideoThumb asset={a} />
              </div>
              <CardContent className="p-3 space-y-1.5">
                <div className="text-sm font-medium line-clamp-1" title={a.name}>{a.name}</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {a.official_category && (
                    <Badge variant="muted" className="text-[10px]">{a.official_category}</Badge>
                  )}
                  {a.tags && <span className="text-[10px] text-muted-foreground">#{a.tags}</span>}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {a.duration > 0 ? formatDuration(a.duration) : ""} · {formatBytes(a.file_size)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
