"use client";

// 「AI 创作 → 视频生成」页面主体（docs/video-studio-plan.md §1）。
// 左栏填参数，右栏两个页签「生成记录」「模板」；手机上上下排。这块是把视频模型的原生能力直接搬过来，
// 不做脚本、商品这些封装；模板只是「把一条做好的视频的参数和素材记下来，下次直接做同款」（§10）。

import * as React from "react";
import { BookmarkCheck, Clapperboard, X } from "lucide-react";
import type { VideoStudioJob, VideoStudioTemplate } from "@ai-star-eco/types/video-studio";
import { useAuth } from "@ai-star-eco/api-client";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { USE_MOCK } from "@/api/_client";
import { canUseOperatorTools } from "@/lib/operator-role";
import { JobList } from "./JobList";
import { SaveTemplateDialog } from "./SaveTemplateDialog";
import { TemplateList } from "./TemplateList";
import { VideoStudioForm, type PendingTemplate } from "./VideoStudioForm";
import { useVideoStudioJobs } from "./use-video-studio-jobs";
import { useVideoStudioModels } from "./use-video-studio-models";
import { useVideoStudioTemplates } from "./use-video-studio-templates";

const RESULTS_ANCHOR_ID = "video-studio-results";

type ResultsTab = "jobs" | "templates";

export function VideoStudio() {
  const { user } = useAuth();
  const isOperator = canUseOperatorTools(user?.operatorRole);
  const models = useVideoStudioModels();
  const jobs = useVideoStudioJobs();
  const templates = useVideoStudioTemplates();
  const [tab, setTab] = React.useState<ResultsTab>("jobs");
  const [pendingTemplate, setPendingTemplate] = React.useState<PendingTemplate | null>(null);
  const [savingJob, setSavingJob] = React.useState<VideoStudioJob | null>(null);
  const [savedNote, setSavedNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!savedNote) return;
    const timer = window.setTimeout(() => setSavedNote(null), 8_000);
    return () => window.clearTimeout(timer);
  }, [savedNote]);

  const scrollToResults = React.useCallback(() => {
    document.getElementById(RESULTS_ANCHOR_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const showJobs = React.useCallback(() => {
    setTab("jobs");
    scrollToResults();
  }, [scrollToResults]);

  const { prepend: prependJob } = jobs;
  const { bumpUseCount, prepend: prependTemplate } = templates;

  const handleSubmitted = React.useCallback(
    (job: VideoStudioJob) => {
      prependJob(job);
      // 做同款提交成功，服务端那边「已做同款」次数 +1；这里先就地加上，不整张重拉
      if (job.templateId) bumpUseCount(job.templateId);
    },
    [prependJob, bumpUseCount],
  );

  /** 模板卡片点了「做同款」：交给左边表单去填（表单还没出来就先存着）。 */
  const startFromTemplate = React.useCallback((template: VideoStudioTemplate) => {
    setPendingTemplate((prev) => ({ template, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  const handleSaved = React.useCallback(
    (template: VideoStudioTemplate) => {
      prependTemplate(template);
      setSavingJob(null);
      setSavedNote(
        template.scope === "official" ? `「${template.title}」已发布为官方模板` : `已存为模板「${template.title}」`,
      );
    },
    [prependTemplate],
  );

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <Clapperboard className="h-4 w-4 shrink-0 text-violet-600" />
          <h1 className="text-xl font-semibold text-zinc-900">视频生成</h1>
          {USE_MOCK ? (
            <span
              className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700"
              title="演示模式：不会真的调用视频模型，也不扣积分"
            >
              演示数据
            </span>
          ) : null}
        </div>
        <p className="text-sm text-zinc-500">
          选生成模式、写提示词、传素材，直接用视频模型出片；做好的视频可以存成模板，下次直接做同款。
        </p>
      </header>

      <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <VideoStudioForm
          models={models}
          onSubmitted={handleSubmitted}
          onShowJobs={showJobs}
          pendingTemplate={pendingTemplate}
        />

        <section
          id={RESULTS_ANCHOR_ID}
          aria-label="生成记录与模板"
          className="flex min-w-0 max-w-[860px] scroll-mt-4 flex-col gap-3"
        >
          <div role="tablist" aria-label="查看生成记录或模板" className="flex min-w-0 items-center gap-1 self-start rounded-full bg-zinc-100 p-1">
            <TabButton selected={tab === "jobs"} onClick={() => setTab("jobs")}>
              生成记录
              {jobs.activeCount > 0 ? (
                <span className="rounded-full bg-violet-100 px-1.5 text-[11px] font-medium tabular-nums text-violet-700">
                  {jobs.activeCount}
                </span>
              ) : null}
            </TabButton>
            <TabButton selected={tab === "templates"} onClick={() => setTab("templates")}>
              模板
            </TabButton>
          </div>

          {savedNote ? (
            <div
              role="status"
              className="flex min-w-0 items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-600"
            >
              <BookmarkCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate" title={savedNote}>
                {savedNote}
              </span>
              {tab !== "templates" ? (
                <button
                  type="button"
                  onClick={() => setTab("templates")}
                  className="shrink-0 font-medium underline underline-offset-2"
                >
                  去模板里看看
                </button>
              ) : null}
              <button
                type="button"
                aria-label="关闭提示"
                onClick={() => setSavedNote(null)}
                className="shrink-0 rounded-full p-0.5 hover:bg-emerald-500/10"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : null}

          {tab === "jobs" ? (
            <JobList state={jobs} onSaveTemplate={setSavingJob} />
          ) : (
            <TemplateList state={templates} canWithdrawOfficial={isOperator} onUse={startFromTemplate} />
          )}
        </section>
      </div>

      <SaveTemplateDialog
        job={savingJob}
        canPublishOfficial={isOperator}
        onClose={() => setSavingJob(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}

function TabButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "mobile-touch-target inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500",
        selected ? "bg-white text-zinc-900 shadow-[var(--shadow-soft)]" : "text-zinc-500 hover:text-zinc-800",
      )}
    >
      {children}
    </button>
  );
}
