"use client";

// 当前阶段卡（详情页的"行动区"）：按状态明确给出"下一步该做什么" + 主操作。
// 设计：把"下一步"做成页面焦点（不再埋在 7 个并列 tab 里）。衍生作为定稿后的阶段动作直接内嵌。
import * as React from "react";
import { Cpu, Loader2, Play, Sparkles, Wand2 } from "lucide-react";
import type { AiAvatarDetail, AiAvatarJob, AiAvatarStatus } from "@ai-star-eco/types/ai-avatar";
import { AiAvatarApi } from "@/api";
import { JobStatusPill } from "@/components/common/status-pill";
import { SourceBadge } from "@/components/common/source-badge";
import { SamplingDialog } from "./dialogs/sampling-dialog";
import { DraftIterateDialog } from "./dialogs/draft-iterate-dialog";
import { TemplateBeautifyDialog } from "./dialogs/template-beautify-dialog";
import { DeriveTab } from "./tabs/derive-tab";

const STAGE_HINT: Record<AiAvatarStatus, string> = {
  draft: "还没有打样。开始第一次打样，AI 会一次出 3~5 版供你挑选。",
  sampling: "打样已出。可继续草稿迭代细化方向，或进入精调工作台精修。",
  draft_iterating: "在当前版上继续用指令迭代，满意后进入精调或模板美化出图。",
  refining: "几何 / 外观精调中。调到位后用模板美化批量出标准图，进入待定稿。",
  pending_finalize: "标准图已出。确认定稿即冻结草稿链路，可开始衍生 3D / 视频。",
  finalized_2d: "已定稿。可衍生可旋转 3D 模型与运镜短视频，产出会进入「产出」。",
  deriving: "衍生生成进行中，完成后在「产出」查看 3D / 视频。",
  archived: "已归档 · 只读资产。如需继续编辑，请用顶部「另存为新 AiAvatar」。",
};

export function WorkflowActionBar({
  detail, onChanged, onGoTab,
}: {
  detail: AiAvatarDetail; onChanged: () => void; onGoTab: (t: string) => void;
}) {
  const { avatar } = detail;
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [openSampling, setOpenSampling] = React.useState(false);
  const [openDraft, setOpenDraft] = React.useState(false);
  const [openBeautify, setOpenBeautify] = React.useState(false);

  const activeJob = detail.recentJobs.find((j) => j.status === "running" || j.status === "queued");
  const s = avatar.status;
  const canDerive = s === "finalized_2d" || s === "deriving";

  const finalize = async () => {
    setBusy(true); setErr(null);
    try { await AiAvatarApi.finalize(avatar.id, {}); onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : "定稿失败"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--fg-3)]">当前阶段</div>
          <p className="mt-0.5 text-sm text-[var(--fg-1)]">{STAGE_HINT[s]}</p>
        </div>
      </div>

      {activeJob ? (
        <ActiveJobBar job={activeJob} onDone={onChanged} />
      ) : (
        <>
          {/* 下一步动作（按状态）。主操作用琥珀，其余为中性幽灵按钮。 */}
          <div className="flex flex-wrap items-center gap-2">
            {(s === "draft" || s === "sampling") && (
              <button onClick={() => setOpenSampling(true)} className="btn btn-primary">
                <Sparkles className="h-4 w-4" /> {s === "draft" ? "开始打样" : "重新打样"}
              </button>
            )}
            {(s === "sampling" || s === "draft_iterating") && (
              <button onClick={() => setOpenDraft(true)} className="btn btn-ghost">
                <Wand2 className="h-4 w-4" /> 草稿迭代
              </button>
            )}
            {(s === "sampling" || s === "draft_iterating" || s === "refining") && (
              <a href={`/refine?avatar=${avatar.id}`} className="btn btn-ghost">
                <Cpu className="h-4 w-4" /> 进入精调工作台
              </a>
            )}
            {(s === "refining" || s === "draft_iterating") && (
              <button onClick={() => setOpenBeautify(true)} className="btn btn-ghost">
                <Sparkles className="h-4 w-4" /> 模板美化出图
              </button>
            )}
            {s === "pending_finalize" && (
              <button onClick={finalize} disabled={busy} className="btn btn-primary">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} 定稿确认
              </button>
            )}
            {s === "archived" && <span className="text-sm text-[var(--fg-3)]">已归档 · 只读资产</span>}
          </div>

          {/* 衍生：定稿后的阶段动作，直接内嵌（产出在「产出」标签查看）。 */}
          {canDerive && (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-3">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-[var(--fg-0)]">
                <Cpu className="h-4 w-4 text-[var(--brand-strong)]" /> 衍生 3D / 视频
              </div>
              <DeriveTab detail={detail} onChanged={onChanged} showResults={false} onSeeOutputs={() => onGoTab("outputs")} />
            </div>
          )}
        </>
      )}

      {err && <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">{err}</p>}

      {openSampling && <SamplingDialog avatar={avatar} onClose={() => setOpenSampling(false)} onStarted={() => { setOpenSampling(false); onChanged(); }} />}
      {openDraft && <DraftIterateDialog avatar={avatar} onClose={() => setOpenDraft(false)} onStarted={() => { setOpenDraft(false); onChanged(); }} />}
      {openBeautify && <TemplateBeautifyDialog avatar={avatar} onClose={() => setOpenBeautify(false)} onStarted={() => { setOpenBeautify(false); onChanged(); }} />}
    </div>
  );
}

function ActiveJobBar({ job, onDone }: { job: AiAvatarJob; onDone: () => void }) {
  React.useEffect(() => {
    let alive = true;
    const t = setInterval(async () => {
      try {
        const j = await AiAvatarApi.getJob(job.id);
        if (!alive) return;
        if (j.status === "succeeded" || j.status === "failed" || j.status === "cancelled") { clearInterval(t); onDone(); }
      } catch { /* keep polling */ }
    }, 1000);
    return () => { alive = false; clearInterval(t); };
  }, [job.id, onDone]);

  return (
    <div className="rounded-lg border border-[var(--info-soft)] bg-[var(--info-soft)] p-3">
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--info)]" />
        <span className="font-medium text-[var(--fg-0)]">{job.title ?? job.capabilityLabel}</span>
        <SourceBadge engine={job.engine} mode={job.providerMode} />
        <JobStatusPill status={job.status} className="ml-auto" />
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-3)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${job.progress}%`, background: "var(--info)" }} />
      </div>
      <div className="meta mt-1"><span className="num">{job.progress}%</span> · 任务实时进度</div>
    </div>
  );
}
