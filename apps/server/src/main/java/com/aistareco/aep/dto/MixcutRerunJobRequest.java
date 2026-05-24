package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * v0.30+: POST /api/mixcut/jobs/{jobId}/rerun 的请求体。
 * 两字段均可空：缺省时沿用原 job 的对应快照值。其它字段（slot_bindings / canvas / slots /
 * scenes / sticker_pool / perturbation_overrides / product_id）一律不可由 rerun 入口覆盖，
 * 严格使用原 job 落库的快照 —— 这是「重跑」与「换素材再做」语义的关键边界。
 */
public record MixcutRerunJobRequest(
        @JsonProperty("output_variants") Integer outputVariants,
        @JsonProperty("perturbation_profile") String perturbationProfile
) {
}
