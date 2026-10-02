// 发布到平台的状态文案 —— 全站唯一一份（v0.197）。
//
// 之前 /distribution 与 /projects/<id>/distribute 各写一份，同一个 awaiting_user 一边写
// 「等你去平台确认」、一边写「等你输入验证码」。两页都从这里取。
// 注意：发布目前仍是服务端模拟推进（见 docs/drama-ux-copy-pass.md §3.1），文案不要写成
// 已经真的接通了平台。
import type { PlatformStatus } from "@ai-star-eco/types/distribution";
import type { PublishJobStatus } from "@ai-star-eco/types/publish-job";

export const PLATFORM_STATUS_LABEL: Record<PlatformStatus, string> = {
  connected: "已连接",
  pending: "待确认",
  disconnected: "未连接",
};

export const PUBLISH_JOB_STATUS_LABEL: Record<PublishJobStatus, string> = {
  queued: "排队中",
  uploading: "上传中",
  transcoding: "处理中",
  publishing: "发布中",
  awaiting_user: "等你去平台确认",
  live: "已发布",
  failed: "发布失败",
  cancelled: "已取消",
};
