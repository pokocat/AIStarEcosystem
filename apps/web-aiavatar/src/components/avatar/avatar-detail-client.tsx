"use client";

// 资产详情 = 单个 AiAvatar 的"生产工作台"。
// 行动区（当前阶段 + 下一步主操作）置顶为焦点；检视区收敛为 3 个标签：产出 / 版本 / 输入与授权。
// （旧版 7 个并列 tab 把"下一步"埋没 —— 重设计后主线一眼可见。）
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Archive, Copy, Cuboid, Check, FileStack, History, ImageIcon, Layers,
  Loader2, ScrollText, Video,
} from "lucide-react";
import type { AiAvatarDetail } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { AiAvatarApi } from "@/api";
import { StatusPill } from "@/components/common/status-pill";
import { PipelineStepper } from "@/components/common/pipeline-stepper";
import { useConfirm } from "@/components/common/confirm-dialog";
import { SafeImg } from "@/components/common/safe-img";
import { WorkflowActionBar } from "./workflow-action-bar";
import { AssetsTab } from "./tabs/assets-tab";
import { VersionsTab } from "./tabs/versions-tab";
import { SourceTab } from "./tabs/source-tab";
import { LicenseTab } from "./tabs/license-tab";
import { shortId } from "@/lib/format";

type Tab = "outputs" | "versions" | "inputs";
type OutKind = "image" | "3d" | "video";

export function AvatarDetailClient({ avatarId }: { avatarId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const confirm = useConfirm();
  const [detail, setDetail] = React.useState<AiAvatarDetail | null>(null);
  const [tab, setTab] = React.useState<Tab>("outputs");
  const [outKind, setOutKind] = React.useState<OutKind>("image");
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(async () => {
    const d = await AiAvatarApi.getDetail(avatarId).catch(() => null);
    setDetail(d);
  }, [avatarId]);
  React.useEffect(() => { load(); }, [load]);

  // 真人路径首进「输入与授权」（先建素材 + 授权）；AI 路径默认「产出」。
  React.useEffect(() => { if (search.get("onboarding") === "real_clone") setTab("inputs"); }, [search]);

  const hasActive = (detail?.recentJobs ?? []).some((j) => j.status === "running" || j.status === "queued");
  React.useEffect(() => {
    if (!hasActive) return;
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [hasActive, load]);

  if (!detail) {
    return <div className="flex h-64 items-center justify-center text-[var(--fg-3)]"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载中…</div>;
  }

  const { avatar } = detail;
  const images = detail.assets.filter((a) => a.kind === "image_2d" || a.kind === "draft_image" || a.kind === "expression_image");
  const models = detail.assets.filter((a) => a.kind === "model_3d");
  const videos = detail.assets.filter((a) => a.kind === "video");

  const copyId = async () => {
    try { await navigator.clipboard.writeText(avatar.id); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  const doFork = async () => {
    const ok = await confirm({ title: "另存为新 AiAvatar", description: "将复制当前人设与风格，创建一个状态回到草稿的新 AiAvatar。", confirmText: "另存为" });
    if (!ok) return;
    setBusy(true);
    try { const copy = await AiAvatarApi.forkAvatar(avatar.id); router.push(`/avatar/${copy.id}`); }
    finally { setBusy(false); }
  };

  const doArchive = async () => {
    const ok = await confirm({ title: "归档入库", description: "归档后该 AiAvatar 进入只读资产库。", confirmText: "归档" });
    if (!ok) return;
    setBusy(true);
    try { await AiAvatarApi.archiveAvatar(avatar.id); await load(); } finally { setBusy(false); }
  };

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { key: "outputs", label: "产出", icon: Layers, count: images.length + models.length + videos.length },
    { key: "versions", label: "版本时间线", icon: History, count: detail.versions.length },
    { key: "inputs", label: avatar.mode === "real_clone" ? "输入与授权" : "输入素材", icon: FileStack, count: detail.sourceMaterials.length + detail.licenses.length },
  ];

  const outSegs: { key: OutKind; label: string; icon: React.ComponentType<{ className?: string }>; count: number }[] = [
    { key: "image", label: "图集", icon: ImageIcon, count: images.length },
    { key: "3d", label: "3D", icon: Cuboid, count: models.length },
    { key: "video", label: "视频", icon: Video, count: videos.length },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link href="/library" className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-2)] transition hover:text-[var(--fg-0)]">
        <ArrowLeft className="h-4 w-4" /> 资产库
      </Link>

      {/* 头部 */}
      <div className="flex flex-wrap items-start gap-4 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
        <div className="aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-lg border border-[var(--line)]">
          <SafeImg src={avatar.coverUrl} alt={avatar.name} className="h-full w-full" imgClassName="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-[var(--fg-0)]">{avatar.name}</h1>
            <StatusPill status={avatar.status} />
            <span className="rounded-md bg-[var(--bg-2)] px-2 py-0.5 text-[11px] text-[var(--fg-1)]">{avatar.mode === "real_clone" ? "真人复刻" : "AI 原创"}</span>
            {avatar.forkedFromAvatarId && <span className="rounded-md bg-[var(--violet-soft)] px-2 py-0.5 text-[11px] text-[var(--violet)]">另存副本</span>}
          </div>
          {avatar.persona && <p className="mt-1.5 line-clamp-2 text-sm text-[var(--fg-2)]">{avatar.persona}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {avatar.styleCategory && <span className="rounded-full bg-[var(--bg-2)] px-2.5 py-0.5 text-[11px] text-[var(--fg-1)]">{avatar.styleCategory}</span>}
            {avatar.tags.map((t) => <span key={t} className="rounded-full bg-[var(--bg-2)] px-2 py-0.5 text-[11px] text-[var(--fg-2)]">#{t}</span>)}
          </div>
          <button onClick={copyId} className="mt-2.5 inline-flex items-center gap-1 text-[var(--fg-3)] transition hover:text-[var(--fg-1)]">
            {copied ? <Check className="h-3 w-3 text-[var(--success)]" /> : <Copy className="h-3 w-3" />}
            <span className="num text-[11px]">{copied ? "已复制" : `ID ${shortId(avatar.id)}`}</span>
          </button>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button onClick={doFork} disabled={busy} className="btn btn-ghost btn-sm">另存为新 AiAvatar</button>
          {avatar.status !== "archived" && (
            <button onClick={doArchive} disabled={busy} className="btn btn-ghost btn-sm"><Archive className="h-3.5 w-3.5" /> 归档入库</button>
          )}
        </div>
      </div>

      {/* 链路 + 当前阶段行动区（焦点） */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
        <PipelineStepper status={avatar.status} className="mb-4 border-b border-[var(--line)] pb-4" />
        <WorkflowActionBar detail={detail} onChanged={load} onGoTab={(t) => setTab(t as Tab)} />
      </div>

      {/* 检视区 */}
      <div>
        <div className="flex gap-1 border-b border-[var(--line)]">
          {tabs.map((t) => {
            const Icon = t.icon;
            const on = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn("-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition",
                  on ? "border-[var(--brand)] font-medium text-[var(--fg-0)]" : "border-transparent text-[var(--fg-2)] hover:text-[var(--fg-0)]")}>
                <Icon className="h-4 w-4" /> {t.label}
                {t.count != null && t.count > 0 && (
                  <span className="num rounded-full bg-[var(--bg-2)] px-1.5 text-[10px] text-[var(--fg-2)]">{t.count}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="pt-4">
          {tab === "outputs" && (
            <div className="space-y-4">
              <div className="seg w-fit">
                {outSegs.map((sg) => {
                  const Icon = sg.icon;
                  return (
                    <button key={sg.key} onClick={() => setOutKind(sg.key)} data-on={outKind === sg.key} className="seg-item">
                      <Icon className="h-3.5 w-3.5" /> {sg.label}
                      <span className="num opacity-70">{sg.count}</span>
                    </button>
                  );
                })}
              </div>
              {outKind === "image" && <AssetsTab assets={images} empty="尚无图片 · 从打样开始生成" />}
              {outKind === "3d" && <AssetsTab assets={models} empty="尚无 3D 模型 · 定稿后在当前阶段衍生" ratio="square" />}
              {outKind === "video" && <AssetsTab assets={videos} empty="尚无衍生视频 · 定稿后在当前阶段衍生" />}
            </div>
          )}
          {tab === "versions" && <VersionsTab detail={detail} onChanged={load} />}
          {tab === "inputs" && (
            <div className="space-y-6">
              <SourceTab detail={detail} onChanged={load} />
              {avatar.mode === "real_clone" && (
                <div className="border-t border-[var(--line)] pt-5">
                  <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-[var(--fg-0)]"><ScrollText className="h-4 w-4" /> 肖像授权</div>
                  <LicenseTab detail={detail} onChanged={load} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
