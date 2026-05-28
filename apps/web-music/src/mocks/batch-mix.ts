// ─────────────────────────────────────────────────────────────────────────────
// mocks/batch-mix.ts — 混剪批量样本（5 个模板 + 3 个批量任务 + 6 个槽位演示）。
// ─────────────────────────────────────────────────────────────────────────────

import type { BatchTask, MixSlot, MixTemplate } from "@ai-star-eco/types/batch-mix";

export const MIX_TEMPLATES: MixTemplate[] = [
  {
    id: "mt-1",
    name: "产品测评标准模板",
    type: "product_review",
    duration: "0:45-1:20",
    platforms: ["DY", "KS", "XHS"],
    slots: 6,
    color: "#06b6d4",
    description: "开箱展示 → 功能讲解 → 使用感受 → 购买引导",
    usageCount: 234,
    successRate: 92,
  },
  {
    id: "mt-2",
    name: "生活方式情景混剪",
    type: "lifestyle",
    duration: "1:00-2:00",
    platforms: ["XHS", "DY"],
    slots: 8,
    color: "#ec4899",
    description: "日常场景拼接 + 产品自然植入 + BGM 节奏感",
    usageCount: 156,
    successRate: 88,
  },
  {
    id: "mt-3",
    name: "教程步骤分解",
    type: "tutorial",
    duration: "2:00-4:00",
    platforms: ["DY", "BL"],
    slots: 10,
    color: "#f59e0b",
    description: "步骤拆分 + 字幕引导 + 重点放大 + 成果展示",
    usageCount: 89,
    successRate: 94,
  },
  {
    id: "mt-4",
    name: "精彩片段集锦",
    type: "highlight",
    duration: "0:30-0:60",
    platforms: ["DY", "KS", "XHS", "VCH"],
    slots: 5,
    color: "#a855f7",
    description: "直播 / 活动高光 + 节奏剪切 + 动感配乐",
    usageCount: 412,
    successRate: 90,
  },
  {
    id: "mt-5",
    name: "故事线条漫",
    type: "story",
    duration: "0:15-0:30",
    platforms: ["DY", "XHS"],
    slots: 4,
    color: "#10b981",
    description: "短故事结构 + 悬念设置 + 情感共鸣",
    usageCount: 67,
    successRate: 85,
  },
];

export const BATCH_TASKS: BatchTask[] = [
  {
    id: "bt-1",
    name: "张艺星 × 极速数码-产品测评-9 月矩阵",
    templateId: "mt-1",
    templateName: "产品测评标准模板",
    totalCount: 20,
    completedCount: 18,
    failedCount: 1,
    status: "rendering",
    startedAt: "2025-09-11 10:00",
    estimatedDone: "2025-09-11T12:30:00Z",
    partnerName: "张艺星",
  },
  {
    id: "bt-2",
    name: "林音宝护肤精华-生活情景-8 月批次",
    templateId: "mt-2",
    templateName: "生活方式情景混剪",
    totalCount: 15,
    completedCount: 15,
    failedCount: 0,
    status: "done",
    startedAt: "2025-08-25 14:00",
    estimatedDone: "2025-08-25T16:00:00Z",
    partnerName: "林音宝",
  },
  {
    id: "bt-3",
    name: "清洁卫士-精彩集锦-全平台",
    templateId: "mt-4",
    templateName: "精彩片段集锦",
    totalCount: 30,
    completedCount: 0,
    failedCount: 0,
    status: "pending",
    startedAt: "-",
    estimatedDone: null,
    partnerName: "清洁卫士品牌方",
  },
];

/** 新建任务向导的 6 槽位演示（mt-1 产品测评的预填示例） */
export const SLOTS_DEMO: MixSlot[] = [
  { id: "s1", label: "开场片段 (0-5s)",  kind: "video", filled: true,  content: "张艺星 618-Clip-01.mp4" },
  { id: "s2", label: "产品展示 (5-20s)", kind: "video", filled: true,  content: "极速数码 X12-产品展示.mp4" },
  { id: "s3", label: "口播文案",          kind: "text",  filled: true,  content: "张艺星 × 极速数码 618 主推文案-V3" },
  { id: "s4", label: "功能演示 (20-35s)", kind: "video", filled: false },
  { id: "s5", label: "背景音乐",          kind: "audio", filled: true,  content: "清洁卫士背景音乐授权包" },
  { id: "s6", label: "结尾引导 (35-45s)", kind: "image", filled: false },
];

/** 看板示例 */
export const BATCH_MIX_KPI = {
  todayDone: 18,
  poolReady: 15,
};

/** 批量数量预设 */
export const BATCH_COUNT_TIERS = [10, 20, 50, 100] as const;
