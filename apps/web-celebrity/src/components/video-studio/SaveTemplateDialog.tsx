"use client";

// 「存为模板」弹窗（docs/video-studio-plan.md §10）：标题（预填「<模式名> · <提示词前 12 个字>」，1–40 字）、
// 说明（选填，≤200 字）；运营账号多一个「发布为官方模板（所有用户都能看到）」。
// 是不是运营由服务端查库判定，这里只决定显不显示那个勾选框。

import * as React from "react";
import { Loader2 } from "lucide-react";
import type { VideoStudioJob, VideoStudioTemplate } from "@ai-star-eco/types/video-studio";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@ai-star-eco/ui/ui/dialog";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { VideoStudioApi } from "@/api";
import { AiErrorNotice, errorMessage } from "@/components/common/ai-error-notice";
import { templateDefaultTitle } from "@/constants/video-studio-ui";
import {
  TEMPLATE_DESCRIPTION_MAX,
  TEMPLATE_TITLE_MAX,
  countPromptChars,
  validateTemplateDraft,
} from "@/lib/video-studio";

export function SaveTemplateDialog({
  job,
  canPublishOfficial,
  onClose,
  onSaved,
}: {
  /** 要存的那条生成记录；null = 弹窗关着。 */
  job: VideoStudioJob | null;
  /** 当前账号是不是运营（能发布官方模板）。 */
  canPublishOfficial: boolean;
  onClose: () => void;
  onSaved: (template: VideoStudioTemplate) => void;
}) {
  const [saving, setSaving] = React.useState(false);
  return (
    <Dialog
      open={job !== null}
      onOpenChange={(open) => {
        // 保存在路上时不让关：关了也撤不回已经发出去的请求，只会让人以为没存上再存一次
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="max-w-md border-zinc-200 bg-white text-zinc-900 shadow-[var(--shadow-pop)]">
        {job ? (
          <SaveTemplateForm
            key={job.id}
            job={job}
            canPublishOfficial={canPublishOfficial}
            saving={saving}
            setSaving={setSaving}
            onClose={onClose}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SaveTemplateForm({
  job,
  canPublishOfficial,
  saving,
  setSaving,
  onClose,
  onSaved,
}: {
  job: VideoStudioJob;
  canPublishOfficial: boolean;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onClose: () => void;
  onSaved: (template: VideoStudioTemplate) => void;
}) {
  const titleId = React.useId();
  const descId = React.useId();
  const [title, setTitle] = React.useState(() => templateDefaultTitle(job.mode, job.prompt));
  const [description, setDescription] = React.useState("");
  const [official, setOfficial] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const problems = validateTemplateDraft(title, description);
  const titleChars = countPromptChars(title);
  const descChars = countPromptChars(description);

  const save = async () => {
    if (saving || problems.length > 0) return;
    setSaving(true);
    setError(null);
    try {
      const template = await VideoStudioApi.createTemplate({
        jobId: job.id,
        title: title.trim(),
        description: description.trim() || null,
        official: canPublishOfficial && official,
      });
      onSaved(template);
    } catch (e) {
      setError(errorMessage(e, "没有存成功，请稍后再试"));
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-[10px] border border-zinc-300 bg-zinc-100 px-3 text-[13px] text-zinc-900 outline-none transition-[border-color,box-shadow,background-color] focus:border-violet-500 focus:bg-white focus:shadow-[0_0_0_3px_var(--accent-soft)]";

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base font-semibold">存为模板</DialogTitle>
        <DialogDescription className="text-xs leading-relaxed text-zinc-500">
          记下这条视频的模式、提示词、规格和素材，之后可以直接拿来做同款，素材也能换成别的。
        </DialogDescription>
      </DialogHeader>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center">
            <label htmlFor={titleId} className="text-[12px] font-medium text-zinc-700">
              标题
            </label>
            <span
              className={cn(
                "ml-auto font-mono text-[11px] tabular-nums",
                titleChars > TEMPLATE_TITLE_MAX ? "text-rose-600" : "text-zinc-400",
              )}
            >
              {titleChars} / {TEMPLATE_TITLE_MAX}
            </span>
          </div>
          <input
            id={titleId}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoComplete="off"
            className={cn(inputClass, "h-9")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center">
            <label htmlFor={descId} className="text-[12px] font-medium text-zinc-700">
              说明（选填）
            </label>
            <span
              className={cn(
                "ml-auto font-mono text-[11px] tabular-nums",
                descChars > TEMPLATE_DESCRIPTION_MAX ? "text-rose-600" : "text-zinc-400",
              )}
            >
              {descChars} / {TEMPLATE_DESCRIPTION_MAX}
            </span>
          </div>
          <textarea
            id={descId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="比如：图1 放模特、图2 放商品，适合服饰类"
            className={cn(inputClass, "resize-y py-2 leading-relaxed placeholder:text-zinc-400")}
          />
        </div>

        {canPublishOfficial ? (
          <label className="flex cursor-pointer items-start gap-2 text-[12.5px] text-zinc-700">
            <input
              type="checkbox"
              checked={official}
              onChange={(e) => setOfficial(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-violet-500"
            />
            <span>发布为官方模板（所有用户都能看到）</span>
          </label>
        ) : null}
        <p className="text-[11.5px] leading-relaxed text-zinc-500">
          {canPublishOfficial && official
            ? "发布后所有用户都能在「模板」里看到它，并直接用这条视频的素材做同款。"
            : "只有你自己能看到和使用。"}
        </p>

        {problems.length > 0 ? (
          <ul className="flex flex-col gap-0.5 text-[11.5px] text-rose-600">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
        {error ? <AiErrorNotice title="没有存成功" message={error} /> : null}

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="mobile-touch-target inline-flex h-9 items-center justify-center rounded-full border border-zinc-300 bg-white px-4 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving || problems.length > 0}
            className="mobile-touch-target inline-flex h-9 items-center justify-center gap-1.5 rounded-full border-b border-violet-600 bg-violet-500 px-5 text-[13px] font-medium text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {saving ? "正在保存…" : "保存"}
          </button>
        </DialogFooter>
      </form>
    </>
  );
}
