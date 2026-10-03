// 模板（DramaRecipe，模板广场里的条目）→ 预览展示的派生工具（v0.78）。
// 首页（dashboard）短剧预览与短视频新建控制台（ShortCreateConsole）共用一套，
// 避免「又重复实现了一套」。纯函数，无 React 依赖。
import type { DramaRecipe } from "@/api/recipes";

/** 模板 → 灌进对话框的一句话种子（优先主线，其次题材+简介）。 */
export function recipePromptSeed(r: DramaRecipe): string {
  const mainline = r.data?.mainline?.trim();
  return mainline || `${r.type} · ${r.summary || r.title}`;
}

/** 单条短视频一律竖屏：短视频制作页建草稿时写死 9:16，没有改画幅的地方。 */
const SHORT_RATIO_LABEL = "竖屏 9:16";

/** 模板 → 预览标签（题材 / 集数 / 画幅 / 钩子）。 */
export function recipeTags(r: DramaRecipe): string[] {
  return [
    r.type,
    r.episodes > 1 ? `${r.episodes} 集` : "单条短视频",
    // 单条模板上存的 ratio 可能是横屏，但做出来的短视频一定是竖屏，照实际写。
    r.episodes > 1 ? r.ratio : SHORT_RATIO_LABEL,
    ...(r.data?.hooks ?? []).slice(0, 2),
  ].filter(Boolean);
}

/** 模板 → 预览里的分集剧情 / 分段（最多 5 条）。 */
export function recipeBeats(r: DramaRecipe) {
  const beats = r.data?.beats ?? [];
  if (beats.length === 0) return null;
  return beats.slice(0, 5).map((b) => ({
    range: r.episodes > 1 ? `第 ${b.no} 集` : `第 ${b.no} 段`,
    beat: [b.hook, b.beat].filter(Boolean).join(" · "),
    est: "",
  }));
}

/** 模板 → 预览里的时长预估文案。 */
export function recipeEstimate(r: DramaRecipe): string {
  if (r.episodes <= 1) {
    // 模板里没有时长字段，别写死秒数（此前写「45-90 秒」，和模板自己写的「适合 1–3 分钟」打架）。
    return `做同款后先按你的主题写口播脚本和分镜，成片固定${SHORT_RATIO_LABEL}，每一镜的时长都能再改`;
  }
  const secondsPerEpisode = 75;
  const totalMinutes = Math.max(1, Math.round((r.episodes * secondsPerEpisode) / 60));
  return `共 ${r.episodes} 集，每集约 ${secondsPerEpisode} 秒，全剧约 ${totalMinutes} 分钟`;
}
