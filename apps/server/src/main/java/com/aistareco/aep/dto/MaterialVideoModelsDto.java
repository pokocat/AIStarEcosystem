package com.aistareco.aep.dto;

import java.util.List;

/**
 * 带货线「生成模型」下拉数据（GET /material/videos/models）。
 * 不复用 drama 的 {@link RenderModelsDto}：带货线额外携带服务端算好的有效时长区间
 * （= 协议硬边界 ∩ candidate.maxDurationSec），前端只消费有效区间、不按模型名猜协议。
 * effectiveMinDurationSec / effectiveMaxDurationSec 为 null 表示该侧无已知硬边界。
 * 只含启用候选 × 启用端点；默认 binding 存在但无 candidate 行时合成一条默认项（capability=null）。
 * 字段名与 packages/types/src/material-ops.ts 的 VideoModelOption 1:1（CLAUDE.md §4.1）。
 */
public record MaterialVideoModelsDto(List<VideoModelOptionDto> video) {

    public record VideoModelOptionDto(
            String endpointId,
            String name,
            boolean isDefault,
            EndpointCapabilityDto capability,
            long creditCost,
            String billingUnit,
            Integer effectiveMinDurationSec,
            Integer effectiveMaxDurationSec,
            /** true = 存在 candidate 行，可显式携带 endpoint_id 提交（白名单可命中）；
             *  false = 合成默认项（无 candidate 行），必须走缺省默认路径，显式传 id 会被拒。 */
            boolean selectableById
    ) {}
}
