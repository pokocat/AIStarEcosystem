"use client";

import { useState } from "react";
import {
  Search,
  Video,
  Image as ImageIcon,
  Music,
  Sticker as StickerIcon,
  Upload,
  Tag,
  ShieldCheck,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/mixcut-zone/ui/card";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Badge } from "@/components/mixcut-zone/ui/badge";
import { Input } from "@/components/mixcut-zone/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/mixcut-zone/ui/tabs";
import { mockStarClips, mockProductClips, mockAssets } from "@/mocks/mixcut";
import { formatDuration, relativeTime } from "@/components/mixcut-zone/lib/utils";

export default function MixcutLibraryPage() {
  const [search, setSearch] = useState("");

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">素材库</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理明星片段、我的商品素材、贴图与 BGM
          </p>
        </div>
        <Button variant="gradient">
          <Plus className="size-4" /> 上传商品素材
        </Button>
      </div>

      <Tabs defaultValue="stars">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="stars" className="gap-1">
              <Video className="size-3" />
              明星片段
              <Badge variant="muted" className="ml-1 text-[10px]">{mockStarClips.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-1">
              <ImageIcon className="size-3" />
              我的商品
              <Badge variant="muted" className="ml-1 text-[10px]">{mockProductClips.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="stickers" className="gap-1">
              <StickerIcon className="size-3" />
              贴图素材
            </TabsTrigger>
            <TabsTrigger value="bgm" className="gap-1">
              <Music className="size-3" />
              BGM
            </TabsTrigger>
          </TabsList>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索素材…"
              className="pl-9 h-9"
            />
          </div>
        </div>

        <TabsContent value="stars">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {mockStarClips
              .filter((s) =>
                !search || s.star_name.includes(search) || s.script_text.includes(search) || s.tags.some((t) => t.includes(search))
              )
              .map((s) => (
                <Card key={s.id} className="overflow-hidden group hover:border-foreground/30 transition-colors">
                  <div className="aspect-[9/16] bg-gradient-to-br from-slate-700 to-slate-950 relative grid place-items-center">
                    <Video className="size-8 text-white/30" />
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                      <div className="text-xs font-medium text-white">{s.star_name}</div>
                    </div>
                    <Badge variant="success" className="absolute top-2 right-2 text-[10px] gap-1">
                      <ShieldCheck className="size-2.5" /> 已授权
                    </Badge>
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white font-mono">
                      {formatDuration(s.duration)}
                    </div>
                  </div>
                  <CardContent className="p-3 space-y-1.5">
                    <div className="text-xs text-muted-foreground line-clamp-2">"{s.script_text}"</div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="muted" className="text-[10px]">{s.script_category}</Badge>
                      {s.tags.slice(0, 2).map((t) => (
                        <span key={t} className="text-[10px] text-muted-foreground">#{t}</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="products">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {mockProductClips
              .filter((p) => !search || p.product_name.includes(search))
              .map((p) => (
                <Card key={p.id} className="overflow-hidden group hover:border-foreground/30 transition-colors">
                  <div className="aspect-square bg-gradient-to-br from-orange-200 to-pink-200 relative grid place-items-center">
                    <ImageIcon className="size-8 text-white/60" />
                    <Badge variant="muted" className="absolute top-2 right-2 text-[10px] bg-black/40 backdrop-blur text-white">
                      {p.media_type}
                    </Badge>
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <div className="text-sm font-medium line-clamp-1">{p.product_name}</div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="muted" className="text-[10px]">{p.category}</Badge>
                    </div>
                    <div className="space-y-1">
                      {p.selling_points.map((sp) => (
                        <div key={sp} className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Tag className="size-2.5" />
                          {sp}
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                      {relativeTime(p.uploaded_at)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            <Card className="aspect-square flex items-center justify-center border-dashed cursor-pointer hover:border-foreground/40 transition-colors">
              <div className="text-center text-muted-foreground">
                <Upload className="size-8 mx-auto mb-2" />
                <div className="text-sm">上传商品素材</div>
                <div className="text-[10px] mt-0.5">支持图片 / 短视频</div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stickers">
          <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {mockAssets
              .filter((a) => a.asset_type === "sticker" || a.asset_type === "title" || a.asset_type === "promo_label")
              .map((a) => (
                <Card key={a.id} className="overflow-hidden hover:border-foreground/30 transition-colors">
                  <div className="aspect-square bg-gradient-to-br from-amber-400 to-orange-500 grid place-items-center">
                    <StickerIcon className="size-7 text-white/80" />
                  </div>
                  <CardContent className="p-2.5">
                    <div className="text-xs font-medium line-clamp-1">{a.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{a.category}</div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="bgm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mockAssets
              .filter((a) => a.asset_type === "bgm")
              .map((a) => (
                <Card key={a.id} className="hover:border-foreground/30 transition-colors">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="size-12 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 grid place-items-center shrink-0">
                      <Music className="size-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{a.name}</div>
                      <div className="text-[10px] text-muted-foreground">{a.category} · 30s · 适配 15s 视频</div>
                      <div className="mt-2 h-6 rounded bg-secondary relative overflow-hidden">
                        <div className="absolute inset-y-0 left-0 flex items-center gap-0.5 px-2">
                          {Array.from({ length: 30 }).map((_, i) => (
                            <div
                              key={i}
                              className="w-0.5 bg-violet-400 rounded"
                              style={{ height: `${30 + Math.abs(Math.sin(i)) * 60}%` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <Music className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
