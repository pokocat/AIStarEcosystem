"use client";

// 7 步工作流动作区：按当前状态展示「下一步」主操作 + 进行中任务进度 + 实现方式说明面板。
import * as React from "react";
import { Cpu, Loader2, Play, Sparkles, Wand2 } from "lucide-react";
import type { AiAvatarDetail, AiAvatarJob } from "@ai-star-eco/types/ai-avatar";
import { AiAvatarApi } from "@/api";
import { JobStatusPill } from "@/components/common/status-pill";
import { SourceBadge } from "@/components/common/source-badge";
import { SamplingDialog } from "./dialogs/sampling-dialog";
import { DraftIterateDialog } from "./dialogs/draft-iterate-dialog";
import { TemplateBeautifyDialog } from "./dialogs/template-beautify-dialog";

export function WorkflowActionBar({
  detail, onChanged, onGoTab,
}: {
  detail: AiAvatarDetail; onChanged: () => void; onGoTab: (t: string) => void;
}) {
  const { avatar } = detail;
  const [busy, setBusy] = React.useState(false);
  const [openSampling, setOpenSampling] = React.useState(false);
  const [openDraft, setOpenDraft] = React.useState(false);
  const [openBeautify, setOpenBeautify] = React.useState(false);

  const activeJob = detail.recentJobs.find((j) => j.status === "running" || j.status === "queued");

  const finalize = async () => {
    setBusy(true);
    try { await AiAvatarApi.finalize(avatar.id, {}); onChanged(); }
    catch (e) { alert(e instanceof Error ? e.message : "定稿失败"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      {/* 进行中任务 */}
      {activeJob && <ActiveJobBar job={activeJob} onDone={onChanged} />}

      {/* 下一步动作（按状态） */}
      {!activeJob && (
        <div className="flex flex-wrap items-center gap-2">
          {(avatar.status === "draft" || avatar.status === "sampling") && (
            <Primary onClick={() => setOpenSampling(true)} icon={Sparkles}>
              {avatar.status === "draft" ? "开始打样" : "重新打样"}
            </Primary>
          )}
          {(avatar.status === "sampling" || avatar.status === "draft_iterating") && (
            <Secondary onClick={() => setOpenDraft(true)} icon={Wand2}>草稿迭代（指令调整）</Secondary>
          )}
          {(avatar.status === "sampling" || avatar.status === "draft_iterating" || avatar.status === "refining") && (
            <Secondary onClick={() => { window.location.href = `/refine?avatar=${avatar.id}`; }} icon={Cpu}>进入精调工作台</Secondary>
          )}
          {(avatar.status === "refining" || avatar.status === "draft_iterating") && (
            <Secondary onClick={() => setOpenBeautify(true)} icon={Sparkles}>模板美化 & 标准出图</Secondary>
          )}
          {avatar.status === "pending_finalize" && (
            <Primary onClick={finalize} icon={Play} busy={busy}>定稿确认</Primary>
          )}
          {(avatar.status === "finalized_2d" || avatar.status === "deriving") && (
            <Primary onClick={() => onGoTab("derive")} icon={Cpu}>衍生 3D / 视频</Primary>
          )}
          {avatar.status === "archived" && (
            <span className="text-sm text-zinc-500">已归档 · 只读资产</span>
          )}
        </div>
      )}

      {/* 实现方式说明面板（任务书 §7：精调要保留"实现方式"说明） */}
      <details className="rounded-lg border border-zinc-800 bg-[var(--bg-2)] px-3 py-2 text-xs text-zinc-400">
        <summary className="cursor-pointer select-none text-zinc-300">实现方式 · 当前阶段技术说明</summary>
        <div className="mt-2 space-y-1.5">
          <Impl cap="真人复刻打样" tech="InstantID / IP-Adapter-FaceID（SDXL，单图免训练 ID 保持）" mock />
          <Impl cap="AI 原创打样" tech="SDXL / FLUX 文生图（走大模型网关或自部署）" mock />
          <Impl cap="几何微调" tech="MediaPipe FaceMesh + 液化形变（确定性，前端实时）" real />
          <Impl cap="妆容/发型/服饰" tech="EleGANt / HairCLIP / SD inpainting" mock />
          <Impl cap="2D→3D / 视频" tech="TripoSR / Stable Video Diffusion（仅运镜）" mock />
        </div>
      </details>

      {openSampling && <SamplingDialog avatar={avatar} onClose={() => setOpenSampling(false)} onStarted={() => { setOpenSampling(false); onChanged(); }} />}
      {openDraft && <DraftIterateDialog avatar={avatar} onClose={() => setOpenDraft(false)} onStarted={() => { setOpenDraft(false); onChanged(); }} />}
      {openBeautify && <TemplateBeautifyDialog avatar={avatar} onClose={() => setOpenBeautify(false)} onStarted={() => { setOpenBeautify(false); onChanged(); }} />}
    </div>
  );
}

function ActiveJobBar({ job, onDone }: { job: AiAvatarJob; onDone: () => void }) {
  // 轮询本任务直到终态，终态时刷新父级
  React.useEffect(() => {
    let alive = true;
    const t = setInterval(async () => {
      try {
        const j = await AiAvatarApi.getJob(job.id);
        if (!alive) return;
        if (j.status === "succeeded" || j.status === "failed" || j.status === "cancelled") {
          clearInterval(t); onDone();
        }
      } catch { /* keep polling */ }
    }, 1000);
    return () => { alive = false; clearInterval(t); };
  }, [job.id, onDone]);

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
        <span className="text-amber-200">{job.title ?? job.capabilityLabel}</span>
        <SourceBadge engine={job.engine} mode={job.providerMode} />
        <JobStatusPill status={job.status} className="ml-auto" />
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${job.progress}%` }} />
      </div>
      <div className="meta mt-1">{job.progress}% · 任务实时进度</div>
    </div>
  );
}

function Primary({ onClick, icon: Icon, children, busy }: { onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; busy?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy}
      className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-60">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />} {children}
    </button>
  );
}
function Secondary({ onClick, icon: Icon, children }: { onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3.5 py-2 text-sm text-zinc-200 hover:border-zinc-500">
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}
function Impl({ cap, tech, mock, real }: { cap: string; tech: string; mock?: boolean; real?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-zinc-300">{cap}</span>
      <span className="flex-1 font-mono text-[11px] text-zinc-500">{tech}</span>
      {real && <SourceBadge engine="liquify" mode="selfhost" />}
      {mock && <SourceBadge engine="MOCK" mode="mock" />}
    </div>
  );
}
