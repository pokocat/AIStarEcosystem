// ─────────────────────────────────────────────────────────────────────────────
// mocks/clip-studio.ts — 切片制作样本（4 个任务，覆盖 4 种状态）。
// ─────────────────────────────────────────────────────────────────────────────

import type { ClipTask, QualityCheck } from "@ai-star-eco/types/clip-studio";

export const CLIP_TASKS: ClipTask[] = [
  {
    id: "ct-1",
    sourceTitle: "张艺星 618 直播回放-完整版（3.7 小时）",
    sourceType: "live",
    partnerName: "张艺星",
    productScope: "极速数码旗舰手机 X12",
    status: "quality_check",
    totalClips: 12,
    passedClips: 9,
    failedClips: 1,
    assignee: "剪辑小朱",
    createdAt: "2025-06-20",
    deadline: "2025-06-22",
    authContract: "张艺星 × 极速数码 618 短视频授权",
    copyVersion: "V3",
  },
  {
    id: "ct-2",
    sourceTitle: "林音宝产品讲解视频-护肤系列（28 分钟）",
    sourceType: "long_video",
    partnerName: "林音宝",
    productScope: "轻奢护肤精华液",
    status: "in_progress",
    totalClips: 6,
    passedClips: 0,
    failedClips: 0,
    assignee: "剪辑小陈",
    createdAt: "2025-09-02",
    deadline: "2025-09-04",
    authContract: "林音宝肖像使用授权",
    copyVersion: "V1",
  },
  {
    id: "ct-3",
    sourceTitle: "清洁卫士品牌采访-夏季产品线（55 分钟）",
    sourceType: "interview",
    partnerName: "清洁卫士品牌方",
    productScope: "多效厨房清洁剂",
    status: "completed",
    totalClips: 8,
    passedClips: 8,
    failedClips: 0,
    assignee: "剪辑小朱",
    createdAt: "2025-07-10",
    deadline: "2025-07-12",
    authContract: "清洁卫士内容投放授权",
    copyVersion: "V2",
  },
  {
    id: "ct-4",
    sourceTitle: "张艺星专访-年度规划（45 分钟）",
    sourceType: "interview",
    partnerName: "张艺星",
    productScope: "个人品牌宣推",
    status: "review",
    totalClips: 5,
    passedClips: 4,
    failedClips: 1,
    assignee: "剪辑小陈",
    createdAt: "2025-09-05",
    deadline: "2025-09-07",
    authContract: "张艺星肖像直播回放切片授权",
    copyVersion: "V2",
  },
];

/** 6 项强制质检模板（每个任务的 qualityChecks 均按此 schema） */
export const QC_TEMPLATE: QualityCheck[] = [
  { id: "qc1", label: "黑屏/静音检测",  passed: null },
  { id: "qc2", label: "字幕错位检测",  passed: null },
  { id: "qc3", label: "画幅异常检测",  passed: null },
  { id: "qc4", label: "敏感词识别",    passed: null },
  { id: "qc5", label: "品牌露出校验",  passed: null },
  { id: "qc6", label: "授权范围核查",  passed: null },
];

/** 任务详情页的派生 QC 结果（基于 status / failedClips 推断展示） */
export function deriveQcForTask(task: ClipTask): QualityCheck[] {
  return [
    { id: "qc1", label: "黑屏/静音检测",  passed: true },
    { id: "qc2", label: "字幕错位检测",  passed: task.status !== "failed" },
    { id: "qc3", label: "画幅异常检测",  passed: true },
    { id: "qc4", label: "敏感词识别",    passed: task.status === "completed" ? true : task.failedClips > 0 ? false : null },
    { id: "qc5", label: "品牌露出校验",  passed: true },
    { id: "qc6", label: "授权范围核查",  passed: task.status !== "failed" },
  ];
}

/** 看板示例数据（演示用静态聚合值；真后端从 server 聚合） */
export const CLIP_STUDIO_KPI = {
  todayDone: 8,
  qcPassRate: "87%",
  inPool: 34,
};
