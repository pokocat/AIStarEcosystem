import { describe, expect, it } from "vitest";
import { buildShortClipVars, buildShortFrameVars, buildShortVisualMetaPrefix } from "./short-render-prompt";

const meta = {
  title: "喵影江湖",
  style: ["快节奏", "邵氏港片喜剧"],
  scene: "雨夜客栈",
  character: {
    name: "喵无影",
    description: "圆滚滚橘猫，口头禅是‘本喵懒得理你’",
  },
};

describe("short render prompt compiler", () => {
  it("keeps global metadata visual-only", () => {
    const prefix = buildShortVisualMetaPrefix(meta);
    expect(prefix).toContain("固定主角：喵无影");
    expect(prefix).toContain("固定场景：雨夜客栈");
    expect(prefix).not.toContain("本喵懒得理你");
    expect(prefix).not.toContain("口头禅");
    expect(prefix).not.toContain("喵影江湖");
  });

  it("uses the explicit style instead of the default commerce format", () => {
    const vars = buildShortFrameVars({
      meta,
      styleName: "邵氏港片喜剧风格",
      shot: { visual: "橘猫跃上屋檐", size: "中景", move: "快速推近", beat: "亮相" },
    });
    expect(vars.styleSuffix).toContain("邵氏港片喜剧风格");
    expect(vars.styleSuffix).not.toContain("口播带货");
    expect(vars.visual).toContain("本镜叙事节拍：亮相");
    expect(vars.visual).toContain("运镜：快速推近");
  });

  it("keeps dialogue and sound out of the visual clip prompt", () => {
    const vars = buildShortClipVars({
      meta,
      styleName: "邵氏港片喜剧风格",
      shot: {
        visual: "橘猫回头看向追兵",
        voWho: "喵无影",
        voText: "本喵懒得理你",
        sfx: "瓦片碎裂",
        bgm: "急促锣鼓",
        fx: "定格放大",
      },
    });
    expect(vars.metaPrefix).not.toContain("本喵懒得理你");
    expect(vars.lineClause).not.toContain("本喵懒得理你");
    expect(vars.lineClause).not.toContain("瓦片碎裂");
    expect(vars.lineClause).not.toContain("急促锣鼓");
    expect(vars.lineClause).toContain("台词与声音由平台后期合成");
    expect(vars.lineClause).toContain("不要生成画面文字");
    expect(vars.visual).toContain("画面效果：定格放大");
  });
});
