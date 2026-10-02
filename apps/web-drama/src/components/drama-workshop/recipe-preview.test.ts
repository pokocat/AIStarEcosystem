import { describe, expect, it } from "vitest";
import type { DramaRecipe } from "@/api/recipes";
import { recipeTags } from "./recipe-preview";

// 单条短视频一律竖屏 9:16（shorts/make 建草稿时写死，没有改画幅的地方）。
// 模板上存的 ratio 可能是横屏，但预览里不能照它展示，否则用户以为做出来是横屏（评审 J-1）。
const recipe = (episodes: number, ratio: string) =>
  ({ type: "测评", episodes, ratio, data: { hooks: [] } }) as unknown as DramaRecipe;

describe("recipeTags 画幅", () => {
  it("单条模板：不展示模板存的横屏画幅，展示竖屏 9:16", () => {
    const tags = recipeTags(recipe(1, "16:9"));
    expect(tags.some((t) => t.includes("16:9"))).toBe(false);
    expect(tags.some((t) => t.includes("9:16"))).toBe(true);
  });

  it("多集模板：照模板自己的画幅", () => {
    expect(recipeTags(recipe(12, "16:9"))).toContain("16:9");
  });
});
