"use client";

// 资产详情（任务书 §7）：图集/3D/视频/版本时间线/授权 Tab + 7 步工作流动作区 + 实现方式面板。
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Copy, Cuboid, Download, FlaskConical, History, ImageIcon,
  Loader2, ScrollText, ShieldCheck, Video, Workflow,
} from "lucide-react";
import type { AiAvatarDetail } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { AiAvatarApi } from "@/api";
import { StatusPill } from "@/components/common/status-pill";
import { PipelineStepper } from "@/components/common/pipeline-stepper";
import { useConfirm } from "@/components/common/confirm-dialog";
import { WorkflowActionBar } from "./workflow-action-bar";
import { AssetsTab } from "./tabs/assets-tab";
import { VersionsTab } from "./tabs/versions-tab";
import { SourceTab } from "./tabs/source-tab";
import { LicenseTab } from "./tabs/license-tab";
import { DeriveTab } from "./tabs/derive-tab";
import { shortId } from "@/lib/format";

type Tab = "assets" | "3d" | "video" | "versions" | "source" | "license" | "derive";

export function AvatarDetailClient({ avatarId }: { avatarId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const confirm = useConfirm();
  const [detail, setDetail] = React.useState<AiAvatarDetail | null>(null);
  const [tab, setTab] = React.useState<Tab>("assets");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const d = await AiAvatarApi.getDetail(avatarId).catch(() => null);
    setDetail(d);
  }, [avatarId]);
  React.useEffect(() => { load(); }, [load]);

  // onboarding：真人路径首进 source tab，AI 路径默认 assets
  React.useEffect(() => {
    if (search.get("onboarding") === "real_clone") setTab("source");
  }, [search]);

  // 有进行中任务时轮询刷新详情
  const hasActive = (detail?.recentJobs ?? []).some((j) => j.status === "running" || j.status === "queued");
  React.useEffect(() => {
    if (!hasActive) return;
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [hasActive, load]);

  if (!detail) {
    return <div className="flex h-64 items-center justify-center text-zinc-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载中…</div>;
  }

  const { avatar } = detail;
  const assets = detail.assets;
  const images = assets.filter((a) => a.kind === "image_2d" || a.kind === "draft_image" || a.kind === "expression_image");
  const models = assets.filter((a) => a.kind === "model_3d");
  const videos = assets.filter((a) => a.kind === "video");

  const copyId = async () => {
    try { await navigator.clipboard.writeText(avatar.id); } catch { /* ignore */ }
  };

  const doFork = async () => {
    const ok = await confirm({ title: "另存为新AiAvatar", description: "将复制当前人设与风格，创建一个状态回到草稿的新AiAvatar。", confirmText: "另存为" });
    if (!ok) return;
    setBusy(true);
    try {
      const copy = await AiAvatarApi.forkAvatar(avatar.id);
      router.push(`/avatar/${copy.id}`);
    } finally { setBusy(false); }
  };

  const doArchive = async () => {
    const ok = await confirm({ title: "归档入库", description: "归档后该AiAvatar进入只读资产库。", confirmText: "归档", tone: "default" });
    if (!ok) return;
    setBusy(true);
    try { await AiAvatarApi.archiveAvatar(avatar.id); await load(); } finally { setBusy(false); }
  };

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { key: "assets", label: "图集", icon: ImageIcon, count: images.length },
    { key: "3d", label: "3D", icon: Cuboid, count: models.length },
    { key: "video", label: "视频", icon: Video, count: videos.length },
    { key: "versions", label: "版本时间线", icon: History, count: detail.versions.length },
    { key: "source", label: "素材", icon: ScrollText, count: detail.sourceMaterials.length },
    { key: "license", label: "授权", icon: ShieldCheck, count: detail.licenses.length },
    { key: "derive", label: "衍生", icon: Workflow },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link href="/library" className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300">
        <ArrowLeft className="h-4 w-4" /> 资产总库
      </Link>

      {/* 头部 */}
      <div className="flex flex-wrap items-start gap-4 rounded-xl border border-zinc-800 bg-[var(--bg-1)] p-4">
        <div className="h-28 w-22 shrink-0 overflow-hidden rounded-lg">
          {avatar.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar.coverUrl} alt={avatar.name} className="h-full w-full object-cover" />
          ) : <div className="ph h-full w-full" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-zinc-100">{avatar.name}</h1>
            <StatusPill status={avatar.status} />
            <span className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">{avatar.mode === "real_clone" ? "真人复刻" : "AI 原创"}</span>
            {avatar.forkedFromAvatarId && <span className="rounded bg-violet-500/15 px-2 py-0.5 text-[11px] text-violet-300">另存副本</span>}
          </div>
          {avatar.persona && <p className="mt-1.5 line-clamp-2 text-sm text-zinc-400">{avatar.persona}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {avatar.styleCategory && <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] text-zinc-300">{avatar.styleCategory}</span>}
            {avatar.tags.map((t) => <span key={t} className="rounded-full bg-zinc-800/60 px-2 py-0.5 text-[11px] text-zinc-500">#{t}</span>)}
          </div>
          <button onClick={copyId} className="meta mt-2 flex items-center gap-1 hover:text-zinc-300">
            <Copy className="h-3 w-3" /> ID {shortId(avatar.id)}
          </button>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button onClick={doFork} disabled={busy} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500">
            另存为新AiAvatar
          </button>
          {avatar.status !== "archived" && (
            <button onClick={doArchive} disabled={busy} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500">
              归档入库
            </button>
          )}
        </div>
      </div>

      {/* 7 步链路 + 工作流动作区 */}
      <div className="rounded-xl border border-zinc-800 bg-[var(--bg-1)] p-4">
        <PipelineStepper status={avatar.status} className="mb-4" />
        <WorkflowActionBar detail={detail} onChanged={load} onGoTab={(t) => setTab(t as Tab)} />
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 overflow-x-auto border-b border-zinc-800">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn("flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition",
                  tab === t.key ? "border-amber-500 text-amber-300" : "border-transparent text-zinc-400 hover:text-zinc-200")}>
                <Icon className="h-4 w-4" /> {t.label}
                {t.count != null && t.count > 0 && <span className="rounded-full bg-zinc-800 px-1.5 text-[10px] text-zinc-400">{t.count}</span>}
              </button>
            );
          })}
        </div>
        <div className="pt-4">
          {tab === "assets" && <AssetsTab assets={images} />}
          {tab === "3d" && <AssetsTab assets={models} empty="尚无 3D 模型 · 定稿后可在「衍生」生成" ratio="square" />}
          {tab === "video" && <AssetsTab assets={videos} empty="尚无衍生视频 · 定稿后可在「衍生」生成" />}
          {tab === "versions" && <VersionsTab detail={detail} onChanged={load} />}
          {tab === "source" && <SourceTab detail={detail} onChanged={load} />}
          {tab === "license" && <LicenseTab detail={detail} onChanged={load} />}
          {tab === "derive" && <DeriveTab detail={detail} onChanged={load} />}
        </div>
      </div>
    </div>
  );
}
