"use client";

// 视频库（一级入口）——聚合三类成片视频，只读浏览。
//   project   明星视频   ← 明星项目主线成片（CelebrityProjectVideo）
//   material  脚本视频   ← 素材运营脚本派生带货视频（MaterialVideo），点击跳商品素材库操作
//   mixcut    混剪成片   ← 混剪生成成片（RenderOutput）
// 来源用顶层 Tab 区分，URL ?source= 软同步。三类数据各读各的现有 API，互不融合。
// 生产功能（脚本工坊 / 商品素材库 / 混剪素材）保留在各自原菜单，本页只做浏览聚合。

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/mixcut-zone/ui/tabs";
import { CelebrityVideoLibrary } from "@/components/celebrity-zone/CelebrityVideoLibrary";
import { ScriptVideosTab } from "@/components/celebrity-zone/ScriptVideosTab";
import { MixcutOutputsTab } from "@/components/mixcut-zone/MixcutOutputsTab";
import { deleteVideo as deleteCelebrityVideo, listAllVideos, listProjects, listStars } from "@/api/celebrity-zone";
import { useAuth } from "@ai-star-eco/api-client";
import { useConfirm } from "@/components/common/confirm-dialog";
import { canUseOperatorTools } from "@/lib/operator-role";
import type {
  CelebrityProject,
  CelebrityProjectVideo,
  CelebrityStar,
} from "@ai-star-eco/types/celebrity-zone";

type Source = "project" | "material" | "mixcut";

export default function CelebrityLibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1600px] px-6 py-12 text-center text-sm text-muted-foreground lg:px-8">
          加载中
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
  const raw = searchParams?.get("source");
  const source: Source = raw === "material" || raw === "mixcut" ? raw : "project";

  const handleSourceChange = (v: Source) => {
    const url = new URL(window.location.href);
    if (v === "project") url.searchParams.delete("source");
    else url.searchParams.set("source", v);
    // 切来源时清掉脚本视频专用的 product 深链参数，避免串到别的来源。
    url.searchParams.delete("product");
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-6 py-5 lg:px-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">视频库</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          汇总浏览明星项目视频、脚本派生带货视频与混剪成片
        </p>
      </div>

      <Tabs value={source} onValueChange={(v) => handleSourceChange(v as Source)}>
        <TabsList className="h-auto">
          <TabsTrigger className="mobile-touch-target" value="project">明星视频</TabsTrigger>
          <TabsTrigger className="mobile-touch-target" value="material">脚本视频</TabsTrigger>
          <TabsTrigger className="mobile-touch-target" value="mixcut">混剪成片</TabsTrigger>
        </TabsList>

        {/* 仅渲染当前 active 来源，避免首屏同时打三套接口 */}
        <TabsContent value="project">
          {source === "project" && <ProjectVideosTab />}
        </TabsContent>
        <TabsContent value="material">
          {source === "material" && <ScriptVideosTab />}
        </TabsContent>
        <TabsContent value="mixcut">
          {source === "mixcut" && <MixcutOutputsTab />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// 明星项目视频：接通真后端（listAllVideos + listProjects + listStars），USE_MOCK / 失败回退 mocks。
function ProjectVideosTab() {
  const { user } = useAuth();
  const canDeleteVideos = canUseOperatorTools(user?.operatorRole);
  const { confirm, ConfirmHost } = useConfirm();
  const [videos, setVideos] = useState<CelebrityProjectVideo[]>([]);
  const [stars, setStars] = useState<CelebrityStar[]>([]);
  const [projects, setProjects] = useState<CelebrityProject[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [v, p, s] = await Promise.all([listAllVideos(), listProjects(), listStars()]);
        if (cancelled) return;
        setVideos(v);
        setProjects(p);
        setStars(s);
      } catch {
        // 失败时保持空态，避免生产环境显示本地 mock 数据。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDeleteVideo = async (video: CelebrityProjectVideo) => {
    if (!canDeleteVideos || deletingId) return;
    const ok = await confirm({
      title: "删除视频?",
      description: (
        <span>
          删除后会立即从视频库隐藏，后台保留软删记录，后续可做恢复或审计。
        </span>
      ),
      confirmText: "删除",
      tone: "danger",
    });
    if (!ok) return;
    setDeletingId(video.id);
    try {
      const deleted = await deleteCelebrityVideo(video.id);
      if (deleted) setVideos((prev) => prev.filter((v) => v.id !== video.id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <CelebrityVideoLibrary
        videos={videos}
        stars={stars}
        projects={projects}
        canDeleteVideos={canDeleteVideos}
        deletingId={deletingId}
        onDeleteVideo={handleDeleteVideo}
      />
      <ConfirmHost />
    </>
  );
}
