// 创意（DramaRecipe）→ 预览展示的派生工具（v0.78）。
// 首页（dashboard）短剧预览与短视频新建控制台（ShortCreateConsole）共用一套，
// 避免「又重复实现了一套」。纯函数，无 React 依赖。
import type { DramaRecipe } from "@/api/recipes";

/** 创意 → 灌进对话框的一句话种子（优先主线，其次题材+简介）。 */
export function recipePromptSeed(r: DramaRecipe): string {
  const mainline = r.data?.mainline?.trim();
  return mainline || `${r.type} · ${r.summary || r.title}`;
}

/** 创意 → 预览标签（题材 / 集数 / 画幅 / 钩子）。 */
export function recipeTags(r: DramaRecipe): string[] {
  return [
    r.type,
    r.episodes > 1 ? `${r.episodes} 集` : "单集创意",
    r.ratio,
    ...(r.data?.hooks ?? []).slice(0, 2),
  ].filter(Boolean);
}

/** 创意 → 预览节拍（最多 5 条）。 */
export function recipeBeats(r: DramaRecipe) {
  const beats = r.data?.beats ?? [];
  if (beats.length === 0) return null;
  return beats.slice(0, 5).map((b) => ({
    range: r.episodes > 1 ? `节点 ${b.no}` : `镜头 ${b.no}`,
    beat: `${b.hook} · ${b.beat}`,
    est: "可改",
  }));
}

/** 创意 → 预览估时文案。 */
export function recipeEstimate(r: DramaRecipe): string {
  if (r.episodes <= 1) {
    return `AI 估算 · 单集创意 · 约 45-90 秒 · ${r.ratio} 画幅,开拍后生成逐镜脚本`;
  }
  const secondsPerEpisode = 75;
  const totalMinutes = Math.max(1, Math.round((r.episodes * secondsPerEpisode) / 60));
  return `AI 估算 · ${r.episodes} 集 · 每集约 ${secondsPerEpisode} 秒 · 成片约 ${totalMinutes} 分钟,开拍后给出完整估时大纲`;
}
