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
});
