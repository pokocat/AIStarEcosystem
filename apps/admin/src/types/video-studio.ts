// ─────────────────────────────────────────────────────────────────────────────
// 视频生成（web-celebrity「AI 创作 → 视频生成」，v0.199）—— 后台只用到定价配置这一块。
// 照 AGENTS.md §4.1 从 packages/types/src/video-studio.ts 直接复制，字段与服务端 VideoStudioDtos 1:1。
// 设计真源：docs/video-studio-plan.md §3 / §11。
// ─────────────────────────────────────────────────────────────────────────────

/** 生成模式，取值即厂商 wire 值。 */
export type VideoStudioMode =
  | "t2v"
  | "i2v"
  | "first_last_frame_video"
  | "universal_reference_video";

/**
 * 后台「引擎定价 → 视频生成」编辑的配置（GET/PUT /admin/celebrity/video-studio-pricing）。
 *
 * perSecond[模式][清晰度]：积分 / 秒，1..100000；null = 这一格不单独定价，按后台给模型配的每秒价
 * （AI 模型与 Key → 视频生成候选的单价）。模型也没配每秒价时这一格就是「未定价」，用户那边不能提交。
 */
export interface VideoStudioPricingConfig {
  perSecond: Record<VideoStudioMode, Record<string, number | null>>;
  /** 全能参考里前几张参考图不加价（0..9）。 */
  freeRefImages: number;
  /** 全能参考超出的每张参考图，每秒加多少积分（0 = 不加）。 */
  extraRefImagePerSecond: number;
  /** 智能优化每次多少积分（0 = 不收费）。 */
  promptOptimizationPerCall: number;
}
