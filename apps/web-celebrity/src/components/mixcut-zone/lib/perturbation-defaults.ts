// 按 layer_type 的默认扰动准入；与 server MixcutRenderingService 中的常量保持同步。
// 设计原则：
//   - 视频/数字人 → 全开，可以镜像/变速/位置抖动
//   - 图片 → 不镜像（商品主图镜像后 logo 是反的）、不缩放抖动；位置抖动 OK
//   - 文字/贴图 → 全关（中文文字镜像或缩放抖动都会失真）
//   - 音频 → 仅"速度"相关，其余不适用

import type { LayerType, SlotPerturbationPolicy } from "../types";

const DEFAULTS: Record<LayerType, Required<SlotPerturbationPolicy>> = {
  video:         { allow_mirror: true,  allow_position_jitter: true,  allow_scale_jitter: true,  allow_speed_jitter: true },
  digital_human: { allow_mirror: true,  allow_position_jitter: true,  allow_scale_jitter: true,  allow_speed_jitter: true },
  image:         { allow_mirror: false, allow_position_jitter: true,  allow_scale_jitter: false, allow_speed_jitter: false },
  text:          { allow_mirror: false, allow_position_jitter: false, allow_scale_jitter: false, allow_speed_jitter: false },
  sticker:       { allow_mirror: false, allow_position_jitter: false, allow_scale_jitter: false, allow_speed_jitter: false },
  audio:         { allow_mirror: false, allow_position_jitter: false, allow_scale_jitter: false, allow_speed_jitter: true },
};

export function defaultPolicyForLayer(layerType: LayerType): Required<SlotPerturbationPolicy> {
  return DEFAULTS[layerType];
}

/** layer 默认 ∪ 模板/用户显式覆盖。 */
export function resolvePolicy(
  layerType: LayerType,
  override?: SlotPerturbationPolicy,
): Required<SlotPerturbationPolicy> {
  const base = DEFAULTS[layerType];
  if (!override) return base;
  return {
    allow_mirror: override.allow_mirror ?? base.allow_mirror,
    allow_position_jitter: override.allow_position_jitter ?? base.allow_position_jitter,
    allow_scale_jitter: override.allow_scale_jitter ?? base.allow_scale_jitter,
    allow_speed_jitter: override.allow_speed_jitter ?? base.allow_speed_jitter,
  };
}
