import type { AiAvatarTemplate } from "@ai-star-eco/types/ai-avatar";

const now = "2026-05-30T00:00:00Z";

/** 工厂模板（与 server AiAvatarTemplateSeeder 同源）。 */
export const FACTORY_TEMPLATES: AiAvatarTemplate[] = [
  {
    id: "dhtpl-natural-beauty", name: "自然美颜", category: "beauty", categoryLabel: "美颜",
    description: "GFPGAN 高清修复 + 轻磨皮 + 自然提亮，保留五官辨识度", capability: "restore",
    params: { beautyStrength: 0.55, smoothing: 0.4, brighten: 0.2, engine: "GFPGAN" },
    official: true, enabled: true, usageCount: 128, createdAt: now, updatedAt: now,
  },
  {
    id: "dhtpl-studio", name: "影棚质感", category: "retouch", categoryLabel: "质感修复",
    description: "影棚级肤质 + 冷调高光 + 边缘锐化", capability: "restore",
    params: { beautyStrength: 0.45, colorGrade: "studio_cool", sharpen: 0.3 },
    official: true, enabled: true, usageCount: 76, createdAt: now, updatedAt: now,
  },
  {
    id: "dhtpl-future-mecha", name: "未来机能风", category: "style", categoryLabel: "风格",
    description: "冷感光泽、机能材质、舞台反光的整体风格化", capability: "img2img",
    params: { style: "future_mecha", strength: 0.6 },
    official: true, enabled: true, usageCount: 54, createdAt: now, updatedAt: now,
  },
  {
    id: "dhtpl-guofeng", name: "国风古典", category: "style", categoryLabel: "风格",
    description: "东方古典审美：水墨意境、温润光感", capability: "img2img",
    params: { style: "guofeng", strength: 0.6 },
    official: true, enabled: true, usageCount: 41, createdAt: now, updatedAt: now,
  },
  {
    id: "dhtpl-daily-makeup", name: "精致日常妆", category: "beauty", categoryLabel: "美颜",
    description: "自然底妆 + 柔焦眼妆 + 水光唇，妆容迁移保留五官", capability: "makeup",
    params: { makeupRef: "daily_soft", intensity: 0.5, engine: "EleGANt" },
    official: true, enabled: true, usageCount: 93, createdAt: now, updatedAt: now,
  },
  {
    id: "dhtpl-standard-4", name: "标准四视图", category: "composition", categoryLabel: "标准构图",
    description: "正面半身 / 正面全身 / 左侧脸 / 右侧脸 标准构图出图", capability: "restore",
    params: { composition: "standard_4", withExpression: true },
    official: true, enabled: true, usageCount: 67, createdAt: now, updatedAt: now,
  },
];
