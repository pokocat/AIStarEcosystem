import { describe, expect, it } from "vitest";
import { outlineContent } from "./outline";

// §8.0.1 ⑩：只断「同一段不出现两次」这个结构，不断界面文案。
// 输入是服务端 seed 的形状（DramaRecipeService#seedProjectFromRecipe：synopsis 与 beat 都写模板的 beat）。
const count = (hay: string, needle: string) => hay.split(needle).length - 1;

describe("outlineContent", () => {
  it("模板做同款：synopsis 与 beat 相同时只出现一次", () => {
    const text = outlineContent({ no: 1, hook: "HOOK-A", synopsis: "BEAT-X", beat: "BEAT-X" });
    expect(count(text, "HOOK-A")).toBe(1);
    expect(count(text, "BEAT-X")).toBe(1);
  });

  it("首尾空白不同也算同一段", () => {
    const text = outlineContent({ no: 1, hook: "HOOK-A", synopsis: " BEAT-X ", beat: "BEAT-X" });
    expect(count(text, "BEAT-X")).toBe(1);
  });

  it("两段不同照旧都保留", () => {
    const text = outlineContent({ no: 1, hook: "HOOK-A", synopsis: "SYN-B", beat: "BEAT-C" });
    for (const part of ["HOOK-A", "SYN-B", "BEAT-C"]) expect(count(text, part)).toBe(1);
  });

  it("有新模型 content 时以 content 为准", () => {
    expect(outlineContent({ no: 1, content: "CONTENT-Z", synopsis: "BEAT-X", beat: "BEAT-X" })).toBe("CONTENT-Z");
  });
});
