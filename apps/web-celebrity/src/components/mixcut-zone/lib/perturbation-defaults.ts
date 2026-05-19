// 按 layer_type 的默认"逐素材抖动"准入；与 server MixcutRenderingService 中的常量保持同步。
// 设计原则（v0.x 重构后,layer_type 收缩到 4 类）：
//   - 视频 → 位置 + 缩放都开（含原 digital_human）
//   - 图片 → 位置开,缩放关（含原 sticker;品牌 LOGO / 贴图需禁抖动的由模板 slot.perturbation_policy 显式覆盖）
//   - 文字 → 全关（中文文字抖动会移出版心）
//   - 音频 → 不适用
//
// "镜像 / 速度 / 亮度 / 饱和度"是整段画面级算子,只在任务级 PerturbationOverrides 上开关,
// 不再放进每个 slot 的 policy。

import type { LayerType, SlotPerturbationPolicy } from "../types";

const DEFAULTS: Record<LayerType, Required<SlotPerturbationPolicy>> = {
  video: { allow_position_jitter: true,  allow_scale_jitter: true  },
  image: { allow_position_jitter: true,  allow_scale_jitter: false },
  text:  { allow_position_jitter: false, allow_scale_jitter: false },
  audio: { allow_position_jitter: false, allow_scale_jitter: false },
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
    allow_position_jitter: override.allow_position_jitter ?? base.allow_position_jitter,
    allow_scale_jitter: override.allow_scale_jitter ?? base.allow_scale_jitter,
  };
}
