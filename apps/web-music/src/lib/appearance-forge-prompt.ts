import { ARTIST_TYPE_LABELS } from "@/constants/artist-config";
import type { Artist } from "@ai-star-eco/types/artist";
import type {
  ColorScheme,
  FaceSlider,
  ForgeMode,
  ForgeTemplate,
  LabeledOption,
} from "@ai-star-eco/types/appearance-forge";

export interface ForgePromptSnapshot {
  artist: Pick<Artist, "name" | "type" | "bio" | "incubationParams">;
  mode: ForgeMode;
  templateId: string | null;
  uploadedPhoto: boolean;
  fusionRatio: number;
  prompt: string;
  hairId: string | null;
  eyeId: string | null;
  styleTagIds: string[];
  faceValues: Record<string, number>;
  lockedFeatures: string[];
  colorSchemeId?: string | null;
  templates: ForgeTemplate[];
  hairStyles: LabeledOption[];
  eyeColors: LabeledOption[];
  styleTags: LabeledOption[];
  faceSliders: FaceSlider[];
  colorSchemes: ColorScheme[];
}

const INCUBATION_LABELS: Record<string, string> = {
  // 基础 & 外貌
  faceStyle: "面部风格",
  fashionStyle: "造型风格",
  age: "年龄设定",
  height: "身高设定",
  signatureColor: "代表色",
  generation: "世代",
  // 人格
  sweetness: "甜美感",
  energy: "能量感",
  mystery: "神秘感",
  confidence: "自信感",
  extraPersona: "额外人设",
  mbti: "MBTI 人格",
  personaTags: "人设标签",
  speakingStyle: "说话风格",
  // 类型专属（音乐 / 舞蹈 / 主持 / 演技）
  vocalRange: "音域",
  voiceTone: "音色",
  musicGenres: "主打曲风",
  creatorMode: "创作模式",
  danceStyles: "主打舞种",
  hostingStyle: "主持风格",
  actingGenres: "擅长戏路",
  // 粉丝 & 商业
  targetAudience: "目标受众",
  fanColor: "应援色",
  fandomName: "粉丝称号",
  brandRestrictions: "商业禁区",
  // 世界观
  backstory: "背景故事",
  groupAffiliation: "组合/厂牌",
};

function findLabel<T extends { id: string; label?: string; name?: string }>(
  items: T[],
  id: string | null | undefined,
): string | null {
  if (!id) return null;
  const found = items.find(item => item.id === id);
  return found?.label ?? found?.name ?? null;
}

function formatIncubationParams(params: Artist["incubationParams"]): string[] {
  if (!params) return [];
  return Object.entries(params)
    .filter(([, value]) => {
      if (value === null || value === undefined || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    })
    .map(([key, value]) => {
      const label = INCUBATION_LABELS[key] ?? key;
      let rendered: string;
      if (Array.isArray(value)) {
        // 数组值以顿号分隔，对 LLM 更可读；过滤空项
        rendered = value
          .filter(v => v !== null && v !== undefined && v !== "")
          .map(v => (typeof v === "object" ? JSON.stringify(v) : String(v)))
          .join("、");
      } else if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        rendered = String(value);
      } else {
        rendered = JSON.stringify(value);
      }
      return `${label}：${rendered}`;
    });
}

function describeSliderValue(value: number): string {
  if (value <= 20) return "明显收敛";
  if (value <= 40) return "略低";
  if (value <= 60) return "中性";
  if (value <= 80) return "偏强";
  return "突出";
}

function buildFaceSummary(
  faceSliders: FaceSlider[],
  faceValues: Record<string, number>,
): string {
  return faceSliders
    .map(slider => {
      const value = faceValues[slider.id];
      if (typeof value !== "number") return null;
      return `${slider.label}${describeSliderValue(value)}（${value}）`;
    })
    .filter(Boolean)
    .join("、");
}

export function buildAppearanceForgePrompt(input: ForgePromptSnapshot): string {
  const template = input.templates.find(item => item.id === input.templateId) ?? null;
  const hair = findLabel(input.hairStyles, input.hairId);
  const eye = findLabel(input.eyeColors, input.eyeId);
  const colorScheme = input.colorSchemes.find(item => item.id === input.colorSchemeId) ?? null;
  const tagLabels = input.styleTagIds
    .map(id => findLabel(input.styleTags, id))
    .filter((value): value is string => Boolean(value));
  const lockedLabels = input.lockedFeatures
    .map(id => findLabel(input.faceSliders, id) ?? findLabel(input.hairStyles, id) ?? findLabel(input.eyeColors, id) ?? id)
    .filter(Boolean);
  const incubationLines = formatIncubationParams(input.artist.incubationParams);
  const faceSummary = buildFaceSummary(input.faceSliders, input.faceValues);
  const modeLabel = input.mode === "template_photo"
    ? "模版融合"
    : input.mode === "prompt_only"
      ? "指令驱动"
      : input.mode === "template_prompt"
        ? "混合锻造"
        : "随机锻造";

  const lines = [
    `你现在是 AI 虚拟艺人平台里的“形象锻造顾问”。请围绕艺人「${input.artist.name}」输出一份可执行的中文外观方案。`,
    `艺人类型：${ARTIST_TYPE_LABELS[input.artist.type]}。`,
    input.artist.bio ? `艺人简介：${input.artist.bio}` : null,
    incubationLines.length > 0 ? `孵化设定：${incubationLines.join("；")}` : null,
    `锻造模式：${modeLabel}。`,
    template ? `参考模版：${template.name}（style=${template.style}，tags=${template.tags.join("/") || "无"}）` : "参考模版：未指定，请基于艺人气质自主建立主视觉。",
    input.uploadedPhoto ? `已上传参考照片，建议融合比例：照片 ${input.fusionRatio}% / 模版 ${100 - input.fusionRatio}%。` : "没有上传参考照片，请以文本和参数设定为主。",
    hair ? `指定发型：${hair}。` : null,
    eye ? `指定瞳色：${eye}。` : null,
    tagLabels.length > 0 ? `风格标签：${tagLabels.join("、")}。` : null,
    faceSummary ? `面部微调：${faceSummary}。` : null,
    colorScheme ? `主题配色：${colorScheme.name}（${colorScheme.colors.join(" → ")}）。` : null,
    lockedLabels.length > 0 ? `本次必须尽量保持不变的项：${lockedLabels.join("、")}。` : null,
    input.prompt.trim() ? `额外文本要求：${input.prompt.trim()}` : "额外文本要求：请优先保证可商业化、可舞台化、可长期运营。",
    "请按以下结构输出：",
    "1. 形象定位：一句话总结核心人设。",
    "2. 视觉关键词：列出 5-8 个关键词。",
    "3. 五官与发型建议：重点说明脸部、发型、瞳色和妆面。",
    "4. 服饰与材质建议：说明主服装、配件、材质、配色。",
    "5. 舞台/镜头表现：说明适合的打光、镜头、舞台氛围。",
    "6. 风险与优化：指出 2-3 个需要避免的问题。",
    "7. 最终生成提示词：最后给出一段适合继续图像生成的中文提示词，不要使用 JSON。",
  ];

  return lines.filter(Boolean).join("\n");
}
