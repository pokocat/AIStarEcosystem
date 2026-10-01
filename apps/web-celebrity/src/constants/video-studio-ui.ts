// ─────────────────────────────────────────────────────────────────────────────
// constants/video-studio-ui.ts：「AI 创作 → 视频生成」的界面文案与展示小工具。
//
// 模式名照抄厂商（plan §1），一个字都不改；状态文案与服务端 `VideoStudioJob.status` 一一对应。
// 素材类型名、编号规则、大小时长格式在 lib/video-studio.ts（报错文案也要用，放一处）。
//
// 只有 `import type`：node --test 可以直接加载本文件。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  VideoStudioCanvas,
  VideoStudioJob,
  VideoStudioJobStatus,
  VideoStudioMode,
  VideoStudioTemplateScope,
} from "@ai-star-eco/types/video-studio";

/** 模式显示名（厂商原名）。 */
export const VIDEO_STUDIO_MODE_LABEL: Record<VideoStudioMode, string> = {
  t2v: "文生视频",
  i2v: "首帧生视频",
  first_last_frame_video: "首尾帧生视频",
  universal_reference_video: "全能参考",
};

/** 模式一句话说明（模式按钮上的小字）。 */
export const VIDEO_STUDIO_MODE_DESC: Record<VideoStudioMode, string> = {
  t2v: "只写提示词，不用传素材",
  i2v: "传一张图当第一帧",
  first_last_frame_video: "传开头和结尾两张图，中间由模型补",
  universal_reference_video: "图片、视频、音频都能当参考",
};

/** 提示词输入框的占位示例，按模式给。 */
export const VIDEO_STUDIO_PROMPT_PLACEHOLDER: Record<VideoStudioMode, string> = {
  t2v: "描述想要的画面，比如：清晨的咖啡馆，女生端起一杯拿铁对着镜头笑，暖色调，镜头慢慢推近",
  i2v: "描述首帧之后画面怎么动，比如：人物转身走向窗边，镜头跟着移动",
  first_last_frame_video: "描述从首帧到尾帧的变化，比如：镜头从远景慢慢推到商品特写",
  universal_reference_video: "用「图1」「视频1」「音频1」说明每个素材怎么用，比如：图1 的人物穿上图2 的外套，跟着音频1 的节奏走过街角",
};

/** 任务状态文案。 */
export const VIDEO_STUDIO_STATUS_LABEL: Record<VideoStudioJobStatus, string> = {
  queued: "排队中",
  running: "生成中",
  succeeded: "已完成",
  failed: "失败",
};

/** 是否还在进行（排队或生成中）：轮询、冻结积分的文案都看它。 */
export function isJobActive(status: VideoStudioJobStatus): boolean {
  return status === "queued" || status === "running";
}

/** 卡片上的状态文字：生成中带百分比，如「生成中 42%」。 */
export function jobStatusText(job: Pick<VideoStudioJob, "status" | "progressPct">): string {
  if (job.status === "running") {
    const pct = Math.max(0, Math.min(100, Math.round(job.progressPct)));
    return `${VIDEO_STUDIO_STATUS_LABEL.running} ${pct}%`;
  }
  return VIDEO_STUDIO_STATUS_LABEL[job.status];
}

/** 积分文案：进行中「冻结 N 积分」/ 成功「消耗 N 积分」/ 失败「已退回 N 积分」。数字另行格式化后传入。 */
export function jobCreditsText(status: VideoStudioJobStatus, formattedCredits: string): string {
  if (status === "succeeded") return `消耗 ${formattedCredits} 积分`;
  if (status === "failed") return `已退回 ${formattedCredits} 积分`;
  return `冻结 ${formattedCredits} 积分`;
}

/** 清晰度显示名：就是档位本身（768p / 544p），厂商和用户都这么叫。 */
export function tierLabel(tier: string): string {
  return tier;
}

/** 画面比例按钮上的字：「9:16 · 768×1344」，像素来自合同。 */
export function canvasLabel(canvas: VideoStudioCanvas): string {
  return `${canvas.aspectRatio} · ${canvas.width}×${canvas.height}`;
}

/** 任务规格一行：「768p · 9:16 · 5 秒」。 */
export function jobSpecText(job: Pick<VideoStudioJob, "resolutionTier" | "aspectRatio" | "seconds">): string {
  return `${tierLabel(job.resolutionTier)} · ${job.aspectRatio} · ${job.seconds} 秒`;
}

/** 从「9:16」这类比例串取宽高比（宽 / 高）；解析不了返回 null。 */
export function aspectValue(aspectRatio: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/.exec(aspectRatio.trim());
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 0 && h > 0 ? w / h : null;
}

// ── 智能优化（docs/video-studio-plan.md §9）──────────────────────────────────

/** 「智能优化」勾选框记在本机（只是这个浏览器的偏好，不进服务端）。 */
export const VIDEO_STUDIO_OPTIMIZE_PREF_KEY = "aistareco.web.celebrity.video-studio.optimize.v1";

/** 查优化结果的间隔（页面在后台时暂停）。 */
export const VIDEO_STUDIO_OPTIMIZE_POLL_MS = 2_000;

/** 勾选框旁边的说明。 */
export const VIDEO_STUDIO_OPTIMIZE_HINT = "生成前先让模型把提示词改写得更具体，改完给你看，用不用由你定";

// ── 模板 / 做同款（§10）──────────────────────────────────────────────────────

/** 模板卡片上的可见范围标。 */
export const VIDEO_STUDIO_TEMPLATE_SCOPE_LABEL: Record<VideoStudioTemplateScope, string> = {
  official: "官方",
  private: "仅自己可见",
};

/** 存模板时预填的标题：「<模式名> · <提示词前 12 个字>」。 */
export function templateDefaultTitle(mode: VideoStudioMode, prompt: string): string {
  const head = Array.from(prompt.trim().replace(/\s+/g, " ")).slice(0, 12).join("");
  const label = VIDEO_STUDIO_MODE_LABEL[mode] ?? "视频生成";
  return head ? `${label} · ${head}` : label;
}
