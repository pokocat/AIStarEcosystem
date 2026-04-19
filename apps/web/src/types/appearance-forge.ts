// ─────────────────────────────────────────────────────────────────────────────
// appearance-forge.ts — AI 形象锻造炉领域模型。
// 使用者：components/producer/AppearanceForge.tsx
// 职责：描述"模版 / 面部参数 / 风格标签 / 生成结果"等数据结构；
//       前端是契约真值源，后端按此定义对齐。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

/** 锻造模式：决定 UI 显示的输入面板与调用的生成接口。 */
export type ForgeMode =
  | "template_photo"    // 模版 + 用户照片融合
  | "prompt_only"       // 纯文本指令
  | "template_prompt"   // 模版 + 文本微调
  | "random";           // 基于艺人类型随机生成

/** 风格模版（AI 生成形象的"底片"）。 */
export interface ForgeTemplate {
  id: ID;
  name: string;
  /** 模版预览图 URL。 */
  image: string;
  /** 自由标签，用于筛选 / 语义拼接。 */
  tags: string[];
  /** 模版风格标识（cyberpunk / gothic / holo / ...）。 */
  style: string;
}

/** 下拉选项：发型、瞳色、风格标签（都有中文名 + 可选颜色值）。 */
export interface LabeledOption {
  id: ID;
  label: string;
  /** 仅部分选项（如瞳色）使用；十六进制颜色串。 */
  color?: string;
}

/** 面部微调滑块定义。值域 0-100。 */
export interface FaceSlider {
  /** 滑块键名，会被生成请求按此键回传。 */
  id: string;
  label: string;
}

/** 主题配色（左右两色渐变）。 */
export interface ColorScheme {
  id: ID;
  name: string;
  /** 恰好两个颜色；按 `linear-gradient(135deg, c1, c2)` 渲染。 */
  colors: [string, string];
}

/** 用户提交生成请求时的全部参数。 */
export interface ForgeRequest {
  artistId: ID;
  mode: ForgeMode;
  /** template_* 模式下选中的模版 id；prompt_only 为 null。 */
  templateId: ID | null;
  /** template_photo 模式下的用户照片 DataURL；其它模式为 null。 */
  uploadedPhoto: string | null;
  /** 模版与照片融合比例 0-100；仅 template_photo 模式有意义。 */
  fusionRatio: number;
  /** 文本指令；prompt_only / template_prompt 使用。 */
  prompt: string;
  hairId: ID | null;
  eyeId: ID | null;
  styleTagIds: ID[];
  /** 面部微调：sliderId -> value (0-100)。 */
  faceValues: Record<string, number>;
  /** 被锁定、本次生成中保持不变的字段键（sliderId 或选项键）。 */
  lockedFeatures: string[];
  colorSchemeId?: ID | null;
}

/** 形象商业化状态。draft=仅草稿; official=艺人当前官方形象; listed=已上架素材/NFT 市场; sold=已售出（授权或 NFT 流转）。 */
export type AppearanceStatus = "draft" | "official" | "listed" | "sold";

/** 上架市场信息，仅 status === 'listed' | 'sold' 时存在。 */
export interface AppearanceMarketplace {
  /** 售价（credits 原始整数值）。展示请用 formatCredits()。 */
  price: number;
  /** 上架时间。 */
  listedAt: ISODateTime;
  /** 累计售出数量（NFT / 授权计数）。 */
  soldCount: number;
}

/** 生成结果。 */
export interface ForgeResult {
  id: ID;
  /** 归属艺人 ID — 画廊视图按此分组。 */
  artistId: ID;
  /** 产出图像 URL（主图）。 */
  image: string;
  /** 可选缩略图 URL；若不提供则 image 本身即缩略图。 */
  thumbnail?: string;
  /**
   * 保存后关联的短视频 URL；艺人画廊主视图用此字段渲染。
   * 未保存（草稿）时为 undefined；保存后由后端写入。
   * 当前未接入 AI 视频生成，后端从 demo 池随机挑一个 URL；真实接入后由生成管线回填。
   */
  videoUrl?: string;
  /** 等效文本提示，用于历史回显 / 再次编辑。 */
  prompt: string;
  mode: ForgeMode;
  /** 生成时间（ISO8601）。 */
  createdAt: ISODateTime;
  /** 本次生成中被锁定的字段。 */
  locked: string[];
  /** 形象状态（草稿 / 官方 / 已上架 / 已售出）；生成接口默认 'draft'。 */
  status?: AppearanceStatus;
  /** 被使用于 MV / 场景 / 封面的次数。 */
  usageCount?: number;
  /** 上架信息；仅 status === 'listed' | 'sold' 时存在。 */
  marketplace?: AppearanceMarketplace;
}

/** 锻造炉静态选项清单（一次下发，前端缓存到 constants/mocks）。 */
export interface ForgeOptions {
  templates: ForgeTemplate[];
  hairStyles: LabeledOption[];
  eyeColors: LabeledOption[];
  styleTags: LabeledOption[];
  faceSliders: FaceSlider[];
  colorSchemes: ColorScheme[];
  /** 指令输入框推荐标签。 */
  promptSuggestions: string[];
}
