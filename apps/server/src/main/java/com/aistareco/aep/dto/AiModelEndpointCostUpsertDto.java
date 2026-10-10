package com.aistareco.aep.dto;

/** Supplier cost only; customer candidate pricing and its operational unit are unchanged. */
public record AiModelEndpointCostUpsertDto(
        String supplierBillingMode,
        Long promptTokenPriceMicros,
        Long completionTokenPriceMicros,
        Long unitPriceMicros
) {}
