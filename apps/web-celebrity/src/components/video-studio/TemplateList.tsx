"use client";

// 「模板」页签（docs/video-studio-plan.md §10）：「官方模板」「我的模板」两组卡片。
// 删除 / 撤回都要先确认，用统一的确认弹窗（useConfirm），不用浏览器自带的确认框。
// 解构成 askConfirm：全仓门禁按「不带对象前缀的 confirm 加括号」查浏览器原生确认框，起个别名免得误报。

import * as React from "react";
import { Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import type { VideoStudioTemplate } from "@ai-star-eco/types/video-studio";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { VideoStudioApi } from "@/api";
import { AiErrorNotice, errorMessage } from "@/components/common/ai-error-notice";
import { useConfirm } from "@/components/common/confirm-dialog";
import { TemplateCard } from "./TemplateCard";
import type { VideoStudioTemplatesState } from "./use-video-studio-templates";

export function TemplateList({
  state,
  canWithdrawOfficial,
  onUse,
}: {
  state: VideoStudioTemplatesState;
  /** 当前账号是运营：官方模板都能撤回。 */
  canWithdrawOfficial: boolean;
  onUse: (template: VideoStudioTemplate) => void;
}) {
  const { templates, error, refreshError, refreshing, reload, remove, refreshTemplate } = state;
  const { confirm: askConfirm, ConfirmHost } = useConfirm();
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const handleRemove = async (template: VideoStudioTemplate) => {
    const official = template.scope === "official";
    const ok = await askConfirm({
      title: official ? "撤回这个官方模板？" : "删除这个模板？",
      description: official
        ? "撤回后所有用户都看不到它了。已经用它生成的视频不受影响。"
        : "删除后「我的模板」里就没有它了。已经用它生成的视频不受影响。",
      confirmText: official ? "撤回" : "删除",
      tone: "danger",
    });
    if (!ok) return;
    setRemovingId(template.id);
    setActionError(null);
    try {
      await VideoStudioApi.deleteTemplate(template.id);
      remove(template.id);
    } catch (e) {
      setActionError(errorMessage(e, official ? "没有撤回成功，请稍后再试" : "没有删除成功，请稍后再试"));
    } finally {
      setRemovingId(null);
    }
  };

  const officialList = templates?.filter((t) => t.scope === "official") ?? [];
  const mineList = templates?.filter((t) => t.scope !== "official") ?? [];

  const renderCards = (list: VideoStudioTemplate[]) => (
    <div className="flex min-w-0 flex-col gap-3">
      {list.map((t) => (
        <TemplateCard
          key={t.id}
          template={t}
          canWithdrawOfficial={canWithdrawOfficial}
          removing={removingId === t.id}
          onUse={onUse}
          onRemove={(x) => void handleRemove(x)}
          onMediaExpired={refreshTemplate}
        />
      ))}
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-zinc-500">
          点「做同款」会把模板的模式、提示词、规格和素材填进生成表单，素材可以逐个换成自己的。
        </p>
        <button
          type="button"
          onClick={reload}
          disabled={refreshing}
          title="重新加载模板"
          className="mobile-touch-target inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[12px] text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
          刷新
        </button>
      </div>

      {refreshError && templates !== null ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 break-words">刷新失败：{refreshError}（下面的列表可能不是最新的）</span>
        </div>
      ) : null}
      {actionError ? <AiErrorNotice message={actionError} /> : null}

      {templates === null ? (
        error ? (
          <AiErrorNotice title="模板没有加载出来" message={error} onRetry={reload} />
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> 正在读取模板…
          </div>
        )
      ) : (
        <>
          <section aria-label="官方模板" className="flex min-w-0 flex-col gap-2.5">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-zinc-800">
              官方模板
              <span className="font-mono text-[11px] font-normal tabular-nums text-zinc-400">{officialList.length}</span>
            </h3>
            {officialList.length > 0 ? (
              renderCards(officialList)
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center text-[12.5px] text-zinc-500">
                还没有官方模板
              </div>
            )}
          </section>
          <section aria-label="我的模板" className="flex min-w-0 flex-col gap-2.5">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-zinc-800">
              我的模板
              <span className="font-mono text-[11px] font-normal tabular-nums text-zinc-400">{mineList.length}</span>
            </h3>
            {mineList.length > 0 ? (
              renderCards(mineList)
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center text-[12.5px] leading-relaxed text-zinc-500">
                还没有自己的模板。视频生成成功后，在生成记录里点「存为模板」，下次直接拿来做同款。
              </div>
            )}
          </section>
        </>
      )}
      <ConfirmHost />
    </div>
  );
}
