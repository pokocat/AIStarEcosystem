package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.billing.service.ModelBillingMath;
import com.aistareco.aep.billing.service.ModelBillingTarget;
import com.aistareco.aep.billing.service.ModelChargeContext;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.service.AiChatTokenPricing;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.util.Objects;
import org.springframework.http.HttpStatus;

/** One accepted token rate and route for finite Studio text workflows. Amounts remain platform credits. */
public final class StudioTokenBilling {
    private static final ObjectMapper JSON = new ObjectMapper();
    private StudioTokenBilling() {}

    public static ModelChargeContext plan(AiModelEndpoint endpoint, AiChatTokenPricing.Rate rate) {
        if (endpoint == null || rate == null) return ModelChargeContext.NONE; // Fixtures and non-model assembly.
        if (rate.maxCost() <= 0) throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,
                "MODEL_PRICE_NOT_CONFIGURED", "请先配置文本模型标准售价。想免费送用户体验，请发放模型赠款");
        return ModelChargeContext.forCredits(endpoint,rate.maxCost());
    }

    public static void store(ObjectNode execution, ModelChargeContext charge, AiModelEndpoint endpoint) {
        if (charge.target() == null) return;
        execution.set("modelCharge", JSON.valueToTree(charge));
        execution.put("modelChargeBaseUrl", endpoint.getBaseUrl());
    }

    public static boolean applies(JsonNode input) {
        return input.path("_exec").path("modelCharge").hasNonNull("target");
    }

    /** A model edit must not redirect an accepted grant to another supplier or model. */
    public static void requireRoute(JsonNode input, AiModelEndpoint endpoint) {
        if (!applies(input)) return; // Historical tasks keep their original accounting.
        JsonNode execution = input.path("_exec"), target = execution.path("modelCharge").path("target");
        if (!Objects.equals(target.path("endpointId").asText(null), endpoint.getId())
                || !Objects.equals(target.path("providerModel").asText(null), ModelBillingTarget.providerModelOf(endpoint))
                || !Objects.equals(execution.path("modelChargeBaseUrl").asText(null), endpoint.getBaseUrl()))
            throw new BusinessException(HttpStatus.CONFLICT, "MODEL_BILLING_ROUTE_CHANGED", "文本模型渠道已变更，请重新确认后再生成");
    }

    public static ModelBillingMath.Usage usage(long inputTokens, long outputTokens) {
        if (inputTokens < 0 || outputTokens < 0) throw BusinessException.badRequest("AI_USAGE_INVALID", "模型 Token 用量无效");
        return new ModelBillingMath.Usage(BigDecimal.valueOf(inputTokens, 3), BigDecimal.valueOf(outputTokens, 3));
    }

    public static ModelBillingMath.Usage measured(JsonNode output) {
        JsonNode billing = output.path("billing");
        if (!billing.path("inputTokens").isIntegralNumber() || !billing.path("outputTokens").isIntegralNumber())
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_USAGE_MISSING", "模型未返回有效 Token 用量，本次未扣积分");
        return usage(billing.path("inputTokens").longValue(), billing.path("outputTokens").longValue());
    }
}
