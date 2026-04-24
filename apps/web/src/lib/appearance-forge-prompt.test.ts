import { describe, expect, it } from "vitest";

import { buildAppearanceForgePrompt } from "@/lib/appearance-forge-prompt";
import {
  COLOR_SCHEMES,
  EYE_COLORS,
  FACE_SLIDERS,
  FORGE_TEMPLATES,
  HAIR_STYLES,
  STYLE_TAGS,
} from "@/mocks/appearance-forge";

describe("buildAppearanceForgePrompt", () => {
  it("should include artist context and selected forge controls", () => {
    const prompt = buildAppearanceForgePrompt({
      artist: {
        name: "Luna Zero",
        type: "idol",
        bio: "擅长未来感舞台与冷感电子曲风。",
        incubationParams: {
          faceStyle: "冷艳科技感",
          fashionStyle: "高定机能风",
          confidence: 88,
        },
      },
      mode: "template_prompt",
      templateId: FORGE_TEMPLATES[0].id,
      uploadedPhoto: true,
      fusionRatio: 62,
      prompt: "希望保留舞台辨识度，并增加高奢质感。",
      hairId: HAIR_STYLES[1].id,
      eyeId: EYE_COLORS[2].id,
      styleTagIds: [STYLE_TAGS[0].id, STYLE_TAGS[3].id],
      faceValues: {
        jawline: 76,
        cheekbone: 58,
        eyeSize: 64,
        noseWidth: 42,
        lipFull: 51,
        skinTone: 47,
      },
      lockedFeatures: ["jawline", "eyeSize"],
      colorSchemeId: COLOR_SCHEMES[0].id,
      templates: FORGE_TEMPLATES,
      hairStyles: HAIR_STYLES,
      eyeColors: EYE_COLORS,
      styleTags: STYLE_TAGS,
      faceSliders: FACE_SLIDERS,
      colorSchemes: COLOR_SCHEMES,
    });

    expect(prompt).toContain("艺人「Luna Zero」");
    expect(prompt).toContain("艺人类型：偶像");
    expect(prompt).toContain("参考模版：霓虹偶像");
    expect(prompt).toContain("指定发型：霓虹长发");
    expect(prompt).toContain("指定瞳色：量子紫");
    expect(prompt).toContain("风格标签：赛博纹身、荧光耳饰");
    expect(prompt).toContain("本次必须尽量保持不变的项：下颌线、眼型大小");
    expect(prompt).toContain("最终生成提示词");
  });

  it("renders extended incubation dimensions with Chinese labels and joins arrays with 、", () => {
    const prompt = buildAppearanceForgePrompt({
      artist: {
        name: "星澪",
        type: "singer",
        bio: "深夜电子声线歌手。",
        incubationParams: {
          mbti: "INFP",
          personaTags: ["healing", "contrast"],
          musicGenres: ["electronic", "rnb"],
          vocalRange: "soprano",
          fandomName: "星星",
          backstory: "出身数据星海，梦想登上全球虚拟巡演。",
          brandRestrictions: [],
        },
      },
      mode: "prompt_only",
      templateId: null,
      uploadedPhoto: false,
      fusionRatio: 0,
      prompt: "",
      hairId: null,
      eyeId: null,
      styleTagIds: [],
      faceValues: {},
      lockedFeatures: [],
      colorSchemeId: null,
      templates: FORGE_TEMPLATES,
      hairStyles: HAIR_STYLES,
      eyeColors: EYE_COLORS,
      styleTags: STYLE_TAGS,
      faceSliders: FACE_SLIDERS,
      colorSchemes: COLOR_SCHEMES,
    });

    expect(prompt).toContain("MBTI 人格：INFP");
    expect(prompt).toContain("人设标签：healing、contrast");
    expect(prompt).toContain("主打曲风：electronic、rnb");
    expect(prompt).toContain("音域：soprano");
    expect(prompt).toContain("粉丝称号：星星");
    expect(prompt).toContain("背景故事：出身数据星海，梦想登上全球虚拟巡演。");
    // 空数组不应出现
    expect(prompt).not.toContain("商业禁区");
    // 数组值不应再以 JSON 形式出现
    expect(prompt).not.toContain('["healing","contrast"]');
  });
});
