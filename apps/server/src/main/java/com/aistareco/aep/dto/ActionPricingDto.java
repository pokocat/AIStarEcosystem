package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * v0.35：单个 action 的单价配置。
 *
 * <ul>
 *   <li>{@code creditPrice} 非空 → 按此积分扣点；</li>
 *   <li>{@code useEnginePricing=true} → 调用方回退到 engine-pricing 表（仅 celebrity.video 适用）；</li>
 *   <li>两者皆空/为 0 → 调用方按自己的旧默认值兜底。</li>
 * </ul>
 *
 * Wire 例：
 * <pre>{@code
 * { "mixcut.generate": { "creditPrice": 30 },
 *   "publish.upload":  { "creditPrice": 20 },
 *   "celebrity.video": { "useEnginePricing": true } }
 * }</pre>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ActionPricingDto(
        Long creditPrice,
        Boolean useEnginePricing
) {}
