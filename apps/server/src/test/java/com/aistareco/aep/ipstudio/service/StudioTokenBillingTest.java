package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.service.AiChatTokenPricing;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class StudioTokenBillingTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test void existingTokenPricingConvertsToCreditsBeforeTheSharedEndpointCharge() {
        var endpoint=AiModelEndpoint.builder().id("channel").model("model").baseUrl("https://a.invalid").build();
        var rate=new AiChatTokenPricing.Rate(new BigDecimal("0.18"),new BigDecimal("1.08"),65536,8192);
        var charge=StudioTokenBilling.plan(endpoint,rate);
        assertEquals("credit",charge.target().unit());
        assertEquals(rate.maxCost(),charge.usage().quantity().longValueExact());
        assertEquals(0,charge.usage().outputQuantity().signum());
        assertEquals(rate.maxCost(),charge.maxWalletCredits());
        var input=json.createObjectNode();StudioTokenBilling.store(input.putObject("_exec"),charge,endpoint);
        StudioTokenBilling.requireRoute(input,endpoint);
        endpoint.setModel("other");
        assertEquals("MODEL_BILLING_ROUTE_CHANGED",assertThrows(BusinessException.class,()->StudioTokenBilling.requireRoute(input,endpoint)).getCode());
        endpoint.setModel("model");endpoint.setBaseUrl("https://b.invalid");
        assertThrows(BusinessException.class,()->StudioTokenBilling.requireRoute(input,endpoint));
    }

    @Test void unpricedTextCannotBecomeUnlimitedFreeWorkAndMissingUsageIsNotInvented() {
        var endpoint=AiModelEndpoint.builder().id("channel").model("model").build();
        assertEquals("MODEL_PRICE_NOT_CONFIGURED",assertThrows(BusinessException.class,
                ()->StudioTokenBilling.plan(endpoint,new AiChatTokenPricing.Rate(BigDecimal.ZERO,BigDecimal.ZERO,1000,1000))).getCode());
        assertEquals("AI_USAGE_MISSING",assertThrows(BusinessException.class,()->StudioTokenBilling.measured(json.createObjectNode())).getCode());
    }
}
