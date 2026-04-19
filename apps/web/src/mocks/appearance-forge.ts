// ─────────────────────────────────────────────────────────────────────────────
// mocks/appearance-forge.ts — AI 形象锻造炉样本数据（中文）。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ColorScheme,
  FaceSlider,
  ForgeMode,
  ForgeOptions,
  ForgeResult,
  ForgeTemplate,
  LabeledOption,
} from "@/types/appearance-forge";
import type { ID } from "@/types/_shared";

export const FORGE_TEMPLATES: ForgeTemplate[] = [
  { id: "t1", name: "霓虹偶像", image: "https://images.unsplash.com/photo-1587930708915-55a36837263b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjeWJlcnB1bmslMjBuZW9uJTIwcG9ydHJhaXQlMjBmdXR1cmlzdGljfGVufDF8fHx8MTc3NjQxNDc1N3ww&ixlib=rb-4.1.0&q=80&w=1080", tags: ["cyberpunk", "neon", "idol"], style: "neon" },
  { id: "t2", name: "暗黑歌姬", image: "https://images.unsplash.com/photo-1760493608711-09ead5e0b7ab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwYWVzdGhldGljJTIwYW5pbWUlMjBzdHlsZSUyMHBvcnRyYWl0fGVufDF8fHx8MTc3NjQxNDc1OHww&ixlib=rb-4.1.0&q=80&w=1080", tags: ["dark", "gothic", "singer"], style: "dark" },
  { id: "t3", name: "未来超模", image: "https://images.unsplash.com/photo-1633767448616-85ff30bdb047?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmdXR1cmlzdGljJTIwZmFzaGlvbiUyMG1vZGVsJTIwbmVvbnxlbnwxfHx8fDE3NzY0MTQ3NTh8MA&ixlib=rb-4.1.0&q=80&w=1080", tags: ["futuristic", "fashion", "elegant"], style: "future" },
  { id: "t4", name: "街头叛客", image: "https://images.unsplash.com/photo-1642522501650-ff7d99154e98?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjeWJlcnB1bmslMjBzdHJlZXQlMjBzdHlsZSUyMGZhc2hpb258ZW58MXx8fHwxNzc2NDE0NzU5fDA&ixlib=rb-4.1.0&q=80&w=1080", tags: ["street", "punk", "rebel"], style: "street" },
  { id: "t5", name: "全息幻影", image: "https://images.unsplash.com/photo-1764336312138-14a5368a6cd3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxob2xvZ3JhcGhpYyUyMGRpZ2l0YWwlMjBhcnQlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzY0MTQ3NjB8MA&ixlib=rb-4.1.0&q=80&w=1080", tags: ["holographic", "digital", "ethereal"], style: "holo" },
  { id: "t6", name: "哥特暗夜", image: "https://images.unsplash.com/photo-1762554561321-75a03de93c2f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb3RoaWMlMjBkYXJrJTIwZmFzaGlvbiUyMHBvcnRyYWl0fGVufDF8fHx8MTc3NjQxNDc2MHww&ixlib=rb-4.1.0&q=80&w=1080", tags: ["gothic", "dark", "mysterious"], style: "gothic" },
];

export const HAIR_STYLES: LabeledOption[] = [
  { id: "h1", label: "银色短发" },
  { id: "h2", label: "霓虹长发" },
  { id: "h3", label: "赛博莫西干" },
  { id: "h4", label: "全息渐变" },
  { id: "h5", label: "黑色直发" },
  { id: "h6", label: "粉色双马尾" },
];

export const EYE_COLORS: LabeledOption[] = [
  { id: "e1", label: "电光蓝",  color: "#00d4ff" },
  { id: "e2", label: "烈焰红",  color: "#ff2d55" },
  { id: "e3", label: "量子紫",  color: "#a855f7" },
  { id: "e4", label: "翡翠绿",  color: "#22c55e" },
  { id: "e5", label: "琥珀金",  color: "#f59e0b" },
  { id: "e6", label: "虹膜银",  color: "#94a3b8" },
];

export const STYLE_TAGS: LabeledOption[] = [
  { id: "s1", label: "赛博纹身" },
  { id: "s2", label: "机械义肢" },
  { id: "s3", label: "全息护目镜" },
  { id: "s4", label: "荧光耳饰" },
  { id: "s5", label: "数据面纹" },
  { id: "s6", label: "量子项圈" },
  { id: "s7", label: "光棱翅膀" },
  { id: "s8", label: "暗黑斗篷" },
];

export const FACE_SLIDERS: FaceSlider[] = [
  { id: "jawline",   label: "下颌线" },
  { id: "cheekbone", label: "颧骨" },
  { id: "eyeSize",   label: "眼型大小" },
  { id: "noseWidth", label: "鼻翼宽度" },
  { id: "lipFull",   label: "唇部丰满" },
  { id: "skinTone",  label: "肤色色调" },
];

export const COLOR_SCHEMES: ColorScheme[] = [
  { id: "cs1", name: "霓虹", colors: ["#00d4ff", "#a855f7"] },
  { id: "cs2", name: "烈焰", colors: ["#ef4444", "#f59e0b"] },
  { id: "cs3", name: "深海", colors: ["#0ea5e9", "#06b6d4"] },
  { id: "cs4", name: "暗夜", colors: ["#6366f1", "#1e1b4b"] },
];

export const PROMPT_SUGGESTIONS: string[] = [
  "赛博朋克",
  "未来主义",
  "极简优雅",
  "暗黑哥特",
  "复古蒸汽",
];

/**
 * 未接入 AI 前使用的 demo 视频池。保存 Forge 结果时，后端（或 mock 层）从中随机挑一个
 * 写入 {@link ForgeResult.videoUrl}。两段视频托管在 `apps/web/public/videos/`，
 * 前端静态资源直接命中，不经过 Next.js `/api/*` 代理。
 */
export const DEMO_FORGE_VIDEO_POOL: string[] = [
  "/videos/showreel-01.mp4",
  "/videos/showreel-02.mp4",
];

export function pickDemoForgeVideo(): string {
  return DEMO_FORGE_VIDEO_POOL[Math.floor(Math.random() * DEMO_FORGE_VIDEO_POOL.length)];
}

export const FORGE_OPTIONS: ForgeOptions = {
  templates: FORGE_TEMPLATES,
  hairStyles: HAIR_STYLES,
  eyeColors: EYE_COLORS,
  styleTags: STYLE_TAGS,
  faceSliders: FACE_SLIDERS,
  colorSchemes: COLOR_SCHEMES,
  promptSuggestions: PROMPT_SUGGESTIONS,
};

/** 历史记录：默认空，由组件在本地状态中追加（锻造炉页面内的会话级历史）。 */
export const FORGE_HISTORY: ForgeResult[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// MOCK_APPEARANCES —— 按 artistId 分组的"历史形象库"。艺人详情页的 AI 形象画廊
// 只读消费此列表；锻造炉生成的新结果会被 push 到这里（mock 模式下为会话态）。
// 每位艺人 2–4 张，其中恰好 1 张 status='official' 对应 Artist.officialAppearanceId。
// ─────────────────────────────────────────────────────────────────────────────

const tplImage = (i: number) => FORGE_TEMPLATES[i % FORGE_TEMPLATES.length].image;

export const MOCK_APPEARANCES: ForgeResult[] = [
  // Artist 1 — Neon V（epic 歌手，3 张，1 官方 + 1 上架）
  { id: "ap-1-1", artistId: "1", image: tplImage(0), prompt: "霓虹电子风·银色短发·量子紫瞳·赛博纹身", mode: "template_prompt", createdAt: "2025-03-12T09:10:00Z", locked: [], status: "official", usageCount: 14 },
  { id: "ap-1-2", artistId: "1", image: tplImage(4), prompt: "全息幻影舞台形象·光棱翅膀·电光蓝", mode: "template_photo", createdAt: "2025-02-20T14:30:00Z", locked: ["eyeSize"], status: "listed", usageCount: 6, marketplace: { price: 48_000, listedAt: "2025-03-01T00:00:00Z", soldCount: 2 } },
  { id: "ap-1-3", artistId: "1", image: tplImage(3), prompt: "街头叛客草稿·荧光耳饰", mode: "prompt_only", createdAt: "2025-01-08T11:00:00Z", locked: [], status: "draft" },

  // Artist 2 — Luna Soft（legendary 顶级偶像，4 张，1 官方 + 2 上架 + 1 已售）
  { id: "ap-2-1", artistId: "2", image: tplImage(2), prompt: "未来超模·琥珀金瞳·全息渐变发", mode: "template_prompt", createdAt: "2025-03-28T08:00:00Z", locked: ["cheekbone"], status: "official", usageCount: 28 },
  { id: "ap-2-2", artistId: "2", image: tplImage(0), prompt: "应援舞台限定·霓虹配色·粉色双马尾", mode: "template_prompt", createdAt: "2025-03-05T10:00:00Z", locked: [], status: "listed", usageCount: 11, marketplace: { price: 128_000, listedAt: "2025-03-06T00:00:00Z", soldCount: 5 } },
  { id: "ap-2-3", artistId: "2", image: tplImage(4), prompt: "全息幻影 MV 主形象", mode: "template_photo", createdAt: "2025-02-14T09:00:00Z", locked: ["jawline", "eyeSize"], status: "sold", usageCount: 8, marketplace: { price: 260_000, listedAt: "2025-02-15T00:00:00Z", soldCount: 1 } },
  { id: "ap-2-4", artistId: "2", image: tplImage(5), prompt: "哥特暗夜风·黑色直发·烈焰红瞳", mode: "random", createdAt: "2025-01-22T16:20:00Z", locked: [], status: "draft" },

  // Artist 3 — Shadow X（rare 演员，2 张）
  { id: "ap-3-1", artistId: "3", image: tplImage(5), prompt: "悬疑演员主形象·暗黑斗篷·量子项圈", mode: "template_prompt", createdAt: "2025-03-18T13:00:00Z", locked: [], status: "official", usageCount: 9 },
  { id: "ap-3-2", artistId: "3", image: tplImage(1), prompt: "暗黑歌姬融合造型", mode: "template_photo", createdAt: "2025-02-02T12:00:00Z", locked: [], status: "draft" },

  // Artist 4 — DJ Spark（epic 综艺咖，3 张，1 上架）
  { id: "ap-4-1", artistId: "4", image: tplImage(3), prompt: "街头叛客·机械义肢·赛博纹身", mode: "template_prompt", createdAt: "2025-04-02T15:00:00Z", locked: ["noseWidth"], status: "official", usageCount: 17 },
  { id: "ap-4-2", artistId: "4", image: tplImage(0), prompt: "霓虹派对·全息护目镜·荧光耳饰", mode: "template_prompt", createdAt: "2025-03-10T09:45:00Z", locked: [], status: "listed", usageCount: 4, marketplace: { price: 56_000, listedAt: "2025-03-11T00:00:00Z", soldCount: 1 } },
  { id: "ap-4-3", artistId: "4", image: tplImage(2), prompt: "未来超模综艺形象草稿", mode: "random", createdAt: "2025-01-30T10:00:00Z", locked: [], status: "draft" },

  // Artist 5 — Flex Nova（rare 练习生舞者，2 张）
  { id: "ap-5-1", artistId: "5", image: tplImage(3), prompt: "街舞练习生·赛博莫西干", mode: "template_prompt", createdAt: "2025-03-22T11:30:00Z", locked: [], status: "official", usageCount: 5 },
  { id: "ap-5-2", artistId: "5", image: tplImage(0), prompt: "舞台首秀概念图", mode: "prompt_only", createdAt: "2025-02-18T14:00:00Z", locked: [], status: "draft" },

  // Artist 6 — MC Flow（common 新人主持，1 张）
  { id: "ap-6-1", artistId: "6", image: tplImage(1), prompt: "新人主持首发形象·暗黑歌姬底片改造", mode: "template_prompt", createdAt: "2025-03-30T09:00:00Z", locked: ["cheekbone", "jawline"], status: "official", usageCount: 3 },

  // Artist 7 — Phoenix All（legendary 全能，4 张，1 上架 + 1 已售）
  { id: "ap-7-1", artistId: "7", image: tplImage(4), prompt: "全息幻影·主视觉六边形战士", mode: "template_prompt", createdAt: "2025-04-01T08:00:00Z", locked: ["eyeSize"], status: "official", usageCount: 22 },
  { id: "ap-7-2", artistId: "7", image: tplImage(5), prompt: "哥特暗夜短剧形象", mode: "template_photo", createdAt: "2025-03-08T10:15:00Z", locked: [], status: "listed", usageCount: 7, marketplace: { price: 180_000, listedAt: "2025-03-09T00:00:00Z", soldCount: 3 } },
  { id: "ap-7-3", artistId: "7", image: tplImage(2), prompt: "未来超模跨界时装形象", mode: "template_prompt", createdAt: "2025-02-05T12:00:00Z", locked: [], status: "sold", usageCount: 12, marketplace: { price: 320_000, listedAt: "2025-02-06T00:00:00Z", soldCount: 1 } },
  { id: "ap-7-4", artistId: "7", image: tplImage(0), prompt: "霓虹偶像综艺客串草稿", mode: "random", createdAt: "2025-01-10T09:00:00Z", locked: [], status: "draft" },
];

// ─────────────────────────────────────────────────────────────────────────────
// generateMockAppearancesFor —— 为没有种子形象的艺人（如孵化器新建）按 artistId
// 确定性合成 3 张形象（1 official + 1 listed + 1 draft），供画廊 demo。
// 生成结果会被 api 层 push 到 MOCK_APPEARANCES，保证会话内幂等。
// ─────────────────────────────────────────────────────────────────────────────

const AUTO_PROMPTS = [
  "首发官方形象·模版合成",
  "应援舞台限定·全息渐变",
  "实验性概念草稿",
  "跨界时装形象",
  "MV 主形象·未来感",
  "综艺客串造型",
];

const AUTO_MODES: ForgeMode[] = ["template_prompt", "template_photo", "prompt_only"];

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function generateMockAppearancesFor(artistId: ID): ForgeResult[] {
  const seed = hashSeed(String(artistId));
  const now = Date.now();
  const items: ForgeResult[] = [];
  for (let i = 0; i < 3; i++) {
    const tpl = FORGE_TEMPLATES[(seed + i * 2) % FORGE_TEMPLATES.length];
    const prompt = AUTO_PROMPTS[(seed + i) % AUTO_PROMPTS.length];
    const mode = AUTO_MODES[i % AUTO_MODES.length];
    const createdAt = new Date(now - (i + 1) * 3 * 24 * 60 * 60 * 1000).toISOString();
    const status: ForgeResult["status"] = i === 0 ? "official" : i === 1 ? "listed" : "draft";
    const usageCount = i === 0 ? 4 + (seed % 6) : i === 1 ? 1 + (seed % 3) : undefined;
    const marketplace = i === 1
      ? { price: 40_000 + (seed % 8) * 5_000, listedAt: createdAt, soldCount: seed % 3 }
      : undefined;
    items.push({
      id: `ap-auto-${artistId}-${i + 1}`,
      artistId,
      image: tpl.image,
      prompt,
      mode,
      createdAt,
      locked: [],
      status,
      usageCount,
      marketplace,
    });
  }
  return items;
}
